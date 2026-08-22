/**
 * TC-149 — Connexion agent (agentSignIn).
 *   Handler integration avec Firestore Emulator ; createCustomToken injecté (mock),
 *   donc aucun émulateur Auth requis.
 *
 * Comportement protégé :
 *   - succès : jeton émis (uid=clientId, claims role/clientId/storeId), compteur remis à zéro ;
 *   - identification par numéro OU code agent ; storeId optionnel désambiguïse ;
 *   - mauvais code → INVALID_CREDENTIALS + compteur incrémenté ; seuil → verrouillage ;
 *   - compte verrouillé → ACCOUNT_LOCKED même avec le bon code ;
 *   - identifiant inconnu / credential inactif → INVALID_CREDENTIALS (générique) ;
 *   - app désactivée → MOBILE_APP_DISABLED.
 *
 * Exécution : npm run test:functions (émulateur Firestore, projet demo-akayis-test).
 */

import { describe, it, beforeAll, afterAll, beforeEach, expect, vi } from 'vitest'
import { initializeApp, getApps, deleteApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

vi.mock('../../functions/src/config/mobileAppProfile.js', () => ({
  MOBILE_APP: { enabled: true, accessCodePrefix: 'ESAHAF' },
}))

import { MOBILE_APP } from '../../functions/src/config/mobileAppProfile.js'
import { agentSignInHandler } from '../../functions/src/agents/agentSignIn.js'
import { hashAccessCode, MAX_FAILED_ATTEMPTS } from '../../functions/src/agents/shared.js'

let adminApp
let db

const PROJECT_ID = process.env.GCLOUD_PROJECT
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST

beforeAll(() => {
  if (!FIRESTORE_HOST) throw new Error('SÉCURITÉ : FIRESTORE_EMULATOR_HOST non défini. Lancer via : npm run test:functions')
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
beforeEach(async () => { await clearFirestoreEmulator(); MOBILE_APP.enabled = true })

const CODE = 'ESAHAF-ABCD2345'
const makeRequest = (data) => ({ auth: null, data: data ?? {} })
async function expectError(promise, code) { await expect(promise).rejects.toMatchObject({ code }) }
const makeMintMock = () => vi.fn(async (uid) => `tok-${uid}`)

async function seedCredential(clientId, over = {}) {
  const code = over.code ?? CODE
  const { hash, salt } = hashAccessCode(code)
  await db.doc(`agentCredentials/${clientId}`).set({
    clientId,
    storeId: over.storeId ?? 'store-A',
    loginIdentifiers: over.loginIdentifiers ?? ['70112233', 'OR123'],
    codeHash: hash, codeSalt: salt, codeVersion: 1,
    active: over.active ?? true,
    failedAttempts: over.failedAttempts ?? 0,
    lockedUntil: over.lockedUntil ?? null,
  })
}

describe('TC-149 — agentSignIn', () => {
  it('[SI-01] succès par numéro agent (casse/espaces tolérés) : jeton + claims', async () => {
    await seedCredential('cli-1')
    const createCustomToken = makeMintMock()
    const res = await agentSignInHandler(makeRequest({ identifier: '70 11 22 33', code: 'esahaf-abcd2345' }), { db, FieldValue, createCustomToken })

    expect(res).toMatchObject({ success: true, customToken: 'tok-cli-1' })
    expect(createCustomToken).toHaveBeenCalledWith('cli-1', { role: 'agent', clientId: 'cli-1', storeId: 'store-A' })
    expect((await db.doc('agentCredentials/cli-1').get()).data().failedAttempts).toBe(0)
  })

  it('[SI-02] succès aussi par CODE agent', async () => {
    await seedCredential('cli-1')
    const createCustomToken = makeMintMock()
    const res = await agentSignInHandler(makeRequest({ identifier: 'OR123', code: CODE }), { db, FieldValue, createCustomToken })
    expect(res.customToken).toBe('tok-cli-1')
  })

  it('[SI-03] mauvais code → INVALID_CREDENTIALS + compteur incrémenté, aucun jeton', async () => {
    await seedCredential('cli-1')
    const createCustomToken = makeMintMock()
    await expectError(agentSignInHandler(makeRequest({ identifier: '70112233', code: 'ESAHAF-WRONG999' }), { db, FieldValue, createCustomToken }), 'INVALID_CREDENTIALS')
    expect(createCustomToken).not.toHaveBeenCalled()
    expect((await db.doc('agentCredentials/cli-1').get()).data().failedAttempts).toBe(1)
  })

  it('[SI-04] au seuil d\'échecs → verrouillage, puis bon code → ACCOUNT_LOCKED', async () => {
    await seedCredential('cli-1', { failedAttempts: MAX_FAILED_ATTEMPTS - 1 })
    const createCustomToken = makeMintMock()
    // Échec qui déclenche le verrou
    await expectError(agentSignInHandler(makeRequest({ identifier: '70112233', code: 'MAUVAIS' }), { db, FieldValue, createCustomToken }), 'INVALID_CREDENTIALS')
    const locked = (await db.doc('agentCredentials/cli-1').get()).data()
    expect(locked.lockedUntil).toBeGreaterThan(Date.now())
    // Bon code mais compte verrouillé
    await expectError(agentSignInHandler(makeRequest({ identifier: '70112233', code: CODE }), { db, FieldValue, createCustomToken }), 'ACCOUNT_LOCKED')
    expect(createCustomToken).not.toHaveBeenCalled()
  })

  it('[SI-05] identifiant inconnu → INVALID_CREDENTIALS', async () => {
    await seedCredential('cli-1')
    await expectError(agentSignInHandler(makeRequest({ identifier: '99999999', code: CODE }), { db, FieldValue, createCustomToken: makeMintMock() }), 'INVALID_CREDENTIALS')
  })

  it('[SI-06] credential inactif → INVALID_CREDENTIALS', async () => {
    await seedCredential('cli-1', { active: false })
    await expectError(agentSignInHandler(makeRequest({ identifier: '70112233', code: CODE }), { db, FieldValue, createCustomToken: makeMintMock() }), 'INVALID_CREDENTIALS')
  })

  it('[SI-07] storeId désambiguïse : mauvaise boutique → INVALID_CREDENTIALS, bonne → succès', async () => {
    await seedCredential('cli-1', { storeId: 'store-A' })
    await expectError(agentSignInHandler(makeRequest({ identifier: '70112233', code: CODE, storeId: 'store-B' }), { db, FieldValue, createCustomToken: makeMintMock() }), 'INVALID_CREDENTIALS')
    const mint = makeMintMock()
    const res = await agentSignInHandler(makeRequest({ identifier: '70112233', code: CODE, storeId: 'store-A' }), { db, FieldValue, createCustomToken: mint })
    expect(res.customToken).toBe('tok-cli-1')
  })

  it('[SI-08] app désactivée → MOBILE_APP_DISABLED', async () => {
    await seedCredential('cli-1')
    MOBILE_APP.enabled = false
    await expectError(agentSignInHandler(makeRequest({ identifier: '70112233', code: CODE }), { db, FieldValue, createCustomToken: makeMintMock() }), 'MOBILE_APP_DISABLED')
  })

  it('[SI-09] entrée vide → INVALID_LOGIN_INPUT', async () => {
    await expectError(agentSignInHandler(makeRequest({ identifier: '', code: '' }), { db, FieldValue, createCustomToken: makeMintMock() }), 'INVALID_LOGIN_INPUT')
  })
})
