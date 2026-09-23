import { memo } from 'react'
import { NETWORK_CONFIG, formatAmountWithCurrency } from '../../constants/networkConfig'
import { activeProfile } from '../../config/activeClientProfile.js'
import { etatDeLaReserve } from '../../utils/etatReserve.js'

/**
 * Seuil de stock bas, en FCFA, LU UNE FOIS depuis le profil client.
 *
 * Absent d'un profil → `etatDeLaReserve` rend `null`, donc aucun mot. Ce n'est
 * pas un repli de circonstance, c'est le contrat posé au lot L7.4a : aucun seuil
 * n'est inventé par défaut, parce qu'un seuil deviné se trompe pour toutes les
 * boutiques sauf une. TAOFIC ne le déclare pas — et n'atteint de toute façon
 * jamais ce composant (mono-réseau → `CompactBalanceBar`).
 */
const SEUIL_STOCK_BAS = activeProfile.networks.seuilStockBas

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

  // L'état ne concerne QUE les réserves réseau. La carte « Liquidité » est la
  // caisse, pas un stock qu'on épuise : lui coller « Bas » ferait croire à une
  // rupture d'approvisionnement là où il n'y a qu'un fonds de caisse bas.
  const etat = isLiquiditeCard ? null : etatDeLaReserve(stockAmount, SEUIL_STOCK_BAS)

  // Repli pour un profil multi-réseaux qui ne déclare PAS de seuil : il garde
  // l'indicateur d'origine, strictement inchangé. Sans cela, une configuration
  // que ce lot ne touche pas par ailleurs PERDRAIT son seul signal de rupture.
  // Là où le mot existe, il remplace ce « ! » — c'est tout l'objet du lot.
  //
  // ⚠ ET IL NE SE DECLENCHE QUE SUR UN NOMBRE REELLEMENT LU. `stockAmount || 0`
  // transformait `null`, `undefined` et `''` en zero, donc en RUPTURE : un
  // reseau dont le solde n'avait pas encore charge affichait le « ! » rouge.
  // C'est exactement le faux signal que `etatDeLaReserve` refuse d'emettre —
  // son commentaire le dit mot pour mot : « une valeur absente ou illisible
  // n'est PAS zero ». Le repli reprenait par la porte de derriere ce que la
  // regle avait ecarte par la grande.
  const stockLu = Number(stockAmount)
  const stockEstLisible = stockAmount !== null && stockAmount !== undefined
    && !(typeof stockAmount === 'string' && stockAmount.trim() === '')
    && Number.isFinite(stockLu)
  const isCritical = !etat && !isLiquiditeCard && stockEstLisible && stockLu <= 0

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
        {/* L'ÉTAT, ÉCRIT — et il REMPLACE le libellé d'unité, il ne s'y ajoute
            pas. Deux lignes sous un montant, dans une bande qui en montre sept,
            c'est la moitié de la hauteur pour une information qu'on ne relit
            jamais : tout est en FCFA dans ce produit, et l'unité est portée par
            le nom accessible de la bande.

            `data-etat` est un FAIT — « cette réserve est épuisée » — et non une
            consigne d'apparence : la couleur qui le redouble est posée en CSS,
            sous `.design-registre`. Un profil sans cette identité lit donc le
            mot à l'encre du texte, et n'a rien perdu.

            Quand il n'y a pas d'état — la caisse, ou un profil sans seuil — le
            libellé d'origine reste. C'est la même règle que partout : pas de
            seuil, pas de mot, et rien d'autre ne change. */}
        <span
          data-reserve-mention
          data-etat={etat ? etat.cle : undefined}
          className={`text-xs ${config.textLight} font-medium`}
        >
          {etat ? etat.mot : label}
        </span>
      </div>
    </div>
  )
}

export default memo(NetworkBalanceCard)
