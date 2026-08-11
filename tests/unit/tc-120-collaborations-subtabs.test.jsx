/**
 * TC-120 — Collaborations : deux sous-onglets avec pastilles.
 *
 * Les deux listes étaient empilées ; sur un écran de boutique, « Mes demandes »
 * se trouvait sous le tableau des reçues et exigeait un défilement. Elles
 * deviennent deux sous-onglets, « Mes demandes » par défaut (décision produit).
 *
 * Deux invariants comptent ici :
 *  - les deux abonnements restent montés quel que soit l'onglet, sinon la
 *    pastille des reçues ne dirait plus rien tant qu'on est sur « Mes demandes » ;
 *  - la pastille des reçues reste ROUGE (action à faire) alors que celle des
 *    demandes envoyées est neutre — un compteur informatif n'alerte pas.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  subscribeIncomingCollaborations: vi.fn(),
  subscribeOutgoingCollaborations: vi.fn(),
}))

vi.mock('../../src/config/firebase', () => ({
  auth: {}, db: {}, functions: {},
  firebaseInfo: { projectId: 'test', isDev: true, useEmulators: false },
  default: {},
}))
vi.mock('../../src/context/ThemeContext.jsx', () => ({
  useTheme: () => ({ themeClasses: { tableHeader: 'bg-orange-100/80 border-orange-300', text: 'text-gray-900' } }),
}))
vi.mock('../../src/context/AuthContext.jsx', () => ({ useAuth: () => mocks.useAuth() }))
vi.mock('../../src/services/collaborationService', () => ({
  subscribeIncomingCollaborations: mocks.subscribeIncomingCollaborations,
  subscribeOutgoingCollaborations: mocks.subscribeOutgoingCollaborations,
  confirmStoreCollaboration: vi.fn(),
  rejectStoreCollaboration: vi.fn(),
}))
vi.mock('../../src/components/store/CollaborationFormModal', () => ({ default: () => null }))

import StoreCollaborations from '../../src/pages/store/StoreCollaborations'

const collab = (id, over = {}) => ({
  id, clientNom: 'Diallo', clientPrenom: 'Ali', network: 'Coris',
  operationType: 'deposit', amount: 20000, status: 'pending',
  createdAt: new Date('2026-08-09T09:00:00Z'),
  requestingStoreName: 'ESAHAF POUYTENGA', supplierStoreName: 'ESAHAF KAYA',
  ...over,
})

/** Alimente les deux abonnements avec des listes figées. */
const feed = ({ incoming = [], outgoing = [] } = {}) => {
  mocks.subscribeIncomingCollaborations.mockImplementation(({ onUpdate }) => { onUpdate?.(incoming); return vi.fn() })
  mocks.subscribeOutgoingCollaborations.mockImplementation(({ onUpdate }) => { onUpdate?.(outgoing); return vi.fn() })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.useAuth.mockReturnValue({ userProfile: { storeId: 'store-a', role: 'store_admin' } })
  feed()
})

describe('TC-120 — sous-onglets des collaborations', () => {
  it('ouvre sur « Mes demandes », pas sur les reçues', () => {
    feed({ incoming: [collab('c1')], outgoing: [collab('c2')] })
    render(<StoreCollaborations embedded />)

    expect(screen.getByTestId('collab-subtab-outgoing')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('collab-subtab-incoming')).toHaveAttribute('aria-pressed', 'false')
    // Colonne propre aux sortantes ; « Demandeuse » est celle des reçues.
    expect(screen.getByText('Fournisseur')).toBeInTheDocument()
    expect(screen.queryByText('Demandeuse')).not.toBeInTheDocument()
  })

  it('bascule sur les reçues et revient', () => {
    feed({ incoming: [collab('c1')], outgoing: [collab('c2')] })
    render(<StoreCollaborations embedded />)

    fireEvent.click(screen.getByTestId('collab-subtab-incoming'))
    expect(screen.getByText('Demandeuse')).toBeInTheDocument()
    expect(screen.queryByText('Fournisseur')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmer' })).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('collab-subtab-outgoing'))
    expect(screen.getByText('Fournisseur')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirmer' })).not.toBeInTheDocument()
  })

  it('affiche le compte de chaque onglet, y compris zéro', () => {
    feed({ incoming: [collab('c1'), collab('c2')], outgoing: [] })
    render(<StoreCollaborations embedded />)

    expect(screen.getByTestId('collab-subtab-incoming-badge').textContent).toBe('2')
    // Zéro reste affiché : la pastille remplace le « — 0 » des anciens titres.
    expect(screen.getByTestId('collab-subtab-outgoing-badge').textContent).toBe('0')
  })

  it('garde la pastille des reçues vivante depuis « Mes demandes »', () => {
    feed({ incoming: [collab('c1')], outgoing: [] })
    render(<StoreCollaborations embedded />)

    // L'onglet reçues n'est pas monté, mais son abonnement l'est.
    expect(screen.queryByText('Demandeuse')).not.toBeInTheDocument()
    expect(mocks.subscribeIncomingCollaborations).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('collab-subtab-incoming-badge').textContent).toBe('1')
  })

  it('alerte en rouge sur les reçues, reste neutre sur les envois', () => {
    feed({ incoming: [collab('c1')], outgoing: [collab('c2')] })
    render(<StoreCollaborations embedded />)

    expect(screen.getByTestId('collab-subtab-incoming-badge').className).toContain('bg-red-600')
    expect(screen.getByTestId('collab-subtab-outgoing-badge').className).not.toContain('bg-red-600')
  })

  it('ne peint pas un zéro en rouge : sans reçue, la pastille est neutre', () => {
    render(<StoreCollaborations embedded />)
    const badge = screen.getByTestId('collab-subtab-incoming-badge')
    expect(badge.textContent).toBe('0')
    expect(badge.className).not.toContain('bg-red-600')
  })

  it('ouvre sur les reçues quand le parent le demande (initialTab)', () => {
    feed({ incoming: [collab('c1')], outgoing: [collab('c2')] })
    render(<StoreCollaborations embedded initialTab="incoming" />)
    expect(screen.getByTestId('collab-subtab-incoming')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Demandeuse')).toBeInTheDocument()
  })

  it('suit le parent quand initialTab change après le montage', () => {
    feed({ incoming: [collab('c1')], outgoing: [collab('c2')] })
    const { rerender } = render(<StoreCollaborations embedded initialTab="outgoing" />)
    expect(screen.getByText('Fournisseur')).toBeInTheDocument()

    // La pastille du parent cliquée alors qu'on est déjà ici : ?sub= change,
    // initialTab passe à 'incoming', le sous-onglet doit suivre.
    rerender(<StoreCollaborations embedded initialTab="incoming" />)
    expect(screen.getByText('Demandeuse')).toBeInTheDocument()
    expect(screen.queryByText('Fournisseur')).not.toBeInTheDocument()
  })

  it('plafonne l\'affichage à 99+ sans mentir sur le libellé', () => {
    feed({ incoming: Array.from({ length: 120 }, (_, i) => collab(`c${i}`)) })
    render(<StoreCollaborations embedded />)
    const badge = screen.getByTestId('collab-subtab-incoming-badge')
    expect(badge.textContent).toBe('99+')
    expect(badge.getAttribute('aria-label')).toBe('120 collaborations à exécuter')
  })
})
