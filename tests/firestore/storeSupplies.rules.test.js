/**
 * Règles Firestore — storeSupplies (registre des ravitaillements).
 *
 * CE QUE CE FICHIER PROTÈGE
 * ─────────────────────────────────────────────────────────────────────────────
 * Le registre n'a de valeur que s'il est INFALSIFIABLE depuis le client. Les
 * Cloud Functions écrivent avec le SDK Admin, qui ignore ces règles ; tout le
 * reste doit se heurter à un mur :
 *
 *   • personne ne fabrique une ligne de ravitaillement (create) ;
 *   • personne ne réécrit un montant déjà consigné (update) ;
 *   • personne n'efface une ligne gênante (delete) — c'est la moitié technique
 *     de la promesse « supprimable à l'écran, jamais supprimé en base ».
 *
 * Et la lecture est cloisonnée : une boutique ne voit QUE ses ravitaillements.
 * Deux boutiques sont montées pour que le cloisonnement soit prouvé et non
 * supposé (CLAUDE.md : « Tester les règles avec au moins deux boutiques »).
 *
 * Projet exclusif : demo-akayis-test. Aucun accès production.
 */

import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, orderBy, getDocs } from 'firebase/firestore'
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

/**
 * Le CONTEXTE n'est pas une base : `getAuthenticatedContext` renvoie un contexte
 * de regles, dont `.firestore()` tire l'instance. L'oublier ne produit pas un
 * refus de regle mais un `Expected first argument to collection() to be a
 * CollectionReference` — un rouge qui accuse le harnais en ayant l'air d'accuser
 * les regles. Meme raccourci que storeDealerTransfers.rules.test.js l. 72.
 */
const fs = (uid) => getAuthenticatedContext(testEnv, uid).firestore()
const fsAnon = () => getUnauthenticatedContext(testEnv).firestore()

const ravitaillement = (overrides = {}) => ({
  storeId: 'store-A',
  storeName: 'Boutique A',
  createdByUid: 'store-admin-a-uid',
  createdByName: 'Admin A',
  createdByEmail: 'aa@test.test',
  network: 'Orange',
  resource: 'stock',
  amount: 20000,
  originalAmount: 20000,
  note: null,
  status: 'active',
  previousBalance: 50000,
  newBalance: 70000,
  correctionCount: 0,
  ...overrides,
})

async function seedAll() {
  await seedDocument(testEnv, 'stores', 'store-A', { name: 'Boutique A', active: true, adminUid: 'store-admin-a-uid' })
  await seedDocument(testEnv, 'stores', 'store-B', { name: 'Boutique B', active: true, adminUid: 'store-admin-b-uid' })
  await seedDocument(testEnv, 'users', 'store-admin-a-uid', { role: 'store_admin', active: true, storeId: 'store-A', storeName: 'Boutique A', email: 'aa@test.test', name: 'Admin A' })
  await seedDocument(testEnv, 'users', 'store-admin-b-uid', { role: 'store_admin', active: true, storeId: 'store-B', storeName: 'Boutique B', email: 'ab@test.test', name: 'Admin B' })
  await seedDocument(testEnv, 'users', 'system-mgr-uid', { role: 'system_manager', active: true, email: 'm@test.test', name: 'Mgr' })
  await seedDocument(testEnv, 'users', 'dealer-a-uid', { role: 'dealer', active: true, email: 'da@test.test', name: 'Dealer A' })

  await seedDocument(testEnv, 'storeSupplies', 'sup-a', ravitaillement())
  await seedDocument(testEnv, 'storeSupplies', 'sup-b', ravitaillement({ storeId: 'store-B', storeName: 'Boutique B', createdByUid: 'store-admin-b-uid' }))
}

beforeEach(seedAll)

