/**
 * TC-098 — Propagation multi-réseaux client (Phase 2), sous profil salawu (6 réseaux).
 *
 * Le profil actif est mocké en salawu → NETWORK_OPTIONS = [Orange, Moov, Telecel, Coris, Sank, Wave].
 * On caractérise les comportements qui n'étaient pas exerçables sous le profil de test (TAOFIC mono) :
 *   • recherche : un client trouvé par un Code agent non-Orange et par un Numéro agent ;
 *   • anti-doublon addClient : par réseau (doublon Moov rejeté ; même code sur 2 réseaux ≠ doublon) ;
 *   • Excel : « Code agent Moov » → client.moov ; « Numéro agent Wave » → numerosAgent.wave.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Profil actif = salawu (6 réseaux). NETWORK_OPTIONS/branding en dérivent à l'import.
vi.mock('../../src/config/activeClientProfile.js', () => ({
  activeProfile: {
    id: 'salawu',
    networks: { enabled: ['Orange', 'Moov', 'Telecel', 'Coris', 'Sank', 'Wave'] },
    transactions: { types: ['Dépôt', 'Retrait'], paymentMethods: ['Orange Money', 'Wave', 'Cash'] },
  },
}))

// Mocks Firebase (nécessaires pour importer FirestoreService)
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), doc: vi.fn(), getDoc: vi.fn(), addDoc: vi.fn(), setDoc: vi.fn(),
  updateDoc: vi.fn(), deleteDoc: vi.fn(), onSnapshot: vi.fn(() => vi.fn()), query: vi.fn(),
  orderBy: vi.fn(), where: vi.fn(), getDocs: vi.fn(), limit: vi.fn(), startAfter: vi.fn(),
  writeBatch: vi.fn(), runTransaction: vi.fn(), serverTimestamp: vi.fn(() => 'ts'),
}))
vi.mock('firebase/auth', () => ({ getAuth: vi.fn(), connectAuthEmulator: vi.fn() }))
vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})), setLogLevel: vi.fn(), getApp: vi.fn() }))
vi.mock('../../src/config/firebase', () => ({ db: {}, auth: {}, firebaseInfo: {}, default: {} }))
vi.mock('../../src/config/clientIsolation', () => ({
  CLIENT_ID: 'salawu',
  getStorageKey: vi.fn((key) => `salawu_${key}`),
  getFirestoreCollectionPath: vi.fn((name) => name),
}))
vi.mock('../../src/utils/cacheManager', () => ({
  default: {
    setFetchFunction: vi.fn(), get: vi.fn(() => null), set: vi.fn(), invalidate: vi.fn(),
    generateKey: vi.fn(() => 'k'), clear: vi.fn(), invalidateCollection: vi.fn(),
  },
  cacheUtils: { invalidatePattern: vi.fn(), invalidateRelated: vi.fn() },
}))

import { useClientsFilter } from '../../src/hooks/useClientsFilter'
import { parseWorksheetRows } from '../../src/utils/excelUtils.js'
import { FirestoreService } from '../../src/services/firestore.js'
import { FIRESTORE_CONFIG } from '../../src/constants/firestoreConstants.js'

// ── Recherche multi-réseaux ────────────────────────────────────────────────────
describe('TC-098-FILTRE — recherche par code/numéro de n\'importe quel réseau', () => {
  const CLIENTS = [
    { id: '1', nom: 'Ba', prenom: 'X', moov: 'MV-100' },
    { id: '2', nom: 'Sy', prenom: 'Y', wave: 'WV-9', numerosAgent: { wave: '77123456' } },
    { id: '3', nom: 'Zoe' }, // champs réseau absents → pas de plantage
  ]
  const filterWith = (term) => {
    const { result } = renderHook(() => useClientsFilter(CLIENTS))
    act(() => result.current.setSearchTerm(term))
    return result.current.filteredClients.map(c => c.id)
  }

  it('trouve par un Code agent Moov', () => expect(filterWith('mv-100')).toEqual(['1']))
  it('trouve par un Numéro agent Wave', () => expect(filterWith('77123456')).toEqual(['2']))
  it('ne plante pas sur champs absents', () => expect(filterWith('zoe')).toEqual(['3']))
})

// ── Anti-doublon par réseau ─────────────────────────────────────────────────────
describe('TC-098-DOUBLON — addClient anti-doublon par réseau', () => {
  const STORE = { id: 'store-A', name: 'Boutique A' }
  let service
  beforeEach(() => {
    service = new FirestoreService()
    service.setActiveStore(STORE)
    service.addDocument = vi.fn(async (_c, data) => ({ id: 'new', ...data }))
    service.getCollection = vi.fn(async () => [])
  })

  it('rejette un doublon sur un réseau non-Orange (Moov)', async () => {
    service.getCollection.mockResolvedValueOnce([{ id: 'existing' }])
    await expect(
      service.addClient({ nom: 'Ba', prenom: 'X', moov: 'MV-100' }),
    ).rejects.toThrow(/Moov/i)
    expect(service.addDocument).not.toHaveBeenCalled()
  })

  it('rejette un doublon Orange (chemin legacy) avec le réseau nommé', async () => {
    service.getCollection.mockResolvedValueOnce([{ id: 'existing' }])
    await expect(
      service.addClient({ nom: 'Ba', prenom: 'X', orange: 'AG-1' }),
    ).rejects.toThrow(/Orange/i)
    expect(service.addDocument).not.toHaveBeenCalled()
  })

  it('le contrôle Moov filtre sur le champ `moov` + registeredStoreId', async () => {
    await service.addClient({ nom: 'Ba', prenom: 'X', moov: 'MV-100' })
    const [, options] = service.getCollection.mock.calls[0]
    expect(options.where).toEqual(expect.arrayContaining([
      { field: 'moov', operator: '==', value: 'MV-100' },
      { field: 'registeredStoreId', operator: '==', value: 'store-A' },
    ]))
  })

  it('même code sur deux réseaux différents ≠ doublon (2 requêtes ciblées, insertion OK)', async () => {
    await service.addClient({ nom: 'Ba', prenom: 'X', moov: 'CODE-X', wave: 'CODE-X' })
    expect(service.getCollection).toHaveBeenCalledTimes(2) // une requête par réseau renseigné
    expect(service.addDocument).toHaveBeenCalledTimes(1)
  })

  it('stocke les codes normalisés (trim) par réseau', async () => {
    await service.addClient({ nom: 'Ba', prenom: 'X', wave: '  WV-1  ' })
    expect(service.addDocument).toHaveBeenCalledWith(
      FIRESTORE_CONFIG.COLLECTIONS.CLIENTS,
      expect.objectContaining({ wave: 'WV-1', registeredStoreId: 'store-A' }),
    )
  })
})

// ── Import Excel par réseau ─────────────────────────────────────────────────────
describe('TC-098-EXCEL — import « Code agent ‹Réseau› » / « Numéro agent ‹Réseau› »', () => {
  it('mappe Code agent Moov → client.moov et Numéro agent Wave → numerosAgent.wave', () => {
    const headers = ['Nom', 'Prénom', 'Code agent Moov', 'Numéro agent Wave']
    const row = ['NIKIEMA', 'Salif', 'MV-100', '77555000']
    const result = parseWorksheetRows([headers, row])
    expect(result.success).toBe(true)
    const c = result.clients[0]
    expect(c.moov).toBe('MV-100')
    expect(c.numerosAgent).toEqual({ wave: '77555000' })
  })

  it('legacy « Numéro agent / Code agent » → client.orange (compat)', () => {
    const headers = ['Nom', 'Prénom', 'Numéro agent / Code agent']
    const row = ['NIKIEMA', 'Salif', 'AG-1']
    const result = parseWorksheetRows([headers, row])
    expect(result.clients[0].orange).toBe('AG-1')
  })
})
