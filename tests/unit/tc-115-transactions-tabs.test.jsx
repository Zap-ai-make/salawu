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

const mocks = vi.hoisted(() => ({
  isMultiNetwork: true,
  incomingCount: 0,
  subscribeIncomingCollaborationsCount: vi.fn(),
  // La transaction en cours de modification, telle que le CONTEXTE la porte.
  // `null` = aucune. C'est le seul canal entre « Modifier » (dans le tableau) et
  // le formulaire (dans la modale) : ils ne se connaissent pas autrement.
  editingTransaction: null,
  clearEditTransaction: vi.fn(),
}))

vi.mock('../../src/constants/navigation', () => ({
  get IS_MULTI_NETWORK() { return mocks.isMultiNetwork },
  NAV_ITEMS: [],
  STORE_NAV_ITEMS: [],
}))
vi.mock('../../src/hooks/useClients', () => ({ useClients: () => ({ clients: [] }) }))
vi.mock('../../src/context/AuthContext.jsx', () => ({
  useAuth: () => ({ userProfile: { storeId: 'store-A', role: 'store_admin' } }),
}))
vi.mock('../../src/services/collaborationService', () => ({
  subscribeIncomingCollaborationsCount: mocks.subscribeIncomingCollaborationsCount,
}))
// ⚠ AJOUTE LE 2026-09-21. L'ecran porte desormais une ligne de compte
// (« N transactions non terminees · X depots, Y retraits ») et un export, qui
// lisent tous deux `pendingTransactions` depuis le CONTEXTE. `useTransactions`
// leve hors de son provider — c'est voulu, et c'est un bon garde-fou : il
// interdit qu'un ecran lise des transactions sans que quelqu'un les fournisse.
//
// On simule donc le contexte plutot que de monter le vrai provider, qui ouvre
// des abonnements Firestore. Trois transactions, dont deux depots et un
// retrait : de quoi verifier que le compte distingue les deux natures.
vi.mock('../../src/context/transactions.jsx', () => ({
  useTransactions: () => ({
    pendingTransactions: [
      { id: 't1', type: 'Dépôt', montant: 1000, client: 'A', reseau: 'Orange' },
      { id: 't2', type: 'Dépôt', montant: 2000, client: 'B', reseau: 'Moov' },
      { id: 't3', type: 'Retrait', montant: 500, client: 'C', reseau: 'Wave' },
    ],
    get editingTransaction() { return mocks.editingTransaction },
    clearEditTransaction: mocks.clearEditTransaction,
  }),
}))
vi.mock('../../src/utils/excelUtils', () => ({
  exportTransactionsToXLSM: vi.fn(async () => ({ success: true, count: 3 })),
}))

vi.mock('../../src/components/transactions/TransactionForm', () => ({ default: () => <div>FORM_CLIENT</div> }))
vi.mock('../../src/components/transactions/TransactionTable', () => ({ default: () => <div>TABLE_CLIENT</div> }))
vi.mock('../../src/components/transactions/DealerTransferForm', () => ({ default: () => <div>FORM_DEALER</div> }))
vi.mock('../../src/pages/store/StoreCollaborations.jsx', () => ({
  // data-tab expose le sous-onglet initial (piloté par ?sub=), sans altérer le
  // texte que les cas historiques recherchent.
  default: ({ embedded, initialTab }) => (
    <div data-testid="collab-stub" data-tab={String(initialTab)}>COLLABORATIONS embedded={String(embedded)}</div>
  ),
}))

import Transactions from '../../src/pages/Transactions.jsx'

const renderAt = (path = '/transactions') =>
  render(<MemoryRouter initialEntries={[path]}><Transactions /></MemoryRouter>)

beforeEach(() => {
  mocks.isMultiNetwork = true
  mocks.subscribeIncomingCollaborationsCount.mockReset()
  mocks.subscribeIncomingCollaborationsCount.mockImplementation(({ onUpdate }) => {
    onUpdate?.(mocks.incomingCount)
    return () => {}
  })
  mocks.incomingCount = 0
  mocks.editingTransaction = null
  mocks.clearEditTransaction.mockReset()
})

/**
 * ⚠ LE FORMULAIRE N'EST PLUS AFFICHE D'EMBLEE — 2026-09-21.
 *
 * Sur decision du client, maquette a l'appui, la saisie passe en MODALE :
 * l'ecran montre la liste, et « Enregistrer une transaction » ouvre le
 * formulaire. Ce n'est pas un restylage, cela a ete dit avant d'etre fait.
 *
 * Les cas ci-dessous verifiaient la presence de `FORM_CLIENT` pour dire « on est
 * sur l'onglet client ». Ils passent donc par le bouton. L'intention est
 * conservee — et meme renforcee : on verifie en plus que le formulaire est
 * ABSENT tant qu'on ne l'a pas demande.
 */
function ouvrirLaSaisie() {
  fireEvent.click(screen.getByRole('button', { name: /Enregistrer une transaction/ }))
}

