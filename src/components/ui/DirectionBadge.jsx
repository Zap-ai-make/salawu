import { directionStyles } from '../../utils/transactionDirection.js'

/**
 * Pastille colorée indiquant le sens d'une opération (entrée/sortie/neutre).
 * Vert = entrée, orange = sortie, gris = neutre. Purement visuel.
 *
 * @param {{ direction: 'in'|'out'|'neutral', label: string }} props
 */
export default function DirectionBadge({ direction, label }) {
  const s = directionStyles(direction)
  return (
    <span className={`inline-block px-2 py-1 rounded text-sm font-medium ${s.badge}`}>
      {label}
    </span>
  )
}
