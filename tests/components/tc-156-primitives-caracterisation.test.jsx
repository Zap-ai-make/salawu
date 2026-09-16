import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import StatCard from '../../src/components/ui/StatCard'
import StatusBadge from '../../src/components/ui/StatusBadge'
import DirectionBadge from '../../src/components/ui/DirectionBadge'
import EmptyState from '../../src/components/ui/EmptyState'
import ErrorState from '../../src/components/ui/ErrorState'
import PageHeader from '../../src/components/ui/PageHeader'
import CardHeader from '../../src/components/ui/CardHeader'
import DashboardCard from '../../src/components/ui/DashboardCard'
import { themedTableClasses } from '../../src/components/ui/themedTable.js'

/**
 * TC-156 — Caractérisation des primitives d'interface partagées.
 *
 * Contexte : le Lot 2 de la refonte (docs/audit/BILAN-DESIGN.md) réécrit ces
 * composants pour les faire dériver des jetons `@theme` au lieu des cinq fichiers
 * de constantes concurrents. Ils sont consommés par une quarantaine d'écrans ; le
 * dépôt n'avait qu'UN seul test de composant. Sans filet, une régression de rendu
 * passerait inaperçue jusqu'en production.
 *
 * CE QUI EST FIGÉ ICI : le contrat de chaque primitive — ce qu'elle affiche, ce
 * qu'elle expose à l'arbre d'accessibilité, comment elle réagit. C'est ce qui doit
 * survivre à une refonte.
 *
 * CE QUI N'EST PAS FIGÉ : les classes Tailwind et les couleurs. Les épingler
 * ferait échouer ces tests à chaque changement du Lot 2 — c'est-à-dire à chaque
 * fois qu'on fait précisément le travail demandé. Un test qu'on met à jour
 * mécaniquement ne protège plus rien.
 */

