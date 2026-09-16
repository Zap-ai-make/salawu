/**
 * TC-162 — Filet de caractérisation du CHÂSSIS de l'espace boutique :
 *          la navigation et le bandeau de marque.
 *
 * Pourquoi ce fichier existe
 * ─────────────────────────────────────────────────────────────────────────────
 * Le lot L7.1 de la refonte va déplacer ce châssis : un seul `h1`, une seule
 * largeur, `PageHeader` sur les dix écrans. On fige donc AVANT ce qui doit
 * survivre au déplacement — et on nomme ce qui doit disparaître.
 *
 * LA RÈGLE QUI REND CE FILET UTILE : aucune assertion sur une classe CSS.
 * Un test qui vérifie `border-green-500` interdit précisément le travail qu'on
 * vient faire. On asserte sur le texte visible, les rôles, les noms accessibles
 * et les chemins de route — sur ce que la page EST, jamais sur ce à quoi elle
 * RESSEMBLE (ARCHITECTURE.md §10, « leçons acquises »).
 *
 * DEUX DÉFAUTS SONT FIGÉS TELS QUELS, signalés par ⚠ DÉFAUT FIGÉ.
 * Ils sont gelés pour qu'on puisse prouver plus tard qu'ils ont été CORRIGÉS et
 * non DÉPLACÉS. Quand le lot correcteur arrive, le test est retourné : il exige
 * alors la correction et nomme le défaut qu'il remplace (METHODE §2, A.1).
 *
 * Les deux profils sont couverts dans le même fichier, et ce n'est pas du zèle :
 * TAOFIC (`taofic-ajagbe`) est en production et doit rester inchangé. Le cas
 * « mono-réseau » est celui qui protège un client réel d'un changement qu'il
 * n'a pas demandé.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import { pilotProfile } from '../../config/clients/_pilot.js'

// `vi.resetModules()` + import dynamique recharge tout le graphe à chaque cas :
// c'est ce qui isole les deux profils, et cela coûte plusieurs secondes. Sous
// charge, les 5 s par défaut rendraient un rouge qui ne dit rien du code.
vi.setConfig({ testTimeout: 30_000 })

const RESEAUX_ESAHAF = ['Orange', 'Moov', 'Telecel', 'Coris', 'Sank', 'Wave']

/**
 * Profil factice — DÉRIVÉ du pilote, pas réinventé.
 *
 * Le graphe du Layout traverse `utils/constants.js`, qui lit
 * `activeProfile.transactions.types` : un profil écrit à la main dans le test
 * finit toujours par diverger du contrat réel, et le rouge accuse alors le
 * harnais plutôt que le code. On part du pilote et on ne surcharge QUE les trois
 * champs qui distinguent les deux clients ici : la marque, les réseaux, l'axe de
 * design. Aucun profil client réel n'est lu.
 */
function profil({ reseaux, appName, designSystem }) {
  return {
    ...pilotProfile,
    id: 'profil-de-test',
    branding: { appName, pwaName: appName, theme: 'orange' },
    design: { system: designSystem ?? 'legacy' },
    networks: { enabled: reseaux },
  }
}

function poserLesMocks({ reseaux, appName, designSystem, compteurs = {} }) {
  const abonnement = (valeur) => ({ onUpdate }) => {
    onUpdate?.(valeur ?? 0)
    return () => {}
  }

  vi.doMock('../../src/config/activeClientProfile.js', () => ({
    activeProfile: profil({ reseaux, appName, designSystem }),
  }))
  vi.doMock('../../src/config/firebase', () => ({
    auth: {},
    db: {},
    functions: {},
    firebaseInfo: { projectId: 'test', isDev: true, useEmulators: false },
    default: {},
  }))
  const auth = () => ({ currentUser: { uid: 'u1' }, userProfile: { storeId: 'b1' } })
  vi.doMock('../../src/context/AuthContext', () => ({ useAuth: auth }))
  vi.doMock('../../src/context/AuthContext.jsx', () => ({ useAuth: auth }))
  const theme = () => ({ themeClasses: {}, backgroundImage: '/bg-noir.png' })
  vi.doMock('../../src/context/ThemeContext', () => ({ useTheme: theme }))
  vi.doMock('../../src/context/ThemeContext.jsx', () => ({ useTheme: theme }))
  vi.doMock('../../src/services/storeAdminDealerService', () => ({
    subscribeStorePendingCount: abonnement(compteurs.demandes),
  }))
  vi.doMock('../../src/services/collaborationService', () => ({
    subscribeIncomingCollaborationsCount: abonnement(compteurs.collaborations),
    subscribeSettlementsToConfirmCount: abonnement(compteurs.reglements),
  }))
  // Même mise à l'écart que TC-159 : ce bouton appelle window.matchMedia, absent
  // de jsdom, et n'a rien à voir avec ce qui est caractérisé ici.
  vi.doMock('../../src/components/PWAInstallButton', () => ({ default: () => null }))
  // Les soldes ont leur propre filet (TC-163) : ici la source de données est
  // neutralisée pour que le châssis soit seul en cause quand ce fichier rougit.
  vi.doMock('../../src/hooks/useSimpleNetworkData', () => ({
    useSimpleNetworkData: () => ({
      networkData: Object.fromEntries(
        [...reseaux, 'Liquidite'].map((r) => [r, { stock: 100000, liquidite: 50000 }]),
      ),
    }),
  }))
  // Le chemin MONO-réseau (TAOFIC) rend `NetworkCard`, qui appelle
  // `useNetworkCards` → `useNetworkConfig` et exige donc un fournisseur ; le
  // chemin multi-réseaux rend `NetworkBalanceCard`, qui n'en a pas besoin. Les
  // deux clients n'empruntent pas le même code, et c'est précisément ce que ce
  // fichier doit continuer de couvrir. `NetworkCard` ne consomme que ces deux
  // fonctions, et l'édition est de toute façon refusée à une boutique
  // (`canEdit = role === 'dealer'`).
  vi.doMock('../../src/hooks/useNetworkCards', () => ({
    useNetworkCards: () => ({ updateStock: () => {}, updateLiquidity: () => {} }),
  }))
}

