/**
 * TC-151 — Vérification END-TO-END du parcours agent (app mobile, Lot 5).
 *
 * C'est le TEST DE COUTURE : il enfile le VRAI code généré et les VRAIS claims émis
 * par les Cloud Functions dans les VRAIES règles Firestore salawu, sur un seul émulateur.
 *
 *   1. generateAgentAccessCode (gérant)  → code d'accès en clair (Admin SDK, contourne règles) ;
 *   2. agentSignIn(identifier, code)      → jeton personnalisé + claims {role,clientId,storeId} ;
 *   3. on rejoue EXACTEMENT ces claims dans un contexte règles (authenticatedContext) et on
 *      vérifie que l'agent lit SA fiche + SES reçus, et RIEN d'autre.
 *
 * Deux mondes, un émulateur :
 *   - Admin SDK (getAdminFirestore) : seed + exécution des handlers → contourne les règles ;
 *   - @firebase/rules-unit-testing  : lecture APPLIQUANT les règles salawu (mobileAppEnabled=true).
 *
 * On charge les règles committées (baseline TAOFIC) en forçant mobileAppEnabled()=true, pour
 * ne pas dépendre du client déployé et NE PAS muter l'arbre. MOBILE_APP (config functions) est
 * mockée activée, comme tc-147/tc-149.
 *
 * Exécution : npm run test:functions (émulateur Firestore, projet demo-akayis-test).
 */

import { describe, it, beforeAll, afterAll, beforeEach, expect, vi } from 'vitest'
import { initializeApp, getApps, deleteApp } from 'firebase-admin/app'
import { getFirestore as getAdminFirestore, FieldValue } from 'firebase-admin/firestore'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertSucceeds, assertFails } from '../firestore/helpers.js'

vi.mock('../../functions/src/config/mobileAppProfile.js', () => ({
  MOBILE_APP: { enabled: true, accessCodePrefix: 'ESAHAF' },
}))

import { MOBILE_APP } from '../../functions/src/config/mobileAppProfile.js'
import { generateAgentAccessCodeHandler } from '../../functions/src/agents/generateAgentAccessCode.js'
import { agentSignInHandler } from '../../functions/src/agents/agentSignIn.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rulesRaw = readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf-8')

/** Règles committées avec mobileAppEnabled() forcé à true (simule salawu). */
function salawuRules() {
  const out = rulesRaw.replace(
    /function mobileAppEnabled\(\) \{ return (true|false); \}/,
    'function mobileAppEnabled() { return true; }',
  )
  if (!out.includes('function mobileAppEnabled() { return true; }')) {
    throw new Error('Motif mobileAppEnabled() introuvable dans firestore.rules — adapter le test.')
  }
  return out
}

const PROJECT_ID = process.env.GCLOUD_PROJECT
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST

const STORE_A = 'store-A'
const ADMIN_A = 'admin-a-uid'
const AGENT_A = 'cli-agent-a'
const AGENT_B = 'cli-agent-b'

let adminApp
let db
let testEnv

beforeAll(async () => {
  if (!FIRESTORE_HOST) throw new Error('SÉCURITÉ : FIRESTORE_EMULATOR_HOST non défini. Lancer via : npm run test:functions')
  if (PROJECT_ID !== 'demo-akayis-test') throw new Error(`SÉCURITÉ : projectId doit être "demo-akayis-test". Reçu : "${PROJECT_ID}"`)
  adminApp = getApps().length === 0 ? initializeApp({ projectId: PROJECT_ID }) : getApps()[0]
  db = getAdminFirestore(adminApp)
  const [host, port] = FIRESTORE_HOST.split(':')
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: salawuRules(), host, port: Number(port) },
  })
})

afterAll(async () => {
  if (testEnv) await testEnv.cleanup()
  if (adminApp) await deleteApp(adminApp)
})

