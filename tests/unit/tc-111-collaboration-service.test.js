/**
 * TC-111 — Service front des collaborations (src/services/collaborationService.js).
 * Vague 2, LOT 8. On mocke httpsCallable et vérifie : nom de callable + payload,
 * parsing du montant, et mapping d'erreur par details.code.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({ callable: vi.fn(() => Promise.resolve({ data: { success: true } })) }))

vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn(() => mocks.callable) }))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), query: vi.fn(), where: vi.fn(), orderBy: vi.fn(), limit: vi.fn(), onSnapshot: vi.fn(() => vi.fn()),
}))
vi.mock('../../src/config/firebase', () => ({ functions: {}, db: {} }))

import {
  createStoreCollaboration,
  confirmStoreCollaboration,
  declareInternalDebtSettlement,
  generateIdempotencyKey,
  mapCollaborationError,
} from '../../src/services/collaborationService.js'
import { httpsCallable } from 'firebase/functions'

beforeEach(() => { vi.clearAllMocks() })

describe('TC-111 — commandes', () => {
  it('createStoreCollaboration : parse le montant et appelle le bon callable', async () => {
    await createStoreCollaboration({ clientId: 'cli-1', network: 'Orange', operationType: 'deposit', amount: '20000', supplierStoreId: 'store-B' })
    expect(httpsCallable).toHaveBeenCalledWith({}, 'createStoreCollaboration')
    expect(mocks.callable).toHaveBeenCalledWith({ clientId: 'cli-1', network: 'Orange', operationType: 'deposit', amount: 20000, supplierStoreId: 'store-B' })
  })

  it('createStoreCollaboration : montant invalide → throw sans appel serveur', async () => {
    await expect(createStoreCollaboration({ clientId: 'c', network: 'Orange', operationType: 'deposit', amount: 'abc', supplierStoreId: 'b' })).rejects.toThrow()
    expect(mocks.callable).not.toHaveBeenCalled()
  })

  it('confirmStoreCollaboration : trim + payload', async () => {
    await confirmStoreCollaboration('  col-1 ')
    expect(mocks.callable).toHaveBeenCalledWith({ collaborationId: 'col-1' })
  })

  it('declareInternalDebtSettlement : parse le montant', async () => {
    await declareInternalDebtSettlement({ debtId: 'd1', amount: '5000', method: 'especes', idempotencyKey: 'k1' })
    expect(mocks.callable).toHaveBeenCalledWith({ debtId: 'd1', amount: 5000, method: 'especes', idempotencyKey: 'k1' })
  })
})

describe('TC-111 — divers', () => {
  it('generateIdempotencyKey : chaîne non vide et variable', () => {
    const a = generateIdempotencyKey()
    const b = generateIdempotencyKey()
    expect(typeof a).toBe('string')
    expect(a.length).toBeGreaterThan(0)
    expect(a).not.toBe(b)
  })

  it('mapCollaborationError : mappe details.code → message + code', () => {
    const e = mapCollaborationError({ details: { code: 'INSUFFICIENT_SUPPLIER_BALANCE' } })
    expect(e.code).toBe('INSUFFICIENT_SUPPLIER_BALANCE')
    expect(e.message).toMatch(/insuffisant/i)
  })
})
