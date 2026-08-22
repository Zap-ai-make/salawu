/**
 * TC-150 — Règles Firestore : lecture des reçus/fiche par l'AGENT (app mobile, Lot 4).
 *
 * Surface de sécurité NOUVELLE. Comportement protégé (app mobile ACTIVÉE) :
 *   - l'agent lit SA fiche (globalClients GET par id = uid) et SES reçus
 *     (history LIST contrainte par clientId == uid, dans SA boutique) ;
 *   - il ne lit NI la fiche d'un autre, NI les reçus d'un autre, NI une autre boutique,
 *     NI une LIST history non contrainte (piège LIST → fail-safe), NI les drafts,
 *     NI les settlements, NI agentCredentials ;
 *   - membres boutique / system_manager : lecture inchangée (non-régression).
 * App mobile DÉSACTIVÉE (mobileAppEnabled=false) : toute lecture agent est refusée.
 *
 * On teste les DEUX profils en réécrivant mobileAppEnabled() dans les règles committées
 * (baseline TAOFIC = false), pour ne pas dépendre du client déployé.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertSucceeds, assertFails, seedDocument } from './helpers.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rulesRaw = readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf-8')

/** Règles committées avec mobileAppEnabled() forcé à `enabled` (simule salawu / TAOFIC). */
function rulesWith(enabled) {
  const out = rulesRaw.replace(
    /function mobileAppEnabled\(\) \{ return (true|false); \}/,
    `function mobileAppEnabled() { return ${enabled}; }`,
  )
  // Garde-fou : si le motif committé change, on ne veut pas tester silencieusement le mauvais profil.
  if (!out.includes(`function mobileAppEnabled() { return ${enabled}; }`)) {
    throw new Error('Motif mobileAppEnabled() introuvable dans firestore.rules — adapter le test.')
  }
  return out
}

const AGENT_A = 'cli-agent-a'   // agent (= client) de la boutique A ; uid du jeton = cet id
const AGENT_CLAIMS = { role: 'agent', clientId: AGENT_A, storeId: 'store-A' }

function agentCtx(testEnv) {
  return testEnv.authenticatedContext(AGENT_A, AGENT_CLAIMS)
}

async function seedAll(testEnv) {
  await seedDocument(testEnv, 'users', 'uid-member-a', { active: true, storeId: 'store-A', role: 'member' })
  await seedDocument(testEnv, 'globalClients', AGENT_A, { nom: 'Sana', prenom: 'Ali', registeredStoreId: 'store-A' })
  await seedDocument(testEnv, 'globalClients', 'cli-other-a', { nom: 'Autre', prenom: 'Agent', registeredStoreId: 'store-A' })
  // Reçus boutique A : un à l'agent A, un à un autre agent de A.
  await seedDocument(testEnv, 'clients/store-A/history', 'h-a1', { clientId: AGENT_A, storeId: 'store-A', montant: 1000, type: 'Dépôt', createdAt: new Date('2026-08-01') })
  await seedDocument(testEnv, 'clients/store-A/history', 'h-a2', { clientId: 'cli-other-a', storeId: 'store-A', montant: 2000, type: 'Dépôt', createdAt: new Date('2026-08-02') })
  // Reçu boutique B portant clientId = AGENT_A (ne doit PAS être lisible : autre boutique).
  await seedDocument(testEnv, 'clients/store-B/history', 'h-b1', { clientId: AGENT_A, storeId: 'store-B', montant: 3000, type: 'Dépôt', createdAt: new Date('2026-08-03') })
  await seedDocument(testEnv, 'clients/store-A/drafts', 'd-a1', { clientId: AGENT_A, storeId: 'store-A', montant: 500, statut: 'Non Terminées' })
  await seedDocument(testEnv, 'clients/store-A/history/h-a1/settlements', 's1', { amount: 1000 })
  await seedDocument(testEnv, 'agentCredentials', AGENT_A, { clientId: AGENT_A, storeId: 'store-A', codeHash: 'x', loginIdentifiers: ['70112233'] })
}

