import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useTheme } from '../../context/ThemeContext.jsx'
import PageHeader from '../../components/ui/PageHeader'
import StatCard from '../../components/ui/StatCard'
import StatusBadge from '../../components/ui/StatusBadge'
import { themedTableClasses } from '../../components/ui/themedTable.js'
import { formatDateTime } from '../../utils/formatters'
import { PAYMENT_METHODS } from '../../utils/constants.js'
import {
  subscribeMyDebts,
  subscribeMyCredits,
  subscribeDebtSettlements,
  declareInternalDebtSettlement,
  confirmInternalDebtSettlement,
  rejectInternalDebtSettlement,
  declareInternalDebtCompensation,
  confirmInternalDebtCompensation,
  rejectInternalDebtCompensation,
  generateIdempotencyKey,
} from '../../services/collaborationService'
import {
  COLLAB_OPERATION_TYPE_LABELS,
  DEBT_STATUS_LABELS,
  DEBT_SETTLEMENT_METHOD_LABELS,
  DEBT_SETTLEMENT_STATUS_LABELS,
} from '../../constants/dealerConstants'

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('fr-FR') + ' FCFA' : '—')
const opLabel = (t) => COLLAB_OPERATION_TYPE_LABELS[t] ?? t
const num = (v) => Number(v) || 0
const notSettled = (d) => d.status !== 'settled' && num(d.remainingAmount) > 0
// Millisecondes d'un createdAt (Timestamp Firestore, Date, ISO ou {seconds}).
const tsMillis = (ts) => {
  if (!ts) return 0
  if (typeof ts.toMillis === 'function') return ts.toMillis()
  if (typeof ts.seconds === 'number') return ts.seconds * 1000
  const d = new Date(ts)
  return Number.isNaN(d.getTime()) ? 0 : d.getTime()
}
// Un remboursement de dette emprunte les mêmes canaux qu'une transaction client
// (Mobile Money par réseau) + la banque. Les anciens codes (especes, transfert…)
// des tranches historiques restent lisibles via DEBT_SETTLEMENT_METHOD_LABELS.
const METHODS = [...PAYMENT_METHODS, 'Banque']

// Statut de dette → couleurs du badge partagé. Les statuts de dette (open /
// partially_settled / settled) ne figurent pas dans les presets de StatusBadge :
// on passe la couleur explicitement plutôt que de retomber sur le gris par défaut.
const DEBT_STATUS_COLOR = {
  open: 'bg-amber-100 text-amber-800',
  partially_settled: 'bg-blue-100 text-blue-800',
  settled: 'bg-green-100 text-green-800',
}

// Teinte d'une tranche selon son statut (déclarée = en attente ; confirmée/rejetée = lecture seule).
const TRANCHE_BG = { declared: 'bg-amber-50', confirmed: 'bg-green-50', rejected: 'bg-gray-50' }
const isSettled = (d) => d.status === 'settled'

/** Cellule « Montant » : reste dû en avant, original rappelé s'il diffère. */
function AmountCell({ debt, tbl }) {
  const remaining = Number(debt.remainingAmount) || 0
  const original = Number(debt.originalAmount) || 0
  return (
    <td className={`${tbl.cell} whitespace-nowrap`}>
      <span className="font-semibold text-gray-800">{fmt(remaining)}</span>
      {remaining !== original && (
        <span className="ml-1 text-xs text-gray-400">/ {fmt(original)}</span>
      )}
    </td>
  )
}

