/**
 * TC-118 — Vocabulaire du tableau teinté (themedTableClasses).
 *
 * La classe de bordure était extraite par `themeClasses.tableHeader.split(' ')[1]`,
 * un index positionnel répété 12 fois dans 3 fichiers. Il suppose que tableHeader
 * vaut exactement deux classes : le jour où un thème en déclare une troisième (ou
 * l'ordonne autrement), tous les tableaux perdent leur bordure sans erreur visible.
 *
 * Ce test verrouille l'extraction par recherche du jeton `border-`, et vérifie que
 * les sept thèmes livrés produisent tous une bordure exploitable.
 */

import { describe, it, expect } from 'vitest'
import { themedTableClasses } from '../../src/components/ui/themedTable.js'
import { THEMES } from '../../src/constants/themes.js'

describe('TC-118 — themedTableClasses', () => {
  it('extrait la bordure du thème orange', () => {
    const tbl = themedTableClasses({ tableHeader: 'bg-orange-100/80 border-orange-300', text: 'text-gray-900' })
    expect(tbl.border).toBe('border-orange-300')
    expect(tbl.container).toContain('border-orange-300')
    expect(tbl.headerRow).toBe('bg-orange-100/80 border-orange-300')
  })

  it('trouve la bordure même si le thème déclare une classe supplémentaire', () => {
    // Le cas que .split(' ')[1] échouait : il aurait renvoyé 'shadow-sm'.
    const tbl = themedTableClasses({ tableHeader: 'bg-orange-100/80 shadow-sm border-orange-300' })
    expect(tbl.border).toBe('border-orange-300')
  })

  it('trouve la bordure même si elle est déclarée en premier', () => {
    const tbl = themedTableClasses({ tableHeader: 'border-purple-300 bg-purple-100/80' })
    expect(tbl.border).toBe('border-purple-300')
  })

  it('retombe sur une bordure grise quand le thème est absent ou muet', () => {
    expect(themedTableClasses().border).toBe('border-gray-300')
    expect(themedTableClasses({}).border).toBe('border-gray-300')
    expect(themedTableClasses({ tableHeader: '' }).border).toBe('border-gray-300')
    expect(themedTableClasses({ tableHeader: 'bg-red-100' }).border).toBe('border-gray-300')
  })

  it('retombe sur une couleur de texte lisible quand le thème n\'en fournit pas', () => {
    expect(themedTableClasses({ tableHeader: 'bg-x border-x' }).title).toContain('text-gray-900')
  })

  it('produit une bordure exploitable pour tous les thèmes livrés', () => {
    // Liste explicite plutôt qu'un compte : quand elle casse, elle dit LEQUEL a
    // été ajouté ou perdu. Le nombre nu ne le disait pas.
    //   registre → ESAHAF (design.system = 'registre')
    //   dark     → tout profil 'legacy', dont TAOFIC en production
    // Les six autres ont été retirés (Lot 4) : plus aucun chemin de code ne
    // pouvait les sélectionner depuis le retrait de la page de personnalisation.
    const ids = Object.keys(THEMES)
    expect(new Set(ids)).toEqual(new Set(['registre', 'dark']))
    for (const id of ids) {
      const tbl = themedTableClasses(THEMES[id].classes)
      // La nuance numérique est FACULTATIVE : les thèmes historiques déclarent une
      // couleur de palette (`border-orange-300`), l'identité déclare un jeton
      // (`border-filet`, dérivé de --color-filet). Les deux sont des classes
      // Tailwind valides ; ce qui compte est qu'une bordure soit produite.
      expect(tbl.border, `thème ${id}`).toMatch(/^border-[a-z]+(-\d{2,3})?$/)
      for (const key of ['title', 'container', 'headerCell', 'headerCellCenter', 'cell', 'empty']) {
        expect(tbl[key], `thème ${id} → ${key}`).not.toContain('undefined')
      }
    }
  })

  it('sépare les variantes d\'alignement au lieu de les concaténer', () => {
    // text-left et text-center ont la même spécificité CSS : les concaténer rendrait
    // le résultat dépendant de l'ordre de la feuille générée, pas de l'attribut class.
    const tbl = themedTableClasses(THEMES.dark.classes)
    expect(tbl.headerCell).toContain('text-left')
    expect(tbl.headerCell).not.toContain('text-center')
    expect(tbl.headerCellCenter).toContain('text-center')
    expect(tbl.headerCellCenter).not.toContain('text-left')
  })

  it('n\'expose jamais de couleur codée en dur hors du repli gris', () => {
    const tbl = themedTableClasses(THEMES.dark.classes)
    for (const key of ['container', 'headerCell', 'cell', 'empty']) {
      expect(tbl[key], key).not.toContain('border-green-300')
    }
  })
})
