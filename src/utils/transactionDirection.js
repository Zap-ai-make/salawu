/**
 * transactionDirection.js — sens d'une opération pour l'affichage de l'historique.
 *
 * ENTRÉE  = argent qui entre en boutique ; SORTIE = argent qui sort ; NEUTRE sinon.
 * PUREMENT PRÉSENTATIONNEL : n'affecte AUCUN calcul de solde (cf. financialImpact.js).
 * Source unique des couleurs entrée/sortie de la page Historique.
 *
 * Sémantique confirmée par le vocabulaire de règlement de l'app :
 *   - Dépôt  → « Encaissé par… » = ENTRÉE
 *   - Retrait → « Payé par… »    = SORTIE
 *   - Crédit → « Remboursé par… » = NEUTRE (créance)
 *   - Collaboration Reçue / Dette interne Créance = ENTRÉE
 *   - Collaboration Envoyée / Dette interne Dette = SORTIE
 */

import { normalizeTransactionLabel } from './financialImpact.js'

export const DIRECTION = Object.freeze({ IN: 'in', OUT: 'out', NEUTRAL: 'neutral' })

// Classes Tailwind par sens : pastille (badge), liseré gauche de ligne (accent),
// fond de ligne teinté (rowBg). Vert = entrée, orange = sortie, gris = neutre.
export const DIRECTION_STYLES = Object.freeze({
  in:      { badge: 'bg-green-100 text-green-800',   accent: 'border-l-4 border-green-500',  rowBg: 'bg-green-50' },
  out:     { badge: 'bg-orange-100 text-orange-800', accent: 'border-l-4 border-orange-500', rowBg: 'bg-orange-50' },
  neutral: { badge: 'bg-gray-100 text-gray-700',     accent: 'border-l-4 border-gray-300',   rowBg: 'bg-white' },
})

/** @param {string} direction @returns {{badge:string, accent:string, rowBg:string}} */
export function directionStyles(direction) {
  return DIRECTION_STYLES[direction] || DIRECTION_STYLES.neutral
}

/** Sens d'une transaction client d'après son type (Dépôt/Retrait/Crédit). */
export function directionFromType(type) {
  const t = normalizeTransactionLabel(type)
  if (t === 'depot') return DIRECTION.IN
  if (t === 'retrait') return DIRECTION.OUT
  return DIRECTION.NEUTRAL
}

/** Sens d'une ligne collaboration/dette d'après son libellé « Sens ». */
export function directionFromSens(sens) {
  const s = normalizeTransactionLabel(sens)
  if (s === 'recue' || s === 'creance') return DIRECTION.IN
  if (s === 'envoyee' || s === 'dette') return DIRECTION.OUT
  return DIRECTION.NEUTRAL
}
