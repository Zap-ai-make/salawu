/**
 * Handler — confirmation d'une COMPENSATION par la boutique CRÉANCIÈRE de D1.
 *
 * Impute le montant sur LES DEUX dettes atomiquement (une seule runTransaction) :
 *   • D1 (A→B, la créancière confirme)  : remaining −= amount, settled += amount.
 *   • D2 (B→A, opposée)                 : remaining −= amount, settled += amount.
 * Recalcule chaque statut (settled si 0, sinon partially_settled). Écrit une tranche
 * MIROIR confirmée sous D2/settlements (traçabilité côté dette opposée) et un audit
 * sur LES DEUX boutiques. Re-valide la paire opposée et le plafond au moment présent
 * (anti-dérive depuis la déclaration). Aucun mouvement de float.
 *
 * db et FieldValue injectés (testabilité émulateur).
 */

import { DealerRequestError } from '../errors.js'
import { validateAuthUid, validateInputPayload, validateProfileData } from '../dealerRequests/shared.js'
import { validateDebtId, validateSettlementId, validateOppositeDebtPair, compensableAmount, deterministicMirrorId } from './debtShared.js'

const nextStatus = (remaining) => (remaining === 0 ? 'settled' : 'partially_settled')

export async function confirmInternalDebtCompensationHandler(request, { db, FieldValue }) {
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

      // Seule la boutique CRÉANCIÈRE de D1 confirme une compensation.
      if (debt.creditorStoreId !== actorStoreId) {
        throw new DealerRequestError('DEBT_STORE_MISMATCH', 'Seule la boutique créancière peut confirmer une compensation.')
      }

      const settlementRef = db.doc(`internalDebts/${debtId}/settlements/${settlementId}`)
      const settlementSnap = await t.get(settlementRef)
      if (!settlementSnap.exists) {
        throw new DealerRequestError('SETTLEMENT_NOT_FOUND', 'Compensation introuvable.')
      }
      const settlement = settlementSnap.data()
      if (settlement.method !== 'compensation') {
        throw new DealerRequestError('SETTLEMENT_NOT_FOUND', "Cette tranche n'est pas une compensation.")
      }
      if (settlement.settlementStatus !== 'declared') {
        throw new DealerRequestError('SETTLEMENT_NOT_DECLARED', "Cette compensation n'est pas en attente de confirmation.")
      }

      const oppositeDebtId = validateDebtId(settlement.oppositeDebtId)
      const oppRef = db.doc(`internalDebts/${oppositeDebtId}`)
      const oppSnap = await t.get(oppRef)
      if (!oppSnap.exists) {
        throw new DealerRequestError('DEBT_NOT_FOUND', 'Dette opposée introuvable.')
      }
      const opp = oppSnap.data()

      // Re-valide la paire opposée et le plafond MAINTENANT (garde-fou anti-dérive).
      validateOppositeDebtPair(debt, opp)
      const amount = settlement.amount
      if (!Number.isSafeInteger(amount) || amount <= 0) {
        throw new DealerRequestError('INVALID_SETTLEMENT_AMOUNT', 'Montant de compensation invalide.')
      }
      if (amount > compensableAmount(debt, opp)) {
        throw new DealerRequestError('COMPENSATION_EXCEEDS_REMAINING', 'Le montant dépasse ce qui est compensable.')
      }

      const now = FieldValue.serverTimestamp()

      const debtRemaining = debt.remainingAmount - amount
      const debtSettled = debt.settledAmount + amount
      const debtStatus = nextStatus(debtRemaining)
      const oppRemaining = opp.remainingAmount - amount
      const oppSettled = opp.settledAmount + amount
      const oppStatus = nextStatus(oppRemaining)

      // Imputation sur les deux dettes.
      t.update(debtRef, { remainingAmount: debtRemaining, settledAmount: debtSettled, status: debtStatus, updatedAt: now })
      t.update(oppRef, { remainingAmount: oppRemaining, settledAmount: oppSettled, status: oppStatus, updatedAt: now })

      // Tranche D1 confirmée.
      t.update(settlementRef, {
        settlementStatus: 'confirmed',
        confirmedBy: actorUid,
        confirmedAt: now,
        previousRemaining: debt.remainingAmount,
        newRemaining: debtRemaining,
      })

      // Tranche miroir confirmée sous D2 (traçabilité côté dette opposée).
      // La déclaration réelle a été faite par le débiteur de D1 (settlement.declaredBy/At) :
      // on la reporte fidèlement sur le miroir, et on n'attribue que la confirmation à l'acteur.
      const mirrorRef = db.doc(`internalDebts/${oppositeDebtId}/settlements/${deterministicMirrorId(debtId, settlementId)}`)
      t.set(mirrorRef, {
        debtId: oppositeDebtId,
        oppositeDebtId: debtId,
        debtorStoreId: opp.debtorStoreId,
        creditorStoreId: opp.creditorStoreId,
        amount,
        method: 'compensation',
        settlementStatus: 'confirmed',
        mirrorOf: settlementId,
        previousRemaining: opp.remainingAmount,
        newRemaining: oppRemaining,
        declaredBy: settlement.declaredBy ?? null,
        declaredAt: settlement.declaredAt ?? now,
        confirmedBy: actorUid,
        confirmedAt: now,
        rejectedBy: null,
        rejectedAt: null,
        rejectionReason: null,
      })

      // Audit sur les DEUX boutiques (chacune voit la compensation dans son journal).
      for (const auditStoreId of [debt.creditorStoreId, debt.debtorStoreId]) {
        const auditRef = db.collection(`clients/${auditStoreId}/auditLogs`).doc()
        t.set(auditRef, {
          action: 'INTERNAL_DEBT_COMPENSATION_CONFIRMED',
          actorUid,
          actorEmail: txProfile.email ?? null,
          actorName: txProfile.name ?? null,
          actorRole: 'store_admin',
          actorStoreId,
          debtId,
          oppositeDebtId,
          settlementId,
          amount,
          debtStatus,
          oppositeDebtStatus: oppStatus,
          createdAt: now,
        })
      }

      return {
        debtStatus,
        remainingAmount: debtRemaining,
        oppositeDebtStatus: oppStatus,
        oppositeRemainingAmount: oppRemaining,
        amount,
      }
    })
  } catch (err) {
    if (err instanceof DealerRequestError) throw err
    throw new DealerRequestError('TRANSACTION_FAILED', 'La transaction a échoué. Veuillez réessayer.')
  }

  return { success: true, debtId, settlementId, ...result }
}
