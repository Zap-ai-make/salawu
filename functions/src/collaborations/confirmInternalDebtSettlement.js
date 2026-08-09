/**
 * Handler — confirmation d'une tranche de règlement par la boutique CRÉANCIÈRE.
 *
 * Impute la tranche sur la dette : remainingAmount −= amount, settledAmount += amount,
 * status → partially_settled | settled. Aucun mouvement de solde (méthode traçable).
 *
 * db et FieldValue injectés (testabilité émulateur).
 */

import { DealerRequestError } from '../errors.js'
import { validateAuthUid, validateInputPayload, validateProfileData } from '../dealerRequests/shared.js'
import { validateDebtId, validateSettlementId } from './debtShared.js'

export async function confirmInternalDebtSettlementHandler(request, { db, FieldValue }) {
  const actorUid = validateAuthUid(request.auth?.uid)
  const payload = validateInputPayload(request.data, ['debtId', 'settlementId'])
  const debtId = validateDebtId(payload.debtId)
  const settlementId = validateSettlementId(payload.settlementId)

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

      const debtRef = db.doc(`internalDebts/${debtId}`)
      const debtSnap = await t.get(debtRef)
      if (!debtSnap.exists) {
        throw new DealerRequestError('DEBT_NOT_FOUND', 'Dette introuvable.')
      }
      const debt = debtSnap.data()

      // Seule la boutique CRÉANCIÈRE confirme un règlement.
      if (debt.creditorStoreId !== actorStoreId) {
        throw new DealerRequestError('DEBT_STORE_MISMATCH', 'Seule la boutique créancière peut confirmer un règlement.')
      }

      const settlementRef = db.doc(`internalDebts/${debtId}/settlements/${settlementId}`)
      const settlementSnap = await t.get(settlementRef)
      if (!settlementSnap.exists) {
        throw new DealerRequestError('SETTLEMENT_NOT_FOUND', 'Règlement introuvable.')
      }
      const settlement = settlementSnap.data()
      if (settlement.settlementStatus !== 'declared') {
        throw new DealerRequestError('SETTLEMENT_NOT_DECLARED', 'Ce règlement n\'est pas en attente de confirmation.')
      }

      const amount = settlement.amount
      if (!Number.isSafeInteger(amount) || amount <= 0) {
        throw new DealerRequestError('INVALID_SETTLEMENT_AMOUNT', 'Montant de règlement invalide.')
      }
      const previousRemaining = debt.remainingAmount
      const newRemaining = previousRemaining - amount
      if (newRemaining < 0) {
        throw new DealerRequestError('SETTLEMENT_EXCEEDS_REMAINING', 'Le montant dépasse le reste dû.')
      }
      const newSettled = debt.settledAmount + amount
      const status = newRemaining === 0 ? 'settled' : 'partially_settled'
      const now = FieldValue.serverTimestamp()

      t.update(debtRef, {
        settledAmount: newSettled,
        remainingAmount: newRemaining,
        status,
        updatedAt: now,
      })

      t.update(settlementRef, {
        settlementStatus: 'confirmed',
        confirmedBy: actorUid,
        confirmedAt: now,
        previousRemaining,
        newRemaining,
      })

      const auditRef = db.collection(`clients/${actorStoreId}/auditLogs`).doc()
      t.set(auditRef, {
        action: 'INTERNAL_DEBT_SETTLEMENT_CONFIRMED',
        actorUid,
        actorEmail: txProfile.email ?? null,
        actorName: txProfile.name ?? null,
        actorRole: 'store_admin',
        actorStoreId,
        debtId,
        settlementId,
        amount,
        previousRemaining,
        newRemaining,
        debtStatus: status,
        createdAt: now,
      })

      return { debtStatus: status, remainingAmount: newRemaining, settledAmount: newSettled }
    })
  } catch (err) {
    if (err instanceof DealerRequestError) throw err
    throw new DealerRequestError('TRANSACTION_FAILED', 'La transaction a échoué. Veuillez réessayer.')
  }

  return { success: true, debtId, settlementId, ...result }
}
