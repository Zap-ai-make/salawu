/**
 * Handler de création d'un RAVITAILLEMENT (crédit d'une carte réseau boutique).
 *
 * Sémantique :
 *   De l'argent entre dans une carte de la boutique sans passer par le dealer.
 *   Le solde est crédité immédiatement, et la ligne de registre est écrite DANS
 *   LA MÊME TRANSACTION. C'est tout l'objet de ce handler : le solde et sa
 *   justification ne peuvent pas exister l'un sans l'autre.
 *
 * ⚠ AUCUN MONTANT ABSOLU N'EST ACCEPTÉ. Le client envoie un montant À AJOUTER ;
 * le solde de départ est LU dans la transaction. Accepter un solde final aurait
 * rouvert, sous un autre nom, la porte que ce chantier ferme (firestore.rules
 * l. 583-589).
 *
 * db et FieldValue injectés (testabilité sans émulateur Functions).
 */

import { DealerRequestError } from '../errors.js'
import { validateAuthUid, validateInputPayload, validateProfileData } from '../dealerRequests/shared.js'
import {
  resolveSupplyNetwork,
  validateSupplyResource,
  validateSupplyAmount,
  validateSupplyReason,
  readSupplyBalance,
  applySupplyDelta,
  SUPPLY_STATUSES,
} from './shared.js'
import { STORE_NETWORKS } from '../config/storeProfile.js'

export async function createStoreSupplyHandler(request, { db, FieldValue, storeNetworks = STORE_NETWORKS }) {
  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const actorUid = validateAuthUid(request.auth?.uid)

  // ── 2. Forme du payload (allow-list) ───────────────────────────────────────
  const payload = validateInputPayload(request.data, ['resource', 'amount', 'network', 'note'])
  const resource = validateSupplyResource(payload.resource)
  const amount = validateSupplyAmount(payload.amount)
  const network = resolveSupplyNetwork(payload.network, storeNetworks)
  const note = validateSupplyReason(payload.note)

  // ── 3. Prévalidation profil (retour d'erreur anticipé, hors transaction) ───
  const profileSnap = await db.doc(`users/${actorUid}`).get()
  if (!profileSnap.exists) {
    throw new DealerRequestError('PROFILE_NOT_FOUND', 'Profil utilisateur introuvable.')
  }
  validateProfileData(profileSnap.data())

  // ── 4. Transaction atomique : crédit du solde + registre + audit ───────────
  let result
  try {
    result = await db.runTransaction(async (t) => {
      // Relecture AUTORITATIVE du profil : si `active`, `role` ou `storeId`
      // changent entre la prévalidation et le commit, la transaction est rejetée.
      const txProfileSnap = await t.get(db.doc(`users/${actorUid}`))
      if (!txProfileSnap.exists) {
        throw new DealerRequestError('PROFILE_NOT_FOUND', 'Profil utilisateur introuvable.')
      }
      const txProfile = txProfileSnap.data()
      const storeId = validateProfileData(txProfile)

      // Nom de boutique (dénormalisation) — best effort, comme les transferts.
      const storeSnap = await t.get(db.doc(`stores/${storeId}`))
      const storeName = storeSnap.exists ? (storeSnap.data().name ?? null) : null

      const balRef = db.doc(`clients/${storeId}/networkBalances/current`)
      const balSnap = await t.get(balRef)

      // ⚠ UN DOCUMENT DE SOLDES ABSENT N'EST PAS UNE ERREUR ICI, au contraire des
      // transferts (qui DÉBITENT et exigent donc un solde existant). Une boutique
      // qui n'a jamais rien saisi n'a pas encore de document : son premier geste
      // peut légitimement être un ravitaillement. On part de zéro et `merge`
      // crée le document.
      const previousBalance = balSnap.exists
        ? readSupplyBalance(balSnap.data(), network, resource)
        : 0
      const newBalance = applySupplyDelta(previousBalance, amount)
      const now = FieldValue.serverTimestamp()

      // `merge` et non `update` : préserve les autres réseaux ET l'autre
      // ressource du même réseau, tout en créant le document s'il manque.
      t.set(balRef, {
        balances: { [network]: { [resource]: newBalance } },
        updatedAt: now,
      }, { merge: true })

      // Le registre. `originalAmount` est figé à la création et ne bouge plus :
      // une correction change `amount`, jamais lui. C'est ce qui permet de lire
      // « 20 000, corrigé en 25 000 » sans interroger les journaux.
      const supplyRef = db.collection('storeSupplies').doc()
      t.set(supplyRef, {
        storeId,
        storeName,
        createdByUid: actorUid,
        createdByName: txProfile.name ?? null,
        createdByEmail: txProfile.email ?? null,
        network,
        resource,
        amount,
        originalAmount: amount,
        note,
        status: SUPPLY_STATUSES.ACTIVE,
        previousBalance,
        newBalance,
        createdAt: now,
        updatedAt: now,
        correctionCount: 0,
        correctedAt: null,
        correctedByUid: null,
        correctedByName: null,
        correctionReason: null,
        cancelledAt: null,
        cancelledByUid: null,
        cancelledByName: null,
        cancellationReason: null,
      })

      // Piste d'audit : APPEND-ONLY, et c'est elle qui porte l'histoire complète.
      // Le document de registre porte l'état COURANT ; les journaux portent la
      // succession des gestes. Les deux sont nécessaires — l'un se lit à l'écran,
      // l'autre répond à « qui a changé quoi, et quand ».
      const auditRef = db.collection(`clients/${storeId}/auditLogs`).doc()
      t.set(auditRef, {
        action: 'STORE_SUPPLY_CREATED',
        actorUid,
        actorEmail: txProfile.email ?? null,
        actorName: txProfile.name ?? null,
        actorRole: 'store_admin',
        actorStoreId: storeId,
        supplyId: supplyRef.id,
        network,
        resource,
        amount,
        previousBalance,
        newBalance,
        createdAt: now,
      })

      return { supplyId: supplyRef.id, previousBalance, newBalance }
    })
  } catch (err) {
    if (err instanceof DealerRequestError) throw err
    throw new DealerRequestError('TRANSACTION_FAILED', "L'opération n'a pas pu être finalisée. Veuillez réessayer.")
  }

  return {
    success: true,
    supplyId: result.supplyId,
    previousBalance: result.previousBalance,
    newBalance: result.newBalance,
  }
}
