/**
 * themedTable.js — vocabulaire du tableau « teinté ».
 * ─────────────────────────────────────────────────────────────────────────────
 * Forme historique du tableau « Non Terminées » (onglet Transaction client),
 * désormais partagée par les trois onglets de Transactions pour qu'ils se
 * ressemblent : entête coloré par le thème, quadrillage sur chaque cellule,
 * titre de section en gras.
 *
 * Renvoie des chaînes de classes plutôt qu'un composant <Table columns rows /> :
 * les cellules de TransactionTable composent avec une couleur de texte propre à
 * chaque ligne (getTransactionStyles) et rendent des boutons d'action, ce qu'une
 * API déclarative rigide ne saurait pas exprimer.
 *
 * La classe de bordure est trouvée par recherche du jeton `border-`, et NON par
 * `themeClasses.tableHeader.split(' ')[1]` — l'idiome en place jusqu'ici. Cet
 * index positionnel suppose que tableHeader vaut exactement deux classes ; le
 * jour où un thème en déclare une de plus, tous les tableaux perdent leur
 * bordure sans que rien ne le signale.
 */

/**
 * `headerCell` et `headerCellCenter` sont fournis en deux variantes complètes
 * plutôt qu'en base à compléter : concaténer `text-center` à une chaîne qui
 * contient déjà `text-left` ne donne pas le résultat attendu, les deux classes
 * ayant la même spécificité — c'est l'ordre dans la feuille générée qui tranche,
 * pas l'ordre dans l'attribut class.
 *
 * @param {{ tableHeader?: string, text?: string }} themeClasses - issu de useTheme().
 * @returns {{ border, title, container, scroll, headerRow, headerCell,
 *   headerCellCenter, cell, cellCenter, empty: string }}
 */
export function themedTableClasses(themeClasses = {}) {
  const border =
    (themeClasses.tableHeader ?? '').split(' ').find((c) => c.startsWith('border-')) ??
    'border-gray-300'
  const text = themeClasses.text ?? 'text-gray-900'
  const headerBase = `border ${border} px-4 py-3 text-base font-medium ${text}`
  const cellBase = `border ${border} px-4 py-3 text-base`

  return {
    border,
    title: `text-xl font-bold ${text} mb-4`,
    container: `bg-white rounded-lg border ${border}`,
    scroll: 'overflow-x-auto overflow-y-visible',
    headerRow: themeClasses.tableHeader ?? '',
    headerCell: `${headerBase} text-left`,
    headerCellCenter: `${headerBase} text-center`,
    cell: cellBase,
    cellCenter: `${cellBase} text-center`,
    empty: `border ${border} px-4 py-8 text-center text-gray-500`,
  }
}

export default themedTableClasses
