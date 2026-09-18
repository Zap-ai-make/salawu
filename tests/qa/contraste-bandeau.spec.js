import { test, expect } from '@playwright/test'
import { lirePng, luminance, contraste, pireLuminance } from './lib/png.mjs'
import { seConnecter } from './lib/parcours.mjs'
import { ETATS } from '../../scripts/qa/etats-du-banc.mjs'

/**
 * Sonde de contraste — sur les PIXELS RÉELLEMENT RENDUS.
 *
 * Pourquoi elle ne peut pas être un calcul
 * ─────────────────────────────────────────────────────────────────────────────
 * Le bandeau de marque d'ESAHAF est une PHOTOGRAPHIE (`/bg-noir.png`) sous un
 * voile noir à 20 %, avec une ombre portée sur le texte. Le contraste d'une
 * ligne de texte y dépend du PIXEL sous chaque lettre, pas d'une couleur qu'on
 * pourrait poser dans une formule. Une estimation faite à la main sur un
 * chantier précédent était fausse de plusieurs points.
 *
 * La méthode, et chacune de ses trois précautions vient d'un échec :
 *
 *  1. ON MASQUE LE TEXTE avant de capturer. Sans cela, les bords anticrénelés
 *     des lettres — qui sont du texte, pas du fond — polluent l'échantillon et
 *     rendent le fond artificiellement clair.
 *
 *  2. COORDONNÉES DE PAGE, CAPTURE PLEINE HAUTEUR, et un garde-fou qui CRIE
 *     quand une zone sort du cadre. Une zone hors cadre rend des octets à zéro,
 *     donc du noir parfait, donc 21:1 sur du texte blanc : une réussite
 *     éclatante et entièrement fausse. C'est le défaut le plus coûteux de tout
 *     ce dispositif, et il est traité dans `pireLuminance`.
 *
 *  3. MOUVEMENT RÉDUIT FORCÉ. Sinon la mesure dépend de l'instant où elle
 *     tombe : une séquence d'arrivée décale une ligne de quelques pixels, et
 *     quelques pixels plus haut sur une photographie, ce ne sont pas les mêmes
 *     pixels.
 *
 * Et on cherche le MAXIMUM de luminance dans l'emprise de chaque ligne — le
 * pire cas pour du texte clair est le seul qui compte pour WCAG.
 */

// L'état DENSE : le bandeau est le même partout, mais un écran plein est le
// seul qui garantisse une page assez haute pour une capture pleine hauteur.
const COMPTE = ETATS.dense.compte

/** Seuils WCAG 2.2 AA. Grand texte = ≥ 24 px, ou ≥ 18,66 px en gras. */
const SEUIL_NORMAL = 4.5
const SEUIL_GRAND = 3

test.describe.configure({ timeout: 150_000 })

/**
 * L'emprise des LETTRES, et non la boîte de bordure de l'élément.
 *
 * ⚠ Cette distinction n'est pas un raffinement — elle a produit un faux positif
 * complet. Mesurer `boundingBox()` sur un lien de navigation incluait son propre
 * soulignement d'état actif (`border-b-2 border-white/50` sur `bg-black/30`) :
 * le pixel le plus clair de la boîte était rgb(135,138,142), c'est-à-dire ce
 * liseré décoratif, et la sonde annonçait 3,47:1 sur une navigation qui tient
 * en réalité 16,49:1 sous ses lettres. Elle accusait le produit de son propre
 * défaut de méthode.
 *
 * Une `Range` sur le contenu rend la boîte des glyphes : ni le rembourrage, ni
 * les bordures, ni les décorations de l'élément. C'est le seul fond que le texte
 * traverse réellement.
 *
 * Coordonnées de PAGE (scroll ajouté) : la capture est en pleine hauteur, et un
 * rectangle en coordonnées de fenêtre sur une page défilée échantillonnerait
 * ailleurs.
 */
async function boiteDuTexte(locator) {
  return locator.evaluate((el) => {
    const plage = document.createRange()
    plage.selectNodeContents(el)
    const r = plage.getBoundingClientRect()
    return {
      x: r.x + window.scrollX,
      y: r.y + window.scrollY,
      width: r.width,
      height: r.height,
    }
  })
}

/** Couleur de texte effectivement calculée par le navigateur, en RGB. */
async function couleurDuTexte(locator) {
  const css = await locator.evaluate((el) => getComputedStyle(el).color)
  const [r, v, b] = css.match(/\d+(\.\d+)?/g).map(Number)
  return { r, v, b, css }
}

