/**
 * TC-104 — Création d'une collaboration inter-boutiques (createStoreCollaboration).
 *   Handler integration avec Firestore Emulator, { db, FieldValue } injectés.
 *
 * Comportement protégé :
 *   - succès : document pending + audit demandeuse, AUCUN mouvement de solde ;
 *   - gardes : fournisseuse = demandeuse, fournisseuse inexistante, non fournisseuse
 *     (isProvider!=true), client inexistant, rôle non store_admin, réseau invalide.
 *
 * Exécution : npm run test:functions (émulateur Firestore, projet demo-akayis-test).
 */

import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest'
import { initializeApp, getApps, deleteApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { createStoreCollaborationHandler } from '../../functions/src/collaborations/createStoreCollaboration.js'

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

const ADMIN_A = 'admin-a-uid'
const makeRequest = (uid, data) => ({ auth: uid ? { uid, token: {} } : null, data: data ?? {} })
async function expectError(promise, code) { await expect(promise).rejects.toMatchObject({ code }) }

const VALID = { clientId: 'cli-1', network: 'Orange', operationType: 'deposit', amount: 20000, supplierStoreId: 'store-B' }

async function seedBase() {
  await db.doc('users/admin-a-uid').set({ role: 'store_admin', active: true, storeId: 'store-A', storeName: 'Boutique A', email: 'a@t.test', name: 'Admin A' })
  await db.doc('stores/store-A').set({ name: 'Boutique A', active: true, adminUid: 'admin-a-uid' })
  await db.doc('stores/store-B').set({ name: 'Boutique B', active: true, adminUid: 'admin-b-uid' })
  await db.doc('storeNetworkConfig/store-B').set({ networks: { Orange: { operates: true, supplyMode: 'external_partner', isSupplied: false, isProvider: true } } })
  await db.doc('globalClients/cli-1').set({ nom: 'NIKIEMA', prenom: 'Salif', registeredStoreId: 'store-A' })
}

describe('TC-104 — createStoreCollaboration', () => {
  it('[CC-01] succès : collaboration pending + audit, aucun solde touché', async () => {
    await seedBase()
    const res = await createStoreCollaborationHandler(makeRequest(ADMIN_A, VALID), { db, FieldValue })
    expect(res.success).toBe(true)

    const collab = (await db.doc(`storeCollaborations/${res.collaborationId}`).get()).data()
    expect(collab).toMatchObject({
      requestingStoreId: 'store-A', supplierStoreId: 'store-B', clientId: 'cli-1',
      clientNom: 'NIKIEMA', network: 'Orange', operationType: 'deposit', amount: 20000, status: 'pending',
      previousSupplierBalance: null, newSupplierBalance: null, debtId: null,
    })

    // Aucun solde créé/modifié (création = pending pur)
    expect((await db.doc('clients/store-B/networkBalances/current').get()).exists).toBe(false)
    const audit = await db.collection('clients/store-A/auditLogs').get()
    expect(audit.size).toBe(1)
    expect(audit.docs[0].data().action).toBe('STORE_COLLABORATION_CREATED')
  })

  it('[CC-02] fournisseuse == demandeuse → SAME_STORE_COLLABORATION', async () => {
    await seedBase()
    await expectError(createStoreCollaborationHandler(makeRequest(ADMIN_A, { ...VALID, supplierStoreId: 'store-A' }), { db, FieldValue }), 'SAME_STORE_COLLABORATION')
  })

  it('[CC-03] fournisseuse inexistante → SUPPLIER_STORE_NOT_FOUND', async () => {
    await seedBase()
    await expectError(createStoreCollaborationHandler(makeRequest(ADMIN_A, { ...VALID, supplierStoreId: 'ghost' }), { db, FieldValue }), 'SUPPLIER_STORE_NOT_FOUND')
  })

  it('[CC-04] fournisseuse non isProvider sur ce réseau → SUPPLIER_NOT_PROVIDER', async () => {
    await seedBase()
    await db.doc('storeNetworkConfig/store-B').set({ networks: { Orange: { operates: true, supplyMode: 'dealer', isSupplied: true, isProvider: false } } })
    await expectError(createStoreCollaborationHandler(makeRequest(ADMIN_A, VALID), { db, FieldValue }), 'SUPPLIER_NOT_PROVIDER')
  })

  it('[CC-05] client inexistant → CLIENT_NOT_FOUND', async () => {
    await seedBase()
    await expectError(createStoreCollaborationHandler(makeRequest(ADMIN_A, { ...VALID, clientId: 'nope' }), { db, FieldValue }), 'CLIENT_NOT_FOUND')
  })

  it('[CC-06] acteur non store_admin (dealer) → ROLE_FORBIDDEN', async () => {
    await seedBase()
    await db.doc('users/dealer-uid').set({ role: 'dealer', active: true, email: 'd@t.test', name: 'Dealer' })
    await expectError(createStoreCollaborationHandler(makeRequest('dealer-uid', VALID), { db, FieldValue }), 'ROLE_FORBIDDEN')
  })

  it('[CC-07] réseau invalide → INVALID_COLLABORATION_NETWORK', async () => {
    await seedBase()
    await expectError(createStoreCollaborationHandler(makeRequest(ADMIN_A, { ...VALID, network: 'Mtn' }), { db, FieldValue }), 'INVALID_COLLABORATION_NETWORK')
  })
})