describe('TC-115 — sous-onglets de Transactions', () => {
  it('affiche l\'onglet client par défaut, sans collaborations', () => {
    renderAt()
    // La liste est le contenu de l'onglet ; le formulaire attend qu'on le demande.
    expect(screen.getByText('TABLE_CLIENT')).toBeInTheDocument()
    expect(screen.queryByText('FORM_CLIENT')).not.toBeInTheDocument()
    ouvrirLaSaisie()
    expect(screen.getByText('FORM_CLIENT')).toBeInTheDocument()
    expect(screen.queryByText(/COLLABORATIONS/)).not.toBeInTheDocument()
  })

  it('bascule sur les envois dealer, comportement historique inchangé', () => {
    renderAt()
    // ⚠ L'onglet s'appelait « Opération dealer » ; la maquette le nomme
    // « Envois dealer », et le client a retenu la maquette. Le comportement,
    // lui, n'a pas bouge : c'est ce que ce cas garde.
    fireEvent.click(screen.getByRole('button', { name: 'Envois dealer' }))
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
    expect(screen.getByText('TABLE_CLIENT')).toBeInTheDocument()
    ouvrirLaSaisie()
    expect(screen.getByText('FORM_CLIENT')).toBeInTheDocument()
  })

  it('mono-réseau : ni bouton ni onglet collaborations, même via l\'URL', () => {
    mocks.isMultiNetwork = false
    renderAt('/transactions?tab=collaborations')
    expect(screen.queryByRole('button', { name: 'Collaborations' })).not.toBeInTheDocument()
    expect(screen.queryByText(/COLLABORATIONS/)).not.toBeInTheDocument()
    expect(screen.getByText('TABLE_CLIENT')).toBeInTheDocument()
    ouvrirLaSaisie()
    expect(screen.getByText('FORM_CLIENT')).toBeInTheDocument()
    // Aucun abonnement collaborations chez un client mono-réseau.
    expect(mocks.subscribeIncomingCollaborationsCount).not.toHaveBeenCalled()
  })

  it('affiche la pastille des collaborations reçues sur le sous-onglet', () => {
    mocks.incomingCount = 3
    renderAt()
    expect(screen.getByTestId('collab-tab-badge').textContent).toBe('3')
  })

  it('pas de pastille quand rien n\'est en attente', () => {
    renderAt()
    expect(screen.queryByTestId('collab-tab-badge')).not.toBeInTheDocument()
  })

  it('sans reçue en attente, l\'onglet ouvre « Mes demandes » (outgoing)', () => {
    renderAt()
    fireEvent.click(screen.getByRole('button', { name: 'Collaborations' }))
    expect(screen.getByTestId('collab-stub').getAttribute('data-tab')).toBe('outgoing')
  })

  it('avec des reçues en attente, l\'onglet pointe droit sur les reçues', () => {
    mocks.incomingCount = 2
    renderAt()
    // Tout le bouton mène à la tâche à faire, pas seulement la pastille.
    fireEvent.click(screen.getByRole('button', { name: /Collaborations/ }))
    expect(screen.getByTestId('collab-stub').getAttribute('data-tab')).toBe('incoming')
  })

  it('?sub=incoming ouvre les reçues au chargement', () => {
    renderAt('/transactions?tab=collaborations&sub=incoming')
    expect(screen.getByTestId('collab-stub').getAttribute('data-tab')).toBe('incoming')
  })
})

describe('TC-115 — ⚠ la modale de saisie sert AUSSI la modification', () => {
  /**
   * LE DEFAUT QUE CES CAS EXISTENT POUR FERMER.
   *
   * Le lot L9.14 a deplace `TransactionForm` dans une modale ouverte par
   * « Enregistrer une transaction ». Mais « Modifier », sur une ligne en
   * attente, ne passe pas par ce bouton : il appelle `startEditTransaction` sur
   * le CONTEXTE, puis faisait defiler la page vers le haut — un geste ecrit
   * quand le formulaire etait pose en pleine page, juste au-dessus du tableau.
   *
   * Le formulaire vivant desormais derriere `{saisieOuverte && …}`, qui etait
   * faux, MODIFIER UNE TRANSACTION N'OUVRAIT PLUS RIEN. Et le pire venait
   * apres : `editingTransaction` restait arme dans le contexte, donc la saisie
   * SUIVANTE s'ouvrait pre-remplie avec l'ancienne operation, en mode
   * modification, sans que rien ne l'annonce.
   */
  it('une modification demandée depuis le tableau OUVRE la modale', () => {
    mocks.editingTransaction = { id: 't1', type: 'Dépôt', montant: 1000, client: 'A', reseau: 'Orange' }
    renderAt()

    const modale = document.querySelector('[data-modale]')
    expect(modale, 'la modale doit s’ouvrir sur une demande de modification').not.toBeNull()
    // Et elle doit DIRE qu'on modifie : ouvrir le meme panneau sous le titre
    // « Enregistrer une transaction » ferait croire a une saisie neuve.
    expect(modale.textContent).toMatch(/modifier/i)
  })

  it('fermer la modale DESARME la modification restée en attente', () => {
    mocks.editingTransaction = { id: 't1', type: 'Dépôt', montant: 1000, client: 'A', reseau: 'Orange' }
    renderAt()

    fireEvent.click(screen.getByRole('button', { name: /fermer/i }))
    expect(mocks.clearEditTransaction).toHaveBeenCalled()
  })

  it('au repos, la modale est fermée', () => {
    renderAt()
    expect(document.querySelector('[data-modale]')).toBeNull()
  })
})

describe('TC-115 — ⚠ aucun toast fantome', () => {
  it("n'affiche aucune notification tant qu'il ne s'est rien passé", () => {
    /**
     * `<Toast toasts={toasts} removeToast={removeToast} />` passait des
     * proprietes que `Toast` n'accepte pas : il attend `message`, `type`,
     * `duration`, `onClose`. Pose HORS de tout `.map` et de toute condition, il
     * peignait donc une notification VIDE a chaque visite de l'ecran — puis
     * jetait `TypeError: onClose is not a function` au bout de 4 secondes,
     * quand son minuteur appelait un `onClose` inexistant.
     *
     * Et pendant ce temps le VRAI message — le resultat de l'export — n'etait
     * jamais montre a personne.
     */
    renderAt()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
