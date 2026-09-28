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
 *
 * ⚠ DEUX GARDES, ET ILS NE COUVRENT PAS LA MÊME CHOSE.
 *   · Le verrou par credential (étape 5) protège UN COMPTE contre la devinette
 *     de son code. Il suppose qu'un credential a été trouvé.
 *   · La limite de débit par IP (étape 2) protège LE SERVEUR contre un flot
 *     d'identifiants inconnus — là où il n'y a rien à verrouiller, et où chaque
 *     paquet coûtait pourtant un scrypt bloquant. Voir agents/throttle.js.
 */

import { DealerRequestError } from '../errors.js'
import { validateInputPayload } from '../dealerRequests/shared.js'
import { MOBILE_APP } from '../config/mobileAppProfile.js'
import {
  validateLoginIdentifier,
  validateLoginCode,
  verifyAccessCode,
  dummyVerify,
  nextFailureState,
  isLocked,
} from './shared.js'
import { assertUnderRateLimit } from './throttle.js'

const GENERIC_INVALID = 'Identifiant ou code incorrect.'

export async function agentSignInHandler(request, { db, FieldValue, createCustomToken, logError }) {
  // ── 1. Garde fonctionnalité (off chez TAOFIC) ───────────────────────────────
  if (!MOBILE_APP.enabled) {
    throw new DealerRequestError('MOBILE_APP_DISABLED', "L'app mobile agents n'est pas activée.")
  }

  // ── 2. Limite de débit par IP — AVANT TOUTE DÉPENSE ─────────────────────────
  // Le verrou par credential (étape 5) ne sait verrouiller qu'un compte TROUVÉ.
  // Sur un identifiant inconnu il n'a rien à verrouiller, et le serveur a pourtant
  // déjà payé une requête Firestore et un `scryptSync` bloquant (le leurre F1).
  // Ce garde-là compte TOUTES les tentatives, connues ou non. Posé après la
  // résolution, il ne garderait plus rien — c'est la résolution qui coûte.
  // Il remplace App Check comme précondition d'ouverture publique : l'app mobile
  // est en SDK JavaScript, dont les fournisseurs App Check sont à base de
  // reCAPTCHA, sans objet sur un téléphone. Détail : agents/throttle.js.
  const now = Date.now()
  await assertUnderRateLimit(db, request.rawRequest, now)

  // ── 3. Entrées (liste blanche ; storeId optionnel pour désambiguïser) ────────
  const payload = validateInputPayload(request.data, ['identifier', 'code', 'storeId'])
  const identifier = validateLoginIdentifier(payload.identifier)
  const code = validateLoginCode(payload.code)
  const storeId = typeof payload.storeId === 'string' && payload.storeId.trim() ? payload.storeId.trim() : null

  // ── 4. Résolution du credential par identifiant (index array-contains auto) ──
  const snap = await db.collection('agentCredentials')
    .where('loginIdentifiers', 'array-contains', identifier)
    .limit(10).get()

  let candidates = snap.docs
    .map((d) => ({ ref: d.ref, data: d.data() }))
    .filter((c) => c.data.active !== false)
  if (storeId) candidates = candidates.filter((c) => c.data.storeId === storeId)

  if (candidates.length === 0) {
    // Aucun credential : leurre anti-timing (F1) pour égaliser le temps avec le chemin
    // « candidat + mauvais code », puis erreur générique (anti-énumération).
    dummyVerify()
    throw new DealerRequestError('INVALID_CREDENTIALS', GENERIC_INVALID)
  }

  // ── 5. Le code désigne le credential (secret unique) ─────────────────────────
  const matched = candidates.find((c) => verifyAccessCode(code, c.data.codeHash, c.data.codeSalt))

  if (!matched) {
    // Mauvais code : incrémente le compteur (borné) sur les candidats NON verrouillés.
    await Promise.all(candidates.map((c) => registerFailedAttempt(db, FieldValue, c.ref, now)))
    throw new DealerRequestError('INVALID_CREDENTIALS', GENERIC_INVALID)
  }

  if (isLocked(matched.data, now)) {
    throw new DealerRequestError('ACCOUNT_LOCKED', 'Trop de tentatives. Réessayez plus tard.')
  }

  // ── 6. Succès : reset compteur + émission du jeton personnalisé ──────────────
  await matched.ref.update({
    failedAttempts: 0,
    lockedUntil: null,
    lastLoginAt: FieldValue.serverTimestamp(),
  })

  // ⚠ `codeVersion` DANS LES CLAIMS : c'est ce qui rend une session révocable.
  // Sans lui, rien dans le jeton ne dit de QUELLE génération de code il provient,
  // et `agentSessionCheck` n'aurait rien à comparer. Le champ existe déjà sur le
  // credential et s'incrémente à chaque régénération.
  const claims = {
    role: 'agent',
    clientId: matched.data.clientId,
    storeId: matched.data.storeId,
    codeVersion: Number(matched.data.codeVersion) || 1,
  }
  // ⚠ LA SEULE ETAPE QUI SORT DE FIRESTORE, ET LA SEULE JAMAIS EXERCEE EN TEST.
  // `createCustomToken` signe un JWT. Sans cle privee dans l'environnement, l'Admin
  // SDK passe par l'API IAM `signBlob` — qui exige le role « Service Account Token
  // Creator » sur le compte de service d'execution. Cette permission n'a jamais servi
  // ailleurs dans ce projet : agentSignIn est le seul emetteur de jeton. Le premier
  // passage REUSSI sur ce chemin est donc le premier moment ou elle peut manquer.
  //
  // Et la suite ne peut pas l'attraper : tous les cas injectent un faux emetteur.
  // C'est assume — l'alternative serait un emulateur Auth dans chaque cas — mais il
  // faut que la panne se NOMME quand elle arrive.
  let customToken
  try {
    customToken = await createCustomToken(matched.data.clientId, claims)
  } catch (err) {
    // ⚠ ON JOURNALISE ICI, ET C'EST INDISPENSABLE. `wrapCallable` ne journalise que
    // l'INATTENDU ; en convertissant cette panne en erreur metier, on la ferait
    // disparaitre du journal. On garde donc la trace nous-memes, et on garde le CODE
    // de l'erreur (`auth/insufficient-permission` par exemple) — pas son message,
    // pour ne pas contourner la redaction volontaire de logging.js.
    if (typeof logError === 'function') {
      logError({
        action: 'agentSignIn.createCustomToken',
        clientId: matched.data.clientId,
        errorType: err?.constructor?.name ?? 'Unknown',
        errorCode: typeof err?.code === 'string' ? err.code : null,
      })
    }
    throw new DealerRequestError('TOKEN_MINT_FAILED', "La session n'a pas pu etre ouverte. Reessayez.")
  }

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
