/**
 * TC-152 — limite de débit par IP sur `agentSignIn`.
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CE FILET GARDE, ET POURQUOI IL NE DOUBLE PAS TC-149
 *
 * TC-149 garde le verrou par credential : cinq mauvais codes sur UN agent le
 * verrouillent. Ce verrou suppose qu'un credential a été trouvé.
 *
 * Le trou est ailleurs, et c'est celui-ci : sur un identifiant INCONNU, aucun
 * credential ne correspond, donc rien ne s'incrémente — et pourtant le serveur a
 * déjà payé une requête Firestore ET un `scryptSync` complet (le leurre
 * anti-timing F1, qui bloque la boucle d'évènements). Un attaquant obtenait donc
 * un scrypt par paquet, indéfiniment, sur un endpoint public.
 *
 * C'est le vecteur de coût qui faisait d'App Check une précondition. App Check
 * étant hors d'atteinte pour l'app mobile (SDK JavaScript → fournisseurs
 * reCAPTCHA, sans objet sur téléphone), la limite de débit le remplace.
 *
 * ⚠ LE CAS QUI COMPTE VRAIMENT est SD-03 : le flot d'identifiants inconnus. Les
 * autres décrivent le garde ; celui-là décrit le défaut.
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
import { hashAccessCode } from '../../functions/src/agents/shared.js'
import {
  THROTTLE_MAX_ATTEMPTS,
  THROTTLE_WINDOW_MS,
  THROTTLE_COLLECTION,
  ipBucket,
  clientIpFrom,
  nextThrottleState,
  isThrottled,
} from '../../functions/src/agents/throttle.js'

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
const IP_A = '41.203.10.7'
const IP_B = '41.203.10.99'

const makeMintMock = () => vi.fn(async (uid) => `tok-${uid}`)
const deps = () => ({ db, FieldValue, createCustomToken: makeMintMock() })

/** Une requête callable telle que le frontal Google la remet au handler. */
const makeRequest = (data, ip) => ({
  auth: null,
  data: data ?? {},
  rawRequest: ip === undefined ? undefined : { headers: { 'x-forwarded-for': `${ip}, 130.211.0.1` } },
})

async function expectError(promise, code) { await expect(promise).rejects.toMatchObject({ code }) }

async function seedCredential(clientId = 'cli-1') {
  const { hash, salt } = hashAccessCode(CODE)
  await db.doc(`agentCredentials/${clientId}`).set({
    clientId, storeId: 'store-A',
    loginIdentifiers: ['70112233', 'OR123'],
    codeHash: hash, codeSalt: salt, codeVersion: 1,
    active: true, failedAttempts: 0, lockedUntil: null,
  })
}

/** Épuise le quota de l'IP sans toucher à aucun credential (identifiants inconnus). */
async function epuiserLeQuota(ip, n = THROTTLE_MAX_ATTEMPTS) {
  for (let i = 0; i < n; i++) {
    await expectError(
      agentSignInHandler(makeRequest({ identifier: `INCONNU${i}`, code: CODE }, ip), deps()),
      'INVALID_CREDENTIALS',
    )
  }
}

