/**
 * offlineAuth.js — primitives de déverrouillage hors-ligne (WebCrypto).
 *
 * Vérifie LOCALEMENT le mot de passe du compte (PBKDF2-SHA256), sans réseau, et dérive une
 * clé AES-GCM pour chiffrer au repos la session offline + l'outbox. AUCUN mot de passe n'est
 * stocké en clair : seuls un vérifieur (sel + hash) et des données chiffrées le sont.
 *
 * C'est une passerelle d'ACCÈS locale (défense en profondeur), pas une authentification
 * serveur : les données de lecture restent dans le cache Firestore (non chiffré par le SDK).
 * On chiffre en propre ce qu'on maîtrise (session, intentions financières de l'outbox).
 *
 * SÉCURITÉ : le vérifieur et la clé de chiffrement sont dérivés de DEUX sels DISTINCTS
 * (`verifierSalt` / `keySalt`). Sans cela, le hash de vérification stocké coïnciderait avec
 * les octets de la clé AES → stocker le vérifieur reviendrait à stocker la clé. À NE PAS fusionner.
 *
 * Utilise globalThis.crypto.subtle (navigateurs + Node ≥ 20 pour les tests).
 */

const PBKDF2_ITERATIONS = 210000 // recommandation OWASP pour PBKDF2-SHA256
const SALT_BYTES = 16
const IV_BYTES = 12
const HASH_BITS = 256

const enc = new TextEncoder()
const dec = new TextDecoder()

function subtle() {
  const c = globalThis.crypto
  if (!c?.subtle) throw new Error('WebCrypto indisponible (crypto.subtle)')
  return c.subtle
}

function randomBytes(n) {
  const b = new Uint8Array(n)
  globalThis.crypto.getRandomValues(b)
  return b
}

function toB64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
}
function fromB64(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

function importPasswordKey(password) {
  return subtle().importKey('raw', enc.encode(String(password)), 'PBKDF2', false, ['deriveBits', 'deriveKey'])
}

async function deriveBits(password, salt, iterations) {
  const keyMaterial = await importPasswordKey(password)
  const bits = await subtle().deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    HASH_BITS,
  )
  return new Uint8Array(bits)
}

async function deriveAesKey(password, keySaltB64, iterations) {
  const keyMaterial = await importPasswordKey(password)
  return subtle().deriveKey(
    { name: 'PBKDF2', salt: fromB64(keySaltB64), iterations, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

/** Crée un vérifieur (sels + hash) à partir du mot de passe. À stocker localement. */
export async function deriveVerifier(password) {
  const verifierSalt = randomBytes(SALT_BYTES)
  const keySalt = randomBytes(SALT_BYTES)
  const hash = await deriveBits(password, verifierSalt, PBKDF2_ITERATIONS)
  return {
    algo: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    verifierSalt: toB64(verifierSalt),
    keySalt: toB64(keySalt),
    hash: toB64(hash),
  }
}

/** Vérifie un mot de passe contre un vérifieur (comparaison à temps constant). */
export async function verifyPassword(password, verifier) {
  if (!verifier?.verifierSalt || !verifier?.hash) return false
  try {
    const expected = fromB64(verifier.hash)
    const actual = await deriveBits(password, fromB64(verifier.verifierSalt), verifier.iterations || PBKDF2_ITERATIONS)
    return constantTimeEqual(actual, expected)
  } catch {
    return false
  }
}

/** Chiffre un objet JSON avec la clé dérivée du mot de passe (AES-GCM, IV aléatoire). */
export async function encryptJson(password, verifier, obj) {
  const key = await deriveAesKey(password, verifier.keySalt, verifier.iterations || PBKDF2_ITERATIONS)
  const iv = randomBytes(IV_BYTES)
  const cipher = await subtle().encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)))
  return { iv: toB64(iv), data: toB64(cipher) }
}

/** Déchiffre un blob produit par encryptJson. Lève si le mot de passe est faux (AES-GCM auth). */
export async function decryptJson(password, verifier, blob) {
  const key = await deriveAesKey(password, verifier.keySalt, verifier.iterations || PBKDF2_ITERATIONS)
  const plain = await subtle().decrypt({ name: 'AES-GCM', iv: fromB64(blob.iv) }, key, fromB64(blob.data))
  return JSON.parse(dec.decode(plain))
}
