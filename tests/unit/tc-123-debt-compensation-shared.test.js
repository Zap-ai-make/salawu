/**
 * TC-123 — Helpers purs de la compensation (functions/src/collaborations/debtShared.js).
 * Vague 2, LOT 9. Aucune I/O. Erreurs = DealerRequestError.
 *
 * Comportement protégé :
 *   - validateOppositeDebtPair : D2 doit lier les DEUX mêmes boutiques en sens INVERSE,
 *     TOUS réseaux confondus (décision client : périmètre « même paire, tous réseaux ») ;
 *   - compensableAmount = min des deux restes dus ;
 *   - deterministicCompensationId : id stable, préfixe distinct des règlements.
 */

import { describe, it, expect } from 'vitest'
import {
  validateOppositeDebtPair,
  compensableAmount,
  deterministicCompensationId,
  deterministicMirrorId,
  deterministicSettlementId,
} from '../../functions/src/collaborations/debtShared.js'

const codeOf = (fn) => { try { fn(); return null } catch (e) { return e.code } }

// D1 : A doit à B (dépôt, Orange). D2 : B doit à A (retrait, Moov) → opposée, autre réseau.
const D1 = { debtorStoreId: 'A', creditorStoreId: 'B', network: 'Orange', remainingAmount: 20000 }
const D2 = { debtorStoreId: 'B', creditorStoreId: 'A', network: 'Moov', remainingAmount: 15000 }

describe('TC-123 — validateOppositeDebtPair', () => {
  it('accepte la dette opposée de la même paire, même réseau', () => {
    expect(() => validateOppositeDebtPair(D1, { ...D2, network: 'Orange' })).not.toThrow()
  })

  it('accepte la dette opposée de la même paire, RÉSEAU DIFFÉRENT (tous réseaux)', () => {
    expect(() => validateOppositeDebtPair(D1, D2)).not.toThrow()
  })

  it('rejette une dette de MÊME sens (A→B contre A→B)', () => {
    const sameDir = { debtorStoreId: 'A', creditorStoreId: 'B', remainingAmount: 5000 }
    expect(codeOf(() => validateOppositeDebtPair(D1, sameDir))).toBe('NOT_OPPOSITE_PAIR')
  })

  it('rejette une paire de boutiques différente (B→C)', () => {
    const foreign = { debtorStoreId: 'B', creditorStoreId: 'C', remainingAmount: 5000 }
    expect(codeOf(() => validateOppositeDebtPair(D1, foreign))).toBe('NOT_OPPOSITE_PAIR')
  })

  it('rejette une entrée invalide', () => {
    expect(codeOf(() => validateOppositeDebtPair(D1, null))).toBe('INVALID_OPPOSITE_DEBT')
    expect(codeOf(() => validateOppositeDebtPair(undefined, D2))).toBe('INVALID_OPPOSITE_DEBT')
  })
})

describe('TC-123 — compensableAmount', () => {
  it('= plus petit des deux restes dus', () => {
    expect(compensableAmount(D1, D2)).toBe(15000)
    expect(compensableAmount({ remainingAmount: 3000 }, { remainingAmount: 8000 })).toBe(3000)
  })

  it('tolère les valeurs manquantes (→ 0)', () => {
    expect(compensableAmount({}, D2)).toBe(0)
    expect(compensableAmount(D1, {})).toBe(0)
  })
})

describe('TC-123 — deterministicCompensationId', () => {
  it('id stable et préfixé, distinct du règlement pour la même clé', () => {
    expect(deterministicCompensationId('d1', 'uidA', 'k1')).toBe('dcp_d1_uidA_k1')
    expect(deterministicCompensationId('d1', 'uidA', 'k1'))
      .not.toBe(deterministicSettlementId('d1', 'uidA', 'k1'))
  })
})

describe('TC-123 — deterministicMirrorId', () => {
  it('id de miroir stable, préfixe distinct de dcp_/dst_', () => {
    expect(deterministicMirrorId('d1', 'dcp_d1_uidA_k1')).toBe('comp_d1_dcp_d1_uidA_k1')
    expect(deterministicMirrorId('d1', 's1').startsWith('comp_')).toBe(true)
  })
})
