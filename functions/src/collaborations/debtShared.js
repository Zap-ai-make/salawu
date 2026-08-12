/**
 * Helpers purs — règlement des dettes internes (Vague 2, LOT 7).
 *
 * Règlement PARTIEL déclaré par la débitrice → confirmé (ou rejeté) par la
 * créancière. Idempotent (clé stable → id de tranche déterministe). AUCUN
 * mouvement de solde en Tranche 1 : les méthodes sont traçables uniquement.
 *
 * Aucune dépendance externe (testables, TC-109). Erreurs = DealerRequestError.
 */

import { DealerRequestError } from '../errors.js'

// Canaux de remboursement d'une dette interne = les méthodes de paiement du produit
// (Mobile Money par réseau) + la banque. Superset client-agnostique, aligné sur
// METHODES_PAIEMENT_SUPPORTEES du front. Les tranches historiques en anciens codes
// (especes…) se confirment toujours : confirmInternalDebtSettlement ne revalide pas
// la méthode.
export const SETTLEMENT_METHODS = new Set([
  'Orange Money', 'Moov Money', 'Telecel Money', 'Coris Money', 'Sank Money', 'Wave', 'Cash', 'Banque',
])

export function validateDebtId(debtId) {
  if (!debtId || typeof debtId !== 'string' || debtId.trim() === '') {
    throw new DealerRequestError('INVALID_DEBT_ID', 'Identifiant de dette requis.')
  }
  return debtId.trim()
}

export function validateSettlementId(settlementId) {
  if (!settlementId || typeof settlementId !== 'string' || settlementId.trim() === '') {
    throw new DealerRequestError('INVALID_SETTLEMENT_ID', 'Identifiant de règlement requis.')
  }
  return settlementId.trim()
}

export function validateSettlementMethod(method) {
  if (typeof method !== 'string' || !SETTLEMENT_METHODS.has(method)) {
    throw new DealerRequestError('INVALID_SETTLEMENT_METHOD', 'Méthode de règlement invalide.')
  }
  return method
}

export function validateSettlementAmount(amount) {
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0) {
    throw new DealerRequestError('INVALID_SETTLEMENT_AMOUNT', 'Montant invalide : entier strictement positif requis.')
  }
  return amount
}

export function validateIdempotencyKey(key) {
  if (typeof key !== 'string') {
    throw new DealerRequestError('INVALID_IDEMPOTENCY_KEY', 'Clé d\'idempotence requise.')
  }
  const trimmed = key.trim()
  if (trimmed.length === 0 || trimmed.length > 100) {
    throw new DealerRequestError('INVALID_IDEMPOTENCY_KEY', 'Clé d\'idempotence invalide (1 à 100 caractères).')
  }
  return trimmed
}

// Id de tranche déterministe (idempotence stricte) : même débitrice + même clé
// ⇒ même document. Un 2e appel identique est un no-op ; un payload différent est
// un conflit (traité par le handler).
export function deterministicSettlementId(debtId, actorUid, idempotencyKey) {
  return `dst_${debtId}_${actorUid}_${idempotencyKey}`
}

// ── Compensation de deux dettes opposées (Vague 2, LOT 9) ────────────────────
// Une compensation solde une dette D1 (A→B) contre la dette OPPOSÉE D2 (B→A) :
// même paire de boutiques, sens inverse, TOUS réseaux confondus (décision client
// 2026-08-11). Elle ne bouge aucun float, seulement le reste dû des deux dettes.

// Id de compensation déterministe — préfixe distinct des règlements (`dst_`) pour
// éviter toute collision de document dans la même sous-collection `settlements`.
export function deterministicCompensationId(debtId, actorUid, idempotencyKey) {
  return `dcp_${debtId}_${actorUid}_${idempotencyKey}`
}

// Id de la tranche MIROIR écrite sous la dette opposée D2 à la confirmation. Déterministe
// (un seul miroir par tranche de compensation), préfixe `comp_` distinct de `dcp_`/`dst_`.
export function deterministicMirrorId(debtId, settlementId) {
  return `comp_${debtId}_${settlementId}`
}

// D2 doit être la dette opposée entre les DEUX MÊMES boutiques (débitrice/créancière
// inversées). Aucune contrainte de réseau : on compense la position nette entre A et B.
export function validateOppositeDebtPair(debt, oppositeDebt) {
  if (!debt || typeof debt !== 'object' || !oppositeDebt || typeof oppositeDebt !== 'object') {
    throw new DealerRequestError('INVALID_OPPOSITE_DEBT', 'Dette opposée invalide.')
  }
  const opposite =
    oppositeDebt.debtorStoreId === debt.creditorStoreId &&
    oppositeDebt.creditorStoreId === debt.debtorStoreId
  if (!opposite) {
    throw new DealerRequestError('NOT_OPPOSITE_PAIR', 'La dette opposée doit lier les deux mêmes boutiques en sens inverse.')
  }
}

// Montant compensable = plus petit des deux restes dus.
export function compensableAmount(debt, oppositeDebt) {
  return Math.min(Number(debt?.remainingAmount) || 0, Number(oppositeDebt?.remainingAmount) || 0)
}

// Somme des montants de tranches DÉJÀ déclarées (non encore confirmées). Ces tranches
// « réservent » du reste dû : à la déclaration, on plafonne pour que la somme des
// déclarations en attente ne dépasse jamais le reste dû. `docs` = QueryDocumentSnapshot[]
// (résultat d'une requête `settlementStatus == 'declared'`).
export function sumDeclaredAmounts(docs) {
  return (docs || []).reduce((sum, d) => sum + (Number(d.data()?.amount) || 0), 0)
}
