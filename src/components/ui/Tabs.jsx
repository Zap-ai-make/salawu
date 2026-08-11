/**
 * Tabs.jsx — vocabulaire des basculeurs d'onglets.
 * ─────────────────────────────────────────────────────────────────────────────
 * Forme historique du basculeur de Transactions (pilule verte pleine quand
 * l'onglet est actif, bordure grise sinon), partagée par les sous-onglets de
 * Collaborations pour qu'un même geste produise la même apparence.
 *
 * `tabButtonClass` renvoie une chaîne plutôt qu'un composant <Tab /> : les
 * boutons portent des `data-testid`, des `aria-label` et des contenus mixtes
 * (libellé + pastille) propres à chaque écran, qu'une API rigide masquerait.
 */

export function tabButtonClass(active) {
  return `px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 inline-flex items-center ${
    active ? 'bg-green-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
  }`
}

/**
 * Pastille de comptage d'un onglet.
 *
 * @param {number} count
 * @param {'alert'|'neutral'} tone - `alert` (rouge) signale une action à faire ;
 *   un compteur nul retombe sur `neutral`, un « 0 » en rouge n'appelant aucune action.
 * @param {boolean} active - onglet actif : le fond vert impose des couleurs de
 *   pastille différentes (le gris clair y devient illisible, le rouge s'y confond).
 */
export function TabBadge({ count, tone = 'neutral', active = false, testId, label }) {
  const alert = tone === 'alert' && count > 0
  const cls = alert
    ? `bg-red-600 text-white${active ? ' ring-1 ring-white' : ''}`
    : active
      ? 'bg-white/25 text-white'
      : 'bg-gray-100 text-gray-700'

  return (
    <span
      className={`ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none min-w-[1.2rem] ${cls}`}
      aria-label={label}
      data-testid={testId}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

export default TabBadge
