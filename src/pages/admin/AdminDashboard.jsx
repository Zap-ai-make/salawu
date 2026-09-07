import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getAdminDashboardCounts,
  getDealerRequestCounts,
  getUserCountsByRole,
  getRecentDealerRequests,
} from '../../services/adminService'
import { formatCurrency } from '../../utils/formatCurrency'
import { formatDateTime as formatDate } from '../../utils/formatters'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonCards } from '../../components/ui/SkeletonList'
import { APP_NAME } from '../../constants/branding'
import { IS_REGISTRE } from '../../constants/designSystem.js'
import {
  Store, CheckCircle2, AlertTriangle, User, Users, ClipboardList,
  BarChart3, Inbox, ChevronRight,
} from 'lucide-react'

const STATUS_LABELS = { pending: 'En attente', confirmed: 'Confirmée', rejected: 'Rejetée' }
const TYPE_LABELS   = { stock_add: 'Ajout stock', liquidity_add: 'Ajout liquidité' }

const STATUS_STYLES = {
  pending:   'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  confirmed: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  rejected:  'bg-red-50 text-red-600 ring-1 ring-red-200',
}

const TYPE_DOT = {
  stock_add:     'bg-blue-500',
  liquidity_add: 'bg-purple-500',
}

// ──────────────────────────────────────────────────────────────────────────────
// KPI Card
// ──────────────────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, accent }) {
  const Icon = icon
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 px-5 py-4`}>
      <div className={`absolute top-0 left-0 h-1 w-full ${accent}`} />
      <div className="flex items-center justify-between gap-3 mt-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-encre-doux">{label}</p>
        <Icon className="h-5 w-5 shrink-0 text-encre-doux" aria-hidden="true" />
      </div>
      <p className="mt-2 text-3xl font-black text-gray-900 tracking-tight">{value ?? '—'}</p>
      {sub && <p className="mt-1 text-xs text-encre-doux">{sub}</p>}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Quick Action Card
// ──────────────────────────────────────────────────────────────────────────────

function ActionCard({ icon, label, desc, onClick, accent }) {
  const Icon = icon
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-4 rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 px-5 py-4 text-left hover:shadow-md hover:ring-gray-200 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 w-full"
    >
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-gray-800 text-sm">{label}</p>
        <p className="text-xs text-encre-doux mt-0.5 truncate">{desc}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-encre-doux group-hover:text-gray-600 transition-colors shrink-0" aria-hidden="true" />
    </button>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Recent Requests Feed
// ──────────────────────────────────────────────────────────────────────────────

function RequestFeed({ requests, loading, error }) {
  if (error) return <ErrorState message={error} />

  if (loading) return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map(n => (
        <div key={n} className="flex items-center gap-4 animate-pulse">
          <div className="h-8 w-8 rounded-full bg-gray-100 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-1/3 rounded bg-gray-100" />
            <div className="h-2.5 w-1/2 rounded bg-gray-100" />
          </div>
          <div className="h-6 w-20 rounded-full bg-gray-100" />
          <div className="h-2.5 w-24 rounded bg-gray-100" />
        </div>
      ))}
    </div>
  )

  if (!requests?.length) return (
    <div className="flex flex-col items-center justify-center py-12 text-encre-doux">
      <Inbox className="mb-3 h-10 w-10" aria-hidden="true" />
      <p className="text-sm font-medium">Aucune demande récente</p>
    </div>
  )

  return (
    <div className="divide-y divide-gray-50">
      {requests.map(r => (
        <div key={r.id} className="flex items-center gap-4 py-3.5 hover:bg-gray-50/60 px-1 rounded-lg transition-colors">
          {/* dot type */}
          <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${TYPE_DOT[r.requestType] ?? 'bg-gray-400'}`} />

          {/* info */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-800 truncate">{r.targetStoreName}</p>
            <p className="text-xs text-encre-doux truncate">
              {r.dealerName} · {TYPE_LABELS[r.requestType] ?? r.requestType}
            </p>
          </div>

          {/* amount */}
          <p className="text-sm font-bold text-gray-900 shrink-0">{formatCurrency(r.amount)}</p>

          {/* status */}
          <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {STATUS_LABELS[r.status] ?? r.status}
          </span>

          {/* date */}
          <p className="hidden sm:block text-xs text-encre-doux shrink-0 w-28 text-right">{formatDate(r.createdAt)}</p>
        </div>
      ))}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// AdminDashboard
