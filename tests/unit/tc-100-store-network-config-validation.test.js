/**
 * TC-100 — Validation pure de la Config Boutique × Réseau
 * (functions/src/storeNetworkConfig/shared.js).
 *
 * Vague 1, LOT 3. Helpers purs (aucune I/O). On verrouille :
 *   • validateStoreId : rejette vide / espaces ;
 *   • validateSystemManagerProfile : exige system_manager actif ;
 *   • validateNetworkConfigMap : liste blanche réseaux, forme des entrées,
 *     supplyMode contraint, drapeaux booléens, rejet des clés parasites.
 * Toute erreur = DealerRequestError (code métier), jamais HttpsError.
 */

import { describe, it, expect } from 'vitest'
import {
  validateStoreId,
  validateSystemManagerProfile,
  validateNetworkConfigMap,
  SUPPORTED_NETWORKS,
} from '../../functions/src/storeNetworkConfig/shared.js'

const codeOf = (fn) => {
  try { fn(); return null } catch (e) { return e.code }
}

describe('TC-100-STOREID — validateStoreId', () => {
  it('accepte un id valide', () => {
    expect(validateStoreId('esahaf-pouytenga-tAgvTQ')).toBe('esahaf-pouytenga-tAgvTQ')
  })
  it('rejette vide / non-string / espaces', () => {
    expect(codeOf(() => validateStoreId(''))).toBe('INVALID_STORE_ID')
    expect(codeOf(() => validateStoreId('   '))).toBe('INVALID_STORE_ID')
    expect(codeOf(() => validateStoreId(' store-A'))).toBe('INVALID_STORE_ID')
    expect(codeOf(() => validateStoreId(42))).toBe('INVALID_STORE_ID')
    expect(codeOf(() => validateStoreId(null))).toBe('INVALID_STORE_ID')
  })
})

describe('TC-100-ROLE — validateSystemManagerProfile', () => {
  it('accepte system_manager actif', () => {
    expect(() => validateSystemManagerProfile({ role: 'system_manager', active: true })).not.toThrow()
  })
  it('rejette rôle non gérant (dealer, store_admin)', () => {
    expect(codeOf(() => validateSystemManagerProfile({ role: 'dealer', active: true }))).toBe('ROLE_FORBIDDEN')
    expect(codeOf(() => validateSystemManagerProfile({ role: 'store_admin', active: true }))).toBe('ROLE_FORBIDDEN')
  })
  it('rejette compte inactif', () => {
    expect(codeOf(() => validateSystemManagerProfile({ role: 'system_manager', active: false }))).toBe('PROFILE_INACTIVE')
  })
  it('rejette profil absent', () => {
    expect(codeOf(() => validateSystemManagerProfile(null))).toBe('PROFILE_NOT_FOUND')
  })
})

describe('TC-100-MAP — validateNetworkConfigMap', () => {
  const validEntry = { operates: true, supplyMode: 'dealer', isSupplied: true, isProvider: false }

  it('accepte et normalise une carte valide (uniquement les 4 champs)', () => {
    const out = validateNetworkConfigMap({
      Moov: { ...validEntry },
      Orange: { operates: true, supplyMode: 'external_partner', isSupplied: false, isProvider: true },
    })
    expect(out).toEqual({
      Moov: { operates: true, supplyMode: 'dealer', isSupplied: true, isProvider: false },
      Orange: { operates: true, supplyMode: 'external_partner', isSupplied: false, isProvider: true },
    })
  })

  it('accepte une carte vide', () => {
    expect(validateNetworkConfigMap({})).toEqual({})
  })

  it('rejette un réseau inconnu', () => {
    expect(codeOf(() => validateNetworkConfigMap({ Mtn: validEntry }))).toBe('INVALID_NETWORK_CONFIG')
  })

  it('rejette une clé parasite dans une entrée', () => {
    expect(codeOf(() => validateNetworkConfigMap({ Moov: { ...validEntry, hacked: 1 } }))).toBe('INVALID_NETWORK_CONFIG')
  })

  it('rejette un supplyMode invalide', () => {
    expect(codeOf(() => validateNetworkConfigMap({ Moov: { ...validEntry, supplyMode: 'bank' } }))).toBe('INVALID_NETWORK_CONFIG')
  })

  it('rejette des drapeaux non booléens', () => {
    expect(codeOf(() => validateNetworkConfigMap({ Moov: { ...validEntry, operates: 'yes' } }))).toBe('INVALID_NETWORK_CONFIG')
  })

  it('rejette une entrée non-objet et une carte non-objet', () => {
    expect(codeOf(() => validateNetworkConfigMap({ Moov: null }))).toBe('INVALID_NETWORK_CONFIG')
    expect(codeOf(() => validateNetworkConfigMap([]))).toBe('INVALID_NETWORK_CONFIG')
    expect(codeOf(() => validateNetworkConfigMap(null))).toBe('INVALID_NETWORK_CONFIG')
  })

  it('SUPPORTED_NETWORKS = les 6 réseaux produit', () => {
    expect(SUPPORTED_NETWORKS).toEqual(['Orange', 'Moov', 'Telecel', 'Coris', 'Sank', 'Wave'])
  })
})
