/**
 * TC-153 — Statut de connexion réseau (useOnlineStatus) + OfflineBanner.
 *
 * Caractérise la source unique de détection online/offline extraite d'OfflineBanner :
 *   - le hook reflète navigator.onLine et réagit aux événements 'online'/'offline' ;
 *   - OfflineBanner s'affiche hors-ligne, disparaît en ligne (comportement conservé).
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import { renderHook, act, render, screen, cleanup } from '@testing-library/react'
import useOnlineStatus from '../../src/hooks/useOnlineStatus.js'
import OfflineBanner from '../../src/components/OfflineBanner.jsx'

afterEach(cleanup)

/** Force navigator.onLine puis émet l'événement réseau correspondant. */
function setOnline(value) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value)
  act(() => {
    window.dispatchEvent(new Event(value ? 'online' : 'offline'))
  })
}

describe('TC-153 — useOnlineStatus', () => {
  it('reflète navigator.onLine au montage puis suit les événements réseau', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(true)

    setOnline(false)
    expect(result.current).toBe(false)

    setOnline(true)
    expect(result.current).toBe(true)
  })
})

describe('TC-153 — OfflineBanner', () => {
  it('caché en ligne, visible hors-ligne', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    const { rerender } = render(<OfflineBanner />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    setOnline(false)
    rerender(<OfflineBanner />)
    expect(screen.getByRole('status')).toHaveTextContent(/hors ligne/i)
  })
})
