import { memo } from 'react'
import { NETWORK_CONFIG, formatAmountWithCurrency } from '../../constants/networkConfig'

/**
 * NetworkBalanceCard — une réserve de la bande (affichage seul) du côté boutique
 * multi-réseaux (NetworkCardsDrawer, branche IS multi) : pastille + nom, montant,
 * libellé « Stock FCFA » / « Liquidité FCFA », et un indicateur « ! » quand le
 * stock est nul.
 *
 * Volontairement SANS édition : la boutique (store_admin) ne modifie pas les soldes
 * (cashier.canEditBalances piloté par profil, actuellement false). L'édition dealer
 * reste dans NetworkCard (chemin mono, inchangé pour TAOFIC).
 *
 * LES CLASSES TAILWIND TEINTÉES RESTENT DANS CE JSX, ET C'EST VOULU
 * `config.gradient`, `config.border`, `config.text` et `config.textLight` sont
 * conservés tels quels : un profil multi-réseaux SANS l'identité « registre »
 * continue de les recevoir, octet pour octet. L'identité les neutralise depuis
 * `src/index.css`, sous `.design-registre`. Les `data-*` ci-dessous sont des
 * FAITS — « ceci est une réserve », « ceci est la caisse », « ceci est de
 * l'argent » — et non des consignes d'apparence : aucun `if` de client dans
 * l'arbre JSX, donc aucune occasion d'en oublier un.
 */
function NetworkBalanceCard({ network, stockAmount, liquiditeAmount }) {
  const config = NETWORK_CONFIG[network]
  if (!config) return null

  const isLiquiditeCard = network === 'Liquidite'
  const displayAmount = isLiquiditeCard ? liquiditeAmount : stockAmount
  const { amount, label } = formatAmountWithCurrency(displayAmount, isLiquiditeCard)

  const stockValue = stockAmount || 0
  const isCritical = !isLiquiditeCard && stockValue <= 0

  return (
    <div
      data-reserve={isLiquiditeCard ? 'caisse' : 'reseau'}
      className={`
        bg-gradient-to-br ${config.gradient}
        border ${config.border}
        rounded-lg shadow-sm
        p-3 flex-1 min-w-[112px] max-w-[150px]
        transition-all duration-200 hover:shadow-md
      `}
    >
      {/* En-tête : pastille + nom, indicateur de stock critique */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            data-pastille
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: config.color }}
          />
          <h3 className={`font-semibold text-xs ${config.text}`}>
            {config.name}
          </h3>
        </div>
        {isCritical && (
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-red-500 font-bold">!</span>
          </div>
        )}
      </div>

      {/* Montant + libellé */}
      <div className="text-center">
        {/* `data-montant` : un FAIT — ceci est de l'argent en FCFA. C'est ce qui
            lui vaut les chiffres tabulaires et la réglure verticale, la
            signature du produit (src/index.css §« LE FILET DU REGISTRE »). La
            maquette la porte aussi sur les réserves : ce sont des montants. */}
        <div data-montant className={`font-bold text-lg ${config.text} mb-1`}>
          {amount}
        </div>
        <span data-reserve-mention className={`text-xs ${config.textLight} font-medium`}>
          {label}
        </span>
      </div>
    </div>
  )
}

export default memo(NetworkBalanceCard)
