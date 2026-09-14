/**
 * TC-162 — Cloisonnement des soldes réseau par boutique (NetworkConfigContext).
 *
 * Bug constaté en production : une boutique NEUVE (ESAHAF BOULSA) affichait les
 * soldes d'une autre boutique (ESAHAF POUYTENGA) ouverte auparavant dans le même
 * navigateur, et ces montants se gravaient dans son document Firestore.
 *
 * Chaîne : le cache localStorage des soldes était indexé par CLIENT uniquement
 * (`<client>_network_data_v3`), donc partagé par toutes les boutiques du poste ;
 * son contenu servait de valeurs initiales à `ensureNetworkBalances`, qui CRÉE
 * le document `clients/<storeId>/networkBalances/current` quand il est absent.
 *
 * Ces tests caractérisent les deux garanties attendues :
 *   1. une boutique sans document de soldes démarre à ZÉRO, jamais depuis un cache ;
 *   2. le cache local est cloisonné par boutique (ni affichage, ni amorçage croisés).
 *
 * Les tests raisonnent en SCÉNARIOS (monter A, puis monter B) et jamais sur le
 * format de la clé de stockage, qui reste un détail d'implémentation.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { createContext } from 'react'
import { render, screen, cleanup, act, waitFor } from '@testing-library/react'

const STORE_A = 'store-pouytenga'
const STORE_B = 'store-boulsa'

// Relevé réel de la capture POUYTENGA.
const BALANCES_A = {
  Orange:  { stock: 100000, liquidite: 0 },
  Moov:    { stock: 30000,  liquidite: 0 },
  Telecel: { stock: 0,      liquidite: 0 },
  Coris:   { stock: 100000, liquidite: 0 },
  Sank:    { stock: 10000,  liquidite: 0 },
  Wave:    { stock: 100000, liquidite: 534500 },
}

let AuthContext
let firestoreService
let ctxMod

async function loadModule() {
  vi.resetModules()

  AuthContext = createContext(null)
  firestoreService = {
    ensureNetworkBalances: vi.fn(() => Promise.resolve({})),
    subscribeToNetworkBalances: vi.fn(() => vi.fn()),
    setNetworkBalance: vi.fn(() => Promise.resolve({})),
  }

  vi.doMock('../../src/context/AuthContext', () => ({ AuthContext }))
  vi.doMock('../../src/services/firestore', () => ({ firestoreService }))

  ctxMod = await import('../../src/context/NetworkConfigContext.jsx')
}

function Probe() {
  const { networkData } = ctxMod.useNetworkConfig()
  return <div data-testid="probe">{JSON.stringify(networkData)}</div>
}

function mountForStore(storeId) {
  const { NetworkConfigProvider } = ctxMod
  return render(
    <AuthContext.Provider
      value={{
        currentUser: { uid: `uid-${storeId}` },
        userProfile: { storeId },
        activeStore: { id: storeId },
        loading: false,
      }}
    >
      <NetworkConfigProvider>
        <Probe />
      </NetworkConfigProvider>
    </AuthContext.Provider>,
  )
}

function displayedData() {
  return JSON.parse(screen.getByTestId('probe').textContent)
}

/** Rejoue le snapshot Firestore reçu par l'abonnement le plus récent. */
async function emitSnapshot(balances) {
  const calls = firestoreService.subscribeToNetworkBalances.mock.calls
  const onBalances = calls[calls.length - 1][0]
  await act(async () => {
    onBalances(balances)
  })
}

beforeEach(async () => {
  localStorage.clear()
  await loadModule()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.resetModules()
})

