/**
 * TC-127 — EnvBanner : avertir quand le DEV local tape un Firestore RÉEL.
 *
 * Le bandeau ne s'affiche qu'en dev local sans émulateurs (config qui provoque le
 * crash « Missing or insufficient permissions » + assertion ca9/b815). En build de
 * production (isDev=false) ou en dev sur émulateurs, il reste invisible.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  firebaseInfo: { isDev: true, useEmulators: false, projectId: 'salawu-fa726' },
}))
vi.mock('../../src/config/firebase', () => ({ firebaseInfo: mocks.firebaseInfo }))

import EnvBanner from '../../src/components/EnvBanner.jsx'

beforeEach(() => {
  mocks.firebaseInfo.isDev = true
  mocks.firebaseInfo.useEmulators = false
  mocks.firebaseInfo.projectId = 'salawu-fa726'
})

describe('TC-127 — EnvBanner', () => {
  it('affiche l\'alerte quand DEV tape un Firestore réel (émulateurs off)', () => {
    render(<EnvBanner />)
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert.textContent).toContain('salawu-fa726')
  })

  it('reste invisible quand les émulateurs sont actifs', () => {
    mocks.firebaseInfo.useEmulators = true
    const { container } = render(<EnvBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('reste invisible en build de production (isDev = false)', () => {
    mocks.firebaseInfo.isDev = false
    const { container } = render(<EnvBanner />)
    expect(container).toBeEmptyDOMElement()
  })
})
