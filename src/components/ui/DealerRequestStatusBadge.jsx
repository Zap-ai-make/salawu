import { DEALER_REQUEST_STATUS_LABELS } from '../../constants/dealerConstants'
import { IS_REGISTRE } from '../../constants/designSystem.js'

/**
 * Badge de statut d'une demande Dealer (pending / confirmed / rejected).
 *
 * Centralise trois copies auparavant identiques (DealerRequests,
 * StoreAdminDealerRequests, StoreAdminDealerRequestDetails). Libellés issus de
 * DEALER_REQUEST_STATUS_LABELS ; palette et testid conservés à l'identique des
 * copies d'origine pour ne rien changer à l'affichage ni aux tests.
 *
 * Distinct du StatusBadge générique (components/ui/StatusBadge.jsx), dont l'API
 * (status + label + color) et la palette (amber) diffèrent.
 */

const STATUS_STYLES = {
  pending:   'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-green-100 text-green-800',
  rejected:  'bg-red-100 text-red-800',
}

/**
 * Le palier d'apparence de la maquette, et sa FORME.
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ C'EST ICI QUE `rejete` SERT ENFIN. `utils/statutDuMouvement.js` le déclare
 * puis le laisse volontairement inattribué, en écrivant pourquoi : aucun statut
 * d'OPÉRATION ne mérite le rouge de l'échec — annuler ou rembourser sont des
 * gestes normaux du comptoir. Une demande REJETÉE, elle, est un vrai rejet :
 * c'est un écran de DÉCISION, et c'est l'emploi que ce jeton attendait.
 *
 * On ne réutilise pas `cleDuStatut` : il lit un libellé d'opération française
 * (« Validée », « Annulée ») et rendrait `neutre` sur les clés anglaises de
 * Firestore. Une table de trois lignes dit la vérité ; une réutilisation
 * forcée l'aurait peinte en gris sans que rien ne rougisse.
 *
 * Un statut inconnu tombe sur `neutre` — jamais sur `valide`. Le gris ne promet
 * rien ; le vert promettrait une confirmation qui n'a pas eu lieu.
 */
const PALIER = {
  pending:   { cle: 'attente', forme: 'losange' },
  confirmed: { cle: 'valide',  forme: 'rond' },
  rejected:  { cle: 'rejete',  forme: 'losange' },
}

function DealerRequestStatusBadge({ status }) {
  const label = DEALER_REQUEST_STATUS_LABELS[status] ?? 'Statut inconnu'
  const style = STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-700'
  const palier = PALIER[status] ?? { cle: 'neutre', forme: 'barre' }

  // ⚠ LES MARQUEURS SONT INERTES HORS DE L'IDENTITÉ, et ce composant est PARTAGÉ
  // avec l'espace dealer (`pages/dealer/DealerRequests.jsx`). Aucune règle ne
  // cible `[data-statut]` en dehors de `.design-registre [data-espace='boutique']`
  // — c'est la leçon du lot L9.6, et la raison pour laquelle on peut poser un
  // fait sur un composant commun sans redessiner trois espaces.
  return (
    <span
      data-statut={IS_REGISTRE ? palier.cle : undefined}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}
      aria-label={`Statut : ${label}`}
      data-testid={`status-badge-${status}`}
    >
      {/* La FORME est le troisième canal exigé par la maquette : « une couleur,
          un mot, une forme. Aucune ne paraît seule. » `aria-hidden` : elle ne
          dit rien que le mot à côté ne dise déjà. */}
      {IS_REGISTRE && <span data-forme={palier.forme} aria-hidden="true" />}
      {label}
    </span>
  )
}

export default DealerRequestStatusBadge
