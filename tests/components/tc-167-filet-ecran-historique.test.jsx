/**
 * TC-167 — Filet de caractérisation de l'ÉCRAN HISTORIQUE (`HistoriqueTable`).
 *
 * Ce que ce fichier fige
 * ─────────────────────────────────────────────────────────────────────────────
 * Les dix colonnes et leur ordre, le montant rendu, le sens de l'opération écrit
 * en toutes lettres, la valeur par défaut du statut, le fenêtrage au-delà de
 * soixante lignes, et ce que l'écran dit quand il n'a rien à montrer.
 *
 * ⚠ POURQUOI CE FICHIER EXISTE ALORS QUE TC-091 ET TC-152 COUVRENT DÉJÀ CET
 *   ÉCRAN — et c'est le point le plus important de ce lot.
 *
 * Ces deux fichiers sélectionnent par le STYLE, et pas par le comportement :
 *
 *   • `tc-091` identifie les lignes de données par `td.border` — c'est-à-dire
 *     par leur BORDURE. C'est très exactement la leçon consignée dans
 *     ARCHITECTURE.md §10 (« un test qui sélectionne par une classe de style est
 *     une bombe à retardement »), présente ici à l'état vif : le lot L7.2 retire
 *     le quadrillage des cellules, et ce compteur de lignes retombera à zéro
 *     sans qu'aucun comportement de virtualisation n'ait bougé.
 *
 *   • `tc-152` asserte `bg-green-100`, `bg-orange-100`, `border-green-500` et
 *     l'absence de `.border-green-300`. Il interdit littéralement le restyle
 *     qu'on vient faire.
 *
 * Ces deux fichiers ne sont PAS modifiés ici : ils disent la vérité d'aujourd'hui
 * et ils sont verts. Ils seront RETOURNÉS au lot qui les invalide (L7.2 pour le
 * quadrillage, L8.4 pour les teintes de sens), avec la raison écrite dans le
 * test. Ce fichier-ci pose la couverture qui, elle, SURVIVRA au restyle : mêmes
 * faits, sélectionnés sur ce que la page EST — rôles, noms accessibles, textes,
 * `aria-hidden` — et jamais sur ce à quoi elle ressemble.
 *
 * UN DÉFAUT EST FIGÉ TEL QUEL (⚠ DÉFAUT FIGÉ) : la présentation du statut ne
 * dépend pas de sa valeur — une opération « Annulée » porte la même pastille
 * qu'une « Validée ».
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'

vi.mock('../../src/context/ThemeContext.jsx', () => ({
  useTheme: () => ({
    themeClasses: { tableHeader: 'bg-gray-100 border-gray-300', text: 'text-gray-800' },
  }),
}))

import HistoriqueTable from '../../src/components/historique/HistoriqueTable.jsx'

const COLONNES = [
  'Date & heure',
  'Client',
  // ⚠ « Type » est devenu « Nature » le 2026-09-21. L'ecran Transactions et la
  // maquette emploient « Nature » ; deux noms pour une meme colonne faisaient
  // apprendre deux langues au caissier. Le CONTENU de la colonne n'a pas bouge,
  // et c'est ce que les autres cas de ce fichier verifient.
  'Nature',
  'Réseau',
  'Code',
  'Montant',
  'Statut',
  'Utilisateur',
  'Email utilisateur',
  'Reçu',
]

function operation(surcharge = {}) {
  return {
    id: 'h1',
    date: '15/09/2026 08:12',
    client: { nom: 'OUEDRAOGO/KABORE', prenom: 'Wendkuuni Alizeta' },
    type: 'Dépôt',
    reseau: 'Orange',
    code: '1 004 500',
    montant: 1250000,
    statut: 'Validée',
    operatorName: 'ZABSONRE Alizeta',
    operatorEmail: 'alizeta@esahaf.bf',
    ...surcharge,
  }
}

/**
 * Lignes de données = celles qui ne sont pas des espaceurs de fenêtrage.
 *
 * Les espaceurs portent `aria-hidden="true"` — une propriété d'ACCESSIBILITÉ,
 * donc un fait stable — là où `tc-091` les distingue par la présence d'une
 * bordure. C'est la même intention, prise sur ce que la page est.
 */
