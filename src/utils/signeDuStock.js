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

/**
 * Le montant TEL QU'IL S'AFFICHE : le nombre signé, et son unité.
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ DEUX DÉFAUTS SYMÉTRIQUES, DANS DEUX TABLEAUX, NÉS DE LA MÊME CAUSE : chaque
 * appelant recollait lui-même le montant et « FCFA ».
 *
 *   `TransactionTable` concaténait ` FCFA` SANS CONDITION. Sur un montant
 *   absent, `montantSigne` rend `''` : la cellule affichait « FCFA » tout seul —
 *   une devise sans somme, dans la colonne d'argent d'un écran de caisse.
 *
 *   `HistoriqueTable` conditionnait l'unité à `montant || amount`. Sur un
 *   montant de ZÉRO ce test est faux, et la cellule affichait un « 0 » nu
 *   pendant que ses voisines portaient leur devise.
 *
 * Recoller un nombre et son unité n'est pas l'affaire d'un tableau : c'est la
 * même décision que le signe, et elle vit donc ici.
 *
 * ⚠ LE REPLI EST UN TIRET, ET NON « 0 FCFA ». Un montant illisible n'est pas un
 * montant nul : écrire « 0 FCFA » AFFIRME qu'il ne s'est rien passé, là où l'on
 * sait seulement qu'on ne sait pas. C'est la règle de TC-172 — le silence plutôt
 * qu'un chiffre faux — appliquée à une cellule.
 *
 * @param {*} montant
 * @param {string} type
 * @param {{vide?: string}} [options] `vide` : ce qu'affiche un montant illisible.
 * @returns {string}
 */
export function montantSigneAffiche(montant, type, { vide = '—' } = {}) {
  const texte = montantSigne(montant, type)
  return texte === '' ? vide : `${texte} FCFA`
}

/**
 * Le sens d'une ligne, dans l'ordre de ce qui est le plus sûr.
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ LE LIBELLÉ D'ABORD, ET C'EST LE POINT DÉLICAT. Pour une OPÉRATION, le sens
 * se lit sur le STOCK — un dépôt le fait sortir — alors que sa `direction` dit
 * la CAISSE, où le même dépôt fait entrer. Les deux lectures sont vraies, et le
 * produit a tranché pour le stock. Laisser la direction passer devant annulerait
 * cette décision en silence, sur la colonne la plus regardée de l'historique.
 *
 * ⚠ LA DIRECTION ENSUITE, ET ELLE MANQUAIT. `sensDuStock` ne connaît que
 * « Dépôt » et « Retrait ». L'Historique emploie pourtant le même badge pour ses
 * onglets Collaborations (« Reçue » / « Envoyée ») et Dettes internes
 * (« Dette » / « Créance ») : les quatre tombaient sur `neutre`, donc GRIS. Et
 * comme le rendu « registre » vide aussi le liseré et le fond de ligne, l'entrée
 * et la sortie n'étaient plus dites par RIEN sur ces deux onglets.
 *
 * La `direction` était pourtant là, calculée par l'écran juste avant l'appel
 * (`directionFromSens`), et déjà employée par le rendu historique pour ces mêmes
 * quatre mots. On ne décide donc rien de neuf : on cesse de jeter ce que
 * l'appelant a déjà établi.
 *
 * ⚠ ÉCRITE ICI ET NON DANS `DirectionBadge`, pour qu'elle soit éprouvable. Dans
 * le composant, elle vivait derrière `IS_REGISTRE` : sous le profil des tests
 * (TAOFIC), la branche n'est pas prise et un cas qui l'interroge passe au vert
 * sans avoir rien vérifié. Une règle qu'on ne peut tester que sous un profil
 * n'est pas gardée.
 *
 * @param {'in'|'out'|'neutral'|undefined} direction
 * @param {string} libelle
 * @returns {{cle: string, signe: string}}
 */
export function sensAvecDirection(direction, libelle) {
  const parLeLibelle = sensDuStock(libelle)
  if (parLeLibelle !== SENS_STOCK.NEUTRE) return parLeLibelle
  if (direction === 'in') return SENS_STOCK.ENTREE
  if (direction === 'out') return SENS_STOCK.SORTIE
  return SENS_STOCK.NEUTRE
}
