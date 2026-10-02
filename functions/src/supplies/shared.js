/**
 * shared.js — helpers purs des RAVITAILLEMENTS (storeSupplies).
 *
 * Sémantique métier :
 *   Un ravitaillement CRÉDITE une carte de la boutique (stock ou liquidité d'un
 *   réseau). C'est de l'argent qui entre sans passer par le dealer : un apport du
 *   gérant, un retour de terrain, une régularisation d'ouverture.
 *
 * ⚠ CE MODULE EXISTE PARCE QUE L'ÉCRITURE DIRECTE DU SOLDE N'A PAS DE MÉMOIRE.
 *
 * Avant lui, augmenter un stock se faisait par le crayon de la carte réseau :
 * `setNetworkBalance` écrivait le montant ABSOLU, depuis le client, sans rien
 * consigner. firestore.rules l. 583-589 le nommait déjà : « un compte boutique
 * compromis peut fixer un solde arbitraire SANS piste d'audit. Migration
 * éventuelle vers une Cloud Function auditée = chantier séparé ». C'est ce
 * chantier.
 *
 * D'où la forme des trois handlers : ils n'écrivent JAMAIS un solde absolu. Ils
 * appliquent un DELTA lu dans la transaction, et le consignent. Un montant
 * absolu venu du client permettrait de réécrire un solde en se faisant passer
 * pour un ravitaillement — le défaut aurait changé de porte, pas disparu.
 *
 * Aucune dépendance externe (testables directement). Les validations échouées
 * lancent DealerRequestError (jamais HttpsError) : index.js les convertit.
 */

import { DealerRequestError } from '../errors.js'
import { STORE_NETWORKS } from '../config/storeProfile.js'

/** Les deux ressources d'une carte réseau. Orthographe Firestore : sans accent. */
export const SUPPLY_RESOURCES = new Set(['stock', 'liquidite'])

/** Un ravitaillement vivant, ou annulé. Il n'est jamais supprimé. */
export const SUPPLY_STATUSES = Object.freeze({
  ACTIVE: 'active',
  CANCELLED: 'cancelled',
})

// ── Réseau crédité ───────────────────────────────────────────────────────────
//
// Validé contre `networks.enabled` (STORE_NETWORKS) et NON contre le circuit
// dealer : on crédite une carte de la boutique, pas une livraison. Voir l'en-tête
// de scripts/lib/generateStoreProfile.mjs.
//
// Défaut préservant : un profil mono-réseau (TAOFIC) résout son réseau unique
// sans que le client ait à l'envoyer. Un profil multi-réseaux EXIGE un réseau
// explicite — aucun choix silencieux sur une opération qui déplace de l'argent.
export function resolveSupplyNetwork(candidate, storeNetworks = STORE_NETWORKS) {
  const list = Array.isArray(storeNetworks) ? storeNetworks : [...storeNetworks]
  if (candidate == null || candidate === '') {
    if (list.length === 1) return list[0]
    throw new DealerRequestError('INVALID_SUPPLY_NETWORK', 'Réseau requis (profil multi-réseaux).')
  }
  if (!list.includes(candidate)) {
    throw new DealerRequestError('INVALID_SUPPLY_NETWORK', 'Réseau non reconnu pour cette boutique.')
  }
  return candidate
}

// ── Ressource créditée ───────────────────────────────────────────────────────
export function validateSupplyResource(resource) {
  if (typeof resource !== 'string' || !SUPPLY_RESOURCES.has(resource)) {
    throw new DealerRequestError('INVALID_SUPPLY_RESOURCE', 'Ressource invalide (stock ou liquidite).')
  }
  return resource
}

// ── Montant ──────────────────────────────────────────────────────────────────
//
// Entier strictement positif. Le FCFA n'a pas de subdivision en usage courant,
// et un décimal sur un solde entier produirait une dérive invisible à l'écran.
// `Number.isSafeInteger` borne aussi par le haut : au-delà, l'addition ment.
export function validateSupplyAmount(amount) {
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0) {
    throw new DealerRequestError('INVALID_SUPPLY_AMOUNT', 'Montant invalide : entier strictement positif requis.')
  }
  return amount
}

export function validateSupplyId(supplyId) {
  if (!supplyId || typeof supplyId !== 'string' || supplyId.trim() === '') {
    throw new DealerRequestError('INVALID_SUPPLY_ID', 'Identifiant de ravitaillement requis.')
  }
  return supplyId.trim()
}

