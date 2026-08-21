// @vitest-environment jsdom
/**
 * TC-143 — Récupération d'un fragment lazy périmé après déploiement.
 *
 * Contexte : SPA à découpage de code (React.lazy) + PWA autoUpdate. Un onglet resté
 * ouvert pendant un déploiement demande un ancien chunk (`Historique-<hash>.js`)
 * dont le hash a changé → 404 → Vercel renvoie index.html (MIME text/html) →
 * « Failed to fetch dynamically imported module ». Le remède est un rechargement
 * BORNÉ (un seul par fenêtre de cooldown) pour ne pas boucler si l'échec est réel.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isChunkLoadError, reloadForStaleChunk, installChunkReload } from '../../src/utils/chunkReload.js'

beforeEach(() => {
  try { sessionStorage.clear() } catch { /* ignore */ }
})

describe('TC-143 — isChunkLoadError', () => {
  it('reconnaît les messages d\'un import dynamique périmé/introuvable', () => {
    expect(isChunkLoadError(new Error('Failed to fetch dynamically imported module: https://x/assets/Historique-abc.js'))).toBe(true)
    expect(isChunkLoadError(new Error('error loading dynamically imported module'))).toBe(true)
    expect(isChunkLoadError('Importing a module script failed.')).toBe(true)
  })

  it('ignore une erreur applicative sans rapport', () => {
    expect(isChunkLoadError(new Error('undefined is not a function'))).toBe(false)
    expect(isChunkLoadError(null)).toBe(false)
  })
})

describe('TC-143 — reloadForStaleChunk (garde-fou horodaté)', () => {
  it('recharge une fois puis respecte le cooldown', () => {
    const reload = vi.fn()
    expect(reloadForStaleChunk(reload)).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
    // 2e tentative immédiate → bloquée (évite la boucle de rechargement)
    expect(reloadForStaleChunk(reload)).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
  })
})

describe('TC-143 — installChunkReload (câblage des événements)', () => {
  it('recharge sur vite:preloadError, puis le cooldown protège le 2e échec', () => {
    const reload = vi.fn()
    installChunkReload({ reload })

    window.dispatchEvent(new Event('vite:preloadError', { cancelable: true }))
    expect(reload).toHaveBeenCalledTimes(1)

    // Un rejet de chunk juste après ne relance pas (cooldown).
    const rej = Object.assign(new Event('unhandledrejection'), {
      reason: new Error('Failed to fetch dynamically imported module'),
    })
    window.dispatchEvent(rej)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('ignore un rejet de promesse sans rapport avec un fragment', () => {
    const reload = vi.fn()
    installChunkReload({ reload })
    const rej = Object.assign(new Event('unhandledrejection'), { reason: new Error('panne réseau générique') })
    window.dispatchEvent(rej)
    expect(reload).not.toHaveBeenCalled()
  })
})
