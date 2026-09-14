/**
 * TC-163 — Cloisonnement du brouillon « Ajouter un client » par boutique.
 *
 * Même défaut que TC-162, autre support : le brouillon du formulaire client était
 * enregistré sous une clé indexée par CLIENT uniquement (`<client>_client_form_draft`),
 * donc partagée par toutes les boutiques ouvertes sur le poste.
 *
 * Conséquence : un client à demi saisi par la boutique A réapparaissait pré-rempli
 * dans le formulaire de la boutique B, qui pouvait l'enregistrer sous SON identité.
 *
 * Le brouillon n'existe que pour une boutique identifiée (`draftScopeId`) : sans
 * portée, aucune lecture ni écriture — la fonction se désactive plutôt que de fuir.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react'

const STORE_A = 'store-pouytenga'
const STORE_B = 'store-boulsa'

let ClientForm

async function loadForm() {
  vi.resetModules()
  vi.doMock('../../src/config/activeClientProfile.js', () => ({
    activeProfile: {
      id: 'test',
      networks: { enabled: ['Orange', 'Moov'] },
      transactions: { types: ['Dépôt', 'Retrait'], paymentMethods: ['Cash'] },
    },
  }))
  const mod = await import('../../src/components/ClientForm.jsx')
  ClientForm = mod.default
}

const renderForm = (draftScopeId) =>
  render(<ClientForm onSubmit={vi.fn()} draftScopeId={draftScopeId} />)

const nomField = (container) => container.querySelector('input[name="nom"]')

beforeEach(async () => {
  localStorage.clear()
  await loadForm()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.resetModules()
})

describe('TC-163 — brouillon client : aucune fuite entre boutiques', () => {
  it("le brouillon d'une boutique ne pré-remplit pas le formulaire d'une autre", async () => {
    // POUYTENGA commence une saisie sans la terminer.
    const first = renderForm(STORE_A)
    fireEvent.change(nomField(first.container), { target: { value: 'Ouedraogo' } })
    await waitFor(() => expect(nomField(first.container).value).toBe('Ouedraogo'))
    first.unmount()

    // BOULSA ouvre son formulaire sur le même navigateur : il doit être vierge.
    const second = renderForm(STORE_B)
    expect(nomField(second.container).value).toBe('')
  })

  it('chaque boutique retrouve son propre brouillon', async () => {
    const first = renderForm(STORE_A)
    fireEvent.change(nomField(first.container), { target: { value: 'Ouedraogo' } })
    await waitFor(() => expect(nomField(first.container).value).toBe('Ouedraogo'))
    first.unmount()

    // Passage par une autre boutique, qui ne doit rien écraser.
    renderForm(STORE_B).unmount()

    const back = renderForm(STORE_A)
    expect(nomField(back.container).value).toBe('Ouedraogo')
  })

  it('sans boutique identifiée, aucun brouillon n’est lu ni écrit', async () => {
    const anonymous = renderForm(null)
    fireEvent.change(nomField(anonymous.container), { target: { value: 'Fuite' } })
    await waitFor(() => expect(nomField(anonymous.container).value).toBe('Fuite'))
    anonymous.unmount()

    // Rien n'a été persisté : ni pour une boutique, ni globalement.
    expect(
      Object.keys(localStorage).some((k) => k.includes('client_form_draft')),
    ).toBe(false)

    expect(nomField(renderForm(STORE_A).container).value).toBe('')
  })

  it('un brouillon hérité de la clé partagée historique est ignoré', async () => {
    const { getStorageKey } = await import('../../src/config/clientIsolation.js')
    localStorage.setItem(
      getStorageKey('client_form_draft'),
      JSON.stringify({ nom: 'Ouedraogo', prenom: 'Awa' }),
    )

    const form = renderForm(STORE_B)
    expect(nomField(form.container).value).toBe('')
  })
})
