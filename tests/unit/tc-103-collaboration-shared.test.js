/**
 * TC-103 — Helpers purs des collaborations inter-boutiques
 * (functions/src/collaborations/shared.js).
 *
 * Vague 2, LOT 1. Aucune I/O. On verrouille :
 *   • validation operationType / amount / id / storeRef / clientId ;
 *   • debtDirection (règle cahier : deposit → demandeuse doit ; withdrawal → fournisseuse doit) ;
 *   • supplierStockDelta (deposit −amount, withdrawal +amount).
 * Toute erreur = DealerRequestError (code métier).
 */

import { describe, it, expect } from 'vitest'
import {
  validateOperationType,
  validateCollaborationAmount,
  validateCollaborationId,
  validateStoreRef,
  validateClientId,
  debtDirection,
  supplierStockDelta,
} from '../../functions/src/collaborations/shared.js'

const codeOf = (fn) => { try { fn(); return null } catch (e) { return e.code } }

describe('TC-103-OP — validateOperationType', () => {
  it('accepte deposit/withdrawal', () => {
    expect(validateOperationType('deposit')).toBe('deposit')
    expect(validateOperationType('withdrawal')).toBe('withdrawal')
  })
  it('rejette une valeur inconnue / non-string', () => {
    expect(codeOf(() => validateOperationType('credit'))).toBe('INVALID_OPERATION_TYPE')
    expect(codeOf(() => validateOperationType(''))).toBe('INVALID_OPERATION_TYPE')
    expect(codeOf(() => validateOperationType(null))).toBe('INVALID_OPERATION_TYPE')
  })
})

describe('TC-103-AMOUNT — validateCollaborationAmount', () => {
  it('accepte un entier strictement positif', () => {
    expect(validateCollaborationAmount(20000)).toBe(20000)
  })
  it('rejette 0, négatif, décimal, non-nombre', () => {
    expect(codeOf(() => validateCollaborationAmount(0))).toBe('INVALID_COLLABORATION_AMOUNT')
    expect(codeOf(() => validateCollaborationAmount(-5))).toBe('INVALID_COLLABORATION_AMOUNT')
    expect(codeOf(() => validateCollaborationAmount(10.5))).toBe('INVALID_COLLABORATION_AMOUNT')
    expect(codeOf(() => validateCollaborationAmount('20000'))).toBe('INVALID_COLLABORATION_AMOUNT')
  })
})

describe('TC-103-IDS — id / storeRef / clientId', () => {
  it('validateCollaborationId trim + rejette vide', () => {
    expect(validateCollaborationId('  col-1 ')).toBe('col-1')
    expect(codeOf(() => validateCollaborationId(''))).toBe('INVALID_COLLABORATION_ID')
  })
  it('validateStoreRef rejette vide/espaces', () => {
    expect(validateStoreRef('store-A')).toBe('store-A')
    expect(codeOf(() => validateStoreRef(' store-A'))).toBe('INVALID_STORE_ID')
    expect(codeOf(() => validateStoreRef(''))).toBe('INVALID_STORE_ID')
  })
  it('validateClientId trim + rejette vide', () => {
    expect(validateClientId(' cli-9 ')).toBe('cli-9')
    expect(codeOf(() => validateClientId(''))).toBe('CLIENT_NOT_FOUND')
  })
})

describe('TC-103-DEBT — debtDirection (règle cahier)', () => {
  const stores = { requestingStoreId: 'A', supplierStoreId: 'B' }
  it('deposit → dette demandeuse (A) → fournisseuse (B)', () => {
    expect(debtDirection('deposit', stores)).toEqual({ debtorStoreId: 'A', creditorStoreId: 'B' })
  })
  it('withdrawal → dette fournisseuse (B) → demandeuse (A)', () => {
    expect(debtDirection('withdrawal', stores)).toEqual({ debtorStoreId: 'B', creditorStoreId: 'A' })
  })
  it('rejette un operationType invalide', () => {
    expect(codeOf(() => debtDirection('x', stores))).toBe('INVALID_OPERATION_TYPE')
  })
})

describe('TC-103-STOCK — supplierStockDelta', () => {
  it('deposit → −amount (le fournisseur envoie le float)', () => {
    expect(supplierStockDelta('deposit', 20000)).toBe(-20000)
  })
  it('withdrawal → +amount (la SIM du fournisseur reçoit le float)', () => {
    expect(supplierStockDelta('withdrawal', 20000)).toBe(20000)
  })
})
