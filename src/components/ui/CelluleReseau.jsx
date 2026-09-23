import { NETWORK_CONFIG } from '../../constants/networkConfig'
import { IS_REGISTRE } from '../../constants/designSystem.js'

/**
 * CelluleReseau — le nom d'un réseau, précédé de sa pastille.
 * ─────────────────────────────────────────────────────────────────────────────
 * Trois écrans écrivaient `{req.network}` en texte nu là où la maquette met
 * `.reseau-cell` : une pastille de la couleur de l'opérateur, puis son nom.
 *
 * ⚠ LA PASTILLE NE PORTE AUCUNE INFORMATION SEULE, d'où `aria-hidden`. Le nom
 * est écrit juste à côté, en toutes lettres. Elle sert à retrouver une ligne
 * d'un coup d'œil dans un tableau de vingt, pas à dire quel réseau c'est.
 *
 * ⚠ LES COULEURS SONT DES DONNÉES, PAS DES JETONS. `NETWORK_CONFIG` porte
 * l'orange d'Orange et le cyan de Wave : elles ne nous appartiennent pas, et
 * c'est la même carte que lisent l'anneau du tableau de bord, la bande des
 * réserves et le formulaire client. `data-pastille` leur rend l'anneau d'encre
 * qui les sauve sur du papier (le jaune Coris disparaît sans lui).
 *
 * ⚠ GARDÉ PAR `IS_REGISTRE`. Ce composant est monté par des écrans que TAOFIC
 * ouvre aussi. Hors de l'identité il rend le texte nu d'avant — exactement ce
 * qui s'affichait, sans un nœud de plus dans l'arbre.
 */
function CelluleReseau({ reseau }) {
  const nom = reseau || '—'
  if (!IS_REGISTRE || !reseau) return nom

  return (
    <span data-cellule-reseau className="inline-flex items-center gap-2">
      <span
        data-pastille
        aria-hidden="true"
        className="inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: NETWORK_CONFIG[reseau]?.color || '#5b6470' }}
      />
      {nom}
    </span>
  )
}

export default CelluleReseau
