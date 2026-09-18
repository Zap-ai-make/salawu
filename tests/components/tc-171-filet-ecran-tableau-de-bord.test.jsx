/**
 * TC-171 — Filet de caractérisation de l'ÉCRAN TABLEAU DE BORD, premier des dix
 *          points d'entrée de l'espace boutique — et le seul qui n'en avait pas.
 *
 * Ce que ce fichier fige
 * ─────────────────────────────────────────────────────────────────────────────
 * C'est l'écran d'accueil : ce qu'il montre décide de ce qu'on croit important.
 * Le lot L8.1 va le refondre en suivant la maquette — quatre graphiques partent,
 * deux tuiles du jour arrivent, et le tableau des derniers clients passe de sept
 * colonnes à trois. On fige donc AVANT ce qu'il DIT aujourd'hui.
 *
 * Aucune assertion sur une classe CSS : sur les titres rendus, les en-têtes de
 * colonnes et les textes visibles.
 *
 * ⚠ CET ÉCRAN EST PARTAGÉ AVEC TAOFIC, qui est en production.
 * `App.jsx:129` sert le même `Dashboard` à tous les clients boutique. Tout ce
 * que le lot L8.1 retirera devra donc être gardé par `IS_REGISTRE` — et le
 * dernier bloc de ce fichier est là pour le prouver, pas pour l'espérer.
 *
 * LES TROIS DÉFAUTS QUI ÉTAIENT FIGÉS ICI ONT ÉTÉ CORRIGÉS (lot L8.1) :
 *
 *   1. SEPT COLONNES dans « Derniers clients enregistrés » → trois. Les
 *      informations de fiche sont retournées à la fiche.
 *   2. Le code agent en `text-orange-600` sur blanc (3,57:1) → la colonne qui
 *      portait le défaut n'existe plus. Un contraste ne se repeint pas toujours :
 *      parfois on retire ce qui n'avait pas à être là.
 *   3. CINQ graphiques → un seul. Les quatre autres répondaient à des questions
 *      d'analyse, et occupaient la hauteur d'écran des chiffres du jour — qui,
 *      eux, n'existaient nulle part.
 *
 * Les cas qui les figeaient exigent désormais la correction et NOMMENT ce qu'ils
 * remplacent : c'est ce qui prouve qu'un défaut a été corrigé et non déplacé
 * (METHODE §2, A.1).
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import { pilotProfile } from '../../config/clients/_pilot.js'

/**
 * ⚠ LE PLAFOND RESTE À 30 s, ET C'EST LE RÉCHAUFFAGE QUI CHANGE.
 *
 * Mesuré le 2026-09-17 : premier montage 30 200 ms, montage suivant 1 122 ms.
 * Le premier cas ne rendait pas trente fois plus lentement — il payait, seul, la
 * transformation Vite de tout le graphe du tableau de bord (recharts et ses
 * dépendances en tête). Un coût de fichier facturé à un cas.
 *
 * Et quand il déborde, il ne se contente pas de rougir : vitest interrompt le
 * cas, mais n'annule pas son `import()` en cours. Le rendu retombe dans le DOM
 * APRÈS le `cleanup` de `afterEach`, et le cas suivant trouve DEUX tableaux de
 * bord — d'où « Found multiple elements with the text: Total Clients », un
 * échec qui ne désignait rien de réel. Un test rouge en avait sali un vert.
 *
 * On aurait pu relever `testTimeout`. On ne le fait pas : cela rendrait muet le
 * seul plafond capable de signaler un rendu devenu réellement lent. On déplace
 * la dépense là où elle appartient — un `beforeAll` qui importe le module une
 * fois, hors du budget de tout cas. `hookTimeout` monte pour lui, et pour lui
 * seul.
 */
vi.setConfig({ testTimeout: 30_000, hookTimeout: 120_000 })

