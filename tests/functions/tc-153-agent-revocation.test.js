/**
 * TC-153 — la révocation d'une session agent.
 * ─────────────────────────────────────────────────────────────────────────────
 * LE DÉFAUT, RELEVÉ PAR L'ÉQUIPE MOBILE ET VÉRIFIÉ DANS LE CODE
 *
 * Un jeton personnalisé Firebase ouvre une session qui SURVIT à la régénération
 * du code d'accès : l'appareil déjà connecté garde son jeton de rafraîchissement
 * et continue de fonctionner indéfiniment.
 *
 * Preuves avant ce lot :
 *   · `active` n'était lu qu'à UN endroit — le filtre de candidats d'agentSignIn.
 *     C'est une porte d'entrée, pas un interrupteur.
 *   · les règles ne consultent jamais le credential : `isAgentToken()` ne lit que
 *     le claim `role`.
 *   · `revokeRefreshTokens` n'existait nulle part dans le dépôt.
 *
 * Donc régénérer empêchait les NOUVELLES connexions sans COUPER aucun appareil.
 * Cahier des charges de l'app : « le jour où une secrétaire part avec l'app
 * installée, l'agent doit pouvoir la couper. »
 *
 * ⚠ DEUX MÉCANISMES, ET ILS N'ONT PAS LA MÊME FORCE — c'est le point à retenir.
 *
 *   `revokeRefreshTokens` est IMPOSÉ. Firebase refuse de renouveler le jeton, quoi
 *   que fasse l'appareil. Le jeton d'identité en cours vit jusqu'à son expiration
 *   (une heure au plus) : la fenêtre passe d'INFINIE à BORNÉE, sans rien demander
 *   à l'application.
 *
 *   `agentSessionCheck` est CONSULTATIF. Il ne vaut que si l'app l'appelle et
 *   honore la réponse. Contre « la secrétaire garde l'app », c'est suffisant —
 *   elle ne repatchera pas l'APK. Contre un adversaire qui modifie le client, ce
 *   n'est rien. Il raccourcit le délai ; il ne le garantit pas.
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
import { agentSignInHandler } from '../../functions/src/agents/agentSignIn.js'
import { agentSessionCheckHandler } from '../../functions/src/agents/agentSessionCheck.js'

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

const ADMIN_A = 'admin-a-uid'
const makeAdminRequest = (data) => ({ auth: { uid: ADMIN_A }, data })
async function expectError(promise, code) { await expect(promise).rejects.toMatchObject({ code }) }

async function seedBase() {
  await db.doc(`users/${ADMIN_A}`).set({
    role: 'store_admin', active: true, storeId: 'store-A',
    storeName: 'Boutique A', email: 'a@t.test', name: 'Admin A',
  })
  await db.doc('globalClients/cli-1').set({
    nom: 'NIKIEMA', prenom: 'Salif', registeredStoreId: 'store-A',
    numeroPersonnel: '70000000', orange: 'OR123',
    numerosAgent: { moov: '70 11 22 33' },
  })
}

/** Dépendances de génération, avec un espion de révocation contrôlable. */
function genDeps(revoke) {
  return { db, FieldValue, revokeAgentSessions: revoke ?? vi.fn(async () => {}) }
}

/** Le jeton tel que l'app le présentera : claims posés par agentSignIn. */
const makeAgentRequest = (claims) => ({
  auth: { uid: claims?.clientId ?? 'cli-1', token: { role: 'agent', ...claims } },
  data: {},
})

describe('TC-153 — le jeton porte de quoi être invalidé', () => {
  it('[RV-01] les claims émis portent codeVersion', async () => {
    await seedBase()
    const mint = vi.fn(async (uid, claims) => ({ uid, claims }))
    await generateAgentAccessCodeHandler(makeAdminRequest({ clientId: 'cli-1' }), genDeps())
    const code = (await generateAgentAccessCodeHandler(makeAdminRequest({ clientId: 'cli-1' }), genDeps())).accessCode

    await agentSignInHandler(
      { auth: null, data: { identifier: 'OR123', code }, rawRequest: undefined },
      { db, FieldValue, createCustomToken: mint },
    )

    // Sans ce claim, aucune vérification de fraîcheur n'est possible côté app.
    expect(mint).toHaveBeenCalledWith('cli-1', expect.objectContaining({
      role: 'agent', clientId: 'cli-1', storeId: 'store-A', codeVersion: 2,
    }))
  })
})

