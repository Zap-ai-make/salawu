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