/**
 * `ResponsiveContainer` de recharts observe la taille de son conteneur, et jsdom
 * ne fournit pas `ResizeObserver`. Sans cette doublure, le tableau de bord ne se
 * monte PAS DU TOUT, et les dix cas rougissent sur une erreur qui n'a rien à
 * voir avec ce qu'ils caractérisent.
 *
 * Les graphiques rendent alors un SVG vide, faute de dimensions. C'est sans
 * conséquence ici : leurs TITRES vivent hors du SVG, et c'est tout ce que ce
 * filet lit d'eux. Les charts mockés ailleurs (TC-027, TC-028) évitent le
 * problème ; ici on veut le VRAI arbre, puisque c'est lui que L8.1 va élaguer.
 */
class ResizeObserverDoublure {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverDoublure

const RESEAUX_ESAHAF = ['Orange', 'Moov', 'Telecel', 'Coris', 'Sank', 'Wave']

/**
 * Trois clients au contenu réel — le nom composé qui déborde, un client sans
 * code agent, un client d'une ancienne base. Trois lignes rondes ne prouveraient
 * rien (METHODE §16.3).
 *
 * ⚠ Le code agent vit sur un champ PLAT nommé d'après le réseau en minuscules
 * (`client.orange`), et NON dans `numerosAgent` — c'est ce que lit
 * `firstAgentCode` (LastClientsTable.jsx:7). Mon premier jeu d'essai utilisait
 * la seconde forme, et la cellule rendait « - » : un filet écrit sur une forme
 * de données imaginaire ne fige rien.
 */
const CLIENTS = [
  {
    id: 'c1',
    nom: 'OUEDRAOGO/KABORE',
    prenom: 'Wendkuuni Alizeta',
    numeroPersonnel: '70112233',
    orange: '1004500',
    localite: 'Ouagadougou — Zone du Bois, Secteur 13',
    agentCommercial: 'ZABSONRE Alizeta',
    dateAjout: '15/09/2026',
  },
  {
    id: 'c2',
    nom: 'ZONGO',
    prenom: 'Boukare',
    numeroPersonnel: '76445566',
    // Aucun code agent sur aucun réseau : la cellule doit dire « - ».
    localite: 'Bobo-Dioulasso',
    agentCommercial: 'SAWADOGO Inoussa',
    dateAjout: '03/04/2026',
  },
  {
    id: 'c3',
    nom: 'TRAORE',
    prenom: 'Salimata',
    numeroPersonnel: '70998877',
    wave: '1006210',
    localite: 'Koudougou',
    agentCommercial: 'ZABSONRE Alizeta',
    dateAjout: '15/09/2026',
  },
]

/** Les quatre tuiles de tête, telles que `useDashboardData` les alimente. */
const STATS = {
  totalClients: 412,
  monthlyClients: 38,
  dailyClients: 6,
  topClient: null,
}

function poserLesMocks({ designSystem, clients = CLIENTS }) {
  vi.doMock('../../src/config/activeClientProfile.js', () => ({
    activeProfile: {
      ...pilotProfile,
      id: 'profil-de-test',
      branding: { appName: 'ESAHAF', pwaName: 'ESAHAF', theme: 'orange' },
      design: { system: designSystem ?? 'legacy' },
      networks: { enabled: RESEAUX_ESAHAF },
    },
  }))
  vi.doMock('../../src/config/firebase', () => ({
    auth: {},
    db: {},
    functions: {},
    firebaseInfo: { projectId: 'test', isDev: true, useEmulators: false },
    default: {},
  }))

  // `ClientsContext` est consommé par `useContext`, donc la doublure doit être
  // un VRAI contexte React : sans Provider, `useContext` rend la valeur par
  // défaut, et c'est exactement ce qu'on veut injecter ici.
  vi.doMock('../../src/context/ClientsContext.jsx', async () => {
    const React = await import('react')
    return { ClientsContext: React.createContext({ clients, loading: false }) }
  })

  vi.doMock('../../src/hooks/useAllTransactions.js', () => ({
    useAllTransactions: () => [],
  }))
  vi.doMock('../../src/hooks/useDashboardData.js', () => ({
    useDashboardData: () => STATS,
  }))

  const theme = () => ({
    themeClasses: { text: 'text-gray-900', tableHeader: 'bg-gray-100 border-gray-300' },
    backgroundImage: null,
  })
  vi.doMock('../../src/context/ThemeContext.jsx', () => ({ useTheme: theme }))
  vi.doMock('../../src/context/ThemeContext', () => ({ useTheme: theme }))
}

async function monterLeTableauDeBord(options = {}) {
  poserLesMocks(options)
  const { default: Dashboard } = await import('../../src/pages/Dashboard.jsx')
  render(<Dashboard />)
}

const ESAHAF = { designSystem: 'registre' }
const TAOFIC = { designSystem: 'legacy' }

/**
 * Le réchauffage. Il ne monte rien et n'affirme rien : il force Vite à
 * transformer le graphe du tableau de bord une fois pour toutes. Les mocks sont
 * posés d'abord, sinon cet import chargerait les vrais modules et les cas
 * suivants hériteraient d'un registre pollué.
 *
 * `vi.resetModules()` vide le registre, pas le cache de transformation de Vite :
 * chaque cas réimporte donc un module neuf, mais déjà compilé.
 */
beforeAll(async () => {
  poserLesMocks(ESAHAF)
  await import('../../src/pages/Dashboard.jsx')
  vi.resetModules()
  vi.clearAllMocks()
})

beforeEach(() => {
  vi.resetModules()
})
afterEach(() => {
  cleanup()
  vi.resetModules()
  vi.clearAllMocks()
})

describe('TC-171 — ce que le tableau de bord annonce', () => {
  it('porte un titre d\'écran, et un seul', async () => {
    await monterLeTableauDeBord(ESAHAF)

    const titres = screen.getAllByRole('heading', { level: 1 })
    expect(titres).toHaveLength(1)
    expect(titres[0]).toHaveTextContent('Tableau de bord')
  })

  it('montre les quatre tuiles de tête, et ce qu\'elles comptent', async () => {
    // Ces quatre-là survivent à la refonte : la maquette les reprend telles
    // quelles. Les figer, c'est pouvoir prouver qu'on n'a pas perdu l'essentiel
    // en retirant l'accessoire.
    await monterLeTableauDeBord(ESAHAF)

    for (const titre of ['Total Clients', 'Clients ce mois', 'Ajoutés aujourd\'hui', 'Top client du jour']) {
      expect(screen.getByText(titre)).toBeInTheDocument()
    }
    expect(screen.getByText('412')).toBeInTheDocument()
    expect(screen.getByText('38')).toBeInTheDocument()
  })
})

describe('TC-171 — le tableau des derniers clients', () => {
  it('⟲ RETOURNÉ AU LOT L8.1b — TROIS colonnes, et le nom se lit d\'un bloc', async () => {
    // Ce cas figeait SEPT colonnes. « Numéro personnel », « Code agent » et
    // « Commercial » sont des informations de FICHE : on les consulte en ouvrant
    // un client, jamais depuis l'accueil. Elles coûtaient un tableau qui déborde
    // à 375 px — et c'étaient justement les colonnes de droite, les moins
    // utiles, qui devenaient les plus difficiles à atteindre au doigt.
    //
    // « Nom » et « Prénom » fusionnent : personne ne lit un nom sans son prénom,
    // et deux colonnes pour une seule identité doublaient la largeur pour rien.
    await monterLeTableauDeBord(ESAHAF)

    // ⚠ CE CAS LISAIT TOUS LES EN-TETES DE L'ECRAN, et il n'y avait alors qu'un
    // seul tableau. Le lot L8.1e en a ajoute un second — celui qui double
    // l'anneau de repartition (Reseau / Clients / Part) — et le cas a rougi en
    // annoncant six colonnes. Il avait RAISON de rougir : il ne disait pas DE
    // QUEL tableau il parlait. On le lui fait dire, plutot que d'elargir la
    // liste attendue — ce qui l'aurait rendu vrai pour de mauvaises raisons.
    const derniersClients = screen
      .getAllByRole('table')
      .find((t) => t.textContent.includes('Nom et prénom'))
    expect(derniersClients, 'le tableau des derniers clients doit être rendu').toBeTruthy()

    const entetes = within(derniersClients)
      .getAllByRole('columnheader')
      .map((c) => c.textContent.trim())
    expect(entetes).toEqual(['Nom et prénom', 'Localité', 'Date d\'ajout'])
  })

  it('⟲ RETOURNÉ AU LOT L8.1b — la colonne « Code agent » n\'existe plus, et le défaut de contraste avec elle', async () => {
    // Ce cas figeait la PRÉSENCE de la colonne, parce que c'est elle qui portait
    // le défaut : le code agent s'affichait en `text-orange-600` sur blanc, soit
    // 3,57:1 contre 4,5:1 exigé.
    //
    // Le contraste n'a pas été « corrigé » — la colonne qui le portait a été
    // retirée. C'est la meilleure façon de régler un défaut d'accessibilité :
    // supprimer ce qui n'avait pas à être là, plutôt que repeindre.
    //
    // ⚠ La tolérance qui gelait ce contraste dans la boucle QA doit disparaître
    // EN MÊME TEMPS : elle exige que le défaut soit encore là, et rougit sinon.
    // C'est exactement ce pour quoi elle a été écrite de cette façon.
    await monterLeTableauDeBord(ESAHAF)

    expect(screen.queryByRole('columnheader', { name: 'Code agent' })).toBeNull()
    expect(screen.queryByText('Orange: 1004500')).toBeNull()
  })

  it('nomme chaque client d\'un seul tenant, et dit « - » là où la donnée manque', async () => {
    await monterLeTableauDeBord(ESAHAF)

    expect(screen.getByText('OUEDRAOGO/KABORE Wendkuuni Alizeta')).toBeInTheDocument()

    // ZONGO n'a pas de localité renseignée ? Si — mais un client sans localité
    // doit rendre « - » plutôt qu'une cellule vide, qu'un lecteur d'écran
    // annonce comme un blanc sans dire de quoi il s'agit.
    const lignes = screen.getAllByRole('row')
    const ligneZongo = lignes.find((l) => l.textContent.includes('ZONGO'))
    expect(within(ligneZongo).getByText('Bobo-Dioulasso')).toBeInTheDocument()
  })

  it('dit ce qu\'il a à dire quand il n\'y a aucun client', async () => {
    await monterLeTableauDeBord({ ...ESAHAF, clients: [] })

    expect(screen.getByText('Aucun client enregistré')).toBeInTheDocument()
  })
})

describe('TC-171 — les cinq graphiques', () => {
  it('⟲ RETOURNÉ AU LOT L8.1c — un seul graphique reste, et c\'est celui qu\'on lit', async () => {
    // Ce cas figeait CINQ graphiques. « Évolution du CA », « Top agents »,
    // « Fidèles clients » et « Transactions du jour » sont des questions
    // d'ANALYSE, posées une fois par mois par un gérant — pas au comptoir. Elles
    // occupaient précisément la hauteur d'écran des deux chiffres du jour, qui,
    // eux, n'existaient nulle part.
    //
    // « Répartition par réseau » reste : il répond à « où sont mes clients »,
    // et son anneau est doublé d'un tableau nom + compte (DESIGN.md §5).
    await monterLeTableauDeBord(ESAHAF)

    expect(screen.getByText('Répartition par réseau')).toBeInTheDocument()

    for (const parti of [
      'Évolution du CA (14 jours)',
      'Top agents',
      'Fidèles clients (aujourd\'hui)',
      'Transactions du jour',
    ]) {
      expect(screen.queryByText(parti), `« ${parti} » ne doit plus être rendu`).toBeNull()
    }
  })

  it('⟲ RETOURNÉ AU LOT L8.1c — les deux chiffres du jour sont annoncés', async () => {
    // Ce cas figeait leur ABSENCE : ni le nombre d'opérations, ni le chiffre
    // d'affaires du jour ne figuraient sur l'accueil. Il fallait aller les
    // chercher dans l'historique, alors que ce sont les deux nombres qu'un
    // gérant demande en fin de journée.
    await monterLeTableauDeBord(ESAHAF)

    expect(screen.getByText('Ventes du jour')).toBeInTheDocument()
    expect(screen.getByText('Chiffre d\'affaires du jour')).toBeInTheDocument()
  })

  it('les deux chiffres restent COHÉRENTS entre eux, même à zéro', async () => {
    // Le banc ne sème aucune transaction du jour : les deux tuiles doivent donc
    // annoncer zéro — et leur ventilation doit tomber juste avec leur total.
    // Un « 0 » avec « 1 dépôt · 0 retrait » en dessous serait un écran qui ment.
    //
    // La règle elle-même est éprouvée par TC-172, avec son horloge injectée ;
    // ce qu'on vérifie ici, c'est qu'elle arrive intacte jusqu'à l'écran.
    await monterLeTableauDeBord(ESAHAF)

    expect(screen.getByText('0 dépôt · 0 retrait')).toBeInTheDocument()
  })
})

/**
 * ⟲ RETOURNÉ AU LOT L8.1e — LES SIX RÉSEAUX SONT COMPTÉS.
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CES CAS REMPLACENT. Un défaut y était figé : « Répartition par réseau »
 * n'en comptait qu'UN, parce que le calcul était écrit en dur dans le composant
 * (`if (client.orange) networkCounts.Orange++`). C'était juste pour TAOFIC, dont
 * le profil déclare `enabled: ['Orange']`, et faux pour ESAHAF qui en déclare
 * SIX : l'écran annonçait une répartition dont cinq parts manquaient.
 *
 * Le cas gelé exigeait que « Wave » soit ABSENT, alors qu'un client du jeu
 * d'essai en porte le code. Il a rougi dès la correction, exactement comme il
 * avait été écrit pour le faire — une tolérance qui se contente d'ignorer un
 * défaut est un mensonge qui dure ; celle-ci avait une date de péremption.
 *
 * Décision du client, 2026-09-18 : « taofic n'est pas concerné par cela, tout
 * doit être limité ici à salawu qui est multi-réseaux, tous les réseaux ».
 *
 * La règle vit désormais dans `utils/repartitionReseaux.js` (TC-173, 16 cas).
 * Elle parcourt les réseaux DU PROFIL : le dernier bloc de ce fichier vérifie
 * qu'un profil mono-réseau obtient toujours exactement ce qu'il obtenait.
 */
describe('TC-171 — la répartition compte les six réseaux du profil', () => {
  it("⟲ RETOURNÉ — Wave est compté, alors qu'il était tu", async () => {
    // Le jeu d'essai porte un client Orange (c1) et un client Wave (c3).
    await monterLeTableauDeBord(ESAHAF)

    const bloc = document.querySelector('[data-surface="graphique"]')
    expect(bloc, 'le bloc de répartition doit être rendu').not.toBeNull()

    expect(within(bloc).getByText('Orange')).toBeInTheDocument()
    expect(
      within(bloc).getByText('Wave'),
      'Wave était le réseau tu par le calcul en dur',
    ).toBeInTheDocument()
  })

  it('nomme LES SIX réseaux déclarés, y compris ceux à zéro', async () => {
    // Un réseau sans client est l'information qui fait AGIR. L'ancien calcul
    // filtrait `value > 0` : il effaçait la question au lieu d'y répondre.
    await monterLeTableauDeBord(ESAHAF)
    const bloc = document.querySelector('[data-surface="graphique"]')

    for (const reseau of RESEAUX_ESAHAF) {
      expect(
        within(bloc).getByText(reseau),
        `${reseau} doit être nommé, même à zéro`,
      ).toBeInTheDocument()
    }
  })

  it("DOUBLE chaque part d'un nom et d'un compte — l'anneau n'est jamais seul", async () => {
    // C'est « aucune couleur ne porte seule une information », appliquée au seul
    // endroit du produit où elle est difficile : un graphique EST une couleur.
    await monterLeTableauDeBord(ESAHAF)
    const bloc = document.querySelector('[data-surface="graphique"]')

    const tableau = within(bloc).getByRole('table')
    const entetes = within(tableau)
      .getAllByRole('columnheader')
      .map((c) => c.textContent.trim())
    expect(entetes).toEqual(['Réseau', 'Clients', 'Part'])
  })

  it("décrit la répartition ENTIÈRE à qui n'a pas d'écran", async () => {
    // L'étiquette énumère tout, zéros compris : taire un réseau ici rendrait
    // l'anneau plus informatif que sa description, ce qui est l'inverse du but.
    await monterLeTableauDeBord(ESAHAF)

    const anneau = screen.getByRole('img')
    const etiquette = anneau.getAttribute('aria-label')
    for (const reseau of RESEAUX_ESAHAF) {
      expect(etiquette).toContain(reseau)
    }
    expect(etiquette).toContain('Orange 1')
    expect(etiquette).toContain('Wave 1')
    expect(etiquette).toContain('Telecel 0')
  })

  it("AVERTIT qu'un client multi-réseaux est compté dans chacun", async () => {
    // Sans cette phrase, un gérant qui additionne les parts et tombe au-dessus
    // de son nombre de clients croit à une erreur de comptage.
    await monterLeTableauDeBord(ESAHAF)
    const bloc = document.querySelector('[data-surface="graphique"]')

    expect(
      within(bloc).getByText(/compté dans chacun/i),
    ).toBeInTheDocument()
  })
})

describe('TC-171 — TAOFIC partage cet écran, et ne doit pas bouger', () => {
  it('garde ses CINQ graphiques, que le registre n\'en rende plus qu\'un', async () => {
    // `App.jsx:129` sert le même composant à tous les clients boutique. C'est ce
    // qui rend le lot L8.1 dangereux : retirer quatre graphiques les retirerait
    // AUSSI à un client en production, qui n'a rien demandé.
    //
    // ⚠ CE TITRE A ÉTÉ CORRIGÉ AU LOT L8.1c. Il disait « les mêmes graphiques
    // qu'ESAHAF aujourd'hui » — vrai tant que les deux profils en rendaient
    // cinq, faux dès que le registre est passé à un. Le corps du cas, lui,
    // n'a pas changé : c'est bien la même exigence, et c'est maintenant qu'elle
    // sépare les deux identités au lieu de constater qu'elles se ressemblent.
    await monterLeTableauDeBord(TAOFIC)

    for (const titre of [
      'Évolution du CA (14 jours)',
      'Répartition par réseau',
      'Top agents',
      'Fidèles clients (aujourd\'hui)',
      'Transactions du jour',
    ]) {
      expect(screen.getByText(titre)).toBeInTheDocument()
    }
  })

  it('rend les SEPT colonnes des derniers clients', async () => {
    await monterLeTableauDeBord(TAOFIC)

    expect(screen.getAllByRole('columnheader')).toHaveLength(7)
  })

  it('ne reçoit PAS les deux chiffres du jour', async () => {
    // Le cloisonnement se prouve dans les deux sens. Les cas précédents disent
    // que TAOFIC n'a rien PERDU ; celui-ci dit qu'il n'a rien REÇU. Sans lui, un
    // `<ChiffresDuJour />` remonté d'une ligne — hors du garde `IS_REGISTRE` —
    // passerait tout le filet au vert en ajoutant deux tuiles à un écran de
    // production.
    //
    // ⚠ Ce n'est pas une question de goût. « Chiffre d'affaires du jour » ne
    // somme que les opérations VALIDÉES, selon une règle écrite pour cette
    // refonte (`utils/chiffresDuJour.js`, TC-172). La poser sur l'écran d'un
    // client qui ne l'a pas demandée lui ferait lire un nombre dont personne ne
    // lui a expliqué la convention.
    await monterLeTableauDeBord(TAOFIC)

    expect(screen.queryByText('Ventes du jour')).toBeNull()
    expect(screen.queryByText('Chiffre d\'affaires du jour')).toBeNull()
  })
})
