/**
 * Règles Firestore — internalDebts (+ sous-collection settlements) — Vague 2, LOT 6.
 *
 * Écritures EXCLUSIVEMENT via Cloud Functions. Lecture cloisonnée : boutique
 * débitrice, boutique créancière, gérant. Une TROISIÈME boutique ne lit rien.
 * La tranche de règlement dénormalise debtor/creditor (pas de get() du parent).
 * Testé avec 3 boutiques. Projet exclusif : demo-akayis-test.
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
  await seedDocument(testEnv, 'users', 'admin-a-uid', { role: 'store_admin', active: true, storeId: 'store-A', storeName: 'A', email: 'a@t.test', name: 'A' })
  await seedDocument(testEnv, 'users', 'admin-b-uid', { role: 'store_admin', active: true, storeId: 'store-B', storeName: 'B', email: 'b@t.test', name: 'B' })
  await seedDocument(testEnv, 'users', 'admin-c-uid', { role: 'store_admin', active: true, storeId: 'store-C', storeName: 'C', email: 'c@t.test', name: 'C' })
  await seedDocument(testEnv, 'users', 'mgr-uid', { role: 'system_manager', active: true, email: 'm@t.test', name: 'Mgr' })

  // Dette : store-A (débitrice) → store-B (créancière)
  await seedDocument(testEnv, 'internalDebts', 'debt-1', {
    collaborationId: 'col-1', debtorStoreId: 'store-A', debtorStoreName: 'A',
    creditorStoreId: 'store-B', creditorStoreName: 'B', network: 'Orange', operationType: 'deposit',
    originalAmount: 20000, settledAmount: 0, remainingAmount: 20000, status: 'open',
  })
  await seedDocument(testEnv, 'internalDebts/debt-1/settlements', 'set-1', {
    debtorStoreId: 'store-A', creditorStoreId: 'store-B', amount: 5000, method: 'especes', settlementStatus: 'declared',
  })
}

const fs = (uid) => getAuthenticatedContext(testEnv, uid).firestore()

describe('internalDebts — lecture', () => {
  it('débitrice lit → allow', async () => { await seedAll(); await assertSucceeds(getDoc(doc(fs('admin-a-uid'), 'internalDebts', 'debt-1'))) })
  it('créancière lit → allow', async () => { await seedAll(); await assertSucceeds(getDoc(doc(fs('admin-b-uid'), 'internalDebts', 'debt-1'))) })
  it('boutique tierce → deny', async () => { await seedAll(); await assertFails(getDoc(doc(fs('admin-c-uid'), 'internalDebts', 'debt-1'))) })
  it('system_manager → allow', async () => { await seedAll(); await assertSucceeds(getDoc(doc(fs('mgr-uid'), 'internalDebts', 'debt-1'))) })
  it('non authentifié → deny', async () => { await seedAll(); await assertFails(getDoc(doc(getUnauthenticatedContext(testEnv).firestore(), 'internalDebts', 'debt-1'))) })
})

describe('internalDebts — écritures refusées (CF only)', () => {
  it('débitrice crée → deny', async () => { await seedAll(); await assertFails(setDoc(doc(fs('admin-a-uid'), 'internalDebts', 'new'), { debtorStoreId: 'store-A', creditorStoreId: 'store-B', remainingAmount: 1 })) })
  it('débitrice update → deny', async () => { await seedAll(); await assertFails(updateDoc(doc(fs('admin-a-uid'), 'internalDebts', 'debt-1'), { remainingAmount: 0 })) })
  it('créancière delete → deny', async () => { await seedAll(); await assertFails(deleteDoc(doc(fs('admin-b-uid'), 'internalDebts', 'debt-1'))) })
})

describe('internalDebts/settlements — lecture / écriture', () => {
  it('débitrice lit une tranche → allow', async () => { await seedAll(); await assertSucceeds(getDoc(doc(fs('admin-a-uid'), 'internalDebts/debt-1/settlements', 'set-1'))) })
  it('créancière lit une tranche → allow', async () => { await seedAll(); await assertSucceeds(getDoc(doc(fs('admin-b-uid'), 'internalDebts/debt-1/settlements', 'set-1'))) })
  it('boutique tierce → deny', async () => { await seedAll(); await assertFails(getDoc(doc(fs('admin-c-uid'), 'internalDebts/debt-1/settlements', 'set-1'))) })
  it('écriture directe d\'une tranche → deny', async () => { await seedAll(); await assertFails(setDoc(doc(fs('admin-a-uid'), 'internalDebts/debt-1/settlements', 'hack'), { debtorStoreId: 'store-A', creditorStoreId: 'store-B', amount: 1 })) })
})