// ── Motif (correction / annulation) ──────────────────────────────────────────
//
// Facultatif mais BORNÉ : une chaîne libre non bornée finit par porter une pièce
// jointe entière, et ce champ est relu dans un tableau d'historique.
export function validateSupplyReason(reason, { required = false } = {}) {
  if (reason == null || reason === '') {
    if (required) throw new DealerRequestError('INVALID_SUPPLY_REASON', 'Motif requis.')
    return null
  }
  if (typeof reason !== 'string') {
    throw new DealerRequestError('INVALID_SUPPLY_REASON', 'Motif invalide.')
  }
  const trimmed = reason.trim()
  if (trimmed === '') {
    if (required) throw new DealerRequestError('INVALID_SUPPLY_REASON', 'Motif requis.')
    return null
  }
  if (trimmed.length > 300) {
    throw new DealerRequestError('INVALID_SUPPLY_REASON', 'Motif trop long (300 caractères maximum).')
  }
  return trimmed
}

// ── Lecture du solde courant d'une carte ─────────────────────────────────────
//
// Renvoie 0 pour un réseau encore absent du document : une boutique qui n'a
// jamais touché à Wave n'a pas de clé `balances.Wave`, et c'est un solde nul,
// pas une donnée corrompue. Une valeur PRÉSENTE mais non entière, en revanche,
// est un refus : on ne devine pas un montant.
export function readSupplyBalance(balanceData, network, resource) {
  if (!balanceData || typeof balanceData !== 'object') {
    throw new DealerRequestError('BALANCE_NOT_FOUND', 'Document de soldes introuvable ou invalide.')
  }
  const balances = balanceData.balances
  if (!balances || typeof balances !== 'object') {
    throw new DealerRequestError('BALANCE_NOT_FOUND', 'Document de soldes introuvable ou invalide.')
  }
  const card = balances[network]
  if (card == null) return 0
  if (typeof card !== 'object') {
    throw new DealerRequestError('INVALID_BALANCE_DATA', 'Le solde actuel est invalide.')
  }
  const value = card[resource]
  if (value == null) return 0
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new DealerRequestError('INVALID_BALANCE_DATA', 'Le solde actuel est invalide.')
  }
  return value
}

// ── Application d'un delta au solde ──────────────────────────────────────────
//
// Le SEUL endroit qui calcule un nouveau solde de ravitaillement. Les trois
// handlers passent par ici, donc les deux bornes — pas de négatif, pas de
// dépassement — valent pour la création comme pour la correction et l'annulation.
//
// Un delta négatif qui dépasse le solde n'est pas une erreur de saisie : c'est
// une boutique qui a déjà dépensé l'argent qu'on veut lui reprendre. Le code
// métier le dit (INSUFFICIENT_BALANCE_FOR_REVERSAL) au lieu de raboter à zéro,
// ce que faisait l'ancien `Math.max(0, …)` — en faisant disparaître la dette
// sans que personne ne le sache.
export function applySupplyDelta(previousBalance, delta) {
  const next = previousBalance + delta
  if (next < 0) {
    throw new DealerRequestError(
      'INSUFFICIENT_BALANCE_FOR_REVERSAL',
      'Solde insuffisant : la correction reprendrait plus que ce que porte la carte.',
    )
  }
  if (!Number.isSafeInteger(next)) {
    throw new DealerRequestError('BALANCE_OVERFLOW', 'Le nouveau solde dépasse la limite autorisée.')
  }
  return next
}

// ── Relecture d'un ravitaillement dans la transaction ────────────────────────
//
// Garde de cloisonnement : un ravitaillement n'appartient qu'à SA boutique. Le
// storeId comparé vient du PROFIL relu dans la transaction, jamais du payload.
export function validateSupplyForWrite(supplyData, actorStoreId) {
  if (!supplyData || typeof supplyData !== 'object') {
    throw new DealerRequestError('SUPPLY_NOT_FOUND', 'Ravitaillement introuvable.')
  }
  if (supplyData.storeId !== actorStoreId) {
    throw new DealerRequestError('SUPPLY_STORE_MISMATCH', "Ce ravitaillement n'appartient pas à votre boutique.")
  }
  if (supplyData.status === SUPPLY_STATUSES.CANCELLED) {
    throw new DealerRequestError('SUPPLY_ALREADY_CANCELLED', 'Ce ravitaillement est déjà annulé.')
  }
  const network = supplyData.network
  const resource = supplyData.resource
  const amount = supplyData.amount
  if (
    typeof network !== 'string' || network === '' ||
    !SUPPLY_RESOURCES.has(resource) ||
    typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0
  ) {
    throw new DealerRequestError('INVALID_BALANCE_DATA', 'Les données de ce ravitaillement sont invalides.')
  }
  return { network, resource, amount }
}
