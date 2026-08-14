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
import { readDealerBalanceAmount } from '../storeTransfers/shared.js'
import { mapPaymentMethodToNetwork } from '../settlements/financialUtils.js'

// Un remboursement par méthode Mobile Money transfère du STOCK entre les deux boutiques
// (débitrice −, créancière +) sur le réseau de la méthode. Cash/Banque (et compensation)
// restent traçables sans mouvement de solde. Ces 6 réseaux = les méthodes MM.
const MM_NETWORKS = new Set(['Orange', 'Moov', 'Telecel', 'Coris', 'Sank', 'Wave'])

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

      // Mouvement de solde réseau (méthodes MM uniquement) : transfert de stock du réseau de
      // la méthode, boutique débitrice (payeuse, −) → créancière (receveuse, +). Lectures des
      // deux soldes AVANT tout write (contrainte transaction Firestore). Cash/Banque : aucun
      // mouvement (la dette est quand même imputée ci-dessous).
      const net = mapPaymentMethodToNetwork(settlement.method)
      const movesStock = MM_NETWORKS.has(net)
      let payerBalRef = null, receiverBalRef = null
      let payerPrev = 0, receiverPrev = 0, payerNext = 0, receiverNext = 0
      if (movesStock) {
        payerBalRef = db.doc(`clients/${debt.debtorStoreId}/networkBalances/current`)
        receiverBalRef = db.doc(`clients/${debt.creditorStoreId}/networkBalances/current`)
        const [payerBalSnap, receiverBalSnap] = await Promise.all([t.get(payerBalRef), t.get(receiverBalRef)])
        payerPrev = readDealerBalanceAmount(payerBalSnap.exists ? payerBalSnap.data() : null, 'stock', net)
        receiverPrev = readDealerBalanceAmount(receiverBalSnap.exists ? receiverBalSnap.data() : null, 'stock', net)
        if (payerPrev < amount) {
          throw new DealerRequestError('SETTLEMENT_INSUFFICIENT_BALANCE', `Solde ${net} insuffisant chez la boutique débitrice pour ce remboursement.`)
        }
        payerNext = payerPrev - amount
        receiverNext = receiverPrev + amount
        if (!Number.isSafeInteger(receiverNext) || payerNext < 0 || receiverNext < 0) {
          throw new DealerRequestError('BALANCE_OVERFLOW', 'Le solde résultant est invalide.')
        }
      }

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

      // Écritures de solde + audit sur LES DEUX boutiques (piste d'audit financière).
      if (movesStock) {
        t.set(payerBalRef, { balances: { [net]: { stock: payerNext } }, updatedAt: now }, { merge: true })
        t.set(receiverBalRef, { balances: { [net]: { stock: receiverNext } }, updatedAt: now }, { merge: true })
        const moves = [
          { storeId: debt.debtorStoreId, direction: 'DEBITED', previousBalance: payerPrev, newBalance: payerNext },
          { storeId: debt.creditorStoreId, direction: 'CREDITED', previousBalance: receiverPrev, newBalance: receiverNext },
        ]
        for (const m of moves) {
          const balAuditRef = db.collection(`clients/${m.storeId}/auditLogs`).doc()
          t.set(balAuditRef, {
            action: 'INTERNAL_DEBT_SETTLEMENT_BALANCE_MOVED',
            actorUid,
            actorEmail: txProfile.email ?? null,
            actorName: txProfile.name ?? null,
            actorRole: 'store_admin',
            actorStoreId,
            storeId: m.storeId,
            debtId,
            settlementId,
            amount,
            method: settlement.method,
            network: net,
            direction: m.direction,
            previousBalance: m.previousBalance,
            newBalance: m.newBalance,
            createdAt: now,
          })
        }
      }

      return { debtStatus: status, remainingAmount: newRemaining, settledAmount: newSettled, balanceMoved: movesStock, network: movesStock ? net : null }
    })
  } catch (err) {
    if (err instanceof DealerRequestError) throw err
    throw new DealerRequestError('TRANSACTION_FAILED', 'La transaction a échoué. Veuillez réessayer.')
  }

  return { success: true, debtId, settlementId, ...result }
}
