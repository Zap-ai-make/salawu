/**
 * TC-121 — Dettes internes : bilan en cartes + tableaux teintés.
 *
 * Avant : liste de cartes-lignes ad hoc, sélecteur en pilules, montants en texte,
 * aucun total. Refonte présentation UNIQUEMENT — les handlers declare/confirm/reject
 * ne changent pas (leur comportement reste couvert par tc-109/tc-110). Ce test
 * verrouille : les totaux, le sélecteur en cartes, la teinte, les états vides, et
 * — par caractérisation — que les mêmes appels de service partent toujours.
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
  generateIdempotencyKey: () => 'key-1',
}))

import StoreInternalDebts from '../../src/pages/store/StoreInternalDebts'

const debt = (id, over = {}) => ({
  id, creditorStoreName: 'ESAHAF OUAGA', debtorStoreName: 'ESAHAF POUYTENGA',
  network: 'Coris', operationType: 'deposit', originalAmount: 20000, remainingAmount: 20000,
  status: 'open', createdAt: new Date('2026-08-09T09:00:00Z'), ...over,
})

/** Alimente les deux abonnements avec des listes figées. */
const feed = ({ debts = [], credits = [] } = {}) => {
  mocks.subscribeMyDebts.mockImplementation(({ onUpdate }) => { onUpdate?.(debts); return vi.fn() })
  mocks.subscribeMyCredits.mockImplementation(({ onUpdate }) => { onUpdate?.(credits); return vi.fn() })
}

// toLocaleString('fr-FR') sépare les milliers par une espace insécable (U+00A0 ou
// U+202F) que .textContent ne normalise pas (getByText, si). Remplacer toute espace
// par une espace ordinaire rend la comparaison stable (idempotent sur les espaces
// déjà ordinaires, dont celle avant « FCFA »).
const norm = (s) => s.replace(/\s/g, ' ')

const assertNoHardcodedGreen = (container) => {
  const html = container.innerHTML
  expect(html).not.toContain('border-green-300')
  expect(html).not.toContain('bg-green-50/70')
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.useAuth.mockReturnValue({ userProfile: { storeId: 'store-a', role: 'store_admin' } })
  mocks.subscribeDebtSettlements.mockImplementation(({ onUpdate }) => { onUpdate?.([]); return vi.fn() })
  feed()
})

describe('TC-121 — bilan en cartes', () => {
  it('somme le reste dû dans chaque carte', () => {
    feed({
      debts: [debt('d1', { remainingAmount: 20000 }), debt('d2', { remainingAmount: 5000 })],
      credits: [debt('c1', { remainingAmount: 40000 })],
    })
    render(<StoreInternalDebts />)
    expect(norm(screen.getByTestId('debts-card').textContent)).toContain('25 000 FCFA')
    expect(norm(screen.getByTestId('credits-card').textContent)).toContain('40 000 FCFA')
  })

  it('les cartes sont le sélecteur : dettes par défaut, bascule sur créances', () => {
    feed({ debts: [debt('d1')], credits: [debt('c1', { debtorStoreName: 'ESAHAF KAYA' })] })
    render(<StoreInternalDebts />)

    expect(screen.getByTestId('debts-card')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('credits-card')).toHaveAttribute('aria-pressed', 'false')
    // Colonne « Envers » propre aux dettes.
    expect(screen.getByText('Envers')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('credits-card'))
    expect(screen.getByTestId('credits-card')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('De')).toBeInTheDocument()
    expect(screen.queryByText('Envers')).not.toBeInTheDocument()
  })
})

describe('TC-121 — tableau teinté', () => {
  it('teinte l\'entête et les cellules, sans vert codé en dur', () => {
    feed({ debts: [debt('d1')] })
    const { container } = render(<StoreInternalDebts />)
    assertNoHardcodedGreen(container)
    const head = container.querySelector('thead tr')
    expect(head.className).toContain('bg-orange-100/80')
    for (const cell of container.querySelectorAll('th')) {
      expect(cell.className).toContain('border-orange-300')
    }
  })

  it('rend l\'état vide comme une ligne du tableau', () => {
    render(<StoreInternalDebts />)
    const empty = screen.getByText('Aucune dette.')
    expect(empty.tagName).toBe('TD')
    expect(empty).toHaveAttribute('colspan', '7')

    fireEvent.click(screen.getByTestId('credits-card'))
    const emptyC = screen.getByText('Aucune créance.')
    expect(emptyC.tagName).toBe('TD')
  })
})

describe('TC-121 — caractérisation : mêmes appels de service', () => {
  it('Déclarer envoie declareInternalDebtSettlement (débitrice)', async () => {
    feed({ debts: [debt('d1', { id: 'debt-9' })] })
    render(<StoreInternalDebts />)

    fireEvent.change(screen.getByLabelText('Montant règlement'), { target: { value: '5000' } })
    fireEvent.change(screen.getByLabelText('Méthode'), { target: { value: 'transfert' } })
    fireEvent.click(screen.getByRole('button', { name: 'Déclarer' }))

    await waitFor(() => {
      expect(mocks.declareInternalDebtSettlement).toHaveBeenCalledWith(
        expect.objectContaining({ debtId: 'debt-9', amount: '5000', method: 'transfert', idempotencyKey: 'key-1' }),
      )
    })
  })

  it('une dette réglée n\'offre plus de formulaire de règlement', () => {
    feed({ debts: [debt('d1', { status: 'settled', remainingAmount: 0 })] })
    render(<StoreInternalDebts />)
    expect(screen.queryByRole('button', { name: 'Déclarer' })).not.toBeInTheDocument()
  })

  it('Confirmer / Rejeter une tranche appellent le bon service (créancière)', async () => {
    feed({ credits: [debt('c1', { id: 'debt-7', debtorStoreName: 'ESAHAF KAYA' })] })
    mocks.subscribeDebtSettlements.mockImplementation(({ onUpdate }) => {
      onUpdate?.([{ id: 's1', amount: 5000, method: 'especes', settlementStatus: 'declared' }])
      return vi.fn()
    })
    render(<StoreInternalDebts />)
    fireEvent.click(screen.getByTestId('credits-card'))

    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }))
    await waitFor(() => {
      expect(mocks.confirmInternalDebtSettlement).toHaveBeenCalledWith({ debtId: 'debt-7', settlementId: 's1' })
    })

    fireEvent.click(screen.getByRole('button', { name: 'Rejeter' }))
    await waitFor(() => {
      expect(mocks.rejectInternalDebtSettlement).toHaveBeenCalledWith(
        expect.objectContaining({ debtId: 'debt-7', settlementId: 's1', rejectionReason: 'Non reçu' }),
      )
    })
  })
})
