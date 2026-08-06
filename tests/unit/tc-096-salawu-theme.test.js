/**
 * TC-096 — themes.js : le thème par défaut dérive de la marque du profil client actif.
 *
 * Caractérisation du câblage « chrome de marque » :
 *  - salawu (branding.theme='orange') → DEFAULT_THEME='orange', et le preset orange existe.
 *  - TAOFIC / pilote (branding.theme='green') → repli 'dark' = comportement historique inchangé.
 *  - marque inconnue ou branding absent → repli 'dark'.
 *
 * DEFAULT_THEME est calculé à l'évaluation du module (depuis BRAND_THEME) : on recharge
 * themes.js avec un profil actif mocké, comme TC-092 le fait pour branding.js.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'

afterEach(() => {
  vi.resetModules()
  vi.doUnmock('../../src/config/activeClientProfile.js')
})

// Recharge themes.js (et sa dépendance branding.js) avec un profil actif mocké.
async function loadThemesWith(profile) {
  vi.resetModules()
  vi.doMock('../../src/config/activeClientProfile.js', () => ({ activeProfile: profile }))
  return import('../../src/constants/themes.js')
}

describe('TC-096 — thème par défaut dérivé du profil', () => {
  it('salawu (theme=orange) → DEFAULT_THEME=orange + preset orange présent', async () => {
    const t = await loadThemesWith({ branding: { appName: 'ESAHAF', theme: 'orange' } })
    expect(t.DEFAULT_THEME).toBe('orange')
    expect(t.THEMES.orange).toBeDefined()
    expect(t.THEMES.orange.classes.navbar).toBe('bg-orange-600/95 backdrop-blur-sm')
    expect(t.THEMES.orange.classes.accent).toBe('bg-orange-600')
    expect(t.THEMES.orange.classes.tableHeader).toBe('bg-orange-100/80 border-orange-300')
  })

  it('caractérisation TAOFIC/pilote (theme=green) → repli dark (inchangé)', async () => {
    const t = await loadThemesWith({ branding: { appName: 'AKAYIS', theme: 'green' } })
    expect(t.DEFAULT_THEME).toBe('dark')
  })

  it('marque inconnue → repli dark', async () => {
    const t = await loadThemesWith({ branding: { appName: 'X', theme: 'turquoise' } })
    expect(t.DEFAULT_THEME).toBe('dark')
  })

  it('profil sans branding → repli dark (BRAND_THEME=green par défaut)', async () => {
    const t = await loadThemesWith({})
    expect(t.DEFAULT_THEME).toBe('dark')
  })
})
