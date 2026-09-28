/**
 * Handler — `agentSessionCheck` : « ma session est-elle encore valable ? »
 * ─────────────────────────────────────────────────────────────────────────────
 * L'app mobile l'appelle à chaque contact réseau, avec son jeton courant. Le
 * serveur compare le `codeVersion` du claim à celui du credential, vérifie
 * `active`, et répond `{ valid }`. Aucun scrypt, aucun code d'accès en entrée :
 * une lecture de document.
 *
 * ⚠ CE GARDE EST CONSULTATIF, ET IL FAUT LE DIRE CLAIREMENT.
 *
 * Il ne vaut que si l'application l'appelle et honore la réponse. Un client
 * modifié peut simplement ne pas l'appeler : son jeton reste valide pour
 * Firestore, dont les règles ne consultent pas le credential.
 *
 * La coupure IMPOSÉE, elle, vient de `revokeRefreshTokens` — posé par
 * `generateAgentAccessCode`. Firebase refuse alors de renouveler le jeton, quoi
 * que fasse l'appareil, et la fenêtre se réduit à la durée de vie du jeton
 * d'identité en cours : une heure au plus.
 *
 * Les deux se complètent et ne se remplacent pas :
 *   · `revokeRefreshTokens` pose le plafond dur, sans rien demander à l'app ;
 *   · celui-ci rend la coupure quasi immédiate quand l'app coopère.
 *
 * Contre le scénario du cahier des charges — « une secrétaire part avec l'app
 * installée » — la coopération est acquise : elle ne repatchera pas l'APK.
 *
 * ⚠ PAS DE LIMITE DE DÉBIT ICI, contrairement à `agentSignIn`. L'appel est
 * AUTHENTIFIÉ (il faut déjà un jeton agent valide) et ne coûte qu'une lecture,
 * là où `agentSignIn` est public et paie un scrypt bloquant par appel.
 */

import { DealerRequestError } from '../errors.js'
import { MOBILE_APP } from '../config/mobileAppProfile.js'

export async function agentSessionCheckHandler(request, { db }) {
  // ── 1. Garde fonctionnalité (off chez TAOFIC) ───────────────────────────────
  if (!MOBILE_APP.enabled) {
    throw new DealerRequestError('MOBILE_APP_DISABLED', "L'app mobile agents n'est pas activée.")
  }

  // ── 2. Il faut un jeton, et un jeton d'AGENT ────────────────────────────────
  const uid = request.auth?.uid
  if (!uid) {
    throw new DealerRequestError('UNAUTHENTICATED', 'Authentification requise.')
  }
  if (request.auth?.token?.role !== 'agent') {
    throw new DealerRequestError('ROLE_FORBIDDEN', 'Action réservée à un agent.')
  }

  // ── 3. Comparaison : la version du jeton contre celle du credential ─────────
  // ⚠ `uid` ET NON une valeur du payload. L'uid est posé par Firebase à partir du
  // jeton : c'est la seule source d'autorité. Lire un identifiant envoyé par le
  // client permettrait d'interroger la session d'autrui.
  const snap = await db.doc(`agentCredentials/${uid}`).get()
  if (!snap.exists) return { valid: false }

  const data = snap.data()
  if (data.active === false) return { valid: false }

  // ⚠ UN JETON SANS `codeVersion` EST INVALIDE. Ce sont ceux émis avant ce lot.
  // Les accepter ouvrirait un contournement permanent : présenter un vieux jeton
  // suffirait à n'être jamais coupé. Le coût est une reconnexion, une fois.
  const duJeton = request.auth?.token?.codeVersion
  if (!Number.isFinite(Number(duJeton))) return { valid: false }

  return { valid: Number(duJeton) === Number(data.codeVersion) }
}
