import { useState, useEffect, useRef } from 'react'
import { activeProfile } from '../../config/activeClientProfile.js'
import { SUPPLY_RESOURCES, SUPPLY_RESOURCE_LABELS } from '../../constants/supplyConstants'
import { createStoreSupply } from '../../services/storeSupplyService'
import useDialog from '../../hooks/useDialog'

const NETWORKS = [...activeProfile.networks.enabled]

/**
 * Saisie d'un RAVITAILLEMENT, en modale : montant, réseau, stock ou liquidité.
 *
 * ⚠ ON SAISIT UN MONTANT À AJOUTER, PAS UN SOLDE FINAL — et c'est tout l'écart
 * avec le crayon des cartes réseau qu'il remplace. Le crayon demandait « combien
 * la carte vaut-elle maintenant ? », ce qui obligeait à faire l'addition de tête
 * et écrivait un absolu sans dire d'où il venait. Ici on déclare l'apport ; le
 * serveur lit le solde, l'additionne, et consigne la ligne dans la même
 * transaction. Le champ s'appelle donc « Montant à ajouter », jamais « Montant ».
 *
 * Pas de fermeture au clic sur le fond : c'est un formulaire de saisie, et un
 * clic à côté effacerait un montant déjà tapé. On ferme par « Annuler » ou Échap,
 * comme les autres modales de saisie du projet.
 */
function SupplyFormModal({ onClose, onCreated }) {
  const [network, setNetwork] = useState(NETWORKS[0] ?? '')
  const [resource, setResource] = useState(SUPPLY_RESOURCES.STOCK)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const successTimer = useRef(null)

  // Échap, piège de focus et restitution du focus : mutualisés dans useDialog.
  const dialogRef = useDialog({ onClose })

  // Annuler le minuteur au démontage : fermer entre-temps déclencherait un
  // setState hors du cycle de vie du composant.
  useEffect(() => () => { if (successTimer.current) clearTimeout(successTimer.current) }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)
    try {
      const res = await createStoreSupply({ resource, amount, network, note })
      setSuccess(true)
      onCreated?.(res)
      successTimer.current = setTimeout(() => onClose?.(), 800)
    } catch (err) {
      // Le message vient du service, qui traduit le code métier du serveur.
      // On ne le remplace pas par un texte générique : « solde insuffisant » et
      // « montant invalide » appellent deux gestes différents.
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
        aria-labelledby="titre-ravitaillement"
        data-modale
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <h2 id="titre-ravitaillement" className="mb-4 text-lg font-semibold text-gray-800">
          Nouveau ravitaillement
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Réseau */}
          <div>
            <label htmlFor="ravitaillement-reseau" className="block text-sm font-medium text-gray-700 mb-1">Réseau</label>
            <select
              id="ravitaillement-reseau"
              value={network}
              onChange={(e) => setNetwork(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              {NETWORKS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          {/* Stock ou liquidité — des RADIOS et non un <select>.
              Deux options qui s'excluent et se lisent d'un coup d'œil : le choix
              doit être VISIBLE avant de valider, parce qu'il décide de quelle
              carte se remplit. Un <select> replié cache l'option non choisie. */}
          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 mb-1">Ressource</legend>
            <div className="flex gap-4">
              {[SUPPLY_RESOURCES.STOCK, SUPPLY_RESOURCES.LIQUIDITE].map((r) => (
                <label key={r} className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="ravitaillement-ressource"
                    value={r}
                    checked={resource === r}
                    onChange={() => setResource(r)}
                    className="h-4 w-4"
                  />
                  {SUPPLY_RESOURCE_LABELS[r]}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Montant */}
          <div>
            <label htmlFor="ravitaillement-montant" className="block text-sm font-medium text-gray-700 mb-1">
              Montant à ajouter (FCFA)
            </label>
            <input
              id="ravitaillement-montant"
              data-champ-montant
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Ex. 20000"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              Ce montant s’ajoute au solde actuel de la carte.
            </p>
          </div>

          {/* Note — facultative, contrairement au motif d'une annulation.
              Un apport n'a pas besoin de se justifier ; le reprendre, si. */}
          <div>
            <label htmlFor="ravitaillement-note" className="block text-sm font-medium text-gray-700 mb-1">
              Note <span className="font-normal text-gray-500">(facultatif)</span>
            </label>
            <input
              id="ravitaillement-note"
              type="text"
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex. Apport du gérant"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</p>
          )}
          {success && (
            <p className="rounded-lg border border-green-200 bg-green-50 p-2 text-xs text-green-700">
              Ravitaillement enregistré.
            </p>
          )}

          <div data-modale-pied className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onClose?.()}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
            >
              {submitting ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SupplyFormModal
