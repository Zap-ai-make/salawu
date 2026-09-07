import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mkdir } from 'node:fs/promises'

/**
 * QA visuelle — écran de connexion.
 *
 * Premier écran que voit l'utilisateur, et celui que `DESIGN.md` §1 désignait
 * nommément : il servait un dégradé `from-blue-50 to-indigo-100`, le tic
 * générique par excellence. L'identité « registre » lui substitue le papier et
 * une réglure d'encre.
 *
 * Aucune authentification requise : c'est l'écran par lequel on prouve le
 * harnais avant d'investir dans un jeu de données d'émulateur.
 */

const CAPTURES = 'docs/audit/qa-captures'

test.beforeAll(async () => {
  await mkdir(CAPTURES, { recursive: true })
})

test.describe('Écran de connexion', () => {
  test('rend, se capture, et ne présente aucune violation WCAG 2.2 AA', async ({ page }, info) => {
    await page.goto('/')

    // On attend un repère de CONTENU et non un délai fixe : un `waitForTimeout`
    // rendrait le test dépendant de la charge de la machine.
    await expect(page.locator('form, input[type="email"]').first()).toBeVisible({ timeout: 30_000 })

    await page.screenshot({
      path: `${CAPTURES}/connexion-${info.project.name}.png`,
      fullPage: true,
    })

    // ── Contraste et accessibilité ────────────────────────────────────────────
    // Périmètre WCAG 2.2 AA. `color-contrast` est inclus : c'est le constat C2
    // du bilan, et le seul moyen de le vérifier sur du rendu réel.
    const resultats = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()

    // Message lisible : la liste brute d'axe est illisible en sortie de test.
    const lisible = resultats.violations.map((v) => ({
      regle: v.id,
      impact: v.impact,
      description: v.help,
      elements: v.nodes.map((n) => n.target.join(' ')),
    }))

    expect(lisible, JSON.stringify(lisible, null, 2)).toEqual([])
  })

  test('ne déborde jamais horizontalement', async ({ page }) => {
    // Un débordement horizontal sur 375 px est l'un des défauts les plus
    // fréquents et des plus pénibles : il oblige à faire défiler latéralement
    // pour lire un montant. Invisible en jsdom, évident ici.
    await page.goto('/')
    await expect(page.locator('form, input[type="email"]').first()).toBeVisible({ timeout: 30_000 })

    const debordement = await page.evaluate(() => {
      const el = document.documentElement
      return { scroll: el.scrollWidth, client: el.clientWidth }
    })

    expect(
      debordement.scroll,
      `la page déborde de ${debordement.scroll - debordement.client} px`,
    ).toBeLessThanOrEqual(debordement.client)
  })
})
