/**
 * TC-112 — Annuaire des fournisseurs de collaboration (listStoreCollaborationProviders).
 *   Handler integration Firestore Emulator, { db } injecté.
 *
 * Renvoie les boutiques isProvider sur un réseau (hors soi-même). Réservé store_admin.
 *
 * Exécution : npm run test:functions (émulateur, projet demo-akayis-test).
 */

import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest'
import { initializeApp, getApps, deleteApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { listStoreCollaborationProvidersHandler } from '../../functions/src/collaborations/listStoreCollaborationProviders.js'

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

const req = (uid, data) => ({ auth: uid ? { uid, token: {} } : null, data: data ?? {} })
async function expectError(promise, code) { await expect(promise).rejects.toMatchObject({ code }) }

async function seed() {
  await db.doc('users/admin-a-uid').set({ role: 'store_admin', active: true, storeId: 'store-A', storeName: 'A', email: 'a@t.test', name: 'A' })
  await db.doc('users/dealer-uid').set({ role: 'dealer', active: true, email: 'd@t.test', name: 'D' })
  // store-A est fournisseur Orange (doit être EXCLU : c'est le demandeur)
  await db.doc('storeNetworkConfig/store-A').set({ storeName: 'A', networks: { Orange: { operates: true, supplyMode: 'external_partner', isSupplied: false, isProvider: true } } })
  // store-B fournisseur Orange (inclus)
  await db.doc('storeNetworkConfig/store-B').set({ storeName: 'Boutique B', networks: { Orange: { operates: true, supplyMode: 'external_partner', isSupplied: false, isProvider: true } } })
  // store-C non fournisseur Orange (exclu)
  await db.doc('storeNetworkConfig/store-C').set({ storeName: 'C', networks: { Orange: { operates: true, supplyMode: 'dealer', isSupplied: true, isProvider: false } } })
}

describe('TC-112 — listStoreCollaborationProviders', () => {
  it('[LP-01] renvoie les fournisseurs du réseau, hors soi-même et hors non-fournisseurs', async () => {
    await seed()
    const res = await listStoreCollaborationProvidersHandler(req('admin-a-uid', { network: 'Orange' }), { db })
    expect(res.success).toBe(true)
    expect(res.providers).toEqual([{ storeId: 'store-B', storeName: 'Boutique B' }])
  })

  it('[LP-02] réseau invalide → INVALID_COLLABORATION_NETWORK', async () => {
    await seed()
    await expectError(listStoreCollaborationProvidersHandler(req('admin-a-uid', { network: 'Mtn' }), { db }), 'INVALID_COLLABORATION_NETWORK')
  })

  it('[LP-03] acteur non store_admin → ROLE_FORBIDDEN', async () => {
    await seed()
    await expectError(listStoreCollaborationProvidersHandler(req('dealer-uid', { network: 'Orange' }), { db }), 'ROLE_FORBIDDEN')
  })
})
