/**
 * Squelettes de chargement.
 *
 * ⚠ `role="status"` SUR LE CONTENEUR, et ce n'est pas décoratif. ARIA n'autorise
 * `aria-label` que sur un élément dont le rôle accepte d'être nommé ; un <div>
 * nu a le rôle `generic`, qui l'INTERDIT. Le libellé « Chargement… » était donc
 * ignoré par les lecteurs d'écran — écrit pour personne — et le `aria-busy` posé
 * au même endroit ne disait rien non plus, faute de région à laquelle
 * l'attacher. axe le classe `aria-prohibited-attr`, impact serious.
 *
 * `status` est le bon rôle et pas seulement un rôle permis : une région live
 * discrète, qui annonce le chargement sans voler le focus.
 *
 * Relevé sur l'espace boutique par la boucle QA, puis corrigé ici à la demande
 * explicite du client — `SkeletonList` ne sert que les espaces admin et dealer,
 * hors du périmètre du chantier de refonte.
 */
function SkeletonRow({ cols = 4 }) {
  return (
    <tr aria-hidden="true">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 animate-pulse rounded bg-gray-200" style={{ width: `${60 + (i % 3) * 20}%` }} />
        </td>
      ))}
    </tr>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white" role="status" aria-busy="true" aria-label="Chargement…">
      <table className="min-w-full divide-y divide-gray-100">
        <tbody className="divide-y divide-gray-50">
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonRow key={i} cols={cols} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function SkeletonCards({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" role="status" aria-busy="true" aria-label="Chargement…">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 p-5 animate-pulse">
          <div className="h-3 w-20 bg-gray-200 rounded mb-3" />
          <div className="h-7 w-24 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  )
}

export default SkeletonTable