describe('TC-150 — app mobile ACTIVÉE : l\'agent lit seulement le sien', () => {
  let testEnv
  beforeAll(async () => {
    if (process.env.GCLOUD_PROJECT !== 'demo-akayis-test') throw new Error('SÉCURITÉ : projectId doit être "demo-akayis-test".')
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-akayis-test',
      firestore: { rules: rulesWith(true), host: '127.0.0.1', port: 8080 },
    })
  })
  afterAll(async () => { if (testEnv) await testEnv.cleanup() })
  beforeEach(async () => { await testEnv.clearFirestore(); await seedAll(testEnv) })

  it('[AR-01] lit SA fiche (globalClients GET) — allow', async () => {
    await assertSucceeds(getDoc(doc(agentCtx(testEnv).firestore(), 'globalClients', AGENT_A)))
  })

  it('[AR-02] ne lit PAS la fiche d\'un autre agent — deny', async () => {
    await assertFails(getDoc(doc(agentCtx(testEnv).firestore(), 'globalClients', 'cli-other-a')))
  })

  it('[AR-03] liste SES reçus (history where clientId==uid) — allow, seulement les siens', async () => {
    const fs = agentCtx(testEnv).firestore()
    const snap = await assertSucceeds(getDocs(query(collection(fs, 'clients/store-A/history'), where('clientId', '==', AGENT_A))))
    expect(snap.docs.map(d => d.id)).toEqual(['h-a1'])
  })

  it('[AR-04] LIST history NON contrainte par clientId — deny (piège LIST / fail-safe)', async () => {
    await assertFails(getDocs(collection(agentCtx(testEnv).firestore(), 'clients/store-A/history')))
  })

  it('[AR-05] GET le reçu d\'un autre agent (même boutique) — deny', async () => {
    await assertFails(getDoc(doc(agentCtx(testEnv).firestore(), 'clients/store-A/history', 'h-a2')))
  })

  it('[AR-06] reçus d\'une AUTRE boutique (token.storeId != path) — deny', async () => {
    const fs = agentCtx(testEnv).firestore()
    await assertFails(getDocs(query(collection(fs, 'clients/store-B/history'), where('clientId', '==', AGENT_A))))
  })

  it('[AR-07] drafts / settlements / agentCredentials — deny', async () => {
    const fs = agentCtx(testEnv).firestore()
    await assertFails(getDocs(query(collection(fs, 'clients/store-A/drafts'), where('clientId', '==', AGENT_A))))
    await assertFails(getDoc(doc(fs, 'clients/store-A/history/h-a1/settlements', 's1')))
    await assertFails(getDoc(doc(fs, 'agentCredentials', AGENT_A)))
  })

  it('[AR-08] non-régression : un membre boutique lit tout l\'historique de SA boutique', async () => {
    const fs = testEnv.authenticatedContext('uid-member-a').firestore()
    const snap = await assertSucceeds(getDocs(collection(fs, 'clients/store-A/history')))
    expect(snap.size).toBe(2)
    await assertSucceeds(getDoc(doc(fs, 'globalClients', AGENT_A)))
  })
})

describe('TC-150 — app mobile DÉSACTIVÉE : toute lecture agent refusée', () => {
  let testEnv
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-akayis-test',
      firestore: { rules: rulesWith(false), host: '127.0.0.1', port: 8080 },
    })
  })
  afterAll(async () => { if (testEnv) await testEnv.cleanup() })
  beforeEach(async () => { await testEnv.clearFirestore(); await seedAll(testEnv) })

  it('[AR-09] fiche et reçus refusés à l\'agent quand mobileAppEnabled=false', async () => {
    const fs = agentCtx(testEnv).firestore()
    await assertFails(getDoc(doc(fs, 'globalClients', AGENT_A)))
    await assertFails(getDocs(query(collection(fs, 'clients/store-A/history'), where('clientId', '==', AGENT_A))))
  })
})
