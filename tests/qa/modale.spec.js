import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mkdir } from 'node:fs/promises'

/**
 * QA visuelle — modale « Mot de passe oublié ».
 *
 * Elle est choisie parce qu'elle est la seule modale atteignable SANS
 * authentification, et qu'elle vérifie deux choses qu'aucun test unitaire ne
 * pouvait établir :
 *
 *  1. Le voile est bien semi-transparent. Il portait `bg-black bg-opacity-50`,
 *     un utilitaire SUPPRIMÉ par Tailwind v4 : aucune règle n'était émise et le
 *     voile rendait NOIR OPAQUE. jsdom ne calcule pas de style résolu, donc la
 *     suite unitaire ne pouvait pas le voir — il fallait un vrai moteur.
 *  2. Le travail d'accessibilité du Lot 1 (`Escape`, piège de focus) se comporte
 *     comme prévu dans un navigateur réel, et pas seulement sous jsdom.
 */

const CAPTURES = 'docs/audit/qa-captures'

test.beforeAll(async () => {
  await mkdir(CAPTURES, { recursive: true })
})

async function ouvrirLaModale(page) {
  await page.goto('/')
  const declencheur = page.getByRole('button', { name: /mot de passe oublié/i })
    .or(page.getByText(/mot de passe oublié/i)).first()
  await expect(declencheur).toBeVisible({ timeout: 30_000 })
  await declencheur.click()
  return declencheur
}

test.describe('Modale « Mot de passe oublié »', () => {
  test('son voile est semi-transparent, pas noir opaque', async ({ page }, info) => {
    await ouvrirLaModale(page)

    const voile = page.locator('.fixed.inset-0').first()
    await expect(voile).toBeVisible()

    await page.screenshot({
      path: `${CAPTURES}/modale-${info.project.name}.png`,
      fullPage: false,
    })

    const fond = await voile.evaluate((el) => getComputedStyle(el).backgroundColor)

    // On lit l'alpha CALCULÉ plutôt qu'on ne compare une chaîne de classes :
    // c'est le rendu qui compte, et c'est précisément ce que la classe morte
    // laissait diverger de ce que le source annonçait.
    //
    // Deux notations à accepter, et ce n'est pas de la complaisance : Tailwind v4
    // émet en `oklab(0 0 0 / 0.5)` là où v3 émettait `rgba(0, 0, 0, 0.5)`. Une
    // assertion sur `rgba(` seule échouait sur un voile pourtant correct — le
    // test aurait accusé le code d'un défaut qui était le sien.
    const apresBarre = fond.match(/\/\s*([\d.]+)\s*\)$/)      // oklab/oklch/color
    const rgbaVirgule = fond.match(/,\s*([\d.]+)\s*\)$/)       // rgba historique
    const alpha = Number((apresBarre || rgbaVirgule || [])[1] ?? 1)

    expect(alpha, `le voile doit laisser voir la page derrière (fond = ${fond})`)
      .toBeGreaterThan(0)
    expect(alpha, `le voile ne doit pas être opaque (fond = ${fond})`).toBeLessThan(1)
  })

  test('se ferme avec Escape et rend le focus au déclencheur', async ({ page }) => {
    // Garantie du Lot 1 (hook useDialog), jamais vérifiée hors jsdom.
    const declencheur = await ouvrirLaModale(page)

    const dialogue = page.locator('[role="dialog"], .fixed.inset-0').first()
    await expect(dialogue).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(dialogue).toBeHidden({ timeout: 5_000 })

    // Le focus doit revenir là où l'utilisateur l'avait laissé, sinon la
    // navigation au clavier repart du haut de la page.
    await expect(declencheur).toBeFocused()
  })

  test('ne présente aucune violation WCAG 2.2 AA une fois ouverte', async ({ page }) => {
    await ouvrirLaModale(page)
    await expect(page.locator('.fixed.inset-0').first()).toBeVisible()

    const resultats = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()

    const lisible = resultats.violations.map((v) => ({
      regle: v.id,
      impact: v.impact,
      description: v.help,
      elements: v.nodes.map((n) => n.target.join(' ')),
    }))

    expect(lisible, JSON.stringify(lisible, null, 2)).toEqual([])
  })
})
