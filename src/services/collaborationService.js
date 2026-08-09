/**
 * collaborationService.js — Collaborations inter-boutiques + dettes internes (Vague 2).
 *
 * Écritures : exclusivement via Cloud Functions (httpsCallable). Aucun write
 * Firestore direct — le backend reste autoritatif (mouvement de stock du fournisseur,
 * création/imputation de dette). Lectures : abonnements temps réel filtrés par rôle
 * (les règles Firestore cloisonnent demandeuse/fournisseuse et débitrice/créancière).
 *
 * Région Functions : europe-west1 (config dans src/config/firebase.js).
 */

import { httpsCallable } from 'firebase/functions'
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { functions, db } from '../config/firebase'
import { COLLABORATIONS_PAGE_SIZE, INTERNAL_DEBTS_PAGE_SIZE } from '../constants/dealerConstants'
import { parseStrictInteger } from '../utils/parseStrictInteger'

const ERROR_MESSAGES = {
  UNAUTHENTICATED:              'Votre session a expiré. Reconnectez-vous.',
  PROFILE_NOT_FOUND:            'Votre profil est introuvable.',
  PROFILE_INACTIVE:            'Votre compte est inactif.',
  ROLE_FORBIDDEN:               "Action réservée aux boutiques.",
  INVALID_OPERATION_TYPE:       "Type d'opération invalide (dépôt ou retrait).",
  INVALID_COLLABORATION_AMOUNT: 'Montant invalide : entier strictement positif requis.',
  INVALID_COLLABORATION_NETWORK:'Réseau invalide.',
  INVALID_STORE_ID:             'Boutique invalide.',
  SAME_STORE_COLLABORATION:     'La boutique fournisseuse doit être différente de la vôtre.',
  CLIENT_NOT_FOUND:             'Client introuvable.',
  SUPPLIER_STORE_NOT_FOUND:     'Boutique fournisseuse introuvable.',
  SUPPLIER_NOT_PROVIDER:        "Cette boutique n'est pas fournisseuse sur ce réseau.",
  INSUFFICIENT_SUPPLIER_BALANCE:'Stock insuffisant pour exécuter cette collaboration.',
  COLLABORATION_NOT_FOUND:      'Collaboration introuvable.',
  COLLABORATION_NOT_PENDING:    'Cette collaboration a déjà été traitée.',
  COLLABORATION_STORE_MISMATCH: 'Cette collaboration ne vous est pas destinée.',
  INVALID_DEBT_ID:              'Dette invalide.',
  INVALID_SETTLEMENT_ID:        'Règlement invalide.',
  INVALID_SETTLEMENT_METHOD:    'Méthode de règlement invalide.',
  INVALID_SETTLEMENT_AMOUNT:    'Montant invalide : entier strictement positif requis.',
  INVALID_IDEMPOTENCY_KEY:      'Clé de règlement invalide.',
  DEBT_NOT_FOUND:               'Dette introuvable.',
  DEBT_ALREADY_SETTLED:         'Cette dette est déjà réglée.',
  DEBT_STORE_MISMATCH:          "Vous n'êtes pas autorisé sur cette dette.",
  SETTLEMENT_NOT_DECLARED:      "Ce règlement n'est pas en attente de confirmation.",
  SETTLEMENT_NOT_FOUND:         'Règlement introuvable.',
  SETTLEMENT_EXCEEDS_REMAINING: 'Le montant dépasse le reste dû.',
  IDEMPOTENCY_CONFLICT:         'Une tranche différente existe déjà pour cette action.',
  INVALID_REJECTION_REASON:     'Le motif est invalide (3 à 500 caractères).',
  TRANSACTION_FAILED:           "L'opération n'a pas pu être finalisée.",
}

export function mapCollaborationError(err) {
  const detailCode = err?.details?.code
  if (detailCode) {
    const mapped = new Error(ERROR_MESSAGES[detailCode] || "L'opération n'a pas pu être finalisée.")
    mapped.code = detailCode
    return mapped
  }
  const funcCode = String(err?.code || '')
  if (funcCode.includes('unauthenticated')) {
    const e = new Error(ERROR_MESSAGES.UNAUTHENTICATED); e.code = 'UNAUTHENTICATED'; return e
  }
  if (import.meta.env.DEV) console.error('[collaborationService]', err)
  return new Error("Une erreur inattendue s'est produite.")
}

async function call(name, payload) {
  try {
    const result = await httpsCallable(functions, name)(payload)
    return result.data
  } catch (err) {
    throw mapCollaborationError(err)
  }
}

// Clé d'idempotence pour un règlement (stable le temps d'une saisie).
export function generateIdempotencyKey() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// ── Commandes collaboration ──────────────────────────────────────────────────

/** Boutique demandeuse : crée une collaboration (pending). */
export async function createStoreCollaboration({ clientId, network, operationType, amount, supplierStoreId } = {}) {
  const parsed = parseStrictInteger(amount)
  if (parsed === null) throw new Error(ERROR_MESSAGES.INVALID_COLLABORATION_AMOUNT)
  return call('createStoreCollaboration', { clientId, network, operationType, amount: parsed, supplierStoreId })
}

/** Boutique fournisseuse : confirme (mouvement stock + dette). */
export async function confirmStoreCollaboration(collaborationId) {
  const id = String(collaborationId ?? '').trim()
  if (!id) throw new Error('Identifiant de collaboration requis.')
  return call('confirmStoreCollaboration', { collaborationId: id })
}