describe('TC-153 — régénérer coupe les sessions ouvertes', () => {
  it('[RV-02] la régénération révoque les jetons de rafraîchissement de CET agent', async () => {
    await seedBase()
    const revoke = vi.fn(async () => {})
    const res = await generateAgentAccessCodeHandler(makeAdminRequest({ clientId: 'cli-1' }), genDeps(revoke))

    expect(revoke).toHaveBeenCalledWith('cli-1')
    expect(res.sessionsRevoked).toBe(true)
  })

  it('[RV-03] ⚠ si la révocation ÉCHOUE, le code reste changé et l\'échec est tracé', async () => {
    // La transaction est déjà validée : faire échouer l'appel ferait croire au
    // gérant que rien n'a bougé, alors que le code a changé. Il régénérerait,
    // produisant un troisième code — et l'agent en aurait deux périmés.
    await seedBase()
    const revoke = vi.fn(async () => { throw new Error('auth indisponible') })
    const res = await generateAgentAccessCodeHandler(makeAdminRequest({ clientId: 'cli-1' }), genDeps(revoke))

    expect(res.success).toBe(true)
    expect(typeof res.accessCode).toBe('string')
    expect(res.sessionsRevoked).toBe(false) // l'appelant PEUT le dire au gérant

    const audits = await db.collection('clients/store-A/auditLogs').get()
    const echecs = audits.docs.map((d) => d.data()).filter((a) => a.action === 'AGENT_SESSION_REVOKE_FAILED')
    expect(echecs).toHaveLength(1)
    expect(echecs[0]).toMatchObject({ clientId: 'cli-1', actorUid: ADMIN_A })
  })
})

describe('TC-153 — agentSessionCheck, la ceinture en plus des bretelles', () => {
  it('[RV-04] jeton à jour → valid', async () => {
    await seedBase()
    const gen = await generateAgentAccessCodeHandler(makeAdminRequest({ clientId: 'cli-1' }), genDeps())
    const res = await agentSessionCheckHandler(
      makeAgentRequest({ clientId: 'cli-1', storeId: 'store-A', codeVersion: gen.codeVersion }),
      { db },
    )
    expect(res).toMatchObject({ valid: true })
  })

  it('[RV-05] après régénération, l\'ancien jeton n\'est plus valide', async () => {
    await seedBase()
    const premier = await generateAgentAccessCodeHandler(makeAdminRequest({ clientId: 'cli-1' }), genDeps())
    await generateAgentAccessCodeHandler(makeAdminRequest({ clientId: 'cli-1' }), genDeps())

    const res = await agentSessionCheckHandler(
      makeAgentRequest({ clientId: 'cli-1', storeId: 'store-A', codeVersion: premier.codeVersion }),
      { db },
    )
    expect(res).toMatchObject({ valid: false })
  })

  it('[RV-06] credential désactivé → plus valide, même avec la bonne version', async () => {
    await seedBase()
    const gen = await generateAgentAccessCodeHandler(makeAdminRequest({ clientId: 'cli-1' }), genDeps())
    await db.doc('agentCredentials/cli-1').update({ active: false })

    const res = await agentSessionCheckHandler(
      makeAgentRequest({ clientId: 'cli-1', storeId: 'store-A', codeVersion: gen.codeVersion }),
      { db },
    )
    expect(res).toMatchObject({ valid: false })
  })

  it('[RV-07] un jeton SANS codeVersion est invalide, et c\'est voulu', async () => {
    // Ce sont les jetons émis avant ce lot. Les accepter ouvrirait un contournement
    // permanent : il suffirait de présenter un vieux jeton pour ne jamais être coupé.
    await seedBase()
    await generateAgentAccessCodeHandler(makeAdminRequest({ clientId: 'cli-1' }), genDeps())
    const res = await agentSessionCheckHandler(
      makeAgentRequest({ clientId: 'cli-1', storeId: 'store-A' }),
      { db },
    )
    expect(res).toMatchObject({ valid: false })
  })

  it('[RV-08] credential absent → invalide, sans planter', async () => {
    const res = await agentSessionCheckHandler(
      makeAgentRequest({ clientId: 'cli-inconnu', storeId: 'store-A', codeVersion: 1 }),
      { db },
    )
    expect(res).toMatchObject({ valid: false })
  })

  it('[RV-09] un jeton NON agent est refusé', async () => {
    await expectError(
      agentSessionCheckHandler({ auth: { uid: ADMIN_A, token: { role: 'store_admin' } }, data: {} }, { db }),
      'ROLE_FORBIDDEN',
    )
  })

  it('[RV-10] appel non authentifié → UNAUTHENTICATED', async () => {
    await expectError(agentSessionCheckHandler({ auth: null, data: {} }, { db }), 'UNAUTHENTICATED')
  })

  it('[RV-11] app désactivée → MOBILE_APP_DISABLED', async () => {
    MOBILE_APP.enabled = false
    await expectError(
      agentSessionCheckHandler(makeAgentRequest({ clientId: 'cli-1', codeVersion: 1 }), { db }),
      'MOBILE_APP_DISABLED',
    )
  })
})
