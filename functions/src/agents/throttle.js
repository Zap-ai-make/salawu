/**
 * throttle.js — limite de débit par adresse IP sur l'endpoint PUBLIC `agentSignIn`.
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CETTE BRIQUE FERME, ET POURQUOI LE VERROU EXISTANT NE SUFFIT PAS
 *
 * `agentSignIn` porte déjà un anti-force-brute : cinq échecs sur un credential le
 * verrouillent cinq minutes (`failedAttempts` / `lockedUntil`). Ce verrou protège
 * UN AGENT CONNU contre la devinette de son code. Il ne protège RIEN contre un
 * flot d'identifiants INCONNUS :
 *
 *   · aucun credential ne correspond → il n'y a rien à verrouiller, donc aucun
 *     compteur ne s'incrémente ;
 *   · et le chemin « identifiant inconnu » exécute quand même un `scryptSync`
 *     complet — le leurre anti-timing (F1) — qui est BLOQUANT pour la boucle
 *     d'évènements de Node.
 *
 * Autrement dit : un attaquant obtient un scrypt + une requête Firestore par
 * paquet envoyé, indéfiniment, sur un endpoint public et non authentifié. C'est
 * le vecteur de coût qui faisait d'App Check une PRÉCONDITION (M1) avant
 * l'ouverture publique.
 *
 * ⚠ POURQUOI PAS APP CHECK. L'app mobile est écrite avec le SDK JavaScript de
 * Firebase, dont les fournisseurs App Check reposent sur reCAPTCHA — pensé pour
 * le web, sans objet sur un téléphone. Exiger App Check obligerait l'app à
 * passer au SDK natif, donc un nouveau binaire et une réinstallation chez chaque
 * agent. La limite de débit atteint le même but de coût, côté serveur seul, et
 * ne demande RIEN à l'application.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TROIS DÉCISIONS QUI MÉRITENT D'ÊTRE ÉCRITES
 *
 * 1. ⚠ PAR IP, ET GÉNÉREUSEMENT. Un marché entier peut sortir derrière une seule
 *    IP (NAT). La limite doit donc être large par rapport à l'usage réel — un
 *    agent se connecte rarement — et serrée par rapport à un flot. Vingt
 *    tentatives par dix minutes tient les deux bouts.
 *
 * 2. ⚠ SANS IP LISIBLE, ON LAISSE PASSER. C'est un choix, et il va à l'encontre
 *    du réflexe « fail closed ». La raison : cette brique est un garde-fou de
 *    COÛT, pas un contrôle d'autorisation — le verrou par credential, lui, reste
 *    en place et protège les comptes. Si la plateforme cessait un jour de poser
 *    `x-forwarded-for`, un repli « tout le monde dans le même seau » mettrait
 *    TOUS les agents hors service après vingt connexions. Une panne totale est
 *    pire que la dépense qu'on évitait.
 *
 * 3. ⚠ UNE REQUÊTE DÉJÀ BLOQUÉE N'ÉCRIT PAS. Sous un flot, réécrire le compteur
 *    à chaque paquet viserait le même document des centaines de fois par
 *    seconde — au-delà de ce qu'un document Firestore encaisse, et on paierait
 *    l'attaque en écritures. Une fois `blockedUntil` posé, le refus ne coûte
 *    qu'une lecture.
 *
 * L'IP est HACHÉE avant de servir d'identifiant de document : une adresse est
 * une donnée personnelle, et le hachage évite au passage les deux-points d'IPv6.
 */

import { createHash } from 'node:crypto'
import { DealerRequestError } from '../errors.js'

export const THROTTLE_WINDOW_MS = 10 * 60 * 1000 // 10 minutes
export const THROTTLE_MAX_ATTEMPTS = 20
export const THROTTLE_BLOCK_MS = 15 * 60 * 1000 // 15 minutes
export const THROTTLE_COLLECTION = 'agentSignInThrottle'

/**
 * L'adresse du client, telle que la passe le frontal Google.
 *
 * `x-forwarded-for` est une LISTE : le premier élément est le client, les
 * suivants sont les relais. Prendre le dernier donnerait l'IP de Google, donc un
 * seau unique pour la planète entière.
 *
 * @returns {string | null} null si rien n'est lisible (voir décision 2).
 */
export function clientIpFrom(rawRequest) {
  const xff = rawRequest?.headers?.['x-forwarded-for']
  if (typeof xff === 'string' && xff.trim()) return xff.split(',')[0].trim()
  if (Array.isArray(xff) && xff.length > 0) {
    const premier = String(xff[0] ?? '').split(',')[0].trim()
    if (premier) return premier
  }
  const ip = rawRequest?.ip
  return typeof ip === 'string' && ip.trim() ? ip.trim() : null
}

/** L'identifiant de document : une empreinte, jamais l'adresse en clair. */
export function ipBucket(ip) {
  return createHash('sha256').update(String(ip)).digest('hex').slice(0, 32)
}

/**
 * L'état suivant du compteur — PUR, donc éprouvable sans émulateur ni horloge.
 *
 * Fenêtre glissante par blocs : hors fenêtre, le compteur repart de zéro et la
 * fenêtre est replacée à maintenant.
 */
export function nextThrottleState(data, now, options = {}) {
  const fenetreMs = options.fenetreMs ?? THROTTLE_WINDOW_MS
  const max = options.max ?? THROTTLE_MAX_ATTEMPTS
  const blocageMs = options.blocageMs ?? THROTTLE_BLOCK_MS

  const debut = Number(data?.windowStart)
  const dansLaFenetre = Number.isFinite(debut) && debut <= now && now - debut < fenetreMs

  const count = (dansLaFenetre ? Number(data?.count) || 0 : 0) + 1
  const windowStart = dansLaFenetre ? debut : now

  return {
    count,
    windowStart,
    blockedUntil: count > max ? now + blocageMs : null,
  }
}

/** Vrai si l'état stocké interdit encore l'appel. */
export function isThrottled(data, now) {
  const jusqua = Number(data?.blockedUntil)
  return Number.isFinite(jusqua) && jusqua > now
}

/**
 * Le garde. Lance TOO_MANY_ATTEMPTS si l'IP a dépassé sa part.
 *
 * À appeler AVANT toute dépense — avant la requête Firestore de résolution et
 * avant le moindre scrypt. Un garde posé après ne garderait rien.
 */
export async function assertUnderRateLimit(db, rawRequest, now) {
  const ip = clientIpFrom(rawRequest)
  if (!ip) return // décision 2 : pas d'IP lisible → on laisse passer.

  const ref = db.doc(`${THROTTLE_COLLECTION}/${ipBucket(ip)}`)

  const bloque = await db.runTransaction(async (t) => {
    const snap = await t.get(ref)
    const data = snap.exists ? snap.data() : null

    // Déjà bloqué : on refuse SANS écrire (décision 3).
    if (isThrottled(data, now)) return true

    const etat = nextThrottleState(data, now)
    t.set(ref, {
      ...etat,
      // Pour une future politique TTL Firestore : ce lot ne la crée pas, et ces
      // documents sont minuscules. Le champ est posé pour qu'elle soit possible
      // sans reprise de données.
      expiresAt: new Date(now + THROTTLE_WINDOW_MS + THROTTLE_BLOCK_MS),
    })
    return etat.blockedUntil !== null
  })

  if (bloque) {
    // Message volontairement muet sur la cause exacte, comme les autres erreurs
    // de cet endpoint (anti-énumération).
    throw new DealerRequestError('TOO_MANY_ATTEMPTS', 'Trop de tentatives. Réessayez plus tard.')
  }
}
