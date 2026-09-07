/**
 * TC-159 — Le seuil de bascule de la navbar est MESURÉ, pas codé en dur.
 *
 * Le défaut corrigé
 * ─────────────────────────────────────────────────────────────────────────────
 * `NavBar.jsx` et `Layout.jsx` comparaient tous deux `window.scrollY` à la
 * constante `200` — la hauteur du bandeau photo historique. L'identité
 * « registre » rend un bandeau de marque compact d'une cinquantaine de pixels :
 * entre ~53 px et 200 px de défilement, la navigation sortait de l'écran sans
 * être remplacée, puis réapparaissait d'un coup.
 *
 * Le seuil est désormais l'`offsetTop` du <nav>, c'est-à-dire la hauteur réelle
 * de ce qui le précède. Ce test vérifie que la bascule suit cette mesure — donc
 * qu'elle vaut aussi bien pour un bandeau de 53 px que pour un de 200 px, sans
 * qu'aucune valeur ne soit écrite quelque part.
 *
 * jsdom ne fait pas de mise en page : `offsetTop` y vaut 0 par défaut. On le
 * pilote explicitement, ce qui est justement ce qui rend le test lisible — il
 * dit « quelle que soit la hauteur H, la bascule se fait à H ».
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(() => ({ currentUser: { uid: 'u1' }, userProfile: { role: 'store' } })),
  abonnementVide: vi.fn(() => vi.fn()),
}))

vi.mock('../../src/config/firebase', () => ({
  auth: {}, db: {}, functions: {},
  firebaseInfo: { projectId: 'test', isDev: true, useEmulators: false },
  default: {},
}))
vi.mock('../../src/context/AuthContext', () => ({ useAuth: mocks.useAuth }))
vi.mock('../../src/context/ThemeContext.jsx', () => ({
  useTheme: () => ({ themeClasses: { navbar: 'bg-encre text-white' } }),
}))
vi.mock('../../src/services/storeAdminDealerService', () => ({
  subscribeStorePendingCount: mocks.abonnementVide,
}))
vi.mock('../../src/services/collaborationService', () => ({
  subscribeIncomingCollaborationsCount: mocks.abonnementVide,
  subscribeSettlementsToConfirmCount: mocks.abonnementVide,
}))
// Même mise à l'écart que TC-116 : ce bouton appelle window.matchMedia, absent
// de jsdom, et n'a rien à voir avec le seuil de bascule mesuré ici.
vi.mock('../../src/components/PWAInstallButton', () => ({ default: () => null }))

import NavBar from '../../src/components/NavBar.jsx'

// Impose une hauteur de bandeau : c'est la seule variable du test.
function poserHauteurBandeau(hauteur) {
  Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
    configurable: true,
    get() {
      return this.tagName === 'NAV' ? hauteur : 0
    },
  })
}

const defiler = (y) => {
  window.scrollY = y
  act(() => {
    window.dispatchEvent(new Event('scroll'))
  })
}

const nav = () => document.querySelector('nav')

beforeEach(() => {
  window.scrollY = 0
})
afterEach(() => {
  delete HTMLElement.prototype.offsetTop
  window.scrollY = 0
  vi.restoreAllMocks()
})

describe('TC-159 — bascule au seuil mesuré', () => {
  it.each([
    ['bandeau « registre » compact', 53],
    ['bandeau photo historique (TAOFIC)', 200],
  ])('%s : la barre devient fixe exactement à %i px', (_nom, hauteur) => {
    poserHauteurBandeau(hauteur)
    render(<MemoryRouter><NavBar /></MemoryRouter>)

    // Dans le flux tant qu'on n'a pas dépassé le bandeau.
    defiler(hauteur - 1)
    expect(nav().className).toContain('relative')
    expect(nav().className).not.toContain('fixed')

    // Fixe dès qu'on l'atteint — et non 150 px plus loin.
    defiler(hauteur)
    expect(nav().className).toContain('fixed')
    expect(nav().className).toContain('top-0')

    // Et elle redescend dans le flux quand on remonte.
    defiler(0)
    expect(nav().className).toContain('relative')
  })

  it("ne laisse aucune plage de défilement sans navigation visible", () => {
    // Le cœur du défaut : avec le seuil à 200 en dur et un bandeau de 53 px,
    // la barre était hors écran ET non fixe entre les deux. On vérifie qu'aucun
    // point intermédiaire ne présente cette combinaison.
    poserHauteurBandeau(53)
    render(<MemoryRouter><NavBar /></MemoryRouter>)

    for (const y of [53, 80, 120, 199, 200, 400]) {
      defiler(y)
      expect(nav().className, `à ${y} px la barre doit être fixe`).toContain('fixed')
    }
  })

  it('remesure le seuil au redimensionnement', () => {
    // Le bandeau peut changer de hauteur (titre sur deux lignes en étroit).
    // Sans remesure, le seuil resterait figé sur la première orientation.
    poserHauteurBandeau(53)
    render(<MemoryRouter><NavBar /></MemoryRouter>)

    defiler(60)
    expect(nav().className).toContain('fixed')

    // Le bandeau grandit ; on revient en haut puis on redimensionne.
    defiler(0)
    poserHauteurBandeau(120)
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })

    defiler(60)
    expect(nav().className, 'seuil remesuré à 120 : 60 px ne suffit plus').toContain('relative')
    defiler(120)
    expect(nav().className).toContain('fixed')
  })
})
