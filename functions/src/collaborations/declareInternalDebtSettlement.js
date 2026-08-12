/**
 * Handler — déclaration d'une tranche de règlement par la boutique DÉBITRICE.
 *
 * Crée une tranche `declared` (idempotente via clé stable). NE MODIFIE PAS encore
 * la dette (remainingAmount inchangé) : l'imputation a lieu à la confirmation par
 * la créancière. Aucun mouvement de solde (méthode traçable).
 *
 * db et FieldValue injectés (testabilité émulateur).
 */

import { DealerRequestError } from '../errors.js'
import { validateAuthUid, validateInputPayload, validateProfileData } from '../dealerRequests/shared.js'
import {
  validateDebtId,
  validateSettlementAmount,
  validateSettlementMethod,
  validateIdempotencyKey,
  deterministicSettlementId,
  sumDeclaredAmounts,
} from './debtShared.js'

export async function declareInternalDebtSettlementHandler(request, { db, FieldValue }) {
  const actorUid = validateAuthUid(request.auth?.uid)
  const payload = validateInputPayload(request.data, ['debtId', 'amount', 'method', 'idempotencyKey'])
  const debtId = validateDebtId(payload.debtId)
  const amount = validateSettlementAmount(payload.amount)
  const method = validateSettlementMethod(payload.method)
  const idempotencyKey = validateIdempotencyKey(payload.idempotencyKey)
  const settlementId = deterministicSettlementId(debtId, actorUid, idempotencyKey)

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

      // Seule la boutique DÉBITRICE déclare un règlement.
      if (debt.debtorStoreId !== actorStoreId) {
        throw new DealerRequestError('DEBT_STORE_MISMATCH', 'Seule la boutique débitrice peut déclarer un règlement.')
      }

      // Idempotence D'ABORD : un retry de la MÊME déclaration doit court-circuiter avant
      // le calcul du reste dû (sinon la tranche déjà écrite se compterait elle-même).
      const settlementRef = db.doc(`internalDebts/${debtId}/settlements/${settlementId}`)
      const existing = await t.get(settlementRef)
      if (existing.exists) {
        const prev = existing.data()
        // Même clé + même payload → no-op idempotent ; payload différent → conflit.
        if (prev.amount === amount && prev.method === method) {
          return { settlementId, idempotent: true }
        }
        throw new DealerRequestError('IDEMPOTENCY_CONFLICT', 'Une tranche différente existe déjà pour cette clé.')
      }

      if (debt.status === 'settled' || (Number(debt.remainingAmount) || 0) <= 0) {
        throw new DealerRequestError('DEBT_ALREADY_SETTLED', 'Cette dette est déjà réglée.')
      }

      // Les tranches DÉJÀ déclarées (non confirmées) réservent du reste dû : la somme des
      // déclarations en attente + cette tranche ne peut pas dépasser le reste dû. Requête
      // à égalité sur un seul champ (index automatique), lue dans la transaction AVANT tout
      // write. La tranche courante n'existe pas encore → pas d'auto-comptage.
      const declaredSnap = await t.get(
        db.collection(`internalDebts/${debtId}/settlements`).where('settlementStatus', '==', 'declared'),
      )
      const pending = sumDeclaredAmounts(declaredSnap.docs)
      if (amount > debt.remainingAmount - pending) {
        throw new DealerRequestError('SETTLEMENT_EXCEEDS_REMAINING', 'Le montant dépasse le reste dû.')
      }

      const now = FieldValue.serverTimestamp()
      t.set(settlementRef, {
        debtId,
        debtorStoreId: debt.debtorStoreId,
        creditorStoreId: debt.creditorStoreId,
        amount,
        method,
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
        action: 'INTERNAL_DEBT_SETTLEMENT_DECLARED',
        actorUid,
        actorEmail: txProfile.email ?? null,
        actorName: txProfile.name ?? null,
        actorRole: 'store_admin',
        actorStoreId,
        debtId,
        settlementId,
        amount,
        method,
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
