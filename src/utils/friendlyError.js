/**
 * friendlyError.js — Message d'erreur toujours présentable à l'utilisateur.
 *
 * Garantit qu'AUCUN texte technique/anglais brut (« internal », « unavailable »,
 * « permission-denied », « Missing or insufficient permissions »…) n'atteint l'écran,
 * tout en PRÉSERVANT les messages métier déjà rédigés en français côté serveur.
 *
 * Règle :
 *   1. Erreur métier d'une Cloud Function (elle porte `details.code`) → le message serveur
 *      est déjà en français (DealerRequestError). On le garde tel quel.
 *   2. Sinon (erreur infra Firebase/Firestore, ou inconnue) → message français non technique
 *      via getUserFriendlyMessage() (classé par code : réseau / permission / session /
 *      introuvable / quota / délai / validation / générique).
 */

import { getUserFriendlyMessage } from './errorHandler'

export function toUserMessage(err) {
  // 1) Erreur métier remontée par une Cloud Function : message serveur déjà en français.
  const detailCode = err?.details?.code
  if (detailCode && typeof err?.message === 'string' && err.message.trim() !== '') {
    return err.message
  }
  // 2) Erreur infra / inconnue : message générique français, jamais technique.
  return getUserFriendlyMessage(err ?? {})
}
