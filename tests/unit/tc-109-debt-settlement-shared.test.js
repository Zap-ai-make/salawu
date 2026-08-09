/**
 * TC-109 — Helpers purs du règlement de dette (functions/src/collaborations/debtShared.js).
 * Vague 2, LOT 7. Aucune I/O. Erreurs = DealerRequestError.
 */

import { describe, it, expect } from 'vitest'
import {
  SETTLEMENT_METHODS,
  validateDebtId,
  validateSettlementId,
  validateSettlementMethod,
  validateSettlementAmount,
  validateIdempotencyKey,
  deterministicSettlementId,
} from '../../functions/src/collaborations/debtShared.js'

const codeOf = (fn) => { try { fn(); return null } catch (e) { return e.code } }

describe('TC-109 — validations règlement de dette', () => {
  it('méthodes = les 5 attendues', () => {
    expect([...SETTLEMENT_METHODS].sort()).toEqual(['compensation', 'depot_bancaire', 'especes', 'retour_stock', 'transfert'])
  })

  it('validateSettlementMethod accepte/rejette', () => {
    expect(validateSettlementMethod('especes')).toBe('especes')
    expect(codeOf(() => validateSettlementMethod('paypal'))).toBe('INVALID_SETTLEMENT_METHOD')
  })

  it('validateSettlementAmount : entier strictement positif', () => {
    expect(validateSettlementAmount(5000)).toBe(5000)
    expect(codeOf(() => validateSettlementAmount(0))).toBe('INVALID_SETTLEMENT_AMOUNT')
    expect(codeOf(() => validateSettlementAmount(10.5))).toBe('INVALID_SETTLEMENT_AMOUNT')
  })

  it('validateDebtId / validateSettlementId : trim + rejet vide', () => {
    expect(validateDebtId(' d1 ')).toBe('d1')
    expect(codeOf(() => validateDebtId(''))).toBe('INVALID_DEBT_ID')
    expect(validateSettlementId(' s1 ')).toBe('s1')
    expect(codeOf(() => validateSettlementId(''))).toBe('INVALID_SETTLEMENT_ID')
  })

  it('validateIdempotencyKey : 1..100, trim', () => {
    expect(validateIdempotencyKey(' abc ')).toBe('abc')
    expect(codeOf(() => validateIdempotencyKey(''))).toBe('INVALID_IDEMPOTENCY_KEY')
    expect(codeOf(() => validateIdempotencyKey('x'.repeat(101)))).toBe('INVALID_IDEMPOTENCY_KEY')
    expect(codeOf(() => validateIdempotencyKey(42))).toBe('INVALID_IDEMPOTENCY_KEY')
  })

  it('deterministicSettlementId : stable et keyé', () => {
    expect(deterministicSettlementId('d1', 'uidA', 'k1')).toBe('dst_d1_uidA_k1')
  })
})
