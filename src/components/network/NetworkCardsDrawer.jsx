import { useState, useCallback } from 'react'
import { useSimpleNetworkData } from '../../hooks/useSimpleNetworkData'
import { activeProfile } from '../../config/activeClientProfile.js'
import NetworkCard from './NetworkCard'
import NetworkBalanceCard from './NetworkBalanceCard'

// Cartes affichées = réseaux du profil client actif + la carte Liquidité (toujours là).
// Ex. TAOFIC → ['Orange', 'Liquidite'] ; salawu → 5 réseaux + Liquidité.
const VISIBLE_NETWORK_CARDS = [...activeProfile.networks.enabled, 'Liquidite']

// > 1 réseau boutique ⇒ rideau repliable « Cartes Réseau » (design d'origine restauré,
// cartes verticales sur une rangée). Mono-réseau (TAOFIC) ⇒ barre compacte « Soldes »,
// strictement inchangée (comportement historique préservé « au bit près »).
const IS_MULTI_NETWORK = activeProfile.networks.enabled.length > 1

function useVisibleCards() {
  const { networkData } = useSimpleNetworkData()
  return VISIBLE_NETWORK_CARDS
    .map(network => [network, networkData[network]])
    .filter(([, data]) => data)
}

// ── Mono-réseau (TAOFIC) — barre compacte « Soldes », inchangée ────────────────
function CompactBalanceBar() {
  const visibleCards = useVisibleCards()

  return (
    <section
      data-network-cards
      className="border-b border-slate-800 bg-slate-950 shadow-md"
      aria-label="Soldes opérationnels"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-center">
        <div className="flex shrink-0 items-center justify-center gap-2 text-slate-300 md:justify-start">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-xs font-semibold uppercase tracking-wide">
            Soldes
          </span>
        </div>

        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 md:max-w-3xl">
          {visibleCards.map(([network, data]) => (
            <NetworkCard
              key={network}
              network={network}
              stockAmount={data.stock}
              liquiditeAmount={data.liquidite}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Multi-réseaux (ex. salawu) — rideau repliable « Cartes Réseau » ────────────
function ExpandableCardsDrawer() {
  const visibleCards = useVisibleCards()
  const [isExpanded, setIsExpanded] = useState(true)
  const toggleDrawer = useCallback(() => setIsExpanded(prev => !prev), [])

  return (
    <div
      data-network-cards
      className="bg-white border-b border-gray-200 shadow-sm"
    >
      {/* En-tête repliable */}
      <div className="flex justify-center items-center gap-4 py-2 bg-gray-50">
        <button
          type="button"
          onClick={toggleDrawer}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors duration-200"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Réduire les cartes réseau' : 'Afficher les cartes réseau'}
        >
          <span>Cartes Réseau</span>
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Contenu : cartes verticales sur une rangée (scroll horizontal si débordement) */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-2 sm:px-4 py-3 sm:py-4">
          <div className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide pb-2 justify-center">
            {visibleCards.map(([network, data]) => (
              <NetworkBalanceCard
                key={network}
                network={network}
                stockAmount={data.stock}
                liquiditeAmount={data.liquidite}
              />
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  )
}

function NetworkCardsDrawer() {
  return IS_MULTI_NETWORK ? <ExpandableCardsDrawer /> : <CompactBalanceBar />
}

export default NetworkCardsDrawer
