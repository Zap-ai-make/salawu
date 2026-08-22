/**
 * TC-147 — Génération du code d'accès agent (generateAgentAccessCode).
 *   Handler integration avec Firestore Emulator, { db, FieldValue } injectés.
 *
 * Comportement protégé :
 *   - succès : agentCredentials/{clientId} écrit (hash + sel + identifiants), code
 *     renvoyé en clair une fois, audit boutique, codeVersion incrémentée à la régénération ;
 *   - gardes : app désactivée, client d'une autre boutique, client sans identifiant agent,
 *     client inexistant, rôle non store_admin.
 *
 * La config MOBILE_APP est mockée (le fichier committé = TAOFIC désactivé) : on flippe
 * `enabled` pour tester la garde sans dépendre du profil déployé.
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
import { generateAgentAccessCodeHandler } from '../../functions/src/agents/generateAgentAccessCode.js'
import { verifyAccessCode } from '../../functions/src/agents/shared.js'

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
beforeEach(async () => { await clearFirestoreEmulator(); MOBILE_APP.enabled = true })

const ADMIN_A = 'admin-a-uid'
const makeRequest = (uid, data) => ({ auth: uid ? { uid, token: {} } : null, data: data ?? {} })
async function expectError(promise, code) { await expect(promise).rejects.toMatchObject({ code }) }

async function seedBase() {
  await db.doc('users/admin-a-uid').set({ role: 'store_admin', active: true, storeId: 'store-A', storeName: 'Boutique A', email: 'a@t.test', name: 'Admin A' })
  await db.doc('globalClients/cli-1').set({
    nom: 'NIKIEMA', prenom: 'Salif', registeredStoreId: 'store-A',
    numeroPersonnel: '70000000', orange: 'OR123',
    numerosAgent: { orange: '70 11 22 33' },
  })
}

describe('TC-147 — generateAgentAccessCode', () => {
  it('[AC-01] succès : credential haché + identifiants + audit, code renvoyé une fois', async () => {
    await seedBase()
    const res = await generateAgentAccessCodeHandler(makeRequest(ADMIN_A, { clientId: 'cli-1' }), { db, FieldValue })

    expect(res.success).toBe(true)
    expect(res.codeVersion).toBe(1)
    expect(res.accessCode).toMatch(/^ESAHAF-[A-Z0-9]{8}$/)

    const cred = (await db.doc('agentCredentials/cli-1').get()).data()
    expect(cred).toMatchObject({ clientId: 'cli-1', storeId: 'store-A', codeVersion: 1, active: true, failedAttempts: 0, generatedBy: ADMIN_A })
    // Le clair n'est JAMAIS stocké ; seul le hash + sel, qui vérifient le code renvoyé.
    expect(cred.codeHash).not.toContain(res.accessCode)
    expect(verifyAccessCode(res.accessCode, cred.codeHash, cred.codeSalt)).toBe(true)
    // Identifiants de connexion = code + numéro agent, normalisés (pas le téléphone perso).
    expect(cred.loginIdentifiers).toEqual(expect.arrayContaining(['OR123', '70112233']))
    expect(cred.loginIdentifiers).not.toContain('70000000')

    const audit = await db.collection('clients/store-A/auditLogs').get()
    expect(audit.size).toBe(1)
    expect(audit.docs[0].data().action).toBe('AGENT_ACCESS_CODE_GENERATED')
  })

  it('[AC-02] régénération : nouveau code, codeVersion incrémentée', async () => {
    await seedBase()
    const first = await generateAgentAccessCodeHandler(makeRequest(ADMIN_A, { clientId: 'cli-1' }), { db, FieldValue })
    const second = await generateAgentAccessCodeHandler(makeRequest(ADMIN_A, { clientId: 'cli-1' }), { db, FieldValue })
    expect(second.codeVersion).toBe(2)
    expect(second.accessCode).not.toBe(first.accessCode)
    // L'ancien code ne vérifie plus le nouveau hash.
    const cred = (await db.doc('agentCredentials/cli-1').get()).data()
    expect(verifyAccessCode(first.accessCode, cred.codeHash, cred.codeSalt)).toBe(false)
    expect(verifyAccessCode(second.accessCode, cred.codeHash, cred.codeSalt)).toBe(true)
  })

  it('[AC-03] app mobile désactivée → MOBILE_APP_DISABLED', async () => {
    await seedBase()
    MOBILE_APP.enabled = false
    await expectError(generateAgentAccessCodeHandler(makeRequest(ADMIN_A, { clientId: 'cli-1' }), { db, FieldValue }), 'MOBILE_APP_DISABLED')
    expect((await db.doc('agentCredentials/cli-1').get()).exists).toBe(false)
  })

  it('[AC-04] client d\'une autre boutique → CLIENT_STORE_MISMATCH', async () => {
    await seedBase()
    await db.doc('globalClients/cli-1').set({ nom: 'X', prenom: 'Y', registeredStoreId: 'store-B', orange: 'OR9', numerosAgent: {} })
    await expectError(generateAgentAccessCodeHandler(makeRequest(ADMIN_A, { clientId: 'cli-1' }), { db, FieldValue }), 'CLIENT_STORE_MISMATCH')
  })

  it('[AC-05] client sans identifiant agent → AGENT_IDENTIFIER_REQUIRED', async () => {
    await seedBase()
    await db.doc('globalClients/cli-1').set({ nom: 'X', prenom: 'Y', registeredStoreId: 'store-A', numeroPersonnel: '70000000', numerosAgent: {} })
    await expectError(generateAgentAccessCodeHandler(makeRequest(ADMIN_A, { clientId: 'cli-1' }), { db, FieldValue }), 'AGENT_IDENTIFIER_REQUIRED')
  })

  it('[AC-06] client inexistant → CLIENT_NOT_FOUND', async () => {
    await seedBase()
    await expectError(generateAgentAccessCodeHandler(makeRequest(ADMIN_A, { clientId: 'ghost' }), { db, FieldValue }), 'CLIENT_NOT_FOUND')
  })

  it('[AC-07] acteur non store_admin (dealer) → ROLE_FORBIDDEN', async () => {
    await seedBase()
    await db.doc('users/dealer-uid').set({ role: 'dealer', active: true, email: 'd@t.test', name: 'Dealer' })
    await expectError(generateAgentAccessCodeHandler(makeRequest('dealer-uid', { clientId: 'cli-1' }), { db, FieldValue }), 'ROLE_FORBIDDEN')
  })

  it('[AC-08] payload avec clé supplémentaire → INVALID_REQUEST_ID (liste blanche)', async () => {
    await seedBase()
    await expectError(generateAgentAccessCodeHandler(makeRequest(ADMIN_A, { clientId: 'cli-1', extra: 'x' }), { db, FieldValue }), 'INVALID_REQUEST_ID')
  })

  it('[AC-09] appel non authentifié → UNAUTHENTICATED, aucun credential écrit (F5)', async () => {
    await seedBase()
    await expectError(generateAgentAccessCodeHandler(makeRequest(null, { clientId: 'cli-1' }), { db, FieldValue }), 'UNAUTHENTICATED')
    expect((await db.doc('agentCredentials/cli-1').get()).exists).toBe(false)
  })

  it('[AC-10] régénération : préserve lastLoginAt, déverrouille, trace wasLocked (F3)', async () => {
    await seedBase()
    // Credential préexistant : une connexion a déjà eu lieu (lastLoginAt) et le compte est verrouillé.
    const lastLogin = new Date('2026-08-10T08:00:00Z')
    await db.doc('agentCredentials/cli-1').set({
      clientId: 'cli-1', storeId: 'store-A', loginIdentifiers: ['OR123'],
      codeHash: 'h', codeSalt: 's', codeVersion: 1, active: true,
      failedAttempts: 3, lockedUntil: Date.now() + 60000, lastLoginAt: lastLogin,
    })

    const res = await generateAgentAccessCodeHandler(makeRequest(ADMIN_A, { clientId: 'cli-1' }), { db, FieldValue })
    expect(res.codeVersion).toBe(2)

    const cred = (await db.doc('agentCredentials/cli-1').get()).data()
    expect(cred.lastLoginAt.toMillis()).toBe(lastLogin.getTime()) // métadonnée d'audit préservée
    expect(cred.failedAttempts).toBe(0)                           // déverrouillage volontaire
    expect(cred.lockedUntil).toBeNull()

    // L'audit trace que la régénération a déverrouillé un compte.
    const audit = await db.collection('clients/store-A/auditLogs').get()
    expect(audit.size).toBe(1)
    expect(audit.docs[0].data()).toMatchObject({ codeVersion: 2, wasLocked: true })
  })
})
