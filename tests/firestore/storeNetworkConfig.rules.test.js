/**
 * Règles Firestore — storeNetworkConfig (+ storeNetworkConfigAuditLogs).
 *
 * Config Boutique × Réseau. Écriture EXCLUSIVEMENT via Cloud Function auditée
 * (adminSetStoreNetworkConfig, system_manager) → aucune écriture client autorisée.
 * Lecture cloisonnée :
 *   - storeNetworkConfig          : gérant (tout), boutique concernée, dealer (Vague 2).
 *   - storeNetworkConfigAuditLogs : gérant uniquement.
 *
 * Testé avec ≥ 2 boutiques (exigence CLAUDE.md). Projet exclusif : demo-akayis-test.
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
  await seedDocument(testEnv, 'stores', 'store-A', { name: 'Boutique A', active: true, adminUid: 'store-admin-a-uid' })
  await seedDocument(testEnv, 'stores', 'store-B', { name: 'Boutique B', active: true, adminUid: 'store-admin-b-uid' })
  await seedDocument(testEnv, 'users', 'dealer-a-uid', { role: 'dealer', active: true, email: 'da@test.test', name: 'Dealer A' })
  await seedDocument(testEnv, 'users', 'system-mgr-uid', { role: 'system_manager', active: true, email: 'm@test.test', name: 'Mgr' })
  await seedDocument(testEnv, 'users', 'store-admin-a-uid', { role: 'store_admin', active: true, storeId: 'store-A', storeName: 'Boutique A', email: 'aa@test.test', name: 'Admin A' })
  await seedDocument(testEnv, 'users', 'store-admin-b-uid', { role: 'store_admin', active: true, storeId: 'store-B', storeName: 'Boutique B', email: 'ab@test.test', name: 'Admin B' })

  const baseConfig = {
    storeId: 'store-A', storeName: 'Boutique A',
    networks: {
      Moov: { operates: true, supplyMode: 'dealer', isSupplied: true, isProvider: false },
      Orange: { operates: true, supplyMode: 'external_partner', isSupplied: false, isProvider: true },
    },
    updatedBy: 'system-mgr-uid',
  }
  await seedDocument(testEnv, 'storeNetworkConfig', 'store-A', baseConfig)
  await seedDocument(testEnv, 'storeNetworkConfig', 'store-B', { ...baseConfig, storeId: 'store-B', storeName: 'Boutique B' })

  await seedDocument(testEnv, 'storeNetworkConfigAuditLogs', 'log-1', {
    action: 'STORE_NETWORK_CONFIG_SET', actorUid: 'system-mgr-uid', storeId: 'store-A',
    previousNetworks: null, newNetworks: baseConfig.networks,
  })
}

const fs = (uid) => getAuthenticatedContext(testEnv, uid).firestore()

// ── storeNetworkConfig : lecture ─────────────────────────────────────────────
describe('storeNetworkConfig — lecture', () => {
  it('system_manager lit → allow', async () => {
    await seedAll()
    await assertSucceeds(getDoc(doc(fs('system-mgr-uid'), 'storeNetworkConfig', 'store-A')))
  })
  it('boutique concernée lit sa config → allow', async () => {
    await seedAll()
    await assertSucceeds(getDoc(doc(fs('store-admin-a-uid'), 'storeNetworkConfig', 'store-A')))
  })
  it('autre boutique → deny', async () => {
    await seedAll()
    await assertFails(getDoc(doc(fs('store-admin-b-uid'), 'storeNetworkConfig', 'store-A')))
  })
  it('dealer lit (préparation collaborations) → allow', async () => {
    await seedAll()
    await assertSucceeds(getDoc(doc(fs('dealer-a-uid'), 'storeNetworkConfig', 'store-A')))
  })
  it('non authentifié → deny', async () => {
    await seedAll()
    await assertFails(getDoc(doc(getUnauthenticatedContext(testEnv).firestore(), 'storeNetworkConfig', 'store-A')))
  })
})

// ── storeNetworkConfig : écritures refusées (CF only) ────────────────────────
describe('storeNetworkConfig — écritures refusées', () => {
  const payload = { storeId: 'store-A', storeName: 'Boutique A', networks: {}, updatedBy: 'x' }
  it('system_manager crée directement → deny (CF only)', async () => {
    await seedAll()
    await assertFails(setDoc(doc(fs('system-mgr-uid'), 'storeNetworkConfig', 'store-C'), payload))
  })
  it('system_manager update directement → deny (CF only)', async () => {
    await seedAll()
    await assertFails(updateDoc(doc(fs('system-mgr-uid'), 'storeNetworkConfig', 'store-A'), { updatedBy: 'hack' }))
  })
  it('boutique crée/écrit sa config → deny', async () => {
    await seedAll()
    await assertFails(setDoc(doc(fs('store-admin-a-uid'), 'storeNetworkConfig', 'store-A'), payload))
  })
  it('dealer écrit → deny', async () => {
    await seedAll()
    await assertFails(setDoc(doc(fs('dealer-a-uid'), 'storeNetworkConfig', 'store-A'), payload))
  })
  it('system_manager delete → deny', async () => {
    await seedAll()
    await assertFails(deleteDoc(doc(fs('system-mgr-uid'), 'storeNetworkConfig', 'store-A')))
  })
})

// ── storeNetworkConfigAuditLogs : lecture gérant seul, écriture refusée ───────
describe('storeNetworkConfigAuditLogs — lecture / écriture', () => {
  it('system_manager lit → allow', async () => {
    await seedAll()
    await assertSucceeds(getDoc(doc(fs('system-mgr-uid'), 'storeNetworkConfigAuditLogs', 'log-1')))
  })
  it('boutique → deny', async () => {
    await seedAll()
    await assertFails(getDoc(doc(fs('store-admin-a-uid'), 'storeNetworkConfigAuditLogs', 'log-1')))
  })
  it('dealer → deny', async () => {
    await seedAll()
    await assertFails(getDoc(doc(fs('dealer-a-uid'), 'storeNetworkConfigAuditLogs', 'log-1')))
  })
  it('system_manager écrit un auditLog → deny', async () => {
    await seedAll()
    await assertFails(setDoc(doc(fs('system-mgr-uid'), 'storeNetworkConfigAuditLogs', 'hack'), { action: 'x' }))
  })
})
