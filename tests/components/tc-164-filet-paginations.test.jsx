/**
 * TC-164 — Filet de caractérisation des DEUX paginations de l'espace boutique :
 *          `Pagination` (listes) et `DailyPagination` (navigation par jour).
 *
 * Pourquoi les deux dans un même fichier
 * ─────────────────────────────────────────────────────────────────────────────
 * Ce sont deux dispositifs qui font le même travail avec deux dessins et deux
 * vocabulaires. La refonte les alignera ; on fige d'abord ce qu'ils DISENT, pour
 * pouvoir montrer ensuite que rien n'a été perdu en chemin.
 *
 * Aucune assertion sur une classe CSS : sur le texte visible, les rôles, les
 * noms accessibles et les valeurs remontées aux appelants.
 *
 * UN DÉFAUT EST FIGÉ TEL QUEL (⚠ DÉFAUT FIGÉ) : l'état vide de `DailyPagination`
 * est une phrase écrite à la main qui ne propose aucune issue. C'est l'un des
 * quatorze « Aucun… » relevés au diagnostic, sur les onze écrans boutique où
 * `ui/EmptyState` n'est appelé nulle part.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, within, cleanup, fireEvent } from '@testing-library/react'

import Pagination from '../../src/components/Pagination.jsx'
import DailyPagination from '../../src/components/historique/DailyPagination.jsx'

/** Une page de résultats au volume réel du métier : 412 clients, 25 par page. */
const PAGE_TYPE = {
  currentPage: 2,
  totalPages: 17,
  totalItems: 412,
  pageSize: 25,
  startIndex: 26,
  endIndex: 50,
  hasNextPage: true,
  hasPrevPage: true,
  onPageChange: () => {},
  onPageSizeChange: () => {},
}

