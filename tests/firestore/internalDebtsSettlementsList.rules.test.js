/**
 * TC-130 — Caractérisation : REQUÊTE LIST des tranches d'une dette interne.
 *
 * `subscribeDebtSettlements` (front) fait une requête LIST
 *   collection('internalDebts/{debtId}/settlements') + orderBy('declaredAt','desc')
 * SANS clause `where`. Les tests existants (internalDebts.rules.test.js) ne couvrent
 * QUE des lectures `getDoc` d'un seul document. Or « les règles ne sont pas des
 * filtres » : une requête LIST dont la règle dépend de `resource.data` (ici
 * debtorStoreId / creditorStoreId, champs PAR-DOCUMENT) doit être contrainte par un
 * `where` correspondant, sinon Firestore refuse toute la requête → permission-denied.
 *
 * Ce test caractérise le comportement ACTUEL de la règle sur la requête LIST réelle
 * du front (débitrice ET créancière), pour la page « Dettes internes ».
 *
 * Projet exclusif : demo-akayis-test (émulateur).
 */

import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, query, orderBy, getDocs } from 'firebase/firestore'
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
  // Tranche AVEC declaredAt (l'orderBy('declaredAt') n'inclut que les docs qui ont ce champ).
  await seedDocument(testEnv, 'internalDebts/debt-1/settlements', 'set-1', {
    debtId: 'debt-1', debtorStoreId: 'store-A', creditorStoreId: 'store-B',
    amount: 5000, method: 'Orange Money', settlementStatus: 'declared',
    declaredAt: '2026-08-11T17:03:00.000Z',
  })
}

const fs = (uid) => getAuthenticatedContext(testEnv, uid).firestore()

// Requête LIST identique à subscribeDebtSettlements (collaborationService.js).
const settlementsListQuery = (firestore) =>
  query(collection(firestore, 'internalDebts/debt-1/settlements'), orderBy('declaredAt', 'desc'))

describe('TC-130 — requête LIST des tranches (page Dettes internes)', () => {
  it('débitrice LIST ses tranches → doit être autorisé', async () => {
    await seedAll()
    await assertSucceeds(getDocs(settlementsListQuery(fs('admin-a-uid'))))
  })

  it('créancière LIST les tranches → doit être autorisé', async () => {
    await seedAll()
    await assertSucceeds(getDocs(settlementsListQuery(fs('admin-b-uid'))))
  })

  it('boutique tierce LIST → refusé', async () => {
    await seedAll()
    await assertFails(getDocs(settlementsListQuery(fs('admin-c-uid'))))
  })

  it('non authentifié LIST → refusé', async () => {
    await seedAll()
    await assertFails(getDocs(settlementsListQuery(getUnauthenticatedContext(testEnv).firestore())))
  })
})
