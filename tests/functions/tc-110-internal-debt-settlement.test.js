/**
 * TC-110 — Règlement des dettes internes (declare/confirm/reject).
 *   Handlers integration Firestore Emulator, { db, FieldValue } injectés.
 *
 * Comportement protégé :
 *   - declare (débitrice) : tranche declared, dette inchangée ; idempotence (no-op vs conflit) ;
 *   - confirm (créancière) : impute (remaining/settled/status), partiel puis settled ;
 *   - reject (créancière) : tranche rejected, dette inchangée ;
 *   - gardes de rôle (débitrice vs créancière), dépassement du reste dû.
 *
 * Exécution : npm run test:functions (émulateur, projet demo-akayis-test).
 */

import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest'
import { initializeApp, getApps, deleteApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { declareInternalDebtSettlementHandler } from '../../functions/src/collaborations/declareInternalDebtSettlement.js'
import { confirmInternalDebtSettlementHandler } from '../../functions/src/collaborations/confirmInternalDebtSettlement.js'
import { rejectInternalDebtSettlementHandler } from '../../functions/src/collaborations/rejectInternalDebtSettlement.js'

let adminApp
let db

const PROJECT_ID = process.env.GCLOUD_PROJECT
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST

beforeAll(() => {
  if (!FIRESTORE_HOST) throw new Error('SÉCURITÉ : FIRESTORE_EMULATOR_HOST non défini. Lancer via : npm run test:functions')
  if (!PROJECT_ID) throw new Error('SÉCURITÉ : GCLOUD_PROJECT non défini. Lancer via : npm run test:functions')
  if (PROJECT_ID !== 'demo-akayis-test') throw new Error(`SÉCURITÉ : projectId doit être "demo-akayis-test". Reçu : "${PROJECT_ID}"`)
  adminApp = getApps().length === 0 ? initializeApp({ projectId: PROJECT_ID }) : getApps()[0]
  db = getFirestore(adminApp)
})

afterAll(async () => { if (adminApp) await deleteApp(adminApp) })

async function clearFirestoreEmulator() {
  const url = `http://${FIRESTORE_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`
  const res = await fetch(url, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Impossible de vider l'émulateur : HTTP ${res.status}`)
}
beforeEach(async () => { await clearFirestoreEmulator() })

const DEBTOR = 'admin-a-uid'  // store-A débitrice
const CREDITOR = 'admin-b-uid' // store-B créancière
const req = (uid, data) => ({ auth: uid ? { uid, token: {} } : null, data: data ?? {} })
async function expectError(promise, code) { await expect(promise).rejects.toMatchObject({ code }) }

async function seedDebt(remaining = 20000, over = {}) {
  await db.doc('users/admin-a-uid').set({ role: 'store_admin', active: true, storeId: 'store-A', storeName: 'A', email: 'a@t.test', name: 'A' })
  await db.doc('users/admin-b-uid').set({ role: 'store_admin', active: true, storeId: 'store-B', storeName: 'B', email: 'b@t.test', name: 'B' })
  await db.doc('internalDebts/debt-1').set({
    collaborationId: 'col-1', debtorStoreId: 'store-A', debtorStoreName: 'A',
    creditorStoreId: 'store-B', creditorStoreName: 'B', network: 'Orange', operationType: 'deposit',
    originalAmount: remaining, settledAmount: 0, remainingAmount: remaining, status: 'open', ...over,
  })
}
const debt = async () => (await db.doc('internalDebts/debt-1').get()).data()
const settlement = async (id) => (await db.doc(`internalDebts/debt-1/settlements/${id}`).get()).data()
const stockOf = async (storeId, net) => (await db.doc(`clients/${storeId}/networkBalances/current`).get()).data()?.balances?.[net]?.stock ?? 0
const seedStock = (storeId, net, stock) => db.doc(`clients/${storeId}/networkBalances/current`).set({ balances: { [net]: { stock } } })
const auditCount = async (storeId, action) => (await db.collection(`clients/${storeId}/auditLogs`).where('action', '==', action).get()).size

describe('TC-110 — declare', () => {
  it('[DS-01] déclare une tranche : declared, dette inchangée', async () => {
    await seedDebt()
    const res = await declareInternalDebtSettlementHandler(req(DEBTOR, { debtId: 'debt-1', amount: 5000, method: 'Cash', idempotencyKey: 'k1' }), { db, FieldValue })
    expect(res).toMatchObject({ success: true, idempotent: false })
    expect((await settlement(res.settlementId)).settlementStatus).toBe('declared')
    expect((await debt()).remainingAmount).toBe(20000) // inchangée avant confirmation
  })

  it('[DS-02] idempotence : même clé + même payload → no-op', async () => {
    await seedDebt()
    const p = { debtId: 'debt-1', amount: 5000, method: 'Cash', idempotencyKey: 'k1' }
    const r1 = await declareInternalDebtSettlementHandler(req(DEBTOR, p), { db, FieldValue })
    const r2 = await declareInternalDebtSettlementHandler(req(DEBTOR, p), { db, FieldValue })
    expect(r2.idempotent).toBe(true)
    expect(r2.settlementId).toBe(r1.settlementId)
    expect((await db.collection('internalDebts/debt-1/settlements').get()).size).toBe(1)
  })

  it('[DS-03] même clé + payload différent → IDEMPOTENCY_CONFLICT', async () => {
    await seedDebt()
    await declareInternalDebtSettlementHandler(req(DEBTOR, { debtId: 'debt-1', amount: 5000, method: 'Cash', idempotencyKey: 'k1' }), { db, FieldValue })
    await expectError(declareInternalDebtSettlementHandler(req(DEBTOR, { debtId: 'debt-1', amount: 9000, method: 'Cash', idempotencyKey: 'k1' }), { db, FieldValue }), 'IDEMPOTENCY_CONFLICT')
  })

  it('[DS-04] créancière déclare → DEBT_STORE_MISMATCH', async () => {
    await seedDebt()
    await expectError(declareInternalDebtSettlementHandler(req(CREDITOR, { debtId: 'debt-1', amount: 5000, method: 'Cash', idempotencyKey: 'k1' }), { db, FieldValue }), 'DEBT_STORE_MISMATCH')
  })

  it('[DS-05] montant > reste dû → SETTLEMENT_EXCEEDS_REMAINING', async () => {
    await seedDebt()
    await expectError(declareInternalDebtSettlementHandler(req(DEBTOR, { debtId: 'debt-1', amount: 25000, method: 'Cash', idempotencyKey: 'k1' }), { db, FieldValue }), 'SETTLEMENT_EXCEEDS_REMAINING')
  })
})

describe('TC-110 — confirm', () => {
  it('[DS-06] partiel puis solde : status et remaining corrects', async () => {
    await seedDebt(20000)
    const d1 = await declareInternalDebtSettlementHandler(req(DEBTOR, { debtId: 'debt-1', amount: 5000, method: 'Cash', idempotencyKey: 'k1' }), { db, FieldValue })
    const c1 = await confirmInternalDebtSettlementHandler(req(CREDITOR, { debtId: 'debt-1', settlementId: d1.settlementId }), { db, FieldValue })
    expect(c1).toMatchObject({ debtStatus: 'partially_settled', remainingAmount: 15000, settledAmount: 5000 })
    expect((await settlement(d1.settlementId)).settlementStatus).toBe('confirmed')

    const d2 = await declareInternalDebtSettlementHandler(req(DEBTOR, { debtId: 'debt-1', amount: 15000, method: 'Banque', idempotencyKey: 'k2' }), { db, FieldValue })
    const c2 = await confirmInternalDebtSettlementHandler(req(CREDITOR, { debtId: 'debt-1', settlementId: d2.settlementId }), { db, FieldValue })
    expect(c2).toMatchObject({ debtStatus: 'settled', remainingAmount: 0 })
  })

  it('[DS-07] débitrice confirme → DEBT_STORE_MISMATCH', async () => {
    await seedDebt()
    const d1 = await declareInternalDebtSettlementHandler(req(DEBTOR, { debtId: 'debt-1', amount: 5000, method: 'Cash', idempotencyKey: 'k1' }), { db, FieldValue })
    await expectError(confirmInternalDebtSettlementHandler(req(DEBTOR, { debtId: 'debt-1', settlementId: d1.settlementId }), { db, FieldValue }), 'DEBT_STORE_MISMATCH')
  })

  it('[DS-08] confirmer 2 fois → SETTLEMENT_NOT_DECLARED', async () => {
    await seedDebt()
    const d1 = await declareInternalDebtSettlementHandler(req(DEBTOR, { debtId: 'debt-1', amount: 5000, method: 'Cash', idempotencyKey: 'k1' }), { db, FieldValue })
    await confirmInternalDebtSettlementHandler(req(CREDITOR, { debtId: 'debt-1', settlementId: d1.settlementId }), { db, FieldValue })
    await expectError(confirmInternalDebtSettlementHandler(req(CREDITOR, { debtId: 'debt-1', settlementId: d1.settlementId }), { db, FieldValue }), 'SETTLEMENT_NOT_DECLARED')
  })
})

describe('TC-110 — mouvement de solde réseau (remboursement MM)', () => {
  it('[BAL-01] remboursement Orange Money : stock débitrice −, créancière +, dette imputée, 2 audits', async () => {
    await seedDebt(20000)
    await seedStock('store-A', 'Orange', 50000) // débitrice = payeuse
    await seedStock('store-B', 'Orange', 10000) // créancière = receveuse
    const d = await declareInternalDebtSettlementHandler(req(DEBTOR, { debtId: 'debt-1', amount: 5000, method: 'Orange Money', idempotencyKey: 'k1' }), { db, FieldValue })
    const c = await confirmInternalDebtSettlementHandler(req(CREDITOR, { debtId: 'debt-1', settlementId: d.settlementId }), { db, FieldValue })

    expect(c).toMatchObject({ balanceMoved: true, network: 'Orange', remainingAmount: 15000 })
    expect(await stockOf('store-A', 'Orange')).toBe(45000)
    expect(await stockOf('store-B', 'Orange')).toBe(15000)
    expect(await auditCount('store-A', 'INTERNAL_DEBT_SETTLEMENT_BALANCE_MOVED')).toBe(1)
    expect(await auditCount('store-B', 'INTERNAL_DEBT_SETTLEMENT_BALANCE_MOVED')).toBe(1)
  })

  it('[BAL-02] stock débitrice insuffisant → SETTLEMENT_INSUFFICIENT_BALANCE, rien ne bouge', async () => {
    await seedDebt(20000)
    await seedStock('store-A', 'Orange', 3000) // < 5000
    await seedStock('store-B', 'Orange', 10000)
    const d = await declareInternalDebtSettlementHandler(req(DEBTOR, { debtId: 'debt-1', amount: 5000, method: 'Orange Money', idempotencyKey: 'k1' }), { db, FieldValue })
    await expectError(confirmInternalDebtSettlementHandler(req(CREDITOR, { debtId: 'debt-1', settlementId: d.settlementId }), { db, FieldValue }), 'SETTLEMENT_INSUFFICIENT_BALANCE')
    // Aucune imputation ni mouvement (transaction annulée).
    expect((await debt()).remainingAmount).toBe(20000)
    expect(await stockOf('store-A', 'Orange')).toBe(3000)
    expect(await stockOf('store-B', 'Orange')).toBe(10000)
    expect((await settlement(d.settlementId)).settlementStatus).toBe('declared')
  })

  it('[BAL-03] méthode Cash/Banque : dette imputée, aucun solde touché', async () => {
    await seedDebt(20000)
    await seedStock('store-A', 'Orange', 50000)
    await seedStock('store-B', 'Orange', 10000)
    const d = await declareInternalDebtSettlementHandler(req(DEBTOR, { debtId: 'debt-1', amount: 5000, method: 'Banque', idempotencyKey: 'k1' }), { db, FieldValue })
    const c = await confirmInternalDebtSettlementHandler(req(CREDITOR, { debtId: 'debt-1', settlementId: d.settlementId }), { db, FieldValue })

    expect(c).toMatchObject({ balanceMoved: false, remainingAmount: 15000 })
    expect(await stockOf('store-A', 'Orange')).toBe(50000)
    expect(await stockOf('store-B', 'Orange')).toBe(10000)
    expect(await auditCount('store-A', 'INTERNAL_DEBT_SETTLEMENT_BALANCE_MOVED')).toBe(0)
  })
})

describe('TC-110 — plafond des déclarations en attente', () => {
  it('[SETTLE-CAP-01] deux déclarations dont la somme dépasse le reste dû → 2e rejetée', async () => {
    await seedDebt(5000)
    await declareInternalDebtSettlementHandler(req(DEBTOR, { debtId: 'debt-1', amount: 5000, method: 'Cash', idempotencyKey: 'k1' }), { db, FieldValue })
    // Le reste dû est déjà entièrement réservé par la 1re tranche déclarée.
    await expectError(
      declareInternalDebtSettlementHandler(req(DEBTOR, { debtId: 'debt-1', amount: 500, method: 'Cash', idempotencyKey: 'k2' }), { db, FieldValue }),
      'SETTLEMENT_EXCEEDS_REMAINING',
    )
    // Dette et 1re tranche intactes : la 2e n'a rien écrit.
    expect((await debt()).remainingAmount).toBe(5000)
    expect((await db.collection('internalDebts/debt-1/settlements').get()).size).toBe(1)
  })

  it('[SETTLE-CAP-02] déclarations cumulatives jusqu\'au reste dû, puis 1 de trop → rejetée', async () => {
    await seedDebt(5000)
    await declareInternalDebtSettlementHandler(req(DEBTOR, { debtId: 'debt-1', amount: 3000, method: 'Cash', idempotencyKey: 'k1' }), { db, FieldValue })
    await declareInternalDebtSettlementHandler(req(DEBTOR, { debtId: 'debt-1', amount: 2000, method: 'Cash', idempotencyKey: 'k2' }), { db, FieldValue }) // somme = 5000 = reste dû
    await expectError(
      declareInternalDebtSettlementHandler(req(DEBTOR, { debtId: 'debt-1', amount: 1, method: 'Cash', idempotencyKey: 'k3' }), { db, FieldValue }),
      'SETTLEMENT_EXCEEDS_REMAINING',
    )
    expect((await db.collection('internalDebts/debt-1/settlements').get()).size).toBe(2)
  })

  it('[SETTLE-CAP-03] dette réglée / reste dû 0 (même statut « open » transitoire) → DEBT_ALREADY_SETTLED', async () => {
    await seedDebt(0, { status: 'settled' })
    await expectError(
      declareInternalDebtSettlementHandler(req(DEBTOR, { debtId: 'debt-1', amount: 100, method: 'Cash', idempotencyKey: 'k1' }), { db, FieldValue }),
      'DEBT_ALREADY_SETTLED',
    )
    // Reste dû 0 mais statut resté "open" (état incohérent) : refusé aussi.
    await db.doc('internalDebts/debt-1').update({ status: 'open' })
    await expectError(
      declareInternalDebtSettlementHandler(req(DEBTOR, { debtId: 'debt-1', amount: 100, method: 'Cash', idempotencyKey: 'k2' }), { db, FieldValue }),
      'DEBT_ALREADY_SETTLED',
    )
  })

  it('[SETTLE-CAP-04] reste dû saturé : le RETRY identique reste idempotent (pas rejeté par la somme)', async () => {
    await seedDebt(5000)
    const p = { debtId: 'debt-1', amount: 5000, method: 'Cash', idempotencyKey: 'k1' }
    const r1 = await declareInternalDebtSettlementHandler(req(DEBTOR, p), { db, FieldValue })
    const r2 = await declareInternalDebtSettlementHandler(req(DEBTOR, p), { db, FieldValue })
    expect(r2.idempotent).toBe(true)
    expect(r2.settlementId).toBe(r1.settlementId)
    expect((await db.collection('internalDebts/debt-1/settlements').get()).size).toBe(1)
  })

  it('[SETTLE-CAP-05] rejeter une tranche déclarée LIBÈRE la capacité', async () => {
    await seedDebt(5000)
    const d1 = await declareInternalDebtSettlementHandler(req(DEBTOR, { debtId: 'debt-1', amount: 5000, method: 'Cash', idempotencyKey: 'k1' }), { db, FieldValue })
    // Capacité saturée → une 2e déclaration échoue…
    await expectError(
      declareInternalDebtSettlementHandler(req(DEBTOR, { debtId: 'debt-1', amount: 5000, method: 'Cash', idempotencyKey: 'k2' }), { db, FieldValue }),
      'SETTLEMENT_EXCEEDS_REMAINING',
    )
    // …mais après rejet de la 1re, la capacité est rendue.
    await rejectInternalDebtSettlementHandler(req(CREDITOR, { debtId: 'debt-1', settlementId: d1.settlementId, rejectionReason: 'Non reçu' }), { db, FieldValue })
    const d3 = await declareInternalDebtSettlementHandler(req(DEBTOR, { debtId: 'debt-1', amount: 5000, method: 'Cash', idempotencyKey: 'k3' }), { db, FieldValue })
    expect(d3).toMatchObject({ success: true, idempotent: false })
  })
})

describe('TC-110 — reject', () => {
  it('[DS-09] créancière rejette : tranche rejected, dette inchangée', async () => {
    await seedDebt(20000)
    const d1 = await declareInternalDebtSettlementHandler(req(DEBTOR, { debtId: 'debt-1', amount: 5000, method: 'Cash', idempotencyKey: 'k1' }), { db, FieldValue })
    await rejectInternalDebtSettlementHandler(req(CREDITOR, { debtId: 'debt-1', settlementId: d1.settlementId, rejectionReason: 'Non reçu' }), { db, FieldValue })
    expect((await settlement(d1.settlementId)).settlementStatus).toBe('rejected')
    expect((await debt()).remainingAmount).toBe(20000)
  })

  it('[DS-10] débitrice rejette → DEBT_STORE_MISMATCH', async () => {
    await seedDebt()
    const d1 = await declareInternalDebtSettlementHandler(req(DEBTOR, { debtId: 'debt-1', amount: 5000, method: 'Cash', idempotencyKey: 'k1' }), { db, FieldValue })
    await expectError(rejectInternalDebtSettlementHandler(req(DEBTOR, { debtId: 'debt-1', settlementId: d1.settlementId, rejectionReason: 'pas moi' }), { db, FieldValue }), 'DEBT_STORE_MISMATCH')
  })
})
