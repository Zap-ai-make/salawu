/**
 * storeSupplyService.js — ravitaillements boutique (crédit d'une carte réseau).
 *
 * Écritures : exclusivement via Cloud Functions (httpsCallable). Aucun write
 * Firestore direct ici — le backend reste autoritatif (crédit du solde, registre
 * et piste d'audit dans UNE transaction). Lectures : abonnement temps réel
 * cloisonné par les règles (une boutique ne voit que ses ravitaillements).
 *
 * ⚠ LA REQUÊTE EST TOUJOURS CONTRAINTE PAR `storeId`. La règle Firestore lit
 * `resource.data.storeId` : une requête LIST non contrainte échoue EN BLOC, pas
 * document par document (leçon du bug « Dettes internes qui saute »). Retirer ce
 * `where` ne rendrait pas l'écran plus permissif — il le rendrait vide.
 *
 * Région Functions : europe-west1 (config dans src/config/firebase.js).
 */

import { httpsCallable } from 'firebase/functions'
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore'
import { functions, db } from '../config/firebase'
import { STORE_SUPPLIES_PAGE_SIZE } from '../constants/supplyConstants'
import { parseStrictInteger } from '../utils/parseStrictInteger'

const SUPPLIES_COLLECTION = 'storeSupplies'

// ── Mapping des codes métier → messages UI ───────────────────────────────────
//
// Chaque message dit ce qui s'est passé ET ce qu'on peut y faire. « Opération
// impossible » ne renseigne personne : sur un écran qui déplace de l'argent, un
// message vague transforme un refus explicable en panne supposée.
const ERROR_MESSAGES = {
  UNAUTHENTICATED:        'Votre session a expiré. Reconnectez-vous.',
  PROFILE_NOT_FOUND:      'Votre profil est introuvable.',
  PROFILE_INACTIVE:       'Votre compte est inactif.',
  ROLE_FORBIDDEN:         "Vous n'avez pas l'autorisation d'enregistrer un ravitaillement.",
  STORE_ID_REQUIRED:      'Identifiant de boutique manquant dans votre profil.',
  INVALID_SUPPLY_RESOURCE:'Choisissez stock ou liquidité.',
  INVALID_SUPPLY_AMOUNT:  'Montant invalide : un nombre entier supérieur à zéro est requis.',
  INVALID_SUPPLY_NETWORK: 'Choisissez un réseau de votre boutique.',
  INVALID_SUPPLY_ID:      'Ravitaillement invalide.',
  INVALID_SUPPLY_REASON:  'Le motif est requis (300 caractères maximum).',
  SUPPLY_NOT_FOUND:       'Ce ravitaillement est introuvable.',
  SUPPLY_STORE_MISMATCH:  "Ce ravitaillement n'appartient pas à votre boutique.",
  SUPPLY_ALREADY_CANCELLED: 'Ce ravitaillement est déjà annulé.',
  SUPPLY_UNCHANGED:       'Le montant est déjà celui-ci.',
  INSUFFICIENT_BALANCE_FOR_REVERSAL:
    "Solde insuffisant : la carte ne porte plus assez pour reprendre ce montant.",
  BALANCE_NOT_FOUND:      'Le solde est introuvable.',
  INVALID_BALANCE_DATA:   'Le solde actuel est invalide. Contactez un administrateur.',
  BALANCE_OVERFLOW:       'Le nouveau solde dépasse la limite autorisée.',
  TRANSACTION_FAILED:     "L'opération n'a pas pu être finalisée.",
}

export function mapSupplyError(err) {
  // Le code métier (details.code) est prioritaire : il distingue précisément les
  // cas. On ne retombe JAMAIS sur un message spécifique trompeur — le repli par
  // catégorie reste neutre.
  const detailCode = err?.details?.code
  if (detailCode) {
    const mapped = new Error(ERROR_MESSAGES[detailCode] || "L'opération n'a pas pu être finalisée.")
    mapped.code = detailCode
    return mapped
  }
  const funcCode = String(err?.code || '')
  let message = "Une erreur inattendue s'est produite."
  let code = ''
  if (funcCode.includes('unauthenticated'))          { message = ERROR_MESSAGES.UNAUTHENTICATED; code = 'UNAUTHENTICATED' }
  else if (funcCode.includes('permission-denied'))   { message = ERROR_MESSAGES.ROLE_FORBIDDEN; code = 'ROLE_FORBIDDEN' }
  else if (funcCode.includes('not-found'))           { message = ERROR_MESSAGES.SUPPLY_NOT_FOUND; code = 'SUPPLY_NOT_FOUND' }
  else if (funcCode.includes('failed-precondition')) { message = "Opération impossible dans l'état actuel."; code = 'FAILED_PRECONDITION' }
  else if (funcCode.includes('invalid-argument'))    { message = 'Données invalides.'; code = 'INVALID_ARGUMENT' }
  const mapped = new Error(message)
  mapped.code = code
  return mapped
}

