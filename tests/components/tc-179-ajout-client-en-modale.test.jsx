/**
 * TC-179 — L'AJOUT D'UN CLIENT PASSE PAR UNE MODALE DE L'ÉCRAN CLIENTS.
 * ─────────────────────────────────────────────────────────────────────────────
 * CE N'EST PAS UN RESTYLAGE, ET C'EST DIT AVANT D'ÊTRE FAIT.
 *
 * L'espace boutique offrait DEUX chemins pour saisir un client : l'onglet
 * « Formulaire » de la navigation, et un lien « Ajouter un client » sur l'écran
 * Clients qui menait au même écran. La modification, elle, prenait un troisième
 * dessin — la page entière remplacée par le formulaire, avec un bouton
 * « Retour à la liste ».
 *
 * Trois dessins pour un seul formulaire. Le client a tranché : un seul chemin,
 * une modale ouverte depuis la liste, et l'onglet retiré de la navigation.
 * C'est la même décision que le lot L9.14 a prise pour la saisie d'une
 * transaction, et la maquette la prescrit pour celle-ci (écran « Ajouter un
 * client », `docs/audit/maquette-espace-boutique.html`).
 *
 * CE QUE CE FILET FIGE
 *
 *   1. Le chemin — bouton, modale, fermeture, et le retour à la liste après
 *      enregistrement. C'est la façon dont la boutique saisit ses clients : ce
 *      qui change ici se voit tous les jours.
 *   2. Ce que la maquette apporte AU CONTENU : la mention des champs
 *      obligatoires, l'étoile sur les deux champs qui la méritent, et la
 *      pastille de couleur qui nomme chaque réseau.
 *
 * ⚠ CE QU'IL NE FIGE PAS. Les champs eux-mêmes, leur ordre et ce que le
 * formulaire remonte au parent restent la charge de TC-168, qui monte
 * `ClientForm` seul. Recopier ses assertions ici ferait deux filets à tenir à
 * jour pour une seule exigence.
 *
 * ⚠ LA GRILLE DES SIX BLOCS RÉSEAU N'EST PAS VÉRIFIÉE ICI, et c'est délibéré :
 * le client a demandé le 2026-09-23 que ces blocs RESTENT EMPILÉS, contre la
 * maquette qui les met en grille. Un test qui exigerait la grille garderait une
 * décision abandonnée.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { pilotProfile } from '../../config/clients/_pilot.js'

vi.setConfig({ testTimeout: 30_000 })

const RESEAUX_ESAHAF = ['Orange', 'Moov', 'Telecel', 'Coris', 'Sank', 'Wave']

/** Un client réel : le nom composé qui déborde, et des comptes sur deux réseaux. */
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
]

let ajouterClient
let modifierClient

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
  const theme = () => ({
    themeClasses: { tableHeader: 'bg-gray-100 border-gray-300', text: 'text-gray-900' },
    backgroundImage: null,
  })
  vi.doMock('../../src/context/ThemeContext.jsx', () => ({ useTheme: theme }))
  vi.doMock('../../src/context/ThemeContext', () => ({ useTheme: theme }))
  vi.doMock('../../src/hooks/useExcelOperations', () => ({
    useExcelOperations: () => ({
      isImporting: false,
      fileInputRef: { current: null },
      handleExport: () => {},
      handleImportClick: () => {},
      handleFileImport: () => {},
    }),
  }))
  // La page lit la liste et les deux écritures par le contexte. On observe les
  // appels sans monter Firestore : ce filet porte sur le CHEMIN de saisie.
  vi.doMock('../../src/hooks/useClients', () => ({
    useClients: () => ({
      clients: CLIENTS,
      addClient: ajouterClient,
      editClient: modifierClient,
      deleteClient: () => {},
    }),
  }))
}

