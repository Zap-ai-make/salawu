/**
 * TC-164 — Les migrations localStorage héritées n'écrivent plus dans Firestore.
 *
 * Troisième instance de la classe de défaut traitée en TC-162 / TC-163, et la
 * seule qui écrivait côté serveur.
 *
 * `STORAGE_KEYS.CLIENTS`, `PENDING_TRANSACTIONS` et `COMPLETED_TRANSACTIONS`
 * (src/constants/index.js) sont indexées par CLIENT, jamais par boutique. Les
 * providers les passaient à `firestoreService.migrateLocalStorageData(...)`, qui
 * écrit dans la boutique ACTIVE : un poste portant de vieilles données les
 * versait dans la première boutique à s'y connecter.
 *
 * Ces blobs hérités ne portent aucune information de boutique : ils ne sont donc
 * attribuables à aucune. La migration automatique est retirée — sans toucher aux
 * clés, pour ne rien détruire : les données restent lisibles dans le navigateur.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { createContext } from 'react'
import { render, cleanup, waitFor } from '@testing-library/react'

const STORE_ID = 'store-boulsa'

let AuthContext
let firestoreService
let STORAGE_KEYS
let Provider

/** Service permissif : tout accès inconnu devient un espion neutre. */
function makeFirestoreService() {
  const base = {
    migrateLocalStorageData: vi.fn(() => Promise.resolve(true)),
  }
  return new Proxy(base, {
    get(target, prop) {
      if (!(prop in target)) {
        // Les abonnements renvoient leur fonction de désabonnement.
        target[prop] = vi.fn(() => vi.fn())
      }
      return target[prop]
    },
  })
}

async function loadProvider(modulePath, exportName) {
  vi.resetModules()

  AuthContext = createContext(null)
  firestoreService = makeFirestoreService()

  vi.doMock('../../src/context/AuthContext', () => ({ AuthContext }))
  vi.doMock('../../src/services/firestore', () => ({ firestoreService }))
  vi.doMock('../../src/services/settlementService', () => ({
    addTransactionPayment: vi.fn(),
    addTransactionRefund: vi.fn(),
  }))

  const mod = await import(modulePath)
  const constants = await import('../../src/constants/index.js')
  STORAGE_KEYS = constants.STORAGE_KEYS
  Provider = mod[exportName]
}

function mount() {
  return render(
    <AuthContext.Provider
      value={{
        currentUser: { uid: 'uid-1' },
        userProfile: { storeId: STORE_ID },
        activeStore: { id: STORE_ID },
        loading: false,
      }}
    >
      <Provider>
        <div data-testid="enfant" />
      </Provider>
    </AuthContext.Provider>,
  )
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.resetModules()
})

describe('TC-164 — migrations héritées neutralisées', () => {
  it('ClientsProvider ne verse pas les clients hérités dans la boutique active', async () => {
    await loadProvider('../../src/context/ClientsContext.jsx', 'ClientsProvider')

    const legacy = JSON.stringify([{ nom: 'Ouedraogo', prenom: 'Awa' }])
    localStorage.setItem(STORAGE_KEYS.CLIENTS, legacy)

    mount()
    await waitFor(() => expect(firestoreService.subscribeToClients).toHaveBeenCalled())

    expect(firestoreService.migrateLocalStorageData).not.toHaveBeenCalled()
    // Aucune destruction : le blob hérité reste intact dans le navigateur.
    expect(localStorage.getItem(STORAGE_KEYS.CLIENTS)).toBe(legacy)
  })

  it('TransactionsProvider ne verse pas les transactions héritées dans la boutique active', async () => {
    await loadProvider('../../src/context/transactions.jsx', 'TransactionsProvider')

    const pending = JSON.stringify([{ montant: 5000, statut: 'Non Terminées' }])
    const completed = JSON.stringify([{ montant: 8000, statut: 'Terminées' }])
    localStorage.setItem(STORAGE_KEYS.PENDING_TRANSACTIONS, pending)
    localStorage.setItem(STORAGE_KEYS.COMPLETED_TRANSACTIONS, completed)

    mount()
    await waitFor(() => expect(firestoreService.subscribeToDrafts).toHaveBeenCalled())

    expect(firestoreService.migrateLocalStorageData).not.toHaveBeenCalled()
    expect(localStorage.getItem(STORAGE_KEYS.PENDING_TRANSACTIONS)).toBe(pending)
    expect(localStorage.getItem(STORAGE_KEYS.COMPLETED_TRANSACTIONS)).toBe(completed)
  })
})
