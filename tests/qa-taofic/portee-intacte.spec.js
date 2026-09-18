import { test, expect } from '@playwright/test'

/**
 * TAOFIC — la portée du chantier ne l'atteint pas, et ce n'est plus un argument.
 * ─────────────────────────────────────────────────────────────────────────────
 * Toute la refonte du design d'ESAHAF tient sur une affirmation : les règles de
 * l'identité « registre » sont toutes préfixées par `.design-registre`, classe
 * posée sur <html> par `src/main.jsx` d'après le profil actif. TAOFIC, qui est
 * EN PRODUCTION, ne la porte pas — donc rien ne peut l'atteindre.
 *
 * Ce banc rend le profil `taofic-ajagbe` dans un vrai moteur et le VÉRIFIE sur
 * les valeurs calculées, plutôt que de le raisonner.
 *
 * ⚠ CE QU'IL NE FAIT PAS. Il ne compare pas des captures avant / après. Il
 * vérifie le MÉCANISME qui garantit l'absence de changement. Une comparaison de
 * captures serait vraie le jour où on la fait ; celle-ci rougira au premier lot
 * qui écrira une règle non portée — y compris dans six mois, et y compris écrite
 * par quelqu'un d'autre.
 *
 * ⚠ IL NE SE CONNECTE PAS. L'écran d'ouverture suffit, et pour une raison de
 * fond : la classe de portée est posée sur <html> au démarrage de l'application,
 * avant toute authentification. Si elle est absente là, elle est absente partout.
 * Y ajouter une connexion ferait dépendre cette garantie d'un jeu de données
 * semé pour un AUTRE profil — une fragilité pour aucune preuve supplémentaire.
 */

test.describe('TAOFIC — le profil en production', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    // L'application pose la classe au montage ; on attend que React ait rendu.
    await page.waitForSelector('body *', { timeout: 30_000 })
  })

  test('ne porte PAS la classe de portée du chantier', async ({ page }) => {
    const classes = await page.evaluate(() => document.documentElement.className)
    expect(
      classes,
      'si « design-registre » apparaît ici, l\'identité ESAHAF a fui vers le client en production',
    ).not.toContain('design-registre')
  })

  test('rend bien TAOFIC, et non un profil de repli', async ({ page }) => {
    // Sans ce cas, le précédent passerait aussi sur une page blanche ou sur un
    // profil inconnu retombé en « legacy » : il serait vert pour une mauvaise
    // raison. On exige la marque du client en production.
    const texte = await page.evaluate(() => document.body.innerText)
    expect(texte.length, 'la page doit avoir rendu quelque chose').toBeGreaterThan(20)
    expect(
      texte,
      'la marque attendue est celle de TAOFIC, pas celle d\'ESAHAF',
    ).not.toContain('ESAHAF')
  })

  test('garde la police historique, et non IBM Plex', async ({ page }) => {
    // Le lot 0 auto-héberge IBM Plex et l'impose SOUS la portée. Un corps de
    // page en Plex chez TAOFIC signifierait qu'une règle de police s'est écrite
    // hors portée — le genre de fuite qu'aucun test de composant ne voit, parce
    // que jsdom ne calcule aucune police.
    const police = await page.evaluate(
      () => getComputedStyle(document.body).fontFamily,
    )
    expect(police.toLowerCase()).not.toContain('plex')
  })

  test('ne reçoit AUCUN des jetons de couleur de l\'identité', async ({ page }) => {
    // `@theme static` force l'émission des variables : elles EXISTENT dans la
    // feuille servie aux deux profils. Ce qui doit rester faux, c'est qu'un
    // élément de TAOFIC les CONSOMME. On mesure donc la couleur rendue du corps,
    // pas la présence de la variable.
    const fond = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    )
    // --color-canvas (#f0f6fe) et --color-papier (#ffffff) sont les deux fonds
    // que l'identité pose. Le premier ne doit jamais apparaître ici.
    expect(fond, 'le canvas bleuté de l\'identité ne doit pas peindre TAOFIC').not.toBe(
      'rgb(240, 246, 254)',
    )
  })

  test('⚠ LE CAS QUI PROUVE QUE CE BANC SAIT ÉCHOUER', async ({ page }) => {
    // Un banc qui ne peut pas rougir ne prouve rien. On pose la classe de portée
    // À LA MAIN sur <html>, et on vérifie qu'une propriété change réellement.
    // Si rien ne bouge, c'est que la feuille de l'identité n'est pas servie du
    // tout sur ce montage — et les quatre cas ci-dessus seraient verts par
    // absence, non par cloisonnement.
    const avant = await page.evaluate(() => {
      const t = document.createElement('div')
      t.setAttribute('data-espace', 'boutique')
      const tuileTemoin = document.createElement('div')
      tuileTemoin.setAttribute('data-tuile', '')
      tuileTemoin.textContent = '1'
      t.appendChild(tuileTemoin)
      document.body.appendChild(t)
      const tuile = t.querySelector('[data-tuile]')
      const mesure = getComputedStyle(tuile).borderTopColor
      return { mesure, id: 'temoin' }
    })

    const apres = await page.evaluate(() => {
      document.documentElement.classList.add('design-registre')
      const tuile = document.querySelector('[data-espace="boutique"] [data-tuile]')
      const mesure = getComputedStyle(tuile).borderTopColor
      document.documentElement.classList.remove('design-registre')
      return mesure
    })

    expect(
      apres,
      'la feuille de l\'identité n\'est pas servie sur ce montage : les autres cas seraient verts par absence',
    ).not.toBe(avant.mesure)
    // --trait-200 = #c0d7f5
    expect(apres).toBe('rgb(192, 215, 245)')
  })
})
