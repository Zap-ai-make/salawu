/**
 * TC-126 — Dettes internes : l'espace ne montre QUE l'en-cours.
 *
 * Décision client : ne jamais mélanger l'en-cours et le déjà géré. Les dettes/créances
 * RÉGLÉES quittent cet espace (elles vont dans l'Historique → onglet « Dettes internes »).
 * Ici : les soldées sont masquées et non comptées, il n'y a PLUS de bascule Actives/Soldées,
 * et les cartes parlent un langage simple (« Ce que je dois » / « Ce qu'on me doit »).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'

const ORANGE = { tableHeader: 'bg-orange-100/80 border-orange-300', text: 'text-gray-900' }

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  subscribeMyDebts: vi.fn(),
  subscribeMyCredits: vi.fn(),
  subscribeDebtSettlements: vi.fn(),
  declareInternalDebtSettlement: vi.fn(() => Promise.resolve({})),
  confirmInternalDebtSettlement: vi.fn(() => Promise.resolve({})),
  rejectInternalDebtSettlement: vi.fn(() => Promise.resolve({})),
  declareInternalDebtCompensation: vi.fn(() => Promise.resolve({})),
  confirmInternalDebtCompensation: vi.fn(() => Promise.resolve({})),
  rejectInternalDebtCompensation: vi.fn(() => Promise.resolve({})),
}))

vi.mock('../../src/config/firebase', () => ({
  auth: {}, db: {}, functions: {},
  firebaseInfo: { projectId: 'test', isDev: true, useEmulators: false },
  default: {},
}))
vi.mock('../../src/context/ThemeContext.jsx', () => ({ useTheme: () => ({ themeClasses: ORANGE }) }))
vi.mock('../../src/context/AuthContext.jsx', () => ({ useAuth: () => mocks.useAuth() }))
vi.mock('../../src/services/collaborationService', () => ({
  subscribeMyDebts: mocks.subscribeMyDebts,
  subscribeMyCredits: mocks.subscribeMyCredits,
  subscribeDebtSettlements: mocks.subscribeDebtSettlements,
  declareInternalDebtSettlement: mocks.declareInternalDebtSettlement,
  confirmInternalDebtSettlement: mocks.confirmInternalDebtSettlement,
  rejectInternalDebtSettlement: mocks.rejectInternalDebtSettlement,
  declareInternalDebtCompensation: mocks.declareInternalDebtCompensation,
  confirmInternalDebtCompensation: mocks.confirmInternalDebtCompensation,
  rejectInternalDebtCompensation: mocks.rejectInternalDebtCompensation,
  generateIdempotencyKey: () => 'key-1',
}))

import StoreInternalDebts from '../../src/pages/store/StoreInternalDebts'

const debt = (id, over = {}) => ({
  id, creditorStoreName: 'ESAHAF OUAGA', debtorStoreName: 'ESAHAF POUYTENGA',
  creditorStoreId: 'store-b', debtorStoreId: 'store-a',
  network: 'Coris', operationType: 'deposit', originalAmount: 20000, remainingAmount: 20000,
  status: 'open', createdAt: new Date('2026-08-09T09:00:00Z'), ...over,
})
const feed = ({ debts = [], credits = [] } = {}) => {
  mocks.subscribeMyDebts.mockImplementation(({ onUpdate }) => { onUpdate?.(debts); return vi.fn() })
  mocks.subscribeMyCredits.mockImplementation(({ onUpdate }) => { onUpdate?.(credits); return vi.fn() })
}
const norm = (s) => s.replace(/\s/g, ' ')

beforeEach(() => {
  vi.clearAllMocks()
  mocks.useAuth.mockReturnValue({ userProfile: { storeId: 'store-a', role: 'store_admin' } })
  mocks.subscribeDebtSettlements.mockImplementation(({ onUpdate }) => { onUpdate?.([]); return vi.fn() })
  feed()
})

describe('TC-126 — l\'espace ne montre que l\'en-cours', () => {
  it('une dette réglée est masquée et non comptée dans la carte', () => {
    feed({ debts: [
      debt('d1', { remainingAmount: 20000, creditorStoreId: 'store-b', creditorStoreName: 'ESAHAF ACTIVE' }),
      debt('d2', { status: 'settled', remainingAmount: 0, creditorStoreId: 'store-c', creditorStoreName: 'ESAHAF SOLDEE' }),
    ] })
    render(<StoreInternalDebts />)

    const table = screen.getByRole('table')
    expect(within(table).getByText('ESAHAF ACTIVE')).toBeInTheDocument()
    expect(within(table).queryByText('ESAHAF SOLDEE')).not.toBeInTheDocument()

    // La carte compte 1 ligne en cours (pas 2) ; plus aucune mention « soldée » ici.
    const card = norm(screen.getByTestId('debts-card').textContent)
    expect(card).toContain('20 000 FCFA')
    expect(card).toContain('1 ligne')
    expect(card).not.toContain('soldée')
    expect(card).not.toContain('2 lignes')
  })

  it('plus de bascule Actives / Soldées', () => {
    feed({ debts: [
      debt('d1'),
      debt('d2', { status: 'settled', remainingAmount: 0, creditorStoreId: 'store-c' }),
    ] })
    render(<StoreInternalDebts />)
    expect(screen.queryByTestId('settled-toggle')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Soldées/ })).not.toBeInTheDocument()
  })

  it('un nom de boutique manquant n\'affiche jamais l\'id (repli neutre)', () => {
    feed({ debts: [debt('d1', { creditorStoreName: undefined, creditorStoreId: 'store-SECRET-id' })] })
    render(<StoreInternalDebts />)
    // L'id ne doit apparaître nulle part comme texte visible.
    expect(screen.queryByText('store-SECRET-id')).toBeNull()
    const table = screen.getByRole('table')
    expect(within(table).getByText('Boutique inconnue')).toBeInTheDocument()
  })

  it('langage simple : « Ce que je dois » / « Ce qu\'on me doit »', () => {
    feed({ debts: [debt('d1')] })
    render(<StoreInternalDebts />)
    expect(screen.getByText('Ce que je dois')).toBeInTheDocument()
    expect(screen.getByText('Ce qu\'on me doit')).toBeInTheDocument()
  })

  it('une créance en cours garde Confirmer/Rejeter sur une tranche déclarée', () => {
    feed({ credits: [debt('debt-y', { status: 'open', remainingAmount: 20000, debtorStoreName: 'ESAHAF POUYTENGA' })] })
    mocks.subscribeDebtSettlements.mockImplementation(({ onUpdate }) => {
      onUpdate?.([{ id: 's1', amount: 5000, method: 'especes', settlementStatus: 'declared', declaredAt: new Date('2026-08-09T09:00:00Z') }])
      return vi.fn()
    })
    render(<StoreInternalDebts />)
    fireEvent.click(screen.getByTestId('credits-card'))
    expect(screen.getByRole('button', { name: 'Confirmer' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rejeter' })).toBeInTheDocument()
  })

  it('remboursement : bouton désactivé quand les tranches en attente couvrent déjà le reste dû', () => {
    feed({ debts: [debt('d1', { remainingAmount: 5000 })] })
    mocks.subscribeDebtSettlements.mockImplementation(({ onUpdate }) => {
      onUpdate?.([{ id: 's1', amount: 5000, method: 'Cash', settlementStatus: 'declared', declaredAt: new Date('2026-08-09T09:00:00Z') }])
      return vi.fn()
    })
    render(<StoreInternalDebts />)
    expect(screen.getByRole('button', { name: 'Rembourser' })).toBeDisabled()
    expect(screen.getByText('Déjà couvert par les règlements en attente.')).toBeInTheDocument()
  })

  it('remboursement : montant supérieur au reste dû → message, aucun appel réseau', () => {
    feed({ debts: [debt('d1', { remainingAmount: 5000 })] })
    render(<StoreInternalDebts />)
    fireEvent.change(screen.getByLabelText('Montant règlement'), { target: { value: '6000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Rembourser' }))
    expect(mocks.declareInternalDebtSettlement).not.toHaveBeenCalled()
    expect(screen.getByText(/dépasse le reste dû/)).toBeInTheDocument()
  })

  it('remboursement : les tranches en attente sont affichées (« Déjà en attente »)', () => {
    feed({ debts: [debt('d1', { remainingAmount: 5000 })] })
    mocks.subscribeDebtSettlements.mockImplementation(({ onUpdate }) => {
      onUpdate?.([{ id: 's1', amount: 2000, method: 'Cash', settlementStatus: 'declared', declaredAt: new Date('2026-08-09T09:00:00Z') }])
      return vi.fn()
    })
    render(<StoreInternalDebts />)
    expect(screen.getByText((_, el) => el?.tagName === 'P' && /Déjà en attente/.test(el.textContent))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rembourser' })).toBeEnabled()
  })
})
