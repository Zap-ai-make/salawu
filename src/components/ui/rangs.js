import { IS_REGISTRE } from '../../constants/designSystem.js'

/**
 * rangs.js — l'apparence d'une action HORS de l'identité « registre ».
 * ─────────────────────────────────────────────────────────────────────────────
 * LE DÉFAUT QUE CE MODULE EXISTE POUR FERMER, ET IL TOUCHAIT UN CLIENT EN
 * PRODUCTION.
 *
 * Le lot L9.13 a posé `data-rang` sur les actions des écrans Clients,
 * Transactions et Historique, et retiré les classes Tailwind qui les
 * habillaient. C'est la bonne façon de faire — le composant déclare un FAIT
 * (« ceci est l'action primaire »), l'identité décide du rendu — À UNE
 * CONDITION : que quelqu'un décide du rendu dans l'AUTRE cas aussi.
 *
 * Personne ne l'avait fait. Toutes les règles `[data-rang]` de src/index.css
 * sont préfixées `.design-registre [data-espace='boutique']`. TAOFIC, qui est en
 * `legacy`, rendait donc sept contrôles en boutons natifs nus : gris système,
 * sans marge, sans rayon, et un `<Link>` réduit à du texte inline suivi d'un SVG
 * flottant. La branche affirme partout que TAOFIC ne bouge pas ; sur ces sept
 * contrôles, c'était faux.
 *
 * ⚠ DEUX SITUATIONS DIFFÉRENTES, ET ELLES N'APPELLENT PAS LA MÊME RÉPONSE.
 *
 *   1. Les contrôles QUI EXISTAIENT et dont L9.13 a retiré les classes
 *      (« Importer », « Exporter » de l'écran Clients). Leur apparence d'avant
 *      est connue, elle est dans l'historique : on la leur rend TELLE QUELLE,
 *      violet et bleu compris. Ce n'est pas joli, et ce n'est pas la question —
 *      c'est ce que le client voit aujourd'hui en production.
 *
 *   2. Les contrôles que L9.13 a CRÉÉS (« Ajouter un client », les deux
 *      « Exporter » de Transactions et Historique). Ils n'ont jamais eu
 *      d'apparence legacy : il faut leur en donner une. Elle suit le vocabulaire
 *      du dépôt — bleu pour l'action primaire, contour gris pour le reste.
 *
 * ⚠ LA SPÉCIFICITÉ REND CECI SANS DANGER POUR L'IDENTITÉ. Une utilitaire
 * Tailwind pèse (0,1,0) ; `.design-registre [data-espace='boutique'] [data-rang]`
 * pèse (0,3,0) et l'emporte quelle que soit sa place dans la feuille. On pourrait
 * donc émettre ces classes dans les deux cas. On ne le fait pas : `IS_REGISTRE`
 * les éteint sous l'identité, pour qu'un lecteur du DOM n'ait pas à se demander
 * laquelle des deux gagne.
 */

const LEGACY = {
  primaire: 'bg-blue-700 hover:bg-blue-800 text-white px-6 py-2 rounded transition-colors',
  second: 'bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200 disabled:opacity-50 px-4 py-2 rounded transition-colors',
}

/**
 * Les classes d'apparence à ajouter à un contrôle porteur de `data-rang`.
 *
 * @param {'primaire'|'second'} rang
 * @param {string} [historique] apparence EXACTE d'avant le lot L9.13, pour un
 *   contrôle qui en avait une. Elle prime : on rend au client ce qu'il a, pas ce
 *   qu'on aurait choisi.
 * @returns {string} vide sous l'identité « registre », où src/index.css décide.
 */
export function classesDuRang(rang, historique) {
  if (IS_REGISTRE) return ''
  return historique ?? LEGACY[rang] ?? ''
}

export default classesDuRang