describe('TC-156 — StatCard', () => {
  it('affiche le libellé, la valeur et le sous-titre', () => {
    render(<StatCard label="Boutiques" value={42} sub="dont 3 inactives" />)

    expect(screen.getByText('Boutiques')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('dont 3 inactives')).toBeInTheDocument()
  })

  it('remplace une valeur absente par un tiret cadratin, jamais par du vide', () => {
    render(<StatCard label="Boutiques" value={null} />)

    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('masque la valeur pendant le chargement', () => {
    render(<StatCard label="Boutiques" value={42} sub="ignoré" loading />)

    expect(screen.queryByText('42')).not.toBeInTheDocument()
    expect(screen.queryByText('ignoré')).not.toBeInTheDocument()
    expect(screen.getByText('Boutiques')).toBeInTheDocument()
  })

  it('devient actionnable au clic ET au clavier quand onClick est fourni', () => {
    const onClick = vi.fn()
    render(<StatCard label="Boutiques" value={1} onClick={onClick} />)
    const carte = screen.getByRole('button')

    fireEvent.click(carte)
    fireEvent.keyDown(carte, { key: 'Enter' })

    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it("n'expose aucun rôle interactif sans onClick", () => {
    render(<StatCard label="Boutiques" value={1} />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it("l'icône est décorative : masquée à l'arbre d'accessibilité", () => {
    const Icone = (props) => <svg data-testid="icone" {...props} />
    const { container } = render(<StatCard label="Boutiques" value={1} icon={Icone} />)

    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument()
  })
})

describe('TC-156 — StatusBadge', () => {
  it('affiche le libellé fourni plutôt que le statut brut', () => {
    render(<StatusBadge status="pending" label="En attente" />)

    expect(screen.getByText('En attente')).toBeInTheDocument()
  })

  it('retombe sur le statut quand aucun libellé n\'est donné', () => {
    render(<StatusBadge status="confirmed" />)

    expect(screen.getByText('confirmed')).toBeInTheDocument()
  })

  it('porte un nom accessible', () => {
    render(<StatusBadge status="rejected" label="Rejetée" />)

    expect(screen.getByLabelText('Rejetée')).toBeInTheDocument()
  })
})

describe('TC-156 — DirectionBadge', () => {
  // Le sens d'un mouvement d'argent ne doit jamais reposer sur la seule couleur :
  // le libellé textuel est la garantie, et il doit survivre au Lot 2.
  it.each([
    ['in', 'Entrée'],
    ['out', 'Sortie'],
    ['neutral', 'Neutre'],
  ])('rend le libellé texte pour la direction %s', (direction, label) => {
    render(<DirectionBadge direction={direction} label={label} />)

    expect(screen.getByText(label)).toBeInTheDocument()
  })
})

describe('TC-156 — EmptyState', () => {
  it('affiche un titre par défaut, et une action quand elle est fournie', () => {
    render(<EmptyState action={<button type="button">Créer</button>} />)

    expect(screen.getByText('Aucun résultat')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Créer' })).toBeInTheDocument()
  })

  it('accepte un titre et un message personnalisés', () => {
    render(<EmptyState title="Aucune transaction" message="Enregistrez la première." />)

    expect(screen.getByText('Aucune transaction')).toBeInTheDocument()
    expect(screen.getByText('Enregistrez la première.')).toBeInTheDocument()
  })
})

describe('TC-156 — ErrorState', () => {
  it('est annoncé comme une alerte et expose le message', () => {
    render(<ErrorState message="Réseau indisponible." />)

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Réseau indisponible.')).toBeInTheDocument()
  })

  it('propose un réessai seulement quand onRetry est fourni', () => {
    const onRetry = vi.fn()
    const { rerender } = render(<ErrorState onRetry={onRetry} />)

    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(onRetry).toHaveBeenCalledTimes(1)

    rerender(<ErrorState />)
    expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument()
  })
})

describe('TC-156 — PageHeader / CardHeader / DashboardCard', () => {
  it('PageHeader rend le titre en h1 — un seul par écran', () => {
    render(<PageHeader title="Transactions" subtitle="Du jour" actions={<button type="button">Ajouter</button>} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Transactions' })).toBeInTheDocument()
    expect(screen.getByText('Du jour')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ajouter' })).toBeInTheDocument()
  })

  it('CardHeader rend le titre en h3 (sous le h1 de la page)', () => {
    render(<CardHeader title="Réseaux" />)

    expect(screen.getByRole('heading', { level: 3, name: 'Réseaux' })).toBeInTheDocument()
  })

  it('DashboardCard rend son titre et son contenu', () => {
    render(<DashboardCard title="Activité"><p>contenu</p></DashboardCard>)

    expect(screen.getByRole('heading', { name: 'Activité' })).toBeInTheDocument()
    expect(screen.getByText('contenu')).toBeInTheDocument()
  })
})

describe('TC-156 — themedTable', () => {
  // Piège identifié au constat M4 : la bordure est déduite en PARSANT une chaîne
  // de classes. Le Lot 2 retire les thèmes ; ces cas figent le contrat pour que
  // la disparition de `tableHeader` se voie ici et pas en production.
  it('extrait la bordure du jeu de classes de l\'entête', () => {
    const t = themedTableClasses({ tableHeader: 'bg-orange-100/80 border-orange-300', text: 'text-gray-900' })

    expect(t.border).toBe('border-orange-300')
    expect(t.headerCell).toContain('border-orange-300')
    expect(t.cell).toContain('border-orange-300')
  })

  it('trouve la bordure quelle que soit sa position dans la chaîne', () => {
    const t = themedTableClasses({ tableHeader: 'border-cyan-200 bg-cyan-100 font-bold' })

    expect(t.border).toBe('border-cyan-200')
  })

  it('retombe sur une bordure grise quand aucune n\'est déclarée', () => {
    expect(themedTableClasses({}).border).toBe('border-gray-300')
    expect(themedTableClasses().border).toBe('border-gray-300')
  })

  it('fournit les variantes gauche et centrée en chaînes complètes', () => {
    const t = themedTableClasses({ tableHeader: 'border-gray-300' })

    expect(t.headerCell).toContain('text-left')
    expect(t.headerCellCenter).toContain('text-center')
    expect(t.headerCellCenter).not.toContain('text-left')
  })

  it('expose toutes les clés attendues par les tableaux', () => {
    const t = themedTableClasses({ tableHeader: 'border-gray-300' })

    // ⟲ RETOURNÉ AU LOT L7.2a : `scroll` a laissé la place à `zoneDefilante`.
    //
    // `scroll` était une simple chaîne de classes. Les huit zones qui s'en
    // servaient défilaient horizontalement sans jamais prendre le focus : sans
    // souris, les colonnes de droite — dont le MONTANT — étaient hors d'atteinte
    // (WCAG 2.1.1). Une clé qui ne rend que l'apparence d'un comportement
    // invitait à oublier le comportement.
    for (const cle of ['border', 'title', 'container', 'zoneDefilante', 'headerRow', 'headerCell', 'headerCellCenter', 'cell', 'cellCenter', 'empty']) {
      expect(t, `clé manquante : ${cle}`).toHaveProperty(cle)
    }

    // Et l'ancienne clé ne doit PAS revenir : sa seule présence permettrait de
    // recréer une zone défilante muette sans que rien ne proteste.
    expect(t, 'la clé `scroll` ne doit pas réapparaître').not.toHaveProperty('scroll')
  })

  it('refuse une zone défilante sans nom accessible', () => {
    // Le libellé est le seul indice donné à l'utilisateur quand son focus entre
    // dans la zone. Accepter son absence en silence aurait produit huit régions
    // annoncées « région », ce qui ne renseigne personne — et le défaut se
    // serait recopié avant d'être remarqué.
    const t = themedTableClasses({ tableHeader: 'border-gray-300' })

    expect(() => t.zoneDefilante()).toThrow(/libellé est obligatoire/i)
    expect(() => t.zoneDefilante('   ')).toThrow(/libellé est obligatoire/i)

    expect(t.zoneDefilante('Historique, défilement horizontal')).toEqual({
      className: 'overflow-x-auto overflow-y-visible',
      tabIndex: 0,
      role: 'region',
      'aria-label': 'Historique, défilement horizontal',
    })
  })
})