// ──────────────────────────────────────────────────────────────────────────────

function AdminDashboard() {
  const navigate = useNavigate()

  const [counts, setCounts]         = useState(null)
  const [reqCounts, setReqCounts]   = useState(null)
  const [roleCounts, setRoleCounts] = useState(null)
  const [recentReqs, setRecentReqs] = useState([])

  const [kpiLoading, setKpiLoading]   = useState(true)
  const [kpiError, setKpiError]       = useState(null)
  const [reqsLoading, setReqsLoading] = useState(true)
  const [reqsError, setReqsError]     = useState(null)

  const loadKpi = useCallback(async () => {
    setKpiLoading(true)
    setKpiError(null)
    try {
      const [c, rc, rolec] = await Promise.all([
        getAdminDashboardCounts(),
        getDealerRequestCounts(),
        getUserCountsByRole(),
      ])
      setCounts(c)
      setReqCounts(rc)
      setRoleCounts(rolec)
    } catch (err) {
      setKpiError(err.message)
    } finally {
      setKpiLoading(false)
    }
  }, [])

  const loadRecentReqs = useCallback(async () => {
    setReqsLoading(true)
    setReqsError(null)
    try {
      const reqs = await getRecentDealerRequests(8)
      setRecentReqs(reqs)
    } catch (err) {
      setReqsError(err.message)
    } finally {
      setReqsLoading(false)
    }
  }, [])

  const refresh = useCallback(() => { loadKpi(); loadRecentReqs() }, [loadKpi, loadRecentReqs])

  useEffect(() => { loadKpi(); loadRecentReqs() }, [loadKpi, loadRecentReqs])

  // ── M5 : quatre tuiles pour « registre », six pour « legacy » ──────────────
  //
  // La reduction de six tuiles a quatre est une decision EDITORIALE, pas une
  // correction d'accessibilite. Elle ne vaut donc que pour le client qui a
  // commande la refonte : TAOFIC conserve ses six tuiles, dans leur ordre
  // d'origine. C'est la frontiere que ce chantier s'impose — une correction
  // (contraste, emoji, focus) vaut pour le produit entier ; un parti pris de
  // mise en page vaut pour un client, et passe donc par `profil.design`.
  //
  // ⚠ Les emoji ne reviennent PAS avec les six tuiles : leur retrait est un
  // non-negociable de DESIGN.md §8, donc une correction, donc product-wide.
  //
  // Ce que « registre » change, et pourquoi :
  //  1. « Boutiques totales / actives / inactives » etaient TROIS tuiles pour
  //     deux faits — le total est la somme des deux autres. La grandeur
  //     d'exploitation est « combien fonctionnent » ; le total et les inactives
  //     sont son contexte, pas son egal. Ils passent en ligne secondaire.
  //     AUCUN chiffre n'est retire : ils changent de rang.
  //  2. « Demandes en attente » passe EN TETE : seule tuile qui appelle une
  //     action, les autres decrivent un etat. Principe `dashboard-builder`
  //     d'ECC — repondre a « qu'est-ce qui coince », pas « montre tout ».
  const tuilesKpi = useMemo(() => {
    const demandes = {
      cle: 'demandes',
      label: 'Demandes en attente',
      value: counts?.pendingRequests,
      sub: `${reqCounts?.confirmed ?? 0} confirmées · ${reqCounts?.rejected ?? 0} rejetées`,
      icon: ClipboardList,
      accent: 'bg-amber-500',
    }
    const utilisateurs = {
      cle: 'utilisateurs',
      label: 'Utilisateurs',
      value: counts?.totalUsers,
      sub: `${roleCounts?.dealer ?? 0} dealer · ${roleCounts?.store_admin ?? 0} admin`,
      icon: User,
      accent: 'bg-indigo-500',
    }
    const clients = {
      cle: 'clients',
      label: 'Agents / Clients',
      value: counts?.totalClients,
      icon: Users,
      accent: 'bg-teal-500',
    }

    if (IS_REGISTRE) {
      return [
        demandes,
        {
          cle: 'boutiques',
          label: 'Boutiques actives',
          value: counts?.activeStores,
          sub: `${counts?.inactiveStores ?? 0} inactives · ${counts?.totalStores ?? 0} au total`,
          icon: Store,
          accent: 'bg-emerald-500',
        },
        utilisateurs,
        clients,
      ]
    }

    return [
      { cle: 'total', label: 'Boutiques totales', value: counts?.totalStores, icon: Store, accent: 'bg-blue-500' },
      { cle: 'actives', label: 'Boutiques actives', value: counts?.activeStores, icon: CheckCircle2, accent: 'bg-emerald-500' },
      { cle: 'inactives', label: 'Boutiques inactives', value: counts?.inactiveStores, icon: AlertTriangle, accent: 'bg-red-500' },
      utilisateurs,
      clients,
      demandes,
    ]
  }, [counts, reqCounts, roleCounts])

  return (
    <div data-testid="admin-home" className="min-h-screen bg-gray-50/60">

      {/* ── Hero header ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-6 py-6 mb-6">
        <div className="flex items-start justify-between gap-4 max-w-7xl mx-auto">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Vue générale</h1>
            <p className="mt-0.5 text-sm text-gray-500">Tableau de bord global de la plateforme {APP_NAME}</p>
          </div>
          <button
            type="button"
            onClick={refresh}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 hover:border-gray-300 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
          >
            <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualiser
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 space-y-8 pb-10">

        {/* ── KPI ─────────────────────────────────────────────────────────── */}
        <section aria-labelledby="kpi-heading">
          <h2 id="kpi-heading" className="mb-4 text-xs font-bold uppercase tracking-widest text-encre-doux">
            Indicateurs clés
          </h2>

          {kpiError ? (
            <ErrorState message={kpiError} onRetry={loadKpi} />
          ) : kpiLoading ? (
            <SkeletonCards count={tuilesKpi.length} />
          ) : (
            // La grille suit le nombre de tuiles : un squelette a 4 cases devant
            // une grille a 6 colonnes annoncerait une mise en page que le rendu
            // ne tient pas.
            <div
              className={
                IS_REGISTRE
                  ? 'grid grid-cols-2 xl:grid-cols-4 gap-4'
                  : 'grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4'
              }
            >
              {tuilesKpi.map((t) => (
                <KpiCard
                  key={t.cle}
                  label={t.label}
                  value={t.value}
                  sub={t.sub}
                  icon={t.icon}
                  accent={t.accent}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Quick actions ───────────────────────────────────────────────── */}
        <section aria-labelledby="actions-heading">
          <h2 id="actions-heading" className="mb-4 text-xs font-bold uppercase tracking-widest text-encre-doux">
            Accès rapides
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <ActionCard
              icon={Store}
              label="Boutiques"
              desc="Gérer et surveiller les boutiques"
              onClick={() => navigate('/admin/stores')}
              accent="bg-blue-50"
            />
            <ActionCard
              icon={Users}
              label="Utilisateurs"
              desc="Consulter les comptes et rôles"
              onClick={() => navigate('/admin/users')}
              accent="bg-indigo-50"
            />
            <ActionCard
              icon={BarChart3}
              label="Supervision Dealer"
              desc="Suivre les demandes en temps réel"
              onClick={() => navigate('/admin/dealer')}
              accent="bg-emerald-50"
            />
          </div>
        </section>

        {/* ── Recent requests ─────────────────────────────────────────────── */}
        <section aria-labelledby="recent-heading">
          <div className="flex items-center justify-between mb-4">
            <h2 id="recent-heading" className="text-xs font-bold uppercase tracking-widest text-encre-doux">
              Dernières demandes Dealer
            </h2>
            <button
              type="button"
              onClick={() => navigate('/admin/dealer')}
              className="flex items-center gap-1 text-xs font-semibold text-green-600 hover:text-green-800 transition-colors focus:outline-none focus-visible:underline"
            >
              Voir tout
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 px-5 py-2">
            <RequestFeed requests={recentReqs} loading={reqsLoading} error={reqsError} />
          </div>
        </section>

      </div>
    </div>
  )
}

export default AdminDashboard
