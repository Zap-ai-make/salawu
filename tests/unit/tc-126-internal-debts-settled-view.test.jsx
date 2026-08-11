/**
 * TC-126 — Dettes internes : les soldées sortent de la vue active + tranches lisibles.
 *
 * Correctif d'affichage (front only) suite à l'audit : une dette réglée ne doit plus
 * polluer la vue active ni compter comme une ligne active, mais rester consultable via
 * la bascule « Soldées » ; côté créancier, une dette réglée n'offre plus de bouton
 * mort — on montre l'historique des tranches (confirmée/rejetée) en lecture seule.
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

describe('TC-126 — les soldées quittent la vue active', () => {
  it('une dette réglée est masquée en vue active et non comptée dans la carte', () => {
    feed({ debts: [
      debt('d1', { remainingAmount: 20000, creditorStoreId: 'store-b', creditorStoreName: 'ESAHAF ACTIVE' }),
      debt('d2', { status: 'settled', remainingAmount: 0, creditorStoreId: 'store-c', creditorStoreName: 'ESAHAF SOLDEE' }),
    ] })
    render(<StoreInternalDebts />)

    // Vue active par défaut : dans le TABLEAU, seule la dette ouverte s'affiche
    // (le récap net par partenaire, hors tableau, peut citer d'autres noms).
    const table = screen.getByRole('table')
    expect(within(table).getByText('ESAHAF ACTIVE')).toBeInTheDocument()
    expect(within(table).queryByText('ESAHAF SOLDEE')).not.toBeInTheDocument()

    // La carte compte 1 ligne active (pas 2) et rappelle « 1 soldée » ; total = actives.
    const card = norm(screen.getByTestId('debts-card').textContent)
    expect(card).toContain('20 000 FCFA')
    expect(card).toContain('1 ligne')
    expect(card).toContain('1 soldée')
    expect(card).not.toContain('2 lignes')
  })

  it('la bascule « Soldées » révèle la dette réglée', () => {
    feed({ debts: [
      debt('d1', { creditorStoreId: 'store-b', creditorStoreName: 'ESAHAF ACTIVE' }),
      debt('d2', { status: 'settled', remainingAmount: 0, creditorStoreId: 'store-c', creditorStoreName: 'ESAHAF SOLDEE' }),
    ] })
    render(<StoreInternalDebts />)

    expect(screen.getByTestId('settled-toggle')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Soldées/ }))
    const table = screen.getByRole('table')
    expect(within(table).getByText('ESAHAF SOLDEE')).toBeInTheDocument()
    expect(within(table).queryByText('ESAHAF ACTIVE')).not.toBeInTheDocument()
  })

  it('sans dette soldée, aucune bascule', () => {
    feed({ debts: [debt('d1')] })
    render(<StoreInternalDebts />)
    expect(screen.queryByTestId('settled-toggle')).not.toBeInTheDocument()
  })
})

describe('TC-126 — côté créancier : plus de bouton mort, tranches lisibles', () => {
  it('une créance réglée n\'offre plus Confirmer/Rejeter et montre la tranche en lecture seule', () => {
    feed({ credits: [debt('debt-x', { status: 'settled', remainingAmount: 0, debtorStoreName: 'ESAHAF POUYTENGA' })] })
    mocks.subscribeDebtSettlements.mockImplementation(({ onUpdate }) => {
      onUpdate?.([{ id: 's1', amount: 20000, method: 'especes', settlementStatus: 'confirmed', declaredAt: new Date('2026-08-09T09:00:00Z') }])
      return vi.fn()
    })
    render(<StoreInternalDebts />)
    fireEvent.click(screen.getByTestId('credits-card'))
    fireEvent.click(screen.getByRole('button', { name: /Soldées/ }))

    // Aucun bouton d'action sur une créance réglée.
    expect(screen.queryByRole('button', { name: 'Confirmer' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rejeter' })).not.toBeInTheDocument()
    // La tranche confirmée reste tracée (lecture seule).
    expect(screen.getByText(/Confirmé/)).toBeInTheDocument()
  })

  it('une créance active garde Confirmer/Rejeter sur une tranche déclarée (non-régression)', () => {
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
})
