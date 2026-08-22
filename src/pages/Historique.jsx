import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { IS_MULTI_NETWORK } from '../constants/navigation'
import DateFilter from '../components/historique/DateFilter'
import ClientSearch from '../components/historique/ClientSearch'
import HistoriqueTable from '../components/historique/HistoriqueTable'
import ActionButtons from '../components/historique/ActionButtons'
import DailyPagination from '../components/historique/DailyPagination'
import { useHistoriqueFilters } from '../hooks/useHistoriqueFilters'
import { useTransactions } from '../context/transactions.jsx'
import { tabButtonClass, TabBadge } from '../components/ui/Tabs.jsx'
import { themedTableClasses } from '../components/ui/themedTable.js'
import StatusBadge from '../components/ui/StatusBadge'
import DirectionBadge from '../components/ui/DirectionBadge'
import { directionFromSens, directionStyles } from '../utils/transactionDirection.js'
import { formatDateTime } from '../utils/formatters'
import { filterHistoryRows } from '../utils/historyFilter.js'
import { subscribeStoreTransfers } from '../services/storeTransferService'
import {
  subscribeIncomingCollaborations,
  subscribeOutgoingCollaborations,
  subscribeMyDebts,
  subscribeMyCredits,
} from '../services/collaborationService'
import {
  STORE_TRANSFER_TYPE_LABELS,
  DEALER_REQUEST_STATUS_LABELS,
  COLLAB_OPERATION_TYPE_LABELS,
  COLLAB_STATUS_LABELS,
  DEBT_STATUS_LABELS,
  COLLABORATIONS_HISTORY_PAGE_SIZE,
} from '../constants/dealerConstants'

// Statuts terminaux d'une collaboration : ceux qui doivent figurer dans l'historique.
const TERMINAL_COLLAB_STATUSES = ['confirmed', 'rejected']

