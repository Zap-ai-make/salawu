/**
 * TC-166 — Filet de caractérisation de l'ÉCRAN TRANSACTIONS
 *          (`TransactionTable` + les règles d'action de `utils/helpers.js`).
 *
 * Ce que ce fichier fige
 * ─────────────────────────────────────────────────────────────────────────────
 * Les sept colonnes et leur ordre, les actions offertes PAR TYPE d'opération —
 * qui sont une règle métier et ne doivent pas bouger d'un iota pendant un
 * restyle —, le montant rendu, le règlement partiel, la forme du squelette de
 * chargement, et ce que l'écran dit quand il n'a rien à montrer.
 *
 * Aucune assertion sur une classe CSS : sur les textes rendus, les rôles, les
 * noms accessibles et les valeurs remontées.
 *
 * ⚠ OÙ EST FIGÉ LE DÉFAUT DE COULEUR, ET POURQUOI PAS ICI
 * Le diagnostic relève deux systèmes de couleur concurrents pour le même fait —
 * `TRANSACTION_STYLES` (Dépôt vert, Retrait bleu, Crédit ROUGE) et
 * `DIRECTION_STYLES` (entrée verte, sortie orange). Le figer par une assertion
 * sur `text-red-600` ferait de ce fichier une bombe à retardement : le test
 * tomberait au premier restyle sans qu'aucun comportement n'ait bougé
 * (ARCHITECTURE.md §10). La teinte réellement peinte se mesure sur le style
 * CALCULÉ, dans la boucle QA navigateur (lot L6.2).
 *
 * Ce qui est figé ici est la STRUCTURE du défaut : deux tables répondent à la
 * même question, et elles ne classent pas « Crédit » dans la même catégorie.
 * C'est cela qui doit disparaître, et c'est vérifiable sans nommer une couleur.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import { pilotProfile } from '../../config/clients/_pilot.js'

vi.setConfig({ testTimeout: 30_000 })

/** Opérations au contenu réel : les trois types, dont un règlement partiel. */
const OPERATIONS = [
  {
    id: 't1',
    date: '15/09/2026 08:12',
    client: { nom: 'OUEDRAOGO/KABORE', prenom: 'Wendkuuni Alizeta' },
    type: 'Dépôt',
    reseau: 'Orange',
    code: '1 004 500',
    montant: 12500,
  },
  {
    id: 't2',
    date: '15/09/2026 09:40',
    client: { nom: 'ZONGO', prenom: 'Boukare' },
    type: 'Retrait',
    reseau: 'Sank',
    code: '1 005 752',
    montant: 1250000,
  },
  {
    id: 't3',
    date: '15/09/2026 10:15',
    client: { nom: 'TRAORE', prenom: 'Salimata' },
    type: 'Crédit',
    reseau: 'Wave',
    code: '1 006 210',
    montant: 40000,
    settlementStatus: 'partial',
    remainingAmount: 15000,
  },
]

