/**
 * TC-093 — Caractérisation : constantes figées du profil client ESAHAF (« salawu »).
 *
 * Façon tc-083, mais côté PROFIL (indépendant de VITE_CLIENT_ID, qui reste
 * taofic_ajagbe en environnement de test) : on résout directement le profil
 * « salawu » et on VERROUILLE ses drapeaux déclaratifs. Objectif : garantir qu'un
 * futur changement ne fasse pas dériver le comportement de ce nouveau client —
 * en particulier le circuit DEALER MULTI-RÉSEAUX (cœur de la mise en service).
 *
 * Rappels métier verrouillés ici :
 *   • boutique = 5 réseaux ; dealer = 4 réseaux (Orange EXCLU du circuit dealer,
 *     le client n'étant que sous-dealer Orange, ravitaillé par un fournisseur externe) ;
 *   • sans Crédit, les 6 méthodes de règlement, édition des soldes masquée (false).
 */

import { describe, it, expect } from 'vitest'
import { resolveProfile } from '../../config/clients/index.js'

const profile = resolveProfile('salawu')

describe('TC-093 — Profil ESAHAF (« salawu ») : constantes figées', () => {
  it('résolution normalisée : « Salawu » / « salawu » → même profil', () => {
    expect(resolveProfile('Salawu')).toBe(profile)
    expect(resolveProfile('SALAWU')).toBe(profile)
  })

  it('identité', () => {
    expect(profile.id).toBe('salawu')
    expect(profile.label).toBe('ESAHAF')
    expect(profile.firebaseProject).toBe('salawu-fa726')
  })

  it('branding', () => {
    expect(profile.branding.appName).toBe('ESAHAF')
    expect(profile.branding.pwaName).toBe('ESAHAF')
    expect(profile.branding.theme).toBe('orange')
  })

  it('réseaux boutique = les 6 (Wave inclus)', () => {
    expect(profile.networks.enabled).toEqual(['Orange', 'Moov', 'Telecel', 'Coris', 'Sank', 'Wave'])
  })

  it('dealer MULTI-RÉSEAUX = 5 réseaux (Wave inclus), Orange exclu', () => {
    expect(profile.dealer.enabled).toBe(true)
    expect(profile.dealer.networks).toEqual(['Moov', 'Telecel', 'Coris', 'Sank', 'Wave'])
    expect(profile.dealer.networks).not.toContain('Orange')
    expect(profile.dealer.networks.length).toBeGreaterThan(1) // branches IS_DEALER_MULTI_NETWORK LIVE
  })

  it('transactions : sans Crédit, toutes les méthodes de règlement (Wave incluse)', () => {
    expect(profile.transactions.types).toEqual(['Dépôt', 'Retrait'])
    expect(profile.transactions.paymentMethods).toEqual([
      'Orange Money', 'Moov Money', 'Telecel Money', 'Coris Money', 'Sank Money', 'Wave', 'Cash',
    ])
  })

  it('édition des soldes par la boutique désactivée', () => {
    expect(profile.cashier.canEditBalances).toBe(false)
  })

  it('fuseau horaire d’affichage', () => {
    expect(profile.regional.timezone).toBe('Africa/Ouagadougou')
  })
})
