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
 * @param {() => void} [onActivate] - rend la pastille cliquable, indépendamment de
 *   l'onglet qui la porte : cliquer « 3 à exécuter » doit mener à ces reçues, pas au
 *   sous-onglet par défaut. Stoppe la propagation pour ne pas déclencher l'onglet
 *   parent qui, lui, ouvre le sous-onglet courant.
 */
export function TabBadge({ count, tone = 'neutral', active = false, testId, label, onActivate }) {
  const alert = tone === 'alert' && count > 0
  const cls = alert
    ? `bg-red-600 text-white${active ? ' ring-1 ring-white' : ''}`
    : active
      ? 'bg-white/25 text-white'
      : 'bg-gray-100 text-gray-700'

  const interactive = typeof onActivate === 'function'
  const activate = (e) => { e.stopPropagation(); onActivate() }
  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(e) }
  }

  return (
    <span
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? activate : undefined}
      onKeyDown={interactive ? onKeyDown : undefined}
      className={`ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none min-w-[1.2rem] ${cls}${interactive ? ' cursor-pointer hover:brightness-110' : ''}`}
      aria-label={label}
      data-testid={testId}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

export default TabBadge