async function monterLaNavigation(options) {
  poserLesMocks(options)
  const { MemoryRouter } = await import('react-router-dom')
  const { default: NavBar } = await import('../../src/components/NavBar.jsx')
  render(
    <MemoryRouter>
      <NavBar />
    </MemoryRouter>,
  )
}

async function monterLeChassis(options) {
  poserLesMocks(options)
  const { MemoryRouter } = await import('react-router-dom')
  const { default: Layout } = await import('../../src/components/Layout.jsx')
  render(
    <MemoryRouter>
      {/* Un écran quelconque : c'est sa cohabitation avec le bandeau qu'on mesure. */}
      <Layout>
        <h1>Transactions</h1>
      </Layout>
    </MemoryRouter>,
  )
}

const ESAHAF = { reseaux: RESEAUX_ESAHAF, appName: 'ESAHAF', designSystem: 'registre' }
const TAOFIC = { reseaux: ['Orange'], appName: 'TAOFIC' }

/** Les libellés des liens de navigation, dans l'ordre du DOM. */
function libellesDesLiens() {
  return within(screen.getByRole('navigation'))
    .getAllByRole('link')
    .map((a) => a.textContent.trim())
}

beforeEach(() => {
  vi.resetModules()
})
afterEach(() => {
  cleanup()
  vi.resetModules()
  vi.clearAllMocks()
})

describe("TC-162 — les entrées de navigation de l'espace boutique", () => {
  it('ESAHAF (multi-réseaux) : huit entrées, dans cet ordre', async () => {
    await monterLaNavigation(ESAHAF)

    expect(libellesDesLiens()).toEqual([
      'Tableau de bord',
      'Clients',
      'Transactions',
      'Historique',
      'Formulaire',
      'Demandes Dealer',
      'Dettes internes',
      'Profil',
    ])
  })

  it('TAOFIC (mono-réseau) : sept entrées — « Dettes internes » est absent', async () => {
    await monterLaNavigation(TAOFIC)

    const libelles = libellesDesLiens()
    expect(libelles).toHaveLength(7)
    expect(libelles).not.toContain('Dettes internes')
  })

  it('la navigation existe AUSSI en liste déroulante nommée « Navigation principale »', async () => {
    // Sous 768 px la navigation change de NATURE : liens au-dessus, <select> en
    // dessous. Les deux formes coexistent dans le DOM, c'est le CSS qui tranche.
    // Un test qui ne connaît qu'une forme croit à tort qu'un chemin a disparu.
    await monterLaNavigation(ESAHAF)

    const liste = screen.getByRole('combobox', { name: /navigation principale/i })
    const chemins = within(liste)
      .getAllByRole('option')
      .map((o) => o.value)
      .filter(Boolean)

    expect(chemins).toEqual([
      '/',
      '/clients',
      '/transactions',
      '/historique',
      '/formulaire',
      '/dealer-requests',
      '/store/debts',
      '/profil',
    ])
  })
})

