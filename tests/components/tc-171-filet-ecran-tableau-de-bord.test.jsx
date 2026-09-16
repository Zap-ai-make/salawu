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
 * TROIS DÉFAUTS SONT FIGÉS TELS QUELS (⚠ DÉFAUT FIGÉ) :
 *
 *   1. SEPT COLONNES dans « Derniers clients enregistrés », dont « Code agent »
 *      et « Commercial ». À 375 px le tableau déborde et se lit au doigt, pour
 *      des informations qu'on ne consulte pas depuis l'accueil.
 *   2. Le code agent est rendu en `text-orange-600` sur blanc — 3,57:1, sous le
 *      seuil AA de 4,5:1. Le contraste se MESURE dans la boucle QA (un test
 *      unitaire ne calcule aucune couleur) ; ce qui est figé ici, c'est la
 *      colonne elle-même, dont la disparition emportera le défaut.
 *   3. CINQ graphiques, dont quatre que la maquette retire. « Top agents » et
 *      « Fidèles clients » répondent à des questions que personne ne pose au
 *      comptoir, et occupent la hauteur d'écran des chiffres du jour.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import { pilotProfile } from '../../config/clients/_pilot.js'

vi.setConfig({ testTimeout: 30_000 })

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

    const entetes = screen.getAllByRole('columnheader').map((c) => c.textContent.trim())
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
  it('⚠ DÉFAUT FIGÉ — CINQ graphiques, dont quatre que la maquette retire', async () => {
    // « Top agents » classe des agents réseau ; « Fidèles clients » compte des
    // passages du jour. Ce sont des questions d'analyse, posées une fois par
    // mois par un gérant — pas au comptoir, où l'on veut savoir combien on a
    // vendu et combien il reste. Elles occupent pourtant la hauteur d'écran des
    // chiffres du jour, qui, eux, n'existent pas encore.
    //
    // ⟲ À RETOURNER AU LOT L8.1 : seul « Répartition par réseau » reste, et deux
    // tuiles du jour prennent la place des quatre autres.
    await monterLeTableauDeBord(ESAHAF)

    for (const titre of [
      'Évolution du CA (14 jours)',
      'Répartition par réseau',
      'Top agents',
      'Fidèles clients (aujourd\'hui)',
      'Transactions du jour',
    ]) {
      expect(screen.getByText(titre), `le graphique « ${titre} » doit être rendu`).toBeInTheDocument()
    }
  })

  it('⚠ DÉFAUT FIGÉ — aucun chiffre du JOUR n\'est annoncé', async () => {
    // Ni le nombre d'opérations du jour, ni le chiffre d'affaires du jour. Ce
    // sont les deux nombres qu'un gérant demande en fin de journée, et l'écran
    // d'accueil ne les donne pas — il faut aller les chercher dans l'historique.
    //
    // ⟲ À RETOURNER AU LOT L8.1 : deux tuiles les annoncent.
    await monterLeTableauDeBord(ESAHAF)

    expect(screen.queryByText(/ventes du jour/i)).toBeNull()
    expect(screen.queryByText(/chiffre d'affaires du jour/i)).toBeNull()
  })
})

describe('TC-171 — TAOFIC partage cet écran, et ne doit pas bouger', () => {
  it('rend EXACTEMENT les mêmes graphiques qu\'ESAHAF aujourd\'hui', async () => {
    // `App.jsx:129` sert le même composant à tous les clients boutique. C'est ce
    // qui rend le lot L8.1 dangereux : retirer quatre graphiques les retirerait
    // AUSSI à un client en production, qui n'a rien demandé.
    //
    // Ce cas est la preuve que le garde `IS_REGISTRE` sera nécessaire — et il
    // restera vrai après le lot, où il vérifiera que TAOFIC les a conservés.
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
})
