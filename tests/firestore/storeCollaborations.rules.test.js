/**
 * Règles Firestore — storeCollaborations (Vague 2, LOT 3).
 *
 * Écritures EXCLUSIVEMENT via Cloud Functions. Lecture cloisonnée :
 * boutique demandeuse, boutique fournisseuse, gérant. Une TROISIÈME boutique
 * ne lit rien. Testé avec 3 boutiques. Projet exclusif : demo-akayis-test.
 */

import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertSucceeds,
  assertFails,
  getAuthenticatedContext,
  getUnauthenticatedContext,
  seedDocument,
} from './helpers.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rules = readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf-8')

let testEnv

beforeAll(async () => {
  const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || ''
  if (projectId !== 'demo-akayis-test') {
    throw new Error(`SÉCURITÉ : projectId doit être "demo-akayis-test". Reçu : "${projectId}"`)
  }
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-akayis-test',
    firestore: { rules, host: '127.0.0.1', port: 8080 },
  })
})

afterAll(async () => { if (testEnv) await testEnv.cleanup() })
beforeEach(async () => { await testEnv.clearFirestore() })

async function seedAll() {
  await seedDocument(testEnv, 'stores', 'store-A', { name: 'Boutique A', active: true, adminUid: 'admin-a-uid' })
  await seedDocument(testEnv, 'stores', 'store-B', { name: 'Boutique B', active: true, adminUid: 'admin-b-uid' })
  await seedDocument(testEnv, 'stores', 'store-C', { name: 'Boutique C', active: true, adminUid: 'admin-c-uid' })
  await seedDocument(testEnv, 'users', 'admin-a-uid', { role: 'store_admin', active: true, storeId: 'store-A', storeName: 'Boutique A', email: 'a@t.test', name: 'A' })
  await seedDocument(testEnv, 'users', 'admin-b-uid', { role: 'store_admin', active: true, storeId: 'store-B', storeName: 'Boutique B', email: 'b@t.test', name: 'B' })
  await seedDocument(testEnv, 'users', 'admin-c-uid', { role: 'store_admin', active: true, storeId: 'store-C', storeName: 'Boutique C', email: 'c@t.test', name: 'C' })
  await seedDocument(testEnv, 'users', 'mgr-uid', { role: 'system_manager', active: true, email: 'm@t.test', name: 'Mgr' })

  await seedDocument(testEnv, 'storeCollaborations', 'col-1', {
    requestingStoreId: 'store-A', requestingStoreName: 'Boutique A', requestingStoreAdminUid: 'admin-a-uid',
    supplierStoreId: 'store-B', supplierStoreName: 'Boutique B',
    clientId: 'cli-1', clientNom: 'NIKIEMA', clientPrenom: 'Salif',
    network: 'Orange', operationType: 'deposit', amount: 20000, status: 'pending',
    previousSupplierBalance: null, newSupplierBalance: null, debtId: null,
  })
}

const fs = (uid) => getAuthenticatedContext(testEnv, uid).firestore()

describe('storeCollaborations — lecture', () => {
  it('boutique demandeuse lit → allow', async () => {
    await seedAll()
    await assertSucceeds(getDoc(doc(fs('admin-a-uid'), 'storeCollaborations', 'col-1')))
  })
  it('boutique fournisseuse lit → allow', async () => {
    await seedAll()
    await assertSucceeds(getDoc(doc(fs('admin-b-uid'), 'storeCollaborations', 'col-1')))
  })
  it('boutique tierce → deny', async () => {
    await seedAll()
    await assertFails(getDoc(doc(fs('admin-c-uid'), 'storeCollaborations', 'col-1')))
  })
  it('system_manager lit → allow', async () => {
    await seedAll()
    await assertSucceeds(getDoc(doc(fs('mgr-uid'), 'storeCollaborations', 'col-1')))
  })
  it('non authentifié → deny', async () => {
    await seedAll()
    await assertFails(getDoc(doc(getUnauthenticatedContext(testEnv).firestore(), 'storeCollaborations', 'col-1')))
  })
})

describe('storeCollaborations — écritures refusées (CF only)', () => {
  const payload = { requestingStoreId: 'store-A', supplierStoreId: 'store-B', status: 'pending', amount: 1 }
  it('demandeuse crée → deny', async () => {
    await seedAll()
    await assertFails(setDoc(doc(fs('admin-a-uid'), 'storeCollaborations', 'new'), payload))
  })
  it('fournisseuse update statut → deny', async () => {
    await seedAll()
    await assertFails(updateDoc(doc(fs('admin-b-uid'), 'storeCollaborations', 'col-1'), { status: 'confirmed' }))
  })
  it('demandeuse delete → deny', async () => {
    await seedAll()
    await assertFails(deleteDoc(doc(fs('admin-a-uid'), 'storeCollaborations', 'col-1')))
  })
})
