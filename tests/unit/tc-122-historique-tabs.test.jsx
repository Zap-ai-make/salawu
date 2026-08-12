/**
 * TC-122 — Historique : trois sous-onglets à filtres partagés.
 *
 * L'onglet « Transactions clients » garde son filtrage historique intact ; deux
 * onglets s'ajoutent (Opérations dealer, Collaborations) alimentés par les
 * abonnements existants et filtrés par le MÊME jeu dates/recherche. On verrouille :
 * le montage de chaque source, le partage du filtre de dates jusqu'aux nouveaux
 * onglets, la garde mono-réseau, et la sémantique du util filterHistoryRows.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { filterHistoryRows, matchesDateRange } from '../../src/utils/historyFilter.js'

const ORANGE = { tableHeader: 'bg-orange-100/80 border-orange-300', text: 'text-gray-900' }

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useTransactions: vi.fn(),
  subscribeStoreTransfers: vi.fn(),
  subscribeIncomingCollaborations: vi.fn(),
  subscribeOutgoingCollaborations: vi.fn(),
  subscribeMyDebts: vi.fn(),
  subscribeMyCredits: vi.fn(),
  isMultiNetwork: true,
}))

vi.mock('../../src/config/firebase', () => ({
  auth: {}, db: {}, functions: {},
  firebaseInfo: { projectId: 'test', isDev: true, useEmulators: false },
  default: {},
}))
vi.mock('../../src/context/ThemeContext.jsx', () => ({ useTheme: () => ({ themeClasses: ORANGE }) }))
vi.mock('../../src/context/AuthContext.jsx', () => ({ useAuth: () => mocks.useAuth() }))
vi.mock('../../src/constants/navigation', () => ({
  get IS_MULTI_NETWORK() { return mocks.isMultiNetwork },
  NAV_ITEMS: [], STORE_NAV_ITEMS: [],
}))
vi.mock('../../src/context/transactions.jsx', () => ({ useTransactions: () => mocks.useTransactions() }))
vi.mock('../../src/services/storeTransferService', () => ({
  subscribeStoreTransfers: mocks.subscribeStoreTransfers,
}))
vi.mock('../../src/services/collaborationService', () => ({
  subscribeIncomingCollaborations: mocks.subscribeIncomingCollaborations,
  subscribeOutgoingCollaborations: mocks.subscribeOutgoingCollaborations,
  subscribeMyDebts: mocks.subscribeMyDebts,
  subscribeMyCredits: mocks.subscribeMyCredits,
}))

import Historique from '../../src/pages/Historique.jsx'

const TX = { id: 't1', date: '09/08/2026 10:00', client: { nom: 'Diallo', prenom: 'Ali' }, type: 'Dépôt', reseau: 'Coris', code: '01', montant: 20000, statut: 'Validée' }
const TRANSFER = { id: 'tr1', createdAt: new Date('2026-08-09T09:00:00Z'), transferType: 'return_stock', amount: 7000, status: 'confirmed', network: 'Coris' }
const INC = { id: 'c1', createdAt: new Date('2026-08-08T09:00:00Z'), requestingStoreName: 'ESAHAF POUYTENGA', clientNom: 'Sawadogo', clientPrenom: 'M', network: 'Orange', operationType: 'deposit', amount: 5000, status: 'confirmed' }
const OUT = { id: 'c2', createdAt: new Date('2026-08-07T09:00:00Z'), supplierStoreName: 'ESAHAF KAYA', clientNom: 'Kabore', clientPrenom: 'J', network: 'Moov', operationType: 'withdrawal', amount: 3000, status: 'rejected' }
// Dettes internes RÉGLÉES : store-a débitrice (Dette) et créancière (Créance).
const DEBT_SETTLED = { id: 'idt1', createdAt: new Date('2026-08-06T09:00:00Z'), updatedAt: new Date('2026-08-06T10:00:00Z'), debtorStoreId: 'store-a', creditorStoreId: 'store-x', creditorStoreName: 'ESAHAF DODO', network: 'Coris', operationType: 'deposit', originalAmount: 12000, status: 'settled' }
const CREDIT_SETTLED = { id: 'idt2', createdAt: new Date('2026-08-05T09:00:00Z'), updatedAt: new Date('2026-08-05T10:00:00Z'), debtorStoreId: 'store-y', debtorStoreName: 'ESAHAF ZORGHO', creditorStoreId: 'store-a', network: 'Moov', operationType: 'withdrawal', originalAmount: 7000, status: 'settled' }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.isMultiNetwork = true
  mocks.useAuth.mockReturnValue({ userProfile: { storeId: 'store-a', role: 'store_admin' } })
  mocks.useTransactions.mockReturnValue({
    completedTransactions: [TX],
    getTransactionStyles: () => ({ bgColor: '', textColor: '' }),
    addTransaction: vi.fn(),
  })
  mocks.subscribeStoreTransfers.mockImplementation(({ onUpdate }) => { onUpdate?.([TRANSFER]); return vi.fn() })
  mocks.subscribeIncomingCollaborations.mockImplementation(({ onUpdate }) => { onUpdate?.([INC]); return vi.fn() })
  mocks.subscribeOutgoingCollaborations.mockImplementation(({ onUpdate }) => { onUpdate?.([OUT]); return vi.fn() })
  mocks.subscribeMyDebts.mockImplementation(({ onUpdate }) => { onUpdate?.([DEBT_SETTLED]); return vi.fn() })
  mocks.subscribeMyCredits.mockImplementation(({ onUpdate }) => { onUpdate?.([CREDIT_SETTLED]); return vi.fn() })
})

describe('TC-122 — sous-onglets Historique', () => {
  it('ouvre sur Transactions clients (comportement historique)', () => {
    render(<Historique />)
    // Entête propre à la table client.
    expect(screen.getByText('Email utilisateur')).toBeInTheDocument()
    expect(screen.getByTestId('histo-tab-clients-badge').textContent).toBe('1')
  })

  it('bascule sur Opérations dealer', () => {
    render(<Historique />)
    fireEvent.click(screen.getByRole('button', { name: /Opérations dealer/ }))
    expect(screen.getByText('Retour de stock')).toBeInTheDocument()
    expect(screen.getByText('7 000 FCFA')).toBeInTheDocument()
    // La table client n'est plus montée.
    expect(screen.queryByText('Email utilisateur')).not.toBeInTheDocument()
    expect(screen.getByTestId('histo-tab-dealer-badge').textContent).toBe('1')
  })

  it('Collaborations regroupe entrantes et sortantes', () => {
    render(<Historique />)
    fireEvent.click(screen.getByRole('button', { name: /Collaborations/ }))
    expect(screen.getByText('ESAHAF POUYTENGA')).toBeInTheDocument()
    expect(screen.getByText('ESAHAF KAYA')).toBeInTheDocument()
    expect(screen.getByText('Reçue')).toBeInTheDocument()
    expect(screen.getByText('Envoyée')).toBeInTheDocument()
    expect(screen.getByTestId('histo-tab-collab-badge').textContent).toBe('2')
  })

  it('l\'onglet Dettes internes regroupe dettes et créances réglées', () => {
    render(<Historique />)
    expect(screen.getByTestId('histo-tab-internaldebts-badge').textContent).toBe('2')
    fireEvent.click(screen.getByRole('button', { name: /Dettes internes/ }))
    expect(screen.getByText('ESAHAF DODO')).toBeInTheDocument()
    expect(screen.getByText('ESAHAF ZORGHO')).toBeInTheDocument()
    expect(screen.getByText('Dette')).toBeInTheDocument()
    expect(screen.getByText('Créance')).toBeInTheDocument()
  })

  it('Dettes internes : un partenaire sans nom n\'affiche jamais l\'id', () => {
    const noName = { ...DEBT_SETTLED, id: 'idt5', creditorStoreName: undefined, creditorStoreId: 'store-SECRET' }
    mocks.subscribeMyDebts.mockImplementation(({ onUpdate }) => { onUpdate?.([noName]); return vi.fn() })
    mocks.subscribeMyCredits.mockImplementation(({ onUpdate }) => { onUpdate?.([]); return vi.fn() })
    render(<Historique />)
    fireEvent.click(screen.getByRole('button', { name: /Dettes internes/ }))
    expect(screen.queryByText('store-SECRET')).toBeNull()
    expect(screen.getByText('Boutique inconnue')).toBeInTheDocument()
  })

  it('Dettes internes : n\'affiche que le réglé, une dette « en cours » est exclue', () => {
    const open = { ...DEBT_SETTLED, id: 'idt9', creditorStoreName: 'ESAHAF EN COURS', status: 'open' }
    mocks.subscribeMyDebts.mockImplementation(({ onUpdate }) => { onUpdate?.([DEBT_SETTLED, open]); return vi.fn() })
    render(<Historique />)
    // DEBT_SETTLED + CREDIT_SETTLED comptent ; la dette open non.
    expect(screen.getByTestId('histo-tab-internaldebts-badge').textContent).toBe('2')
    fireEvent.click(screen.getByRole('button', { name: /Dettes internes/ }))
    expect(screen.queryByText('ESAHAF EN COURS')).not.toBeInTheDocument()
  })

  it('n\'affiche que le terminé : les collaborations « En attente » sont exclues', () => {
    const pending = { ...INC, id: 'c9', requestingStoreName: 'ESAHAF EN ATTENTE', status: 'pending' }
    mocks.subscribeIncomingCollaborations.mockImplementation(({ onUpdate }) => { onUpdate?.([INC, pending]); return vi.fn() })
    render(<Historique />)
    // INC (confirmée) + OUT (rejetée) comptent ; la pending non.
    expect(screen.getByTestId('histo-tab-collab-badge').textContent).toBe('2')
    fireEvent.click(screen.getByRole('button', { name: /Collaborations/ }))
    expect(screen.queryByText('ESAHAF EN ATTENTE')).not.toBeInTheDocument()
  })

  it('n\'affiche que le terminé : les opérations dealer « En attente » sont exclues', () => {
    const pending = { ...TRANSFER, id: 'tr9', status: 'pending' }
    mocks.subscribeStoreTransfers.mockImplementation(({ onUpdate }) => { onUpdate?.([TRANSFER, pending]); return vi.fn() })
    render(<Historique />)
    expect(screen.getByTestId('histo-tab-dealer-badge').textContent).toBe('1')
  })

  it('mono-réseau : onglet Collaborations masqué, aucun abonnement collab', () => {
    mocks.isMultiNetwork = false
    render(<Historique />)
    expect(screen.queryByRole('button', { name: /Collaborations/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Dettes internes/ })).not.toBeInTheDocument()
    expect(mocks.subscribeIncomingCollaborations).not.toHaveBeenCalled()
    expect(mocks.subscribeMyDebts).not.toHaveBeenCalled()
    // L'onglet dealer, lui, reste disponible.
    expect(screen.getByRole('button', { name: /Opérations dealer/ })).toBeInTheDocument()
  })

  it('le filtre de dates partagé atteint les nouveaux onglets', () => {
    const { container } = render(<Historique />)
    // Une borne « du » postérieure aux données exclut tout partout.
    const dateFrom = container.querySelector('input[type="date"]')
    fireEvent.change(dateFrom, { target: { value: '2026-12-31' } })
    fireEvent.click(screen.getByRole('button', { name: 'Filtrer' }))

    expect(screen.getByTestId('histo-tab-dealer-badge').textContent).toBe('0')
    expect(screen.getByTestId('histo-tab-collab-badge').textContent).toBe('0')
    expect(screen.getByTestId('histo-tab-internaldebts-badge').textContent).toBe('0')
  })
})

describe('TC-122 — filterHistoryRows', () => {
  const rows = [
    { when: new Date('2026-08-09T09:00:00Z'), search: 'coris retour 7000' },
    { when: new Date('2026-08-05T09:00:00Z'), search: 'moov envoi 3000' },
    { when: null, search: 'sans date' },
  ]

  it('bornes de dates incluses (jour)', () => {
    const r = filterHistoryRows(rows, { from: '2026-08-09', to: '2026-08-09' })
    expect(r).toHaveLength(1)
    expect(r[0].search).toContain('coris')
  })

  it('recherche insensible à la casse', () => {
    expect(filterHistoryRows(rows, { search: 'MOOV' })).toHaveLength(1)
    expect(filterHistoryRows(rows, { search: 'introuvable' })).toHaveLength(0)
  })

  it('sans filtre : tout passe (y compris sans date)', () => {
    expect(filterHistoryRows(rows, {})).toHaveLength(3)
  })

  it('todayOnly exclut les autres jours et les lignes sans date', () => {
    expect(matchesDateRange(new Date(), {}, true)).toBe(true)
    expect(matchesDateRange(new Date('2000-01-01'), {}, true)).toBe(false)
    expect(matchesDateRange(null, {}, true)).toBe(false)
  })
})