describe('TC-152 — le garde de débit, sur le chemin public', () => {
  it('[SD-01] sous le seuil, une connexion valide passe normalement', async () => {
    await seedCredential()
    const res = await agentSignInHandler(makeRequest({ identifier: '70112233', code: CODE }, IP_A), deps())
    expect(res).toMatchObject({ success: true })
  })

  it('[SD-02] au-delà du seuil, même le BON code est refusé', async () => {
    await seedCredential()
    await epuiserLeQuota(IP_A)
    // Le garde passe AVANT la vérification : un code valide ne rachète pas le dépassement.
    await expectError(
      agentSignInHandler(makeRequest({ identifier: '70112233', code: CODE }, IP_A), deps()),
      'TOO_MANY_ATTEMPTS',
    )
  })

  it('[SD-03] ⚠ LE DÉFAUT : un flot d\'identifiants INCONNUS est compté et finit refusé', async () => {
    // Aucun credential n'existe : avant ce lot, rien au monde ne comptait ces
    // appels, et chacun coûtait pourtant une requête + un scryptSync bloquant.
    await epuiserLeQuota(IP_A)
    await expectError(
      agentSignInHandler(makeRequest({ identifier: 'ENCORE-INCONNU', code: CODE }, IP_A), deps()),
      'TOO_MANY_ATTEMPTS',
    )
  })

  it('[SD-04] une AUTRE IP n\'est pas touchée : pas de panne collatérale', async () => {
    await seedCredential()
    await epuiserLeQuota(IP_A)
    const res = await agentSignInHandler(makeRequest({ identifier: '70112233', code: CODE }, IP_B), deps())
    expect(res).toMatchObject({ success: true })
  })

  it('[SD-05] une requête bloquée ne touche PAS le compteur d\'échecs du compte', async () => {
    // Sinon le garde offrirait une nouvelle façon de verrouiller un agent connu :
    // inonder jusqu'au blocage tout en faisant monter SON compteur à lui.
    await seedCredential()
    await epuiserLeQuota(IP_A)
    const avant = (await db.doc('agentCredentials/cli-1').get()).data().failedAttempts

    await expectError(
      agentSignInHandler(makeRequest({ identifier: '70112233', code: 'ESAHAF-MAUVAIS9' }, IP_A), deps()),
      'TOO_MANY_ATTEMPTS',
    )

    const apres = (await db.doc('agentCredentials/cli-1').get()).data().failedAttempts
    expect(apres).toBe(avant)
  })

  it('[SD-06] une requête déjà bloquée n\'ÉCRIT pas : le refus ne coûte qu\'une lecture', async () => {
    // Sous un flot, réécrire le même document à chaque paquet dépasserait ce
    // qu'un document Firestore encaisse — et on paierait l'attaque en écritures.
    await epuiserLeQuota(IP_A)
    const ref = db.doc(`${THROTTLE_COLLECTION}/${ipBucket(IP_A)}`)

    // ⚠ LA TENTATIVE QUI DÉCLENCHE LE BLOCAGE ÉCRIT, ET C'EST NORMAL : c'est
    // elle qui pose `blockedUntil`. Le relevé se prend APRÈS cette transition,
    // sinon on compare un état « pas encore bloqué » à un état « bloqué » et on
    // mesure la transition au lieu de mesurer le régime bloqué.
    await expectError(
      agentSignInHandler(makeRequest({ identifier: 'X', code: CODE }, IP_A), deps()),
      'TOO_MANY_ATTEMPTS',
    )
    const avant = (await ref.get()).data()

    // Celle-ci, en revanche, ne doit plus rien écrire.
    await expectError(
      agentSignInHandler(makeRequest({ identifier: 'Y', code: CODE }, IP_A), deps()),
      'TOO_MANY_ATTEMPTS',
    )

    const apres = (await ref.get()).data()
    expect(apres.count).toBe(avant.count)
    expect(apres.blockedUntil).toBe(avant.blockedUntil)
  })

  it('[SD-07] passé la fenêtre, le compteur repart de zéro', async () => {
    await seedCredential()
    const ref = db.doc(`${THROTTLE_COLLECTION}/${ipBucket(IP_A)}`)
    await ref.set({
      count: THROTTLE_MAX_ATTEMPTS,
      windowStart: Date.now() - THROTTLE_WINDOW_MS - 1000, // fenêtre expirée
      blockedUntil: null,
    })

    const res = await agentSignInHandler(makeRequest({ identifier: '70112233', code: CODE }, IP_A), deps())
    expect(res).toMatchObject({ success: true })
    expect((await ref.get()).data().count).toBe(1)
  })

  it('[SD-08] sans IP lisible, on laisse passer — une panne totale serait pire', async () => {
    // Décision assumée (voir throttle.js) : ce garde protège le COÛT, pas les
    // comptes. Si la plateforme cessait de poser `x-forwarded-for`, un repli
    // « tout le monde dans le même seau » mettrait TOUS les agents hors service.
    await seedCredential()
    for (let i = 0; i < THROTTLE_MAX_ATTEMPTS + 5; i++) {
      await expectError(
        agentSignInHandler(makeRequest({ identifier: `INCONNU${i}`, code: CODE }, undefined), deps()),
        'INVALID_CREDENTIALS',
      )
    }
    const res = await agentSignInHandler(makeRequest({ identifier: '70112233', code: CODE }, undefined), deps())
    expect(res).toMatchObject({ success: true })
  })
})

describe('TC-152 — les briques pures du garde', () => {
  it('l\'IP retenue est le PREMIER élément de x-forwarded-for, pas le dernier', () => {
    // Le dernier est le frontal Google : le prendre mettrait la planète entière
    // dans un seul seau, et le garde deviendrait un interrupteur général.
    expect(clientIpFrom({ headers: { 'x-forwarded-for': '41.203.10.7, 130.211.0.1' } })).toBe('41.203.10.7')
    expect(clientIpFrom({ headers: { 'x-forwarded-for': ['41.203.10.7, 130.211.0.1'] } })).toBe('41.203.10.7')
    expect(clientIpFrom({ ip: '41.203.10.7' })).toBe('41.203.10.7')
    expect(clientIpFrom({})).toBeNull()
    expect(clientIpFrom(undefined)).toBeNull()
  })

  it('l\'adresse ne sert jamais telle quelle d\'identifiant de document', () => {
    const seau = ipBucket('2001:db8::1')
    expect(seau).not.toContain(':')
    expect(seau).toHaveLength(32)
    expect(ipBucket('2001:db8::1')).toBe(seau) // stable
    expect(ipBucket('41.203.10.7')).not.toBe(seau)
  })

  it('le compteur repart hors fenêtre, et bloque au dépassement', () => {
    const t0 = 1_700_000_000_000
    expect(nextThrottleState(null, t0)).toMatchObject({ count: 1, windowStart: t0, blockedUntil: null })
    expect(nextThrottleState({ count: 3, windowStart: t0 }, t0 + 1000)).toMatchObject({ count: 4, windowStart: t0 })

    const auSeuil = nextThrottleState({ count: THROTTLE_MAX_ATTEMPTS, windowStart: t0 }, t0 + 1000)
    expect(auSeuil.blockedUntil).toBeGreaterThan(t0)

    const horsFenetre = nextThrottleState({ count: 99, windowStart: t0 }, t0 + THROTTLE_WINDOW_MS + 1)
    expect(horsFenetre).toMatchObject({ count: 1, blockedUntil: null })
  })

  it('un état corrompu ne bloque pas par accident', () => {
    // Un `windowStart` illisible doit ouvrir une fenêtre neuve, pas verrouiller.
    expect(nextThrottleState({ count: 'x', windowStart: 'hier' }, 1000)).toMatchObject({ count: 1, blockedUntil: null })
    expect(isThrottled({ blockedUntil: 'plus tard' }, 1000)).toBe(false)
    expect(isThrottled(null, 1000)).toBe(false)
  })
})
