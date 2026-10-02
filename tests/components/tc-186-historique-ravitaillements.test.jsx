/**
 * TC-186 — Historique › Ravitaillement : le registre à l'écran.
 *
 * CE QUE CE FICHIER PROTÈGE
 * ─────────────────────────────────────────────────────────────────────────────
 * TC-184 garde la logique d'argent (serveur), TC-185 garde la saisie (modale).
 * Il restait le registre LU, et c'est là que se jouent les deux promesses les
 * plus faciles à casser sans que rien ne paraisse en panne :
 *
 *   1. UNE LIGNE ANNULÉE RESTE VISIBLE. « Supprimable » est un statut, pas un
 *      `delete`. Un écran qui masquerait les annulées ne se recouperait plus
 *      avec la carte — on lirait trois entrées pour un solde qui en compte
 *      quatre — et masquer après le `limit()` serveur est le bug « limiter puis
 *      filtrer » déjà payé sur les collaborations et les dettes internes.
 *   2. UNE LIGNE CORRIGÉE DIT SON MONTANT D'ORIGINE. Sans lui, « 25 000 »
 *      n'apprend pas qu'on avait d'abord écrit 20 000, et la correction devient
 *      invisible à l'endroit même où on la cherche.
 *
 * Et le garde de client : TAOFIC n'a ni onglet ni abonnement.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react'

const ORANGE = { tableHeader: 'bg-orange-100/80 border-orange-300', text: 'text-gray-900' }

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useTransactions: vi.fn(),
  subscribeStoreTransfers: vi.fn(),
  subscribeIncomingCollaborations: vi.fn(),
  subscribeOutgoingCollaborations: vi.fn(),
  subscribeMyDebts: vi.fn(),
  subscribeMyCredits: vi.fn(),
  subscribeStoreSupplies: vi.fn(),
  isMultiNetwork: true,
  isRegistre: true,
}))

vi.mock('../../src/config/firebase', () => ({
  auth: {}, db: {}, functions: {},
  firebaseInfo: { projectId: 'test', isDev: true, useEmulators: false },
  default: {},
}))
vi.mock('../../src/context/ThemeContext.jsx', () => ({ useTheme: () => ({ themeClasses: ORANGE }) }))
vi.mock('../../src/context/AuthContext.jsx', () => ({ useAuth: () => mocks.useAuth() }))
vi.mock('../../src/constants/navigation', () => ({
  get IS_MULTI_NETWORK() { return mocks.isMultiNetwork },
  NAV_ITEMS: [], STORE_NAV_ITEMS: [],
}))
// Le garde de client est lu ICI, et nulle part ailleurs (designSystem.js est le
// seul point du front qui lit `profil.design`).
vi.mock('../../src/constants/designSystem.js', () => ({
  get IS_REGISTRE() { return mocks.isRegistre },
  DESIGN_SYSTEM: 'registre',
  DESIGN_ROOT_CLASS: 'design-registre',
}))
// `AFFICHER_CIRCUITS_SECONDAIRES` est une constante de MODULE : elle fige
// `!IS_REGISTRE` à l'import. Un test qui bascule le profil en cours de route ne
// la verrait donc jamais changer. On la simule par un accesseur, adossé au même
// drapeau — sans quoi les deux cas ci-dessous mesureraient la même chose.
vi.mock('../../src/constants/ongletsMasques.js', () => ({
  get AFFICHER_CIRCUITS_SECONDAIRES() { return !mocks.isRegistre },
}))
vi.mock('../../src/context/transactions.jsx', () => ({ useTransactions: () => mocks.useTransactions() }))
vi.mock('../../src/services/storeTransferService', () => ({
  subscribeStoreTransfers: mocks.subscribeStoreTransfers,
}))
vi.mock('../../src/services/collaborationService', () => ({
  subscribeIncomingCollaborations: mocks.subscribeIncomingCollaborations,
  subscribeOutgoingCollaborations: mocks.subscribeOutgoingCollaborations,
  subscribeMyDebts: mocks.subscribeMyDebts,
  subscribeMyCredits: mocks.subscribeMyCredits,
}))
vi.mock('../../src/services/storeSupplyService', () => ({
  subscribeStoreSupplies: mocks.subscribeStoreSupplies,
  correctStoreSupply: vi.fn(),
  cancelStoreSupply: vi.fn(),
}))

import Historique from '../../src/pages/Historique.jsx'

const RAV_SIMPLE = {
  id: 'r1',
  createdAt: new Date('2026-09-28T09:00:00Z'),
  network: 'Orange', resource: 'stock', amount: 50000, originalAmount: 50000,
  createdByName: 'Salif Ouedraogo', status: 'active', correctionCount: 0,
}
const RAV_CORRIGE = {
  id: 'r2',
  createdAt: new Date('2026-09-27T09:00:00Z'),
  network: 'Moov', resource: 'stock', amount: 25000, originalAmount: 20000,
  createdByName: 'Salif Ouedraogo', status: 'active', correctionCount: 1,
}
const RAV_ANNULE = {
  id: 'r3',
  createdAt: new Date('2026-09-26T09:00:00Z'),
  network: 'Coris', resource: 'liquidite', amount: 10000, originalAmount: 10000,
  createdByName: 'Salif Ouedraogo', status: 'cancelled',
  cancellationReason: 'Saisi deux fois',
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  mocks.isMultiNetwork = true
  mocks.isRegistre = true
  mocks.useAuth.mockReturnValue({ userProfile: { storeId: 'store-a', role: 'store_admin' } })
  mocks.useTransactions.mockReturnValue({
    completedTransactions: [],
    getTransactionStyles: () => ({ bgColor: '', textColor: '' }),
    addTransaction: vi.fn(),
  })
  const vide = ({ onUpdate }) => { onUpdate?.([]); return vi.fn() }
  mocks.subscribeStoreTransfers.mockImplementation(vide)
  mocks.subscribeIncomingCollaborations.mockImplementation(vide)
  mocks.subscribeOutgoingCollaborations.mockImplementation(vide)
  mocks.subscribeMyDebts.mockImplementation(vide)
  mocks.subscribeMyCredits.mockImplementation(vide)
  mocks.subscribeStoreSupplies.mockImplementation(({ onUpdate }) => {
    onUpdate?.([RAV_SIMPLE, RAV_CORRIGE, RAV_ANNULE])
    return vi.fn()
  })
})

const ouvrirLOnglet = () => {
  render(<Historique />)
  fireEvent.click(screen.getByTestId('histo-tab-ravitaillements'))
}

describe('TC-186 — le registre affiché', () => {
  it('rend les trois lignes, ANNULÉE COMPRISE', async () => {
    // ⚠ LE CŒUR DE CE FICHIER. Le service ne filtre pas par statut, et l'écran
    // non plus. Trois lignes entrent, trois lignes s'affichent.
    ouvrirLOnglet()

    expect(screen.getByTestId('ravitaillement-r1')).toBeInTheDocument()
    expect(screen.getByTestId('ravitaillement-r2')).toBeInTheDocument()
    expect(screen.getByTestId('ravitaillement-r3')).toBeInTheDocument()
  })

  it('marque la ligne annulée « Annulé » et affiche son motif', async () => {
    ouvrirLOnglet()

    const ligne = screen.getByTestId('ravitaillement-r3')
    expect(within(ligne).getByText('Annulé')).toBeInTheDocument()
    expect(within(ligne).getByText('Saisi deux fois')).toBeInTheDocument()
  })

  it('garde le montant d’une ligne annulée LISIBLE, jamais remis à zéro', async () => {
    // Une ligne annulée à 0 serait indéchiffrable : le montant dit ce qui est
    // entré puis reparti.
    ouvrirLOnglet()

    expect(within(screen.getByTestId('ravitaillement-r3')).getByText(/10[\s  ]?000/)).toBeInTheDocument()
  })

  it('dit le montant d’origine d’une ligne corrigée', async () => {
    // Sans cette mention, « 25 000 » n'apprend pas qu'on avait écrit 20 000.
    ouvrirLOnglet()

    const ligne = screen.getByTestId('ravitaillement-r2')
    expect(within(ligne).getByText(/corrigé de/i)).toBeInTheDocument()
    expect(within(ligne).getByText(/20[\s  ]?000/)).toBeInTheDocument()
  })

  it('n’annonce PAS « corrigé » sur une ligne qui ne l’a pas été', async () => {
    ouvrirLOnglet()

    expect(within(screen.getByTestId('ravitaillement-r1')).queryByText(/corrigé de/i)).toBeNull()
  })
})

describe('TC-186 — les gestes offerts', () => {
  it('offre Corriger et Annuler sur une ligne vivante', async () => {
    ouvrirLOnglet()

    expect(screen.getByTestId('btn-corriger-r1')).toBeInTheDocument()
    expect(screen.getByTestId('btn-annuler-r1')).toBeInTheDocument()
  })

  it('n’offre NI l’un NI l’autre sur une ligne déjà annulée', async () => {
    // Le serveur refuserait (SUPPLY_ALREADY_CANCELLED) ; proposer le geste
    // quand même ferait d'un refus prévisible une erreur à l'écran.
    ouvrirLOnglet()

    expect(screen.queryByTestId('btn-corriger-r3')).toBeNull()
    expect(screen.queryByTestId('btn-annuler-r3')).toBeNull()
  })

  it('« Annuler » ouvre une modale qui ne promet PAS une suppression', async () => {
    // Le mot compte : écrire « supprimer » promettrait une disparition que le
    // backend refuse, et l'utilisateur croirait à un bug en revoyant la ligne.
    ouvrirLOnglet()
    fireEvent.click(screen.getByTestId('btn-annuler-r1'))

    const modale = screen.getByRole('dialog')
    expect(within(modale).getByText(/la ligne restera visible/i)).toBeInTheDocument()
    expect(within(modale).queryByText(/supprimer/i)).toBeNull()
  })
})

describe('TC-186 — le garde de client', () => {
  it('TAOFIC n’a ni onglet ni abonnement aux ravitaillements', async () => {
    // Pas seulement « pas d'onglet » : pas d'abonnement non plus. Un écouteur
    // monté pour un client qui n'a pas la fonctionnalité paierait des lectures
    // Firestore et se heurterait aux règles.
    mocks.isRegistre = false
    render(<Historique />)

    expect(screen.queryByTestId('histo-tab-ravitaillements')).toBeNull()
    expect(mocks.subscribeStoreSupplies).not.toHaveBeenCalled()
  })
})

describe('TC-186 — les onglets masqués (décision client 2026-09-30)', () => {
  const libellesDesOnglets = () =>
    screen.getAllByRole('button').map((b) => b.textContent.trim()).filter(Boolean)

  it('ESAHAF ne voit ni « Opérations dealer », ni « Collaborations », ni « Dettes internes »', async () => {
    render(<Historique />)

    expect(screen.queryByRole('button', { name: /Opérations dealer/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Collaborations/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Dettes internes/i })).toBeNull()

    // …et ce qui RESTE est bien là : masquer trois onglets ne doit pas emporter
    // les deux autres au passage.
    expect(screen.getByTestId('histo-tab-ravitaillements')).toBeInTheDocument()
    expect(libellesDesOnglets().some((l) => /Transactions clients/i.test(l))).toBe(true)
  })

  it('TAOFIC garde « Opérations dealer » : le masquage est une demande d’ESAHAF', async () => {
    // ⚠ LE CAS QUI PROTÈGE UN CLIENT EN PRODUCTION. Sans lui, un lot futur
    // pourrait « simplifier » en masquant l'onglet pour tout le monde, et le cas
    // ci-dessus resterait vert.
    mocks.isRegistre = false
    render(<Historique />)

    expect(screen.getByRole('button', { name: /Opérations dealer/i })).toBeInTheDocument()
  })
})
