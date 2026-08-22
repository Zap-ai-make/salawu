import { useState } from 'react'
import { useTheme } from '../../context/ThemeContext.jsx'
import { getClientName, formatTransactionDateTime } from '../../utils/helpers.js'
import { directionFromType, directionStyles } from '../../utils/transactionDirection.js'
import DirectionBadge from '../ui/DirectionBadge.jsx'
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
    'Type',
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
        <td className="border border-gray-200 px-4 py-3 text-base font-medium whitespace-nowrap">
          {transaction.montant ? `${(Number(transaction.montant) || 0).toLocaleString('fr-FR')} FCFA` :
           transaction.amount ? `${transaction.amount} FCFA` : '-'}
        </td>
        <td className="border border-gray-200 px-4 py-3 text-base whitespace-nowrap">
          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
            {transaction.statut || 'Validée'}
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
        className={`overflow-x-auto ${isVirtualized ? 'overflow-y-auto max-h-[70vh]' : ''} border ${borderClass} rounded`}
      >
        <table className="w-full border-collapse min-w-max">
          <thead className={isVirtualized ? 'sticky top-0 z-10' : ''}>
            <tr className={themeClasses.tableHeader}>
              {headers.map((header, index) => (
                <th
                  key={index}
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
