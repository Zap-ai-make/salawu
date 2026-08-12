/**
 * Handler — déclaration d'une COMPENSATION par la boutique DÉBITRICE de D1.
 *
 * Compense la dette D1 (A→B) contre la dette opposée D2 (B→A) de la même paire de
 * boutiques (tous réseaux). Crée une tranche `declared` sous `internalDebts/{D1}/
 * settlements` avec method:'compensation' et oppositeDebtId:D2 (idempotente via clé
 * stable). NE MODIFIE PAS encore les dettes : l'imputation sur LES DEUX dettes a lieu
 * à la confirmation par la créancière. Aucun mouvement de float (comme un règlement).
 *
 * db et FieldValue injectés (testabilité émulateur).
 */

import { DealerRequestError } from '../errors.js'
import { validateAuthUid, validateInputPayload, validateProfileData } from '../dealerRequests/shared.js'
import {
  validateDebtId,
  validateSettlementAmount,
  validateIdempotencyKey,
  validateOppositeDebtPair,
  sumDeclaredAmounts,
  deterministicCompensationId,
} from './debtShared.js'

export async function declareInternalDebtCompensationHandler(request, { db, FieldValue }) {
  const actorUid = validateAuthUid(request.auth?.uid)
  const payload = validateInputPayload(request.data, ['debtId', 'oppositeDebtId', 'amount', 'idempotencyKey'])
  const debtId = validateDebtId(payload.debtId)
  const oppositeDebtId = validateDebtId(payload.oppositeDebtId)
  const amount = validateSettlementAmount(payload.amount)
  const idempotencyKey = validateIdempotencyKey(payload.idempotencyKey)

  if (oppositeDebtId === debtId) {
    throw new DealerRequestError('INVALID_OPPOSITE_DEBT', 'La dette opposée doit être différente de la dette à compenser.')
  }
  const settlementId = deterministicCompensationId(debtId, actorUid, idempotencyKey)

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

      const oppRef = db.doc(`internalDebts/${oppositeDebtId}`)
      const oppSnap = await t.get(oppRef)
      if (!oppSnap.exists) {
        throw new DealerRequestError('DEBT_NOT_FOUND', 'Dette opposée introuvable.')
      }
      const opp = oppSnap.data()

      // Seule la boutique DÉBITRICE de D1 initie la compensation.
      if (debt.debtorStoreId !== actorStoreId) {
        throw new DealerRequestError('DEBT_STORE_MISMATCH', 'Seule la boutique débitrice peut initier une compensation.')
      }
      // D2 doit être la dette opposée de la même paire (tous réseaux).
      validateOppositeDebtPair(debt, opp)

      // Idempotence D'ABORD : un retry de la MÊME compensation court-circuite avant le
      // calcul des restes dus (sinon la tranche déjà écrite se compterait elle-même).
      const settlementRef = db.doc(`internalDebts/${debtId}/settlements/${settlementId}`)
      const existing = await t.get(settlementRef)
      if (existing.exists) {
        const prev = existing.data()
        // Même clé + même payload → no-op idempotent ; sinon conflit.
        if (prev.method === 'compensation' && prev.amount === amount && prev.oppositeDebtId === oppositeDebtId) {
          return { settlementId, idempotent: true }
        }
        throw new DealerRequestError('IDEMPOTENCY_CONFLICT', 'Une compensation différente existe déjà pour cette clé.')
      }

      if (debt.status === 'settled' || opp.status === 'settled' ||
          (Number(debt.remainingAmount) || 0) <= 0 || (Number(opp.remainingAmount) || 0) <= 0) {
        throw new DealerRequestError('DEBT_ALREADY_SETTLED', 'Une des deux dettes est déjà réglée.')
      }

      // Les tranches DÉJÀ déclarées de CHAQUE dette réservent du reste dû : la compensation
      // ne peut pas dépasser min(reste D1 − en attente D1, reste D2 − en attente D2). Deux
      // requêtes à égalité (index automatique), lues dans la transaction AVANT tout write.
      const [declaredD1, declaredD2] = await Promise.all([
        t.get(db.collection(`internalDebts/${debtId}/settlements`).where('settlementStatus', '==', 'declared')),
        t.get(db.collection(`internalDebts/${oppositeDebtId}/settlements`).where('settlementStatus', '==', 'declared')),
      ])
      const capacity = Math.min(
        debt.remainingAmount - sumDeclaredAmounts(declaredD1.docs),
        opp.remainingAmount - sumDeclaredAmounts(declaredD2.docs),
      )
      if (amount > capacity) {
        throw new DealerRequestError('COMPENSATION_EXCEEDS_REMAINING', 'Le montant dépasse ce qui est compensable.')
      }

      const now = FieldValue.serverTimestamp()
      t.set(settlementRef, {
        debtId,
        oppositeDebtId,
        debtorStoreId: debt.debtorStoreId,
        creditorStoreId: debt.creditorStoreId,
        amount,
        method: 'compensation',
        settlementStatus: 'declared',
        idempotencyKey,
        previousRemaining: debt.remainingAmount,
        newRemaining: null,
        declaredBy: actorUid,
        declaredAt: now,
        confirmedBy: null,
        confirmedAt: null,
        rejectedBy: null,
        rejectedAt: null,
        rejectionReason: null,
      })

      const auditRef = db.collection(`clients/${actorStoreId}/auditLogs`).doc()
      t.set(auditRef, {
        action: 'INTERNAL_DEBT_COMPENSATION_DECLARED',
        actorUid,
        actorEmail: txProfile.email ?? null,
        actorName: txProfile.name ?? null,
        actorRole: 'store_admin',
        actorStoreId,
        debtId,
        oppositeDebtId,
        settlementId,
        amount,
        createdAt: now,
      })

      return { settlementId, idempotent: false }
    })
  } catch (err) {
    if (err instanceof DealerRequestError) throw err
    throw new DealerRequestError('TRANSACTION_FAILED', 'La transaction a échoué. Veuillez réessayer.')
  }

  return { success: true, ...result }
}
