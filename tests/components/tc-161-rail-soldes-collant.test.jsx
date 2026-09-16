import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'

/**
 * TC-161 — Rail de soldes collant.
 *
 * Deux contrats sont figés ici, et ils n'ont pas la même nature.
 *
 * 1. ACCESSIBILITÉ — `tabIndex` doit suivre la visibilité. Le rail est une zone
 *    à défilement horizontal, donc focalisable (constat Q3) ; mais un élément
 *    focalisable à l'intérieur d'un `aria-hidden` est une violation axe
 *    (`aria-hidden-focus`) : le clavier entrerait dans une zone que le lecteur
 *    d'écran ignore. C'est le genre de défaut qu'on introduit sans le voir, et
 *    qu'une capture d'écran ne montre jamais.
 *
 * 2. MISE HORS SERVICE — depuis le lot L7.4b, `Layout` ne monte plus le rail
 *    pour AUCUN client : la bande des réserves ne disparaissant plus au
 *    défilement, il n'a plus rien à compenser.
 *
 * ⚠ CE FICHIER EST CONSERVÉ DÉLIBÉRÉMENT, et le composant avec lui. Le premier
 * contrat continue d'être vérifié sur le composant réel : c'est ce qui permet de
 * le remonter un jour sans redécouvrir à quel prix son accessibilité avait été
 * obtenue. Ne plus monter un composant n'est pas le supprimer — une suppression
 * de fichier relève du protocole de CLAUDE.md, pas d'un lot de design.
 */

const DONNEES = {
  Orange: { stock: 1250000, liquidite: 0 },
  Liquidite: { stock: 0, liquidite: 42000 },
}

function mockerLesDonnees() {
  vi.doMock('../../src/hooks/useSimpleNetworkData', () => ({
    useSimpleNetworkData: () => ({ networkData: DONNEES }),
  }))
}

/**
 * Rend le rail et RETOURNE SON CONTENEUR.
 *
 * Interroger `document` ici serait faux, et l'a été : `vi.resetModules()` fait
 * importer une seconde instance de React aux modules chargés dynamiquement,
 * alors que le `cleanup()` global de tests/setup.js est lié à la première. Rien
 * n'est démonté entre deux cas, et `document.querySelector` retourne le rail du
 * cas PRÉCÉDENT — un test qui lit un autre rendu que celui qu'il vient de faire.
 */
async function rendreLeRail(props) {
  mockerLesDonnees()
  const { default: StickyBalanceRail } = await import(
    '../../src/components/network/StickyBalanceRail.jsx'
  )
  const { container } = render(<StickyBalanceRail visible={false} top={56} {...props} />)
  return container
}

// `vi.resetModules()` + import dynamique recharge une instance de React
// COMPLETE a chaque cas : c'est ce qui isole les deux valeurs de `IS_REGISTRE`,
// et cela coute plusieurs secondes. Sous charge, les 5 s par defaut de vitest
// sont depassees et le fichier rend un ROUGE qui ne dit rien du code — il a
// echoue une fois et passe deux fois sur le meme commit. On paie le vrai cout du
// harnais au lieu de tirer au sort.
vi.setConfig({ testTimeout: 30_000 })

beforeEach(() => { vi.resetModules() })
afterEach(() => { vi.clearAllMocks() })

describe('TC-161 — le rail suit la visibilité, arbre d\'accessibilité compris', () => {
  it('visible : exposé au lecteur d\'écran ET atteignable au clavier', async () => {
    const conteneur = await rendreLeRail({ visible: true })

    const rail = conteneur.querySelector('[data-balance-rail]')
    const zone = rail.querySelector('[role="region"]')
    expect(rail).toHaveAttribute('aria-hidden', 'false')
    expect(zone).toHaveAttribute('tabindex', '0')
    expect(zone.getAttribute('aria-label')).toMatch(/soldes par réseau/i)
  })

  it('masqué : retiré de l\'arbre ET retiré de l\'ordre de tabulation', async () => {
    const conteneur = await rendreLeRail({ visible: false })

    // `getByRole` ignore par construction ce qui est aria-hidden : on interroge
    // donc le DOM directement, sinon on ne verrait rien et le test passerait au
    // vert sans avoir rien vérifié.
    const rail = conteneur.querySelector('[data-balance-rail]')
    expect(rail).toHaveAttribute('aria-hidden', 'true')
    expect(rail.querySelector('[role="region"]')).toHaveAttribute('tabindex', '-1')
  })

  it('affiche le montant de chaque réseau visible', async () => {
    const conteneur = await rendreLeRail({ visible: true })

    // Chiffres nus : le français sépare les milliers par une espace insécable
    // dont la variante dépend d'Intl à l'exécution.
    const chiffres = conteneur.querySelector('[data-balance-rail]').textContent.replace(/[^0-9]/g, '')
    expect(chiffres).toContain('1250000')
  })
})

describe('TC-161 — Layout : le rail n\'est plus monté par aucun client', () => {
  async function rendreLayout({ registre }) {
    mockerLesDonnees()
    vi.doMock('../../src/constants/designSystem.js', () => ({
      IS_REGISTRE: registre,
      DESIGN_SYSTEM: registre ? 'registre' : 'legacy',
      DESIGN_ROOT_CLASS: registre ? 'design-registre' : 'design-legacy',
    }))
    vi.doMock('../../src/context/ThemeContext', () => ({
      useTheme: () => ({
        themeClasses: { background: '', navbar: '' },
        backgroundImage: null,
      }),
    }))
    vi.doMock('../../src/components/NavBar', () => ({ default: () => <nav /> }))
    vi.doMock('../../src/components/network/NetworkCardsDrawer', async () => {
      const reel = await vi.importActual('../../src/components/network/NetworkCardsDrawer')
      return { ...reel, default: () => <div data-rideau /> }
    })
    vi.doMock('react-router-dom', () => ({ Outlet: () => <div /> }))

    const { default: Layout } = await import('../../src/components/Layout.jsx')
    const { container } = render(<Layout><p>contenu</p></Layout>)
    return container
  }

  it('client « legacy » (TAOFIC) : aucun rail', async () => {
    const conteneur = await rendreLayout({ registre: false })
    expect(conteneur.querySelector('[data-balance-rail]')).toBeNull()
  })

  it('⟲ RETOURNÉ AU LOT L7.4b — plus AUCUN client ne monte le rail', async () => {
    // Ce cas exigeait l'inverse : le rail monté pour le client « registre ».
    //
    // Le rail compensait la disparition du rideau au défilement. La bande des
    // réserves ne disparaît plus : il n'a plus rien à compenser, et deux rendus
    // de la même donnée redeviennent un seul.
    //
    // ⚠ CE FICHIER RESTE, ET LE COMPOSANT AUSSI. Les cas ci-dessus continuent de
    // vérifier ses contrats d'accessibilité — `tabIndex` suivant la visibilité,
    // `aria-hidden` basculant avec lui. Ne plus monter un composant n'est pas le
    // supprimer : une suppression de fichier relève du protocole de CLAUDE.md
    // (preuve d'absence d'import statique ET dynamique, recherche dans les
    // scripts et configurations, restauration possible), pas d'un lot de design.
    const conteneur = await rendreLayout({ registre: true })
    expect(conteneur.querySelector('[data-balance-rail]')).toBeNull()
  })
})