async function clearFirestoreEmulator() {
  const url = `http://${FIRESTORE_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`
  const res = await fetch(url, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Impossible de vider l'émulateur : HTTP ${res.status}`)
}

beforeEach(async () => {
  await clearFirestoreEmulator()
  MOBILE_APP.enabled = true
  // Gérant de la boutique A.
  await db.doc(`users/${ADMIN_A}`).set({ role: 'store_admin', active: true, storeId: STORE_A, storeName: 'Boutique A', email: 'a@t.test', name: 'Admin A' })
  // Agent A (numéro + code agent) et Agent B, tous deux enregistrés en boutique A.
  await db.doc(`globalClients/${AGENT_A}`).set({
    nom: 'NIKIEMA', prenom: 'Salif', registeredStoreId: STORE_A,
    numeroPersonnel: '70000000', orange: 'OR123', numerosAgent: { orange: '70 11 22 33' },
  })
  await db.doc(`globalClients/${AGENT_B}`).set({
    nom: 'TRAORE', prenom: 'Awa', registeredStoreId: STORE_A,
    numeroPersonnel: '71000000', orange: 'OR999', numerosAgent: { orange: '71 22 33 44' },
  })
  // Reçus finalisés : un à A, un à B.
  await db.doc(`clients/${STORE_A}/history/h-a1`).set({ clientId: AGENT_A, storeId: STORE_A, montant: 1000, type: 'Dépôt', createdAt: new Date('2026-08-01') })
  await db.doc(`clients/${STORE_A}/history/h-b1`).set({ clientId: AGENT_B, storeId: STORE_A, montant: 2000, type: 'Dépôt', createdAt: new Date('2026-08-02') })
})

const genReq = (uid, data) => ({ auth: uid ? { uid, token: {} } : null, data })
const signInReq = (data) => ({ auth: null, data })

/** Déroule generate → signIn pour un agent ; renvoie {uid, claims, code}. */
async function loginAgent(clientId, identifier) {
  const gen = await generateAgentAccessCodeHandler(genReq(ADMIN_A, { clientId }), { db, FieldValue })
  const mint = vi.fn(async (uid) => `tok-${uid}`)
  const res = await agentSignInHandler(signInReq({ identifier, code: gen.accessCode }), { db, FieldValue, createCustomToken: mint })
  expect(res).toMatchObject({ success: true })
  expect(mint).toHaveBeenCalledTimes(1)
  const [uid, claims] = mint.mock.calls[0]
  return { uid, claims, code: gen.accessCode }
}

describe('TC-151 — parcours agent bout-en-bout (login → lecture)', () => {
  it('[E2E-01] generate → signIn → l\'agent lit SA fiche et SES reçus', async () => {
    const { uid, claims } = await loginAgent(AGENT_A, '70 11 22 33')

    // Le jeton lie l'identité à SA fiche (uid=clientId) et porte les claims attendus.
    expect(uid).toBe(AGENT_A)
    expect(claims).toEqual({ role: 'agent', clientId: AGENT_A, storeId: STORE_A })

    // On rejoue EXACTEMENT ces claims dans les règles salawu.
    const fs = testEnv.authenticatedContext(uid, claims).firestore()
    await assertSucceeds(getDoc(doc(fs, 'globalClients', AGENT_A)))
    const snap = await assertSucceeds(
      getDocs(query(collection(fs, `clients/${STORE_A}/history`), where('clientId', '==', AGENT_A))),
    )
    expect(snap.docs.map((d) => d.id)).toEqual(['h-a1'])
  })

  it('[E2E-02] le même jeton ne lit NI la fiche d\'autrui, NI une LIST non contrainte, NI le reçu d\'autrui', async () => {
    const { uid, claims } = await loginAgent(AGENT_A, 'OR123') // login aussi via CODE agent

    const fs = testEnv.authenticatedContext(uid, claims).firestore()
    await assertFails(getDoc(doc(fs, 'globalClients', AGENT_B)))
    await assertFails(getDocs(collection(fs, `clients/${STORE_A}/history`)))
    await assertFails(getDoc(doc(fs, `clients/${STORE_A}/history`, 'h-b1')))
  })

  it('[E2E-03] deux agents : chacun ne voit que ses propres reçus', async () => {
    const a = await loginAgent(AGENT_A, 'OR123')
    const b = await loginAgent(AGENT_B, 'OR999')

    const fsA = testEnv.authenticatedContext(a.uid, a.claims).firestore()
    const fsB = testEnv.authenticatedContext(b.uid, b.claims).firestore()

    const snapA = await assertSucceeds(getDocs(query(collection(fsA, `clients/${STORE_A}/history`), where('clientId', '==', AGENT_A))))
    const snapB = await assertSucceeds(getDocs(query(collection(fsB, `clients/${STORE_A}/history`), where('clientId', '==', AGENT_B))))
    expect(snapA.docs.map((d) => d.id)).toEqual(['h-a1'])
    expect(snapB.docs.map((d) => d.id)).toEqual(['h-b1'])
  })
})
