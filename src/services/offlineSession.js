/**
 * offlineSession.js — enrôlement / déverrouillage de la session hors-ligne.
 *
 * Après une connexion EN LIGNE (le mot de passe est disponible), on enrôle : un vérifieur
 * PBKDF2 + un snapshot de session (uid, email, role, storeId, profil, store) CHIFFRÉ (AES-GCM).
 * Hors-ligne, l'utilisateur re-saisit son mot de passe → vérification locale → déchiffrement →
 * hydratation de l'app en lecture. Anti-bruteforce (tentatives bornées + verrou) et EXPIRATION
 * (`maxOfflineDays` depuis la dernière connexion en ligne). Purge à la déconnexion.
 *
 * Stockage : localStorage (petit, synchrone, disponible en PWA). Le snapshot est chiffré ;
 * l'état anti-bruteforce et les horodatages sont en clair (non sensibles). Réenrôler à chaque
 * connexion en ligne réinitialise la fenêtre d'expiration et le vérifieur.
 */

import { deriveVerifier, verifyPassword, encryptJson, decryptJson } from '../utils/offlineAuth.js'

const STORAGE_KEY = 'esahaf.offlineSession.v1'
const MAX_ATTEMPTS = 5
const LOCK_MS = 5 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

const store = {
  get() {
    try { return JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) || 'null') } catch { return null }
  },
  set(v) { globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(v)) },
  clear() { globalThis.localStorage?.removeItem(STORAGE_KEY) },
}

/** Enrôle (ou réenrôle) la session offline après une connexion EN LIGNE réussie. */
export async function enrollOfflineSession(password, session) {
  const verifier = await deriveVerifier(password)
  const encSession = await encryptJson(password, verifier, session)
  store.set({ verifier, encSession, uid: session?.uid ?? null, enrolledAt: Date.now(), failedAttempts: 0, lockedUntil: 0 })
}

export function hasOfflineSession() {
  return store.get() != null
}

export function clearOfflineSession() {
  store.clear()
}

/** État léger pour l'UI (sans déchiffrement) : enrôlé ? verrouillé ? quel uid ? */
export function offlineLockState(now = Date.now()) {
  const s = store.get()
  if (!s) return { enrolled: false }
  return { enrolled: true, uid: s.uid ?? null, locked: (s.lockedUntil || 0) > now, lockedUntil: s.lockedUntil || 0, enrolledAt: s.enrolledAt || 0 }
}

/**
 * Tente le déverrouillage hors-ligne. Renvoie { ok, session } ou { ok:false, reason }.
 * reason ∈ 'not-enrolled' | 'locked' | 'expired' | 'invalid'.
 */
export async function unlockOfflineSession(password, { maxOfflineDays = 7, now = Date.now() } = {}) {
  const s = store.get()
  if (!s) return { ok: false, reason: 'not-enrolled' }
  if ((s.lockedUntil || 0) > now) return { ok: false, reason: 'locked', lockedUntil: s.lockedUntil }
  if (maxOfflineDays > 0 && now - (s.enrolledAt || 0) > maxOfflineDays * DAY_MS) {
    return { ok: false, reason: 'expired' }
  }

  const ok = await verifyPassword(password, s.verifier)
  if (!ok) {
    const attempts = (s.failedAttempts || 0) + 1
    const lock = attempts >= MAX_ATTEMPTS
    store.set({ ...s, failedAttempts: lock ? 0 : attempts, lockedUntil: lock ? now + LOCK_MS : (s.lockedUntil || 0) })
    return lock ? { ok: false, reason: 'locked', lockedUntil: now + LOCK_MS } : { ok: false, reason: 'invalid', attemptsLeft: MAX_ATTEMPTS - attempts }
  }

  const session = await decryptJson(password, s.verifier, s.encSession)
  store.set({ ...s, failedAttempts: 0, lockedUntil: 0 })
  return { ok: true, session }
}

export const _OFFLINE_SESSION_CONSTANTS = { STORAGE_KEY, MAX_ATTEMPTS, LOCK_MS, DAY_MS }
