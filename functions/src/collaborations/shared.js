/**
 * Helpers purs — collaborations inter-boutiques (Vague 2, Tranche 1).
 *
 * Sémantique métier (validée client 2026-08-09) :
 *   Une boutique DEMANDEUSE (sans SIM sur un réseau) sert un agent en s'appuyant
 *   sur une boutique FOURNISSEUSE. Un seul document (storeCollaborations) est créé
 *   par la demandeuse ; la fournisseuse l'exécute puis confirme. À la confirmation,
 *   seul le STOCK du fournisseur bouge, et une dette interne est créée.
 *
 *   Direction de la dette (texte du cahier) :
 *     • deposit    → la demandeuse encaisse le cash, la fournisseuse a envoyé le
 *                    float → dette DEMANDEUSE → FOURNISSEUSE.
 *     • withdrawal → la fournisseuse a reçu le float, la demandeuse a remis le cash
 *                    → dette FOURNISSEUSE → DEMANDEUSE.
 *
 * Aucune dépendance externe (testables directement, TC-103). Les validations
 * échouées lancent DealerRequestError (jamais HttpsError).
 */

import { DealerRequestError } from '../errors.js'

export const COLLAB_OPERATION_TYPES = new Set(['deposit', 'withdrawal'])

// ── Type d'opération agent servie via collaboration ─────────────────────────
export function validateOperationType(operationType) {
  if (typeof operationType !== 'string' || !COLLAB_OPERATION_TYPES.has(operationType)) {
    throw new DealerRequestError('INVALID_OPERATION_TYPE', "Type d'opération invalide (dépôt ou retrait).")
  }
  return operationType
}

// ── Montant (entier strictement positif) ────────────────────────────────────
export function validateCollaborationAmount(amount) {
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0) {
    throw new DealerRequestError('INVALID_COLLABORATION_AMOUNT', 'Montant invalide : entier strictement positif requis.')
  }
  return amount
}

// ── Identifiant de collaboration ────────────────────────────────────────────
export function validateCollaborationId(collaborationId) {
  if (!collaborationId || typeof collaborationId !== 'string' || collaborationId.trim() === '') {
    throw new DealerRequestError('INVALID_COLLABORATION_ID', 'Identifiant de collaboration requis.')
  }
  return collaborationId.trim()
}

// ── Référence de boutique (id sans espaces) ─────────────────────────────────
export function validateStoreRef(storeId, label = 'boutique') {
  if (typeof storeId !== 'string' || storeId.trim() === '' || storeId !== storeId.trim()) {
    throw new DealerRequestError('INVALID_STORE_ID', `Identifiant de ${label} invalide.`)
  }
  return storeId
}

// ── Identifiant client (non vide) ───────────────────────────────────────────
export function validateClientId(clientId) {
  if (!clientId || typeof clientId !== 'string' || clientId.trim() === '') {
    throw new DealerRequestError('CLIENT_NOT_FOUND', 'Client requis.')
  }
  return clientId.trim()
}

// ── Direction de la dette selon l'opération (règle cahier) ──────────────────
// Retourne { debtorStoreId, creditorStoreId } à partir des deux boutiques.
export function debtDirection(operationType, { requestingStoreId, supplierStoreId }) {
  validateOperationType(operationType)
  return operationType === 'deposit'
    ? { debtorStoreId: requestingStoreId, creditorStoreId: supplierStoreId }
    : { debtorStoreId: supplierStoreId, creditorStoreId: requestingStoreId }
}

// ── Variation du STOCK du fournisseur à la confirmation ─────────────────────
//   deposit    → −amount (le fournisseur a envoyé le float au client)
//   withdrawal → +amount (la SIM du fournisseur a reçu le float du client)
export function supplierStockDelta(operationType, amount) {
  return operationType === 'deposit' ? -amount : amount
}
