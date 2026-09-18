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
import { IS_REGISTRE } from '../constants/designSystem.js'

export const DIRECTION = Object.freeze({ IN: 'in', OUT: 'out', NEUTRAL: 'neutral' })

// Classes Tailwind par sens : pastille (badge), liseré gauche de ligne (accent),
// fond de ligne teinté (rowBg). Vert = entrée, orange = sortie, gris = neutre.
const DIRECTION_STYLES_LEGACY = Object.freeze({
  in:      { badge: 'bg-green-100 text-green-800',   accent: 'border-l-4 border-green-500',  rowBg: 'bg-green-50' },
  out:     { badge: 'bg-orange-100 text-orange-800', accent: 'border-l-4 border-orange-500', rowBg: 'bg-orange-50' },
  neutral: { badge: 'bg-gray-100 text-gray-700',     accent: 'border-l-4 border-gray-300',   rowBg: 'bg-white' },
})

/**
 * ⚠ SOUS L'IDENTITÉ « REGISTRE », LA LIGNE ENTIÈRE CESSE D'ÊTRE TEINTÉE (lot L8.4).
 * ─────────────────────────────────────────────────────────────────────────────
 * Trois porteurs disaient le même sens en même temps : la PASTILLE (« Dépôt » /
 * « Retrait », avec son mot), un LISERÉ de 4 px à gauche de la ligne, et le FOND
 * de la ligne entière. Deux d'entre eux ne disent le sens QUE par la couleur.
 *
 * La pastille reste : elle porte le MOT, et c'est elle qui satisfait
 * « aucune couleur ne porte seule une information ». Le liseré et le fond
 * partent — ils ne pouvaient rien dire à qui ne distingue pas le vert de
 * l'orange, et ils empêchaient la zébrure.
 *
 * ⚠ ET ILS EMPÊCHAIENT LA ZÉBRURE, littéralement. Elle était différée depuis le
 * lot L7.2b avec cette raison écrite : une ligne paire bleutée et une ligne
 * impaire verte auraient fait DEUX systèmes qui se contredisent, au lieu d'un
 * seul qui s'efface. Le fond sémantique retiré, la zébrure peut être posée —
 * c'est le même lot, et ce n'est pas une coïncidence.
 *
 * `badge` est donc conservé tel quel, et seuls `accent` et `rowBg` sont vidés.
 * Dérivé plutôt que recopié : une couleur ajoutée au rendu historique se
 * propage, et les deux jeux ne peuvent pas diverger en silence.
 */
const DIRECTION_STYLES_REGISTRE = Object.freeze(
  Object.fromEntries(
    Object.entries(DIRECTION_STYLES_LEGACY).map(([sens, v]) => [
      sens,
      { badge: v.badge, accent: '', rowBg: '' },
    ]),
  ),
)

export const DIRECTION_STYLES = IS_REGISTRE ? DIRECTION_STYLES_REGISTRE : DIRECTION_STYLES_LEGACY

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