const fmtAmount = (n) => (typeof n === 'number' ? n.toLocaleString('fr-FR') + ' FCFA' : '—')
const toDate = (ts) => (ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null)
// L'Historique ne montre que le TERMINÉ, comme les transactions client (seules les
// complétées y vont). Une opération dealer / collaboration « En attente » reste dans
// son onglet opérationnel (Transactions), pas ici.
const isTerminal = (status) => status === 'confirmed' || status === 'rejected'
const collabClient = (c) => `${c.clientNom ?? ''} ${c.clientPrenom ?? ''}`.trim() || 'Client inconnu'

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
  const { loadMoreHistory, canLoadMore } = useTransactions()

  const [tab, setTab] = useState('clients')
  const [transfers, setTransfers] = useState([])
  const [incoming, setIncoming] = useState([])
  const [outgoing, setOutgoing] = useState([])
  const [debts, setDebts] = useState([])
  const [credits, setCredits] = useState([])
  // Fenêtre de l'historique Collaborations, élargie par « Voir plus ».
  const [collabLimit, setCollabLimit] = useState(COLLABORATIONS_HISTORY_PAGE_SIZE)

  // Les deux abonnements restent montés quel que soit l'onglet : les pastilles de
  // comptage vivent, et basculer d'onglet n'attend pas un rechargement.
  useEffect(() => {
    if (!storeId) { setTransfers([]); return undefined }
    return subscribeStoreTransfers({ storeId, onUpdate: setTransfers, onError: () => setTransfers([]) })
  }, [storeId])

  // Filtre statut CÔTÉ SERVEUR (confirmées/rejetées) + limite : la fenêtre s'applique
  // aux statuts terminaux, plus jamais mangée par les « en attente ». Re-souscription
  // quand « Voir plus » élargit `collabLimit`.
  useEffect(() => {
    if (!storeId || !IS_MULTI_NETWORK) { setIncoming([]); setOutgoing([]); return undefined }
    const opts = { storeId, statuses: TERMINAL_COLLAB_STATUSES, limitCount: collabLimit }
    const u1 = subscribeIncomingCollaborations({ ...opts, onUpdate: setIncoming, onError: () => setIncoming([]) })
    const u2 = subscribeOutgoingCollaborations({ ...opts, onUpdate: setOutgoing, onError: () => setOutgoing([]) })
    return () => { u1(); u2() }
  }, [storeId, collabLimit])

  useEffect(() => {
    if (!storeId || !IS_MULTI_NETWORK) { setDebts([]); setCredits([]); return undefined }
    const u1 = subscribeMyDebts({ storeId, onUpdate: setDebts, onError: () => setDebts([]) })
    const u2 = subscribeMyCredits({ storeId, onUpdate: setCredits, onError: () => setCredits([]) })
    return () => { u1(); u2() }
  }, [storeId])

  // Mémoïsés : ces pipelines (filter+map+sort) ne se recalculent plus à chaque render ni à chaque
  // snapshot d'un AUTRE flux — seulement quand leur source ou les filtres changent. Les pastilles
  // de comptage restent alimentées pour TOUS les onglets (comportement inchangé).
  const filterArgs = useMemo(
    () => ({ from: dateFilter.from, to: dateFilter.to, search: searchTerm, todayOnly: showTodayOnly }),
    [dateFilter.from, dateFilter.to, searchTerm, showTodayOnly]
  )

  const dealerFiltered = useMemo(() => {
    const rows = transfers
      .filter((t) => isTerminal(t.status))
      .map((t) => ({
        when: toDate(t.createdAt),
        search: `${STORE_TRANSFER_TYPE_LABELS[t.transferType] ?? t.transferType ?? ''} ${t.network ?? ''} ${t.amount ?? ''}`,
        data: t,
      }))
    return filterHistoryRows(rows, filterArgs)
  }, [transfers, filterArgs])

  const collabFiltered = useMemo(() => {
    const rows = [
      ...incoming.filter((c) => isTerminal(c.status)).map((c) => ({ sens: 'Reçue', partner: c.requestingStoreName || 'Boutique inconnue', c })),
      ...outgoing.filter((c) => isTerminal(c.status)).map((c) => ({ sens: 'Envoyée', partner: c.supplierStoreName || 'Boutique inconnue', c })),
    ]
      .map(({ sens, partner, c }) => ({
        when: toDate(c.createdAt),
        search: `${sens} ${partner ?? ''} ${collabClient(c)} ${c.network ?? ''} ${COLLAB_OPERATION_TYPE_LABELS[c.operationType] ?? ''} ${c.amount ?? ''}`,
        sens,
        partner,
        data: c,
      }))
      .sort((a, b) => (b.when?.getTime() ?? 0) - (a.when?.getTime() ?? 0))
    return filterHistoryRows(rows, filterArgs)
  }, [incoming, outgoing, filterArgs])

  // Une fenêtre est pleine d'un côté → il peut rester des collaborations plus anciennes.
  const collabCanLoadMore = incoming.length >= collabLimit || outgoing.length >= collabLimit
  const loadMoreCollabs = () => setCollabLimit((l) => l + COLLABORATIONS_HISTORY_PAGE_SIZE)

  // Dettes internes : seules les RÉGLÉES vont à l'historique (même principe que le reste).
  // Un même document est une « Dette » (je suis débitrice) ou une « Créance » (je suis créancière).
  const internalDebtFiltered = useMemo(() => {
    const rows = [
      ...debts.filter((d) => d.status === 'settled').map((d) => ({ sens: 'Dette', partner: d.creditorStoreName || 'Boutique inconnue', d })),
      ...credits.filter((d) => d.status === 'settled').map((d) => ({ sens: 'Créance', partner: d.debtorStoreName || 'Boutique inconnue', d })),
    ]
      .map(({ sens, partner, d }) => ({
        when: toDate(d.updatedAt ?? d.createdAt),
        search: `${sens} ${partner ?? ''} ${d.network ?? ''} ${COLLAB_OPERATION_TYPE_LABELS[d.operationType] ?? ''} ${d.originalAmount ?? ''}`,
        sens,
        partner,
        data: d,
      }))
      .sort((a, b) => (b.when?.getTime() ?? 0) - (a.when?.getTime() ?? 0))
    return filterHistoryRows(rows, filterArgs)
  }, [debts, credits, filterArgs])

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
            {IS_MULTI_NETWORK && (
              <button type="button" aria-pressed={tab === 'internaldebts'} className={tabButtonClass(tab === 'internaldebts')} onClick={() => setTab('internaldebts')}>
                Dettes internes
                <TabBadge count={internalDebtFiltered.length} active={tab === 'internaldebts'} testId="histo-tab-internaldebts-badge" label={`${internalDebtFiltered.length} dettes internes réglées`} />
              </button>
            )}
          </div>

          {/* Onglet Transactions clients — comportement historique inchangé */}
          {tab === 'clients' && (
            <>
              <DailyPagination transactions={allTransactions} onDateSelect={applyDateFilter} />
              <div className="bg-white rounded-lg shadow-md p-6">
                <HistoriqueTable transactions={filteredTransactions} />
                {canLoadMore && (
                  <div className="mt-4 flex justify-center">
                    <button
                      type="button"
                      onClick={loadMoreHistory}
                      data-testid="btn-load-more-history"
                      className="rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      Voir plus
                    </button>
                  </div>
                )}
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
                      collabFiltered.map(({ data: c, sens, partner }) => {
                        const dir = directionFromSens(sens)
                        const ds = directionStyles(dir)
                        return (
                        <tr key={c.id} className={ds.rowBg}>
                          <td className={`${tbl.cell} ${ds.accent} whitespace-nowrap text-gray-700`}>{formatDateTime(c.createdAt)}</td>
                          <td className={`${tbl.cell}`}><DirectionBadge direction={dir} label={sens} /></td>
                          <td className={`${tbl.cell} font-medium text-gray-800`}>{partner ?? '—'}</td>
                          <td className={`${tbl.cell} text-gray-700`}>{collabClient(c)}</td>
                          <td className={`${tbl.cell} text-gray-700`}>{COLLAB_OPERATION_TYPE_LABELS[c.operationType] ?? c.operationType}</td>
                          <td className={`${tbl.cell} text-gray-700`}>{c.network}</td>
                          <td className={`${tbl.cell} whitespace-nowrap font-semibold text-gray-800`}>{fmtAmount(c.amount)}</td>
                          <td className={`${tbl.cell} whitespace-nowrap`}>
                            <StatusBadge status={c.status} label={COLLAB_STATUS_LABELS[c.status] ?? c.status} />
                          </td>
                        </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {collabCanLoadMore && (
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={loadMoreCollabs}
                    data-testid="btn-load-more-collab"
                    className="rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    Voir plus
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Onglet Dettes internes (réglées) */}
          {tab === 'internaldebts' && IS_MULTI_NETWORK && (
            <div className={tbl.container}>
              <div className={tbl.scroll}>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className={tbl.headerRow}>
                      <th className={tbl.headerCell}>Date &amp; heure</th>
                      <th className={tbl.headerCell}>Sens</th>
                      <th className={tbl.headerCell}>Partenaire</th>
                      <th className={tbl.headerCell}>Type</th>
                      <th className={tbl.headerCell}>Réseau</th>
                      <th className={tbl.headerCell}>Montant</th>
                      <th className={tbl.headerCell}>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {internalDebtFiltered.length === 0 ? (
                      <tr><td colSpan="7" className={tbl.empty}>Aucune dette réglée.</td></tr>
                    ) : (
                      internalDebtFiltered.map(({ data: d, sens, partner }) => {
                        const dir = directionFromSens(sens)
                        const ds = directionStyles(dir)
                        return (
                        <tr key={d.id} className={ds.rowBg}>
                          <td className={`${tbl.cell} ${ds.accent} whitespace-nowrap text-gray-700`}>{formatDateTime(d.updatedAt ?? d.createdAt)}</td>
                          <td className={`${tbl.cell}`}><DirectionBadge direction={dir} label={sens} /></td>
                          <td className={`${tbl.cell} font-medium text-gray-800`}>{partner ?? '—'}</td>
                          <td className={`${tbl.cell} text-gray-700`}>{COLLAB_OPERATION_TYPE_LABELS[d.operationType] ?? d.operationType}</td>
                          <td className={`${tbl.cell} text-gray-700`}>{d.network}</td>
                          <td className={`${tbl.cell} whitespace-nowrap font-semibold text-gray-800`}>{fmtAmount(d.originalAmount)}</td>
                          <td className={`${tbl.cell} whitespace-nowrap`}>
                            <StatusBadge status={d.status} label={DEBT_STATUS_LABELS[d.status] ?? d.status} />
                          </td>
                        </tr>
                        )
                      })
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
