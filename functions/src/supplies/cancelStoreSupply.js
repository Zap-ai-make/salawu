/**
 * Handler d'ANNULATION d'un ravitaillement.
 *
 * Sémantique :
 *   Le ravitaillement est repris : le solde est débité de son montant courant,
 *   et la ligne passe en `cancelled`. Elle RESTE dans le registre, barrée.
 *
 * ⚠ « SUPPRIMABLE » À L'ÉCRAN, JAMAIS SUPPRIMÉ EN BASE. `delete()` effacerait le
 * montant, l'auteur et la date : plus rien ne dirait qu'une somme est entrée
 * puis repartie, et un solde cesserait d'être explicable. CLAUDE.md : « Toute
 * opération financière doit préserver une piste d'audit. » Un statut coûte le
 * même geste et tient la promesse.
 *
 * ⚠ ET LA LIGNE RESTE VISIBLE, BARRÉE — l'écran ne la masque PAS. Deux raisons.
 * D'abord un registre qui escamote ses annulations ne se recoupe plus avec la
 * carte : on lirait trois entrées pour un solde qui en compte quatre. Ensuite,
 * masquer côté client après un `limit()` serveur est le bug « limiter puis
 * filtrer » déjà payé deux fois sur ce dépôt (collaborations, dettes internes) :
 * la fenêtre se vide de ses lignes visibles et l'écran paraît incomplet.
 *
 * ⚠ ANNULER PEUT ÉCHOUER, ET C'EST VOULU. Si la carte a déjà été dépensée,
 * reprendre le montant rendrait le solde négatif : `applySupplyDelta` lève
 * INSUFFICIENT_BALANCE_FOR_REVERSAL plutôt que de raboter à zéro. Raboter
 * ferait disparaître la différence sans que personne ne l'apprenne.
 *
 * db et FieldValue injectés (testabilité sans émulateur Functions).
 */

import { DealerRequestError } from '../errors.js'
import { validateAuthUid, validateInputPayload, validateProfileData } from '../dealerRequests/shared.js'
import {
  validateSupplyId,
  validateSupplyReason,
  readSupplyBalance,
  applySupplyDelta,
  validateSupplyForWrite,
  SUPPLY_STATUSES,
} from './shared.js'

export async function cancelStoreSupplyHandler(request, { db, FieldValue }) {
  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const actorUid = validateAuthUid(request.auth?.uid)

  // ── 2. Forme du payload (allow-list) ───────────────────────────────────────
  //
  // Le motif est REQUIS ici, alors qu'il est facultatif à la création et à la
  // correction. Annuler fait disparaître une entrée d'argent de la liste : c'est
  // le seul geste dont la trace serait illisible sans sa raison.
  const payload = validateInputPayload(request.data, ['supplyId', 'reason'])
  const supplyId = validateSupplyId(payload.supplyId)
  const reason = validateSupplyReason(payload.reason, { required: true })

  // ── 3. Prévalidation profil ────────────────────────────────────────────────
  const profileSnap = await db.doc(`users/${actorUid}`).get()
  if (!profileSnap.exists) {
    throw new DealerRequestError('PROFILE_NOT_FOUND', 'Profil utilisateur introuvable.')
  }
  validateProfileData(profileSnap.data())

  // ── 4. Transaction atomique : reprise du solde + statut + audit ────────────
  let result
  try {
    result = await db.runTransaction(async (t) => {
      const txProfileSnap = await t.get(db.doc(`users/${actorUid}`))
      if (!txProfileSnap.exists) {
        throw new DealerRequestError('PROFILE_NOT_FOUND', 'Profil utilisateur introuvable.')
      }
      const txProfile = txProfileSnap.data()
      const storeId = validateProfileData(txProfile)

      const supplyRef = db.doc(`storeSupplies/${supplyId}`)
      const supplySnap = await t.get(supplyRef)
      if (!supplySnap.exists) {
        throw new DealerRequestError('SUPPLY_NOT_FOUND', 'Ravitaillement introuvable.')
      }
      // Lève SUPPLY_ALREADY_CANCELLED si la ligne est déjà annulée : sans cette
      // garde, un double clic reprendrait le montant DEUX fois.
      const { network, resource, amount } = validateSupplyForWrite(supplySnap.data(), storeId)

      const balRef = db.doc(`clients/${storeId}/networkBalances/current`)
      const balSnap = await t.get(balRef)
      if (!balSnap.exists) {
        throw new DealerRequestError('BALANCE_NOT_FOUND', 'Document de soldes introuvable pour cette boutique.')
      }
      const previousBalance = readSupplyBalance(balSnap.data(), network, resource)
      const newBalance = applySupplyDelta(previousBalance, -amount)
      const now = FieldValue.serverTimestamp()

      t.set(balRef, {
        balances: { [network]: { [resource]: newBalance } },
        updatedAt: now,
      }, { merge: true })

      // `amount` est CONSERVÉ tel quel : c'est le montant qui a été repris, et
      // le barrer à zéro rendrait la ligne annulée indéchiffrable.
      t.update(supplyRef, {
        status: SUPPLY_STATUSES.CANCELLED,
        updatedAt: now,
        cancelledAt: now,
        cancelledByUid: actorUid,
        cancelledByName: txProfile.name ?? null,
        cancellationReason: reason,
      })

      const auditRef = db.collection(`clients/${storeId}/auditLogs`).doc()
      t.set(auditRef, {
        action: 'STORE_SUPPLY_CANCELLED',
        actorUid,
        actorEmail: txProfile.email ?? null,
        actorName: txProfile.name ?? null,
        actorRole: 'store_admin',
        actorStoreId: storeId,
        supplyId,
        network,
        resource,
        amount,
        reason,
        previousBalance,
        newBalance,
        createdAt: now,
      })

      return { amount, previousBalance, newBalance }
    })
  } catch (err) {
    if (err instanceof DealerRequestError) throw err
    throw new DealerRequestError('TRANSACTION_FAILED', "L'opération n'a pas pu être finalisée. Veuillez réessayer.")
  }

  return { success: true, supplyId, ...result }
}
