/**
 * historyFilter.js — filtre générique dates + recherche pour les sources d'historique
 * qui ne sont pas des transactions client (transferts dealer, collaborations).
 *
 * L'Historique partage UN seul jeu de filtres entre ses trois onglets. Les
 * transactions client gardent leur filtrage historique (matchesDateFilter /
 * matchesSearchTerm sur la forme transaction). Ici on reproduit la MÊME sémantique
 * de dates pour des lignes portant une `Date` (issue d'un Timestamp `createdAt`) :
 *   - bornes de jour INCLUSES (from/to normalisés au jour) ;
 *   - `todayOnly` quand aucune borne n'est posée → jour courant ;
 *   - sinon, tout passe.
 * La recherche est une sous-chaîne insensible à la casse sur un `search` pré-calculé.
 *
 * Opère sur des lignes normalisées `{ when: Date|null, search: string, ... }`.
 */

import { normalizeDate } from './helpers.js'

const dayOf = (d) =>
  d instanceof Date && !Number.isNaN(d.getTime())
    ? new Date(d.getFullYear(), d.getMonth(), d.getDate())
    : null

/** Réplique matchesDateFilter pour une valeur Date (au lieu de la chaîne FR). */
export function matchesDateRange(when, { from, to } = {}, todayOnly = false) {
  const day = dayOf(when)

  if (todayOnly && !from && !to) {
    if (!day) return false
    return day.getTime() === dayOf(new Date()).getTime()
  }

  if (from || to) {
    if (!day) return false
    const fromDay = from ? normalizeDate(from) : null
    const toDay = to ? normalizeDate(to) : null
    if (fromDay && day < fromDay) return false
    if (toDay && day > toDay) return false
    return true
  }

  return true
}

/** Filtre des lignes `{ when, search }` par plage de dates + terme de recherche. */
export function filterHistoryRows(rows, { from, to, search, todayOnly } = {}) {
  const q = (search ?? '').trim().toLowerCase()
  return rows.filter(
    (r) =>
      matchesDateRange(r.when, { from, to }, todayOnly) &&
      (q === '' || (r.search ?? '').toLowerCase().includes(q)),
  )
}

export default filterHistoryRows
