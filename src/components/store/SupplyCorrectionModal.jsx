import { useState, useRef, useEffect } from 'react'
import { correctStoreSupply, cancelStoreSupply } from '../../services/storeSupplyService'
import { SUPPLY_RESOURCE_LABELS } from '../../constants/supplyConstants'
import { formatStoredAmount } from '../../utils/formatCurrency'
import useDialog from '../../hooks/useDialog'

/**
 * Corriger ou annuler un ravitaillement déjà consigné.
 *
 * UN SEUL COMPOSANT POUR DEUX GESTES, parce qu'ils ne diffèrent que d'un champ :
 * corriger demande un nouveau montant, annuler n'en demande pas. Les séparer
 * aurait dupliqué l'en-tête, le rappel de la ligne visée, la gestion d'erreur et
 * le piège de focus — quatre occasions de diverger pour une variante de formulaire.
 *
 * ⚠ CE QUE CET ÉCRAN NE DIT PAS, ET NE DOIT PAS DIRE : « supprimer ». Le bouton
 * s'appelle « Annuler le ravitaillement », parce que c'est ce qui se passe — le
 * montant est repris et la ligne reste, barrée. Écrire « supprimer » promettrait
 * une disparition que le backend refuse (CLAUDE.md : toute opération financière
 * préserve sa piste d'audit), et l'utilisateur croirait à un bug en revoyant la
 * ligne.
 *
 * ⚠ LE MOTIF EST OBLIGATOIRE POUR ANNULER, facultatif pour corriger. Une
 * annulation fait disparaître une entrée d'argent de la lecture courante : c'est
 * le seul geste dont la trace serait illisible sans sa raison. Le backend
 * applique la même règle — ici ce n'est qu'un garde-fou d'ergonomie, pas la
 * source de vérité.
 */
function SupplyCorrectionModal({ supply, mode, onClose, onDone }) {
  const annulation = mode === 'cancel'

  const [amount, setAmount] = useState(String(supply?.amount ?? ''))
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const dialogRef = useDialog({ onClose })
  const doneTimer = useRef(null)
  useEffect(() => () => { if (doneTimer.current) clearTimeout(doneTimer.current) }, [])

  const motifManquant = annulation && reason.trim() === ''

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting || motifManquant) return
    setError(null)
    setSubmitting(true)
    try {
      if (annulation) {
        await cancelStoreSupply({ supplyId: supply.id, reason })
      } else {
        await correctStoreSupply({ supplyId: supply.id, amount, reason })
      }
      onDone?.()
      onClose?.()
    } catch (err) {
      setError(err?.message || "L'opération n'a pas pu être finalisée.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-correction-ravitaillement"
        data-modale
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <h2 id="titre-correction-ravitaillement" className="mb-1 text-lg font-semibold text-gray-800">
          {annulation ? 'Annuler le ravitaillement' : 'Corriger le ravitaillement'}
        </h2>

        {/* Rappel de la ligne visée. Sur un écran qui liste des dizaines de
            montants proches, agir sur la mauvaise ligne est l'erreur la plus
            facile à commettre et la plus longue à comprendre. */}
        <p className="mb-4 text-sm text-gray-600">
          {supply?.network} · {SUPPLY_RESOURCE_LABELS[supply?.resource] ?? supply?.resource} ·{' '}
          <strong>{formatStoredAmount(supply?.amount)}</strong>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!annulation && (
            <div>
              <label htmlFor="correction-montant" className="block text-sm font-medium text-gray-700 mb-1">
                Nouveau montant (FCFA)
              </label>
              <input
                id="correction-montant"
                data-champ-montant
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
              {/* On annonce le sens du mouvement AVANT de valider : corriger
                  n'ajoute pas le nouveau montant, il applique la différence. */}
              <p className="mt-1 text-xs text-gray-500">
                Le solde de la carte sera ajusté de la différence, pas du montant entier.
              </p>
            </div>
          )}

          <div>
            <label htmlFor="correction-motif" className="block text-sm font-medium text-gray-700 mb-1">
              Motif {annulation
                ? <span className="font-normal text-gray-500">(obligatoire)</span>
                : <span className="font-normal text-gray-500">(facultatif)</span>}
            </label>
            <input
              id="correction-motif"
              type="text"
              maxLength={300}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={annulation ? 'Ex. Saisi deux fois' : 'Ex. Erreur de saisie'}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          {annulation && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
              Le montant sera repris sur la carte. La ligne restera visible dans
              l’historique, marquée « Annulé ».
            </p>
          )}

          {error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</p>
          )}

          <div data-modale-pied className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onClose?.()}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Fermer
            </button>
            <button
              type="submit"
              disabled={submitting || motifManquant}
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                annulation ? 'bg-red-700 hover:bg-red-800' : 'bg-green-700 hover:bg-green-800'
              }`}
            >
              {submitting
                ? 'Envoi…'
                : annulation ? 'Annuler le ravitaillement' : 'Enregistrer la correction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SupplyCorrectionModal
