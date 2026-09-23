import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useTheme } from '../../context/ThemeContext.jsx'
import PageHeader from '../../components/ui/PageHeader'
import StatusBadge from '../../components/ui/StatusBadge'
import CelluleReseau from '../../components/ui/CelluleReseau'
import { tabButtonClass, TabBadge } from '../../components/ui/Tabs.jsx'
import { themedTableClasses } from '../../components/ui/themedTable.js'
import { formatDateTime } from '../../utils/formatters'
import { parseStrictInteger } from '../../utils/parseStrictInteger'
import { PAYMENT_METHODS } from '../../utils/constants.js'
import { useSimpleNetworkData } from '../../hooks/useSimpleNetworkData'
import { mapPaymentMethodToNetwork } from '../../utils/financialImpact'
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

// Un remboursement par méthode Mobile Money transfère du STOCK réseau à la confirmation
// (débitrice −, créancière +). Ces 6 réseaux = méthodes MM (miroir du serveur). Cash/Banque
// ne bougent pas de stock → jamais grisés. On grise une méthode MM si la boutique (payeuse)
// n'a pas le stock : inutile de déclarer une tranche que le serveur refusera de confirmer.
const MM_NETWORKS = new Set(['Orange', 'Moov', 'Telecel', 'Coris', 'Sank', 'Wave'])

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
        <span className="ml-1 text-xs text-encre-doux">/ {fmt(original)}</span>
      )}
    </td>
  )
}

