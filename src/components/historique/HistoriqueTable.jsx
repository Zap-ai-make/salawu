import { useState } from 'react'
import { useTheme } from '../../context/ThemeContext.jsx'
import { getClientName, formatTransactionDateTime } from '../../utils/helpers.js'
import { directionFromType, directionStyles } from '../../utils/transactionDirection.js'
import DirectionBadge from '../ui/DirectionBadge.jsx'
import { sensDuStock, montantSigne } from '../../utils/signeDuStock.js'
import { cleDuStatut, formeDuStatut } from '../../utils/statutDuMouvement.js'
import { IS_REGISTRE } from '../../constants/designSystem.js'
import { useWindowedRows } from '../../hooks/useWindowedRows.js'
import ReceiptModal from '../receipt/ReceiptModal.jsx'

// Au-delà de ce nombre de lignes, on active le fenêtrage (virtualisation).
// En dessous, le rendu est strictement identique à l'historique (aucune régression).
const VIRTUALIZE_THRESHOLD = 60
// Hauteur de repli d'une ligne (px) tant que la mesure réelle n'est pas disponible.
const DEFAULT_ROW_HEIGHT = 49

function HistoriqueTable({ transactions = [] }) {
  const { themeClasses } = useTheme()
  const allTransactions = transactions
  const [receiptTx, setReceiptTx] = useState(null)

  const headers = [
    'Date & heure',
    'Client',
    // ⚠ « Nature » et non « Type » : c'est le mot employe sur l'ecran
    // Transactions et dans la maquette. Deux noms pour une meme colonne font
    // apprendre deux langues au caissier.
    'Nature',
    'Réseau',
    'Code',
    'Montant',
    'Statut',
    'Utilisateur',
    'Email utilisateur',
    'Reçu'
  ]

  const borderClass = themeClasses.tableHeader.split(' ')[1]
  const isVirtualized = allTransactions.length > VIRTUALIZE_THRESHOLD

  const { containerRef, rowRef, onScroll, startIndex, endIndex, topPad, bottomPad } =
    useWindowedRows({ itemCount: allTransactions.length, defaultRowHeight: DEFAULT_ROW_HEIGHT })

  // Une seule définition du markup de ligne, partagée par les deux branches.
  const renderRow = (transaction, index, ref) => {
    const direction = directionFromType(transaction.type)
    const ds = directionStyles(direction)
    // ⚠ LE MOT AFFICHÉ ET LA COULEUR SE CALCULENT SUR LA MÊME VALEUR.
    // Une transaction sans statut s'affiche « Validée » depuis toujours ; colorer
    // `transaction.statut` directement aurait rendu le mot « Validée » en gris
    // neutre, c'est-à-dire le défaut que ce lot corrige, retourné. Le repli est
    // conservé tel quel : le changer serait une décision métier, pas un lot de
    // design.
    const statutAffiche = transaction.statut || 'Validée'
    return (
      <tr
        ref={ref}
        key={transaction.id || `${transaction.clientId || 'transaction'}-${transaction.date || index}-${index}`}
        className={`border-b border-gray-100 ${ds.rowBg} text-gray-800`}
      >
        <td className={`border border-gray-200 ${ds.accent} px-4 py-3 text-base whitespace-nowrap`}>
          {formatTransactionDateTime(transaction)}
        </td>
        <td className="border border-gray-200 px-4 py-3 text-base whitespace-nowrap">
          {getClientName(transaction.client)}
        </td>
        <td className="border border-gray-200 px-4 py-3 text-base whitespace-nowrap">
          <DirectionBadge direction={direction} label={transaction.type || '-'} />
        </td>
        <td className="border border-gray-200 px-4 py-3 text-base whitespace-nowrap">
          {transaction.reseau || transaction.network || '-'}
        </td>
        <td className="border border-gray-200 px-4 py-3 text-base whitespace-nowrap">
          {transaction.code || '-'}
        </td>
        {/* `data-montant` declare un FAIT — cette cellule porte une somme — et non
            une apparence. Le filet du registre, l'alignement a droite et les
            chiffres tabulaires sont appliques par src/index.css sous la portee
            `.design-registre`. TAOFIC ne porte pas cette portee et reste
            inchange, sans qu'aucune condition n'apparaisse ici. */}
        {/* ⚠ LE SIGNE SUIT LE STOCK ÉLECTRONIQUE (décision client, 2026-09-18).
            `data-sens` est un FAIT — ce mouvement sort du stock ou y rentre — et
            la couleur vient de src/index.css sous la portée. TAOFIC garde son
            montant sans signe : `montantSigne` n'est appelé que sous l'identité,
            et la règle vit dans `utils/signeDuStock.js` (TC-174). */}
        <td
          data-montant
          data-sens={IS_REGISTRE ? sensDuStock(transaction.type).cle : undefined}
          className="border border-gray-200 px-4 py-3 text-base font-medium whitespace-nowrap"
        >
          {IS_REGISTRE
            ? (montantSigne(transaction.montant ?? transaction.amount, transaction.type) || '-')
              + (transaction.montant || transaction.amount ? ' FCFA' : '')
            : (transaction.montant ? `${(Number(transaction.montant) || 0).toLocaleString('fr-FR')} FCFA` :
               transaction.amount ? `${transaction.amount} FCFA` : '-')}
        </td>
        <td className="border border-gray-200 px-4 py-3 text-base whitespace-nowrap">
          {/* ⚠ CETTE PASTILLE ÉTAIT VERTE QUEL QUE SOIT LE STATUT.
              `bg-green-100 text-green-800` était écrit en dur : une opération
              « Annulée » s'affichait dans le vert de la réussite, et sur un écran
              parcouru vite, la couleur se lit avant le mot. Le banc le dénonçait
              depuis qu'il a été écrit (etats-limites.spec.js).

              `data-statut` et `data-forme` sont des FAITS, décidés par
              `utils/statutDuMouvement.js` (TC-177) : la règle vit dans un module
              pur, pas dans ce JSX. L'apparence vient de src/index.css sous la
              portée. Les classes historiques restent — TAOFIC est en production,
              et il ne porte ni la portée ni les attributs.

              La FORME est le troisième canal exigé par la maquette : « une
              couleur, un mot, une forme ». C'est elle qui sépare « Remboursée »
              d'« Annulée », qui partagent délibérément la même teinte neutre.
              `aria-hidden` : elle ne dit rien que le mot à côté ne dise déjà. */}
          <span
            data-statut={IS_REGISTRE ? cleDuStatut(statutAffiche) : undefined}
            className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm"
          >
            {IS_REGISTRE && (
              <span data-forme={formeDuStatut(statutAffiche)} aria-hidden="true" />
            )}
            {statutAffiche}
          </span>
        </td>
        <td className="border border-gray-200 px-4 py-3 text-base whitespace-nowrap">
          {transaction.operatorName || transaction.userName || '-'}
        </td>
        <td className="border border-gray-200 px-4 py-3 text-base whitespace-nowrap">
          {transaction.operatorEmail || transaction.userEmail || '-'}
        </td>
        <td className="border border-gray-200 px-4 py-3 text-base whitespace-nowrap text-center">
          <button
            onClick={() => setReceiptTx(transaction)}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 px-3 py-1 rounded text-sm font-medium transition-colors"
          >
            Reçu
          </button>
        </td>
      </tr>
    )
  }

  // Lignes à rendre : toute la liste (court) ou la seule fenêtre visible (long).
  const visibleRows = isVirtualized
    ? allTransactions.slice(startIndex, endIndex)
    : allTransactions

  return (
    <div className="mt-6">
      <div
        ref={containerRef}
        onScroll={isVirtualized ? onScroll : undefined}
        tabIndex={0}
        role="region"
        aria-label="Historique des transactions, defilement horizontal"
        className={`overflow-x-auto ${isVirtualized ? 'overflow-y-auto max-h-[70vh]' : ''} border ${borderClass} rounded`}
      >
        <table className="w-full border-collapse min-w-max">
          <thead className={isVirtualized ? 'sticky top-0 z-10' : ''}>
            <tr className={themeClasses.tableHeader}>
              {headers.map((header, index) => (
                <th
                  key={index}
                  // Meme declaration que la cellule : sans elle, la reglure
                  // demarrerait a la premiere ligne de donnees et paraitrait
                  // tronquee sous l'en-tete.
                  data-montant={header === 'Montant' ? '' : undefined}
                  className={`border ${borderClass} px-4 py-3 text-left text-base font-medium ${themeClasses.text} whitespace-nowrap`}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allTransactions.length === 0 ? (
              <tr>
                <td
                  colSpan={headers.length}
                  className="border border-gray-200 px-4 py-8 text-center text-gray-500"
                >
                  Aucune transaction dans l'historique
                </td>
              </tr>
            ) : (
              <>
                {isVirtualized && topPad > 0 && (
                  <tr aria-hidden="true">
                    <td colSpan={headers.length} style={{ height: topPad, padding: 0, border: 'none' }} />
                  </tr>
                )}
                {visibleRows.map((transaction, i) =>
                  renderRow(transaction, startIndex + i, isVirtualized && i === 0 ? rowRef : undefined)
                )}
                {isVirtualized && bottomPad > 0 && (
                  <tr aria-hidden="true">
                    <td colSpan={headers.length} style={{ height: bottomPad, padding: 0, border: 'none' }} />
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      {receiptTx && (
        <ReceiptModal transaction={receiptTx} onClose={() => setReceiptTx(null)} />
      )}
    </div>
  )
}

export default HistoriqueTable
