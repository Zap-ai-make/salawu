/**
 * TC-125 — Dettes internes : compensation assistée (front).
 *
 * La débitrice voit, sur une dette, un bouton « Compenser X » dès qu'une créance
 * OPPOSÉE de la MÊME boutique existe (tous réseaux). Un clic déclare une compensation
 * traçable via declareInternalDebtCompensation (créance opposée la plus ancienne,
 * montant = min des deux restes). Un récap « solde net par partenaire » donne le
 * bilan. Côté créancière, une tranche `compensation` se confirme/rejette via les
 * callables compensation dédiés.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

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
// Stock réseau ample : la compensation ne dépend pas du stock, on neutralise le hook.
vi.mock('../../src/hooks/useSimpleNetworkData', () => ({
  useSimpleNetworkData: () => ({ getStock: () => 100000 }),
}))

import StoreInternalDebts from '../../src/pages/store/StoreInternalDebts'

// Ma boutique = store-a. Dette D1 : store-a doit à store-b (Orange).
const myDebt = (over = {}) => ({
  id: 'd1', debtorStoreId: 'store-a', creditorStoreId: 'store-b', creditorStoreName: 'ESAHAF B',
  network: 'Orange', operationType: 'deposit', originalAmount: 20000, remainingAmount: 20000,
  status: 'open', createdAt: new Date('2026-08-09T09:00:00Z'), ...over,
})
// Créance opposée : store-b doit à store-a (réseau libre).
const myCredit = (over = {}) => ({
  id: 'c1', debtorStoreId: 'store-b', creditorStoreId: 'store-a', debtorStoreName: 'ESAHAF B',
  network: 'Moov', operationType: 'withdrawal', originalAmount: 15000, remainingAmount: 15000,
  status: 'open', createdAt: new Date('2026-08-08T09:00:00Z'), ...over,
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

describe('TC-125 — compensation assistée (débitrice)', () => {
  it('propose « Compenser » avec la créance opposée la plus ancienne, tous réseaux', async () => {
    feed({
      debts: [myDebt({ remainingAmount: 20000 })],
      credits: [
        myCredit({ id: 'c1', remainingAmount: 15000, createdAt: new Date('2026-08-01T09:00:00Z') }), // plus ancienne
        myCredit({ id: 'c2', remainingAmount: 8000, createdAt: new Date('2026-08-07T09:00:00Z') }),
      ],
    })
    render(<StoreInternalDebts />)

    const btn = screen.getByRole('button', { name: /Compenser/ })
    // min(20 000, 15 000) = 15 000 (Orange dette × Moov créance : tous réseaux).
    expect(norm(btn.textContent)).toContain('15 000')

    fireEvent.click(btn)
    await waitFor(() => {
      expect(mocks.declareInternalDebtCompensation).toHaveBeenCalledWith(
        expect.objectContaining({ debtId: 'd1', oppositeDebtId: 'c1', amount: 15000, idempotencyKey: 'key-1' }),
      )
    })
  })

  it('sans créance opposée du même partenaire, aucun bouton Compenser', () => {
    feed({
      debts: [myDebt()],
      credits: [myCredit({ id: 'cx', debtorStoreId: 'store-c', debtorStoreName: 'ESAHAF C' })],
    })
    render(<StoreInternalDebts />)
    expect(screen.queryByRole('button', { name: /Compenser/ })).not.toBeInTheDocument()
    // Le remboursement manuel reste disponible.
    expect(screen.getByRole('button', { name: 'Rembourser' })).toBeInTheDocument()
  })

  it('solde net par partenaire = mes dettes − mes créances', () => {
    feed({ debts: [myDebt({ remainingAmount: 20000 })], credits: [myCredit({ remainingAmount: 15000 })] })
    render(<StoreInternalDebts />)
    const card = screen.getByTestId('partner-net-store-b')
    expect(card.textContent).toContain('Vous devez')
    expect(norm(card.textContent)).toContain('5 000') // 20 000 − 15 000
  })
})

describe('TC-125 — compensation assistée (créancière)', () => {
  it('confirme/rejette une tranche compensation via les callables dédiés', async () => {
    // Ici store-a est CRÉANCIÈRE de la dette d7 ; une compensation y est déclarée.
    feed({ credits: [{ id: 'd7', debtorStoreId: 'store-b', creditorStoreId: 'store-a', debtorStoreName: 'ESAHAF B', network: 'Orange', operationType: 'deposit', originalAmount: 9000, remainingAmount: 9000, status: 'open', createdAt: new Date('2026-08-09T09:00:00Z') }] })
    mocks.subscribeDebtSettlements.mockImplementation(({ onUpdate }) => {
      onUpdate?.([{ id: 's1', amount: 9000, method: 'compensation', settlementStatus: 'declared' }])
      return vi.fn()
    })
    render(<StoreInternalDebts />)
    fireEvent.click(screen.getByTestId('credits-card'))

    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }))
    await waitFor(() => {
      expect(mocks.confirmInternalDebtCompensation).toHaveBeenCalledWith({ debtId: 'd7', settlementId: 's1' })
    })
    expect(mocks.confirmInternalDebtSettlement).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Rejeter' }))
    await waitFor(() => {
      expect(mocks.rejectInternalDebtCompensation).toHaveBeenCalledWith(
        expect.objectContaining({ debtId: 'd7', settlementId: 's1' }),
      )
    })
  })
})
