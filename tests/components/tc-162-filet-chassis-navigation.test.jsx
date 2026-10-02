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

/**
 * Le nom ACCESSIBLE d'un lien : son texte, moins ce qui est masqué aux lecteurs
 * d'écran.
 *
 * ⚠ ET NON `textContent`. La pilule de compte contient une pastille d'initiales
 * marquée `aria-hidden` : en texte brut le lien se lit « UProfil », alors qu'il
 * s'annonce « Profil ». Lire le texte brut ferait de ce fichier le gardien d'une
 * chaîne que personne n'entend — et il rougirait le jour où la pastille change
 * de lettres, c'est-à-dire à chaque boutique.
 */
function nomAccessible(element) {
  return [...element.childNodes]
    .filter((n) => !(n.nodeType === 1 && n.getAttribute('aria-hidden') === 'true'))
    .map((n) => n.textContent)
    .join('')
    .trim()
}

/** Les libellés des liens de navigation, dans l'ordre du DOM. */
function libellesDesLiens() {
  return within(screen.getByRole('navigation'))
    .getAllByRole('link')
    .map(nomAccessible)
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
  it('ESAHAF (multi-réseaux) : six entrées, dans cet ordre', async () => {
    // ⟲ HUIT ENTRÉES, PUIS SEPT (2026-09-23). « Formulaire » a été retiré : il
    // ouvrait un écran qui ne faisait qu'ajouter un client, et la liste Clients
    // offrait déjà « Ajouter un client », qui y menait. Deux chemins pour une
    // seule saisie, et un libellé qui ne disait pas ce qu'il ouvrait.
    //
    // ⚠ CE N'EST PAS UN CHANGEMENT D'APPARENCE. Une entrée de navigation qui
    // disparaît change la carte mentale de qui l'utilisait tous les jours. Le
    // client l'a demandé ; la route redirige vers /clients (TC-028, A-7) pour
    // que les signets et le raccourci PWA ne tombent pas dans le vide.
    //
    // ⟲ RÉORDONNÉ (2026-09-30), toujours sept entrées. L'ordre figé ici était
    // l'ordre d'accumulation : chaque lot avait posé son entrée au bout, et la
    // barre ne disait plus rien de la journée de travail. Le client a fourni la
    // disposition voulue — l'exploitation d'abord, le répertoire ensuite, le
    // compte à part :
    //
    //     Tableau de bord · Transactions · Demandes Dealer · Dettes internes
    //     │ Clients · Historique                              (XX) Profil
    //
    // « Formulaire » reste absent : la capture de référence le montrait, le
    // client a confirmé qu'il ne revient pas. Le retrait du 2026-09-23 tient.
    await monterLaNavigation(ESAHAF)

    // ⟲ « Demandes Dealer » S'APPELLE « Ravitaillement » (2026-09-30). L'écran
    // porte désormais deux sous-onglets — le ravitaillement (geste de la
    // boutique sur sa propre carte) et les demandes dealer (livraison proposée
    // par un tiers) — et le libellé nomme ce que l'onglet SERT plutôt que le
    // seul circuit qui savait le faire. ⚠ LE CHEMIN NE CHANGE PAS : voir le cas
    // de la liste déroulante plus bas, qui garde `/dealer-requests`.
    // ⟲ « Dettes internes » MASQUÉ le 2026-09-30 (demande client) — six entrées.
    //
    // ⚠ MASQUÉ, PAS SUPPRIMÉ. L'entrée existe toujours dans navigation.js et la
    // route /store/debts reste servie : un signet l'ouvre encore. Ce cas garde
    // la BARRE, pas l'existence de l'écran — et c'est pourquoi il n'y a aucun
    // test ici qui affirmerait que les dettes internes ont disparu du produit.
    expect(libellesDesLiens()).toEqual([
      'Tableau de bord',
      'Transactions',
      'Ravitaillement',
      'Clients',
      'Historique',
      'Profil',
    ])
  })

  it('sépare l’exploitation du répertoire par un filet, muet pour les lecteurs d’écran', async () => {
    // Le filet est une AIDE À LA LECTURE, pas une information : il n'ajoute rien
    // à qui écoute la page. D'où `aria-hidden` — sans quoi un lecteur d'écran
    // annoncerait un séparateur entre deux liens qu'il énumère déjà l'un après
    // l'autre.
    //
    // ⚠ CE QUI EST ASSERTÉ EST LA STRUCTURE, PAS L'APPARENCE. Que le filet soit
    // un trait vertical de 1 px relève du CSS et des captures QA ; ce que ce
    // fichier garde, c'est qu'il EXISTE et qu'il tombe AU BON ENDROIT — entre
    // « Dettes internes » et « Clients », la frontière des deux groupes.
    await monterLaNavigation(ESAHAF)

    const nav = screen.getByRole('navigation')
    const filets = nav.querySelectorAll('[data-nav-filet]')
    expect(filets).toHaveLength(1)
    expect(filets[0]).toHaveAttribute('aria-hidden', 'true')

    // La position : tout ce qui précède le filet dans le DOM, puis tout ce qui suit.
    const avant = []
    const apres = []
    let vu = false
    for (const noeud of nav.querySelectorAll('a, [data-nav-filet]')) {
      if (noeud.hasAttribute('data-nav-filet')) { vu = true; continue }
      ;(vu ? apres : avant).push(nomAccessible(noeud))
    }
    expect(avant).toEqual([
      'Tableau de bord',
      'Transactions',
      'Ravitaillement',
    ])
    expect(apres).toEqual(['Clients', 'Historique', 'Profil'])
  })

  it('détache « Profil » dans un bloc de compte, avec ses initiales en pastille', async () => {
    // « Profil » n'est pas un écran de travail : c'est le compte. Il était la
    // huitième entrée d'une file de huit, à égalité avec « Transactions ». Le
    // bloc `data-nav-compte` est ce qui permet au CSS de l'épingler à droite
    // sans qu'aucune règle n'ait à compter les entrées qui précèdent.
    //
    // ⚠ L'ÉPINGLAGE LUI-MÊME N'EST PAS TESTÉ ICI, et c'est délibéré : jsdom ne
    // dispose rien. Ce qui est tenu, c'est le FAIT structurel dont dépend la
    // mise en page — « Profil » est dans le bloc de compte, les six autres n'y
    // sont pas. Le rendu est couvert par les captures QA à 1440 px.
    await monterLaNavigation(ESAHAF)

    const compte = screen.getByRole('navigation').querySelector('[data-nav-compte]')
    expect(compte).not.toBeNull()
    const liens = within(compte).getAllByRole('link')
    expect(liens.map(nomAccessible)).toEqual(['Profil'])

    // Le lien S'ANNONCE « Profil », et pas « UProfil » : c'est tout l'objet de
    // l'`aria-hidden` posé sur la pastille, et la seule façon de le prouver est
    // de demander son nom accessible plutôt que son texte.
    expect(liens[0]).toHaveAccessibleName('Profil')

    // La pastille est décorative : le lien porte déjà le mot « Profil ». Deux
    // lettres annoncées avant lui n'apprendraient rien et feraient du bruit.
    const pastille = compte.querySelector('[data-nav-initiales]')
    expect(pastille).not.toBeNull()
    expect(pastille).toHaveAttribute('aria-hidden', 'true')
    // `useAuth` est simulé sans nom ni courriel : `getAvatarInitial` retombe sur
    // « U ». C'est le repli du helper de production, pas une valeur inventée ici.
    expect(pastille.textContent.trim()).toBe('U')
  })

  it('TAOFIC (mono-réseau) : sept entrées — « Formulaire » est GARDÉ', async () => {
    // ⚠ C'EST LE CŒUR DE CE CAS, ET IL COMPTE PLUS QUE LE COMPTE.
    //
    // TAOFIC est en production et n'a rien demandé. Le retrait de « Formulaire »
    // est une demande d'ESAHAF, et il est gardé par `IS_REGISTRE` — le même
    // drapeau que le bandeau de marque et la bande des réserves, lu une seule
    // fois, dans designSystem.js.
    //
    // Sans ce cas, un lot futur pourrait « simplifier » la liste en retirant
    // l'entrée pour tout le monde, et rien ne rougirait : le cas ESAHAF
    // ci-dessus resterait vert.
    await monterLaNavigation(TAOFIC)

    const libelles = libellesDesLiens()
    expect(libelles).toHaveLength(7)
    expect(libelles).toContain('Formulaire')
    expect(libelles).not.toContain('Dettes internes')

    // ⟲ RENFORCÉ (2026-09-30) AVEC LA RÉORGANISATION D'ESAHAF.
    //
    // `toContain` ne voyait pas l'ordre : la nouvelle disposition aurait pu
    // déborder sur TAOFIC sans que rien ne rougisse. L'ordre historique est
    // donc écrit en toutes lettres, puisque c'est LUI qu'on promet de ne pas
    // toucher — un client en production ne découvre pas sa barre déplacée
    // parce qu'un autre a commandé une refonte.
    // ⚠ « Demandes Dealer » RESTE CE MOT CHEZ TAOFIC. Le renommage est une
    // demande d'ESAHAF ; un client en production ne voit pas son onglet changer
    // de nom parce qu'un autre a commandé une refonte.
    expect(libelles).toEqual([
      'Tableau de bord',
      'Clients',
      'Transactions',
      'Historique',
      'Formulaire',
      'Demandes Dealer',
      'Profil',
    ])

    // Ni filet, ni bloc de compte, ni pastille : les trois dispositifs de la
    // nouvelle disposition sont gardés par `IS_REGISTRE`, comme le bandeau de
    // marque et la bande des réserves.
    const nav = screen.getByRole('navigation')
    expect(nav.querySelector('[data-nav-filet]')).toBeNull()
    expect(nav.querySelector('[data-nav-compte]')).toBeNull()
    expect(nav.querySelector('[data-nav-initiales]')).toBeNull()
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

    // ⟲ L'ORDRE SUIT CELUI DES LIENS (2026-09-30), et ce n'est pas une
    // coïncidence à re-vérifier à chaque lot : la liste et les liens sont rendus
    // par la MÊME source, `STORE_NAV_ITEMS`. Sous 768 px il n'y a ni filet ni
    // épinglage — un `<select>` n'a pas de colonnes — mais la succession des
    // pages, elle, doit rester la même des deux côtés du point de rupture.
    expect(chemins).toEqual([
      '/',
      '/transactions',
      '/dealer-requests',
      '/clients',
      '/historique',
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

  it('⟲ RETOURNÉ AU LOT L7.4b — « combien il me reste » n\'est plus porté que par UN dispositif', async () => {
    // Ce cas figeait le défaut inverse : le rideau (permanent) ET le rail
    // collant (au défilement) rendaient la même donnée à deux endroits, donc
    // deux occasions de diverger. Le rail compensait un effet — la disparition
    // du rideau au défilement ; la bande supprime la cause, elle ne s'en va plus.
    //
    // ⚠ `StickyBalanceRail.jsx` n'est PAS supprimé : il n'est plus monté. Le
    // fichier et ses contrats d'accessibilité restent (TC-161). Supprimer un
    // fichier relève du protocole de CLAUDE.md, pas d'un lot de design.
    await monterLeChassis(ESAHAF)

    expect(document.querySelector('[data-network-cards]')).not.toBeNull()
    expect(document.querySelector('[data-balance-rail]')).toBeNull()
  })

  it("TAOFIC n'a pas le rail collant : c'est un parti pris, pas une correction", async () => {
    await monterLeChassis(TAOFIC)

    expect(document.querySelector('[data-network-cards]')).not.toBeNull()
    expect(document.querySelector('[data-balance-rail]')).toBeNull()
  })
})
