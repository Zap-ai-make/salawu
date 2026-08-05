import { memo } from 'react'
import { NETWORK_CONFIG, formatAmountWithCurrency } from '../../constants/networkConfig'

/**
 * NetworkBalanceCard — carte de solde VERTICALE (affichage seul) du rideau boutique
 * multi-réseaux (NetworkCardsDrawer, branche IS multi). Fond dégradé teinté par réseau,
 * pastille + nom, gros montant, libellé « Stock FCFA » / « Liquidité FCFA », et un
 * indicateur « ! » quand le stock est nul/critique.
 *
 * Volontairement SANS édition : la boutique (store_admin) ne modifie pas les soldes
 * (cashier.canEditBalances piloté par profil, actuellement false). L'édition dealer
 * reste dans NetworkCard (chemin mono, inchangé pour TAOFIC).
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
      className={`
        bg-gradient-to-br ${config.gradient}
        border ${config.border}
        rounded-lg shadow-sm
        p-3 flex-1 min-w-[140px] max-w-[180px]
        transition-all duration-200 hover:shadow-md
      `}
    >
      {/* En-tête : pastille + nom, indicateur de stock critique */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
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
        <div className={`font-bold text-lg ${config.text} mb-1`}>
          {amount}
        </div>
        <span className={`text-xs ${config.textLight} font-medium`}>
          {label}
        </span>
      </div>
    </div>
  )
}

export default memo(NetworkBalanceCard)
