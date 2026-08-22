/**
 * Helpers purs — génération/vérification du code d'accès agent + extraction des
 * identifiants de connexion depuis une fiche globalClients.
 *
 * Aucune dépendance externe hors node:crypto. Testés directement en TC-146.
 *
 * Conventions (identiques à dealerRequests/shared.js) :
 *   - Toute validation d'entrée échouée lance DealerRequestError (jamais HttpsError).
 *   - Le PIN/code n'est jamais stocké en clair : seul son hash scrypt + sel l'est.
 */

import { randomInt, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { DealerRequestError } from '../errors.js'

// Alphabet SANS caractères ambigus (pas de I, L, O, 0, 1) → dictée/saisie fiable.
export const ACCESS_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const ACCESS_CODE_LENGTH = 8
const SCRYPT_KEYLEN = 32

// ---------------------------------------------------------------------------
// Validation de l'identifiant client (id de doc globalClients)
// ---------------------------------------------------------------------------

export function validateClientId(clientId) {
  if (!clientId || typeof clientId !== 'string' || clientId.trim() === '') {
    throw new DealerRequestError('INVALID_CLIENT_ID', 'Identifiant client requis.')
  }
  return clientId.trim()
}

// ---------------------------------------------------------------------------
// Génération du code d'accès : <PREFIX>-XXXXXXXX
// rnd injectable (tests déterministes) ; défaut = crypto.randomInt (CSPRNG).
// ---------------------------------------------------------------------------

export function generateAccessCode(prefix, length = ACCESS_CODE_LENGTH, rnd = randomInt) {
  const safePrefix = String(prefix ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'ACCES'
  let body = ''
  for (let i = 0; i < length; i++) {
    body += ACCESS_CODE_ALPHABET[rnd(ACCESS_CODE_ALPHABET.length)]
  }
  return `${safePrefix}-${body}`
}

// ---------------------------------------------------------------------------
// Hachage / vérification (scrypt + sel aléatoire, comparaison timing-safe)
// ---------------------------------------------------------------------------

export function hashAccessCode(code, saltHex) {
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : randomBytes(16)
  const hash = scryptSync(String(code), salt, SCRYPT_KEYLEN)
  return { hash: hash.toString('hex'), salt: salt.toString('hex') }
}

export function verifyAccessCode(code, hashHex, saltHex) {
  try {
    if (typeof hashHex !== 'string' || typeof saltHex !== 'string') return false
    const expected = Buffer.from(hashHex, 'hex')
    const salt = Buffer.from(saltHex, 'hex')
    if (expected.length === 0) return false
    const actual = scryptSync(String(code), salt, expected.length)
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Identifiants de connexion agent = numéros agent + codes agent (tous réseaux),
// normalisés (majuscules, sans espace) et dédoublonnés. Servent au login (Lot 3)
// pour retrouver l'agent par l'un de SES identifiants professionnels.
// ---------------------------------------------------------------------------

export function normalizeIdentifier(value) {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, '')
}

// ---------------------------------------------------------------------------
// Connexion agent (Lot 3) — validation entrées + anti-bruteforce
// ---------------------------------------------------------------------------

// Le code affiché est en MAJUSCULES avec un tiret (ex. ESAHAF-ABCD2345). On tolère
// la casse et les espaces à la saisie, mais on conserve le tiret (le hash porte dessus).
export function normalizeCode(value) {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, '')
}

export function validateLoginIdentifier(identifier) {
  const norm = normalizeIdentifier(identifier)
  if (norm.length === 0 || norm.length > 64) {
    throw new DealerRequestError('INVALID_LOGIN_INPUT', 'Identifiant de connexion invalide.')
  }
  return norm
}

export function validateLoginCode(code) {
  const norm = normalizeCode(code)
  if (norm.length === 0 || norm.length > 64) {
    throw new DealerRequestError('INVALID_LOGIN_INPUT', "Code d'accès invalide.")
  }
  return norm
}

// Politique de verrouillage : au bout de MAX_FAILED_ATTEMPTS échecs consécutifs,
// on verrouille LOCK_DURATION_MS et on remet le compteur à zéro (fenêtre glissante).
export const MAX_FAILED_ATTEMPTS = 5
export const LOCK_DURATION_MS = 5 * 60 * 1000

/**
 * État suivant après un échec de code. Pur (now injecté).
 * @returns {{ failedAttempts: number, lockedUntil: number }}
 */
export function nextFailureState(currentAttempts, now) {
  const attempts = (Number(currentAttempts) || 0) + 1
  if (attempts >= MAX_FAILED_ATTEMPTS) {
    return { failedAttempts: 0, lockedUntil: now + LOCK_DURATION_MS }
  }
  return { failedAttempts: attempts, lockedUntil: 0 }
}

/** Le credential est-il verrouillé à l'instant `now` ? */
export function isLocked(credData, now) {
  return Number(credData?.lockedUntil || 0) > now
}

export function extractAgentIdentifiers(clientData, networkKeys = []) {
  if (!clientData || typeof clientData !== 'object') return []
  const numeros = clientData.numerosAgent && typeof clientData.numerosAgent === 'object'
    ? clientData.numerosAgent
    : {}
  // Union : réseaux connus (bornés) + ceux réellement présents sur la fiche.
  const keys = new Set([
    ...networkKeys.map((k) => String(k).toLowerCase()),
    ...Object.keys(numeros),
  ])
  const out = new Set()
  for (const key of keys) {
    const code = normalizeIdentifier(clientData[key])        // clé plate = code agent
    const numero = normalizeIdentifier(numeros[key])         // numerosAgent[key] = numéro agent
    if (code) out.add(code)
    if (numero) out.add(numero)
  }
  return [...out]
}
