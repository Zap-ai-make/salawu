import { directionStyles } from '../../utils/transactionDirection.js'
import { sensAvecDirection } from '../../utils/signeDuStock.js'
import { IS_REGISTRE } from '../../constants/designSystem.js'

/**
 * Le SENS d'une opération, dit par un mot et par un signe.
 * ─────────────────────────────────────────────────────────────────────────────
 * RENDU HISTORIQUE (TAOFIC) : une pastille colorée — vert = entrée en caisse,
 * orange = sortie, gris = neutre. Inchangé.
 *
 * ⚠ SOUS L'IDENTITÉ « REGISTRE », LE SENS CHANGE DE GRANDEUR (décision client,
 * 2026-09-18). La pastille disparaît au profit du mot précédé de son signe, et
 * ce signe suit le STOCK ÉLECTRONIQUE :
 *
 *     − Dépôt      le stock sort
 *     + Retrait    le stock rentre
 *
 * C'est l'INVERSE de la couleur historique, et ce n'est pas une inversion de
 * teintes : c'est la même opération lue sur l'autre grandeur. Un dépôt fait
 * entrer des espèces ET sortir du stock. Les deux lectures sont vraies ; le
 * produit en affiche désormais une seule, partout, et l'écran l'annonce par sa
 * phrase de convention.
 *
 * ⚠ LE SIGNE NE REMPLACE PAS LE MOT, il le précède. « − » seul ne dirait rien à
 * qui ne connaît pas la convention, et rien du tout à un lecteur d'écran qui
 * l'annoncerait « moins ». Le mot « Dépôt » reste la lecture principale ; le
 * signe et la couleur ne font que la redire plus vite.
 */
export default function DirectionBadge({ direction, label }) {
  if (IS_REGISTRE) {
    // ⚠ LA DIRECTION EST LUE, ET PLUS JETEE. Elle prend le relais quand le
    // libelle n'est pas une operation — « Recue », « Dette »… — qui tombaient
    // tous sur `neutre`, donc gris, sur deux onglets entiers de l'Historique.
    // La regle vit dans `utils/signeDuStock.js` : ici elle serait derriere
    // `IS_REGISTRE`, donc introuvable pour un test.
    const sens = sensAvecDirection(direction, label)
    return (
      // `data-sens` est un FAIT : ce mouvement sort du stock, y rentre, ou ne le
      // touche pas. La couleur vient de src/index.css sous la portée.
      <span data-sens={sens.cle} className="inline-block font-medium">
        {sens.signe ? `${sens.signe} ` : ''}{label}
      </span>
    )
  }

  const s = directionStyles(direction)
  return (
    <span className={`inline-block px-2 py-1 rounded text-sm font-medium ${s.badge}`}>
      {label}
    </span>
  )
}
