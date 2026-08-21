/**
 * TC-141 — dedupById : déduplication O(n) par `id`.
 *
 * Remplace le motif O(n²) `filter((x,i,a) => a.findIndex(...) === i)` utilisé dans
 * les contextes transactions/clients (recalculé à chaque snapshot Firestore).
 * Caractérise la sémantique EXACTE de l'ancien code : conserver la PREMIÈRE
 * occurrence et l'ordre d'origine.
 */

import { describe, it, expect } from 'vitest'
import { dedupById } from '../../src/utils/helpers.js'

describe('TC-141 — dedupById', () => {
  it('liste vide → liste vide', () => {
    expect(dedupById([])).toEqual([])
  })

  it('sans doublon → inchangé (même ordre)', () => {
    const a = { id: '1', v: 'a' }
    const b = { id: '2', v: 'b' }
    const c = { id: '3', v: 'c' }
    expect(dedupById([a, b, c])).toEqual([a, b, c])
  })

  it('doublons → conserve la PREMIÈRE occurrence et l’ordre', () => {
    const first = { id: '1', v: 'first' }
    const dupe = { id: '1', v: 'second' }
    const other = { id: '2', v: 'x' }
    const out = dedupById([first, dupe, other])
    expect(out).toEqual([first, other])
    expect(out[0].v).toBe('first') // pas 'second'
  })

  it('parité avec l’ancien filter(findIndex===index)', () => {
    const list = [
      { id: 'a', n: 1 }, { id: 'b', n: 2 }, { id: 'a', n: 3 },
      { id: 'c', n: 4 }, { id: 'b', n: 5 },
    ]
    const legacy = list.filter((x, i, arr) => arr.findIndex((y) => y.id === x.id) === i)
    expect(dedupById(list)).toEqual(legacy)
  })
})
