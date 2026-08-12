import { useState, useContext, useEffect, useMemo, useRef } from 'react'
import { ClientsContext } from '../../context/ClientsContext.jsx'
import { activeProfile } from '../../config/activeClientProfile.js'
import { COLLAB_OPERATION_TYPE_LABELS } from '../../constants/dealerConstants'
import { createStoreCollaboration, listStoreCollaborationProviders } from '../../services/collaborationService'

const NETWORKS = [...activeProfile.networks.enabled]

/**
 * Formulaire de création de collaboration, en modal.
 *
 * Pas de fermeture au clic sur le fond : c'est un formulaire de saisie, un clic
 * à côté effacerait un client et un montant déjà choisis. On ferme par « Annuler »
 * ou Échap, comme les autres modals de saisie du projet.
 */
function CollaborationFormModal({ onClose, onCreated }) {
  const clientsCtx = useContext(ClientsContext)
  const clients = clientsCtx?.clients

  const [clientId, setClientId] = useState('')
  const [clientQuery, setClientQuery] = useState('')
  const [showClientList, setShowClientList] = useState(false)
  const [network, setNetwork] = useState(NETWORKS[0] ?? '')
  const [operationType, setOperationType] = useState('deposit')
  const [amount, setAmount] = useState('')
  const [supplierStoreId, setSupplierStoreId] = useState('')
  const [providers, setProviders] = useState([])
  const [loadingProviders, setLoadingProviders] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const successTimer = useRef(null)

  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // Le message de succès reste 800 ms avant la fermeture : annuler le minuteur au
  // démontage, sinon fermer entre-temps déclenche un setState hors du cycle de vie.
  useEffect(() => () => { if (successTimer.current) clearTimeout(successTimer.current) }, [])

  useEffect(() => {
    let cancelled = false
    if (!network) { setProviders([]); return }
    setLoadingProviders(true)
    setSupplierStoreId('')
    listStoreCollaborationProviders(network)
      .then(list => { if (!cancelled) setProviders(list) })
      .catch(() => { if (!cancelled) setProviders([]) })
      .finally(() => { if (!cancelled) setLoadingProviders(false) })
    return () => { cancelled = true }
  }, [network])

  const filteredClients = useMemo(() => {
    const list = clients ?? []
    const q = clientQuery.trim().toLowerCase()
    const base = q
      ? list.filter(c => `${c.nom ?? ''} ${c.prenom ?? ''}`.toLowerCase().includes(q))
      : list
    return base.slice(0, 8)
  }, [clients, clientQuery])

  const selectClient = (c) => {
    setClientId(c.id)
    setClientQuery(`${c.nom ?? ''} ${c.prenom ?? ''}`.trim())
    setShowClientList(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null); setSuccess(false)
    if (!clientId) { setError('Sélectionnez un client.'); return }
    if (!supplierStoreId) { setError('Sélectionnez une boutique fournisseuse.'); return }
    setSubmitting(true)
    try {
      await createStoreCollaboration({ clientId, network, operationType, amount, supplierStoreId })
      setSuccess(true)
      successTimer.current = setTimeout(() => onCreated?.(), 800)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="collab-form-title"
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <h3 id="collab-form-title" className="text-base font-semibold text-gray-800">Nouvelle collaboration</h3>
        <p className="mb-4 text-xs text-gray-500">Faire servir un client par une boutique fournisseuse</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Client */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
            <input
              type="text"
              value={clientQuery}
              onChange={e => { setClientQuery(e.target.value); setClientId(''); setShowClientList(true) }}
              onFocus={() => setShowClientList(true)}
              placeholder="Rechercher un client…"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
              aria-label="Rechercher un client"
            />
            {showClientList && filteredClients.length > 0 && !clientId && (
              <ul className="absolute z-10 mt-1 w-full rounded border border-gray-200 bg-white shadow max-h-56 overflow-y-auto">
                {filteredClients.map(c => (
                  <li key={c.id}>
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); selectClient(c) }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100">
                      {(c.nom ?? '') + ' ' + (c.prenom ?? '')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Réseau */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Réseau</label>
            <select value={network} onChange={e => setNetwork(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm" aria-label="Réseau">
              {NETWORKS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          {/* Type d'opération */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Opération</label>
            <select value={operationType} onChange={e => setOperationType(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm" aria-label="Opération">
              <option value="deposit">{COLLAB_OPERATION_TYPE_LABELS.deposit}</option>
              <option value="withdrawal">{COLLAB_OPERATION_TYPE_LABELS.withdrawal}</option>
            </select>
          </div>

          {/* Montant */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Montant (FCFA)</label>
            <input type="text" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="Ex. 20000" className="w-full rounded border border-gray-300 px-3 py-2 text-sm" aria-label="Montant" />
          </div>

          {/* Fournisseur */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Boutique fournisseuse</label>
            <select value={supplierStoreId} onChange={e => setSupplierStoreId(e.target.value)}
              disabled={loadingProviders || providers.length === 0}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm disabled:opacity-50" aria-label="Boutique fournisseuse">
              <option value="">{loadingProviders ? 'Chargement…' : (providers.length ? 'Choisir…' : 'Aucun fournisseur pour ce réseau')}</option>
              {providers.map(p => <option key={p.storeId} value={p.storeId}>{p.storeName || 'Boutique sans nom'}</option>)}
            </select>
          </div>

          {error && <p className="rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-700">{error}</p>}
          {success && <p className="rounded-lg bg-green-50 border border-green-200 p-2 text-xs text-green-700">Collaboration créée.</p>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => onClose?.()}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
            <button type="submit" disabled={submitting}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
              {submitting ? 'Envoi…' : 'Créer la collaboration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CollaborationFormModal