describe('storeSupplies — lecture cloisonnée par boutique', () => {
  it('la boutique A lit son propre ravitaillement', async () => {
    const db = fs('store-admin-a-uid')
    await assertSucceeds(getDoc(doc(db, 'storeSupplies/sup-a')))
  })

  it('la boutique A NE lit PAS celui de la boutique B', async () => {
    // Le cœur du cloisonnement : deux boutiques réelles, pas une hypothèse.
    const db = fs('store-admin-a-uid')
    await assertFails(getDoc(doc(db, 'storeSupplies/sup-b')))
  })

  it('la boutique B NE lit PAS celui de la boutique A', async () => {
    const db = fs('store-admin-b-uid')
    await assertFails(getDoc(doc(db, 'storeSupplies/sup-a')))
  })

  it('le gérant lit les deux', async () => {
    const db = fs('system-mgr-uid')
    await assertSucceeds(getDoc(doc(db, 'storeSupplies/sup-a')))
    await assertSucceeds(getDoc(doc(db, 'storeSupplies/sup-b')))
  })

  it('le dealer ne lit aucun ravitaillement : ce circuit ne le concerne pas', async () => {
    // Un ravitaillement est de l'argent qui entre SANS passer par le dealer.
    // Lui donner la vue dessus lui apprendrait ce que la boutique fait hors
    // de son circuit, ce qu'aucune règle métier ne demande.
    const db = fs('dealer-a-uid')
    await assertFails(getDoc(doc(db, 'storeSupplies/sup-a')))
  })

  it('un visiteur non authentifié ne lit rien', async () => {
    const db = fsAnon()
    await assertFails(getDoc(doc(db, 'storeSupplies/sup-a')))
  })
})

describe('storeSupplies — la requête de l’historique', () => {
  it('passe quand elle est CONTRAINTE par storeId', async () => {
    // ⚠ CE CAS EXISTE À CAUSE D'UN BUG DÉJÀ PAYÉ (« Dettes internes qui saute »).
    // La règle lit `resource.data.storeId` : une requête LIST non contrainte
    // échoue EN BLOC, pas document par document. C'est la forme exacte que
    // l'écran d'historique doit employer.
    const db = fs('store-admin-a-uid')
    const q = query(
      collection(db, 'storeSupplies'),
      where('storeId', '==', 'store-A'),
      orderBy('createdAt', 'desc'),
    )
    await assertSucceeds(getDocs(q))
  })

  it('échoue quand elle n’est PAS contrainte — et c’est la protection, pas un défaut', async () => {
    const db = fs('store-admin-a-uid')
    await assertFails(getDocs(query(collection(db, 'storeSupplies'))))
  })

  it('échoue quand elle vise la boutique voisine', async () => {
    const db = fs('store-admin-a-uid')
    const q = query(collection(db, 'storeSupplies'), where('storeId', '==', 'store-B'))
    await assertFails(getDocs(q))
  })
})

describe('storeSupplies — aucune écriture client, jamais', () => {
  it('personne ne FABRIQUE une ligne de registre', async () => {
    const db = fs('store-admin-a-uid')
    await assertFails(setDoc(doc(db, 'storeSupplies/forge'), ravitaillement()))
  })

  it('personne ne RÉÉCRIT un montant consigné', async () => {
    // Sans ce mur, corriger « à la main » laisserait le solde en place et le
    // registre mentir — exactement la divergence que ce chantier ferme.
    const db = fs('store-admin-a-uid')
    await assertFails(updateDoc(doc(db, 'storeSupplies/sup-a'), { amount: 999999 }))
  })

  it('personne n’EFFACE une ligne : « supprimable » est un statut, pas un delete', async () => {
    const db = fs('store-admin-a-uid')
    await assertFails(deleteDoc(doc(db, 'storeSupplies/sup-a')))
  })

  it('le gérant non plus : il lit tout, il n’écrit rien', async () => {
    const db = fs('system-mgr-uid')
    await assertFails(updateDoc(doc(db, 'storeSupplies/sup-a'), { amount: 1 }))
    await assertFails(deleteDoc(doc(db, 'storeSupplies/sup-a')))
  })
})