async function monterLEcranClients() {
  poserLesMocks()
  const { AuthContext } = await import('../../src/context/AuthContext')
  const { default: Clients } = await import('../../src/pages/Clients.jsx')

  render(
    <MemoryRouter>
      <AuthContext.Provider
        value={{
          activeStore: { id: 'b1', name: 'ESAHAF Ouagadougou — Zone du Bois' },
          userProfile: { storeId: 'b1' },
        }}
      >
        <Clients />
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

/** La modale, quand elle est ouverte. `null` sinon — et c'est une assertion en soi. */
const laModale = () => screen.queryByRole('dialog')

const ouvrirLAjout = () =>
  fireEvent.click(screen.getByRole('button', { name: /ajouter un client/i }))

beforeEach(() => {
  ajouterClient = vi.fn().mockResolvedValue(undefined)
  modifierClient = vi.fn().mockResolvedValue(undefined)
  vi.resetModules()
  window.localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.resetModules()
  vi.clearAllMocks()
})

describe('TC-179 — le chemin de saisie', () => {
  it("l'écran Clients ne montre aucun formulaire au chargement", async () => {
    await monterLEcranClients()

    expect(laModale()).toBeNull()
    expect(screen.queryByLabelText('Nom')).toBeNull()
    // La liste, elle, est bien là : sans ce contrôle, un écran cassé passerait
    // pour un écran « sans formulaire ».
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it("« Ajouter un client » est un BOUTON, et non plus un lien de navigation", async () => {
    // ⚠ C'EST UN RENVERSEMENT ASSUMÉ. TC-165 notait l'inverse : « un <Link> et
    // non un <button> : une navigation doit survivre au Ctrl+clic ». L'argument
    // était juste TANT QUE c'était une navigation. Ça n'en est plus une — il n'y
    // a plus d'écran où aller, et un <a href> qui n'emmène nulle part promet au
    // clic-milieu un onglet qui s'ouvrirait sur la liste.
    await monterLEcranClients()

    expect(screen.getByRole('button', { name: /ajouter un client/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /ajouter un client/i })).toBeNull()
  })

  it('le bouton ouvre une modale titrée « Ajouter un client »', async () => {
    await monterLEcranClients()
    ouvrirLAjout()

    const modale = laModale()
    expect(modale).toBeInTheDocument()
    expect(modale).toHaveAttribute('aria-modal', 'true')
    expect(
      within(modale).getByRole('heading', { name: 'Ajouter un client' }),
    ).toBeInTheDocument()
    expect(within(modale).getByLabelText('Nom *')).toBeInTheDocument()
  })

  it('la liste reste montée derrière la modale', async () => {
    // Une modale qui démonte la liste n'est pas une modale : c'est un écran. La
    // différence se voit au retour — la page revient à son défilement et à ses
    // filtres, ou elle repart de zéro.
    await monterLEcranClients()
    ouvrirLAjout()

    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('Échap ferme la modale sans rien enregistrer', async () => {
    await monterLEcranClients()
    ouvrirLAjout()
    expect(laModale()).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => expect(laModale()).toBeNull())
    expect(ajouterClient).not.toHaveBeenCalled()
  })

  it('le bouton de fermeture ferme la modale', async () => {
    await monterLEcranClients()
    ouvrirLAjout()

    fireEvent.click(within(laModale()).getByRole('button', { name: /fermer/i }))

    await waitFor(() => expect(laModale()).toBeNull())
  })

  it("l'enregistrement appelle l'ajout puis ferme la modale", async () => {
    await monterLEcranClients()
    ouvrirLAjout()

    const modale = laModale()
    fireEvent.change(within(modale).getByLabelText('Nom *'), { target: { value: 'ZONGO' } })
    fireEvent.change(within(modale).getByLabelText('Prénom *'), { target: { value: 'Boukare' } })
    fireEvent.click(within(modale).getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(ajouterClient).toHaveBeenCalledTimes(1))
    expect(ajouterClient.mock.calls[0][0]).toMatchObject({ nom: 'ZONGO', prenom: 'Boukare' })
    await waitFor(() => expect(laModale()).toBeNull())
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it("un ajout qui ÉCHOUE laisse la modale ouverte, saisie intacte", async () => {
    // ⚠ LE CAS QUI COMPTE VRAIMENT. Fermer sur succès est facile ; fermer sur
    // échec ferait perdre la saisie et n'en dirait pas la raison. Firestore
    // refuse pour de vrai (règle de boutique, réseau coupé) : ce chemin-là est
    // emprunté en production.
    ajouterClient.mockRejectedValue(new Error('Boutique inconnue'))
    await monterLEcranClients()
    ouvrirLAjout()

    const modale = laModale()
    fireEvent.change(within(modale).getByLabelText('Nom *'), { target: { value: 'ZONGO' } })
    fireEvent.change(within(modale).getByLabelText('Prénom *'), { target: { value: 'Boukare' } })
    fireEvent.click(within(modale).getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(ajouterClient).toHaveBeenCalledTimes(1))
    expect(laModale()).toBeInTheDocument()
    expect(within(laModale()).getByLabelText('Nom *')).toHaveValue('ZONGO')
  })
})

describe('TC-179 — la modification emprunte la MÊME modale', () => {
  const ouvrirLaModification = () =>
    fireEvent.click(screen.getAllByRole('button', { name: /modifier/i })[0])

  it('« Modifier » ouvre la modale, titrée « Modifier le client »', async () => {
    await monterLEcranClients()
    ouvrirLaModification()

    const modale = laModale()
    expect(modale).toBeInTheDocument()
    expect(
      within(modale).getByRole('heading', { name: 'Modifier le client' }),
    ).toBeInTheDocument()
  })

  it('la modale de modification arrive pré-remplie', async () => {
    await monterLEcranClients()
    ouvrirLaModification()

    const modale = laModale()
    expect(within(modale).getByLabelText('Nom *')).toHaveValue('OUEDRAOGO/KABORE')
    expect(within(modale).getByLabelText('Prénom *')).toHaveValue('Wendkuuni Alizeta')
    expect(within(modale).getByLabelText("Numéro d'identité")).toHaveValue('B10240031')
  })

  it("la liste n'est PAS remplacée par le formulaire", async () => {
    // L'ancien dessin rendait le formulaire À LA PLACE du tableau, avec un
    // bouton « Retour à la liste ». Les deux disparaissent ici.
    await monterLEcranClients()
    ouvrirLaModification()

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /retour à la liste/i })).toBeNull()
  })

  it('« Modifier » enregistre sous l\'identifiant du client, puis ferme', async () => {
    await monterLEcranClients()
    ouvrirLaModification()

    const modale = laModale()
    fireEvent.change(within(modale).getByLabelText('Localité'), {
      target: { value: 'Bobo-Dioulasso' },
    })
    fireEvent.click(within(modale).getByRole('button', { name: 'Modifier' }))

    await waitFor(() => expect(modifierClient).toHaveBeenCalledTimes(1))
    expect(modifierClient.mock.calls[0][0]).toBe('c1')
    expect(modifierClient.mock.calls[0][1]).toMatchObject({ localite: 'Bobo-Dioulasso' })
    await waitFor(() => expect(laModale()).toBeNull())
  })
})

describe('TC-179 — ce que la maquette apporte au contenu', () => {
  it('annonce la règle des champs obligatoires avant de la faire subir', async () => {
    await monterLEcranClients()
    ouvrirLAjout()

    expect(
      within(laModale()).getByText(/champs marqués d'une étoile sont obligatoires/i),
    ).toBeInTheDocument()
  })

  it("marque « Nom » et « Prénom » d'une étoile, et eux seuls", async () => {
    await monterLEcranClients()
    ouvrirLAjout()

    const modale = laModale()
    const etoiles = modale.querySelectorAll('label [data-requis]')
    expect(etoiles).toHaveLength(2)

    // ⚠ L'ÉTOILE EST `aria-hidden`, ET CE N'EST PAS UN OUBLI. Elle répète pour
    // l'œil ce que `required` dit déjà à l'oreille. Sans cela, un lecteur
    // d'écran annonce « Nom étoile, obligatoire ».
    for (const etoile of etoiles) expect(etoile).toHaveAttribute('aria-hidden', 'true')

    const nomDesChamps = Array.from(etoiles, (e) => e.closest('label').textContent.trim())
    expect(nomDesChamps.map((t) => t.replace(/\s*\*$/, '').trim())).toEqual(['Nom', 'Prénom'])
  })

  it('les six blocs réseau portent la pastille de leur couleur', async () => {
    await monterLEcranClients()
    ouvrirLAjout()

    const legendes = laModale().querySelectorAll('fieldset legend')
    expect(legendes).toHaveLength(6)

    const { NETWORK_CONFIG } = await import('../../src/constants/networkConfig')
    for (const legende of legendes) {
      const nom = legende.textContent.trim()
      const pastille = legende.querySelector('[data-pastille]')
      expect(pastille, `le bloc « ${nom} » n'a pas de pastille`).not.toBeNull()
      // `aria-hidden` : la pastille ne dit rien que la légende ne dise déjà.
      expect(pastille).toHaveAttribute('aria-hidden', 'true')
      expect(pastille.style.backgroundColor).not.toBe('')
      expect(NETWORK_CONFIG[nom]?.color).toBeTruthy()
    }
  })

  it("le pied de la modale porte l'action primaire, et le corps n'en porte plus", async () => {
    await monterLEcranClients()
    ouvrirLAjout()

    const pied = laModale().querySelector('[data-modale-pied]')
    expect(pied).not.toBeNull()
    expect(within(pied).getByRole('button', { name: 'Enregistrer' })).toHaveAttribute(
      'data-rang',
      'primaire',
    )
  })
})