describe("TC-162 — les compteurs d'attente", () => {
  it("n'affiche aucun compteur quand il n'y a rien à traiter", async () => {
    await monterLaNavigation({
      ...ESAHAF,
      compteurs: { demandes: 0, collaborations: 0, reglements: 0 },
    })

    expect(screen.queryByTestId('store-pending-badge')).toBeNull()
    expect(screen.queryByTestId('store-collab-badge')).toBeNull()
    expect(screen.queryByTestId('store-debts-badge')).toBeNull()
  })

  it('accorde son nom accessible au singulier', async () => {
    await monterLaNavigation({ ...ESAHAF, compteurs: { demandes: 1 } })

    expect(screen.getByTestId('store-pending-badge')).toHaveAccessibleName(
      '1 demande en attente',
    )
  })

  it('accorde son nom accessible au pluriel', async () => {
    // Une phrase bascule EN ENTIER, verbe compris. Le pluriel assemblé par
    // morceaux est le défaut consigné dans METHODE §9 (« 3 caisses n'aont pas
    // pu être lues ») — sur un compteur qui parle de travail en attente.
    await monterLaNavigation({ ...ESAHAF, compteurs: { demandes: 2 } })

    expect(screen.getByTestId('store-pending-badge')).toHaveAccessibleName(
      '2 demandes en attente',
    )
  })

  it("plafonne l'affichage à « 99+ » sans mentir sur le nom accessible", async () => {
    await monterLaNavigation({ ...ESAHAF, compteurs: { demandes: 150 } })

    const badge = screen.getByTestId('store-pending-badge')
    expect(badge).toHaveTextContent('99+')
    expect(badge).toHaveAccessibleName('150 demandes en attente')
  })

  it("reporte le compteur dans le libellé de l'option, faute de pastille", async () => {
    // La liste déroulante ne peut pas porter de pastille : le compteur passe
    // donc dans le texte de l'option. C'est le seul chemin offert sous 768 px.
    await monterLaNavigation({ ...ESAHAF, compteurs: { collaborations: 2 } })

    const liste = screen.getByRole('combobox', { name: /navigation principale/i })
    expect(
      within(liste).getByRole('option', { name: 'Transactions (2)' }),
    ).toBeInTheDocument()
  })
})

describe("TC-162 — le bandeau de marque et ce qu'il porte", () => {
  it('affiche le nom du profil actif, et lui seul', async () => {
    await monterLeChassis(ESAHAF)

    expect(screen.getByText('ESAHAF')).toBeInTheDocument()
  })

  it('un seul h1 par écran : le titre de l’écran, pas le wordmark', async () => {
    // ⟲ RETOURNÉ AU LOT L7.1, comme annoncé.
    //
    // Ce test gelait un défaut : `Layout.jsx` rendait le nom de l'application en
    // `h1`, et l'écran rendait le sien — deux titres de niveau 1 par page. Un
    // lecteur d'écran qui liste les titres entendait « ESAHAF » sur les dix
    // écrans avant d'arriver au titre utile. L'assertion valait
    // `['ESAHAF', 'Transactions']` ; elle vaut maintenant `['Transactions']`.
    //
    // Le bandeau photographique est CONSERVÉ : seul le rôle du wordmark change,
    // il devient un `span` (maquette l.762, `<span class="marque__nom">`). Ce
    // n'est pas un retrait, c'est un déclassement — le nom reste lisible, il
    // cesse seulement de se déclarer titre du document.
    await monterLeChassis(ESAHAF)

    const titres = screen
      .getAllByRole('heading', { level: 1 })
      .map((h) => h.textContent.trim())

    expect(titres).toEqual(['Transactions'])

    // …et le nom de la boutique n'a pas disparu pour autant.
    expect(screen.getByText('ESAHAF')).toBeInTheDocument()
  })

  it('TAOFIC garde ses deux h1 : aucun arbre de production ne bouge dans un lot de design', async () => {
    // Le déclassement du wordmark est gardé par `IS_REGISTRE`, et ce test est là
    // pour que ce garde ne saute pas par inadvertance.
    //
    // TAOFIC est en production et emprunte la même branche d'en-tête (son thème
    // déclare aussi `backgroundImage`). Son arbre d'accessibilité ne doit pas
    // changer à l'occasion d'une refonte visuelle qui ne le concerne pas — le
    // défaut y demeure, écrit dans le bilan plutôt que corrigé au passage.
    await monterLeChassis(TAOFIC)

    const titres = screen
      .getAllByRole('heading', { level: 1 })
      .map((h) => h.textContent.trim())

    expect(titres).toEqual(['TAOFIC', 'Transactions'])
  })

  it('rend la bande des réserves dès le repos, sans attendre un défilement', async () => {
    await monterLeChassis(ESAHAF)

    // Le rideau est permanent : c'est déjà vrai, et la refonte doit le garder.
    expect(document.querySelector('[data-network-cards]')).not.toBeNull()
  })

  it('⚠ DÉFAUT FIGÉ — « combien il me reste » est porté par DEUX dispositifs', async () => {
    // Le rideau (permanent) et le rail collant (au défilement) disent la même
    // chose à deux endroits. La direction validée les fusionne en une bande
    // unique et toujours visible.
    //
    // ⟲ À RETOURNER AU LOT L7.4, après accord explicite sur la suppression de
    // `StickyBalanceRail.jsx` — une suppression de fichier relève du protocole
    // de CLAUDE.md, pas d'une décision d'agent.
    await monterLeChassis(ESAHAF)

    expect(document.querySelector('[data-network-cards]')).not.toBeNull()
    expect(document.querySelector('[data-balance-rail]')).not.toBeNull()
  })

  it("TAOFIC n'a pas le rail collant : c'est un parti pris, pas une correction", async () => {
    await monterLeChassis(TAOFIC)

    expect(document.querySelector('[data-network-cards]')).not.toBeNull()
    expect(document.querySelector('[data-balance-rail]')).toBeNull()
  })
})
