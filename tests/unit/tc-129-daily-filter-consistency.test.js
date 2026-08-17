/**
 * TC-129 — Cohérence « Navigation par jour » ↔ filtre de dates.
 *
 * La carte-jour (DailyPagination) et le filtre du tableau (matchesDateFilter) doivent
 * raisonner dans le MÊME cadran (local). On vérifie que la clé de jour d'une transaction
 * et le filtre {from:key,to:key} matchent bien la transaction — quelle que soit la timezone
 * (tout est en composantes locales, donc indépendant de TZ).
 */

import { describe, it, expect } from 'vitest'
import { localDayKey, parsefrenchDate, matchesDateFilter } from '../../src/utils/helpers.js'

describe('TC-129 — clé de jour locale ↔ matchesDateFilter', () => {
  it('la clé locale d\'une transaction FR matche le filtre {from:key,to:key}', () => {
    const tx = { date: '14/08/2026 10:30' }
    const key = localDayKey(parsefrenchDate(tx.date))
    expect(key).toBe('2026-08-14')
    expect(matchesDateFilter(tx, { from: key, to: key }, false)).toBe(true)
  })

  it('un autre jour ne matche pas', () => {
    const tx = { date: '14/08/2026 10:30' }
    expect(matchesDateFilter(tx, { from: '2026-08-13', to: '2026-08-13' }, false)).toBe(false)
    expect(matchesDateFilter(tx, { from: '2026-08-15', to: '2026-08-15' }, false)).toBe(false)
  })

  it('localDayKey zéro-padde et gère l\'entrée invalide', () => {
    expect(localDayKey(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(localDayKey(null)).toBeNull()
    expect(localDayKey(new Date('invalid'))).toBeNull()
  })
})