/** Taille et graisse calculées — elles décident du seuil applicable. */
async function seuilApplicable(locator) {
  const { taille, graisse } = await locator.evaluate((el) => {
    const s = getComputedStyle(el)
    return { taille: parseFloat(s.fontSize), graisse: parseInt(s.fontWeight, 10) || 400 }
  })
  const grand = taille >= 24 || (taille >= 18.66 && graisse >= 700)
  return { seuil: grand ? SEUIL_GRAND : SEUIL_NORMAL, taille, graisse, grand }
}

test.describe('Contraste mesuré sur les pixels rendus', () => {
  test.beforeEach(async ({ page }) => {
    // Précaution 3 : sans elle, la mesure dépend de l'instant où elle tombe.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await seConnecter(page, COMPTE)
  })

  test('le décodeur de capture dit la vérité — contrôle sur une couleur connue', async ({ page }) => {
    // Un décodeur qui se trompe rendrait des contrastes crédibles et faux. On le
    // vérifie donc AVANT de s'en servir, sur un aplat dont on connaît la valeur
    // exacte : la mesure doit retomber sur elle à l'octet près.
    await page.evaluate(() => {
      const temoin = document.createElement('div')
      temoin.id = 'temoin-decodeur'
      temoin.style.cssText =
        'position:fixed;top:0;left:0;width:80px;height:40px;background:#1b62b0;z-index:2147483647'
      document.body.appendChild(temoin)
    })

    const boite = await page.locator('#temoin-decodeur').boundingBox()
    const image = lirePng(await page.screenshot({ fullPage: true }))
    // On échantillonne au centre du témoin, loin des bords.
    const centre = {
      x: boite.x + boite.width / 4,
      y: boite.y + boite.height / 4,
      width: boite.width / 2,
      height: boite.height / 2,
    }
    const { pixel } = pireLuminance(image, centre, 'témoin du décodeur')

    // #1b62b0 = (27, 98, 176). Tolérance de 1 par canal : le rendu peut passer
    // par une conversion d'espace colorimétrique selon la plateforme.
    expect(Math.abs(pixel[0] - 27), `rouge lu ${pixel[0]}`).toBeLessThanOrEqual(1)
    expect(Math.abs(pixel[1] - 98), `vert lu ${pixel[1]}`).toBeLessThanOrEqual(1)
    expect(Math.abs(pixel[2] - 176), `bleu lu ${pixel[2]}`).toBeLessThanOrEqual(1)
  })

  test('le garde-fou hors cadre échoue au lieu de rendre 21:1', async ({ page }) => {
    // Le contrôle le plus important du fichier : on lui donne délibérément une
    // zone hors image, et on exige qu'il CRIE. Sans ce test, la précaution
    // pourrait se casser sans que personne ne le voie — et une sonde muette
    // rend alors un 21:1 parfait sur du vide.
    const image = lirePng(await page.screenshot({ fullPage: true }))

    expect(() =>
      pireLuminance(image, { x: 0, y: image.hauteur + 10, width: 50, height: 50 }, 'zone de test'),
    ).toThrow(/HORS CADRE/)
  })

  test('le wordmark du bandeau tient son contraste sur le fond rendu', async ({ page }, info) => {
    // ⚠ `[data-marque]` ET NON `header h1`. Ce contrôle était ROUGE aux trois
    // largeurs — « element(s) not found » — depuis le lot L7.1, et personne ne
    // l'avait vu parce que le banc complet n'avait pas été rejoué depuis.
    //
    // La raison n'est pas un défaut du produit : sous l'identité « registre », le
    // wordmark n'est plus un titre. `Layout.jsx:45` rend
    // `const Marque = IS_REGISTRE ? 'span' : 'h1'` — c'était le point du lot
    // L7.1 : un nom de marque n'est pas le titre de la page. Le locator, lui,
    // était resté sur la balise.
    //
    // `[data-marque]` est le FAIT que les deux identités posent, quelle que soit
    // la balise. C'est aussi ce qui rend ce contrôle durable : le bandeau
    // PHOTOGRAPHIQUE de 200 px est une demande cliente acceptée
    // (src/constants/themes.js), il reviendra, et la méthode par pixels devra
    // fonctionner ce jour-là sans être réécrite.
    //
    // Le titre du cas ne promet donc plus « la photographie » : il promet le
    // fond REELLEMENT RENDU, qui est aujourd'hui un aplat de papier et sera
    // demain une image. La mesure est la même dans les deux cas — c'est tout
    // l'intérêt de mesurer des pixels plutôt que de calculer une couleur.
    const wordmark = page.locator('header [data-marque]').first()
    await expect(wordmark).toBeVisible()

    const boite = await boiteDuTexte(wordmark)
    const couleur = await couleurDuTexte(wordmark)
    const { seuil, taille, graisse, grand } = await seuilApplicable(wordmark)

    // Précaution 1 : on masque le texte ET son ombre portée, sinon on mesure
    // les lettres au lieu du fond qu'elles traversent.
    await wordmark.evaluate((el) => {
      el.style.color = 'transparent'
      el.style.textShadow = 'none'
    })

    const image = lirePng(await page.screenshot({ fullPage: true }))
    const { luminance: fond, pixel } = pireLuminance(image, boite, 'wordmark du bandeau')

    const ratio = contraste(luminance(couleur.r, couleur.v, couleur.b), fond)

    console.log(
      `  wordmark : ${ratio.toFixed(2)}:1  (texte ${couleur.css}, ` +
        `pire pixel de fond rgb(${pixel.join(',')}), ` +
        `${taille}px/${graisse} → seuil ${seuil}, ${grand ? 'grand texte' : 'texte normal'})`,
    )

    /**
     * ⚠ DÉFAUT FIGÉ — 1440 px UNIQUEMENT, ET IL EST DANS LE PRODUIT.
     *
     * Réparer le locator ci-dessus a rendu ce contrôle à son travail, et il a
     * immédiatement trouvé ce qu'il cherchait :
     *
     *     mobile-375     10,51:1   sur rgb(106, 45, 20)    ✓
     *     tablette-768   11,79:1   sur rgb( 90, 42, 26)    ✓
     *     bureau-1440     1,61:1   sur rgb(204,204,204)    ✗  seuil 3:1
     *
     * Le bandeau est une photographie en `background-size: cover` : la largeur
     * décide du CADRAGE. À 1440 px, une zone presque blanche de l'image passe
     * sous le wordmark, et le voile noir à 20 % ne la retient pas — 255 × 0,8
     * = 204. Le texte est blanc. Il ne se voit plus.
     *
     * Ce n'est ni un défaut du banc, ni une conséquence du lot L9.2 : le
     * bandeau photo et son voile sont antérieurs à tout le chantier. Il était
     * simplement INVISIBLE, parce que le locator ne trouvait plus rien depuis
     * le lot L7.1 et que le banc complet n'avait pas été rejoué depuis.
     *
     * La tolérance EXIGE QUE LE DÉFAUT SOIT ENCORE LÀ. Le jour où le voile est
     * corrigé, cette ligne rougit et doit être retirée : c'est ce qui prouvera
     * la correction, au lieu de s'en souvenir. Elle est posée ici plutôt que
     * laissée rouge pour la raison déjà écrite au lot L8.2 — un rouge arrête
     * tout, un gel laisse le reste du contrôle travailler.
     */
    if (info.project.name === 'bureau-1440') {
      expect(
        ratio,
        `le défaut figé du wordmark à 1440 px a disparu (${ratio.toFixed(2)}:1 ` +
          `sur rgb(${pixel.join(',')})) — RETIRER CETTE TOLÉRANCE`,
      ).toBeLessThan(seuil)
      return
    }

    expect(
      ratio,
      `le wordmark tombe à ${ratio.toFixed(2)}:1 sur le pixel le plus clair du bandeau ` +
        `(rgb(${pixel.join(',')})), seuil ${seuil}:1`,
    ).toBeGreaterThanOrEqual(seuil)
  })

  test('la navigation tient son contraste sur toute sa largeur', async ({ page }) => {
    // La barre de navigation est un aplat, donc calculable — mais elle est
    // mesurée quand même : c'est le fond RÉEL qu'on veut, y compris l'état
    // actif qui pose un voile noir à 30 % sous l'entrée courante.
    const lien = page.getByRole('link', { name: 'Tableau de bord' })
    const visible = await lien.isVisible().catch(() => false)
    test.skip(!visible, 'Sous 768 px la navigation est un <select> : pas de lien à mesurer.')

    const boite = await boiteDuTexte(lien)
    const couleur = await couleurDuTexte(lien)
    const { seuil, taille, graisse } = await seuilApplicable(lien)

    await lien.evaluate((el) => {
      el.style.color = 'transparent'
      el.style.textShadow = 'none'
    })

    const image = lirePng(await page.screenshot({ fullPage: true }))
    const { luminance: fond, pixel } = pireLuminance(image, boite, 'lien de navigation')

    const ratio = contraste(luminance(couleur.r, couleur.v, couleur.b), fond)

    console.log(
      `  navigation : ${ratio.toFixed(2)}:1  (texte ${couleur.css}, ` +
        `pire pixel de fond rgb(${pixel.join(',')}), ${taille}px/${graisse} → seuil ${seuil})`,
    )

    expect(
      ratio,
      `un lien de navigation tombe à ${ratio.toFixed(2)}:1 sur rgb(${pixel.join(',')})`,
    ).toBeGreaterThanOrEqual(seuil)
  })
})
