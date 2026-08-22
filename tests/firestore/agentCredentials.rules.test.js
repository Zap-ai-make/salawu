/**
 * TC-145 — Règles Firestore agentCredentials (namespace réservé app mobile)
 *
 * Comportement protégé (Lot 1 « préparer la synchro reçus agents ») :
 *   agentCredentials/{clientId} contiendra le PIN haché + l'état anti-bruteforce de
 *   l'agent. Il est RÉSERVÉ à l'Admin SDK (Cloud Functions) : AUCUN acteur client ne
 *   doit pouvoir le lire ni l'écrire — pas même l'agent, pas même le gérant de la
 *   boutique. La règle est `allow read, write: if false`. Ce test verrouille ce refus
 *   total pour tous les rôles existants + non authentifié.
 */

import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertFails,
  getAuthenticatedContext,
  getUnauthenticatedContext,
  seedDocument,
} from './helpers.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rulesPath = resolve(__dirname, '../../firestore.rules')
const rules = readFileSync(rulesPath, 'utf-8')

let testEnv

beforeAll(async () => {
  const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || ''
  if (projectId !== 'demo-akayis-test') {
    throw new Error(`SÉCURITÉ : projectId doit être exactement "demo-akayis-test". Reçu : "${projectId}"`)
  }
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-akayis-test',
    firestore: { rules, host: '127.0.0.1', port: 8080 },
  })
})

afterAll(async () => {
  if (testEnv) await testEnv.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

/**
 * Seeds : un compte par rôle existant + un doc credential (posé hors règles).
 *   - uid-member-aaa  : membre boutique A
 *   - uid-admin-aaa   : gérant (store_admin) boutique A — propriétaire de la fiche
 *   - uid-dealer      : dealer global
 *   - uid-sysmgr      : system_manager
 *   - agentCredentials/gclient-aaa : credential réservé
 */
async function seedAll() {
  await seedDocument(testEnv, 'users', 'uid-member-aaa', { active: true, storeId: 'store-test-aaa', role: 'member' })
  await seedDocument(testEnv, 'users', 'uid-admin-aaa', { active: true, storeId: 'store-test-aaa', role: 'store_admin' })
  await seedDocument(testEnv, 'users', 'uid-dealer', { active: true, role: 'dealer' })
  await seedDocument(testEnv, 'users', 'uid-sysmgr', { active: true, role: 'system_manager' })
  await seedDocument(testEnv, 'agentCredentials', 'gclient-aaa', {
    clientId: 'gclient-aaa',
    storeId: 'store-test-aaa',
    phoneNormalized: '22670001234',
    pinHash: 'x'.repeat(64),
    active: true,
  })
}

const ROLES = ['uid-member-aaa', 'uid-admin-aaa', 'uid-dealer', 'uid-sysmgr']

describe('TC-145 — agentCredentials : lecture refusée à tous', () => {
  for (const uid of ROLES) {
    it(`${uid} — get agentCredentials/gclient-aaa — deny`, async () => {
      await seedAll()
      const ctx = getAuthenticatedContext(testEnv, uid)
      await assertFails(getDoc(doc(ctx.firestore(), 'agentCredentials', 'gclient-aaa')))
    })
  }

  it('non authentifié — get agentCredentials/gclient-aaa — deny', async () => {
    await seedAll()
    const ctx = getUnauthenticatedContext(testEnv)
    await assertFails(getDoc(doc(ctx.firestore(), 'agentCredentials', 'gclient-aaa')))
  })
})

describe('TC-145 — agentCredentials : écriture refusée à tous', () => {
  for (const uid of ROLES) {
    it(`${uid} — create agentCredentials/gclient-new — deny`, async () => {
      await seedAll()
      const ctx = getAuthenticatedContext(testEnv, uid)
      await assertFails(setDoc(doc(ctx.firestore(), 'agentCredentials', 'gclient-new'), {
        clientId: 'gclient-new', storeId: 'store-test-aaa', pinHash: 'y'.repeat(64), active: true,
      }))
    })

    it(`${uid} — update agentCredentials/gclient-aaa — deny`, async () => {
      await seedAll()
      const ctx = getAuthenticatedContext(testEnv, uid)
      await assertFails(updateDoc(doc(ctx.firestore(), 'agentCredentials', 'gclient-aaa'), { active: false }))
    })

    it(`${uid} — delete agentCredentials/gclient-aaa — deny`, async () => {
      await seedAll()
      const ctx = getAuthenticatedContext(testEnv, uid)
      await assertFails(deleteDoc(doc(ctx.firestore(), 'agentCredentials', 'gclient-aaa')))
    })
  }

  it('non authentifié — create agentCredentials/gclient-new — deny', async () => {
    await seedAll()
    const ctx = getUnauthenticatedContext(testEnv)
    await assertFails(setDoc(doc(ctx.firestore(), 'agentCredentials', 'gclient-new'), {
      clientId: 'gclient-new', pinHash: 'z'.repeat(64),
    }))
  })
})
