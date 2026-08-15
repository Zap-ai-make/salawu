/**
 * TC-128 — toUserMessage : jamais de texte technique brut à l'écran, message métier préservé.
 *
 * Garantit qu'aucune erreur infra (permission-denied, unavailable, internal…) ne s'affiche
 * telle quelle, tout en gardant les messages métier français des Cloud Functions.
 */

import { describe, it, expect } from 'vitest'
import { toUserMessage } from '../../src/utils/friendlyError.js'

// Fragments techniques/anglais qui ne doivent JAMAIS atteindre l'utilisateur.
const TECH = /firebase|firestore|permission-denied|failed-precondition|unavailable|unauthenticated|internal|undefined|\bnull\b|requires an index/i

describe('TC-128 — toUserMessage', () => {
  it('préserve le message métier français d\'une Cloud Function (details.code)', () => {
    const err = {
      code: 'failed-precondition',
      message: 'Solde réseau insuffisant chez la boutique débitrice pour ce remboursement.',
      details: { code: 'SETTLEMENT_INSUFFICIENT_BALANCE' },
    }
    expect(toUserMessage(err)).toBe('Solde réseau insuffisant chez la boutique débitrice pour ce remboursement.')
  })

  it('permission-denied → message français, aucun fragment technique', () => {
    const out = toUserMessage({ code: 'permission-denied', message: 'Missing or insufficient permissions.' })
    expect(out).toMatch(/permission/i)
    expect(out).not.toMatch(TECH)
  })

  it('unavailable (hors-ligne) → message réseau français', () => {
    const out = toUserMessage({ code: 'unavailable', message: 'The service is currently unavailable.' })
    expect(out).toMatch(/connexion|réseau/i)
    expect(out).not.toMatch(TECH)
  })

  it('unauthenticated → invite à se reconnecter', () => {
    const out = toUserMessage({ code: 'unauthenticated', message: 'Missing or insufficient permissions.' })
    expect(out).toMatch(/reconnect|session/i)
    expect(out).not.toMatch(TECH)
  })

  it('internal / inconnu → message générique français', () => {
    const out = toUserMessage({ code: 'internal', message: 'INTERNAL' })
    expect(out).toBe('Une erreur inattendue s\'est produite.')
    expect(out).not.toMatch(TECH)
  })

  it('erreur nulle / vide → message générique, jamais « undefined »', () => {
    expect(toUserMessage(undefined)).toBe('Une erreur inattendue s\'est produite.')
    expect(toUserMessage(null)).not.toMatch(TECH)
  })
})
