import { createPortal } from 'react-dom'
import { Printer } from 'lucide-react'
import TransactionReceipt from './TransactionReceipt.jsx'
import useDialog from '../../hooks/useDialog'

/**
 * ReceiptModal — aperçu plein écran du reçu + impression navigateur.
 * ─────────────────────────────────────────────────────────────────────────────
 * Même convention que les autres modales de l'app : overlay `z-[9990]`,
 * `role="dialog"`, fermeture par Escape ou clic sur le fond. Le bouton
 * « Imprimer » déclenche `window.print()` ; la feuille @media print (index.css)
 * ne sort que le ticket (#receipt-print-root), pas la barre d'actions ni le chrome.
 */
function ReceiptModal({ transaction, onClose }) {
  // Escape, piege de focus et restitution : mutualises dans useDialog. Le ref va
  // sur le PANNEAU (le ticket + ses actions), pas sur le voile.
  const dialogRef = useDialog({ isOpen: Boolean(transaction), onClose })

  if (!transaction) return null

  // `data-modale-voile` et `data-portail` sont des FAITS inertes.
  //
  // ⚠ `data-portail` N'EST PAS DECORATIF : cette modale rend par `createPortal`
  // dans `document.body`, donc HORS de `<main data-espace="boutique">`. La portee
  // d'espace ne l'atteint pas, et sans ce second fait le lot L9.6 aurait habille
  // onze modales sur douze en silence. Voir le bloc « LA MODALE » de
  // src/index.css, qui porte les deux cas cote a cote.
  return createPortal(
    <div
      data-modale-voile
      data-portail
      className="fixed inset-0 z-[9990] flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Reçu de transaction"
      data-testid="receipt-modal"
      onMouseDown={() => onClose?.()}
    >
      <div
        ref={dialogRef}
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
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            Imprimer / Enregistrer en PDF
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
