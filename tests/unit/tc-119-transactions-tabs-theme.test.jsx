/**
 * TC-119 — Les trois onglets de Transactions partagent le tableau teinté.
 *
 * Avant : « Non Terminées » était teinté par le thème mais gardait un quadrillage
 * `border-green-300` codé en dur ; « Mes envois au dealer » avait un entête
 * `bg-green-50/70` tout aussi codé en dur ; Collaborations n'avait pas de tableau
 * du tout. Sur une marque orange (ESAHAF), les trois écrans du même onglet ne se
 * ressemblaient pas et deux d'entre eux affichaient du vert.
 *
 * Ce test rend les trois surfaces sous un thème orange et vérifie qu'aucune ne
 * réintroduit de couleur codée en dur, et que chacune rend bien un tableau —
 * y compris vide.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const ORANGE = { tableHeader: 'bg-orange-100/80 border-orange-300', text: 'text-gray-900' }

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useTransactions: vi.fn(),
  useSimpleNetworkData: vi.fn(),
  subscribeStoreTransfers: vi.fn(),
  subscribeIncomingCollaborations: vi.fn(),
  subscribeOutgoingCollaborations: vi.fn(),
  // Identités STABLES : showToast figure dans les deps de l'effet d'abonnement de
  // DealerTransferForm. Un vi.fn() recréé à chaque rendu relancerait l'effet en
  // boucle jusqu'à épuisement du tas.
  showToast: vi.fn(),
  removeToast: vi.fn(),
}))

vi.mock('../../src/config/firebase', () => ({
  auth: {}, db: {}, functions: {},
  firebaseInfo: { projectId: 'test', isDev: true, useEmulators: false },
  default: {},
}))
vi.mock('../../src/context/ThemeContext.jsx', () => ({ useTheme: () => ({ themeClasses: ORANGE }) }))
vi.mock('../../src/context/AuthContext.jsx', () => ({ useAuth: () => mocks.useAuth() }))
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => mocks.useAuth() }))
vi.mock('../../src/context/transactions.jsx', () => ({ useTransactions: () => mocks.useTransactions() }))
vi.mock('../../src/hooks/useSimpleNetworkData', () => ({
  useSimpleNetworkData: () => mocks.useSimpleNetworkData(),
}))
vi.mock('../../src/hooks/useToast', () => ({
  useToast: () => ({ toasts: [], showToast: mocks.showToast, removeToast: mocks.removeToast }),
}))
vi.mock('../../src/services/storeTransferService', () => ({
  createStoreDealerTransfer: vi.fn(),
  subscribeStoreTransfers: mocks.subscribeStoreTransfers,
}))
vi.mock('../../src/services/settlementService.js', () => ({
  generateIdempotencyKey: () => 'key-1',
}))
vi.mock('../../src/services/collaborationService', () => ({
  subscribeIncomingCollaborations: mocks.subscribeIncomingCollaborations,
  subscribeOutgoingCollaborations: mocks.subscribeOutgoingCollaborations,
  confirmStoreCollaboration: vi.fn(),
  rejectStoreCollaboration: vi.fn(),
}))
vi.mock('../../src/components/store/CollaborationFormModal', () => ({ default: () => null }))

import TransactionTable from '../../src/components/transactions/TransactionTable'
import DealerTransferForm from '../../src/components/transactions/DealerTransferForm'
import StoreCollaborations from '../../src/pages/store/StoreCollaborations'

/** Le quadrillage vert et l'entête vert que ce lot supprime. */
const assertNoHardcodedGreen = (container) => {
  const html = container.innerHTML
  expect(html).not.toContain('border-green-300')
  expect(html).not.toContain('bg-green-50/70')
}

/** Toutes les cellules d'un tableau portent la bordure du thème. */
const assertThemedGrid = (container) => {
  const head = container.querySelector('thead tr')
  expect(head.className).toContain('bg-orange-100/80')
  const cells = container.querySelectorAll('th, td')
  expect(cells.length).toBeGreaterThan(0)
  for (const cell of cells) {
    expect(cell.className, cell.textContent).toContain('border-orange-300')
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.useAuth.mockReturnValue({ currentUser: { uid: 'u1' }, userProfile: { storeId: 'store-a', role: 'store_admin' } })
  mocks.useSimpleNetworkData.mockReturnValue({ networkData: { Orange: { stock: 5000, liquidite: 3000 } } })
  mocks.subscribeStoreTransfers.mockImplementation(({ onUpdate }) => { onUpdate?.([]); return vi.fn() })
  mocks.subscribeIncomingCollaborations.mockImplementation(({ onUpdate }) => { onUpdate?.([]); return vi.fn() })
  mocks.subscribeOutgoingCollaborations.mockImplementation(({ onUpdate }) => { onUpdate?.([]); return vi.fn() })
  mocks.useTransactions.mockReturnValue({
    pendingTransactions: [],
    loading: false,
    getActionButtons: () => ({}),
    getTransactionStyles: () => ({ bgColor: '', textColor: '' }),
    addPaymentTranche: vi.fn(),
    addRefundTranche: vi.fn(),
    startEditTransaction: vi.fn(),
  })
})

