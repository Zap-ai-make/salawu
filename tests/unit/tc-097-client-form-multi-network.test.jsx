/**
 * TC-097 — ClientForm : un bloc (Numéro agent + Code agent) par réseau du profil.
 *
 * Le formulaire génère dynamiquement une section par réseau de activeProfile.networks.enabled :
 *   • salawu (6 réseaux) → 6 fieldsets, chacun avec « Numéro agent » et « Code agent » ;
 *   • TAOFIC (mono) → 1 fieldset (Orange), comportement historique préservé côté transactions ;
 *   • à la soumission : les Code agent partent en clés PLATES (client[réseau], dont wave) et les
 *     Numéro agent dans le map imbriqué numerosAgent[réseau] ;
 *   • l'édition (initialData) recharge les deux.
 *
 * NETWORK_OPTIONS est figé à l'import (dérivé du profil) → on force le profil via vi.doMock + resetModules.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
  vi.resetModules()
  vi.clearAllMocks()
})

function mockProfile(enabled) {
  return {
    id: 'test',
    networks: { enabled },
    transactions: { types: ['Dépôt', 'Retrait'], paymentMethods: ['Orange Money', 'Cash'] },
  }
}

async function loadForm(enabled) {
  vi.resetModules()
  vi.doMock('../../src/config/activeClientProfile.js', () => ({ activeProfile: mockProfile(enabled) }))
  const mod = await import('../../src/components/ClientForm.jsx')
  return mod.default
}

const SALAWU = ['Orange', 'Moov', 'Telecel', 'Coris', 'Sank', 'Wave']

describe('TC-097 — ClientForm multi-réseaux', () => {
  it('salawu → 1 bloc par réseau (6), chacun avec Numéro agent + Code agent', async () => {
    const ClientForm = await loadForm(SALAWU)
    const { container } = render(<ClientForm onSubmit={vi.fn()} />)

    // Une légende par réseau
    for (const network of SALAWU) {
      expect(screen.getByText(network)).toBeInTheDocument()
    }
    // 2 champs dédiés par réseau
    expect(screen.getAllByText('Numéro agent')).toHaveLength(6)
    expect(screen.getAllByText('Code agent')).toHaveLength(6)

    // Les clés d'input existent (code plat + numéro imbriqué), y compris Wave
    expect(container.querySelector('input[name="orange"]')).not.toBeNull()
    expect(container.querySelector('input[name="wave"]')).not.toBeNull()
    expect(container.querySelector('input[name="numerosAgent.orange"]')).not.toBeNull()
    expect(container.querySelector('input[name="numerosAgent.wave"]')).not.toBeNull()
  })

  it('soumission → Code agent en clés plates + Numéro agent dans numerosAgent', async () => {
    const ClientForm = await loadForm(SALAWU)
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const { container } = render(<ClientForm onSubmit={onSubmit} />)

    fireEvent.change(container.querySelector('input[name="nom"]'), { target: { value: 'Ouedraogo' } })
    fireEvent.change(container.querySelector('input[name="prenom"]'), { target: { value: 'Awa' } })
    fireEvent.change(container.querySelector('input[name="orange"]'), { target: { value: '1234567' } })
    fireEvent.change(container.querySelector('input[name="numerosAgent.wave"]'), { target: { value: '77000000' } })

    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/i }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const payload = onSubmit.mock.calls[0][0]
    expect(payload.nom).toBe('Ouedraogo')
    expect(payload.orange).toBe('1234567')          // Code agent → clé plate (pilote transactions)
    expect(payload.wave).toBe('')                    // clé plate wave présente (vide)
    expect(payload.numerosAgent.wave).toBe('77000000') // Numéro agent → map imbriqué
    expect(payload.numerosAgent.orange).toBe('')
  })

  it('TAOFIC (mono) → un seul bloc Orange', async () => {
    const ClientForm = await loadForm(['Orange'])
    render(<ClientForm onSubmit={vi.fn()} />)

    expect(screen.getByText('Orange')).toBeInTheDocument()
    expect(screen.queryByText('Moov')).toBeNull()
    expect(screen.getAllByText('Code agent')).toHaveLength(1)
  })

  it('édition → recharge Code agent (plat) et Numéro agent (map)', async () => {
    const ClientForm = await loadForm(SALAWU)
    const initialData = {
      nom: 'Sana', prenom: 'Ali',
      moov: '999', numerosAgent: { moov: '76123456' },
    }
    const { container } = render(<ClientForm onSubmit={vi.fn()} initialData={initialData} />)

    await waitFor(() =>
      expect(container.querySelector('input[name="moov"]').value).toBe('999'),
    )
    expect(container.querySelector('input[name="numerosAgent.moov"]').value).toBe('76123456')
    expect(container.querySelector('input[name="nom"]').value).toBe('Sana')
  })
})
