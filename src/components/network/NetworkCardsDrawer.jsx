import { useState, useCallback } from 'react'
import { useSimpleNetworkData } from '../../hooks/useSimpleNetworkData'
import { activeProfile } from '../../config/activeClientProfile.js'
import { IS_REGISTRE } from '../../constants/designSystem.js'
import NetworkCard from './NetworkCard'
import NetworkBalanceCard from './NetworkBalanceCard'

// Cartes affichées = réseaux du profil client actif + la carte Liquidité (toujours là).
// Ex. TAOFIC → ['Orange', 'Liquidite'] ; salawu → 5 réseaux + Liquidité.
const VISIBLE_NETWORK_CARDS = [...activeProfile.networks.enabled, 'Liquidite']

// > 1 réseau boutique ⇒ rideau repliable « Cartes Réseau » (design d'origine restauré,
// cartes verticales sur une rangée). Mono-réseau (TAOFIC) ⇒ barre compacte « Soldes »,
// strictement inchangée (comportement historique préservé « au bit près »).
const IS_MULTI_NETWORK = activeProfile.networks.enabled.length > 1

// Exporte : le rail de soldes collant (StickyBalanceRail) doit afficher
// EXACTEMENT les mêmes réseaux que le rideau. Dupliquer la dérivation ailleurs
// recréerait une seconde source de vérité sur « quels réseaux ce client voit »,
// et les deux divergeraient au premier client ajouté.
export function useVisibleCards() {
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
          {/* Meme exigence que le tableau des clients : cette bande de cartes defile
              horizontalement sur telephone, et sans focalisation les derniers reseaux
              sont inatteignables au clavier (constat Q3, releve a 375 px). */}
          <div
            tabIndex={0}
            role="region"
            aria-label="Soldes par reseau, defilement horizontal"
            className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide pb-2 justify-center"
          >
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

// ── Identité « registre » — la bande des réserves, permanente ─────────────────
/**
 * Une seule bande, qui ne se replie plus et ne s'en va plus au défilement.
 *
 * CE QU'ELLE REMPLACE, ET POURQUOI
 * « Combien il me reste » était porté par DEUX dispositifs qui disaient la même
 * chose à deux endroits : le rideau repliable en haut de page, et le rail
 * collant qui apparaissait au défilement pour compenser sa disparition. Deux
 * rendus de la même donnée, donc deux occasions de diverger.
 *
 * La bande supprime la cause au lieu de compenser l'effet : elle reste sous la
 * navigation en permanence (`position: sticky`), et le rail n'a plus d'objet.
 *
 * ⚠ `StickyBalanceRail.jsx` est CONSERVÉ sur disque, et ses contrats
 * d'accessibilité restent testés (TC-161). Il n'est plus monté, c'est tout :
 * supprimer un fichier relève du protocole de CLAUDE.md, pas d'un lot de design.
 *
 * POURQUOI `sticky` ET NON `fixed`
 * Le rail était `fixed`, donc hors flux : sa hauteur devait être MESURÉE au
 * ResizeObserver puis reversée en `padding-top` sur <main>, sans quoi le contenu
 * passait dessous. Une bande `sticky` garde sa place dans le flux — il n'y a
 * plus de hauteur à mesurer, donc plus rien à resynchroniser.
 *
 * `top` vaut la hauteur de la navigation : celle-ci passe en `fixed` au
 * défilement, et une bande collée à 0 se glisserait dessous.
 */
function BandeDesReserves({ top = 0 }) {
  const visibleCards = useVisibleCards()

  return (
    <div
      data-network-cards
      data-bande-reserves
      className="sticky z-30 bg-white border-b border-gray-200 shadow-sm"
      style={{ top: `${top}px` }}
    >
      <div data-reserve-cadre className="px-2 sm:px-4 py-3 sm:py-4">
        {/* Même exigence que partout ailleurs : une zone à défilement horizontal
            non focalisable rend ses derniers réseaux inatteignables au clavier
            (constat Q3, relevé à 375 px). */}
        <div
          data-reserve-piste
          tabIndex={0}
          role="region"
          aria-label="Soldes par reseau, defilement horizontal"
          className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide pb-2 justify-center"
        >
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

      <style>{`
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  )
}

/**
 * Trois branches, et une seule est nouvelle.
 *
 * Le repli sur `ExpandableCardsDrawer` n'est pas de la prudence décorative : un
 * profil multi-réseaux sans l'identité « registre » garde son rideau, son bouton
 * et son animation, octet pour octet. La bande est un parti pris de mise en
 * page — elle passe donc par `profil.design`, comme le wordmark et le rail avant
 * elle, et jamais par un identifiant de client.
 */
function NetworkCardsDrawer({ top }) {
  if (!IS_MULTI_NETWORK) return <CompactBalanceBar />
  return IS_REGISTRE ? <BandeDesReserves top={top} /> : <ExpandableCardsDrawer />
}

export default NetworkCardsDrawer
