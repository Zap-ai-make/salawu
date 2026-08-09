/**
 * Handler — confirmation d'une collaboration par la boutique FOURNISSEUSE.
 *
 * La fournisseuse (store_admin de supplierStoreId) exécute la vraie opération
 * Mobile Money puis confirme. TOUT le mouvement financier a lieu ICI (rien à la
 * création) :
 *   • deposit    : stock fournisseur −amount (a envoyé le float) ; exige stock ≥ amount.
 *   • withdrawal : stock fournisseur +amount (sa SIM a reçu le float).
 *   • création d'une dette interne dans la direction validée (règle cahier) :
 *       deposit → dette demandeuse→fournisseuse ; withdrawal → fournisseuse→demandeuse.
 * Le tout dans une seule runTransaction (atomicité collab + solde + dette + audit).
 *
 * db et FieldValue injectés (testabilité émulateur).
 */

import { DealerRequestError } from '../errors.js'
import { validateAuthUid, validateInputPayload, validateProfileData } from '../dealerRequests/shared.js'
import { readDealerBalanceAmount } from '../storeTransfers/shared.js'
import {
  validateCollaborationId,
  validateOperationType,
  validateCollaborationAmount,
  supplierStockDelta,
  debtDirection,
} from './shared.js'

export async function confirmStoreCollaborationHandler(request, { db, FieldValue }) {
  const actorUid = validateAuthUid(request.auth?.uid)
  const payload = validateInputPayload(request.data, ['collaborationId'])
  const collaborationId = validateCollaborationId(payload.collaborationId)

  const profileSnap = await db.doc(`users/${actorUid}`).get()
  if (!profileSnap.exists) {
    throw new DealerRequestError('PROFILE_NOT_FOUND', 'Profil utilisateur introuvable.')
  }
  validateProfileData(profileSnap.data())

  let result
  try {
    result = await db.runTransaction(async (t) => {
      const txProfileSnap = await t.get(db.doc(`users/${actorUid}`))
      if (!txProfileSnap.exists) {
        throw new DealerRequestError('PROFILE_NOT_FOUND', 'Profil utilisateur introuvable.')
      }
      const txProfile = txProfileSnap.data()
      const actorStoreId = validateProfileData(txProfile)

      const collabRef = db.doc(`storeCollaborations/${collaborationId}`)
      const collabSnap = await t.get(collabRef)
      if (!collabSnap.exists) {
        throw new DealerRequestError('COLLABORATION_NOT_FOUND', 'Collaboration introuvable.')
      }
      const collab = collabSnap.data()

      // Seule la boutique FOURNISSEUSE confirme.
      if (collab.supplierStoreId !== actorStoreId) {
        throw new DealerRequestError('COLLABORATION_STORE_MISMATCH', 'Cette collaboration ne vous est pas destinée.')
      }
      if (collab.status !== 'pending') {
        throw new DealerRequestError('COLLABORATION_NOT_PENDING', 'Cette collaboration a déjà été traitée.')
      }

      const operationType = validateOperationType(collab.operationType)
      const amount = validateCollaborationAmount(collab.amount)
      const network = collab.network

      // Défense en profondeur : fournisseuse toujours isProvider sur ce réseau.
      const cfgSnap = await t.get(db.doc(`storeNetworkConfig/${actorStoreId}`))
      const netCfg = cfgSnap.exists ? cfgSnap.data()?.networks?.[network] : null
      if (!netCfg || netCfg.isProvider !== true) {
        throw new DealerRequestError('SUPPLIER_NOT_PROVIDER', 'Vous n\'êtes plus fournisseuse sur ce réseau.')
      }

      // Solde stock fournisseur (0 si le document/réseau n'existe pas encore).
      const balRef = db.doc(`clients/${actorStoreId}/networkBalances/current`)
      const balSnap = await t.get(balRef)
      const previousSupplierBalance = readDealerBalanceAmount(balSnap.exists ? balSnap.data() : null, 'stock', network)

      const delta = supplierStockDelta(operationType, amount)
      if (operationType === 'deposit' && previousSupplierBalance < amount) {
        throw new DealerRequestError('INSUFFICIENT_SUPPLIER_BALANCE', 'Stock insuffisant pour exécuter cette collaboration.')
      }
      const newSupplierBalance = previousSupplierBalance + delta
      if (!Number.isSafeInteger(newSupplierBalance) || newSupplierBalance < 0) {
        throw new DealerRequestError('BALANCE_OVERFLOW', 'Le solde résultant est invalide.')
      }

      const now = FieldValue.serverTimestamp()

      // Mouvement stock fournisseur — set+merge (crée le doc si absent, préserve les autres champs/réseaux).
      t.set(balRef, {
        balances: { [network]: { stock: newSupplierBalance } },
        updatedAt: now,
      }, { merge: true })

      // Dette interne dans la direction validée.
      const { debtorStoreId, creditorStoreId } = debtDirection(operationType, {
        requestingStoreId: collab.requestingStoreId,
        supplierStoreId: collab.supplierStoreId,
      })
      const nameOf = (storeId) => storeId === collab.requestingStoreId
        ? (collab.requestingStoreName ?? null)
        : (collab.supplierStoreName ?? null)

      const debtRef = db.collection('internalDebts').doc()
      t.set(debtRef, {
        collaborationId,
        debtorStoreId,
        debtorStoreName: nameOf(debtorStoreId),
        creditorStoreId,
        creditorStoreName: nameOf(creditorStoreId),
        network,
        operationType,
        originalAmount: amount,
        settledAmount: 0,
        remainingAmount: amount,
        status: 'open',
        createdAt: now,
        updatedAt: now,
      })

      // Collaboration confirmée
      t.update(collabRef, {
        status: 'confirmed',
        updatedAt: now,
        confirmedBy: actorUid,
        confirmedAt: now,
        previousSupplierBalance,
        newSupplierBalance,
        debtId: debtRef.id,
      })

      // Audit fournisseuse (mouvement de stock + dette créée)
      const auditRef = db.collection(`clients/${actorStoreId}/auditLogs`).doc()
      t.set(auditRef, {
        action: 'STORE_COLLABORATION_CONFIRMED',
        actorUid,
        actorEmail: txProfile.email ?? null,
        actorName: txProfile.name ?? null,
        actorRole: 'store_admin',
        actorStoreId,
        collaborationId,
        debtId: debtRef.id,
        requestingStoreId: collab.requestingStoreId,
        network,
        operationType,
        amount,
        previousBalance: previousSupplierBalance,
        newBalance: newSupplierBalance,
        createdAt: now,
      })

      return { debtId: debtRef.id, previousSupplierBalance, newSupplierBalance }
    })
  } catch (err) {
    if (err instanceof DealerRequestError) throw err
    throw new DealerRequestError('TRANSACTION_FAILED', 'La transaction a échoué. Veuillez réessayer.')
  }

  return {
    success: true,
    collaborationId,
    debtId: result.debtId,
    previousSupplierBalance: result.previousSupplierBalance,
    newSupplierBalance: result.newSupplierBalance,
  }
}
