import { memo } from 'react'
import { NETWORK_CONFIG, formatAmount } from '../../constants/networkConfig'
import { useVisibleCards } from './NetworkCardsDrawer'

/**
 * Rail de soldes collant — « combien il me reste », y compris en cours de lecture.
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CETTE FORME, ET PAS LE BANDEAU PERMANENT DU PLAN
 *
 * Le plan prévoyait de promouvoir `NetworkCardsDrawer` en bandeau permanent. En
 * l'examinant, la prémisse s'est révélée fausse sur un point : ce rideau est DÉJÀ
 * permanent — `Layout` le rend systématiquement, déplié par défaut, juste sous la
 * navigation. Ce qui manque n'est pas sa présence en haut de page, c'est qu'il
 * disparaît dès qu'on fait défiler une liste de transactions, c'est-à-dire au
 * moment exact où la question « combien il me reste » se pose.
 *
 * Et la justification d'origine du bandeau — remplacer les 200 px de photo — est
 * tombée quand la photo a été rétablie à la demande du client (BILAN §8). Un
 * bandeau supplémentaire s'AJOUTERAIT : photo + navigation + bandeau, et sur un
 * téléphone de 375 px les transactions descendent hors de l'écran.
 *
 * D'où ce rail, qui ne coûte RIEN au repos : il n'apparaît que lorsque la
 * navigation passe en position fixe, donc lorsque les 200 px de photo sont déjà
 * sortis de l'écran. Il occupe de la place uniquement pendant le défilement, en
 * échange de la seule question que l'utilisateur se pose à ce moment-là.
 *
 * CE QU'IL NE FAIT PAS, DÉLIBÉRÉMENT
 *
 * Il n'affiche aucun statut (« Bas », « Épuisé »). Ces paliers sont une règle
 * d'exploitation qui vit dans `NetworkCard` ; les recopier ici en ferait une
 * seconde source de vérité, et les extraire serait une refactorisation à mener
 * dans son propre lot, sous test de caractérisation (CLAUDE.md). Le rail dit le
 * montant ; les cartes, restées en haut de page, disent le statut.
 */

function Rail({ visible, top, ref }) {
  const visibleCards = useVisibleCards()

  if (!visibleCards.length) return null

  return (
    <div
      ref={ref}
      data-balance-rail
      // Masqué de l'arbre d'accessibilité quand il est hors écran : sans cela
      // un lecteur d'écran annoncerait des soldes invisibles.
      aria-hidden={!visible}
      className={[
        'fixed left-0 right-0 z-40 border-b border-registre',
        // Fond OPAQUE, sans `backdrop-blur` : un flou d'arriere-plan sur un
        // element fixe se recalcule a chaque image pendant le defilement, et ce
        // depot a deja paye cette lecon avec `background-attachment: fixed`
        // (lot Perf). Sur un fond papier, le flou n'apporte rien de visible.
        'bg-papier transition-transform duration-200',
        visible ? '' : 'pointer-events-none',
      ].join(' ')}
      // `top` est CONSTANT ; seul le `transform` bouge. La premiere version
      // deplacait les deux a la fois — `top` de 0 a la hauteur de la navigation,
      // et la translation de -100% a 0 — de sorte que le rail n'atterrissait
      // jamais a l'endroit annonce. La boucle QA l'a mesure aux trois largeurs :
      // nav 0+64 et rail a 50,9 ; nav 0+102 et rail a 88,9 ; nav 0+50 et rail a
      // 29,9. Trois ecarts differents, parce qu'ils dependaient de l'instant ou
      // la mesure tombait dans l'animation.
      //
      // Masque, il est translate de sa propre hauteur PLUS la distance qui le
      // separe du haut de l'ecran : il sort donc franchement, sans laisser un
      // liseré par-dessus le bandeau de marque.
      style={{
        top: `${top}px`,
        transform: visible ? 'translateY(0)' : `translateY(calc(-100% - ${top}px))`,
      }}
    >
      <div
        // Focalisable pour la même raison que la bande de cartes du rideau
        // (constat Q3, relevé à 375 px) : une zone à défilement horizontal non
        // focalisable rend ses derniers éléments inatteignables au clavier.
        //
        // ⚠ `tabIndex` suit la visibilité. Un élément focalisable à l'intérieur
        // d'un `aria-hidden` est une violation axe (`aria-hidden-focus`) : le
        // clavier y entrerait dans une zone que le lecteur d'écran ignore.
        tabIndex={visible ? 0 : -1}
        role="region"
        aria-label="Soldes par réseau, défilement horizontal"
        className="flex items-center gap-4 overflow-x-auto px-4 py-2 scrollbar-hide"
      >
        {visibleCards.map(([network, data]) => {
          const config = NETWORK_CONFIG[network]
          const estLiquidite = network === 'Liquidite'
          const montant = estLiquidite ? data.liquidite : data.stock

          return (
            <span key={network} className="flex shrink-0 items-baseline gap-1.5">
              {/* La pastille de couleur RÉSEAU ne porte aucune information à
                  elle seule : le nom du réseau est écrit juste à côté. C'est un
                  repère de balayage, pas un code (DESIGN.md §5). */}
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 self-center rounded-full"
                style={{ backgroundColor: config?.color ?? 'currentColor' }}
              />
              <span className="text-xs font-medium text-encre-doux">
                {config?.name ?? network}
              </span>
              <span className="tabular text-sm font-semibold text-encre">
                {formatAmount(montant)}
              </span>
            </span>
          )
        })}
      </div>

      <style>{`
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  )
}

const StickyBalanceRail = memo(Rail)

export default StickyBalanceRail
