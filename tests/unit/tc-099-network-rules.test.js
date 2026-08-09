/**
 * TC-099 — Sélecteurs de règles par réseau (src/utils/networkRules.js).
 *
 * Vague 1 « Fondations réseau », LOT 1 (addition pure, aucun câblage).
 * On vérifie :
 *   • repli PERMISSIF quand le profil n'a pas de `networkRules` (comportement
 *     historique préservé → deploy-safe pour tout client non profilé) ;
 *   • les valeurs réelles du profil salawu (cahier des charges ESAHAF) ;
 *   • le profil taofic (mono-réseau) hérite du pilote → règles permissives,
 *     donc aucun changement de comportement pour le client en production.
 *
 * Le profil actif est injecté par `vi.doMock` + import dynamique (pattern tc-098),
 * en chargeant les VRAIS profils depuis config/clients (pas de copie à la main).
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { salawuProfile } from '../../config/clients/salawu.js'
import { taoficProfile } from '../../config/clients/taofic-ajagbe.js'

// Charge les sélecteurs avec un profil actif injecté.
async function loadSelectors(profile) {
  vi.resetModules()
  vi.doMock('../../src/config/activeClientProfile.js', () => ({ activeProfile: profile }))
  return import('../../src/utils/networkRules.js')
}

afterEach(() => {
  vi.doUnmock('../../src/config/activeClientProfile.js')
  vi.resetModules()
})

describe('TC-099-REPLI — profil sans networkRules → tout permissif (historique)', () => {
  const legacyProfile = { id: 'legacy', networks: { enabled: ['Orange'] } } // pas de networkRules

  it('supplyMode = dealer par défaut', async () => {
    const s = await loadSelectors(legacyProfile)
    expect(s.networkSupplyMode('Orange')).toBe('dealer')
  })

  it('toutes les opérations agent autorisées', async () => {
    const s = await loadSelectors(legacyProfile)
    expect(s.isAgentOperationAllowed('Orange', 'deposit')).toBe(true)
    expect(s.isAgentOperationAllowed('Orange', 'withdrawal')).toBe(true)
  })

  it('retour de stock + agents non enregistrés autorisés', async () => {
    const s = await loadSelectors(legacyProfile)
    expect(s.isStockReturnAllowed('Orange')).toBe(true)
    expect(s.areUnregisteredAgentsAllowed('Orange')).toBe(true)
  })

  it('un réseau absent du profil retombe aussi sur le repli permissif', async () => {
    const s = await loadSelectors(legacyProfile)
    expect(s.isStockReturnAllowed('Moov')).toBe(true)
    expect(s.areUnregisteredAgentsAllowed('Moov')).toBe(true)
  })
})

describe('TC-099-SALAWU — valeurs réelles du profil ESAHAF', () => {
  it('Orange = approvisionnement partenaire externe, non enregistrés interdits', async () => {
    const s = await loadSelectors(salawuProfile)
    expect(s.networkSupplyMode('Orange')).toBe('external_partner')
    expect(s.areUnregisteredAgentsAllowed('Orange')).toBe(false)
  })

  it('Moov = dépôt ET retrait client, mais jamais de retour de stock au dealer', async () => {
    const s = await loadSelectors(salawuProfile)
    expect(s.isAgentOperationAllowed('Moov', 'deposit')).toBe(true)
    expect(s.isAgentOperationAllowed('Moov', 'withdrawal')).toBe(true)
    expect(s.isStockReturnAllowed('Moov')).toBe(false)
  })

  it('non enregistrés : autorisés Moov + Wave, interdits Telecel/Coris/Sank', async () => {
    const s = await loadSelectors(salawuProfile)
    expect(s.areUnregisteredAgentsAllowed('Moov')).toBe(true)
    expect(s.areUnregisteredAgentsAllowed('Wave')).toBe(true)
    expect(s.areUnregisteredAgentsAllowed('Telecel')).toBe(false)
    expect(s.areUnregisteredAgentsAllowed('Coris')).toBe(false)
    expect(s.areUnregisteredAgentsAllowed('Sank')).toBe(false)
  })

  it('les réseaux dealer (hors Moov) gardent dépôt + retrait', async () => {
    const s = await loadSelectors(salawuProfile)
    for (const net of ['Telecel', 'Coris', 'Sank', 'Wave']) {
      expect(s.networkSupplyMode(net)).toBe('dealer')
      expect(s.isAgentOperationAllowed(net, 'withdrawal')).toBe(true)
    }
  })
})

describe('TC-099-TAOFIC — client en production inchangé (règles permissives héritées)', () => {
  it('Orange = permissif (dealer, dépôt+retrait, retour + non enregistrés OK)', async () => {
    const s = await loadSelectors(taoficProfile)
    expect(s.networkSupplyMode('Orange')).toBe('dealer')
    expect(s.isAgentOperationAllowed('Orange', 'deposit')).toBe(true)
    expect(s.isAgentOperationAllowed('Orange', 'withdrawal')).toBe(true)
    expect(s.isStockReturnAllowed('Orange')).toBe(true)
    expect(s.areUnregisteredAgentsAllowed('Orange')).toBe(true)
  })
})
