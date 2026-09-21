/**
 * TC-165 — Filet de caractérisation de l'ÉCRAN CLIENTS (`ClientsTable` +
 *          `TableRow`), l'un des dix points d'entrée de l'espace boutique.
 *
 * Ce que ce fichier fige
 * ─────────────────────────────────────────────────────────────────────────────
 * Les colonnes et leur ordre, les trois actions de ligne, la recherche (qui
 * porte sur TOUS les réseaux), le filtre par mois, et ce que l'écran dit quand
 * il n'a rien à montrer.
 *
 * Aucune assertion sur une classe CSS : sur les en-têtes rendus, les rôles, les
 * noms accessibles et les textes visibles.
 *
 * DEUX DÉFAUTS SONT FIGÉS TELS QUELS (⚠ DÉFAUT FIGÉ) :
 *
 *   1. `onDelete` est passé à `TableRow` et n'y est JAMAIS consommé — le bouton
 *      « Supprimer » est désactivé en dur. C'est la leçon d'ARCHITECTURE.md §10
 *      (« avant de dessiner une porte, vérifier qu'elle ouvre sur quelque
 *      chose ») prise sur le fait, dans ce dépôt-ci.
 *   2. L'écran ne connaît QU'UN SEUL vide : « Aucun client trouvé. » répond
 *      aussi bien à « cette boutique n'a pas encore de client » qu'à « votre
 *      recherche ne donne rien ». Ce ne sont pas le même écran, et les
 *      confondre laisse l'utilisateur sans issue (DESIGN.md §10).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup, fireEvent } from '@testing-library/react'
// ⚠ AJOUTE LE 2026-09-21, ET CE N'EST PAS UN AMENAGEMENT DE CONFORT.
//
// L'ecran Clients porte desormais « Ajouter un client », qui mene au Formulaire.
// C'est un <Link> et non un <button> : une navigation doit survivre au
// Ctrl+clic, au clic-milieu et au menu contextuel. Un <Link> exige un contexte
// de routeur — le composant depend donc reellement du routage, et c'est au
// harnais de le fournir, pas au composant de s'en passer.
import { MemoryRouter } from 'react-router-dom'
import { pilotProfile } from '../../config/clients/_pilot.js'

vi.setConfig({ testTimeout: 30_000 })

const RESEAUX_ESAHAF = ['Orange', 'Moov', 'Telecel', 'Coris', 'Sank', 'Wave']

/**
 * Trois clients au contenu réel : le nom composé qui déborde, le client d'une
 * ancienne base sans boutique d'enregistrement, et celui qui n'a de compte que
 * sur un seul réseau. Le nom le plus long est dedans (METHODE §16.3).
 */
const CLIENTS = [
  {
    id: 'c1',
    registeredStoreName: 'ESAHAF Ouagadougou — Zone du Bois',
    nom: 'OUEDRAOGO/KABORE',
    prenom: 'Wendkuuni Alizeta',
    numeroIdentite: 'B10240031',
    numeroPersonnel: '70112233',
    orange: '1 004 500',
    moov: '1 004 813',
    numerosAgent: { orange: '70112233', moov: '70113344' },
    localite: 'Ouagadougou — Zone du Bois, Secteur 13',
    agentCommercial: 'ZABSONRE Alizeta',
    dateAjout: '15/09/2026',
  },
  {
    id: 'c2',
    registeredStoreName: null,
    nom: 'ZONGO',
    prenom: 'Boukare',
    numeroIdentite: 'B10190877',
    numeroPersonnel: '76445566',
    sank: '1 005 752',
    numerosAgent: { sank: '76445566' },
    localite: 'Bobo-Dioulasso',
    agentCommercial: 'SAWADOGO Inoussa',
    dateAjout: '03/04/2026',
  },
  {
    id: 'c3',
    registeredStoreName: 'ESAHAF Ouagadougou — Zone du Bois',
    nom: 'TRAORE',
    prenom: 'Salimata',
    numeroIdentite: 'B10221145',
    numeroPersonnel: '70998877',
    wave: '1 006 210',
    numerosAgent: {},
    localite: 'Koudougou',
    agentCommercial: 'ZABSONRE Alizeta',
    dateAjout: '15/09/2026',
  },
]

