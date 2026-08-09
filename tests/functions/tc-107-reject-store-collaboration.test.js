/**
 * TC-107 — Rejet d'une collaboration (rejectStoreCollaboration).
 *   Handler integration Firestore Emulator, { db, FieldValue } injectés.
 *
 * Comportement protégé : rejet par la fournisseuse (motif obligatoire), AUCUN
 * mouvement de solde ni dette ; gardes déjà-traitée / mauvais acteur / motif court.
 *
 * Exécution : npm run test:functions (émulateur, projet demo-akayis-test).
 */

import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest'
import { initializeApp, getApps, deleteApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { rejectStoreCollaborationHandler } from '../../functions/src/collaborations/rejectStoreCollaboration.js'

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

const ADMIN_B = 'admin-b-uid'
const ADMIN_A = 'admin-a-uid'
const makeRequest = (uid, data) => ({ auth: uid ? { uid, token: {} } : null, data: data ?? {} })
async function expectError(promise, code) { await expect(promise).rejects.toMatchObject({ code }) }

async function seedActorsAndCollab(over = {}) {
  await db.doc('users/admin-b-uid').set({ role: 'store_admin', active: true, storeId: 'store-B', storeName: 'Boutique B', email: 'b@t.test', name: 'Admin B' })
  await db.doc('users/admin-a-uid').set({ role: 'store_admin', active: true, storeId: 'store-A', storeName: 'Boutique A', email: 'a@t.test', name: 'Admin A' })
  await db.doc('storeCollaborations/col-1').set({
    requestingStoreId: 'store-A', requestingStoreName: 'Boutique A', requestingStoreAdminUid: 'admin-a-uid',
    supplierStoreId: 'store-B', supplierStoreName: 'Boutique B',
    clientId: 'cli-1', clientNom: 'NIKIEMA', clientPrenom: 'Salif',
    network: 'Orange', operationType: 'deposit', amount: 20000, status: 'pending',
    previousSupplierBalance: null, newSupplierBalance: null, debtId: null, ...over,
  })
}

describe('TC-107 — rejectStoreCollaboration', () => {
  it('[RJ-01] succès : rejected + motif, aucune dette ni solde, audit', async () => {
    await seedActorsAndCollab()
    const res = await rejectStoreCollaborationHandler(makeRequest(ADMIN_B, { collaborationId: 'col-1', rejectionReason: 'Stock indisponible' }), { db, FieldValue })
    expect(res.success).toBe(true)

    const collab = (await db.doc('storeCollaborations/col-1').get()).data()
    expect(collab.status).toBe('rejected')
    expect(collab.rejectionReason).toBe('Stock indisponible')
    expect(collab.rejectedBy).toBe(ADMIN_B)
    expect(collab.debtId).toBeNull()

    expect((await db.collection('internalDebts').get()).size).toBe(0)
    expect((await db.doc('clients/store-B/networkBalances/current').get()).exists).toBe(false)
    const audit = await db.collection('clients/store-B/auditLogs').get()
    expect(audit.docs.some(d => d.data().action === 'STORE_COLLABORATION_REJECTED')).toBe(true)
  })

  it('[RJ-02] déjà traitée → COLLABORATION_NOT_PENDING', async () => {
    await seedActorsAndCollab({ status: 'confirmed' })
    await expectError(rejectStoreCollaborationHandler(makeRequest(ADMIN_B, { collaborationId: 'col-1', rejectionReason: 'trop tard' }), { db, FieldValue }), 'COLLABORATION_NOT_PENDING')
  })

  it('[RJ-03] acteur non fournisseuse (demandeuse) → COLLABORATION_STORE_MISMATCH', async () => {
    await seedActorsAndCollab()
    await expectError(rejectStoreCollaborationHandler(makeRequest(ADMIN_A, { collaborationId: 'col-1', rejectionReason: 'pas a moi' }), { db, FieldValue }), 'COLLABORATION_STORE_MISMATCH')
  })

  it('[RJ-04] motif trop court → INVALID_REJECTION_REASON', async () => {
    await seedActorsAndCollab()
    await expectError(rejectStoreCollaborationHandler(makeRequest(ADMIN_B, { collaborationId: 'col-1', rejectionReason: 'x' }), { db, FieldValue }), 'INVALID_REJECTION_REASON')
  })
})
