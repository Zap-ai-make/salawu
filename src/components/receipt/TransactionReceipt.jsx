import { APP_NAME } from '../../constants/branding.js'
import { getClientName, formatTransactionDateTime } from '../../utils/helpers.js'

/**
 * TransactionReceipt — reçu imprimable d'une transaction cliente (présentation pure).
 * ─────────────────────────────────────────────────────────────────────────────
 * Se construit uniquement à partir de l'objet `transaction` déjà en mémoire
 * (aucun accès réseau) + la marque active. Aucune règle métier : la nature
 * « Remboursement » est purement dérivée pour l'affichage.
 *
 * La racine porte `id="receipt-print-root"` : la feuille d'impression globale
 * (src/index.css, @media print) n'imprime que ce nœud.
 */

// Format monétaire cohérent avec le reste de l'app (« 10 000 FCFA »).
const fmtFCFA = (value) => `${(Number(value) || 0).toLocaleString('fr-FR')} FCFA`

// N° de reçu lisible dérivé de l'id du document (pas de champ référence en base).
function receiptNumber(id) {
  const raw = String(id || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  if (!raw) return '—'
  const tail = raw.slice(-8)
  return tail.length > 4 ? `${tail.slice(0, 4)}-${tail.slice(4)}` : tail
}

// Nature affichée. Un « Crédit » déjà remboursé devient « Remboursement » (affichage seul).
const isCreditType = (type) => /cr[ée]dit/i.test(String(type || ''))

function getReceiptNature(transaction) {
  const type = transaction?.type || ''
  const refunded = Number(transaction?.refundedAmount) || 0
  if (isCreditType(type) && refunded > 0) return 'Remboursement'
  return type || '—'
}

function Line({ label, value }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900 text-right break-words">{value || '—'}</span>
    </div>
  )
}

function Dashed() {
  return <div className="my-3 border-t border-dashed border-gray-300" />
}

function TransactionReceipt({ transaction = {} }) {
  const t = transaction
  const nature = getReceiptNature(t)
  const reseau = t.reseau || t.network || '—'
  const operator = t.operatorName || t.userName || '—'

  // Détail de règlement : montré pour un crédit porteur de données de règlement.
  const isCredit = isCreditType(t.type)
  const hasSettlement =
    isCredit && (t.paidAmount != null || t.refundedAmount != null || t.remainingAmount != null)

  return (
    <div
      id="receipt-print-root"
      data-testid="transaction-receipt"
      className="mx-auto w-full max-w-sm bg-white font-sans text-gray-900"
    >
      {/* En-tête marque */}
      <div className="rounded-t-lg bg-orange-500 px-5 py-4 text-center text-white">
        <div className="text-2xl font-extrabold tracking-widest">{APP_NAME}</div>
      </div>

      <div className="px-5 py-4">
        {/* Références */}
        <div data-testid="receipt-number">
          <Line label="N° reçu" value={receiptNumber(t.id)} />
        </div>
        <Line label="Date" value={formatTransactionDateTime(t)} />

        <Dashed />

        {/* Nature en évidence */}
        <div className="text-center">
          <div
            data-testid="receipt-nature"
            className="text-lg font-bold uppercase tracking-[0.2em] text-orange-600"
          >
            {nature}
          </div>
        </div>

        <Dashed />

        {/* Détails opération */}
        <div className="space-y-1.5">
          <Line label="Client" value={getClientName(t.client)} />
          <Line label="Réseau" value={reseau} />
          {t.code && <Line label="Numéro" value={t.code} />}
        </div>

        <Dashed />

        {/* Montant */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-center">
          <div className="text-xs uppercase tracking-wide text-gray-500">Montant</div>
          <div data-testid="receipt-amount" className="mt-1 text-2xl font-extrabold text-gray-900">
            {fmtFCFA(t.montant ?? t.amount)}
          </div>
        </div>

        {/* Détail de règlement (remboursement / paiement partiel) */}
        {hasSettlement && (
          <div
            data-testid="receipt-settlement"
            className="mt-3 space-y-1.5 rounded-lg border border-orange-100 bg-orange-50/60 px-4 py-3"
          >
            <Line label="Montant crédit" value={fmtFCFA(t.montant ?? t.amount)} />
            {t.paidAmount != null && <Line label="Déjà payé" value={fmtFCFA(t.paidAmount)} />}
            {t.refundedAmount != null && <Line label="Remboursé" value={fmtFCFA(t.refundedAmount)} />}
            {t.remainingAmount != null && <Line label="Restant" value={fmtFCFA(t.remainingAmount)} />}
          </div>
        )}

        <Dashed />

        {/* Pied */}
        <div className="space-y-1.5">
          <Line label="Statut" value={t.statut || 'Validée'} />
          <Line label="Opérateur" value={operator} />
        </div>

        <div className="mt-4 text-center text-xs text-gray-400">
          <div>Merci de votre confiance</div>
        </div>
      </div>
    </div>
  )
}

export default TransactionReceipt
