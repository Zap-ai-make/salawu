import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useTheme } from '../../context/ThemeContext.jsx'
import PageHeader from '../../components/ui/PageHeader'
import StatCard from '../../components/ui/StatCard'
import StatusBadge from '../../components/ui/StatusBadge'
import { themedTableClasses } from '../../components/ui/themedTable.js'
import { formatDateTime } from '../../utils/formatters'
import {
  subscribeMyDebts,
  subscribeMyCredits,
  subscribeDebtSettlements,
  declareInternalDebtSettlement,
  confirmInternalDebtSettlement,
  rejectInternalDebtSettlement,
  generateIdempotencyKey,
} from '../../services/collaborationService'
import {
  COLLAB_OPERATION_TYPE_LABELS,
  DEBT_STATUS_LABELS,
  DEBT_SETTLEMENT_METHODS,
  DEBT_SETTLEMENT_METHOD_LABELS,
  DEBT_SETTLEMENT_STATUS_LABELS,
} from '../../constants/dealerConstants'

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('fr-FR') + ' FCFA' : '—')
const opLabel = (t) => COLLAB_OPERATION_TYPE_LABELS[t] ?? t
const METHODS = Object.values(DEBT_SETTLEMENT_METHODS)

// Statut de dette → couleurs du badge partagé. Les statuts de dette (open /
// partially_settled / settled) ne figurent pas dans les presets de StatusBadge :
// on passe la couleur explicitement plutôt que de retomber sur le gris par défaut.
const DEBT_STATUS_COLOR = {
  open: 'bg-amber-100 text-amber-800',
  partially_settled: 'bg-blue-100 text-blue-800',
  settled: 'bg-green-100 text-green-800',
}

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

// ── Ligne dette (côté débitrice) : déclarer un règlement ─────────────────────
function DebtRow({ debt, tbl }) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('especes')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState(null)

  const declare = async () => {
    setBusy(true); setErr(null); setMsg(null)
    try {
      await declareInternalDebtSettlement({ debtId: debt.id, amount, method, idempotencyKey: generateIdempotencyKey() })
      setMsg('Règlement déclaré. En attente de confirmation.')
      setAmount('')
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
            <input type="text" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="Montant" className="w-28 rounded border border-gray-300 px-2 py-1 text-sm" aria-label="Montant règlement" />
            <select value={method} onChange={e => setMethod(e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-sm" aria-label="Méthode">
              {METHODS.map(m => <option key={m} value={m}>{DEBT_SETTLEMENT_METHOD_LABELS[m]}</option>)}
            </select>
            <button type="button" disabled={busy} onClick={declare}
              className="rounded-lg bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50">Déclarer</button>
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

  const declared = settlements.filter(s => s.settlementStatus === 'declared')

  const act = async (fn, settlementId) => {
    setBusy(settlementId); setErr(null)
    try { await fn() } catch (e) { setErr(e.message) } finally { setBusy(null) }
  }

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
        {declared.length === 0 ? (
          <span className="text-xs text-gray-400">—</span>
        ) : (
          <div className="space-y-1">
            {declared.map(s => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-amber-50 px-2 py-1 text-xs">
                <span>{fmt(s.amount)} · {DEBT_SETTLEMENT_METHOD_LABELS[s.method] ?? s.method} · {DEBT_SETTLEMENT_STATUS_LABELS[s.settlementStatus]}</span>
                <span className="flex gap-1">
                  <button type="button" disabled={busy === s.id} onClick={() => act(() => confirmInternalDebtSettlement({ debtId: debt.id, settlementId: s.id }), s.id)}
                    className="rounded bg-green-600 px-2 py-0.5 text-white hover:bg-green-700 disabled:opacity-50">Confirmer</button>
                  <button type="button" disabled={busy === s.id} onClick={() => act(() => rejectInternalDebtSettlement({ debtId: debt.id, settlementId: s.id, rejectionReason: 'Non reçu' }), s.id)}
                    className="rounded border border-red-200 px-2 py-0.5 text-red-600 hover:bg-red-50 disabled:opacity-50">Rejeter</button>
                </span>
              </div>
            ))}
          </div>
        )}
        {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
      </td>
    </tr>
  )
}

/** Carte-total qui sert aussi de sélecteur de vue (dette / créance). */
function TotalCard({ label, total, count, color, active, onClick, testId }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} data-testid={testId}
      className={`block w-full rounded-2xl text-left transition ${active ? 'ring-2 ring-offset-1 ring-blue-500' : 'ring-1 ring-transparent hover:ring-gray-200'}`}>
      <StatCard label={label} value={fmt(total)} sub={`${count} ${count > 1 ? 'lignes' : 'ligne'}`} color={color} />
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

  const totalDebts = debts.reduce((s, d) => s + (Number(d.remainingAmount) || 0), 0)
  const totalCredits = credits.reduce((s, d) => s + (Number(d.remainingAmount) || 0), 0)

  return (
    <div>
      <PageHeader title="Dettes internes" subtitle="Dettes et créances entre boutiques, et leurs règlements" />

      {/* Bilan en un coup d'œil : les deux totaux, qui sélectionnent aussi la liste. */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TotalCard label="Mes dettes" total={totalDebts} count={debts.length} color="blue"
          active={tab === 'debts'} onClick={() => setTab('debts')} testId="debts-card" />
        <TotalCard label="Mes créances" total={totalCredits} count={credits.length} color="green"
          active={tab === 'credits'} onClick={() => setTab('credits')} testId="credits-card" />
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-700">{error}</p>}

      <div className={tbl.container}>
        <div className={tbl.scroll}>
          <table className="w-full border-collapse">
            <thead>
              <tr className={tbl.headerRow}>
                <th className={tbl.headerCell}>Date &amp; heure</th>
                <th className={tbl.headerCell}>{tab === 'debts' ? 'Envers' : 'De'}</th>
                <th className={tbl.headerCell}>Type</th>
                <th className={tbl.headerCell}>Réseau</th>
                <th className={tbl.headerCell}>Montant</th>
                <th className={tbl.headerCell}>Statut</th>
                <th className={tbl.headerCell}>{tab === 'debts' ? 'Règlement' : 'Règlements'}</th>
              </tr>
            </thead>
            <tbody>
              {tab === 'debts' ? (
                debts.length === 0 ? (
                  <tr><td colSpan="7" className={tbl.empty}>Aucune dette.</td></tr>
                ) : (
                  debts.map(d => <DebtRow key={d.id} debt={d} tbl={tbl} />)
                )
              ) : (
                credits.length === 0 ? (
                  <tr><td colSpan="7" className={tbl.empty}>Aucune créance.</td></tr>
                ) : (
                  credits.map(d => <CreditRow key={d.id} debt={d} tbl={tbl} />)
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default StoreInternalDebts
