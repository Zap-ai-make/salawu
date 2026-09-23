/**
 * chiffresDuJour.js — les deux nombres qu'un gérant demande en fin de journée.
 * ─────────────────────────────────────────────────────────────────────────────
 * RÈGLE MÉTIER, et non un calcul d'affichage. Ces deux nombres servent à
 * arrêter une caisse : « combien d'opérations aujourd'hui » et « combien
 * d'argent est entré ». C'est pour cela que la décision est une fonction pure,
 * testée, avec son horloge injectée — et non un `useMemo` au fond d'un
 * composant, où personne ne peut l'éprouver.
 *
 * DEUX QUESTIONS, DEUX RÉPONSES — ET CE N'EST PAS UNE INCOHÉRENCE
 *
 * Le produit répondait déjà aux deux, séparément, et pas avec le même filtre :
 *
 *   • `useTodayTransactions` (hook existant) exclut « Annulée » et garde le
 *     reste — y compris « Non Terminées » et « Remboursée ».
 *   • `CAChart` (graphique existant) ne somme QUE les « Validée ».
 *
 * On aurait pu croire à une divergence à corriger. C'en n'est pas une : ce sont
 * deux questions différentes.
 *
 *   L'ACTIVITÉ du jour compte ce qui s'est passé au comptoir. Une opération non
 *   terminée a bien eu lieu — le client s'est présenté, l'agent a saisi. Une
 *   opération remboursée aussi. Seule une annulation n'a jamais existé.
 *
 *   LE CHIFFRE D'AFFAIRES compte l'argent qui est effectivement entré. Une
 *   opération non terminée n'a rien encaissé ; une remboursée a rendu ce
 *   qu'elle avait pris.
 *
 * Ce module REPREND ces deux sémantiques au lieu d'en inventer une troisième.
 * Les changer serait une décision métier, pas un lot de design.
 *
 * ⚠ CONSÉQUENCE VISIBLE, ET ELLE EST VOULUE : les deux nombres ne se déduisent
 * pas l'un de l'autre. Un jour avec trois opérations en attente affichera une
 * activité supérieure à ce que le chiffre d'affaires laisse supposer. C'est la
 * réalité de la caisse, pas un défaut de calcul.
 */

import { parsefrenchDate } from './helpers.js'
import { normalizeTransactionLabel, isValidatedStatus } from './financialImpact.js'
import { FIRESTORE_CONFIG } from '../constants/firestoreConstants.js'

/**
 * ⚠ LE STATUT EST NORMALISÉ, COMME LE TYPE — ET IL NE L'ÉTAIT PAS.
 * ─────────────────────────────────────────────────────────────────────────────
 * Ce module normalisait le `type` en disant pourquoi : « le type est saisi
 * "Dépôt" par le formulaire, mais d'anciennes lignes portent "Depot" ». Il
 * comparait pourtant le `statut` au caractère près, avec `===` contre des
 * littéraux accentués.
 *
 * La même base qui porte « Depot » porte « Annulee », « VALIDÉE » ou « Validée »
 * avec une espace de fin. Et les deux erreurs vont dans des sens opposés, ce qui
 * les rend d'autant plus difficiles à voir :
 *
 *   • une annulation écrite « Annulee » était COMPTÉE dans l'activité du jour,
 *     alors qu'une annulation n'a jamais eu lieu ;
 *   • une validation écrite « Validee » était EXCLUE du chiffre d'affaires, qui
 *     tombait sous la caisse réelle.
 *
 * `financialImpact.js` exporte `normalizeTransactionLabel` et
 * `isValidatedStatus` depuis toujours, pour exactement cela. On les emploie
 * plutôt que d'en écrire une troisième version.
 */
const ANNULEE = normalizeTransactionLabel(FIRESTORE_CONFIG.STATUS.CANCELLED)

/**
 * Accents retirés et minuscules : le type est saisi « Dépôt » par le formulaire,
 * mais d'anciennes lignes portent « Depot ». Même normalisation que
 * `TransactionsTodayChart`, pour que les deux comptent pareil.
 */
const DIACRITIQUES = new RegExp('[\\u0300-\\u036f]', 'g')

const typeNormalise = (valeur) => String(valeur || '')
  .normalize('NFD')
  .replace(DIACRITIQUES, '')
  .toLowerCase()

/**
 * @param {Array} transactions - toutes les transactions connues de la boutique.
 * @param {Date} [maintenant] - l'horloge, INJECTÉE. Une règle qui lit `new Date()`
 *   au fond de son corps ne se teste qu'en gelant le temps du processus entier ;
 *   celle-ci se teste en lui passant un jour.
 * @returns {{ventes: number, depots: number, retraits: number, chiffreAffaires: number}}
 */
export function chiffresDuJour(transactions, maintenant = new Date()) {
  const vide = { ventes: 0, depots: 0, retraits: 0, chiffreAffaires: 0 }

  if (!Array.isArray(transactions) || transactions.length === 0) return vide
  if (!(maintenant instanceof Date) || Number.isNaN(maintenant.getTime())) return vide

  const jour = maintenant.toDateString()

  let depots = 0
  let retraits = 0
  let chiffreAffaires = 0

  for (const transaction of transactions) {
    if (!transaction || normalizeTransactionLabel(transaction.statut) === ANNULEE) continue

    const date = parsefrenchDate(transaction.date)
    if (!date || date.toDateString() !== jour) continue

    const type = typeNormalise(transaction.type)
    if (type === 'depot') depots += 1
    else if (type === 'retrait') retraits += 1

    if (isValidatedStatus(transaction.statut)) {
      // ⚠ `Number` et non `parseFloat` : `parseFloat('12 000')` rend 12, en
      // s'arrêtant à la première espace — et les montants arrivent parfois
      // formatés. `Number('12 000')` rend NaN, qu'on écarte franchement plutôt
      // que d'encaisser un montant faux de deux ordres de grandeur.
      const montant = Number(transaction.montant)
      if (Number.isFinite(montant)) chiffreAffaires += montant
    }
  }

  // `ventes` est la SOMME des deux paliers affichés, et non le total des lignes
  // du jour. C'est ce qui garantit que « 37 » et « 18 dépôts · 19 retraits »
  // s'accordent à l'écran : un nombre et sa décomposition doivent tomber juste.
  // Un profil déclarant un troisième type (le pilote a « Crédit ») verrait sinon
  // un total que sa propre ventilation ne justifie pas.
  return { ventes: depots + retraits, depots, retraits, chiffreAffaires }
}
