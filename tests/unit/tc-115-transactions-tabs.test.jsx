/**
 * TC-115 — Transactions : trois sous-onglets (client / dealer / collaborations).
 *
 * Caractérisation UI : les collaborations passent de l'onglet de premier niveau
 * au sous-onglet de Transactions. On verrouille (a) que les deux onglets
 * historiques gardent leur comportement, (b) que l'onglet est piloté par
 * ?tab= pour que les anciennes URL puissent y rediriger, (c) que le garde
 * multi-réseaux masque l'onglet chez un client mono-réseau (non-régression TAOFIC).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mocks = vi.hoisted(() => ({ isMultiNetwork: true }))

vi.mock('../../src/constants/navigation', () => ({
  get IS_MULTI_NETWORK() { return mocks.isMultiNetwork },
  NAV_ITEMS: [],
  STORE_NAV_ITEMS: [],
}))
vi.mock('../../src/hooks/useClients', () => ({ useClients: () => ({ clients: [] }) }))
vi.mock('../../src/components/transactions/TransactionForm', () => ({ default: () => <div>FORM_CLIENT</div> }))
vi.mock('../../src/components/transactions/TransactionTable', () => ({ default: () => <div>TABLE_CLIENT</div> }))
vi.mock('../../src/components/transactions/DealerTransferForm', () => ({ default: () => <div>FORM_DEALER</div> }))
vi.mock('../../src/pages/store/StoreCollaborations.jsx', () => ({
  default: ({ embedded }) => <div>COLLABORATIONS embedded={String(embedded)}</div>,
}))

import Transactions from '../../src/pages/Transactions.jsx'

const renderAt = (path = '/transactions') =>
  render(<MemoryRouter initialEntries={[path]}><Transactions /></MemoryRouter>)

beforeEach(() => { mocks.isMultiNetwork = true })

describe('TC-115 — sous-onglets de Transactions', () => {
  it('affiche l\'onglet client par défaut, sans collaborations', () => {
    renderAt()
    expect(screen.getByText('FORM_CLIENT')).toBeInTheDocument()
    expect(screen.getByText('TABLE_CLIENT')).toBeInTheDocument()
    expect(screen.queryByText(/COLLABORATIONS/)).not.toBeInTheDocument()
  })

  it('bascule sur l\'opération dealer, comportement historique inchangé', () => {
    renderAt()
    fireEvent.click(screen.getByRole('button', { name: 'Opération dealer' }))
    expect(screen.getByText('FORM_DEALER')).toBeInTheDocument()
    expect(screen.queryByText('FORM_CLIENT')).not.toBeInTheDocument()
  })

  it('monte les collaborations en mode embarqué depuis ?tab=collaborations', () => {
    renderAt('/transactions?tab=collaborations')
    expect(screen.getByText('COLLABORATIONS embedded=true')).toBeInTheDocument()
    expect(screen.queryByText('FORM_CLIENT')).not.toBeInTheDocument()
  })

  it('bascule sur les collaborations par le bouton', () => {
    renderAt()
    fireEvent.click(screen.getByRole('button', { name: 'Collaborations' }))
    expect(screen.getByText('COLLABORATIONS embedded=true')).toBeInTheDocument()
  })

  it('retombe sur l\'onglet client si ?tab= est inconnu', () => {
    renderAt('/transactions?tab=nimportequoi')
    expect(screen.getByText('FORM_CLIENT')).toBeInTheDocument()
  })

  it('mono-réseau : ni bouton ni onglet collaborations, même via l\'URL', () => {
    mocks.isMultiNetwork = false
    renderAt('/transactions?tab=collaborations')
    expect(screen.queryByRole('button', { name: 'Collaborations' })).not.toBeInTheDocument()
    expect(screen.queryByText(/COLLABORATIONS/)).not.toBeInTheDocument()
    expect(screen.getByText('FORM_CLIENT')).toBeInTheDocument()
  })
})
