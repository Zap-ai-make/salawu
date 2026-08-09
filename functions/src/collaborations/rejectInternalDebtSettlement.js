/**
 * Handler — rejet d'une tranche de règlement par la boutique CRÉANCIÈRE.
 *
 * La tranche `declared → rejected` (motif obligatoire). La dette n'est PAS
 * modifiée. Aucun mouvement de solde.
 *
 * db et FieldValue injectés (testabilité émulateur).
 */

import { DealerRequestError } from '../errors.js'
import { validateAuthUid, validateInputPayload, validateProfileData, validateRejectionReason } from '../dealerRequests/shared.js'
import { validateDebtId, validateSettlementId } from './debtShared.js'

export async function rejectInternalDebtSettlementHandler(request, { db, FieldValue }) {
  const actorUid = validateAuthUid(request.auth?.uid)
  const payload = validateInputPayload(request.data, ['debtId', 'settlementId', 'rejectionReason'])
  const debtId = validateDebtId(payload.debtId)
  const settlementId = validateSettlementId(payload.settlementId)
  const rejectionReason = validateRejectionReason(payload.rejectionReason)

  const profileSnap = await db.doc(`users/${actorUid}`).get()
  if (!profileSnap.exists) {
    throw new DealerRequestError('PROFILE_NOT_FOUND', 'Profil utilisateur introuvable.')
  }
  validateProfileData(profileSnap.data())

  try {
    await db.runTransaction(async (t) => {
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
      if (debt.creditorStoreId !== actorStoreId) {
        throw new DealerRequestError('DEBT_STORE_MISMATCH', 'Seule la boutique créancière peut rejeter un règlement.')
      }

      const settlementRef = db.doc(`internalDebts/${debtId}/settlements/${settlementId}`)
      const settlementSnap = await t.get(settlementRef)
      if (!settlementSnap.exists) {
        throw new DealerRequestError('SETTLEMENT_NOT_FOUND', 'Règlement introuvable.')
      }
      if (settlementSnap.data().settlementStatus !== 'declared') {
        throw new DealerRequestError('SETTLEMENT_NOT_DECLARED', 'Ce règlement n\'est pas en attente de confirmation.')
      }

      const now = FieldValue.serverTimestamp()
      t.update(settlementRef, {
        settlementStatus: 'rejected',
        rejectedBy: actorUid,
        rejectedAt: now,
        rejectionReason,
      })

      const auditRef = db.collection(`clients/${actorStoreId}/auditLogs`).doc()
      t.set(auditRef, {
        action: 'INTERNAL_DEBT_SETTLEMENT_REJECTED',
        actorUid,
        actorEmail: txProfile.email ?? null,
        actorName: txProfile.name ?? null,
        actorRole: 'store_admin',
        actorStoreId,
        debtId,
        settlementId,
        rejectionReason,
        createdAt: now,
      })
    })
  } catch (err) {
    if (err instanceof DealerRequestError) throw err
    throw new DealerRequestError('TRANSACTION_FAILED', 'La transaction a échoué. Veuillez réessayer.')
  }

  return { success: true, debtId, settlementId }
}
