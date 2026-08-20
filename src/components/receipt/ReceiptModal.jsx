import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import TransactionReceipt from './TransactionReceipt.jsx'

/**
 * ReceiptModal — aperçu plein écran du reçu + impression navigateur.
 * ─────────────────────────────────────────────────────────────────────────────
 * Même convention que les autres modales de l'app : overlay `z-[9990]`,
 * `role="dialog"`, fermeture par Escape ou clic sur le fond. Le bouton
 * « Imprimer » déclenche `window.print()` ; la feuille @media print (index.css)
 * ne sort que le ticket (#receipt-print-root), pas la barre d'actions ni le chrome.
 */
function ReceiptModal({ transaction, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!transaction) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[9990] flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Reçu de transaction"
      data-testid="receipt-modal"
      onMouseDown={() => onClose?.()}
    >
      <div
        className="my-8 w-full max-w-sm"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="overflow-hidden rounded-lg bg-white shadow-xl">
          <TransactionReceipt transaction={transaction} />
        </div>

        {/* Barre d'actions — hors #receipt-print-root, donc jamais imprimée. */}
        <div className="mt-3 flex gap-2" data-receipt-actions>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
          >
            🖨 Imprimer / Enregistrer en PDF
          </button>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default ReceiptModal
