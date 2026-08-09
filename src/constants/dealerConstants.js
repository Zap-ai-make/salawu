export const DEALER_REQUEST_TYPES = Object.freeze({
  STOCK_ADD: 'stock_add',
  LIQUIDITY_ADD: 'liquidity_add',
})

export const DEALER_REQUEST_TYPE_LABELS = Object.freeze({
  stock_add: 'Ajout de stock',
  liquidity_add: 'Ajout de liquidité',
})

export const DEALER_REQUEST_STATUSES = Object.freeze({
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  REJECTED: 'rejected',
})

export const DEALER_REQUEST_STATUS_LABELS = Object.freeze({
  pending: 'En attente',
  confirmed: 'Confirmée',
  rejected: 'Rejetée',
})

// Réseau dealer par défaut = 1er réseau du circuit dealer du profil actif.
// Le dealer MULTI-réseaux (plusieurs SIM) est un chantier serveur (Phase 3) ; ici on
// conserve le comportement mono-réseau (ex. TAOFIC → 'Orange').
import { activeProfile } from '../config/activeClientProfile.js'

export const DEALER_NETWORK = activeProfile.dealer.networks[0]

// Tous les réseaux du circuit dealer du profil (dealer multi-SIM). Mono-réseau
// (ex. TAOFIC → ['Orange']) : un seul élément → l'UI dealer garde sa vue simple
// (Stock/Liquidité). Multi-réseaux : une carte Stock par réseau + liquidité globale.
export const DEALER_NETWORKS = activeProfile.dealer.networks
export const IS_DEALER_MULTI_NETWORK = DEALER_NETWORKS.length > 1

export const DEALER_REQUESTS_PAGE_SIZE = 20
export const DEALER_STORES_PAGE_SIZE = 20
export const STORE_DEALER_REQUESTS_PAGE_SIZE = 20

// Espaces gérant/admin (supervision) : pages plus denses (tableaux larges) →
// 25 lignes, contre 20 côté dealer/boutique. Valeur volontairement distincte.
export const ADMIN_PAGE_SIZE = 25

// ── Transferts boutique → dealer (retours de stock / liquidité) ──────────────
export const STORE_TRANSFER_TYPES = Object.freeze({
  RETURN_STOCK: 'return_stock',
  RETURN_LIQUIDITY: 'return_liquidity',
})

export const STORE_TRANSFER_TYPE_LABELS = Object.freeze({
  return_stock: 'Retour de stock',
  return_liquidity: 'Envoi de liquidité',
})

export const STORE_TRANSFERS_PAGE_SIZE = 20

// ── Collaborations inter-boutiques + dettes internes (Vague 2) ───────────────
export const COLLAB_OPERATION_TYPES = Object.freeze({
  DEPOSIT: 'deposit',
  WITHDRAWAL: 'withdrawal',
})

export const COLLAB_OPERATION_TYPE_LABELS = Object.freeze({
  deposit: 'Dépôt',
  withdrawal: 'Retrait',
})

export const COLLAB_STATUS_LABELS = Object.freeze({
  pending: 'En attente',
  confirmed: 'Confirmée',
  rejected: 'Rejetée',
})

export const DEBT_STATUS_LABELS = Object.freeze({
  open: 'Ouverte',
  partially_settled: 'Partiellement réglée',
  settled: 'Réglée',
})

export const DEBT_SETTLEMENT_METHODS = Object.freeze({
  ESPECES: 'especes',
  DEPOT_BANCAIRE: 'depot_bancaire',
  TRANSFERT: 'transfert',
  COMPENSATION: 'compensation',
  RETOUR_STOCK: 'retour_stock',
})

export const DEBT_SETTLEMENT_METHOD_LABELS = Object.freeze({
  especes: 'Espèces',
  depot_bancaire: 'Dépôt bancaire',
  transfert: 'Transfert',
  compensation: 'Compensation',
  retour_stock: 'Retour de stock',
})

export const DEBT_SETTLEMENT_STATUS_LABELS = Object.freeze({
  declared: 'Déclaré',
  confirmed: 'Confirmé',
  rejected: 'Rejeté',
})

export const COLLABORATIONS_PAGE_SIZE = 20
export const INTERNAL_DEBTS_PAGE_SIZE = 20
