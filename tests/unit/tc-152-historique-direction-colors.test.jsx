/**
 * TC-152 — Code couleur entrée/sortie de l'historique (UX).
 *
 * Caractérise le sens présentationnel (n'affecte AUCUN solde) :
 *   - util : Dépôt/Reçue/Créance = ENTRÉE (vert) ; Retrait/Envoyée/Dette = SORTIE (orange) ;
 *     Crédit/inconnu = NEUTRE (gris) ; robuste aux accents/casse ;
 *   - rendu HistoriqueTable : le Type est une pastille colorée selon le sens, la grille
 *     verte codée en dur (border-green-300) a disparu, le liseré de ligne suit le sens.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  directionFromType,
  directionFromSens,
  directionStyles,
  DIRECTION,
} from '../../src/utils/transactionDirection.js'

vi.mock('../../src/context/ThemeContext.jsx', () => ({
  useTheme: () => ({ themeClasses: { tableHeader: 'bg-gray-100 border-gray-300', text: 'text-gray-800' } }),
}))

import HistoriqueTable from '../../src/components/historique/HistoriqueTable.jsx'

describe('TC-152 — util sens entrée/sortie', () => {
  it('directionFromType : Dépôt=entrée, Retrait=sortie, Crédit=neutre (accents/casse tolérés)', () => {
    expect(directionFromType('Dépôt')).toBe(DIRECTION.IN)
    expect(directionFromType('depot')).toBe(DIRECTION.IN)
    expect(directionFromType('Retrait')).toBe(DIRECTION.OUT)
    expect(directionFromType('RETRAIT')).toBe(DIRECTION.OUT)
    expect(directionFromType('Crédit')).toBe(DIRECTION.NEUTRAL)
    expect(directionFromType(undefined)).toBe(DIRECTION.NEUTRAL)
  })

  it('directionFromSens : Reçue/Créance=entrée, Envoyée/Dette=sortie', () => {
    expect(directionFromSens('Reçue')).toBe(DIRECTION.IN)
    expect(directionFromSens('Créance')).toBe(DIRECTION.IN)
    expect(directionFromSens('Envoyée')).toBe(DIRECTION.OUT)
    expect(directionFromSens('Dette')).toBe(DIRECTION.OUT)
    expect(directionFromSens('autre')).toBe(DIRECTION.NEUTRAL)
  })

  it('directionStyles : vert pour entrée, orange pour sortie, gris en repli', () => {
    expect(directionStyles(DIRECTION.IN).badge).toContain('green')
    expect(directionStyles(DIRECTION.OUT).badge).toContain('orange')
    expect(directionStyles('inconnu').badge).toContain('gray')
  })
})

const tx = (over) => ({
  id: 'tx', client: 'Client X', reseau: 'Orange', code: '1234',
  montant: 1000, statut: 'Validée', date: '04/08/2026 06:23', ...over,
})

describe('TC-152 — HistoriqueTable : couleurs entrée/sortie', () => {
  it('le Type est une pastille colorée selon le sens (vert/orange/gris)', () => {
    render(<HistoriqueTable transactions={[
      tx({ id: 'a', type: 'Dépôt' }),
      tx({ id: 'b', type: 'Retrait' }),
      tx({ id: 'c', type: 'Crédit' }),
    ]} />)

    expect(screen.getByText('Dépôt').className).toContain('bg-green-100')
    expect(screen.getByText('Retrait').className).toContain('bg-orange-100')
    expect(screen.getByText('Crédit').className).toContain('bg-gray-100')
  })

  it('la grille verte codée en dur a disparu (plus aucun border-green-300)', () => {
    render(<HistoriqueTable transactions={[tx({ type: 'Dépôt' })]} />)
    expect(document.querySelectorAll('.border-green-300')).toHaveLength(0)
  })

  it('le liseré de ligne suit le sens : vert pour un Dépôt, orange pour un Retrait', () => {
    render(<HistoriqueTable transactions={[
      tx({ id: 'a', type: 'Dépôt' }),
      tx({ id: 'b', type: 'Retrait' }),
    ]} />)
    const firstCell = (label) => screen.getByText(label).closest('tr').querySelector('td')
    expect(firstCell('Dépôt').className).toContain('border-green-500')
    expect(firstCell('Retrait').className).toContain('border-orange-500')
  })
})