function poserLesMocks() {
  vi.doMock('../../src/config/activeClientProfile.js', () => ({
    activeProfile: {
      ...pilotProfile,
      id: 'profil-de-test',
      branding: { appName: 'ESAHAF', pwaName: 'ESAHAF', theme: 'orange' },
      design: { system: 'registre' },
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
  // `themedTable` et `ClientsTable` déduisent leur bordure en découpant cette
  // chaîne : la doublure doit donc porter une classe de bordure en 2e position,
  // sans quoi le composant casse pour une raison qui n'a rien à voir avec ce
  // qu'on mesure. C'est exactement le contrat implicite relevé en M4 du bilan.
  const theme = () => ({
    themeClasses: { tableHeader: 'bg-gray-100 border-gray-300', text: 'text-gray-900' },
    backgroundImage: null,
  })
  vi.doMock('../../src/context/ThemeContext.jsx', () => ({ useTheme: theme }))
  vi.doMock('../../src/context/ThemeContext', () => ({ useTheme: theme }))
  // L'export Excel a son propre chemin (xlsx chargé à la demande) : on observe
  // l'appel sans embarquer la bibliothèque dans un test de rendu.
  vi.doMock('../../src/hooks/useExcelOperations', () => ({
    useExcelOperations: () => ({
      isImporting: false,
      fileInputRef: { current: null },
      handleExport: exportAppele,
      handleImportClick: () => {},
      handleFileImport: () => {},
    }),
  }))
}

let exportAppele

async function monterLesClients(proprietes = {}) {
  poserLesMocks()
  const React = await import('react')
  const { AuthContext } = await import('../../src/context/AuthContext')
  const { default: ClientsTable } = await import('../../src/components/ClientsTable.jsx')

  render(
    <MemoryRouter>
      <AuthContext.Provider
        value={{ activeStore: { id: 'b1', name: 'ESAHAF Ouagadougou — Zone du Bois' } }}
      >
        <ClientsTable clients={CLIENTS} {...proprietes} />
      </AuthContext.Provider>
    </MemoryRouter>,
  )
  return React
}

/** Les noms de famille effectivement rendus dans le corps du tableau. */
function nomsAffiches() {
  const corps = screen.getByRole('table').querySelector('tbody')
  return Array.from(corps.querySelectorAll('tr')).map(
    (tr) => tr.querySelectorAll('td')[1].textContent,
  )
}

beforeEach(() => {
  exportAppele = vi.fn()
  vi.resetModules()
})
afterEach(() => {
  cleanup()
  vi.resetModules()
  vi.clearAllMocks()
})

describe('TC-165 — les colonnes de l\'écran Clients', () => {
  it('rend les colonnes dans cet ordre, une par réseau du profil', async () => {
    await monterLesClients()

    const entetes = screen.getAllByRole('columnheader').map((th) => th.textContent)
    expect(entetes).toEqual([
      'Boutique',
      'Nom',
      'Prénom',
      "Numéro d'identité",
      'Numéro personnel',
      'Code agent Orange',
      'Code agent Moov',
      'Code agent Telecel',
      'Code agent Coris',
      'Code agent Sank',
      'Code agent Wave',
      'Localité',
      'Agent commercial',
      "Date d'ajout",
      'Actions',
    ])
  })

  it('remplace une boutique d\'enregistrement absente par « Ancienne base »', async () => {
    // Un vide ne se rend jamais vide : le client importé avant le cloisonnement
    // par boutique porte une mention, pas une cellule blanche.
    await monterLesClients()

    expect(screen.getByText('Ancienne base')).toBeInTheDocument()
  })

  it('porte le numéro d\'agent en info-bulle de la cellule du code', async () => {
    await monterLesClients()

    const ligne = screen.getByText('OUEDRAOGO/KABORE').closest('tr')
    expect(within(ligne).getByText('1 004 500')).toHaveAttribute(
      'title',
      'N° agent: 70112233',
    )
  })

  it('rend le tableau atteignable au clavier et le nomme', async () => {
    // Constat Q3 : quatorze colonnes ne tiennent pas dans un téléphone ; sans
    // focalisation, les dernières sont hors d'atteinte sans souris.
    await monterLesClients()

    const zone = screen.getByRole('region', { name: /tableau des clients/i })
    expect(zone).toHaveAttribute('tabindex', '0')
  })
})

describe('TC-165 — les trois actions de ligne', () => {
  it('propose Modifier, Code d\'accès et Supprimer sur chaque ligne', async () => {
    await monterLesClients({ onEdit: () => {}, onAccessCode: () => {} })

    const ligne = screen.getByText('ZONGO').closest('tr')
    expect(within(ligne).getByRole('button', { name: 'Modifier' })).toBeEnabled()
    expect(within(ligne).getByRole('button', { name: "Code d'accès" })).toBeEnabled()
    expect(within(ligne).getByRole('button', { name: 'Supprimer' })).toBeDisabled()
  })

  it('masque « Code d\'accès » quand aucun rappel n\'est fourni', async () => {
    await monterLesClients({ onEdit: () => {} })

    expect(screen.queryByTestId('btn-access-code')).toBeNull()
  })

  it('remonte le client entier à l\'édition, pas son seul identifiant', async () => {
    const onEdit = vi.fn()
    await monterLesClients({ onEdit })

    const ligne = screen.getByText('TRAORE').closest('tr')
    fireEvent.click(within(ligne).getByRole('button', { name: 'Modifier' }))

    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'c3', nom: 'TRAORE' }))
  })

  it('⚠ DÉFAUT FIGÉ — « Supprimer » est une porte qui n\'ouvre sur rien', async () => {
    // État actuel : `ClientsTable` transmet `onDelete` à `TableRow`, qui ne le
    // lit jamais ; le bouton est `disabled` en dur, avec son motif en
    // info-bulle. La prop passée n'est pas une prop consommée.
    //
    // Le motif est légitime (base clients commune), donc le défaut n'est pas le
    // bouton désactivé : c'est la prop fantôme, qui laisse croire à un appelant
    // qu'il peut brancher une suppression.
    //
    // ⟲ À RETOURNER AU LOT L8.2 : soit la prop disparaît, soit le bouton la
    // consomme — pas les deux à moitié. Aucun changement de règle métier :
    // la suppression reste refusée.
    const onDelete = vi.fn()
    await monterLesClients({ onDelete, onEdit: () => {} })

    const bouton = screen.getAllByRole('button', { name: 'Supprimer' })[0]
    expect(bouton).toBeDisabled()
    expect(bouton).toHaveAttribute(
      'title',
      'Suppression désactivée pour protéger la base clients commune',
    )

    fireEvent.click(bouton)
    expect(onDelete).not.toHaveBeenCalled()
  })
})

describe('TC-165 — la recherche et le filtre par mois', () => {
  it('cherche dans le nom, le prénom et le numéro personnel', async () => {
    await monterLesClients()
    const champ = screen.getByPlaceholderText(/nom, prénom, code ou numéro agent/i)

    fireEvent.change(champ, { target: { value: 'Boukare' } })
    expect(nomsAffiches()).toEqual(['ZONGO'])

    fireEvent.change(champ, { target: { value: '70998877' } })
    expect(nomsAffiches()).toEqual(['TRAORE'])
  })

  it('cherche dans le code agent de TOUS les réseaux, pas seulement le premier', async () => {
    // C'est la raison d'être de la colonne par réseau : un caissier a sous les
    // yeux le code d'un réseau quelconque, pas forcément Orange.
    await monterLesClients()
    const champ = screen.getByPlaceholderText(/nom, prénom, code ou numéro agent/i)

    fireEvent.change(champ, { target: { value: '1 006 210' } })
    expect(nomsAffiches()).toEqual(['TRAORE'])
  })

  it('cherche aussi dans le numéro d\'agent, qui n\'est pourtant pas affiché', async () => {
    await monterLesClients()
    const champ = screen.getByPlaceholderText(/nom, prénom, code ou numéro agent/i)

    fireEvent.change(champ, { target: { value: '70113344' } })
    expect(nomsAffiches()).toEqual(['OUEDRAOGO/KABORE'])
  })

  it('filtre par mois d\'ajout, sur un champ nommé', async () => {
    await monterLesClients()

    // ⚠ LE NOM DU CHAMP A CHANGE, ET DANS LE BON SENS.
    //
    // Il etait porte par `aria-label="Filtrer par mois"` — un nom CACHE, pose
    // faute de mieux (constat Q4 de la boucle QA : le champ n'avait aucun nom).
    // La maquette donne au bloc de filtre un <label> VISIBLE, « Mois ». Un nom
    // visible vaut toujours mieux qu'un nom cache : il sert aussi ceux qui
    // voient. L'intention du test — « sur un champ nomme » — est donc mieux
    // servie qu'avant, pas relachee.
    const mois = screen.getByLabelText(/^mois$/i)
    fireEvent.change(mois, { target: { value: 'Avril' } })

    expect(nomsAffiches()).toEqual(['ZONGO'])
  })

  it('porte le nombre de clients filtrés sur le bouton d\'export', async () => {
    await monterLesClients()

    // Le separateur du compte suit la maquette : « Exporter (XLSM) · 3 », et
    // non « (3) ». Le nombre, lui, reste celui des clients FILTRES — c'est ce
    // que ce test garde, et cela n'a pas bouge.
    expect(screen.getByRole('button', { name: /Exporter \(XLSM\) · 3/ })).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText(/nom, prénom, code ou numéro agent/i), {
      target: { value: 'ZONGO' },
    })
    expect(screen.getByRole('button', { name: /Exporter \(XLSM\) · 1/ })).toBeInTheDocument()
  })

  it('exporte la sélection affichée, jamais la base entière', async () => {
    await monterLesClients()

    fireEvent.change(screen.getByPlaceholderText(/nom, prénom, code ou numéro agent/i), {
      target: { value: 'ZONGO' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Exporter \(XLSM\)/ }))

    expect(exportAppele).toHaveBeenCalledWith([expect.objectContaining({ nom: 'ZONGO' })])
  })
})

