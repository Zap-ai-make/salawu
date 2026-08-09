import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import PageHeader from '../../components/ui/PageHeader'
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
  DEBT_STATUS_LABELS,
  DEBT_SETTLEMENT_METHODS,
  DEBT_SETTLEMENT_METHOD_LABELS,
  DEBT_SETTLEMENT_STATUS_LABELS,
} from '../../constants/dealerConstants'

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('fr-FR') + ' FCFA' : '—')
const METHODS = Object.values(DEBT_SETTLEMENT_METHODS)

// ── Ligne dette (côté débitrice) : déclarer un règlement ─────────────────────
function DebtRow({ debt }) {
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
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-gray-700">Envers <span className="font-medium">{debt.creditorStoreName ?? debt.creditorStoreId}</span> · {debt.network}</span>
        <span>Reste dû : <span className="font-semibold">{fmt(debt.remainingAmount)}</span> / {fmt(debt.originalAmount)} · {DEBT_STATUS_LABELS[debt.status] ?? debt.status}</span>
      </div>
      {debt.status !== 'settled' && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <input type="text" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="Montant" className="w-28 rounded border border-gray-300 px-2 py-1 text-sm" aria-label="Montant règlement" />
          <select value={method} onChange={e => setMethod(e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-sm" aria-label="Méthode">
            {METHODS.map(m => <option key={m} value={m}>{DEBT_SETTLEMENT_METHOD_LABELS[m]}</option>)}
          </select>
          <button type="button" disabled={busy} onClick={declare}
            className="rounded-lg bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50">Déclarer</button>
        </div>
      )}
      {msg && <p className="mt-1 text-xs text-green-700">{msg}</p>}
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
    </div>
  )
}

// ── Ligne créance (côté créancière) : confirmer/rejeter les tranches ─────────
function CreditRow({ debt }) {
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
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-gray-700">De <span className="font-medium">{debt.debtorStoreName ?? debt.debtorStoreId}</span> · {debt.network}</span>
        <span>Reste dû : <span className="font-semibold">{fmt(debt.remainingAmount)}</span> / {fmt(debt.originalAmount)} · {DEBT_STATUS_LABELS[debt.status] ?? debt.status}</span>
      </div>
      {declared.length > 0 && (
        <div className="mt-2 space-y-1">
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
    </div>
  )
}

function StoreInternalDebts() {
  const { userProfile } = useAuth()
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

  const rows = tab === 'debts' ? debts : credits

  return (
    <div>
      <PageHeader title="Dettes internes" subtitle="Dettes et créances entre boutiques, et leurs règlements" />

      <div className="mb-4 flex rounded-lg border border-gray-200 bg-white overflow-hidden w-max">
        <button type="button" onClick={() => setTab('debts')} aria-pressed={tab === 'debts'}
          className={`px-4 py-2 text-sm font-medium ${tab === 'debts' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>Mes dettes ({debts.length})</button>
        <button type="button" onClick={() => setTab('credits')} aria-pressed={tab === 'credits'}
          className={`px-4 py-2 text-sm font-medium ${tab === 'credits' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>Mes créances ({credits.length})</button>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-700">{error}</p>}

      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">{tab === 'debts' ? 'Aucune dette.' : 'Aucune créance.'}</p>
      ) : (
        <div className="space-y-2">
          {rows.map(d => tab === 'debts' ? <DebtRow key={d.id} debt={d} /> : <CreditRow key={d.id} debt={d} />)}
        </div>
      )}
    </div>
  )
}

export default StoreInternalDebts