describe('TC-119 — onglet Transaction client', () => {
  it('teinte tout le quadrillage, y compris la ligne vide', () => {
    const { container } = render(<TransactionTable />)
    assertNoHardcodedGreen(container)
    assertThemedGrid(container)
    expect(container.querySelector('td[colspan="7"]').textContent).toContain('Aucune transaction en attente')
  })

  it('teinte aussi les cellules de données', () => {
    mocks.useTransactions.mockReturnValue({
      pendingTransactions: [{ id: 'd1', type: 'Dépôt', reseau: 'Orange', code: '01', montant: 20000, client: { nom: 'Diallo' } }],
      loading: false,
      getActionButtons: () => ({}),
      getTransactionStyles: () => ({ bgColor: '', textColor: 'text-gray-800' }),
      addPaymentTranche: vi.fn(), addRefundTranche: vi.fn(), startEditTransaction: vi.fn(),
    })
    const { container } = render(<TransactionTable />)
    assertNoHardcodedGreen(container)
    assertThemedGrid(container)
  })
})

describe('TC-119 — onglet Opération dealer', () => {
  it('rend « Mes envois au dealer » en tableau teinté, même vide', () => {
    const { container } = render(<DealerTransferForm />)
    assertNoHardcodedGreen(container)
    const head = container.querySelector('thead tr')
    expect(head.className).toContain('bg-orange-100/80')
    // L'état vide est une ligne du tableau, pas un paragraphe hors tableau.
    const empty = container.querySelector('td[colspan="5"]')
    expect(empty).not.toBeNull()
    expect(empty.textContent).toContain('Aucun envoi pour le moment.')
  })

  it('commence par la date, comme le tableau « Non Terminées »', () => {
    mocks.subscribeStoreTransfers.mockImplementation(({ onUpdate }) => {
      onUpdate?.([{ id: 't1', transferType: 'return_stock', amount: 7000, status: 'pending', createdAt: new Date('2026-08-09T10:30:00Z') }])
      return vi.fn()
    })
    const { container } = render(<DealerTransferForm />)
    const headers = [...container.querySelectorAll('thead th')].map(th => th.textContent)
    expect(headers[0]).toContain('Date')
    expect(headers).toHaveLength(5)
    expect(screen.getByText('7 000 FCFA')).toBeInTheDocument()
  })
})

/** Bascule vers le sous-onglet « Reçues (à exécuter) » (défaut : Mes demandes). */
const showIncoming = () => fireEvent.click(screen.getByTestId('collab-subtab-incoming'))

describe('TC-119 — onglet Collaborations', () => {
  it('rend un tableau teinté par sous-onglet, vide mais visible', () => {
    const { container } = render(<StoreCollaborations embedded />)
    assertNoHardcodedGreen(container)
    assertThemedGrid(container)
    expect(container.querySelectorAll('table')).toHaveLength(1)
    expect(container.querySelector('td[colspan="7"]').textContent).toBe('Aucune demande envoyée.')

    showIncoming()
    assertNoHardcodedGreen(container)
    assertThemedGrid(container)
    expect(container.querySelectorAll('table')).toHaveLength(1)
    expect(container.querySelector('td[colspan="7"]').textContent).toBe('Aucune collaboration en attente.')
  })

  it('rend une ligne par collaboration reçue, avec ses actions', () => {
    mocks.subscribeIncomingCollaborations.mockImplementation(({ onUpdate }) => {
      onUpdate?.([{
        id: 'c1', requestingStoreName: 'ESAHAF POUYTENGA', clientNom: 'Diallo', clientPrenom: 'Ali',
        network: 'Coris', operationType: 'deposit', amount: 20000, status: 'pending',
        createdAt: new Date('2026-08-09T09:00:00Z'),
      }])
      return vi.fn()
    })
    const { container } = render(<StoreCollaborations embedded />)
    showIncoming()
    assertNoHardcodedGreen(container)
    expect(screen.getByText('ESAHAF POUYTENGA')).toBeInTheDocument()
    expect(screen.getByText('Diallo Ali')).toBeInTheDocument()
    expect(screen.getByText('20 000 FCFA')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmer' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rejeter' })).toBeInTheDocument()
    // Le tableau des reçues a 7 colonnes, la ligne vide n'y est plus.
    expect(container.querySelector('table').querySelectorAll('tbody td')).toHaveLength(7)
  })

  it('affiche le statut des demandes sortantes via le badge partagé', () => {
    mocks.subscribeOutgoingCollaborations.mockImplementation(({ onUpdate }) => {
      onUpdate?.([{
        id: 'c2', supplierStoreName: 'ESAHAF KAYA', clientNom: 'Sawadogo', clientPrenom: 'M',
        network: 'Orange', operationType: 'withdrawal', amount: 5000, status: 'confirmed',
        createdAt: new Date('2026-08-09T11:00:00Z'),
      }])
      return vi.fn()
    })
    render(<StoreCollaborations embedded />)
    const badge = screen.getByText('Confirmée')
    // Le composant partagé ui/StatusBadge, pas le doublon local supprimé.
    expect(badge.className).toContain('rounded-full')
    expect(badge.className).toContain('bg-green-100')
  })

  it('rend « — » quand createdAt n\'est pas encore résolu par le serveur', () => {
    mocks.subscribeOutgoingCollaborations.mockImplementation(({ onUpdate }) => {
      onUpdate?.([{
        id: 'c3', supplierStoreName: 'ESAHAF KAYA', clientId: 'cli-9',
        network: 'Orange', operationType: 'deposit', amount: 1000, status: 'pending', createdAt: null,
      }])
      return vi.fn()
    })
    const { container } = render(<StoreCollaborations embedded />)
    const firstCell = container.querySelector('table').querySelector('tbody td')
    expect(firstCell.textContent).toBe('—')
  })
})
