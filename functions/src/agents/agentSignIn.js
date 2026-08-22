/**
 * Handler — connexion agent (app mobile).
 *
 * Endpoint PUBLIC (l'agent n'a pas encore d'identité) : l'app mobile envoie
 * `{ identifier, code, storeId? }` où identifier = un numéro OU code agent de la fiche,
 * et code = le code d'accès remis en boutique. Le serveur retrouve le credential par
 * `loginIdentifiers array-contains`, vérifie le code (hash scrypt, timing-safe), applique
 * l'anti-bruteforce (verrouillage après N échecs), puis émet un JETON PERSONNALISÉ Firebase
 * `uid = clientId` avec claims `{ role:'agent', clientId, storeId }`. L'app fait ensuite
 * `signInWithCustomToken`. AUCUNE lecture de données n'est encore autorisée (Lot 4).
 *
 * Messages d'erreur GÉNÉRIQUES (ne révèlent pas si l'identifiant existe). createCustomToken
 * injecté (testabilité : pas d'émulateur Auth requis en test handler).
 */

import { DealerRequestError } from '../errors.js'
import { validateInputPayload } from '../dealerRequests/shared.js'
import { MOBILE_APP } from '../config/mobileAppProfile.js'
import {
  validateLoginIdentifier,
  validateLoginCode,
  verifyAccessCode,
  nextFailureState,
  isLocked,
} from './shared.js'

const GENERIC_INVALID = 'Identifiant ou code incorrect.'

export async function agentSignInHandler(request, { db, FieldValue, createCustomToken }) {
  // ── 1. Garde fonctionnalité (off chez TAOFIC) ───────────────────────────────
  if (!MOBILE_APP.enabled) {
    throw new DealerRequestError('MOBILE_APP_DISABLED', "L'app mobile agents n'est pas activée.")
  }

  // ── 2. Entrées (liste blanche ; storeId optionnel pour désambiguïser) ────────
  const payload = validateInputPayload(request.data, ['identifier', 'code', 'storeId'])
  const identifier = validateLoginIdentifier(payload.identifier)
  const code = validateLoginCode(payload.code)
  const storeId = typeof payload.storeId === 'string' && payload.storeId.trim() ? payload.storeId.trim() : null

  // ── 3. Résolution du credential par identifiant (index array-contains auto) ──
  const snap = await db.collection('agentCredentials')
    .where('loginIdentifiers', 'array-contains', identifier)
    .limit(10).get()

  const now = Date.now()
  let candidates = snap.docs
    .map((d) => ({ ref: d.ref, data: d.data() }))
    .filter((c) => c.data.active !== false)
  if (storeId) candidates = candidates.filter((c) => c.data.storeId === storeId)

  if (candidates.length === 0) {
    // Aucun credential : rien à verrouiller, erreur générique (anti-énumération).
    throw new DealerRequestError('INVALID_CREDENTIALS', GENERIC_INVALID)
  }

  // ── 4. Le code désigne le credential (secret unique) ─────────────────────────
  const matched = candidates.find((c) => verifyAccessCode(code, c.data.codeHash, c.data.codeSalt))

  if (!matched) {
    // Mauvais code : incrémente le compteur (borné) sur les candidats NON verrouillés.
    await Promise.all(candidates.map((c) => registerFailedAttempt(db, FieldValue, c.ref, now)))
    throw new DealerRequestError('INVALID_CREDENTIALS', GENERIC_INVALID)
  }

  if (isLocked(matched.data, now)) {
    throw new DealerRequestError('ACCOUNT_LOCKED', 'Trop de tentatives. Réessayez plus tard.')
  }

  // ── 5. Succès : reset compteur + émission du jeton personnalisé ──────────────
  await matched.ref.update({
    failedAttempts: 0,
    lockedUntil: null,
    lastLoginAt: FieldValue.serverTimestamp(),
  })

  const claims = { role: 'agent', clientId: matched.data.clientId, storeId: matched.data.storeId }
  const customToken = await createCustomToken(matched.data.clientId, claims)
  return { success: true, customToken }
}

// Incrémente failedAttempts / pose un verrou, de façon atomique et bornée.
// Ne prolonge pas un verrou déjà actif (ne ré-verrouille pas un compte déjà verrouillé).
async function registerFailedAttempt(db, FieldValue, ref, now) {
  await db.runTransaction(async (t) => {
    const cur = await t.get(ref)
    if (!cur.exists) return
    const data = cur.data()
    if (isLocked(data, now)) return
    const next = nextFailureState(data.failedAttempts, now)
    t.update(ref, {
      failedAttempts: next.failedAttempts,
      lockedUntil: next.lockedUntil > 0 ? next.lockedUntil : (data.lockedUntil ?? null),
      updatedAt: FieldValue.serverTimestamp(),
    })
  })
}
