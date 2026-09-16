/**
 * TC-170 — Un squelette de chargement qui porte un nom doit porter un rôle.
 *
 * LA RÈGLE
 * ─────────────────────────────────────────────────────────────────────────────
 * ARIA n'autorise `aria-label` que sur un élément dont le rôle accepte d'être
 * nommé. Un <div> nu a le rôle implicite `generic`, qui l'INTERDIT : le nom est
 * alors ignoré par les lecteurs d'écran, et `aria-busy` posé au même endroit ne
 * dit rien non plus, faute de région à laquelle l'attacher. axe le classe
 * `aria-prohibited-attr`, impact serious.
 *
 * Le libellé était donc écrit pour personne — le pire genre d'accessibilité,
 * celui qui rassure à la lecture du code sans rien apporter à l'usage.
 *
 * POURQUOI `status` ET PAS SIMPLEMENT UN RÔLE PERMIS
 * `role="status"` est une région live discrète (`aria-live="polite"` implicite) :
 * elle annonce le chargement sans voler le focus ni interrompre la lecture en
 * cours. `role="region"` aurait aussi accepté le nom, mais aurait promis une
 * zone de navigation durable là où il n'y a qu'un état transitoire.
 *
 * POURQUOI CE FILET EXISTE, ALORS QUE LA BOUCLE QA SCANNE DÉJÀ AVEC AXE
 * Un squelette n'existe QUE pendant le chargement. La boucle ne le voyait donc
 * que lorsqu'elle scannait à cet instant précis — le défaut apparaissait ou non
 * selon la vitesse de la machine. Un filet unitaire ne dépend pas de cet
 * instant : il rend le composant directement, et le squelette est toujours là.
 *
 * `SkeletonList` ne sert que les espaces admin et dealer, hors du périmètre du
 * chantier de refonte : ces composants sont corrigés à la demande explicite du
 * client, après signalement.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { SkeletonTable, SkeletonCards } from '../../src/components/ui/SkeletonList.jsx'

afterEach(cleanup)

/** Tout conteneur qui se déclare occupé ET porte un nom. */
function squelettesNommes(conteneur) {
  return [...conteneur.querySelectorAll('[aria-busy="true"][aria-label]')]
}

describe('TC-170 — les squelettes de chargement', () => {
  /** Le même contrôle pour les deux squelettes : le rendu diffère, la règle non. */
  function verifierLeNom(rendu) {
    const nommes = squelettesNommes(rendu.container)
    expect(nommes.length, 'le squelette doit se déclarer occupé et nommé').toBeGreaterThan(0)

    for (const element of nommes) {
      expect(element.getAttribute('role')).toBe('status')
      // Le nom doit exister ET vouloir dire quelque chose : un `aria-label`
      // vide est exactement aussi muet qu'un rôle interdit.
      expect(element.getAttribute('aria-label').trim().length).toBeGreaterThan(0)
    }
  }

  it('SkeletonTable : son nom est porté par un rôle qui l’accepte', () => {
    verifierLeNom(render(<SkeletonTable />))
  })

  it('SkeletonCards : son nom est porté par un rôle qui l’accepte', () => {
    verifierLeNom(render(<SkeletonCards />))
  })

  it('les lignes factices restent HORS de l’arbre d’accessibilité', () => {
    // Les barres grises n'ont aucun contenu à annoncer. Sans `aria-hidden`, un
    // lecteur d'écran énumérerait cinq lignes et vingt cellules vides avant
    // d'arriver aux vraies données. Ce comportement existait déjà ; on le fige
    // en même temps que la correction, pour qu'il ne parte pas avec elle.
    const { container } = render(<SkeletonTable rows={3} cols={4} />)

    const lignes = [...container.querySelectorAll('tr')]
    expect(lignes).toHaveLength(3)
    for (const ligne of lignes) {
      expect(ligne).toHaveAttribute('aria-hidden', 'true')
    }
  })
})
