/**
 * TC-116 — NavBar : table de badges par route.
 *
 * Le badge était un cas particulier codé en dur sur /dealer-requests. Avec les
 * collaborations reçues il en faut un second, d'où badgeFor(path, counts) sur le
 * modèle de DealerLayout. On verrouille : le bon compteur sur la bonne route,
 * aucun badge ailleurs, l'écrêtage 99+, l'aria-label propre à chaque compteur,
 * le rendu mobile (suffixe entre parenthèses) et le désabonnement au démontage.
 *
 * Le style est également couvert : pastille blanche et non rouge, parce que la
 * navbar prend la couleur du thème choisi (orange ESAHAF entre autres) et qu'un
 * rouge sur orange est illisible en plein soleil.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mocks = vi.hoisted(() => ({
  subscribeStorePendingCount: vi.fn(),
  subscribeIncomingCollaborationsCount: vi.fn(),
  subscribeSettlementsToConfirmCount: vi.fn(),
  useAuth: vi.fn(),
}))

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})), setLogLevel: vi.fn() }))
vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => ({})), connectAuthEmulator: vi.fn() }))
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})), initializeFirestore: vi.fn(() => ({})),
  persistentLocalCache: vi.fn(), persistentMultipleTabManager: vi.fn(),
  connectFirestoreEmulator: vi.fn(),
  collection: vi.fn(), collectionGroup: vi.fn(), query: vi.fn(), where: vi.fn(),
  orderBy: vi.fn(), limit: vi.fn(), onSnapshot: vi.fn(() => vi.fn()),
}))
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})), connectFunctionsEmulator: vi.fn(), httpsCallable: vi.fn(),
}))
vi.mock('../../src/config/firebase', () => ({ auth: {}, db: {}, functions: {}, default: {} }))

vi.mock('../../src/constants/navigation', () => ({
  IS_MULTI_NETWORK: true,
  STORE_NAV_ITEMS: [
    { name: 'Tableau de bord', path: '/' },
    { name: 'Transactions', path: '/transactions' },
    { name: 'Demandes Dealer', path: '/dealer-requests' },
    { name: 'Dettes internes', path: '/store/debts' },
    { name: 'Profil', path: '/profil' },
  ],
}))
vi.mock('../../src/context/ThemeContext.jsx', () => ({
  useTheme: () => ({ themeClasses: { navbar: 'bg-orange-600/95' } }),
}))
vi.mock('../../src/context/AuthContext', () => ({ useAuth: mocks.useAuth }))
vi.mock('../../src/services/storeAdminDealerService', () => ({
  subscribeStorePendingCount: mocks.subscribeStorePendingCount,
}))
vi.mock('../../src/services/collaborationService', () => ({
  subscribeIncomingCollaborationsCount: mocks.subscribeIncomingCollaborationsCount,
  subscribeSettlementsToConfirmCount: mocks.subscribeSettlementsToConfirmCount,
}))
vi.mock('../../src/components/PWAInstallButton', () => ({ default: () => null }))

import NavBar from '../../src/components/NavBar.jsx'

const emit = (value) => ({ onUpdate }) => { onUpdate?.(value); return vi.fn() }

const renderNavBar = () => render(<MemoryRouter><NavBar /></MemoryRouter>)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.useAuth.mockReturnValue({
    currentUser: { uid: 'u1' },
    userProfile: { storeId: 'store-A', role: 'store_admin' },
  })
  mocks.subscribeStorePendingCount.mockImplementation(emit(0))
  mocks.subscribeIncomingCollaborationsCount.mockImplementation(emit(0))
  mocks.subscribeSettlementsToConfirmCount.mockImplementation(emit(0))
})

describe('TC-116 — badges de la NavBar boutique', () => {
  it('aucun badge quand les compteurs sont à zéro', () => {
    renderNavBar()
    expect(screen.queryByTestId('store-pending-badge')).not.toBeInTheDocument()
    expect(screen.queryByTestId('store-collab-badge')).not.toBeInTheDocument()
    expect(screen.queryByTestId('store-debts-badge')).not.toBeInTheDocument()
  })

  it('place chaque compteur sur sa propre route', async () => {
    mocks.subscribeStorePendingCount.mockImplementation(emit(2))
    mocks.subscribeIncomingCollaborationsCount.mockImplementation(emit(5))
    mocks.subscribeSettlementsToConfirmCount.mockImplementation(emit(7))
    renderNavBar()

    await waitFor(() => expect(screen.getByTestId('store-pending-badge').textContent).toBe('2'))
    expect(screen.getByTestId('store-collab-badge').textContent).toBe('5')
    expect(screen.getByTestId('store-debts-badge').textContent).toBe('7')

    // Chaque badge est bien dans le lien correspondant, pas ailleurs.
    expect(screen.getByRole('link', { name: /Demandes Dealer/ })).toContainElement(screen.getByTestId('store-pending-badge'))
    expect(screen.getByRole('link', { name: /Transactions/ })).toContainElement(screen.getByTestId('store-collab-badge'))
    expect(screen.getByRole('link', { name: /Dettes internes/ })).toContainElement(screen.getByTestId('store-debts-badge'))
    expect(screen.getByRole('link', { name: /Profil/ }).querySelector('span')).toBeNull()
  })

  it('le badge des dettes décrit des règlements à confirmer', async () => {
    mocks.subscribeSettlementsToConfirmCount.mockImplementation(emit(2))
    renderNavBar()
    const badge = await screen.findByTestId('store-debts-badge')
    expect(badge.getAttribute('aria-label')).toBe('2 règlements à confirmer')
    expect(badge.className).toContain('bg-white')
  })

  it('écrête à 99+ et décrit le bon compteur dans aria-label', async () => {
    mocks.subscribeIncomingCollaborationsCount.mockImplementation(emit(150))
    renderNavBar()
    const badge = await screen.findByTestId('store-collab-badge')
    expect(badge.textContent).toBe('99+')
    expect(badge.getAttribute('aria-label')).toMatch(/collaborations à exécuter/)
  })

  it('emploie une pastille blanche, lisible sur une navbar colorée', async () => {
    mocks.subscribeIncomingCollaborationsCount.mockImplementation(emit(1))
    renderNavBar()
    const badge = await screen.findByTestId('store-collab-badge')
    expect(badge.className).toContain('bg-white')
    expect(badge.className).not.toContain('bg-red-600')
    // Singulier au singulier.
    expect(badge.getAttribute('aria-label')).toBe('1 collaboration à exécuter')
  })

  it('suffixe le compteur dans le sélecteur mobile', async () => {
    mocks.subscribeStorePendingCount.mockImplementation(emit(3))
    mocks.subscribeIncomingCollaborationsCount.mockImplementation(emit(4))
    renderNavBar()
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Demandes Dealer (3)' })).toBeInTheDocument()
    })
    expect(screen.getByRole('option', { name: 'Transactions (4)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Profil' })).toBeInTheDocument()
  })

  it('se désabonne des trois compteurs au démontage', () => {
    const unsubPending = vi.fn()
    const unsubCollab = vi.fn()
    const unsubDebts = vi.fn()
    mocks.subscribeStorePendingCount.mockReturnValue(unsubPending)
    mocks.subscribeIncomingCollaborationsCount.mockReturnValue(unsubCollab)
    mocks.subscribeSettlementsToConfirmCount.mockReturnValue(unsubDebts)
    const { unmount } = renderNavBar()
    unmount()
    expect(unsubPending).toHaveBeenCalledTimes(1)
    expect(unsubCollab).toHaveBeenCalledTimes(1)
    expect(unsubDebts).toHaveBeenCalledTimes(1)
  })
})