// ── Commandes (callable) ─────────────────────────────────────────────────────

/**
 * Enregistre un ravitaillement : crédite la carte et écrit sa ligne de registre.
 *
 * @param {object} p
 * @param {string} p.resource - 'stock' | 'liquidite'
 * @param {number|string} p.amount - montant À AJOUTER (jamais un solde final)
 * @param {string} p.network - réseau de la boutique
 * @param {string} [p.note] - note libre, facultative
 */
export async function createStoreSupply({ resource, amount, network, note } = {}) {
  // Validation LOCALE minimale : elle évite un aller-retour réseau sur une
  // saisie manifestement fausse. Le backend revalide tout — il reste autoritatif.
  // parseStrictInteger refuse deja le vide, le decimal, le negatif et le zero.
  const parsed = parseStrictInteger(amount)
  if (parsed === null) throw new Error(ERROR_MESSAGES.INVALID_SUPPLY_AMOUNT)

  const callable = httpsCallable(functions, 'createStoreSupply')
  try {
    const res = await callable({ resource, amount: parsed, network, note: note ?? null })
    return res.data
  } catch (err) {
    throw mapSupplyError(err)
  }
}

/**
 * Corrige le montant d'un ravitaillement. Le solde bouge du DELTA, côté serveur.
 * Ni le réseau ni la ressource ne sont modifiables : se tromper de carte
 * s'annule et se ressaisit (deux gestes, deux traces).
 */
export async function correctStoreSupply({ supplyId, amount, reason } = {}) {
  // parseStrictInteger refuse deja le vide, le decimal, le negatif et le zero.
  const parsed = parseStrictInteger(amount)
  if (parsed === null) throw new Error(ERROR_MESSAGES.INVALID_SUPPLY_AMOUNT)

  const callable = httpsCallable(functions, 'correctStoreSupply')
  try {
    const res = await callable({ supplyId, amount: parsed, reason: reason ?? null })
    return res.data
  } catch (err) {
    throw mapSupplyError(err)
  }
}

/**
 * Annule un ravitaillement : le montant est repris et la ligne passe en
 * `cancelled`. Elle n'est PAS supprimée — le motif est donc requis.
 */
export async function cancelStoreSupply({ supplyId, reason } = {}) {
  const motif = typeof reason === 'string' ? reason.trim() : ''
  if (motif === '') throw new Error(ERROR_MESSAGES.INVALID_SUPPLY_REASON)

  const callable = httpsCallable(functions, 'cancelStoreSupply')
  try {
    const res = await callable({ supplyId, reason: motif })
    return res.data
  } catch (err) {
    throw mapSupplyError(err)
  }
}

// ── Lecture (temps réel) ─────────────────────────────────────────────────────

/**
 * Abonne un callback aux ravitaillements de la boutique, du plus récent au plus
 * ancien.
 *
 * ⚠ AUCUN FILTRE DE STATUT, ni ici ni chez l'appelant. Les lignes annulées
 * comptent dans la fenêtre et s'affichent barrées : les retirer après le
 * `limit()` serveur est le bug « limiter puis filtrer » (collaborations, dettes
 * internes), et un registre qui escamote ses annulations ne se recoupe plus avec
 * la carte qu'il justifie.
 */
export function subscribeStoreSupplies({
  storeId,
  limitCount = STORE_SUPPLIES_PAGE_SIZE,
  onUpdate,
  onError,
} = {}) {
  if (!storeId) { onUpdate?.([]); return () => {} }
  const q = query(
    collection(db, SUPPLIES_COLLECTION),
    where('storeId', '==', storeId),
    orderBy('createdAt', 'desc'),
    limit(limitCount),
  )
  return onSnapshot(
    q,
    (snap) => onUpdate?.(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => onError?.(mapSupplyError(err)),
  )
}
