import { useState, useEffect, useMemo } from 'react'
import ConventionDeSigne from '../components/ui/ConventionDeSigne.jsx'
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
import { exporterHistoriqueXLSX } from '../utils/exportHistorique.js'
import { HISTORY_PAGE_SIZE } from '../utils/constants.js'
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
import { classesDuRang } from '../components/ui/rangs.js'
import { useToast } from '../hooks/useToast'
import Toast from '../components/Toast'
import { MESSAGES } from '../utils/constants'
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
  const { toasts, showToast, removeToast } = useToast()

  const exporter = async () => {
    const r = await exporterHistoriqueXLSX(filteredTransactions)
    if (r.vide) showToast(MESSAGES.ERRORS.NO_EXPORT_DATA, 'warning')
    else if (r.success) showToast(`Export réussi : ${r.count} opération${r.count > 1 ? 's' : ''}.`, 'success')
    else showToast(`Erreur lors de l'export : ${r.error ?? 'inconnue'}`, 'error')
  }

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
    <div data-chassis className="min-h-screen bg-gray-100">
      <div data-chassis data-ecran className="max-w-7xl mx-auto px-4 py-6">
        <div data-ecran-tete className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <h1 data-titre-ecran className="text-3xl font-bold text-gray-800">
              Historique
            </h1>
            {/* « fenetre en direct » n'est pas une formule : l'historique de
                salawu est borne (history.pageSize), et « Voir plus » elargit la
                fenetre. Dire « N operations chargees » et non « N operations »
                evite de laisser croire que c'est tout ce qui existe. */}
            <p data-ecran-compte>
              {allTransactions.length} opération{allTransactions.length > 1 ? 's' : ''} chargée{allTransactions.length > 1 ? 's' : ''}
              {' · fenêtre en direct'}
            </p>
          </div>

          <div data-ecran-actions className="flex flex-wrap gap-2">
            {/* ⚠ LE RESULTAT EST LU, ET PLUS JETE. `exporterHistoriqueXLSX`
                rend `{ success: false, vide: true }` sur une selection vide —
                son en-tete le dit : « Elle rend un resultat plutot que
                d'afficher : c'est a l'appelant de dire ce qu'il en fait ».
                Son unique appelant n'en faisait rien : filtrer sur un jour sans
                operation puis cliquer « Exporter » ne produisait NI fichier NI
                message. Le bouton semblait casse. */}
            <button
              type="button"
              onClick={exporter}
              data-rang="second"
              className={`inline-flex items-center gap-2 ${classesDuRang('second')}`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M4 19h16" />
              </svg>
              Exporter en Excel
            </button>
          </div>
        </div>

        <div data-ecran className="space-y-4">
          {/* Sous-onglets — AVANT les filtres, comme la maquette : on choisit
              d'abord CE QU'ON REGARDE, puis on restreint. */}
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

          {/* Filtres — partagés par les trois onglets */}
          {/* ⚠ UNE SEULE RANGEE, ET LA GRILLE QUI L'EMPECHAIT EST PARTIE.
              Les dates et la recherche vivaient dans deux colonnes d'une grille
              `lg:grid-cols-3` : elles ne pouvaient PAS se retrouver sur la meme
              ligne, quoi qu'on fasse a l'interieur de chacune. Le libelle
              « Rechercher » se retrouvait seul sur sa ligne, et son champ
              dessous.

              Les deux composants gardent leur existence et leur logique ; leur
              conteneur passe en `display: contents` (voir src/index.css), ce qui
              fait de LEURS enfants des elements directs de cette rangee. Aucun
              des deux n'a eu besoin d'etre demonte. */}
          <div
            data-surface
            data-filtres
            data-cadre
            className="bg-white rounded-lg shadow-md p-6 flex flex-wrap items-end gap-3"
          >
            <DateFilter onDateChange={applyDateFilter} onResetToToday={resetToToday} />
            <ClientSearch onSearch={applySearchFilter} onSearchChange={handleSearchChange} />
          </div>

          {/* La convention de signe vient APRES les filtres : elle explique le
              signe des montants du tableau, pas le choix de l'onglet ni la
              periode. */}
          <ConventionDeSigne />

          {/* Onglet Transactions clients — comportement historique inchangé */}
          {tab === 'clients' && (
            <>
              <DailyPagination transactions={allTransactions} onDateSelect={applyDateFilter} />
              <div data-surface className="bg-white rounded-lg shadow-md p-6">
                <HistoriqueTable transactions={filteredTransactions} />
                {canLoadMore && (
                  <div className="mt-4 flex justify-center">
                    <button
                      type="button"
                      onClick={loadMoreHistory}
                      data-testid="btn-load-more-history"
                      className="rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      Voir {HISTORY_PAGE_SIZE ? `${HISTORY_PAGE_SIZE} de plus` : 'plus'}
                    </button>
                  </div>
                )}
                <ActionButtons resetFilters={resetFilters} />
              </div>
            </>
          )}

          {/* Onglet Opérations dealer */}
          {tab === 'dealer' && (
            <div className={tbl.container}>
              <div {...tbl.zoneDefilante("Opérations dealer, défilement horizontal")}>
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
              <div {...tbl.zoneDefilante("Collaborations, défilement horizontal")}>
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
              <div {...tbl.zoneDefilante("Dettes internes réglées, défilement horizontal")}>
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

      {/* Le resultat de l'export. Un export qui ne produit rien DOIT le dire :
          sans cela, un filtre sans resultat rend le bouton muet, ce qui se lit
          comme une panne. */}
      <div className="fixed top-0 right-0 z-[9999] space-y-2 p-4">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </div>
  )
}

export default Historique
