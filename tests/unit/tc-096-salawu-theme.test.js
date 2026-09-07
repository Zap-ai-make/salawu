/**
 * TC-096 — themes.js : l'apparence dérive du SEUL axe `design.system`.
 *
 * Historique de ce test — il a changé de contrat, et c'est délibéré
 * ─────────────────────────────────────────────────────────────────────────────
 * Il caractérisait auparavant un câblage « chrome de marque » : une table
 * BRAND_DEFAULT_THEME faisait dériver le thème par défaut de `branding.theme`
 * (salawu, marque orange → thème 'orange'). Ce mécanisme a été retiré au Lot 4.
 *
 * Raison : deux tables décidaient de l'apparence d'un client — `branding.theme`
 * et `design.system` — pour une seule et même question. C'est cette dispersion
 * qui avait produit cinq sources de couleur concurrentes. La marque pilote
 * désormais le nom, le logo et la couleur du manifeste ; l'apparence de
 * l'interface est décidée ailleurs, à un seul endroit.
 *
 * Ce que le test vérifie maintenant : la marque n'a PLUS d'influence sur le
 * thème, et `design.system` l'a entièrement. La garantie de non-régression pour
 * TAOFIC ('dark', inchangé) est conservée telle quelle ci-dessous.
 *
 * DEFAULT_THEME est calculé à l'évaluation du module : on recharge themes.js
 * avec un profil actif mocké, comme TC-092 le fait pour branding.js.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'

afterEach(() => {
  vi.resetModules()
  vi.doUnmock('../../src/config/activeClientProfile.js')
})

// Recharge themes.js (et ses dépendances branding.js / designSystem.js) avec un
// profil actif mocké.
async function loadThemesWith(profile) {
  vi.resetModules()
  vi.doMock('../../src/config/activeClientProfile.js', () => ({ activeProfile: profile }))
  return import('../../src/constants/themes.js')
}

describe('TC-096 — la marque ne décide plus de l\'apparence', () => {
  it("marque orange sans axe design → 'dark' (et non plus 'orange')", async () => {
    // Exactement le cas que ce test verrouillait dans l'autre sens. Il documente
    // le retrait : une marque, quelle qu'elle soit, ne change plus le chrome.
    const t = await loadThemesWith({ branding: { appName: 'ESAHAF', theme: 'orange' } })
    expect(t.DEFAULT_THEME).toBe('dark')
    expect(t.THEMES.orange).toBeUndefined()
  })

  it('caractérisation TAOFIC/pilote (theme=green) → dark (inchangé)', async () => {
    const t = await loadThemesWith({ branding: { appName: 'AKAYIS', theme: 'green' } })
    expect(t.DEFAULT_THEME).toBe('dark')
  })

  it('marque inconnue → dark', async () => {
    const t = await loadThemesWith({ branding: { appName: 'X', theme: 'turquoise' } })
    expect(t.DEFAULT_THEME).toBe('dark')
  })

  it('profil sans branding → dark', async () => {
    const t = await loadThemesWith({})
    expect(t.DEFAULT_THEME).toBe('dark')
  })
})

describe('TC-096 — l\'axe design décide seul', () => {
  it("design.system = 'registre' → thème registre, quelle que soit la marque", async () => {
    // La marque reste 'green' (celle de TAOFIC) : si le thème bascule quand même,
    // c'est bien `design.system` qui commande, et lui seul.
    const t = await loadThemesWith({
      branding: { appName: 'ESAHAF', theme: 'green' },
      design: { system: 'registre' },
    })
    expect(t.DEFAULT_THEME).toBe('registre')
  })

  it("design.system = 'legacy' → dark, même avec une marque orange", async () => {
    const t = await loadThemesWith({
      branding: { appName: 'ESAHAF', theme: 'orange' },
      design: { system: 'legacy' },
    })
    expect(t.DEFAULT_THEME).toBe('dark')
  })

  it('un système inconnu retombe sur legacy, jamais sur l\'identité d\'un autre', async () => {
    // Sûreté : une faute de frappe dans un profil ne doit pas servir l'identité
    // ESAHAF à un client qui ne l'a pas demandée.
    const t = await loadThemesWith({ design: { system: 'regsitre' } })
    expect(t.DEFAULT_THEME).toBe('dark')
  })

  it('le catalogue ne contient que les deux apparences réellement servies', async () => {
    const t = await loadThemesWith({})
    expect(new Set(Object.keys(t.THEMES))).toEqual(new Set(['registre', 'dark']))
  })
})