/** Boutique fournisseuse : rejette (motif 3–500). */
export async function rejectStoreCollaboration(collaborationId, rejectionReason) {
  const id = String(collaborationId ?? '').trim()
  if (!id) throw new Error('Identifiant de collaboration requis.')
  const reason = String(rejectionReason ?? '').trim()
  if (reason.length < 3 || reason.length > 500) throw new Error(ERROR_MESSAGES.INVALID_REJECTION_REASON)
  return call('rejectStoreCollaboration', { collaborationId: id, rejectionReason: reason })
}

/** Boutique demandeuse : annuaire des fournisseurs éligibles pour un réseau. */
export async function listStoreCollaborationProviders(network) {
  const data = await call('listStoreCollaborationProviders', { network })
  return data?.providers ?? []
}

// ── Commandes règlement de dette ─────────────────────────────────────────────

/** Boutique débitrice : déclare une tranche de règlement (idempotent). */
export async function declareInternalDebtSettlement({ debtId, amount, method, idempotencyKey } = {}) {
  const parsed = parseStrictInteger(amount)
  if (parsed === null) throw new Error(ERROR_MESSAGES.INVALID_SETTLEMENT_AMOUNT)
  return call('declareInternalDebtSettlement', { debtId, amount: parsed, method, idempotencyKey })
}

/** Boutique créancière : confirme une tranche (impute sur la dette). */
export async function confirmInternalDebtSettlement({ debtId, settlementId } = {}) {
  return call('confirmInternalDebtSettlement', { debtId, settlementId })
}

/** Boutique créancière : rejette une tranche (motif 3–500). */
export async function rejectInternalDebtSettlement({ debtId, settlementId, rejectionReason } = {}) {
  const reason = String(rejectionReason ?? '').trim()
  if (reason.length < 3 || reason.length > 500) throw new Error(ERROR_MESSAGES.INVALID_REJECTION_REASON)
  return call('rejectInternalDebtSettlement', { debtId, settlementId, rejectionReason: reason })
}

// ── Lectures temps réel ──────────────────────────────────────────────────────

const mapDocs = (snap) => snap.docs.map(d => ({ id: d.id, ...d.data() }))

/** Boutique demandeuse : ses collaborations sortantes. */
export function subscribeOutgoingCollaborations({ storeId, onUpdate, onError } = {}) {
  if (!storeId) { onUpdate?.([]); return () => {} }
  const q = query(
    collection(db, 'storeCollaborations'),
    where('requestingStoreId', '==', storeId),
    orderBy('createdAt', 'desc'),
    limit(COLLABORATIONS_PAGE_SIZE),
  )
  return onSnapshot(q, (snap) => onUpdate?.(mapDocs(snap)), (err) => onError?.(mapCollaborationError(err)))
}

/** Boutique fournisseuse : collaborations entrantes (optionnellement par statut). */
export function subscribeIncomingCollaborations({ storeId, statusFilter = null, onUpdate, onError } = {}) {
  if (!storeId) { onUpdate?.([]); return () => {} }
  const constraints = [where('supplierStoreId', '==', storeId)]
  if (statusFilter) constraints.push(where('status', '==', statusFilter))
  constraints.push(orderBy('createdAt', 'desc'))
  constraints.push(limit(COLLABORATIONS_PAGE_SIZE))
  const q = query(collection(db, 'storeCollaborations'), ...constraints)
  return onSnapshot(q, (snap) => onUpdate?.(mapDocs(snap)), (err) => onError?.(mapCollaborationError(err)))
}

/** Boutique fournisseuse : compteur léger des collaborations en attente. */
export function subscribeIncomingCollaborationsCount({ storeId, onUpdate } = {}) {
  if (!storeId) { onUpdate?.(0); return () => {} }
  const q = query(
    collection(db, 'storeCollaborations'),
    where('supplierStoreId', '==', storeId),
    where('status', '==', 'pending'),
  )
  return onSnapshot(q, (snap) => onUpdate?.(snap.size), () => onUpdate?.(0))
}

/** Boutique : ses dettes (elle est débitrice). */
export function subscribeMyDebts({ storeId, onUpdate, onError } = {}) {
  if (!storeId) { onUpdate?.([]); return () => {} }
  const q = query(
    collection(db, 'internalDebts'),
    where('debtorStoreId', '==', storeId),
    orderBy('createdAt', 'desc'),
    limit(INTERNAL_DEBTS_PAGE_SIZE),
  )
  return onSnapshot(q, (snap) => onUpdate?.(mapDocs(snap)), (err) => onError?.(mapCollaborationError(err)))
}

/** Boutique : ses créances (elle est créancière). */
export function subscribeMyCredits({ storeId, onUpdate, onError } = {}) {
  if (!storeId) { onUpdate?.([]); return () => {} }
  const q = query(
    collection(db, 'internalDebts'),
    where('creditorStoreId', '==', storeId),
    orderBy('createdAt', 'desc'),
    limit(INTERNAL_DEBTS_PAGE_SIZE),
  )
  return onSnapshot(q, (snap) => onUpdate?.(mapDocs(snap)), (err) => onError?.(mapCollaborationError(err)))
}

/** Tranches de règlement d'une dette. */
export function subscribeDebtSettlements({ debtId, onUpdate, onError } = {}) {
  if (!debtId) { onUpdate?.([]); return () => {} }
  const q = query(
    collection(db, `internalDebts/${debtId}/settlements`),
    orderBy('declaredAt', 'desc'),
  )
  return onSnapshot(q, (snap) => onUpdate?.(mapDocs(snap)), (err) => onError?.(mapCollaborationError(err)))
}
