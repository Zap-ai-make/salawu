/**
 * TC-094 — NetworkCardsDrawer : rideau boutique adapté au nombre de réseaux du profil.
 *
 * `IS_MULTI_NETWORK` est figé à l'import depuis activeProfile.networks.enabled.
 *   • Mono-réseau (TAOFIC) → barre compacte « Soldes » (comportement historique, inchangé) :
 *     PAS de rideau « Cartes Réseau », pas de bouton de repli.
 *   • Multi-réseaux (ex. salawu, 5 réseaux) → rideau repliable « Cartes Réseau »
 *     (design d'origine restauré) : bouton présent, déplié par défaut, ouvrable/fermable,
 *     une carte par réseau + Liquidité.
 *
 * On force chaque profil via vi.doMock + resetModules (constantes évaluées à l'import).
 * Les cartes enfants sont mockées (le test cible le BRANCHEMENT du rideau, pas leur DOM).
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
  vi.resetModules()
  vi.clearAllMocks()
})

async function loadDrawer(enabled) {
  vi.resetModules()
  vi.doMock('../../src/config/activeClientProfile.js', () => ({
    activeProfile: { networks: { enabled } },
  }))
  vi.doMock('../../src/hooks/useSimpleNetworkData', () => ({
    useSimpleNetworkData: () => ({
      networkData: Object.fromEntries(
        [...enabled, 'Liquidite'].map(n => [n, { stock: 0, liquidite: 0 }]),
      ),
    }),
  }))
  vi.doMock('../../src/components/network/NetworkCard', () => ({
    default: ({ network }) => <div data-testid="network-card">{network}</div>,
  }))
  vi.doMock('../../src/components/network/NetworkBalanceCard', () => ({
    default: ({ network }) => <div data-testid="balance-card">{network}</div>,
  }))
  const mod = await import('../../src/components/network/NetworkCardsDrawer.jsx')
  return mod.default
}

describe('TC-094 — NetworkCardsDrawer (mono vs multi-réseaux)', () => {
  it('mono (TAOFIC) → barre « Soldes », aucun rideau « Cartes Réseau »', async () => {
    const Drawer = await loadDrawer(['Orange'])
    render(<Drawer />)

    expect(screen.getByText('Soldes')).toBeInTheDocument()
    expect(screen.queryByText('Cartes Réseau')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    // Orange + Liquidité
    expect(screen.getAllByTestId('network-card')).toHaveLength(2)
  })

  it('multi (salawu, 5 réseaux) → rideau « Cartes Réseau », déplié par défaut, 6 cartes', async () => {
    const Drawer = await loadDrawer(['Orange', 'Moov', 'Telecel', 'Coris', 'Sank'])
    render(<Drawer />)

    expect(screen.getByText('Cartes Réseau')).toBeInTheDocument()
    expect(screen.queryByText('Soldes')).toBeNull()
    // 5 réseaux + Liquidité
    expect(screen.getAllByTestId('balance-card')).toHaveLength(6)

    const toggle = screen.getByRole('button')
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })

  it('multi → le rideau se ferme puis se rouvre', async () => {
    const Drawer = await loadDrawer(['Orange', 'Moov', 'Telecel', 'Coris', 'Sank'])
    render(<Drawer />)

    const toggle = screen.getByRole('button')
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })
})