const lignesDeDonnees = () =>
  Array.from(document.querySelectorAll('tbody tr')).filter(
    (tr) => tr.getAttribute('aria-hidden') !== 'true' && tr.querySelector('td[data-montant]'),
  )

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("TC-167 — les colonnes de l'historique", () => {
  it('rend les dix colonnes dans cet ordre', () => {
    render(<HistoriqueTable transactions={[operation()]} />)

    expect(screen.getAllByRole('columnheader').map((th) => th.textContent.trim())).toEqual(
      COLONNES,
    )
  })

  it('déclare la réglure sur l\'en-tête ET sur la cellule de montant', () => {
    // Sans la déclaration sur l'en-tête, la réglure démarrerait à la première
    // ligne de données et paraîtrait tronquée sous le titre de colonne.
    render(<HistoriqueTable transactions={[operation()]} />)

    expect(
      screen.getByRole('columnheader', { name: 'Montant' }).hasAttribute('data-montant'),
    ).toBe(true)
    expect(document.querySelectorAll('tbody td[data-montant]')).toHaveLength(1)
  })

  it('rend le montant groupé par milliers, suivi de sa devise', () => {
    render(<HistoriqueTable transactions={[operation()]} />)

    const montant = document.querySelector('tbody td[data-montant]').textContent
    expect(montant.replace(/\s+/g, ' ')).toBe('1 250 000 FCFA')
  })

  it('rend un tiret plutôt qu\'une cellule blanche quand une valeur manque', () => {
    // Un vide ne se rend jamais vide : une cellule blanche se lit comme une
    // colonne mal alignée, un tiret se lit comme « pas de valeur ».
    render(
      <HistoriqueTable
        transactions={[
          operation({ montant: null, amount: null, code: null, operatorName: null, operatorEmail: null }),
        ]}
      />,
    )

    const ligne = lignesDeDonnees()[0]
    expect(within(ligne).getAllByText('-').length).toBeGreaterThanOrEqual(3)
  })

  it('écrit le type en toutes lettres — la couleur ne le porte pas seule', () => {
    // La pastille de sens est un renfort visuel ; le mot reste lisible sans
    // elle, en noir et blanc comme en daltonisme (DESIGN.md §5).
    render(
      <HistoriqueTable
        transactions={[
          operation({ id: 'a', type: 'Dépôt' }),
          operation({ id: 'b', type: 'Retrait' }),
          operation({ id: 'c', type: 'Crédit' }),
        ]}
      />,
    )

    for (const mot of ['Dépôt', 'Retrait', 'Crédit']) {
      expect(screen.getByText(mot)).toBeInTheDocument()
    }
  })

  it('rend la zone défilante atteignable au clavier et la nomme', () => {
    render(<HistoriqueTable transactions={[operation()]} />)

    const zone = screen.getByRole('region', { name: /historique des transactions/i })
    expect(zone).toHaveAttribute('tabindex', '0')
  })

  it('propose un reçu sur chaque ligne', () => {
    render(
      <HistoriqueTable
        transactions={[operation({ id: 'a' }), operation({ id: 'b' })]}
      />,
    )

    expect(screen.getAllByRole('button', { name: 'Reçu' })).toHaveLength(2)
  })
})

describe('TC-167 — le statut', () => {
  it('retombe sur « Validée » quand aucun statut n\'est enregistré', () => {
    // Logique de VALEUR, à conserver telle quelle : l'historique d'origine ne
    // stocke pas de statut sur les opérations validées.
    render(<HistoriqueTable transactions={[operation({ statut: undefined })]} />)

    expect(screen.getByText('Validée')).toBeInTheDocument()
  })

  it('affiche le statut enregistré quand il existe', () => {
    render(<HistoriqueTable transactions={[operation({ statut: 'Annulée' })]} />)

    expect(screen.getByText('Annulée')).toBeInTheDocument()
    expect(screen.queryByText('Validée')).toBeNull()
  })

  it('⚠ DÉFAUT FIGÉ — la présentation du statut ne dépend PAS de sa valeur', () => {
    // État actuel : `HistoriqueTable` peint la pastille de statut à l'identique
    // quelle que soit la valeur. Une opération ANNULÉE porte donc exactement la
    // même pastille qu'une opération VALIDÉE — la couleur affirme le contraire
    // du mot qu'elle entoure. C'est un défaut relevé une première fois sur le
    // chantier C2EGF, et présent ici sous la même forme.
    //
    // ⚠ CE TEST NE NOMME AUCUNE COULEUR, DÉLIBÉRÉMENT. Il compare deux rendus
    // l'un à l'autre : un restyle qui change la teinte des DEUX le laisse vert,
    // et seul le fait de faire suivre la couleur au mot le fait rougir. C'est
    // la seule forme qui fige le défaut sans interdire le travail à venir.
    //
    // ⟲ À RETOURNER AU LOT L8.4 : l'assertion deviendra `not.toBe`, et la
    // logique de valeur (`statut ?? 'Validée'`) restera inchangée.
    const presentationDuStatut = (valeur) => {
      cleanup()
      render(<HistoriqueTable transactions={[operation({ statut: valeur })]} />)
      return screen.getByText(valeur).getAttribute('class')
    }

    expect(presentationDuStatut('Annulée')).toBe(presentationDuStatut('Validée'))
  })
})

describe('TC-167 — les états et le fenêtrage', () => {
  it('⚠ DÉFAUT FIGÉ — le vide est une phrase en cellule, sans issue', () => {
    // Une phrase écrite à la main, sans titre ni action proposée, et un seul
    // vide pour deux situations (aucun historique / aucun résultat de filtre).
    //
    // ⟲ À RETOURNER AU LOT L8.4.
    render(<HistoriqueTable transactions={[]} />)

    const cellule = screen.getByText("Aucune transaction dans l'historique")
    expect(cellule.tagName).toBe('TD')
    expect(cellule).toHaveAttribute('colspan', String(COLONNES.length))
    expect(within(cellule).queryByRole('button')).toBeNull()
  })

  it('sous le seuil, rend toutes les lignes', () => {
    const operations = Array.from({ length: 30 }, (_, i) =>
      operation({ id: `h${i}`, montant: 1000 * (i + 1) }),
    )
    render(<HistoriqueTable transactions={operations} />)

    expect(lignesDeDonnees()).toHaveLength(30)
  })

  it('au-delà du seuil, ne rend qu\'une fenêtre — et masque les espaceurs', () => {
    // Le fenêtrage est une optimisation de rendu : les lignes-espaceurs qui
    // tiennent la hauteur ne doivent pas être annoncées comme du contenu.
    const operations = Array.from({ length: 500 }, (_, i) =>
      operation({ id: `h${i}`, montant: 1000 * (i + 1) }),
    )
    render(<HistoriqueTable transactions={operations} />)

    expect(lignesDeDonnees().length).toBeLessThan(500)
    expect(lignesDeDonnees().length).toBeGreaterThan(0)

    for (const espaceur of document.querySelectorAll('tbody tr[aria-hidden="true"]')) {
      expect(within(espaceur).queryByRole('button')).toBeNull()
    }
  })
})
