/**
 * TC-113 — StoreCollaborationNew (formulaire de création de collaboration).
 * Vague 2, LOT 9. Profil salawu mocké. On vérifie le chargement des fournisseurs,
 * la soumission avec le bon payload, et la validation (client requis).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  createStoreCollaboration: vi.fn(() => Promise.resolve({ success: true })),
  listStoreCollaborationProviders: vi.fn(() => Promise.resolve([{ storeId: 'store-B', storeName: 'Boutique B' }])),
  navigate: vi.fn(),
}))

vi.mock('../../src/config/activeClientProfile.js', () => ({
  activeProfile: {
    id: 'salawu',
    networks: { enabled: ['Orange', 'Moov', 'Telecel', 'Coris', 'Sank', 'Wave'] },
    dealer: { networks: ['Moov', 'Telecel', 'Coris', 'Sank', 'Wave'] },
  },
}))
vi.mock('../../src/services/collaborationService', () => ({
  createStoreCollaboration: mocks.createStoreCollaboration,
  listStoreCollaborationProviders: mocks.listStoreCollaborationProviders,
}))
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }))
vi.mock('../../src/context/ClientsContext.jsx', async () => {
  const { createContext } = await import('react')
  return { ClientsContext: createContext(null) }
})

import StoreCollaborationNew from '../../src/pages/store/StoreCollaborationNew.jsx'
import { ClientsContext } from '../../src/context/ClientsContext.jsx'

const CLIENTS = [{ id: 'cli-1', nom: 'NIKIEMA', prenom: 'Salif' }]
const renderPage = () => render(
  <ClientsContext.Provider value={{ clients: CLIENTS }}>
    <StoreCollaborationNew />
  </ClientsContext.Provider>,
)

beforeEach(() => { vi.clearAllMocks() })

describe('TC-113 — StoreCollaborationNew', () => {
  it('charge les fournisseurs du réseau initial et affiche le réseau', async () => {
    renderPage()
    await waitFor(() => expect(mocks.listStoreCollaborationProviders).toHaveBeenCalledWith('Orange'))
    expect(await screen.findByRole('option', { name: 'Boutique B' })).toBeInTheDocument()
  })

  it('soumet la collaboration avec le bon payload', async () => {
    renderPage()
    await screen.findByRole('option', { name: 'Boutique B' })

    // Client
    fireEvent.focus(screen.getByLabelText('Rechercher un client'))
    fireEvent.mouseDown(await screen.findByText('NIKIEMA Salif'))
    // Montant + fournisseur
    fireEvent.change(screen.getByLabelText('Montant'), { target: { value: '20000' } })
    fireEvent.change(screen.getByLabelText('Boutique fournisseuse'), { target: { value: 'store-B' } })

    fireEvent.click(screen.getByRole('button', { name: /Créer la collaboration/i }))

    await waitFor(() => expect(mocks.createStoreCollaboration).toHaveBeenCalledTimes(1))
    expect(mocks.createStoreCollaboration).toHaveBeenCalledWith({
      clientId: 'cli-1', network: 'Orange', operationType: 'deposit', amount: '20000', supplierStoreId: 'store-B',
    })
  })

  it('bloque la soumission sans client', async () => {
    renderPage()
    await screen.findByRole('option', { name: 'Boutique B' })
    fireEvent.change(screen.getByLabelText('Boutique fournisseuse'), { target: { value: 'store-B' } })
    fireEvent.click(screen.getByRole('button', { name: /Créer la collaboration/i }))
    expect(await screen.findByText('Sélectionnez un client.')).toBeInTheDocument()
    expect(mocks.createStoreCollaboration).not.toHaveBeenCalled()
  })
})
