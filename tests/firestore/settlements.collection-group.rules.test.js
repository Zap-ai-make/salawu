/**
 * TC-117 — Règles Firestore : requête collection-group sur `settlements`.
 *
 * Alimente le badge « Dettes internes » (tranches en attente de MA confirmation).
 * Le match imbriqué sous internalDebts ne couvre PAS les requêtes de groupe, d'où
 * un bloc à joker `match /{path=**}/settlements/{id}`.
 *
 * Le risque du lot est la COLLISION DE NOM : le moteur de transactions a lui aussi
 * des sous-collections `settlements` (clients/{storeId}/drafts/{id}/settlements et
 * .../history/{id}/settlements), que le joker traverse. L'assertion centrale de ce
 * fichier est donc que la nouvelle règle ne les expose PAS.
 *
 * Testé avec 3 boutiques. Projet exclusif : demo-akayis-test.
 */

import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { collectionGroup, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
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

  // Dette : store-A débitrice → store-B créancière, avec une tranche déclarée.
  await seedDocument(testEnv, 'internalDebts', 'debt-1', {
    collaborationId: 'col-1', debtorStoreId: 'store-A', debtorStoreName: 'A',
    creditorStoreId: 'store-B', creditorStoreName: 'B', network: 'Orange', operationType: 'deposit',
    originalAmount: 20000, settledAmount: 0, remainingAmount: 20000, status: 'open',
  })
  await seedDocument(testEnv, 'internalDebts/debt-1/settlements', 'set-1', {
    debtorStoreId: 'store-A', creditorStoreId: 'store-B', amount: 5000, method: 'especes', settlementStatus: 'declared',
  })

  // Règlement du MOTEUR DE TRANSACTIONS : même nom de collection, pas de
  // creditorStoreId. C'est le document qui ne doit jamais fuir par le joker.
  await seedDocument(testEnv, 'clients/store-A/drafts', 'draft-1', {
    storeId: 'store-A', montant: 1000, statut: 'en_attente',
  })
  await seedDocument(testEnv, 'clients/store-A/drafts/draft-1/settlements', 'pay-1', {
    draftId: 'draft-1', storeId: 'store-A', amount: 1000,
  })
}

const fs = (uid) => getAuthenticatedContext(testEnv, uid).firestore()

const toConfirm = (db, storeId) => query(
  collectionGroup(db, 'settlements'),
  where('creditorStoreId', '==', storeId),
  where('settlementStatus', '==', 'declared'),
)

describe('settlements (collection-group) — compteur des tranches à confirmer', () => {
  it('la créancière interroge ses tranches → allow', async () => {
    await seedAll()
    await assertSucceeds(getDocs(toConfirm(fs('admin-b-uid'), 'store-B')))
  })

  it('une boutique tierce n\'obtient rien pour elle-même → allow mais vide', async () => {
    await seedAll()
    const snap = await assertSucceeds(getDocs(toConfirm(fs('admin-c-uid'), 'store-C')))
    if (snap.size !== 0) throw new Error(`store-C ne devrait rien voir, reçu ${snap.size}`)
  })

  it('une boutique ne peut pas interroger les tranches d\'une autre → deny', async () => {
    await seedAll()
    await assertFails(getDocs(toConfirm(fs('admin-c-uid'), 'store-B')))
    await assertFails(getDocs(toConfirm(fs('admin-a-uid'), 'store-B')))
  })

  it('non authentifié → deny', async () => {
    await seedAll()
    await assertFails(getDocs(toConfirm(getUnauthenticatedContext(testEnv).firestore(), 'store-B')))
  })

  it('une requête de groupe sans filtre créancier → deny', async () => {
    await seedAll()
    await assertFails(getDocs(collectionGroup(fs('admin-b-uid'), 'settlements')))
  })
})

describe('settlements (collection-group) — le moteur de transactions reste cloisonné', () => {
  it('le joker n\'expose pas les règlements de drafts à une autre boutique', async () => {
    await seedAll()
    await assertFails(getDoc(doc(fs('admin-b-uid'), 'clients/store-A/drafts/draft-1/settlements', 'pay-1')))
  })

  it('la boutique propriétaire garde l\'accès à ses propres règlements de drafts', async () => {
    await seedAll()
    await assertSucceeds(getDoc(doc(fs('admin-a-uid'), 'clients/store-A/drafts/draft-1/settlements', 'pay-1')))
  })

  it('la requête du badge ne remonte jamais un règlement du moteur', async () => {
    await seedAll()
    const snap = await assertSucceeds(getDocs(toConfirm(fs('admin-b-uid'), 'store-B')))
    for (const d of snap.docs) {
      if (d.ref.path.includes('/drafts/') || d.ref.path.includes('/history/')) {
        throw new Error(`Document du moteur de transactions remonté : ${d.ref.path}`)
      }
    }
  })
})

describe('settlements (collection-group) — écriture', () => {
  it('écriture directe refusée', async () => {
    await seedAll()
    const { setDoc, doc: docRef } = await import('firebase/firestore')
    await assertFails(setDoc(docRef(fs('admin-b-uid'), 'internalDebts/debt-1/settlements', 'hack'), {
      debtorStoreId: 'store-A', creditorStoreId: 'store-B', amount: 1, settlementStatus: 'declared',
    }))
  })
})
