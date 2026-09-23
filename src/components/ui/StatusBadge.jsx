import { IS_REGISTRE } from '../../constants/designSystem.js'

/**
 * Le palier d'apparence de la maquette, par statut générique.
 *
 * ⚠ CE COMPOSANT SERT QUATRE VOCABULAIRES : les dettes internes (open,
 * partially_settled, settled), les boutiques (active, inactive, suspended), et
 * deux écrans gérant. La table ne couvre que ce qui est réellement passé ;
 * tout le reste tombe sur `neutre`, jamais sur `valide`.
 *
 * `partially_settled` → `attente` et non un palier à lui : une dette réglée à
 * moitié reste une dette. La MENTION « réglée en partie » dit la nuance, en
 * toutes lettres, sous le badge.
 *
 * `suspended` → `rejete` : c'est le seul de la liste qui soit un vrai refus.
 */
const PALIER = {
  open:              { cle: 'attente', forme: 'losange' },
  partially_settled: { cle: 'attente', forme: 'losange' },
  settled:           { cle: 'valide',  forme: 'rond' },
  pending:           { cle: 'attente', forme: 'losange' },
  confirmed:         { cle: 'valide',  forme: 'rond' },
  rejected:          { cle: 'rejete',  forme: 'losange' },
  active:            { cle: 'valide',  forme: 'rond' },
  inactive:          { cle: 'neutre',  forme: 'barre' },
  suspended:         { cle: 'rejete',  forme: 'losange' },
}

const PRESETS = {
  pending:   'bg-amber-100 text-amber-800',
  confirmed: 'bg-green-100 text-green-800',
  rejected:  'bg-red-100 text-red-800',
  active:    'bg-green-100 text-green-800',
  inactive:  'bg-gray-100 text-gray-600',
  suspended: 'bg-red-100 text-red-800',
}

function StatusBadge({ status, label, color }) {
  const cls = color ? '' : (PRESETS[status] ?? 'bg-gray-100 text-gray-700')
  const customCls = color || ''
  const palier = PALIER[status] ?? { cle: 'neutre', forme: 'barre' }

  // Marqueurs inertes hors de `.design-registre [data-espace='boutique']` : ce
  // composant est partagé avec les espaces gérant et dealer, qui ne bougent pas.
  return (
    <span
      data-statut={IS_REGISTRE ? palier.cle : undefined}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}${customCls}`}
      aria-label={label ?? status}
    >
      {IS_REGISTRE && <span data-forme={palier.forme} aria-hidden="true" />}
      {label ?? status}
    </span>
  )
}

export default StatusBadge
