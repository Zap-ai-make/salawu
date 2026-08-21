import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useTheme } from '../../context/ThemeContext.jsx'
import PageHeader from '../../components/ui/PageHeader'
import StatusBadge from '../../components/ui/StatusBadge'
import { tabButtonClass, TabBadge } from '../../components/ui/Tabs.jsx'
import { themedTableClasses } from '../../components/ui/themedTable.js'
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
import { formatDateTime } from '../../utils/formatters'

const fmtAmount = (n) => (typeof n === 'number' ? n.toLocaleString('fr-FR') + ' FCFA' : '—')
const clientName = (c) => `${c.clientNom ?? ''} ${c.clientPrenom ?? ''}`.trim() || 'Client inconnu'

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

/**
 * @param {boolean} embedded - rendu comme sous-onglet de Transactions : pas de
 *   PageHeader (le <h1>Transactions</h1> tient lieu de titre), l'action passe
 *   au-dessus de la liste.
 * @param {'incoming'|'outgoing'} [initialTab='outgoing'] - sous-onglet ouvert au
 *   montage. Le parent le pilote depuis ?sub= pour que la pastille des reçues mène
 *   à leur onglet ; il change quand la pastille est cliquée, d'où la synchro.
 */
function StoreCollaborations({ embedded = false, initialTab = 'outgoing' }) {
  const { userProfile } = useAuth()
  const { themeClasses } = useTheme()
  const tbl = themedTableClasses(themeClasses)
  const storeId = userProfile?.storeId ?? null

  // « Mes demandes » par défaut : c'est l'écran de la boutique qui sollicite, le
  // geste courant. Les reçues restent signalées par leur pastille rouge, et par
  // celle de l'onglet parent Collaborations.
  const [tab, setTab] = useState(initialTab)
  const [incoming, setIncoming] = useState([])
  const [outgoing, setOutgoing] = useState([])
  const [error, setError] = useState(null)
  const [actioning, setActioning] = useState(null)
  const [rejectId, setRejectId] = useState(null)
  const [showNew, setShowNew] = useState(false)

  // Le parent fait suivre son ?sub= : quand la pastille des reçues est cliquée
  // alors que ce composant est déjà monté, initialTab passe à 'incoming' et l'on
  // bascule. La navigation interne (setTab) reste locale entre deux changements.
  useEffect(() => { setTab(initialTab) }, [initialTab])

  // « Mes demandes » et « Reçues » sont deux files OPÉRATIONNELLES : elles ne
  // listent que les collaborations « en attente ». Une fois confirmée ou rejetée,
  // la collaboration est terminée : elle quitte cette page et se retrouve dans
  // l'Historique (onglet Collaborations). Sans le filtre serveur sur les sortantes,
  // les confirmées restaient éternellement dans « Mes demandes » (bug signalé).
  useEffect(() => {
    if (!storeId) return undefined
    const u1 = subscribeIncomingCollaborations({ storeId, statusFilter: 'pending', onUpdate: setIncoming, onError: (e) => setError(e.message) })
    const u2 = subscribeOutgoingCollaborations({ storeId, statuses: ['pending'], onUpdate: setOutgoing, onError: (e) => setError(e.message) })
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

      {/* Basculeur : les deux abonnements restent montés, les pastilles vivent
          donc même quand leur tableau n'est pas affiché. */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" aria-pressed={tab === 'outgoing'} className={tabButtonClass(tab === 'outgoing')}
          onClick={() => setTab('outgoing')} data-testid="collab-subtab-outgoing">
          Mes demandes
          <TabBadge count={outgoing.length} active={tab === 'outgoing'} testId="collab-subtab-outgoing-badge"
            label={`${outgoing.length} demande${outgoing.length > 1 ? 's' : ''} envoyée${outgoing.length > 1 ? 's' : ''}`} />
        </button>
        <button type="button" aria-pressed={tab === 'incoming'} className={tabButtonClass(tab === 'incoming')}
          onClick={() => setTab('incoming')} data-testid="collab-subtab-incoming">
          Reçues (à exécuter)
          <TabBadge count={incoming.length} tone="alert" active={tab === 'incoming'} testId="collab-subtab-incoming-badge"
            label={`${incoming.length} collaboration${incoming.length > 1 ? 's' : ''} à exécuter`} />
        </button>
      </div>

      {/* Entrantes à confirmer */}
      {tab === 'incoming' && (
      <section>
        <div className={tbl.container}>
          <div className={tbl.scroll}>
            <table className="w-full border-collapse">
              <thead>
                <tr className={tbl.headerRow}>
                  <th className={tbl.headerCell}>Date &amp; heure</th>
                  <th className={tbl.headerCell}>Demandeuse</th>
                  <th className={tbl.headerCell}>Client</th>
                  <th className={tbl.headerCell}>Type</th>
                  <th className={tbl.headerCell}>Réseau</th>
                  <th className={tbl.headerCell}>Montant</th>
                  <th className={tbl.headerCellCenter}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {incoming.length === 0 ? (
                  <tr>
                    <td colSpan="7" className={tbl.empty}>Aucune collaboration en attente.</td>
                  </tr>
                ) : (
                  incoming.map(c => (
                    <tr key={c.id}>
                      <td className={`${tbl.cell} whitespace-nowrap text-gray-700`}>{formatDateTime(c.createdAt)}</td>
                      <td className={`${tbl.cell} font-medium text-gray-800`}>{c.requestingStoreName || 'Boutique inconnue'}</td>
                      <td className={`${tbl.cell} text-gray-700`}>{clientName(c)}</td>
                      <td className={`${tbl.cell} text-gray-700`}>{COLLAB_OPERATION_TYPE_LABELS[c.operationType] ?? c.operationType}</td>
                      <td className={`${tbl.cell} text-gray-700`}>{c.network}</td>
                      <td className={`${tbl.cell} whitespace-nowrap font-semibold text-gray-800`}>{fmtAmount(c.amount)}</td>
                      <td className={tbl.cell}>
                        <div className="flex justify-center gap-2">
                          <button type="button" disabled={actioning === c.id} onClick={() => handleConfirm(c.id)}
                            className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50">Confirmer</button>
                          <button type="button" onClick={() => setRejectId(c.id)}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">Rejeter</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      )}

      {/* Sortantes */}
      {tab === 'outgoing' && (
      <section>
        <div className={tbl.container}>
          <div className={tbl.scroll}>
            <table className="w-full border-collapse">
              <thead>
                <tr className={tbl.headerRow}>
                  <th className={tbl.headerCell}>Date &amp; heure</th>
                  <th className={tbl.headerCell}>Fournisseur</th>
                  <th className={tbl.headerCell}>Client</th>
                  <th className={tbl.headerCell}>Type</th>
                  <th className={tbl.headerCell}>Réseau</th>
                  <th className={tbl.headerCell}>Montant</th>
                  <th className={tbl.headerCell}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {outgoing.length === 0 ? (
                  <tr>
                    <td colSpan="7" className={tbl.empty}>Aucune demande en attente.</td>
                  </tr>
                ) : (
                  outgoing.map(c => (
                    <tr key={c.id}>
                      <td className={`${tbl.cell} whitespace-nowrap text-gray-700`}>{formatDateTime(c.createdAt)}</td>
                      <td className={`${tbl.cell} font-medium text-gray-800`}>{c.supplierStoreName || 'Boutique inconnue'}</td>
                      <td className={`${tbl.cell} text-gray-700`}>{clientName(c)}</td>
                      <td className={`${tbl.cell} text-gray-700`}>{COLLAB_OPERATION_TYPE_LABELS[c.operationType] ?? c.operationType}</td>
                      <td className={`${tbl.cell} text-gray-700`}>{c.network}</td>
                      <td className={`${tbl.cell} whitespace-nowrap font-semibold text-gray-800`}>{fmtAmount(c.amount)}</td>
                      <td className={`${tbl.cell} whitespace-nowrap`}>
                        <StatusBadge status={c.status} label={COLLAB_STATUS_LABELS[c.status] ?? c.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      )}

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