function poserLesMocks({ operations = OPERATIONS, chargement = false } = {}) {
  vi.doMock('../../src/config/activeClientProfile.js', () => ({
    activeProfile: {
      ...pilotProfile,
      id: 'profil-de-test',
      branding: { appName: 'ESAHAF', pwaName: 'ESAHAF', theme: 'orange' },
      design: { system: 'registre' },
      networks: { enabled: ['Orange', 'Moov', 'Telecel', 'Coris', 'Sank', 'Wave'] },
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
  vi.doMock('../../src/services/settlementService.js', () => ({
    generateIdempotencyKey: () => 'cle-de-test',
  }))

  // Le contexte est doublé, mais les DEUX fonctions de règle restent les VRAIES :
  // c'est le comportement du produit qu'on fige, pas celui d'une doublure.
  // Une doublure qui a divergé du vrai composant est pire qu'une doublure
  // absente — elle donne confiance dans un rendu qui n'existe pas (METHODE §14).
  vi.doMock('../../src/context/transactions.jsx', async () => {
    const { getAvailableActions, getTransactionStyles, isDraftSettling } = await import(
      '../../src/utils/helpers.js'
    )
    return {
      useTransactions: () => ({
        pendingTransactions: operations,
        loading: chargement,
        getActionButtons: (t) => {
          const actions = getAvailableActions(t.type)
          return isDraftSettling(t) ? { ...actions, modifier: false } : actions
        },
        getTransactionStyles,
        addPaymentTranche: vi.fn(),
        addRefundTranche: vi.fn(),
        startEditTransaction: vi.fn(),
      }),
    }
  })
}

async function monterLeTableau(options) {
  poserLesMocks(options)
  const { default: TransactionTable } = await import(
    '../../src/components/transactions/TransactionTable.jsx'
  )
  render(<TransactionTable />)
}

/** Les libellés des boutons d'action d'une ligne, dans l'ordre du DOM. */
function actionsDeLaLigne(nomClient) {
  const ligne = screen.getByText(new RegExp(nomClient)).closest('tr')
  return within(ligne)
    .getAllByRole('button')
    .map((b) => b.textContent.trim())
}

beforeEach(() => {
  vi.resetModules()
})
afterEach(() => {
  cleanup()
  vi.resetModules()
  vi.clearAllMocks()
})

describe('TC-166 — les actions offertes PAR TYPE (règle métier, intouchable)', () => {
  it.each([
    ['Dépôt', { modifier: true, encaisser: true, payerPar: false, rembourser: false }],
    ['Retrait', { modifier: true, encaisser: false, payerPar: true, rembourser: false }],
    ['Crédit', { modifier: true, encaisser: false, payerPar: false, rembourser: true }],
  ])('%s ouvre exactement ces actions', async (type, attendu) => {
    const { getAvailableActions } = await import('../../src/utils/helpers.js')
    expect(getAvailableActions(type)).toEqual(attendu)
  })

  it('un type inconnu n\'ouvre que « Modifier »', async () => {
    const { getAvailableActions } = await import('../../src/utils/helpers.js')

    expect(getAvailableActions('Transfert')).toEqual({
      modifier: true,
      encaisser: false,
      payerPar: false,
      rembourser: false,
    })
  })

  it('retire « Modifier » dès qu\'un règlement est engagé', async () => {
    // Les règles Firestore figent `type`/`montant`/`clientId` dès la première
    // tranche : proposer « Modifier » enverrait le caissier sur un refus serveur.
    // L'interface s'aligne sur le serveur, elle ne le devine pas.
    await monterLeTableau()

    expect(actionsDeLaLigne('TRAORE')).toEqual(['Rembourser', 'Reçu'])
    expect(actionsDeLaLigne('OUEDRAOGO/KABORE')).toEqual(['Modifier', 'Encaisser', 'Reçu'])
    expect(actionsDeLaLigne('ZONGO')).toEqual(['Modifier', 'Payer par', 'Reçu'])
  })
})

describe('TC-166 — les colonnes du tableau « Non Terminées »', () => {
  it('rend les sept colonnes dans cet ordre', async () => {
    await monterLeTableau()

    expect(screen.getAllByRole('columnheader').map((th) => th.textContent.trim())).toEqual([
      'Date & heure',
      'Client',
      'Type',
      'Réseau',
      'Montant',
      'Actions',
      'Reçu',
    ])
  })

  it('déclare la colonne des montants comme un FAIT, pas comme un style', async () => {
    // `data-montant` est une déclaration émise par le composant ; l'apparence
    // (alignement, réglure) est décidée dans src/index.css sous la seule portée
    // `.design-registre`. C'est ce partage qui évite un `if` de client en JSX.
    await monterLeTableau()

    const entete = screen.getByRole('columnheader', { name: 'Montant' })
    expect(entete.hasAttribute('data-montant')).toBe(true)

    const ligne = screen.getByText(/ZONGO/).closest('tr')
    const cellules = Array.from(ligne.querySelectorAll('td'))
    expect(cellules.filter((td) => td.hasAttribute('data-montant'))).toHaveLength(1)
  })

  it('rend le montant groupé par milliers et suivi de sa devise', async () => {
    await monterLeTableau()

    const ligne = screen.getByText(/ZONGO/).closest('tr')
    const montant = ligne.querySelector('[data-montant]').textContent.replace(/\s+/g, ' ')
    expect(montant).toBe('1 250 000 FCFA')
  })

  it('nomme le réseau ET son code sur la même ligne', async () => {
    await monterLeTableau()

    const ligne = screen.getByText(/TRAORE/).closest('tr')
    expect(within(ligne).getByText('Wave (1 006 210)')).toBeInTheDocument()
  })

  it('annonce le reste dû sur un règlement partiel', async () => {
    // Un total qui s'annonce juste alors qu'il est incomplet est pire que pas de
    // total : le reste est écrit, pas déduit.
    await monterLeTableau()

    const ligne = screen.getByText(/TRAORE/).closest('tr')
    expect(
      within(ligne).getByText((texte) => texte.replace(/\s+/g, ' ') === 'Reste : 15 000 FCFA'),
    ).toBeInTheDocument()
  })
})

describe('TC-166 — les états du tableau', () => {
  it('le squelette de chargement a la FORME du tableau qui arrive', async () => {
    // Un squelette de trois cartes devant un tableau fait sauter la page à
    // l'arrivée des données. Celui-ci rend des lignes à sept cellules : la
    // mise en page ne bouge pas quand les données remplacent le squelette.
    await monterLeTableau({ chargement: true })

    const lignes = screen.getByRole('table').querySelectorAll('tbody tr')
    expect(lignes).toHaveLength(3)
    for (const ligne of lignes) {
      expect(ligne.querySelectorAll('td')).toHaveLength(7)
    }
  })

  it('⚠ DÉFAUT FIGÉ — le vide est une phrase dans une cellule, sans issue', async () => {
    // État actuel : une `<td colSpan=7>` portant « Aucune transaction en
    // attente ». Aucun titre, aucune action proposée, et un seul vide pour
    // deux situations (rien à traiter / rien qui corresponde au filtre).
    // `ui/EmptyState` existe et n'est appelé par aucun écran boutique.
    //
    // ⟲ À RETOURNER AU LOT L8.3 : deux états vides distincts, chacun avec son
    // issue — « enregistrer une transaction » d'un côté, « effacer le filtre »
    // de l'autre.
    await monterLeTableau({ operations: [] })

    const cellule = screen.getByText('Aucune transaction en attente')
    expect(cellule.tagName).toBe('TD')
    expect(cellule).toHaveAttribute('colspan', '7')
    expect(within(cellule).queryByRole('button')).toBeNull()
    expect(within(cellule).queryByRole('heading')).toBeNull()
  })

  it('ne rend jamais deux fois la même opération', async () => {
    // Déduplication par identifiant : un doublon d'abonnement Firestore
    // afficherait la même opération deux fois, et un caissier l'encaisserait
    // deux fois.
    await monterLeTableau({ operations: [...OPERATIONS, OPERATIONS[0]] })

    expect(screen.getAllByText(/OUEDRAOGO\/KABORE/)).toHaveLength(1)
  })
})

describe('TC-166 — ⚠ DÉFAUT FIGÉ : deux systèmes concurrents pour le même fait', () => {
  it('deux tables répondent à la même question avec deux vocabulaires', async () => {
    // `TRANSACTION_STYLES` (utils/constants.js) et `DIRECTION_STYLES`
    // (utils/transactionDirection.js) décrivent tous deux l'apparence d'une
    // opération, avec des clés qui n'ont rien à voir. Deux sources de vérité
    // sur un même fait finissent toujours par diverger.
    //
    // ⟲ À RETOURNER AU LOT L8.3 : une seule source, et cette assertion
    // constatera qu'il n'en reste qu'une.
    const { getTransactionStyles } = await import('../../src/utils/helpers.js')
    const { directionStyles, directionFromType } = await import(
      '../../src/utils/transactionDirection.js'
    )

    expect(Object.keys(getTransactionStyles('Dépôt')).sort()).toEqual(['bgColor', 'textColor'])
    expect(Object.keys(directionStyles(directionFromType('Dépôt'))).sort()).toEqual([
      'accent',
      'badge',
      'rowBg',
    ])
  })

  it('et elles ne classent pas « Crédit » dans la même catégorie', async () => {
    // Par le SENS, un crédit est neutre : c'est une créance, l'argent ne bouge
    // pas. Par le TYPE, il reçoit un style qui lui est propre — celui que le
    // diagnostic relève comme rouge, c'est-à-dire la couleur de l'échec, sur
    // une opération parfaitement normale.
    const { getTransactionStyles } = await import('../../src/utils/helpers.js')
    const { directionFromType, DIRECTION } = await import(
      '../../src/utils/transactionDirection.js'
    )

    expect(directionFromType('Crédit')).toBe(DIRECTION.NEUTRAL)
    // …et pourtant le type ne le traite pas comme un cas neutre.
    expect(getTransactionStyles('Crédit')).not.toEqual(getTransactionStyles('Transfert'))
  })
})
