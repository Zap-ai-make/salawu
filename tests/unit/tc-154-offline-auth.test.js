/**
 * TC-154 — Auth hors-ligne : primitives WebCrypto (offlineAuth) + session (offlineSession).
 *
 * Sécurité-critique. On protège :
 *   - vérification locale du mot de passe (PBKDF2) : bon → true, mauvais → false ;
 *   - sels de vérification et de chiffrement DISTINCTS (le hash stocké ≠ la clé AES) ;
 *   - chiffrement AES-GCM round-trip ; déchiffrement avec un mauvais mot de passe → rejet ;
 *   - session offline : enrôlement → déverrouillage ; anti-bruteforce (verrou après N essais) ;
 *     expiration (maxOfflineDays) ; purge.
 *
 * Environnement jsdom + Node ≥ 20 : globalThis.crypto.subtle et localStorage disponibles.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  deriveVerifier,
  verifyPassword,
  encryptJson,
  decryptJson,
} from '../../src/utils/offlineAuth.js'
import {
  enrollOfflineSession,
  unlockOfflineSession,
  hasOfflineSession,
  clearOfflineSession,
  offlineLockState,
  _OFFLINE_SESSION_CONSTANTS as C,
} from '../../src/services/offlineSession.js'

describe('TC-154 — offlineAuth (WebCrypto)', () => {
  it('deriveVerifier/verifyPassword : bon mot de passe → true, mauvais → false', async () => {
    const v = await deriveVerifier('S3cret-Passw0rd')
    expect(await verifyPassword('S3cret-Passw0rd', v)).toBe(true)
    expect(await verifyPassword('mauvais', v)).toBe(false)
  })

  it('sels de vérification et de chiffrement DISTINCTS (le hash stocké ne peut pas être la clé)', async () => {
    const v = await deriveVerifier('pw')
    expect(v.verifierSalt).not.toBe(v.keySalt)
    expect(v.algo).toBe('PBKDF2-SHA256')
    expect(v.iterations).toBeGreaterThanOrEqual(200000)
  })

  it('encryptJson/decryptJson : round-trip avec le bon mot de passe', async () => {
    const v = await deriveVerifier('pw')
    const blob = await encryptJson('pw', v, { uid: 'u1', role: 'store_admin', montant: 1000 })
    expect(blob).toHaveProperty('iv')
    expect(blob).toHaveProperty('data')
    expect(await decryptJson('pw', v, blob)).toEqual({ uid: 'u1', role: 'store_admin', montant: 1000 })
  })

  it('déchiffrement avec un mauvais mot de passe → rejet (auth AES-GCM)', async () => {
    const v = await deriveVerifier('pw')
    const blob = await encryptJson('pw', v, { secret: 42 })
    await expect(decryptJson('mauvais', v, blob)).rejects.toBeTruthy()
  })
})

describe('TC-154 — offlineSession', () => {
  beforeEach(() => {
    globalThis.localStorage?.clear()
  })

  it('enrôle puis déverrouille avec le bon mot de passe → session hydratée', async () => {
    const session = { uid: 'u1', email: 'a@t.test', role: 'store_admin', storeId: 'store-A' }
    expect(hasOfflineSession()).toBe(false)
    await enrollOfflineSession('pw', session)
    expect(hasOfflineSession()).toBe(true)

    const res = await unlockOfflineSession('pw')
    expect(res).toEqual({ ok: true, session })
  })

  it('mauvais mot de passe → invalid + compteur ; verrou après N essais', async () => {
    await enrollOfflineSession('pw', { uid: 'u1' })

    for (let i = 1; i < C.MAX_ATTEMPTS; i++) {
      const r = await unlockOfflineSession('mauvais')
      expect(r.ok).toBe(false)
      expect(r.reason).toBe('invalid')
    }
    // L'essai au seuil verrouille.
    const locked = await unlockOfflineSession('mauvais')
    expect(locked.reason).toBe('locked')
    expect(offlineLockState().locked).toBe(true)

    // Même avec le bon mot de passe, le compte reste verrouillé pendant la fenêtre.
    const stillLocked = await unlockOfflineSession('pw')
    expect(stillLocked.reason).toBe('locked')

    // Après expiration du verrou, le bon mot de passe passe.
    const ok = await unlockOfflineSession('pw', { now: Date.now() + C.LOCK_MS + 1000 })
    expect(ok.ok).toBe(true)
  })

  it('expiration : au-delà de maxOfflineDays → expired', async () => {
    await enrollOfflineSession('pw', { uid: 'u1' })
    const future = Date.now() + 8 * C.DAY_MS
    const r = await unlockOfflineSession('pw', { maxOfflineDays: 7, now: future })
    expect(r).toEqual({ ok: false, reason: 'expired' })
  })

  it('clearOfflineSession purge tout', async () => {
    await enrollOfflineSession('pw', { uid: 'u1' })
    clearOfflineSession()
    expect(hasOfflineSession()).toBe(false)
    expect((await unlockOfflineSession('pw')).reason).toBe('not-enrolled')
  })
})
