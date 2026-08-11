import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { IS_MULTI_NETWORK } from '../constants/navigation'
import DateFilter from '../components/historique/DateFilter'
import ClientSearch from '../components/historique/ClientSearch'
import HistoriqueTable from '../components/historique/HistoriqueTable'
import ActionButtons from '../components/historique/ActionButtons'
import DailyPagination from '../components/historique/DailyPagination'
import { useHistoriqueFilters } from '../hooks/useHistoriqueFilters'
import { tabButtonClass, TabBadge } from '../components/ui/Tabs.jsx'
import { themedTableClasses } from '../components/ui/themedTable.js'
import StatusBadge from '../components/ui/StatusBadge'
import { formatDateTime } from '../utils/formatters'
import { filterHistoryRows } from '../utils/historyFilter.js'
import { subscribeStoreTransfers } from '../services/storeTransferService'
import {
  subscribeIncomingCollaborations,
  subscribeOutgoingCollaborations,
} from '../services/collaborationService'
import {
  STORE_TRANSFER_TYPE_LABELS,
  DEALER_REQUEST_STATUS_LABELS,
  COLLAB_OPERATION_TYPE_LABELS,
  COLLAB_STATUS_LABELS,
} from '../constants/dealerConstants'

const fmtAmount = (n) => (typeof n === 'number' ? n.toLocaleString('fr-FR') + ' FCFA' : '—')
const toDate = (ts) => (ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null)
// L'Historique ne montre que le TERMINÉ, comme les transactions client (seules les
// complétées y vont). Une opération dealer / collaboration « En attente » reste dans
// son onglet opérationnel (Transactions), pas ici.
const isTerminal = (status) => status === 'confirmed' || status === 'rejected'
const collabClient = (c) => `${c.clientNom ?? ''} ${c.clientPrenom ?? ''}`.trim() || c.clientId || '—'

