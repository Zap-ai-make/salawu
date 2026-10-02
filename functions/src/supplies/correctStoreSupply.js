/**
 * Handler de CORRECTION d'un ravitaillement.
 *
 * Sémantique :
 *   Le montant d'un ravitaillement passé est remplacé par un autre. Le solde
 *   bouge du DELTA (nouveau − ancien), dans la même transaction que l'écriture
 *   au registre. Corriger 20 000 en 25 000 crédite 5 000 ; corriger 20 000 en
 *   15 000 en reprend 5 000.
 *
 * ⚠ SANS CE DELTA, LA CARTE ET LE REGISTRE DIVERGENT EN SILENCE. Une correction
 * qui ne toucherait que la ligne d'historique laisserait le solde porter
 * l'ancien montant : l'écran dirait 25 000, la carte vaudrait 20 000, et rien
 * ne serait en panne. C'est le défaut exact que ce chantier ferme.
 *
 * ⚠ LE REGISTRE N'EST PAS RÉÉCRIT, IL EST ANNOTÉ. `originalAmount` ne bouge
 * jamais, `correctionCount` s'incrémente, et chaque geste laisse une entrée
 * APPEND-ONLY dans `clients/<storeId>/auditLogs` avec l'ancien et le nouveau
 * montant. L'écran peut donc offrir « modifier » — CLAUDE.md exige qu'une
 * opération financière préserve une piste d'audit, et elle est préservée.
 *
 * db et FieldValue injectés (testabilité sans émulateur Functions).
 */

import { DealerRequestError } from '../errors.js'
import { validateAuthUid, validateInputPayload, validateProfileData } from '../dealerRequests/shared.js'
import {
  validateSupplyId,
  validateSupplyAmount,
  validateSupplyReason,
  readSupplyBalance,
  applySupplyDelta,
  validateSupplyForWrite,
} from './shared.js'

export async function correctStoreSupplyHandler(request, { db, FieldValue }) {
  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const actorUid = validateAuthUid(request.auth?.uid)

  // ── 2. Forme du payload (allow-list) ───────────────────────────────────────
  //
  // Ni `network` ni `resource` : on ne DÉPLACE pas un ravitaillement d'une carte
  // à l'autre. Ce serait deux mouvements de solde déguisés en correction, et
  // l'historique montrerait une ligne qui a changé de sens. Se tromper de carte
  // s'annule et se ressaisit — deux lignes, deux gestes, deux traces.
  const payload = validateInputPayload(request.data, ['supplyId', 'amount', 'reason'])
  const supplyId = validateSupplyId(payload.supplyId)
  const nextAmount = validateSupplyAmount(payload.amount)
  const reason = validateSupplyReason(payload.reason)

  // ── 3. Prévalidation profil ────────────────────────────────────────────────
  const profileSnap = await db.doc(`users/${actorUid}`).get()
  if (!profileSnap.exists) {
    throw new DealerRequestError('PROFILE_NOT_FOUND', 'Profil utilisateur introuvable.')
  }
  validateProfileData(profileSnap.data())

  // ── 4. Transaction atomique : delta de solde + annotation + audit ──────────
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
      // Cloisonnement + état : le storeId vient du PROFIL relu, jamais du payload.
      const { network, resource, amount: currentAmount } = validateSupplyForWrite(supplySnap.data(), storeId)

      if (nextAmount === currentAmount) {
        throw new DealerRequestError('SUPPLY_UNCHANGED', 'Le montant est déjà celui-ci.')
      }

      const balRef = db.doc(`clients/${storeId}/networkBalances/current`)
      const balSnap = await t.get(balRef)
      if (!balSnap.exists) {
        throw new DealerRequestError('BALANCE_NOT_FOUND', 'Document de soldes introuvable pour cette boutique.')
      }
      const previousBalance = readSupplyBalance(balSnap.data(), network, resource)
      const delta = nextAmount - currentAmount
      // Lève INSUFFICIENT_BALANCE_FOR_REVERSAL si la baisse dépasse ce que porte
      // la carte : l'argent a déjà été dépensé, on ne le rabote pas à zéro.
      const newBalance = applySupplyDelta(previousBalance, delta)
      const now = FieldValue.serverTimestamp()

      t.set(balRef, {
        balances: { [network]: { [resource]: newBalance } },
        updatedAt: now,
      }, { merge: true })

      t.update(supplyRef, {
        amount: nextAmount,
        updatedAt: now,
        correctionCount: FieldValue.increment(1),
        correctedAt: now,
        correctedByUid: actorUid,
        correctedByName: txProfile.name ?? null,
        correctionReason: reason,
      })

      const auditRef = db.collection(`clients/${storeId}/auditLogs`).doc()
      t.set(auditRef, {
        action: 'STORE_SUPPLY_CORRECTED',
        actorUid,
        actorEmail: txProfile.email ?? null,
        actorName: txProfile.name ?? null,
        actorRole: 'store_admin',
        actorStoreId: storeId,
        supplyId,
        network,
        resource,
        fromAmount: currentAmount,
        toAmount: nextAmount,
        delta,
        reason,
        previousBalance,
        newBalance,
        createdAt: now,
      })

      return { previousAmount: currentAmount, amount: nextAmount, previousBalance, newBalance }
    })
  } catch (err) {
    if (err instanceof DealerRequestError) throw err
    throw new DealerRequestError('TRANSACTION_FAILED', "L'opération n'a pas pu être finalisée. Veuillez réessayer.")
  }

  return { success: true, supplyId, ...result }
}
