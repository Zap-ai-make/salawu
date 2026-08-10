import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import PageHeader from '../../components/ui/PageHeader'
import CollaborationFormModal from '../../components/store/CollaborationFormModal'
import {
  subscribeIncomingCollaborations,
  subscribeOutgoingCollaborations,
  confirmStoreCollaboration,
  rejectStoreCollaboration,
} from '../../services/collaborationService'
import {
  COLLAB_OPERATION_TYPE_LABELS,
  COLLAB_STATUS_LABELS,
} from '../../constants/dealerConstants'

const fmtAmount = (n) => (typeof n === 'number' ? n.toLocaleString('fr-FR') + ' FCFA' : '—')
const clientName = (c) => `${c.clientNom ?? ''} ${c.clientPrenom ?? ''}`.trim() || c.clientId

function RejectModal({ onSubmit, onClose }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="mb-3 text-base font-semibold text-gray-800">Rejeter la collaboration</h3>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
          placeholder="Motif (min. 3 caractères)…" className="w-full rounded border border-gray-300 p-2 text-sm" aria-label="Motif de rejet" />
        {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm">Annuler</button>
          <button type="button" disabled={busy}
            onClick={async () => { setBusy(true); setErr(null); try { await onSubmit(reason.trim()) } catch (e) { setErr(e.message); setBusy(false) } }}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
            {busy ? 'Rejet…' : 'Rejeter'}
          </button>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const cls = status === 'confirmed' ? 'bg-green-100 text-green-700' : status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
  return <span className={`rounded-md px-2 py-0.5 text-xs ${cls}`}>{COLLAB_STATUS_LABELS[status] ?? status}</span>
}

/**
 * @param {boolean} embedded - rendu comme sous-onglet de Transactions : pas de
 *   PageHeader (le <h1>Transactions</h1> tient lieu de titre), l'action passe
 *   au-dessus de la liste.
 */
function StoreCollaborations({ embedded = false }) {
  const { userProfile } = useAuth()
  const storeId = userProfile?.storeId ?? null

  const [incoming, setIncoming] = useState([])
  const [outgoing, setOutgoing] = useState([])
  const [error, setError] = useState(null)
  const [actioning, setActioning] = useState(null)
  const [rejectId, setRejectId] = useState(null)
  const [showNew, setShowNew] = useState(false)

  useEffect(() => {
    if (!storeId) return undefined
    const u1 = subscribeIncomingCollaborations({ storeId, statusFilter: 'pending', onUpdate: setIncoming, onError: (e) => setError(e.message) })
    const u2 = subscribeOutgoingCollaborations({ storeId, onUpdate: setOutgoing, onError: (e) => setError(e.message) })
    return () => { u1(); u2() }
  }, [storeId])

  const handleConfirm = useCallback(async (id) => {
    setActioning(id); setError(null)
    try { await confirmStoreCollaboration(id) } catch (e) { setError(e.message) } finally { setActioning(null) }
  }, [])

  const handleReject = useCallback(async (reason) => {
    await rejectStoreCollaboration(rejectId, reason)
    setRejectId(null)
  }, [rejectId])

  const newButton = (
    <button type="button" onClick={() => setShowNew(true)}
      className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700">
      Nouvelle collaboration
    </button>
  )

  return (
    <div>
      {embedded ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-gray-500">Servir un client via une autre boutique, ou exécuter les demandes reçues</p>
          {newButton}
        </div>
      ) : (
        <PageHeader
          title="Collaborations"
          subtitle="Servir un client via une autre boutique, ou exécuter les demandes reçues"
          actions={newButton}
        />
      )}

      {error &&<p className="mb-4 rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-700">{error}</p>}

      {/* Entrantes à confirmer */}
      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Reçues (à exécuter) — {incoming.length}</h2>
        {incoming.length === 0 ? (
          <p className="text-sm text-gray-400">Aucune collaboration en attente.</p>
        ) : (
          <div className="space-y-2">
            {incoming.map(c => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
                <div className="text-sm text-gray-700">
                  <span className="font-medium">{c.requestingStoreName ?? c.requestingStoreId}</span> → {clientName(c)} ·
                  {' '}{c.network} · {COLLAB_OPERATION_TYPE_LABELS[c.operationType] ?? c.operationType} · <span className="font-semibold">{fmtAmount(c.amount)}</span>
                </div>
                <div className="flex gap-2">
                  <button type="button" disabled={actioning === c.id} onClick={() => handleConfirm(c.id)}
                    className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50">Confirmer</button>
                  <button type="button" onClick={() => setRejectId(c.id)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">Rejeter</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Sortantes */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Mes demandes — {outgoing.length}</h2>
        {outgoing.length === 0 ? (
          <p className="text-sm text-gray-400">Aucune demande envoyée.</p>
        ) : (
          <div className="space-y-2">
            {outgoing.map(c => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
                <div className="text-sm text-gray-700">
                  → <span className="font-medium">{c.supplierStoreName ?? c.supplierStoreId}</span> · {clientName(c)} ·
                  {' '}{c.network} · {COLLAB_OPERATION_TYPE_LABELS[c.operationType] ?? c.operationType} · <span className="font-semibold">{fmtAmount(c.amount)}</span>
                </div>
                <StatusBadge status={c.status} />
              </div>
            ))}
          </div>
        )}
      </section>

      {rejectId && <RejectModal onSubmit={handleReject} onClose={() => setRejectId(null)} />}
      {showNew && (
        <CollaborationFormModal
          onClose={() => setShowNew(false)}
          onCreated={() => setShowNew(false)}
        />
      )}
    </div>
  )
}

export default StoreCollaborations
