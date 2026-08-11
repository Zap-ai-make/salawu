/**
 * TC-124 — Compensation des dettes internes opposées (declare/confirm/reject).
 *   Handlers integration Firestore Emulator, { db, FieldValue } injectés.
 *
 * Scénario métier (décision client 2026-08-11) :
 *   D1 = A doit à B (dépôt, Orange) ; D2 = B doit à A (retrait, Moov). La débitrice de
 *   D1 (A) propose la compensation ; la créancière de D1 (B) la confirme → LES DEUX
 *   dettes baissent du même montant, tous réseaux confondus.
 *
 * Comportement protégé :
 *   - declare (débitrice de D1) : tranche compensation `declared`, dettes inchangées ;
 *     plafond = min(reste D1, reste D2) ; opposée obligatoire ; idempotence ;
 *   - confirm (créancière de D1) : impute sur D1 ET D2 atomiquement ; tranche miroir ;
 *     garde-fou anti-dérive ;
 *   - reject (créancière de D1) : tranche rejected, dettes inchangées ;
 *   - gardes de rôle (débitrice vs créancière).
 *
 * Exécution : npm run test:functions (émulateur, projet demo-akayis-test).
 */

import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest'
import { initializeApp, getApps, deleteApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { declareInternalDebtCompensationHandler } from '../../functions/src/collaborations/declareInternalDebtCompensation.js'
import { confirmInternalDebtCompensationHandler } from '../../functions/src/collaborations/confirmInternalDebtCompensation.js'
import { rejectInternalDebtCompensationHandler } from '../../functions/src/collaborations/rejectInternalDebtCompensation.js'

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

const A = 'admin-a-uid'  // store-A : débitrice de D1
const B = 'admin-b-uid'  // store-B : créancière de D1
const req = (uid, data) => ({ auth: uid ? { uid, token: {} } : null, data: data ?? {} })
async function expectError(promise, code) { await expect(promise).rejects.toMatchObject({ code }) }

// D1 = A→B (dépôt Orange) 20 000 ; D2 = B→A (retrait Moov) 15 000.
async function seed({ d1 = 20000, d2 = 15000 } = {}) {
  await db.doc('users/admin-a-uid').set({ role: 'store_admin', active: true, storeId: 'store-A', storeName: 'A', email: 'a@t.test', name: 'A' })
  await db.doc('users/admin-b-uid').set({ role: 'store_admin', active: true, storeId: 'store-B', storeName: 'B', email: 'b@t.test', name: 'B' })
  await db.doc('internalDebts/debt-1').set({
    collaborationId: 'col-1', debtorStoreId: 'store-A', debtorStoreName: 'A',
    creditorStoreId: 'store-B', creditorStoreName: 'B', network: 'Orange', operationType: 'deposit',
    originalAmount: d1, settledAmount: 0, remainingAmount: d1, status: 'open',
  })
  await db.doc('internalDebts/debt-2').set({
    collaborationId: 'col-2', debtorStoreId: 'store-B', debtorStoreName: 'B',
    creditorStoreId: 'store-A', creditorStoreName: 'A', network: 'Moov', operationType: 'withdrawal',
    originalAmount: d2, settledAmount: 0, remainingAmount: d2, status: 'open',
  })
}
const debt = async (id) => (await db.doc(`internalDebts/${id}`).get()).data()
const tranche = async (debtId, id) => (await db.doc(`internalDebts/${debtId}/settlements/${id}`).get()).data()
const P = { debtId: 'debt-1', oppositeDebtId: 'debt-2' }

describe('TC-124 — declare (compensation)', () => {
  it('[C-01] déclare : tranche compensation declared, dettes inchangées', async () => {
    await seed()
    const res = await declareInternalDebtCompensationHandler(req(A, { ...P, amount: 15000, idempotencyKey: 'k1' }), { db, FieldValue })
    expect(res).toMatchObject({ success: true, idempotent: false })
    const t = await tranche('debt-1', res.settlementId)
    expect(t).toMatchObject({ method: 'compensation', oppositeDebtId: 'debt-2', amount: 15000, settlementStatus: 'declared' })
    expect((await debt('debt-1')).remainingAmount).toBe(20000)
    expect((await debt('debt-2')).remainingAmount).toBe(15000)
  })

  it('[C-02] montant > min(restes) → COMPENSATION_EXCEEDS_REMAINING', async () => {
    await seed()
    await expectError(declareInternalDebtCompensationHandler(req(A, { ...P, amount: 16000, idempotencyKey: 'k1' }), { db, FieldValue }), 'COMPENSATION_EXCEEDS_REMAINING')
  })

  it('[C-03] la créancière de D1 déclare → DEBT_STORE_MISMATCH', async () => {
    await seed()
    await expectError(declareInternalDebtCompensationHandler(req(B, { ...P, amount: 15000, idempotencyKey: 'k1' }), { db, FieldValue }), 'DEBT_STORE_MISMATCH')
  })

  it('[C-04] dette non opposée (même sens) → NOT_OPPOSITE_PAIR', async () => {
    await seed()
    // debt-3 = A→B (même sens que D1), donc pas une opposée.
    await db.doc('internalDebts/debt-3').set({
      debtorStoreId: 'store-A', creditorStoreId: 'store-B', network: 'Coris', operationType: 'deposit',
      originalAmount: 4000, settledAmount: 0, remainingAmount: 4000, status: 'open',
    })
    await expectError(declareInternalDebtCompensationHandler(req(A, { debtId: 'debt-1', oppositeDebtId: 'debt-3', amount: 4000, idempotencyKey: 'k1' }), { db, FieldValue }), 'NOT_OPPOSITE_PAIR')
  })

  it('[C-05] idempotence : même clé + payload → no-op, un seul doc', async () => {
    await seed()
    const p = { ...P, amount: 15000, idempotencyKey: 'k1' }
    const r1 = await declareInternalDebtCompensationHandler(req(A, p), { db, FieldValue })
    const r2 = await declareInternalDebtCompensationHandler(req(A, p), { db, FieldValue })
    expect(r2.idempotent).toBe(true)
    expect(r2.settlementId).toBe(r1.settlementId)
    expect((await db.collection('internalDebts/debt-1/settlements').get()).size).toBe(1)
  })

  it('[C-06] même clé + payload différent → IDEMPOTENCY_CONFLICT', async () => {
    await seed()
    await declareInternalDebtCompensationHandler(req(A, { ...P, amount: 15000, idempotencyKey: 'k1' }), { db, FieldValue })
    await expectError(declareInternalDebtCompensationHandler(req(A, { ...P, amount: 10000, idempotencyKey: 'k1' }), { db, FieldValue }), 'IDEMPOTENCY_CONFLICT')
  })
})

describe('TC-124 — confirm (compensation)', () => {
  it('[C-07] confirme : LES DEUX dettes baissent, tous réseaux (Orange × Moov)', async () => {
    await seed()
    const d = await declareInternalDebtCompensationHandler(req(A, { ...P, amount: 15000, idempotencyKey: 'k1' }), { db, FieldValue })
    const c = await confirmInternalDebtCompensationHandler(req(B, { debtId: 'debt-1', settlementId: d.settlementId }), { db, FieldValue })
    expect(c).toMatchObject({ debtStatus: 'partially_settled', remainingAmount: 5000, oppositeDebtStatus: 'settled', oppositeRemainingAmount: 0 })

    expect(await debt('debt-1')).toMatchObject({ remainingAmount: 5000, settledAmount: 15000, status: 'partially_settled' })
    expect(await debt('debt-2')).toMatchObject({ remainingAmount: 0, settledAmount: 15000, status: 'settled' })
    // tranche D1 confirmée + tranche miroir sous D2.
    expect((await tranche('debt-1', d.settlementId)).settlementStatus).toBe('confirmed')
    const mirror = await tranche('debt-2', `comp_debt-1_${d.settlementId}`)
    expect(mirror).toMatchObject({ method: 'compensation', settlementStatus: 'confirmed', amount: 15000, mirrorOf: d.settlementId })
  })

  it('[C-08] la débitrice de D1 confirme → DEBT_STORE_MISMATCH', async () => {
    await seed()
    const d = await declareInternalDebtCompensationHandler(req(A, { ...P, amount: 15000, idempotencyKey: 'k1' }), { db, FieldValue })
    await expectError(confirmInternalDebtCompensationHandler(req(A, { debtId: 'debt-1', settlementId: d.settlementId }), { db, FieldValue }), 'DEBT_STORE_MISMATCH')
  })

  it('[C-09] confirmer 2 fois → SETTLEMENT_NOT_DECLARED', async () => {
    await seed()
    const d = await declareInternalDebtCompensationHandler(req(A, { ...P, amount: 15000, idempotencyKey: 'k1' }), { db, FieldValue })
    await confirmInternalDebtCompensationHandler(req(B, { debtId: 'debt-1', settlementId: d.settlementId }), { db, FieldValue })
    await expectError(confirmInternalDebtCompensationHandler(req(B, { debtId: 'debt-1', settlementId: d.settlementId }), { db, FieldValue }), 'SETTLEMENT_NOT_DECLARED')
  })

  it('[C-10] garde-fou anti-dérive : D2 réduite entre-temps → COMPENSATION_EXCEEDS_REMAINING', async () => {
    await seed()
    const d = await declareInternalDebtCompensationHandler(req(A, { ...P, amount: 15000, idempotencyKey: 'k1' }), { db, FieldValue })
    // D2 partiellement réglée par ailleurs → reste 5 000 < 15 000 déclarés.
    await db.doc('internalDebts/debt-2').update({ remainingAmount: 5000, settledAmount: 10000, status: 'partially_settled' })
    await expectError(confirmInternalDebtCompensationHandler(req(B, { debtId: 'debt-1', settlementId: d.settlementId }), { db, FieldValue }), 'COMPENSATION_EXCEEDS_REMAINING')
    // Aucune imputation.
    expect((await debt('debt-1')).remainingAmount).toBe(20000)
  })
})

describe('TC-124 — reject (compensation)', () => {
  it('[C-11] créancière rejette : tranche rejected, dettes inchangées', async () => {
    await seed()
    const d = await declareInternalDebtCompensationHandler(req(A, { ...P, amount: 15000, idempotencyKey: 'k1' }), { db, FieldValue })
    await rejectInternalDebtCompensationHandler(req(B, { debtId: 'debt-1', settlementId: d.settlementId, rejectionReason: 'Pas d\'accord' }), { db, FieldValue })
    expect((await tranche('debt-1', d.settlementId)).settlementStatus).toBe('rejected')
    expect((await debt('debt-1')).remainingAmount).toBe(20000)
    expect((await debt('debt-2')).remainingAmount).toBe(15000)
  })

  it('[C-12] la débitrice rejette → DEBT_STORE_MISMATCH', async () => {
    await seed()
    const d = await declareInternalDebtCompensationHandler(req(A, { ...P, amount: 15000, idempotencyKey: 'k1' }), { db, FieldValue })
    await expectError(rejectInternalDebtCompensationHandler(req(A, { debtId: 'debt-1', settlementId: d.settlementId, rejectionReason: 'pas moi' }), { db, FieldValue }), 'DEBT_STORE_MISMATCH')
  })
})