function transaction(date, id) {
  return { id, date, montant: 12500, type: 'Dépôt' }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('TC-164 — Pagination : ce qu\'elle annonce', () => {
  it('ne rend rien tant qu\'il n\'y a qu\'une page', () => {
    // Une pagination à une seule page est du bruit : elle occupe une rangée
    // pour ne proposer aucun déplacement.
    const { container } = render(
      <Pagination {...PAGE_TYPE} totalPages={1} hasNextPage={false} hasPrevPage={false} />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('annonce la tranche affichée et le total, en toutes lettres', () => {
    render(<Pagination {...PAGE_TYPE} />)

    const phrase = screen.getByText(/Affichage de/).textContent.replace(/\s+/g, ' ')
    expect(phrase).toBe('Affichage de 26 à 50 sur 412 résultats')
  })

  it('associe l\'étiquette « Éléments par page » à son champ', () => {
    // Association `htmlFor`/`id` et NON un `aria-label` plus descriptif : faire
    // diverger le nom accessible du texte affiché casse la commande vocale
    // (WCAG 2.5.3). C'est la règle retenue au traitement du constat Q1.
    render(<Pagination {...PAGE_TYPE} />)

    expect(screen.getByLabelText(/éléments par page/i).tagName).toBe('SELECT')
  })

  it('garde des étiquettes distinctes quand deux paginations coexistent', () => {
    // `useId` et non une chaîne fixe : des identifiants dupliqués rattacheraient
    // les deux étiquettes au PREMIER champ — invisible à l'œil, bien réel au
    // lecteur d'écran. Deux tableaux paginés sur un même écran, c'est le cas
    // ordinaire de l'historique.
    render(
      <>
        <Pagination {...PAGE_TYPE} />
        <Pagination {...PAGE_TYPE} />
      </>,
    )

    const champs = screen.getAllByLabelText(/éléments par page/i)
    expect(champs).toHaveLength(2)
    expect(champs[0].id).not.toBe(champs[1].id)
  })

  it('remonte un NOMBRE, jamais la chaîne du champ', () => {
    // `Number(e.target.value)` : une taille de page en chaîne ferait dériver
    // tous les calculs d'index en concaténation silencieuse.
    const onPageSizeChange = vi.fn()
    render(<Pagination {...PAGE_TYPE} onPageSizeChange={onPageSizeChange} />)

    fireEvent.change(screen.getByLabelText(/éléments par page/i), { target: { value: '50' } })

    expect(onPageSizeChange).toHaveBeenCalledWith(50)
  })

  it('désactive « Précédent » en première page et « Suivant » en dernière', () => {
    const { unmount } = render(
      <Pagination {...PAGE_TYPE} currentPage={1} hasPrevPage={false} />,
    )
    expect(screen.getByRole('button', { name: 'Précédent' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Suivant' })).toBeEnabled()
    unmount()

    render(<Pagination {...PAGE_TYPE} currentPage={17} hasNextPage={false} />)
    expect(screen.getByRole('button', { name: 'Précédent' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Suivant' })).toBeDisabled()
  })

  it('rend l\'ellipsis inerte plutôt que cliquable', () => {
    render(<Pagination {...PAGE_TYPE} currentPage={9} />)

    for (const bouton of screen.getAllByRole('button', { name: '...' })) {
      expect(bouton).toBeDisabled()
    }
  })
})

describe('TC-164 — DailyPagination : la navigation par jour', () => {
  it('⚠ DÉFAUT FIGÉ — l\'état vide est une phrase sans issue', () => {
    // État actuel : un texte écrit à la main, aucun titre, aucune action
    // proposée. `ui/EmptyState` existe, sert neuf écrans dans admin et dealer,
    // et ZÉRO en boutique — qui aligne quatorze phrases « Aucun… » de ce genre.
    // L'état vide est une invitation à agir, pas un trou (DESIGN.md §10).
    //
    // ⟲ À RETOURNER AU LOT L8.4 : l'assertion exigera alors un état vide nommé,
    // distinguant « rien » de « rien qui corresponde au filtre ».
    render(<DailyPagination transactions={[]} onDateSelect={() => {}} />)

    expect(screen.getByText('Aucune transaction disponible')).toBeInTheDocument()
    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('groupe par jour et accorde le décompte au singulier comme au pluriel', () => {
    render(
      <DailyPagination
        transactions={[
          transaction('15/09/2026 08:12', 't1'),
          transaction('15/09/2026 14:30', 't2'),
          transaction('14/09/2026 09:05', 't3'),
        ]}
        onDateSelect={() => {}}
      />,
    )

    expect(screen.getByText('2 transactions')).toBeInTheDocument()
    expect(screen.getByText('1 transaction')).toBeInTheDocument()
  })

  it('trie les jours du plus récent au plus ancien', () => {
    render(
      <DailyPagination
        transactions={[
          transaction('12/09/2026 10:00', 't1'),
          transaction('15/09/2026 10:00', 't2'),
          transaction('13/09/2026 10:00', 't3'),
        ]}
        onDateSelect={() => {}}
      />,
    )

    const jours = screen
      .getAllByRole('button')
      .map((b) => within(b).queryByText(/^\d{2}\/\d{2}\/\d{4}$/)?.textContent)
      .filter(Boolean)

    expect(jours).toEqual(['15/09/2026', '13/09/2026', '12/09/2026'])
  })

  it('pagine par semaines de sept jours et annonce où l\'on se trouve', () => {
    const transactions = Array.from({ length: 10 }, (_, i) =>
      transaction(`${String(i + 1).padStart(2, '0')}/09/2026 10:00`, `t${i}`),
    )
    render(<DailyPagination transactions={transactions} onDateSelect={() => {}} />)

    expect(screen.getByText('Page 1 sur 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /précédent/i })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /suivant/i }))

    expect(screen.getByText('Page 2 sur 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /suivant/i })).toBeDisabled()
  })

  it('émet la clé du jour LOCAL, identique en début et en fin de plage', () => {
    // Le cadran est celui de `matchesDateFilter` (local, via parsefrenchDate +
    // localDayKey) et non UTC : un décalage d'un jour entre l'affichage et le
    // filtre faisait qu'un clic sur une carte n'affichait rien.
    const onDateSelect = vi.fn()
    render(
      <DailyPagination
        transactions={[transaction('15/09/2026 23:45', 't1')]}
        onDateSelect={onDateSelect}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /15\/09\/2026/ }))

    expect(onDateSelect).toHaveBeenCalledWith({ from: '2026-09-15', to: '2026-09-15' })
  })
})