// ── Ligne dette (côté débitrice) : rembourser OU compenser ───────────────────
// `credits` = mes créances (elles pour la compensation) ; la créance opposée du
// même partenaire (tous réseaux) permet de solder les deux dettes d'un clic.
function DebtRow({ debt, credits, tbl }) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState(METHODS[0])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState(null)

  // Créance opposée la plus ancienne du même partenaire (débitrice = ma créancière).
  const target = useMemo(() => {
    return credits
      .filter((c) => c.debtorStoreId === debt.creditorStoreId && notSettled(c))
      .sort((a, b) => tsMillis(a.createdAt) - tsMillis(b.createdAt))[0] ?? null
  }, [credits, debt.creditorStoreId])
  const compensable = target ? Math.min(num(debt.remainingAmount), num(target.remainingAmount)) : 0

  const rembourser = async () => {
    setBusy(true); setErr(null); setMsg(null)
    try {
      await declareInternalDebtSettlement({ debtId: debt.id, amount, method, idempotencyKey: generateIdempotencyKey() })
      setMsg('Remboursement déclaré. En attente de confirmation.')
      setAmount('')
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  const compenser = async () => {
    // La créance opposée peut avoir été soldée entre l'affichage et le clic (temps réel).
    if (!target) { setErr('La créance opposée n\'est plus disponible.'); return }
    setBusy(true); setErr(null); setMsg(null)
    try {
      await declareInternalDebtCompensation({ debtId: debt.id, oppositeDebtId: target.id, amount: compensable, idempotencyKey: generateIdempotencyKey() })
      setMsg('Compensation proposée. En attente de confirmation par la boutique créancière.')
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <tr>
      <td className={`${tbl.cell} whitespace-nowrap text-gray-700`}>{formatDateTime(debt.createdAt)}</td>
      <td className={`${tbl.cell} font-medium text-gray-800`}>{debt.creditorStoreName ?? debt.creditorStoreId}</td>
      <td className={`${tbl.cell} text-gray-700`}>{opLabel(debt.operationType)}</td>
      <td className={`${tbl.cell} text-gray-700`}>{debt.network}</td>
      <AmountCell debt={debt} tbl={tbl} />
      <td className={`${tbl.cell} whitespace-nowrap`}>
        <StatusBadge status={debt.status} label={DEBT_STATUS_LABELS[debt.status] ?? debt.status} color={DEBT_STATUS_COLOR[debt.status]} />
      </td>
      <td className={tbl.cell}>
        {debt.status === 'settled' ? (
          <span className="text-xs text-gray-400">—</span>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {compensable > 0 && (
              <button type="button" disabled={busy} onClick={compenser}
                className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                title="Solder avec la créance opposée de cette boutique">
                Compenser {fmt(compensable)}
              </button>
            )}
            <input type="text" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="Montant" className="w-28 rounded border border-gray-300 px-2 py-1 text-sm" aria-label="Montant règlement" />
            <select value={method} onChange={e => setMethod(e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-sm" aria-label="Méthode">
              {METHODS.map(m => <option key={m} value={m}>{DEBT_SETTLEMENT_METHOD_LABELS[m] ?? m}</option>)}
            </select>
            <button type="button" disabled={busy} onClick={rembourser}
              className="rounded-lg bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50">Rembourser</button>
            {msg && <p className="w-full text-xs text-green-700">{msg}</p>}
            {err && <p className="w-full text-xs text-red-600">{err}</p>}
          </div>
        )}
      </td>
    </tr>
  )
}

// ── Ligne créance (côté créancière) : confirmer/rejeter les tranches ─────────
function CreditRow({ debt, tbl }) {
  const [settlements, setSettlements] = useState([])
  const [busy, setBusy] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    const u = subscribeDebtSettlements({ debtId: debt.id, onUpdate: setSettlements, onError: (e) => setErr(e.message) })
    return () => u()
  }, [debt.id])

  // Historique COMPLET des tranches (déclarées, confirmées, rejetées), plus récentes
  // d'abord. Une dette réglée n'est plus actionnable : on montre la trace, sans bouton.
  const sorted = [...settlements].sort((a, b) => tsMillis(b.declaredAt) - tsMillis(a.declaredAt))
  const canAct = !isSettled(debt)

  const act = async (fn, settlementId) => {
    setBusy(settlementId); setErr(null)
    try { await fn() } catch (e) { setErr(e.message) } finally { setBusy(null) }
  }

  // Une compensation confirme/rejette LES DEUX dettes → callables dédiés.
  const confirmTranche = (s) => s.method === 'compensation'
    ? confirmInternalDebtCompensation({ debtId: debt.id, settlementId: s.id })
    : confirmInternalDebtSettlement({ debtId: debt.id, settlementId: s.id })
  const rejectTranche = (s) => s.method === 'compensation'
    ? rejectInternalDebtCompensation({ debtId: debt.id, settlementId: s.id, rejectionReason: 'Refusée' })
    : rejectInternalDebtSettlement({ debtId: debt.id, settlementId: s.id, rejectionReason: 'Non reçu' })

  return (
    <tr>
      <td className={`${tbl.cell} whitespace-nowrap text-gray-700`}>{formatDateTime(debt.createdAt)}</td>
      <td className={`${tbl.cell} font-medium text-gray-800`}>{debt.debtorStoreName ?? debt.debtorStoreId}</td>
      <td className={`${tbl.cell} text-gray-700`}>{opLabel(debt.operationType)}</td>
      <td className={`${tbl.cell} text-gray-700`}>{debt.network}</td>
      <AmountCell debt={debt} tbl={tbl} />
      <td className={`${tbl.cell} whitespace-nowrap`}>
        <StatusBadge status={debt.status} label={DEBT_STATUS_LABELS[debt.status] ?? debt.status} color={DEBT_STATUS_COLOR[debt.status]} />
      </td>
      <td className={tbl.cell}>
        {sorted.length === 0 ? (
          <span className="text-xs text-gray-400">—</span>
        ) : (
          <div className="space-y-1">
            {sorted.map(s => {
              const actionable = canAct && s.settlementStatus === 'declared'
              return (
                <div key={s.id} className={`flex flex-wrap items-center justify-between gap-2 rounded px-2 py-1 text-xs ${TRANCHE_BG[s.settlementStatus] ?? 'bg-gray-50'}`}>
                  <span>{fmt(s.amount)} · {DEBT_SETTLEMENT_METHOD_LABELS[s.method] ?? s.method} · {DEBT_SETTLEMENT_STATUS_LABELS[s.settlementStatus] ?? s.settlementStatus}</span>
                  {actionable && (
                    <span className="flex gap-1">
                      <button type="button" disabled={busy === s.id} onClick={() => act(() => confirmTranche(s), s.id)}
                        className="rounded bg-green-600 px-2 py-0.5 text-white hover:bg-green-700 disabled:opacity-50">Confirmer</button>
                      <button type="button" disabled={busy === s.id} onClick={() => act(() => rejectTranche(s), s.id)}
                        className="rounded border border-red-200 px-2 py-0.5 text-red-600 hover:bg-red-50 disabled:opacity-50">Rejeter</button>
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
      </td>
    </tr>
  )
}

/** Carte-total qui sert aussi de sélecteur de vue (ce que je dois / ce qu'on me doit).
 *  Le total et le compte ne concernent que les lignes EN COURS (les réglées sont dans
 *  l'Historique). */
function TotalCard({ label, total, count, color, active, onClick, testId }) {
  const sub = `${count} ${count > 1 ? 'lignes' : 'ligne'}`
  return (
    <button type="button" onClick={onClick} aria-pressed={active} data-testid={testId}
      className={`block w-full rounded-2xl text-left transition ${active ? 'ring-2 ring-offset-1 ring-blue-500' : 'ring-1 ring-transparent hover:ring-gray-200'}`}>
      <StatCard label={label} value={fmt(total)} sub={sub} color={color} />
    </button>
  )
}

function StoreInternalDebts() {
  const { userProfile } = useAuth()
  const { themeClasses } = useTheme()
  const tbl = themedTableClasses(themeClasses)
  const storeId = userProfile?.storeId ?? null
  const [tab, setTab] = useState('debts')
  const [debts, setDebts] = useState([])
  const [credits, setCredits] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!storeId) return undefined
    const u1 = subscribeMyDebts({ storeId, onUpdate: setDebts, onError: (e) => setError(e.message) })
    const u2 = subscribeMyCredits({ storeId, onUpdate: setCredits, onError: (e) => setError(e.message) })
    return () => { u1(); u2() }
  }, [storeId])

  // Cet espace ne montre QUE l'en-cours : une dette réglée vaut 0, n'est plus actionnable,
  // et se consulte dans l'Historique → onglet « Dettes internes ». On ne mélange jamais
  // l'en-cours et le déjà géré.
  const activeDebts = debts.filter((d) => !isSettled(d))
  const activeCredits = credits.filter((c) => !isSettled(c))

  const totalDebts = activeDebts.reduce((s, d) => s + num(d.remainingAmount), 0)
  const totalCredits = activeCredits.reduce((s, d) => s + num(d.remainingAmount), 0)

  const isDebts = tab === 'debts'
  const rows = isDebts ? activeDebts : activeCredits
  const emptyMsg = isDebts ? 'Aucune dette en cours.' : 'Aucune créance en cours.'

  // Solde NET par partenaire : ce que je dois − ce qu'on me doit, toutes dettes et
  // tous réseaux confondus avec la même boutique → le bilan de fin de journée.
  const partners = useMemo(() => {
    const map = new Map()
    const touch = (id, name) => {
      const cur = map.get(id) ?? { id, name: name ?? id, debt: 0, credit: 0 }
      if (name) cur.name = name
      map.set(id, cur)
      return cur
    }
    debts.forEach((d) => { touch(d.creditorStoreId, d.creditorStoreName).debt += num(d.remainingAmount) })
    credits.forEach((c) => { touch(c.debtorStoreId, c.debtorStoreName).credit += num(c.remainingAmount) })
    return [...map.values()].filter((p) => p.debt > 0 || p.credit > 0)
  }, [debts, credits])

  return (
    <div>
      <PageHeader title="Dettes internes" subtitle="Ce que je dois et ce qu'on me doit, en cours. Les dettes réglées sont dans l'Historique." />

      {/* Bilan en un coup d'œil : totaux des lignes EN COURS, qui sélectionnent aussi la liste. */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TotalCard label="Ce que je dois" total={totalDebts} count={activeDebts.length} color="blue"
          active={isDebts} onClick={() => setTab('debts')} testId="debts-card" />
        <TotalCard label="Ce qu'on me doit" total={totalCredits} count={activeCredits.length} color="green"
          active={!isDebts} onClick={() => setTab('credits')} testId="credits-card" />
      </div>

      {/* Solde net par partenaire — repère la boutique où une compensation est possible. */}
      {partners.length > 0 && (
        <div className="mb-6" data-testid="net-by-partner">
          <h2 className="mb-2 text-sm font-semibold text-gray-600">Solde net par partenaire</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {partners.map((p) => {
              const net = p.debt - p.credit
              const both = p.debt > 0 && p.credit > 0
              const label = net > 0 ? 'Vous devez' : net < 0 ? 'On vous doit' : 'Soldé'
              const tone = net > 0 ? 'text-blue-700' : net < 0 ? 'text-green-700' : 'text-gray-500'
              return (
                <div key={p.id} data-testid={`partner-net-${p.id}`}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
                  <p className="truncate text-sm font-medium text-gray-800">{p.name}</p>
                  <p className={`text-sm font-semibold ${tone}`}>{label}{net !== 0 ? ` ${fmt(Math.abs(net))}` : ''}</p>
                  {both && (
                    <p className="text-xs text-gray-400">Compensable jusqu'à {fmt(Math.min(p.debt, p.credit))}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {error && <p className="mb-4 rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-700">{error}</p>}

      <div className={tbl.container}>
        <div className={tbl.scroll}>
          <table className="w-full border-collapse">
            <thead>
              <tr className={tbl.headerRow}>
                <th className={tbl.headerCell}>Date &amp; heure</th>
                <th className={tbl.headerCell}>{isDebts ? 'À qui' : 'Qui'}</th>
                <th className={tbl.headerCell}>Type</th>
                <th className={tbl.headerCell}>Réseau</th>
                <th className={tbl.headerCell}>Montant</th>
                <th className={tbl.headerCell}>Statut</th>
                <th className={tbl.headerCell}>{tab === 'debts' ? 'Règlement' : 'Règlements'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan="7" className={tbl.empty}>{emptyMsg}</td></tr>
              ) : (
                rows.map(d => isDebts
                  ? <DebtRow key={d.id} debt={d} credits={activeCredits} tbl={tbl} />
                  : <CreditRow key={d.id} debt={d} tbl={tbl} />)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default StoreInternalDebts
