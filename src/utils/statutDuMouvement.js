/**
 * statutDuMouvement.js — ce que dit un statut, et de quoi on a le droit de le peindre.
 * ─────────────────────────────────────────────────────────────────────────────
 * LE DÉFAUT QUE CE MODULE EXISTE POUR FERMER
 *
 * `HistoriqueTable.jsx` peignait la pastille de statut en `bg-green-100
 * text-green-800` SANS JAMAIS REGARDER LE STATUT. Une opération « Annulée »
 * s'affichait donc dans le vert de la réussite, et sur un écran parcouru vite,
 * la couleur se lit avant le mot.
 *
 * Le banc le dénonce depuis qu'il a été écrit (`etats-limites.spec.js`,
 * « la couleur du statut ne contredit pas le mot ») et il était rouge : le
 * défaut avait été attribué au lot L8.4, qui a corrigé autre chose.
 *
 * ⚠ IL ÉTAIT INVISIBLE AVANT CE BANC, parce que le semis ne contenait que des
 * « Validée » — l'unique cas où ce code avait raison par accident.
 *
 * LA SÉMANTIQUE N'EST PAS INVENTÉE ICI : ELLE EST DÉJÀ ÉCRITE DANS LE PRODUIT
 *
 * `utils/chiffresDuJour.js` a dû trancher ce que chaque statut signifie pour
 * arrêter une caisse, et l'a écrit noir sur blanc. Ce module REPREND ces mots
 * au lieu d'en forger de nouveaux :
 *
 *   Validée        l'argent est effectivement entré.
 *   Non Terminées  l'opération a eu lieu, elle n'a rien encaissé — elle court
 *                  encore.
 *   Remboursée     l'opération a eu lieu, « elle a rendu ce qu'elle avait
 *                  prise ». Elle ne laisse rien derrière elle.
 *   Annulée        « seule une annulation n'a jamais existé ».
 *
 * CE QUE CELA DONNE, ET LES DEUX DÉCISIONS QUI MÉRITENT D'ÊTRE DÉFENDUES
 *
 *   Validée        → valide   (--entree)     rond
 *   Non Terminées  → attente  (--alerte)     losange
 *   Remboursée     → neutre   (--encre-doux) carré
 *   Annulée        → neutre   (--encre-doux) barre
 *
 * ⚠ 1. AUCUN STATUT D'OPÉRATION NE PREND `--echec`, ET C'EST DÉLIBÉRÉ.
 * Le jeton porte son propre contrat dans `src/index.css` : « RÉSERVÉ à
 * l'échec : aucune opération normale ne le porte ». Annuler ou rembourser sont
 * des gestes NORMAUX du comptoir, décidés par un agent — pas des pannes. Les
 * peindre en rouge accuserait d'erreur un travail correct, ce qui est
 * exactement la faute que le chantier a déjà corrigée sur « Crédit ».
 * `rejete` reste disponible, et il sert là où il y a vraiment rejet : la
 * décision sur une demande dealer.
 *
 * ⚠ 2. DEUX STATUTS PARTAGENT LA MÊME TEINTE, ET CE N'EST PAS UN RACCOURCI.
 * « Remboursée » et « Annulée » disent toutes deux « cette ligne n'a rien
 * laissé ». Rien ne les sépare sur l'axe réussite/échec, et leur inventer deux
 * couleurs pour les distinguer reviendrait à faire porter à la couleur une
 * information qu'elle ne peut pas porter. Ce qui les sépare, c'est le MOT —
 * qui est écrit en toutes lettres — et la FORME, qui est le troisième canal
 * exigé par la maquette : « une couleur, un mot, une forme. Aucune ne paraît
 * seule. » C'est pour cela que `forme` fait partie de ce qui est rendu ici, et
 * non d'une décoration ajoutée au goût de l'écran.
 *
 * PUREMENT PRÉSENTATIONNEL. Ce module ne décide d'aucun solde, d'aucun filtre,
 * d'aucun calcul : `financialImpact.js` et `chiffresDuJour.js` gardent cette
 * charge, et ce fichier ne fait que dire de quoi peindre un mot déjà décidé
 * ailleurs.
 */

import { normalizeTransactionLabel } from './financialImpact.js'
import { FIRESTORE_CONFIG } from '../constants/firestoreConstants.js'

/**
 * Les quatre paliers d'apparence de la maquette. `rejete` est déclaré et
 * VOLONTAIREMENT non attribué ici (cf. décision 1 de l'en-tête) : il existe
 * pour les écrans de décision, pas pour l'historique d'un comptoir.
 */
export const PALIER_STATUT = Object.freeze({
  VALIDE: Object.freeze({ cle: 'valide', forme: 'rond' }),
  ATTENTE: Object.freeze({ cle: 'attente', forme: 'losange' }),
  REJETE: Object.freeze({ cle: 'rejete', forme: 'losange' }),
  NEUTRE: Object.freeze({ cle: 'neutre', forme: 'barre' }),
})

const { STATUS } = FIRESTORE_CONFIG

/**
 * Table des quatre statuts que l'application ÉCRIT réellement
 * (`firestoreConstants.js`). Les clés sont normalisées une seule fois, au
 * chargement : comparer deux libellés accentués à chaque ligne d'un historique
 * de vingt lignes coûte, et se trompe dès qu'une casse change.
 */
const TABLE = new Map([
  [normalizeTransactionLabel(STATUS.VALIDATED), PALIER_STATUT.VALIDE],
  [normalizeTransactionLabel(STATUS.PENDING), PALIER_STATUT.ATTENTE],
  // « Remboursée » garde la teinte neutre mais sa propre forme : le carré la
  // sépare de l'annulation sans lui inventer une couleur (cf. décision 2).
  [normalizeTransactionLabel(STATUS.REFUNDED), Object.freeze({ cle: 'neutre', forme: 'carre' })],
  [normalizeTransactionLabel(STATUS.CANCELLED), PALIER_STATUT.NEUTRE],
])

/**
 * Palier d'apparence d'un statut d'opération.
 *
 * ⚠ UN STATUT INCONNU REND `neutre`, ET NE REND JAMAIS `valide`. C'est le seul
 * repli sûr : un libellé venu de Firestore qu'on ne reconnaît pas ne doit
 * surtout pas hériter du vert de la réussite — ce serait reproduire le défaut
 * d'origine, en plus discret. Le gris ne promet rien.
 *
 * @param {string} statut
 * @returns {{cle: string, forme: string}}
 */
export function palierDuStatut(statut) {
  return TABLE.get(normalizeTransactionLabel(statut)) ?? PALIER_STATUT.NEUTRE
}

/** @param {string} statut @returns {string} la clé de palier, pour `data-statut`. */
export function cleDuStatut(statut) {
  return palierDuStatut(statut).cle
}

/** @param {string} statut @returns {string} la forme, pour `data-forme`. */
export function formeDuStatut(statut) {
  return palierDuStatut(statut).forme
}
