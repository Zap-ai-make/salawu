/**
 * TC-142 — subscribeToHistory : plafonnement optionnel de la fenêtre (perf, LOT C).
 *
 * Caractérise la SEULE modification de comportement : quand un `limit` est fourni,
 * la requête trie par `createdAt` desc et applique `limit` (fenêtre bornée). Sans
 * `limit`, AUCUN tri ni limite → comportement historique STRICTEMENT inchangé
 * (TAOFIC et tout profil sans plafond). Le filtre `storeId` reste toujours présent.
 */

import { describe, it, expect, vi } from 'vitest'

vi.mock('firebase/firestore', () => ({
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => 'TS'),
}))
vi.mock('../../src/config/firebase', () => ({ db: {} }))

import { HistoryService } from '../../src/services/historyService.js'

const makeSvc = () => {
  const subscribeToCollection = vi.fn(() => vi.fn())
  const ctx = { requireActiveStore: () => ({ id: 'store-1' }), subscribeToCollection }
  return { svc: new HistoryService({ ctx }), subscribeToCollection }
}

const optionsOf = (spy) => spy.mock.calls[0][2]

describe('TC-142 — subscribeToHistory : fenêtre bornée', () => {
  it('sans limite → aucun orderBy ni limit (TAOFIC / illimité inchangé)', () => {
    const { svc, subscribeToCollection } = makeSvc()
    svc.subscribeToHistory(vi.fn())
    const opts = optionsOf(subscribeToCollection)
    expect(opts.orderByField).toBeUndefined()
    expect(opts.limitCount).toBeUndefined()
    expect(opts.where).toEqual([{ field: 'storeId', operator: '==', value: 'store-1' }])
  })

  it('avec limite → orderBy createdAt desc + limitCount (fenêtre bornée)', () => {
    const { svc, subscribeToCollection } = makeSvc()
    svc.subscribeToHistory(vi.fn(), { limit: 200 })
    const opts = optionsOf(subscribeToCollection)
    expect(opts.orderByField).toBe('createdAt')
    expect(opts.orderDirection).toBe('desc')
    expect(opts.limitCount).toBe(200)
    // Le filtre boutique reste TOUJOURS présent (isolation par boutique).
    expect(opts.where).toContainEqual({ field: 'storeId', operator: '==', value: 'store-1' })
  })

  it('« voir plus » = limite plus grande → nouvelle fenêtre', () => {
    const { svc, subscribeToCollection } = makeSvc()
    svc.subscribeToHistory(vi.fn(), { limit: 400 })
    expect(optionsOf(subscribeToCollection).limitCount).toBe(400)
  })
})
