/**
 * signeDuStock.js — le signe d'une opération, et la grandeur qu'il mesure.
 * ─────────────────────────────────────────────────────────────────────────────
 * LA QUESTION QUE CE FICHIER TRANCHE
 *
 * Un dépôt fait ENTRER des espèces dans la caisse et SORTIR du stock
 * électronique. Les deux sont vrais en même temps. Un signe posé devant un
 * montant ne dit donc rien tant qu'on n'a pas dit DE QUELLE GRANDEUR il parle —
 * et selon la réponse, le même « + » désigne deux mouvements opposés.
 *
 * Décision du client, 2026-09-18 : le signe suit le STOCK ÉLECTRONIQUE, sur
 * Transactions ET sur Historique.
 *
 *   Dépôt   → le stock SORT   → −
 *   Retrait → le stock RENTRE → +
 *
 * ⚠ C'EST UN ÉCART ASSUMÉ À LA MAQUETTE, et il faut le savoir en lisant ce
 * fichier. Elle porte DEUX phrases de convention : « l'effet sur le stock
 * électronique » sur certains écrans, « l'effet sur la caisse » sur d'autres.
 * Le client a choisi une convention unique. Un caissier apprend alors une règle
 * au lieu de deux, au prix d'une tension visible : la ligne « − Dépôt » porte un
 * bouton « Encaisser ». Les deux disent vrai — on encaisse des espèces pendant
 * que le stock baisse — et c'est exactement pour cela que la PHRASE DE
 * CONVENTION est obligatoire sur chaque écran qui affiche ces signes. Sans elle,
 * le signe ment à l'une des deux grandeurs.
 *
 * ⚠ AUCUN CALCUL DE SOLDE NE PASSE PAR ICI. C'est de l'AFFICHAGE : le montant
 * stocké ne change pas de signe, et `financialImpact.js` reste la seule source
 * de vérité pour les soldes. Ce fichier ne décide que de ce qu'on MONTRE.
 */

import { normalizeTransactionLabel } from './financialImpact.js'

export const SENS_STOCK = Object.freeze({
  SORTIE: Object.freeze({ cle: 'sortie', signe: '−' }),
  ENTREE: Object.freeze({ cle: 'entree', signe: '+' }),
  NEUTRE: Object.freeze({ cle: 'neutre', signe: '' }),
})

/**
 * ⚠ LE SIGNE EST UN MOINS TYPOGRAPHIQUE (U+2212), PAS UN TRAIT D'UNION.
 *
 * Ce n'est pas du purisme. Les montants sont rendus en chasse fixe avec
 * `font-variant-numeric: tabular-nums` pour que les colonnes s'alignent : dans
 * IBM Plex Mono, le moins mathématique a la même largeur qu'un chiffre, et le
 * trait d'union non. Une colonne mêlant les deux perd l'alignement qui justifie
 * toute la typographie des montants de ce produit.
 */

/**
 * Le sens d'une opération CLIENT du point de vue du stock électronique.
 *
 * @param {string} type — « Dépôt », « Retrait », « Crédit »…
 * @returns {{cle: string, signe: string}}
 */
export function sensDuStock(type) {
  const t = normalizeTransactionLabel(type)
  if (t === 'depot') return SENS_STOCK.SORTIE
  if (t === 'retrait') return SENS_STOCK.ENTREE
  // Un crédit ne déplace pas de stock : c'est une créance. Il ne reçoit donc
  // AUCUN signe, plutôt qu'un zéro qui laisserait croire à un mouvement nul.
  return SENS_STOCK.NEUTRE
}

/**
 * Le montant tel qu'il s'affiche : signe, séparateurs de milliers, sans devise.
 * La devise reste au composant, qui la place dans sa propre cellule.
 *
 * Un montant absent ou illisible rend une chaîne vide plutôt que « NaN » ou
 * « −NaN » : un tableau de caisse ne doit jamais afficher un mot technique.
 *
 * ⚠ `Number` et non `parseFloat` : sur « 12 000 », `parseFloat` s'arrête à
 * l'espace et rend 12. Le piège a déjà coûté un lot dans ce dépôt.
 */
export function montantSigne(montant, type) {
  if (montant === null || montant === undefined || montant === '') return ''
  const valeur = Number(montant)
  if (!Number.isFinite(valeur)) return ''

  // ⚠ ZÉRO NE SE SIGNE PAS — défaut trouvé par TC-174 à la première exécution.
  // La règle rendait « −0 » pour un dépôt à zéro : un moins devant rien, qui
  // annonce un mouvement là où il n'y en a aucun. Le signe dit un SENS de
  // déplacement ; sans déplacement, il n'a rien à dire.
  const absolu = Math.abs(valeur)
  if (absolu === 0) return '0'

  const { signe } = sensDuStock(type)
  // La valeur absolue : le signe est porté par la CONVENTION, pas par la donnée.
  // Un montant stocké négatif ne doit pas produire « −−1 250 000 ».
  return `${signe}${absolu.toLocaleString('fr-FR')}`
}
