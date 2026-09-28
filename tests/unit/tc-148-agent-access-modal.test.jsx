/**
 * TC-148 — Fenêtre de génération du code d'accès agent (AgentAccessCodeModal).
 *
 * Vérifie : la génération n'est pas automatique (bouton explicite), le code renvoyé
 * s'affiche une fois avec l'avertissement, une erreur serveur est montree — et le
 * gerant est prevenu quand la REVOCATION des sessions ouvertes a echoue alors que
 * le code, lui, a bien change (lot revocation).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ generateAgentAccessCode: vi.fn() }))
vi.mock('../../src/services/agentAccessService', () => ({
  generateAgentAccessCode: mocks.generateAgentAccessCode,
}))

import AgentAccessCodeModal from '../../src/components/agents/AgentAccessCodeModal'

beforeEach(() => { vi.clearAllMocks() })

describe('TC-148 — AgentAccessCodeModal', () => {
  it('ne génère pas au montage : un clic explicite est requis', () => {
    render(<AgentAccessCodeModal clientId="cli-1" clientName="Ali Diallo" onClose={vi.fn()} />)
    expect(mocks.generateAgentAccessCode).not.toHaveBeenCalled()
    expect(screen.getByTestId('btn-generate-access-code')).toBeInTheDocument()
  })

  it('génère et affiche le code renvoyé (une fois)', async () => {
    mocks.generateAgentAccessCode.mockResolvedValue({ success: true, accessCode: 'ESAHAF-ABCD2345', codeVersion: 1 })
    render(<AgentAccessCodeModal clientId="cli-1" clientName="Ali Diallo" onClose={vi.fn()} />)

    fireEvent.click(screen.getByTestId('btn-generate-access-code'))

    const value = await screen.findByTestId('agent-access-code-value')
    expect(value.textContent).toBe('ESAHAF-ABCD2345')
    expect(mocks.generateAgentAccessCode).toHaveBeenCalledWith('cli-1')
    expect(screen.getByText(/ne sera plus réaffiché/i)).toBeInTheDocument()
  })

  it("⚠ previent quand les sessions ouvertes n'ont PAS pu etre coupees", async () => {
    // Regenerer fait DEUX choses : changer le code, et deconnecter les appareils
    // deja connectes. La seconde peut rater seule — le serveur ne fait alors pas
    // echouer l'appel, parce que le code A change. Sans cet avertissement, le
    // gerant croirait l'ancien telephone coupe alors qu'il fonctionne encore.
    mocks.generateAgentAccessCode.mockResolvedValue({
      success: true, accessCode: 'ESAHAF-ABCD2345', codeVersion: 2, sessionsRevoked: false,
    })
    render(<AgentAccessCodeModal clientId="cli-1" clientName="Ali Diallo" onClose={vi.fn()} />)

    fireEvent.click(screen.getByTestId('btn-generate-access-code'))

    // Le code reste montre : il est valide, et le cacher ferait regenerer encore.
    expect((await screen.findByTestId('agent-access-code-value')).textContent).toBe('ESAHAF-ABCD2345')
    expect(screen.getByTestId('agent-sessions-not-revoked')).toBeInTheDocument()
  })

  it('ne previent de rien quand la coupure a eu lieu', async () => {
    mocks.generateAgentAccessCode.mockResolvedValue({
      success: true, accessCode: 'ESAHAF-ABCD2345', codeVersion: 1, sessionsRevoked: true,
    })
    render(<AgentAccessCodeModal clientId="cli-1" onClose={vi.fn()} />)

    fireEvent.click(screen.getByTestId('btn-generate-access-code'))

    await screen.findByTestId('agent-access-code-value')
    expect(screen.queryByTestId('agent-sessions-not-revoked')).toBeNull()
  })

  it('affiche l\'erreur serveur sans exposer le code', async () => {
    mocks.generateAgentAccessCode.mockRejectedValue(new Error("L'agent doit avoir au moins un numéro ou code agent."))
    render(<AgentAccessCodeModal clientId="cli-1" onClose={vi.fn()} />)

    fireEvent.click(screen.getByTestId('btn-generate-access-code'))

    const err = await screen.findByTestId('agent-access-error')
    expect(err.textContent).toMatch(/numéro ou code agent/i)
    expect(screen.queryByTestId('agent-access-code-value')).not.toBeInTheDocument()
  })
})