// ── Ligne dette (côté débitrice) : rembourser OU compenser ───────────────────
// `credits` = mes créances (elles pour la compensation) ; la créance opposée du
// même partenaire (tous réseaux) permet de solder les deux dettes d'un clic.
function DebtRow({ debt, credits, tbl }) {
  const { getStock } = useSimpleNetworkData()
  // Stock (payeuse = cette boutique, la débitrice) manquant pour une méthode MM → indisponible.
  const methodUnavailable = (m) => {
    const net = mapPaymentMethodToNetwork(m)
    return MM_NETWORKS.has(net) && getStock(net) <= 0
  }
  const [amount, setAmount] = useState('')
  // Par défaut : la première méthode réellement disponible (évite de présélectionner un
  // réseau grisé, ex. Wave à 0). Repli sur METHODS[0] si tout est indisponible.
  const [method, setMethod] = useState(() => METHODS.find(m => !methodUnavailable(m)) ?? METHODS[0])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState(null)
  const [settlements, setSettlements] = useState([])

  // Mes propres tranches sur cette dette : les DÉCLARÉES (non confirmées) réservent
  // du reste dû. `available` = ce qu'il reste réellement à déclarer.
  useEffect(() => {
    const u = subscribeDebtSettlements({ debtId: debt.id, onUpdate: (s) => { setSettlements(s); setErr(null) }, onError: (e) => setErr(e.message) })
    return () => u()
  }, [debt.id])
  const pending = settlements.reduce((s, x) => (x.settlementStatus === 'declared' ? s + num(x.amount) : s), 0)
  const available = num(debt.remainingAmount) - pending

  // Créance opposée la plus ancienne du même partenaire (débitrice = ma créancière).
  const target = useMemo(() => {
    return credits
      .filter((c) => c.debtorStoreId === debt.creditorStoreId && notSettled(c))
      .sort((a, b) => tsMillis(a.createdAt) - tsMillis(b.createdAt))[0] ?? null
  }, [credits, debt.creditorStoreId])
  // Compensable plafonné par le reste dû NET des tranches en attente de ma dette
  // (le pending de la créance opposée reste garanti côté serveur).
  const compensable = target ? Math.min(available, num(target.remainingAmount)) : 0

  const rembourser = async () => {
    const n = parseStrictInteger(amount)
    if (n === null) { setErr('Le montant doit être un entier positif.'); return }
    if (n > available) {
      setErr(pending > 0
        ? `Le montant dépasse le reste dû (${fmt(pending)} déjà en attente).`
        : 'Le montant dépasse le reste dû.')
      return
    }
    // Garde-fou stock (miroir du blocage serveur à la confirmation) : ne pas déclarer un
    // remboursement MM que cette boutique ne peut pas honorer. Cash/Banque : pas de stock.
    const net = mapPaymentMethodToNetwork(method)
    if (MM_NETWORKS.has(net)) {
      const stock = getStock(net)
      if (stock <= 0) { setErr(`Le réseau ${net} n'a pas de stock disponible pour ce remboursement.`); return }
      if (n > stock) { setErr(`Stock ${net} insuffisant. Disponible : ${fmt(stock)}.`); return }
    }
    setBusy(true); setErr(null); setMsg(null)
    try {
      // On transmet la saisie brute : le service reste la source unique du parse (idempotent).
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
      <td data-nombre className={`${tbl.cell} whitespace-nowrap text-gray-700`}>{formatDateTime(debt.createdAt)}</td>
      <td className={`${tbl.cell} font-medium text-gray-800`}>{debt.creditorStoreName || 'Boutique inconnue'}</td>
      <td className={`${tbl.cell} text-gray-700`}>{opLabel(debt.operationType)}</td>
      <td className={`${tbl.cell} text-gray-700`}><CelluleReseau reseau={debt.network} /></td>
      <AmountCell debt={debt} tbl={tbl} />
      <td className={`${tbl.cell} whitespace-nowrap`}>
        <StatusBadge status={debt.status} label={DEBT_STATUS_LABELS[debt.status] ?? debt.status} color={DEBT_STATUS_COLOR[debt.status]} />
      </td>
      <td className={tbl.cell}>
        {debt.status === 'settled' ? (
          <span className="text-xs text-encre-doux">—</span>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {compensable > 0 && (
              <button type="button" disabled={busy} onClick={compenser}
                data-rang="accent"
                className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                title="Solder avec la créance opposée de cette boutique">
                Compenser {fmt(compensable)}
              </button>
            )}
            <input data-champ-montant type="text" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="Montant" className="w-28 rounded border border-gray-300 px-2 py-1 text-sm" aria-label="Montant règlement" />
            <select value={method} onChange={e => setMethod(e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-sm" aria-label="Méthode">
              {METHODS.map(m => {
                const off = methodUnavailable(m)
                return (
                  <option key={m} value={m} disabled={off}>
                    {DEBT_SETTLEMENT_METHOD_LABELS[m] ?? m}{off ? ' — stock épuisé' : ''}
                  </option>
                )
              })}
            </select>
            <button type="button" disabled={busy || available <= 0} onClick={rembourser}
              data-rang="accent"
              className="rounded-lg bg-green-700 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50">Rembourser</button>
            {pending > 0 && <p data-champ-regle className="w-full text-xs text-gray-500">Déjà en attente : {fmt(pending)}</p>}
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
    const u = subscribeDebtSettlements({ debtId: debt.id, onUpdate: (s) => { setSettlements(s); setErr(null) }, onError: (e) => setErr(e.message) })
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
      <td data-nombre className={`${tbl.cell} whitespace-nowrap text-gray-700`}>{formatDateTime(debt.createdAt)}</td>
      <td className={`${tbl.cell} font-medium text-gray-800`}>{debt.debtorStoreName || 'Boutique inconnue'}</td>
      <td className={`${tbl.cell} text-gray-700`}>{opLabel(debt.operationType)}</td>
      <td className={`${tbl.cell} text-gray-700`}><CelluleReseau reseau={debt.network} /></td>
      <AmountCell debt={debt} tbl={tbl} />
      <td className={`${tbl.cell} whitespace-nowrap`}>
        <StatusBadge status={debt.status} label={DEBT_STATUS_LABELS[debt.status] ?? debt.status} color={DEBT_STATUS_COLOR[debt.status]} />
      </td>
      <td className={tbl.cell}>
        {sorted.length === 0 ? (
          <span className="text-xs text-encre-doux">—</span>
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
                        data-rang="accent"
                        className="rounded bg-green-700 px-2 py-0.5 text-white hover:bg-green-700 disabled:opacity-50">Confirmer</button>
                      <button type="button" disabled={busy === s.id} onClick={() => act(() => rejectTranche(s), s.id)}
                        data-rang="danger"
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

/**
 * Une tuile de bilan.
 * ─────────────────────────────────────────────────────────────────────────────
 * ⟲ ELLE REMPLACE `TotalCard`, QUI ETAIT DEUX CHOSES A LA FOIS.
 *
 * `TotalCard` enveloppait un `StatCard` dans un `<button aria-pressed>` : la
 * tuile ETAIT le selecteur de vue. Deux fonctions dans un seul objet, et aucune
 * des deux rendue clairement — un chiffre n'a pas l'air cliquable, et un onglet
 * n'a pas l'air d'un total.
 *
 * La maquette les separe : une rangee d'onglets choisit la liste, une rangee de
 * tuiles informe. C'est ce qui permet d'ajouter une TROISIEME tuile — le solde
 * net — qui ne selectionne rien et n'aurait eu nulle part ou aller.
 *
 * `data-tuile` : le fait que src/index.css attendait. Le commentaire du lot
 * L8.1 le note noir sur blanc — « les tuiles de Dettes internes gardent leur
 * rounded-2xl et leur ombre pour le moment ; elles relevent du lot de cet
 * ecran-la ». C'est ce lot.
 */
function Tuile({ titre, valeur, pied, sens, testId }) {
  return (
    <div data-tuile data-testid={testId} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <p data-tuile-titre className="text-xs font-semibold uppercase tracking-wide text-gray-500">{titre}</p>
      {/* `data-sens` peint l'entree et la sortie, comme dans l'historique et le
          tableau des transactions. Absent = ni l'un ni l'autre (un solde nul). */}
      <p data-montant data-sens={sens} className="mt-1 text-2xl font-bold text-gray-900">{valeur}</p>
      {pied && <p data-tuile-pied className="mt-1 text-xs text-gray-500">{pied}</p>}
    </div>
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
    // On efface l'erreur au premier snapshot réussi : couplé au réabonnement résilient du
    // service, un blip de listener ne laisse plus de bandeau figé ni de page non-synchronisée.
    const u1 = subscribeMyDebts({ storeId, onUpdate: (d) => { setDebts(d); setError(null) }, onError: (e) => setError(e.message) })
    const u2 = subscribeMyCredits({ storeId, onUpdate: (c) => { setCredits(c); setError(null) }, onError: (e) => setError(e.message) })
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
      const cur = map.get(id) ?? { id, name: name || 'Boutique inconnue', debt: 0, credit: 0 }
      if (name) cur.name = name
      map.set(id, cur)
      return cur
    }
    debts.forEach((d) => { touch(d.creditorStoreId, d.creditorStoreName).debt += num(d.remainingAmount) })
    credits.forEach((c) => { touch(c.debtorStoreId, c.debtorStoreName).credit += num(c.remainingAmount) })
    return [...map.values()].filter((p) => p.debt > 0 || p.credit > 0)
  }, [debts, credits])

  /**
   * Le solde net, et ce qu'il faut dire pour qu'un signe ait un sens.
   *
   * ⚠ LA CONVENTION EST CELLE DES TUILES, ET ELLE EST L'INVERSE DE CELLE DES
   * DETTES. Une dette est un nombre POSITIF dans Firestore (`remainingAmount`) ;
   * ce qu'on affiche est un point de vue de caisse : ce que je dois SORT
   * (negatif), ce qu'on me doit ENTRE (positif). Le solde net suit donc
   * `credits − debts`, et non l'inverse.
   */
  const soldeNet = totalCredits - totalDebts
  const mentionDuSolde = soldeNet > 0
    ? 'on me doit plus que je ne dois'
    : soldeNet < 0
      ? 'je dois plus qu’on ne me doit'
      : 'les comptes s’équilibrent'

  // Le nombre de BOUTIQUES concernees, pas de lignes : une meme boutique peut
  // porter trois dettes sur trois reseaux, et « 3 lignes » ne dit pas combien de
  // partenaires il faudra aller voir.
  const nbPartenairesDebiteurs = new Set(activeDebts.map((d) => d.creditorStoreId)).size
  const nbPartenairesCrediteurs = new Set(activeCredits.map((c) => c.debtorStoreId)).size

  return (
    <div data-ecran>
      <PageHeader title="Dettes internes" subtitle="Ce que je dois et ce qu'on me doit, en cours. Les dettes réglées sont dans l'Historique." />

      {/* LES ONGLETS — ils choisissent la liste, et rien d'autre.
          Meme vocabulaire que Transactions et Demandes Dealer : `tabButtonClass`
          et `TabBadge`. Le compteur est ici HONNETE et complet — ces deux
          nombres sont ceux des lignes en cours reellement abonnees, pas
          l'echantillon d'une page. */}
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Choisir la liste">
        <button type="button" aria-pressed={isDebts} data-testid="debts-card"
          className={tabButtonClass(isDebts)} onClick={() => setTab('debts')}>
          Je dois
          {activeDebts.length > 0 && (
            <TabBadge count={activeDebts.length} active={isDebts}
              label={`${activeDebts.length} dette${activeDebts.length > 1 ? 's' : ''} en cours`} />
          )}
        </button>
        <button type="button" aria-pressed={!isDebts} data-testid="credits-card"
          className={tabButtonClass(!isDebts)} onClick={() => setTab('credits')}>
          On me doit
          {activeCredits.length > 0 && (
            <TabBadge count={activeCredits.length} active={!isDebts}
              label={`${activeCredits.length} créance${activeCredits.length > 1 ? 's' : ''} en cours`} />
          )}
        </button>
      </div>

      {/* LE BILAN — trois tuiles, dont une qui n'existait pas.
          ────────────────────────────────────────────────────────────────────
          ⚠ « SOLDE NET » EST LE CHIFFRE QUE L'ECRAN NE DONNAIT PAS. Il affichait
          deux totaux cote a cote et laissait la soustraction a l'utilisateur —
          or c'est precisement ce qu'on veut savoir en fin de journee : est-ce
          que je dois, ou est-ce qu'on me doit ?

          ⚠ LE SIGNE NE SUFFIT PAS, ET LE PIED LE DIT EN TOUTES LETTRES. « +42 700 »
          ne dit pas de quel cote penche le compte : la maquette ecrit « on me
          doit plus que je ne dois » sous le chiffre, et c'est la regle « aucune
          information n'est portee par un seul canal » appliquee a un solde. */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Tuile
          titre="Je dois, en cours"
          valeur={totalDebts > 0 ? `−${fmt(totalDebts)}` : fmt(0)}
          sens={totalDebts > 0 ? 'sortie' : undefined}
          pied={`FCFA, ${nbPartenairesDebiteurs} boutique${nbPartenairesDebiteurs > 1 ? 's' : ''}`}
          testId="tuile-je-dois"
        />
        <Tuile
          titre="On me doit, en cours"
          valeur={totalCredits > 0 ? `+${fmt(totalCredits)}` : fmt(0)}
          sens={totalCredits > 0 ? 'entree' : undefined}
          pied={`FCFA, ${nbPartenairesCrediteurs} boutique${nbPartenairesCrediteurs > 1 ? 's' : ''}`}
          testId="tuile-on-me-doit"
        />
        <Tuile
          titre="Solde net"
          valeur={soldeNet === 0 ? fmt(0) : `${soldeNet > 0 ? '+' : '−'}${fmt(Math.abs(soldeNet))}`}
          sens={soldeNet > 0 ? 'entree' : soldeNet < 0 ? 'sortie' : undefined}
          pied={`FCFA — ${mentionDuSolde}`}
          testId="tuile-solde-net"
        />
      </div>

      {/* Solde net par partenaire — repère la boutique où une compensation est possible. */}
      {partners.length > 0 && (
        <div className="mb-6" data-testid="net-by-partner">
          <h2 data-bloc-titre className="mb-2 text-sm font-semibold text-gray-600">Solde net par partenaire</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {partners.map((p) => {
              const net = p.debt - p.credit
              const both = p.debt > 0 && p.credit > 0
              const label = net > 0 ? 'Vous devez' : net < 0 ? 'On vous doit' : 'Soldé'
              const tone = net > 0 ? 'text-blue-700' : net < 0 ? 'text-green-700' : 'text-gray-500'
              return (
                <div key={p.id} data-tuile data-testid={`partner-net-${p.id}`}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
                  <p className="truncate text-sm font-medium text-gray-800">{p.name}</p>
                  <p className={`text-sm font-semibold ${tone}`}>{label}{net !== 0 ? ` ${fmt(Math.abs(net))}` : ''}</p>
                  {both && (
                    <p className="text-xs text-encre-doux">Compensable jusqu'à {fmt(Math.min(p.debt, p.credit))}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {error && <p className="mb-4 rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-700">{error}</p>}

      <div className={tbl.container}>
        <div {...tbl.zoneDefilante("Dettes internes en cours, défilement horizontal")}>
          <table className="w-full border-collapse">
            <thead>
              <tr className={tbl.headerRow}>
                <th className={tbl.headerCell}>Date &amp; heure</th>
                <th className={tbl.headerCell}>{isDebts ? 'À qui' : 'Qui'}</th>
                <th className={tbl.headerCell}>Type</th>
                <th className={tbl.headerCell}>Réseau</th>
                <th data-montant className={tbl.headerCell}>Montant</th>
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