function Historique() {
  const { userProfile } = useAuth()
  const { themeClasses } = useTheme()
  const tbl = themedTableClasses(themeClasses)
  const storeId = userProfile?.storeId ?? null

  // L'onglet « Transactions clients » garde son filtrage historique intact ; on
  // relit simplement l'état de filtre exposé par le hook pour l'appliquer aussi aux
  // deux nouvelles sources → filtres partagés, sans toucher au tab client existant.
  const {
    dateFilter,
    searchTerm,
    showTodayOnly,
    filteredTransactions,
    allTransactions,
    applyDateFilter,
    applySearchFilter,
    handleSearchChange,
    resetToToday,
    resetFilters,
  } = useHistoriqueFilters()

  const [tab, setTab] = useState('clients')
  const [transfers, setTransfers] = useState([])
  const [incoming, setIncoming] = useState([])
  const [outgoing, setOutgoing] = useState([])

  // Les deux abonnements restent montés quel que soit l'onglet : les pastilles de
  // comptage vivent, et basculer d'onglet n'attend pas un rechargement.
  useEffect(() => {
    if (!storeId) { setTransfers([]); return undefined }
    return subscribeStoreTransfers({ storeId, onUpdate: setTransfers, onError: () => setTransfers([]) })
  }, [storeId])

  useEffect(() => {
    if (!storeId || !IS_MULTI_NETWORK) { setIncoming([]); setOutgoing([]); return undefined }
    const u1 = subscribeIncomingCollaborations({ storeId, onUpdate: setIncoming, onError: () => setIncoming([]) })
    const u2 = subscribeOutgoingCollaborations({ storeId, onUpdate: setOutgoing, onError: () => setOutgoing([]) })
    return () => { u1(); u2() }
  }, [storeId])

  const filterArgs = { from: dateFilter.from, to: dateFilter.to, search: searchTerm, todayOnly: showTodayOnly }

  const dealerRows = transfers
    .filter((t) => isTerminal(t.status))
    .map((t) => ({
      when: toDate(t.createdAt),
      search: `${STORE_TRANSFER_TYPE_LABELS[t.transferType] ?? t.transferType ?? ''} ${t.network ?? ''} ${t.amount ?? ''}`,
      data: t,
    }))
  const dealerFiltered = filterHistoryRows(dealerRows, filterArgs)

  const collabRows = [
    ...incoming.filter((c) => isTerminal(c.status)).map((c) => ({ sens: 'Reçue', partner: c.requestingStoreName ?? c.requestingStoreId, c })),
    ...outgoing.filter((c) => isTerminal(c.status)).map((c) => ({ sens: 'Envoyée', partner: c.supplierStoreName ?? c.supplierStoreId, c })),
  ]
    .map(({ sens, partner, c }) => ({
      when: toDate(c.createdAt),
      search: `${sens} ${partner ?? ''} ${collabClient(c)} ${c.network ?? ''} ${COLLAB_OPERATION_TYPE_LABELS[c.operationType] ?? ''} ${c.amount ?? ''}`,
      sens,
      partner,
      data: c,
    }))
    .sort((a, b) => (b.when?.getTime() ?? 0) - (a.when?.getTime() ?? 0))
  const collabFiltered = filterHistoryRows(collabRows, filterArgs)

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-8 border-b-2 border-green-500 pb-2">
          Historique
        </h1>

        <div className="space-y-6">
          {/* Filtres — partagés par les trois onglets */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-end">
              <div className="lg:col-span-1">
                <DateFilter onDateChange={applyDateFilter} onResetToToday={resetToToday} />
              </div>
              <div className="lg:col-span-2">
                <ClientSearch onSearch={applySearchFilter} onSearchChange={handleSearchChange} />
              </div>
            </div>
          </div>

          {/* Sous-onglets */}
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={tab === 'clients'} className={tabButtonClass(tab === 'clients')} onClick={() => setTab('clients')}>
              Transactions clients
              <TabBadge count={filteredTransactions.length} active={tab === 'clients'} testId="histo-tab-clients-badge" label={`${filteredTransactions.length} transactions`} />
            </button>
            <button type="button" aria-pressed={tab === 'dealer'} className={tabButtonClass(tab === 'dealer')} onClick={() => setTab('dealer')}>
              Opérations dealer
              <TabBadge count={dealerFiltered.length} active={tab === 'dealer'} testId="histo-tab-dealer-badge" label={`${dealerFiltered.length} opérations dealer`} />
            </button>
            {IS_MULTI_NETWORK && (
              <button type="button" aria-pressed={tab === 'collab'} className={tabButtonClass(tab === 'collab')} onClick={() => setTab('collab')}>
                Collaborations
                <TabBadge count={collabFiltered.length} active={tab === 'collab'} testId="histo-tab-collab-badge" label={`${collabFiltered.length} collaborations`} />
              </button>
            )}
          </div>

          {/* Onglet Transactions clients — comportement historique inchangé */}
          {tab === 'clients' && (
            <>
              <DailyPagination transactions={allTransactions} onDateSelect={applyDateFilter} />
              <div className="bg-white rounded-lg shadow-md p-6">
                <HistoriqueTable transactions={filteredTransactions} />
                <ActionButtons filteredTransactions={filteredTransactions} resetFilters={resetFilters} />
              </div>
            </>
          )}

          {/* Onglet Opérations dealer */}
          {tab === 'dealer' && (
            <div className={tbl.container}>
              <div className={tbl.scroll}>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className={tbl.headerRow}>
                      <th className={tbl.headerCell}>Date &amp; heure</th>
                      <th className={tbl.headerCell}>Type</th>
                      <th className={tbl.headerCell}>Réseau</th>
                      <th className={tbl.headerCell}>Montant</th>
                      <th className={tbl.headerCell}>Statut</th>
                      <th className={tbl.headerCell}>Remarque</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dealerFiltered.length === 0 ? (
                      <tr><td colSpan="6" className={tbl.empty}>Aucune opération dealer.</td></tr>
                    ) : (
                      dealerFiltered.map(({ data: t }) => (
                        <tr key={t.id}>
                          <td className={`${tbl.cell} whitespace-nowrap text-gray-700`}>{formatDateTime(t.createdAt)}</td>
                          <td className={`${tbl.cell} text-gray-700`}>{STORE_TRANSFER_TYPE_LABELS[t.transferType] ?? t.transferType}</td>
                          <td className={`${tbl.cell} text-gray-700`}>{t.network ?? '—'}</td>
                          <td className={`${tbl.cell} whitespace-nowrap font-semibold text-gray-800`}>{fmtAmount(t.amount)}</td>
                          <td className={`${tbl.cell} whitespace-nowrap`}>
                            <StatusBadge status={t.status} label={DEALER_REQUEST_STATUS_LABELS[t.status] ?? t.status} />
                          </td>
                          <td className={`${tbl.cell} text-gray-700`}>{t.status === 'rejected' ? (t.rejectionReason ?? '—') : '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Onglet Collaborations */}
          {tab === 'collab' && IS_MULTI_NETWORK && (
            <div className={tbl.container}>
              <div className={tbl.scroll}>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className={tbl.headerRow}>
                      <th className={tbl.headerCell}>Date &amp; heure</th>
                      <th className={tbl.headerCell}>Sens</th>
                      <th className={tbl.headerCell}>Partenaire</th>
                      <th className={tbl.headerCell}>Client</th>
                      <th className={tbl.headerCell}>Type</th>
                      <th className={tbl.headerCell}>Réseau</th>
                      <th className={tbl.headerCell}>Montant</th>
                      <th className={tbl.headerCell}>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {collabFiltered.length === 0 ? (
                      <tr><td colSpan="8" className={tbl.empty}>Aucune collaboration.</td></tr>
                    ) : (
                      collabFiltered.map(({ data: c, sens, partner }) => (
                        <tr key={c.id}>
                          <td className={`${tbl.cell} whitespace-nowrap text-gray-700`}>{formatDateTime(c.createdAt)}</td>
                          <td className={`${tbl.cell} text-gray-700`}>{sens}</td>
                          <td className={`${tbl.cell} font-medium text-gray-800`}>{partner ?? '—'}</td>
                          <td className={`${tbl.cell} text-gray-700`}>{collabClient(c)}</td>
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
          )}
        </div>
      </div>
    </div>
  )
}

export default Historique
