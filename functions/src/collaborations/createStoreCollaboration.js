/**
 * Handler — création d'une collaboration inter-boutiques (Vague 2, Tranche 1).
 *
 * La boutique DEMANDEUSE (store_admin actif) crée UN document = sa transaction
 * agent + la demande à la boutique FOURNISSEUSE. AUCUN mouvement de solde ici :
 * la collaboration reste `pending` jusqu'à confirmation par la fournisseuse.
 * Anti-duplication : la fournisseuse ne crée jamais de transaction, elle confirme.
 *
 * Contrôles serveur-autoritatifs : fournisseuse ≠ demandeuse, fournisseuse existe
 * et est FOURNISSEUR (isProvider) sur ce réseau (storeNetworkConfig), client existe
 * (liste commune globalClients, nom dénormalisé par lecture serveur).
 *
 * db et FieldValue injectés (testabilité émulateur).
 */

import { DealerRequestError } from '../errors.js'
import { validateAuthUid, validateInputPayload, validateProfileData } from '../dealerRequests/shared.js'
import { SUPPORTED_NETWORKS } from '../storeNetworkConfig/shared.js'
import {
  validateOperationType,
  validateCollaborationAmount,
  validateStoreRef,
  validateClientId,
} from './shared.js'

const SUPPORTED_NETWORK_SET = new Set(SUPPORTED_NETWORKS)

export async function createStoreCollaborationHandler(request, { db, FieldValue }) {
  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const actorUid = validateAuthUid(request.auth?.uid)

  // ── 2. Payload (liste blanche stricte) ──────────────────────────────────────
  const payload = validateInputPayload(request.data, ['clientId', 'network', 'operationType', 'amount', 'supplierStoreId'])
  const clientId = validateClientId(payload.clientId)
  const operationType = validateOperationType(payload.operationType)
  const amount = validateCollaborationAmount(payload.amount)
  const supplierStoreId = validateStoreRef(payload.supplierStoreId, 'boutique fournisseuse')
  const network = payload.network
  if (typeof network !== 'string' || !SUPPORTED_NETWORK_SET.has(network)) {
    throw new DealerRequestError('INVALID_COLLABORATION_NETWORK', 'Réseau invalide.')
  }

  // ── 3. Prévalidation profil (store_admin actif) ─────────────────────────────
  const profileSnap = await db.doc(`users/${actorUid}`).get()
  if (!profileSnap.exists) {
    throw new DealerRequestError('PROFILE_NOT_FOUND', 'Profil utilisateur introuvable.')
  }
  validateProfileData(profileSnap.data())

  // ── 4. Transaction : lectures autoritatives + création pending ──────────────
  let result
  try {
    result = await db.runTransaction(async (t) => {
      const txProfileSnap = await t.get(db.doc(`users/${actorUid}`))
      if (!txProfileSnap.exists) {
        throw new DealerRequestError('PROFILE_NOT_FOUND', 'Profil utilisateur introuvable.')
      }
      const txProfile = txProfileSnap.data()
      const requestingStoreId = validateProfileData(txProfile)

      if (requestingStoreId === supplierStoreId) {
        throw new DealerRequestError('SAME_STORE_COLLABORATION', 'La boutique fournisseuse doit être différente de la vôtre.')
      }

      const reqStoreSnap = await t.get(db.doc(`stores/${requestingStoreId}`))
      const requestingStoreName = reqStoreSnap.exists ? (reqStoreSnap.data().name ?? null) : null

      const supplierSnap = await t.get(db.doc(`stores/${supplierStoreId}`))
      if (!supplierSnap.exists) {
        throw new DealerRequestError('SUPPLIER_STORE_NOT_FOUND', 'Boutique fournisseuse introuvable.')
      }
      const supplierStoreName = supplierSnap.data().name ?? null

      // Fournisseur éligible pour ce réseau (Config Boutique × Réseau, Vague 1)
      const cfgSnap = await t.get(db.doc(`storeNetworkConfig/${supplierStoreId}`))
      const netCfg = cfgSnap.exists ? cfgSnap.data()?.networks?.[network] : null
      if (!netCfg || netCfg.isProvider !== true) {
        throw new DealerRequestError('SUPPLIER_NOT_PROVIDER', 'Cette boutique n\'est pas fournisseuse sur ce réseau.')
      }

      // Client de la liste commune (dénormalisation nom par lecture serveur)
      const clientSnap = await t.get(db.doc(`globalClients/${clientId}`))
      if (!clientSnap.exists) {
        throw new DealerRequestError('CLIENT_NOT_FOUND', 'Client introuvable.')
      }
      const clientData = clientSnap.data()

      const now = FieldValue.serverTimestamp()
      const collabRef = db.collection('storeCollaborations').doc()
      t.set(collabRef, {
        requestingStoreId,
        requestingStoreName,
        requestingStoreAdminUid: actorUid,
        supplierStoreId,
        supplierStoreName,
        clientId,
        clientNom: clientData.nom ?? null,
        clientPrenom: clientData.prenom ?? null,
        network,
        operationType,
        amount,
        status: 'pending',
        previousSupplierBalance: null,
        newSupplierBalance: null,
        debtId: null,
        createdAt: now,
        updatedAt: now,
        confirmedBy: null,
        confirmedAt: null,
        rejectedBy: null,
        rejectedAt: null,
        rejectionReason: null,
      })

      // Piste d'audit boutique demandeuse
      const auditRef = db.collection(`clients/${requestingStoreId}/auditLogs`).doc()
      t.set(auditRef, {
        action: 'STORE_COLLABORATION_CREATED',
        actorUid,
        actorEmail: txProfile.email ?? null,
        actorName: txProfile.name ?? null,
        actorRole: 'store_admin',
        actorStoreId: requestingStoreId,
        collaborationId: collabRef.id,
        supplierStoreId,
        clientId,
        network,
        operationType,
        amount,
        createdAt: now,
      })

      return { collaborationId: collabRef.id }
    })
  } catch (err) {
    if (err instanceof DealerRequestError) throw err
    throw new DealerRequestError('TRANSACTION_FAILED', 'La transaction a échoué. Veuillez réessayer.')
  }

  return { success: true, collaborationId: result.collaborationId }
}
