/**
 * TC-106 — Confirmation d'une collaboration (confirmStoreCollaboration).
 *   Handler integration Firestore Emulator, { db, FieldValue } injectés.
 *
 * Comportement protégé :
 *   - deposit : stock fournisseur −amount (liquidité préservée), dette demandeuse→fournisseuse, audit ;
 *   - withdrawal : stock fournisseur +amount (depuis 0 si pas de doc), dette fournisseuse→demandeuse ;
 *   - gardes : stock insuffisant (deposit), déjà traitée, mauvais acteur, plus fournisseuse ;
 *   - dette ouverte ne bloque pas une 2e confirmation.
 *
 * Exécution : npm run test:functions (émulateur, projet demo-akayis-test).
 */

import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest'
import { initializeApp, getApps, deleteApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { confirmStoreCollaborationHandler } from '../../functions/src/collaborations/confirmStoreCollaboration.js'

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

const ADMIN_B = 'admin-b-uid' // fournisseuse (store-B)
const ADMIN_A = 'admin-a-uid' // demandeuse (store-A)
const makeRequest = (uid, data) => ({ auth: uid ? { uid, token: {} } : null, data: data ?? {} })
async function expectError(promise, code) { await expect(promise).rejects.toMatchObject({ code }) }

async function seedActors() {
  await db.doc('users/admin-b-uid').set({ role: 'store_admin', active: true, storeId: 'store-B', storeName: 'Boutique B', email: 'b@t.test', name: 'Admin B' })
  await db.doc('users/admin-a-uid').set({ role: 'store_admin', active: true, storeId: 'store-A', storeName: 'Boutique A', email: 'a@t.test', name: 'Admin A' })
  await db.doc('storeNetworkConfig/store-B').set({ networks: { Orange: { operates: true, supplyMode: 'external_partner', isSupplied: false, isProvider: true } } })
}

async function seedCollab(id, over = {}) {
  await db.doc(`storeCollaborations/${id}`).set({
    requestingStoreId: 'store-A', requestingStoreName: 'Boutique A', requestingStoreAdminUid: 'admin-a-uid',
    supplierStoreId: 'store-B', supplierStoreName: 'Boutique B',
    clientId: 'cli-1', clientNom: 'NIKIEMA', clientPrenom: 'Salif',
    network: 'Orange', operationType: 'deposit', amount: 20000, status: 'pending',
    previousSupplierBalance: null, newSupplierBalance: null, debtId: null, ...over,
  })
}

const debtByCollab = async (collaborationId) => {
  const snap = await db.collection('internalDebts').where('collaborationId', '==', collaborationId).get()
  return snap.empty ? null : snap.docs[0].data()
}

describe('TC-106 — confirmStoreCollaboration', () => {
  it('[CF-01] deposit : stock B −amount (liquidité préservée), dette A→B, collab confirmée', async () => {
    await seedActors()
    await db.doc('clients/store-B/networkBalances/current').set({ balances: { Orange: { stock: 100000, liquidite: 5000 } } })
    await seedCollab('col-1')

    const res = await confirmStoreCollaborationHandler(makeRequest(ADMIN_B, { collaborationId: 'col-1' }), { db, FieldValue })
    expect(res).toMatchObject({ success: true, previousSupplierBalance: 100000, newSupplierBalance: 80000 })

    const bal = (await db.doc('clients/store-B/networkBalances/current').get()).data()
    expect(bal.balances.Orange.stock).toBe(80000)
    expect(bal.balances.Orange.liquidite).toBe(5000) // préservé

    const debt = await debtByCollab('col-1')
    expect(debt).toMatchObject({ debtorStoreId: 'store-A', creditorStoreId: 'store-B', originalAmount: 20000, remainingAmount: 20000, settledAmount: 0, status: 'open' })

    const collab = (await db.doc('storeCollaborations/col-1').get()).data()
    expect(collab.status).toBe('confirmed')
    expect(collab.debtId).toBe(res.debtId)

    const audit = await db.collection('clients/store-B/auditLogs').get()
    expect(audit.docs.some(d => d.data().action === 'STORE_COLLABORATION_CONFIRMED')).toBe(true)
  })

  it('[CF-02] withdrawal : stock B +amount (depuis 0), dette B→A', async () => {
    await seedActors()
    await seedCollab('col-2', { operationType: 'withdrawal', amount: 15000 })

    const res = await confirmStoreCollaborationHandler(makeRequest(ADMIN_B, { collaborationId: 'col-2' }), { db, FieldValue })
    expect(res).toMatchObject({ previousSupplierBalance: 0, newSupplierBalance: 15000 })

    const bal = (await db.doc('clients/store-B/networkBalances/current').get()).data()
    expect(bal.balances.Orange.stock).toBe(15000)

    const debt = await debtByCollab('col-2')
    expect(debt).toMatchObject({ debtorStoreId: 'store-B', creditorStoreId: 'store-A', remainingAmount: 15000 })
  })

  it('[CF-03] deposit stock insuffisant → INSUFFICIENT_SUPPLIER_BALANCE, rien écrit', async () => {
    await seedActors()
    await db.doc('clients/store-B/networkBalances/current').set({ balances: { Orange: { stock: 5000, liquidite: 0 } } })
    await seedCollab('col-3', { amount: 20000 })

    await expectError(confirmStoreCollaborationHandler(makeRequest(ADMIN_B, { collaborationId: 'col-3' }), { db, FieldValue }), 'INSUFFICIENT_SUPPLIER_BALANCE')
    expect((await db.doc('clients/store-B/networkBalances/current').get()).data().balances.Orange.stock).toBe(5000)
    expect((await db.collection('internalDebts').get()).size).toBe(0)
    expect((await db.doc('storeCollaborations/col-3').get()).data().status).toBe('pending')
  })

  it('[CF-04] déjà traitée → COLLABORATION_NOT_PENDING', async () => {
    await seedActors()
    await seedCollab('col-4', { status: 'confirmed' })
    await expectError(confirmStoreCollaborationHandler(makeRequest(ADMIN_B, { collaborationId: 'col-4' }), { db, FieldValue }), 'COLLABORATION_NOT_PENDING')
  })

  it('[CF-05] acteur non fournisseuse (demandeuse) → COLLABORATION_STORE_MISMATCH', async () => {
    await seedActors()
    await db.doc('clients/store-B/networkBalances/current').set({ balances: { Orange: { stock: 100000, liquidite: 0 } } })
    await seedCollab('col-5')
    await expectError(confirmStoreCollaborationHandler(makeRequest(ADMIN_A, { collaborationId: 'col-5' }), { db, FieldValue }), 'COLLABORATION_STORE_MISMATCH')
  })

  it('[CF-06] fournisseuse plus isProvider → SUPPLIER_NOT_PROVIDER', async () => {
    await seedActors()
    await db.doc('storeNetworkConfig/store-B').set({ networks: { Orange: { operates: true, supplyMode: 'dealer', isSupplied: true, isProvider: false } } })
    await db.doc('clients/store-B/networkBalances/current').set({ balances: { Orange: { stock: 100000, liquidite: 0 } } })
    await seedCollab('col-6')
    await expectError(confirmStoreCollaborationHandler(makeRequest(ADMIN_B, { collaborationId: 'col-6' }), { db, FieldValue }), 'SUPPLIER_NOT_PROVIDER')
  })

  it('[CF-07] une dette ouverte ne bloque pas une 2e confirmation', async () => {
    await seedActors()
    await db.doc('clients/store-B/networkBalances/current').set({ balances: { Orange: { stock: 100000, liquidite: 0 } } })
    await seedCollab('col-7a', { amount: 20000 })
    await seedCollab('col-7b', { amount: 10000 })

    await confirmStoreCollaborationHandler(makeRequest(ADMIN_B, { collaborationId: 'col-7a' }), { db, FieldValue })
    await confirmStoreCollaborationHandler(makeRequest(ADMIN_B, { collaborationId: 'col-7b' }), { db, FieldValue })

    expect((await db.doc('clients/store-B/networkBalances/current').get()).data().balances.Orange.stock).toBe(70000)
    expect((await db.collection('internalDebts').get()).size).toBe(2)
  })
})
