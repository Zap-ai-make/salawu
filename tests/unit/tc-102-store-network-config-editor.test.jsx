/**
 * TC-102 — StoreNetworkConfigEditor (UI admin de la Config Boutique × Réseau).
 *
 * Vague 1, LOT 4. Profil actif mocké en salawu (6 réseaux) pour exercer le rendu
 * multi-réseaux. On vérifie :
 *   • une ligne par réseau activé, supplyMode par défaut issu du profil ;
 *   • pré-remplissage depuis une config existante ;
 *   • bouton Enregistrer désactivé tant que rien n'a changé, puis appel du service
 *     avec la carte réseau complète ;
 *   • message d'erreur si le service échoue.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  getStoreNetworkConfig: vi.fn(),
  setStoreNetworkConfig: vi.fn(),
}))

// Profil actif = salawu (6 réseaux + networkRules).
vi.mock('../../src/config/activeClientProfile.js', () => ({
  activeProfile: {
    id: 'salawu',
    networks: { enabled: ['Orange', 'Moov', 'Telecel', 'Coris', 'Sank', 'Wave'] },
    networkRules: {
      Orange: { supplyMode: 'external_partner', agentOperations: ['deposit', 'withdrawal'], allowStockReturn: true, allowUnregisteredAgents: false },
      Moov: { supplyMode: 'dealer', agentOperations: ['deposit'], allowStockReturn: false, allowUnregisteredAgents: true },
      Telecel: { supplyMode: 'dealer', agentOperations: ['deposit', 'withdrawal'], allowStockReturn: true, allowUnregisteredAgents: false },
      Coris: { supplyMode: 'dealer', agentOperations: ['deposit', 'withdrawal'], allowStockReturn: true, allowUnregisteredAgents: false },
      Sank: { supplyMode: 'dealer', agentOperations: ['deposit', 'withdrawal'], allowStockReturn: true, allowUnregisteredAgents: false },
      Wave: { supplyMode: 'dealer', agentOperations: ['deposit', 'withdrawal'], allowStockReturn: true, allowUnregisteredAgents: true },
    },
  },
}))

vi.mock('../../src/services/adminService', () => ({ getStoreNetworkConfig: mocks.getStoreNetworkConfig }))
vi.mock('../../src/services/storeNetworkConfigService', () => ({ setStoreNetworkConfig: mocks.setStoreNetworkConfig }))

import StoreNetworkConfigEditor from '../../src/pages/admin/StoreNetworkConfigEditor.jsx'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getStoreNetworkConfig.mockResolvedValue(null)
  mocks.setStoreNetworkConfig.mockResolvedValue({ success: true, storeId: 'store-A' })
})

const renderEditor = () => render(<StoreNetworkConfigEditor storeId="store-A" storeName="Boutique A" />)

describe('TC-102 — StoreNetworkConfigEditor', () => {
  it('affiche une ligne par réseau activé, supplyMode par défaut issu du profil', async () => {
    renderEditor()
    for (const net of ['Orange', 'Moov', 'Telecel', 'Coris', 'Sank', 'Wave']) {
      expect(await screen.findByText(net)).toBeInTheDocument()
    }
    // Orange : approvisionnement partenaire externe par défaut (networkRules).
    const orangeSelect = screen.getByLabelText("Orange : mode d'approvisionnement")
    expect(orangeSelect.value).toBe('external_partner')
    const moovSelect = screen.getByLabelText("Moov : mode d'approvisionnement")
    expect(moovSelect.value).toBe('dealer')
  })

  it('pré-remplit depuis une config existante', async () => {
    mocks.getStoreNetworkConfig.mockResolvedValue({
      networks: { Orange: { operates: true, supplyMode: 'dealer', isSupplied: true, isProvider: true } },
    })
    renderEditor()
    const orangeSelect = await screen.findByLabelText("Orange : mode d'approvisionnement")
    expect(orangeSelect.value).toBe('dealer')
    expect(screen.getByLabelText('Orange : fournisseur').checked).toBe(true)
  })

  it('Enregistrer désactivé tant que rien ne change, puis appelle le service avec la carte complète', async () => {
    renderEditor()
    const saveBtn = await screen.findByRole('button', { name: /Enregistrer/i })
    expect(saveBtn).toBeDisabled()

    // Un changement (fournisseur Wave) active le bouton.
    fireEvent.click(screen.getByLabelText('Wave : fournisseur'))
    expect(saveBtn).toBeEnabled()

    fireEvent.click(saveBtn)
    await waitFor(() => expect(mocks.setStoreNetworkConfig).toHaveBeenCalledTimes(1))
    const arg = mocks.setStoreNetworkConfig.mock.calls[0][0]
    expect(arg.storeId).toBe('store-A')
    expect(Object.keys(arg.networks)).toEqual(['Orange', 'Moov', 'Telecel', 'Coris', 'Sank', 'Wave'])
    expect(arg.networks.Wave.isProvider).toBe(true)
    expect(await screen.findByText('Configuration enregistrée.')).toBeInTheDocument()
  })

  it('affiche un message d’erreur si le service échoue', async () => {
    mocks.setStoreNetworkConfig.mockRejectedValue(Object.assign(new Error('Action réservée au gérant global.'), { code: 'ROLE_FORBIDDEN' }))
    renderEditor()
    await screen.findByRole('button', { name: /Enregistrer/i })
    fireEvent.click(screen.getByLabelText('Moov : couverte'))
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/i }))
    expect(await screen.findByText('Action réservée au gérant global.')).toBeInTheDocument()
  })
})
