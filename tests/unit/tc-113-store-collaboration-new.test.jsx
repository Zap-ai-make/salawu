/**
 * TC-113 — CollaborationFormModal (formulaire de création de collaboration).
 * Vague 2, LOT 9 ; converti en modal (UI/UX). Profil salawu mocké.
 * On vérifie le chargement des fournisseurs, la soumission avec le bon payload,
 * la validation (client requis) et la fermeture (Annuler + Échap).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  createStoreCollaboration: vi.fn(() => Promise.resolve({ success: true })),
  listStoreCollaborationProviders: vi.fn(() => Promise.resolve([{ storeId: 'store-B', storeName: 'Boutique B' }])),
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
vi.mock('../../src/context/ClientsContext.jsx', async () => {
  const { createContext } = await import('react')
  return { ClientsContext: createContext(null) }
})

import CollaborationFormModal from '../../src/components/store/CollaborationFormModal.jsx'
import { ClientsContext } from '../../src/context/ClientsContext.jsx'

const CLIENTS = [{ id: 'cli-1', nom: 'NIKIEMA', prenom: 'Salif' }]

const renderModal = (props = {}) => {
  const onClose = props.onClose ?? vi.fn()
  const onCreated = props.onCreated ?? vi.fn()
  const utils = render(
    <ClientsContext.Provider value={{ clients: CLIENTS }}>
      <CollaborationFormModal onClose={onClose} onCreated={onCreated} />
    </ClientsContext.Provider>,
  )
  return { ...utils, onClose, onCreated }
}

beforeEach(() => { vi.clearAllMocks() })
afterEach(() => { vi.useRealTimers() })

describe('TC-113 — CollaborationFormModal', () => {
  it('charge les fournisseurs du réseau initial et affiche le réseau', async () => {
    renderModal()
    await waitFor(() => expect(mocks.listStoreCollaborationProviders).toHaveBeenCalledWith('Orange'))
    expect(await screen.findByRole('option', { name: 'Boutique B' })).toBeInTheDocument()
  })

  it('se présente comme une boîte de dialogue accessible', async () => {
    renderModal()
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('heading', { name: 'Nouvelle collaboration' })).toBeInTheDocument()
  })

  it('soumet la collaboration avec le bon payload', async () => {
    renderModal()
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

  it('notifie onCreated après le message de succès', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { onCreated } = renderModal()
    await screen.findByRole('option', { name: 'Boutique B' })

    fireEvent.focus(screen.getByLabelText('Rechercher un client'))
    fireEvent.mouseDown(await screen.findByText('NIKIEMA Salif'))
    fireEvent.change(screen.getByLabelText('Boutique fournisseuse'), { target: { value: 'store-B' } })
    fireEvent.click(screen.getByRole('button', { name: /Créer la collaboration/i }))

    expect(await screen.findByText('Collaboration créée.')).toBeInTheDocument()
    expect(onCreated).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(800)
    expect(onCreated).toHaveBeenCalledTimes(1)
  })

  it('bloque la soumission sans client', async () => {
    renderModal()
    await screen.findByRole('option', { name: 'Boutique B' })
    fireEvent.change(screen.getByLabelText('Boutique fournisseuse'), { target: { value: 'store-B' } })
    fireEvent.click(screen.getByRole('button', { name: /Créer la collaboration/i }))
    expect(await screen.findByText('Sélectionnez un client.')).toBeInTheDocument()
    expect(mocks.createStoreCollaboration).not.toHaveBeenCalled()
  })

  it('ferme via Annuler et via la touche Échap', async () => {
    const { onClose, unmount } = renderModal()
    await screen.findByRole('option', { name: 'Boutique B' })

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)

    // L'écouteur clavier ne doit pas survivre au démontage.
    unmount()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
