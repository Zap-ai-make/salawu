/**
 * TC-101 — Config Boutique × Réseau (setStoreNetworkConfigHandler).
 *   Handler integration avec Firestore Emulator, { db, FieldValue } injectés.
 *
 * Comportement protégé :
 *   - Gérant global écrit la config → document remplacé + audit (ancien/nouveau) ;
 *   - un 2e set conserve l'ancienne carte dans previousNetworks ;
 *   - gardes de rôle (non-gérant), boutique inexistante, profil absent → AUCUNE écriture.
 *
 * Exécution : npm run test:functions (émulateur Firestore, projet demo-akayis-test).
 */

import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest'
import { initializeApp, getApps, deleteApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { setStoreNetworkConfigHandler } from '../../functions/src/storeNetworkConfig/setStoreNetworkConfig.js'

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

const MGR_UID = 'system-mgr-uid'
const DEALER_UID = 'dealer-uid'
const STORE_ID = 'store-A'

const seedUser = (uid, data) => db.doc(`users/${uid}`).set(data)
const seedStore = (id, data) => db.doc(`stores/${id}`).set(data)
const makeRequest = (uid, data) => ({ auth: uid ? { uid, token: {} } : null, data: data ?? {} })

const NETWORKS_A = {
  Moov: { operates: true, supplyMode: 'dealer', isSupplied: true, isProvider: false },
  Orange: { operates: true, supplyMode: 'external_partner', isSupplied: false, isProvider: true },
}
const NETWORKS_B = {
  Telecel: { operates: true, supplyMode: 'dealer', isSupplied: true, isProvider: false },
}

async function expectError(promise, code) {
  await expect(promise).rejects.toMatchObject({ code })
}

async function seedMgrAndStore() {
  await seedUser(MGR_UID, { role: 'system_manager', active: true, email: 'm@t.test', name: 'Mgr' })
  await seedStore(STORE_ID, { name: 'Boutique A', active: true, adminUid: 'admin-a-uid' })
}

describe('TC-101 — setStoreNetworkConfig', () => {
  it('[NC-01] succès : config écrite + audit (previousNetworks null au 1er set)', async () => {
    await seedMgrAndStore()

    const res = await setStoreNetworkConfigHandler(
      makeRequest(MGR_UID, { storeId: STORE_ID, networks: NETWORKS_A }), { db, FieldValue },
    )
    expect(res).toMatchObject({ success: true, storeId: STORE_ID })

    const cfg = (await db.doc(`storeNetworkConfig/${STORE_ID}`).get()).data()
    expect(cfg.networks).toEqual(NETWORKS_A)
    expect(cfg.storeName).toBe('Boutique A')
    expect(cfg.updatedBy).toBe(MGR_UID)

    const audit = await db.collection('storeNetworkConfigAuditLogs').get()
    expect(audit.size).toBe(1)
    expect(audit.docs[0].data()).toMatchObject({
      action: 'STORE_NETWORK_CONFIG_SET', actorUid: MGR_UID, storeId: STORE_ID,
      previousNetworks: null, newNetworks: NETWORKS_A,
    })
  })

  it('[NC-02] 2e set : remplace la carte et conserve l’ancienne dans previousNetworks', async () => {
    await seedMgrAndStore()
    await setStoreNetworkConfigHandler(makeRequest(MGR_UID, { storeId: STORE_ID, networks: NETWORKS_A }), { db, FieldValue })
    await setStoreNetworkConfigHandler(makeRequest(MGR_UID, { storeId: STORE_ID, networks: NETWORKS_B }), { db, FieldValue })

    const cfg = (await db.doc(`storeNetworkConfig/${STORE_ID}`).get()).data()
    expect(cfg.networks).toEqual(NETWORKS_B) // remplacement intégral (Moov/Orange partis)

    const audits = (await db.collection('storeNetworkConfigAuditLogs').get()).docs.map(d => d.data())
    const last = audits.find(a => JSON.stringify(a.newNetworks) === JSON.stringify(NETWORKS_B))
    expect(last.previousNetworks).toEqual(NETWORKS_A)
  })

  it('[NC-03] non-gérant (dealer) → ROLE_FORBIDDEN, aucune écriture', async () => {
    await seedMgrAndStore()
    await seedUser(DEALER_UID, { role: 'dealer', active: true, email: 'd@t.test', name: 'Dealer' })
    await expectError(
      setStoreNetworkConfigHandler(makeRequest(DEALER_UID, { storeId: STORE_ID, networks: NETWORKS_A }), { db, FieldValue }),
      'ROLE_FORBIDDEN',
    )
    expect((await db.doc(`storeNetworkConfig/${STORE_ID}`).get()).exists).toBe(false)
    expect((await db.collection('storeNetworkConfigAuditLogs').get()).size).toBe(0)
  })

  it('[NC-04] boutique inexistante → STORE_NOT_FOUND, aucune écriture', async () => {
    await seedUser(MGR_UID, { role: 'system_manager', active: true, email: 'm@t.test', name: 'Mgr' })
    await expectError(
      setStoreNetworkConfigHandler(makeRequest(MGR_UID, { storeId: 'ghost', networks: NETWORKS_A }), { db, FieldValue }),
      'STORE_NOT_FOUND',
    )
    expect((await db.collection('storeNetworkConfigAuditLogs').get()).size).toBe(0)
  })

  it('[NC-05] profil acteur absent → PROFILE_NOT_FOUND', async () => {
    await seedStore(STORE_ID, { name: 'Boutique A', active: true, adminUid: 'admin-a-uid' })
    await expectError(
      setStoreNetworkConfigHandler(makeRequest('unknown-uid', { storeId: STORE_ID, networks: NETWORKS_A }), { db, FieldValue }),
      'PROFILE_NOT_FOUND',
    )
  })

  it('[NC-06] réseau inconnu dans la carte → INVALID_NETWORK_CONFIG', async () => {
    await seedMgrAndStore()
    await expectError(
      setStoreNetworkConfigHandler(makeRequest(MGR_UID, { storeId: STORE_ID, networks: { Mtn: NETWORKS_A.Moov } }), { db, FieldValue }),
      'INVALID_NETWORK_CONFIG',
    )
  })
})