describe('TC-165 — ce que l\'écran dit quand il n\'a rien à montrer', () => {
  it('⚠ DÉFAUT FIGÉ — un seul vide pour deux situations distinctes', async () => {
    // État actuel : la même phrase « Aucun client trouvé. » répond à
    // « aucun client enregistré » et à « aucun résultat pour cette recherche ».
    // Elle ne propose aucune issue — ni « enregistrer un client », ni « effacer
    // la recherche » — et n'est ni un titre, ni une région annoncée.
    //
    // `ui/EmptyState` existe et sait proposer une action ; il sert neuf écrans
    // dans admin et dealer, et ZÉRO en boutique.
    //
    // ⟲ À RETOURNER AU LOT L8.2 : deux états vides distincts, chacun avec son
    // issue.
    await monterLesClients()

    // Cas 1 — aucune recherche, aucun client.
    cleanup()
    poserLesMocks()
    const { AuthContext } = await import('../../src/context/AuthContext')
    const { default: ClientsTable } = await import('../../src/components/ClientsTable.jsx')
    render(
      <MemoryRouter>
        <AuthContext.Provider value={{ activeStore: { id: 'b1' } }}>
          <ClientsTable clients={[]} />
        </AuthContext.Provider>
      </MemoryRouter>,
    )
    const videSansDonnee = screen.getByText('Aucun client trouvé.').textContent

    // Cas 2 — des clients existent, mais la recherche ne rend rien.
    cleanup()
    await monterLesClients()
    fireEvent.change(screen.getByPlaceholderText(/nom, prénom, code ou numéro agent/i), {
      target: { value: 'NOM QUI N EXISTE PAS' },
    })
    const videApresRecherche = screen.getByText('Aucun client trouvé.').textContent

    // Les deux situations rendent aujourd'hui exactement la même phrase.
    expect(videApresRecherche).toBe(videSansDonnee)
    expect(screen.queryByRole('button', { name: /effacer|réinitialiser/i })).toBeNull()
  })
})