describe('TC-162 — soldes réseau : aucune fuite entre boutiques', () => {
  it("une boutique neuve est amorcée à zéro, pas avec le cache d'une autre boutique", async () => {
    // 1. POUYTENGA travaille sur ce navigateur : ses soldes sont mis en cache.
    const first = mountForStore(STORE_A)
    await waitFor(() => expect(firestoreService.subscribeToNetworkBalances).toHaveBeenCalled())
    await emitSnapshot(BALANCES_A)
    expect(displayedData().Orange.stock).toBe(100000)

    // 2. Déconnexion, puis première connexion de BOULSA sur le MÊME navigateur.
    first.unmount()
    firestoreService.ensureNetworkBalances.mockClear()
    firestoreService.subscribeToNetworkBalances.mockClear()

    mountForStore(STORE_B)
    await waitFor(() => expect(firestoreService.ensureNetworkBalances).toHaveBeenCalled())

    // Le document de BOULSA est absent : il sera CRÉÉ avec ces valeurs.
    // Elles doivent être nulles — jamais celles de POUYTENGA.
    const seeded = firestoreService.ensureNetworkBalances.mock.calls[0][0]
    expect(seeded).toEqual(ctxMod.DEFAULT_NETWORK_DATA)
  })

  it("une boutique neuve n'affiche jamais les soldes de la boutique précédente", async () => {
    const first = mountForStore(STORE_A)
    await waitFor(() => expect(firestoreService.subscribeToNetworkBalances).toHaveBeenCalled())
    await emitSnapshot(BALANCES_A)
    first.unmount()

    mountForStore(STORE_B)
    await waitFor(() => expect(firestoreService.ensureNetworkBalances).toHaveBeenCalled())

    // Avant même le premier snapshot, l'écran de BOULSA doit être vide.
    expect(displayedData()).toEqual(ctxMod.DEFAULT_NETWORK_DATA)
  })

  it('chaque boutique retrouve son propre cache hors-ligne', async () => {
    const balancesB = {
      ...ctxMod.DEFAULT_NETWORK_DATA,
      Orange: { stock: 7500, liquidite: 250 },
    }

    const first = mountForStore(STORE_B)
    await waitFor(() => expect(firestoreService.subscribeToNetworkBalances).toHaveBeenCalled())
    await emitSnapshot(balancesB)
    first.unmount()

    // Remontage de la MÊME boutique : son cache lui est restitué immédiatement,
    // avant tout snapshot (repli hors-ligne, comportement conservé).
    mountForStore(STORE_B)
    await waitFor(() => expect(firestoreService.ensureNetworkBalances).toHaveBeenCalled())
    expect(displayedData().Orange).toEqual({ stock: 7500, liquidite: 250 })
  })

  it("le cache d'une boutique ne s'écrit pas sous l'identité d'une autre", async () => {
    const first = mountForStore(STORE_A)
    await waitFor(() => expect(firestoreService.subscribeToNetworkBalances).toHaveBeenCalled())
    await emitSnapshot(BALANCES_A)
    first.unmount()

    // BOULSA se connecte, ne reçoit rien, puis se déconnecte.
    const second = mountForStore(STORE_B)
    await waitFor(() => expect(firestoreService.ensureNetworkBalances).toHaveBeenCalled())
    second.unmount()

    // POUYTENGA revient : son cache doit être intact, non écrasé par les zéros de BOULSA.
    firestoreService.subscribeToNetworkBalances.mockClear()
    mountForStore(STORE_A)
    await waitFor(() => expect(firestoreService.ensureNetworkBalances).toHaveBeenCalled())
    expect(displayedData().Orange.stock).toBe(100000)
  })

  it('un cache hérité de la clé partagée historique est ignoré', async () => {
    // Poste déjà utilisé avant le correctif : la clé partagée par toutes les
    // boutiques du client contient encore les soldes de POUYTENGA.
    const { getStorageKey } = await import('../../src/config/clientIsolation.js')
    localStorage.setItem(getStorageKey('network_data_v3'), JSON.stringify(BALANCES_A))

    mountForStore(STORE_B)
    await waitFor(() => expect(firestoreService.ensureNetworkBalances).toHaveBeenCalled())

    expect(firestoreService.ensureNetworkBalances.mock.calls[0][0]).toEqual(
      ctxMod.DEFAULT_NETWORK_DATA,
    )
    expect(displayedData()).toEqual(ctxMod.DEFAULT_NETWORK_DATA)
  })
})
