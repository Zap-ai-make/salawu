import { useState } from 'react'
import { Eye } from 'lucide-react'
import useDialog from '../../hooks/useDialog'

/**
 * Bouton « œil » affichant la remarque de rejet d'une boutique dans un modal.
 * Composant autonome (gère son propre état d'ouverture) → réutilisable partout
 * où l'historique/les demandes Dealer sont affichés.
 *
 * Rend « — » quand il n'y a pas de remarque, pour rester alignable en cellule.
 *
 * @param {string} storeName  Nom de la boutique à l'origine de la remarque.
 * @param {string} reason     Texte de la remarque de rejet.
 * @param {string} [testId]   data-testid optionnel pour les tests.
 */
function RejectionRemarkButton({ storeName, reason, testId }) {
  const [open, setOpen] = useState(false)
  const dialogRef = useDialog({ isOpen: open, onClose: () => setOpen(false) })

  if (!reason) return <span className="text-encre-doux">—</span>

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        aria-label={`Voir la remarque de rejet de ${storeName}`}
        data-testid={testId}
      >
        <Eye className="h-4 w-4" aria-hidden="true" />
        Voir
      </button>

      {open && (
        <div
          data-modale-voile
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remark-modal-title"
          onClick={() => setOpen(false)}
        >
          <div
            ref={dialogRef}
            data-modale
            className="w-full max-w-md rounded-xl bg-white shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div data-modale-tete data-modale-bande className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
              <div>
                <h2 id="remark-modal-title" className="text-base font-semibold text-gray-900">
                  Remarque de rejet
                </h2>
                <p className="mt-0.5 text-xs text-gray-500">{storeName}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-encre-doux hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
                aria-label="Fermer"
                data-modale-fermer
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="whitespace-pre-wrap rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {reason}
              </p>
            </div>
            <div data-modale-pied data-modale-bande className="flex justify-end border-t border-gray-100 px-5 py-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default RejectionRemarkButton
