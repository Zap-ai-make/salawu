/**
 * parcours.mjs — se connecter, naviguer, mesurer. Les gestes communs à toutes
 * les specs de la boucle QA.
 * ─────────────────────────────────────────────────────────────────────────────
 * Ces fonctions vivaient en double dans `ecrans-authentifies.spec.js` et
 * `contraste-bandeau.spec.js`. Une troisième spec allait en faire une troisième
 * copie — et chaque commentaire ci-dessous est la trace d'un échec payé une
 * fois. Les recopier, c'est accepter qu'une correction n'atteigne qu'un fichier
 * sur trois.
 *
 * Aucun effet de bord au chargement : ce module est importable partout.
 */

import { expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

export const TAGS_WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/**
 * Connexion par le formulaire réel, pour un compte donné.
 *
 * `pressSequentially` et NON `fill` — ce n'est pas une préférence de style.
 * Les champs sont contrôlés par useFormValidation : `fill` pose la valeur dans
 * le DOM sans que l'état React la reçoive, donc `values` reste vide, la
 * validation refuse la soumission, et AUCUNE requête ne part. Le pire est que
 * rien ne s'affiche : `getFieldError` ne montre une erreur que sur un champ
 * `touched`, et `fill` ne déclenche pas de blur. Diagnostiqué en observant le
 * réseau — zéro appel à l'émulateur — plutôt qu'en devinant.
 */
export async function seConnecter(page, compte) {
  await page.goto('/')

  const champEmail = page.locator('input[type="email"]').first()
  const champMdp = page.locator('input[type="password"]').first()
  await expect(champEmail).toBeVisible({ timeout: 60_000 })

  await champEmail.click()
  await champEmail.pressSequentially(compte.email, { delay: 5 })
  await champEmail.blur()
  await champMdp.click()
  await champMdp.pressSequentially(compte.motDePasse, { delay: 5 })
  await champMdp.blur()

  await page.getByRole('button', { name: /se connecter/i }).click()

  // Repère de sortie valable aux DEUX largeurs : la barre de navigation existe
  // dans les deux formes, alors qu'un lien nommé n'existe qu'au-dessus de `md`.
  //
  // ⚠ 120 s ET NON 60 s — RELEVÉ APRÈS UN ÉCHEC OBSERVÉ, pas par précaution.
  // Le banc complet du lot L9.8 a rendu « element(s) not found » sur ce
  // `locator('nav')`, au treizième test d'une série de trente minutes — alors
  // que la CAPTURE D'ÉCHEC montre la navigation bien présente. La page avait
  // rendu ; elle avait seulement mis plus de 60 s sous charge, chaque test de ce
  // fichier payant une connexion complète.
  //
  // On relève le plafond, on n'ajoute PAS de `retries` : c'est la doctrine déjà
  // écrite plus bas dans ce fichier. Une nouvelle tentative masquerait un vrai
  // problème de synchronisation ; un plafond réaliste cesse seulement
  // d'interrompre un travail correct mais lent.
  await expect(page.locator('nav').first()).toBeVisible({ timeout: 120_000 })
  await expect(page.locator('input[type="email"]')).toHaveCount(0, { timeout: 120_000 })
}

/**
 * Le texte de `<main>` une fois qu'il A CESSÉ DE BOUGER.
 *
 * ⚠ Ce n'est pas une précaution de confort, c'est la réparation d'un faux
 * positif que ma propre garde produisait. `allerA` déclare l'arrivée quand le
 * contenu de `<main>` a CHANGÉ par rapport au départ. Mais le relevé de départ
 * était pris sans attendre : juste après une connexion, le tableau de bord
 * affiche encore « Chargement des données… ». Le clic partait, l'URL basculait,
 * le tableau de bord FINISSAIT de charger — et le contenu devenait différent du
 * relevé de départ sans qu'on ait quitté la page. La garde se déclarait
 * satisfaite par le chargement de la page qu'on voulait quitter.
 *
 * Constaté le 2026-09-16 : le test de l'écran « transactions » a capturé, scanné
 * et mesuré le TABLEAU DE BORD, en signalant « h1 rendus : 1 — Tableau de bord ».
 * Deux écrans plus loin, les violations de contraste relevées étaient celles du
 * tableau des derniers clients, qui n'existe pas sur l'écran des transactions.
 *
 * On compare donc deux lectures espacées : tant qu'elles diffèrent, la page
 * travaille encore. Le plafond borne l'attente — une page qui ne se stabilise
 * jamais rend sa dernière lecture plutôt que d'immobiliser la boucle.
 */
async function texteStableDeMain(page, { timeout = 15_000, pause = 300 } = {}) {
  const lire = () => page.locator('main').first().innerText().catch(() => '')

  let precedent = await lire()
  const limite = Date.now() + timeout

  while (Date.now() < limite) {
    await page.waitForTimeout(pause)
    const actuel = await lire()
    if (actuel === precedent) return actuel
    precedent = actuel
  }

  return precedent
}

/**
 * La navigation change de NATURE selon la largeur : liens horizontaux au-dessus
 * de `md` (768 px), et un <select> en dessous (NavBar.jsx:191). Chercher un lien
 * à 375 px ne trouve donc rien — ce n'était pas un défaut de l'application mais
 * de mon relevé. On emprunte le chemin réellement offert à chaque largeur.
 */
export async function allerA(page, ecran) {
  const lien = page.getByRole('link', { name: ecran.lien }).first()
  const selecteur = page.getByRole('combobox', { name: /navigation principale/i })

  // ── Repère de DÉPART, pour savoir quand l'écran a réellement changé ───────
  //
  // ⚠ Sans cela, cette fonction rend la main sur une page qui n'a pas encore
  // été re-rendue. Vu le 2026-09-15 : un relevé de texte pris juste après un
  // `allerA` vers `/clients` a rendu le contenu de l'HISTORIQUE. L'URL était
  // pourtant la bonne — le routage est côté client, et React n'avait pas encore
  // remplacé le contenu.
  //
  // Le contrôle de marqueur ne pouvait pas l'attraper, et c'est le plus
  // instructif : « Cartes Réseau » est rendu par le RIDEAU DU LAYOUT, donc
  // présent sur TOUS les écrans ; « client » figure dans « Transactions
  // clients » de l'historique ; et à 375 px la navigation est un <select>, dont
  // les <option> portent le libellé de chaque écran. Trois façons pour un
  // marqueur d'être satisfait par la page qu'on vient de QUITTER.
  //
  // Un écran n'est pas identifié par un mot qu'il contient : il est identifié
  // par le fait que le contenu a CHANGÉ. C'est vrai de tous les écrans, sans
  // avoir à leur inventer un texte unique à chacun.
  // ⚠ STABILISÉ, et pas simplement lu. Un relevé pris pendant que la page de
  // départ charge encore rend la comparaison ci-dessous satisfaite par ce
  // chargement, sans qu'on ait quitté l'écran. Voir `texteStableDeMain`.
  const cheminAvant = new URL(page.url()).pathname
  const texteAvant = await texteStableDeMain(page)

  if (await lien.isVisible().catch(() => false)) {
    await lien.click()
  } else {
    await expect(selecteur).toBeVisible({ timeout: 30_000 })
    // Sélection par VALEUR (le chemin de route) et non par libellé : Playwright
    // exige une chaîne exacte pour `label`, et le libellé porte un badge de
    // compteur quand il y a des éléments en attente (« Transactions (2) »).
    // La valeur, elle, ne bouge pas.
    await selecteur.selectOption(ecran.chemin)
  }

  // ── D'ABORD l'URL, ENSUITE le contenu ────────────────────────────────────
  //
  // Cet ordre répare un faux positif que j'avais introduit : le marqueur de
  // l'historique est /historique/i, et « Historique » est aussi le LIBELLÉ DU
  // LIEN de navigation, visible en permanence au-dessus de 768 px. Le test
  // déclarait donc l'arrivée alors que la page n'avait pas bougé — il validait
  // sa propre navigation ratée. Idem pour /transaction/i et /client/i.
  //
  // Ce n'était invisible qu'à 375 px, où la navigation est un <select> : aucun
  // texte de lien à accrocher, donc le test attendait vraiment.
  //
  // L'URL, elle, ne peut pas être confondue avec un libellé. Et quand elle
  // échoue, le message dit où l'on se trouve réellement — ce qui distingue « le
  // clic n'a pas navigué » de « la route a rendu une page vide ».
  await expect
    .poll(() => new URL(page.url()).pathname, {
      message: `la navigation vers ${ecran.chemin} n'a pas eu lieu`,
      timeout: 30_000,
    })
    .toBe(ecran.chemin)

  // Puis le CHANGEMENT de contenu. Deux garde-fous, chacun pour un cas réel :
  //  • on ne l'exige que si l'on vient d'un AUTRE chemin — sinon le premier
  //    `allerA` vers « / », juste après une connexion qui nous y a déjà déposés,
  //    attendrait un changement qui n'a aucune raison de survenir ;
  //  • on ne l'exige que si `<main>` disait quelque chose au départ, pour ne pas
  //    transformer une page sans `<main>` en attente vaine.
  if (cheminAvant !== ecran.chemin && texteAvant !== '') {
    await expect
      .poll(async () => page.locator('main').first().innerText().catch(() => ''), {
        message: `le contenu de <main> n'a pas changé en arrivant sur ${ecran.chemin} — ` +
          'la page précédente est encore rendue',
        // 45 s, et ce plafond n'excuse aucun défaut du produit — il tient compte
        // de ce que MESURE cette boucle. Les dix routes sont en `React.lazy`
        // (App.jsx:26-32) et le banc tourne sur le serveur de développement :
        // le premier passage sur un écran fait COMPILER son fragment. Pendant
        // qu'une route suspend, React garde délibérément l'ancienne page à
        // l'écran — c'est exactement ce que ce contrôle voit, et le message
        // ci-dessus le décrit fidèlement.
        //
        // Relevé le 2026-09-16 : sur une boucle de 19 minutes aux trois largeurs
        // (42 tests, chacun payant une connexion complète), deux navigations
        // vers l'historique — l'écran le plus lourd, 200 transactions — ont
        // dépassé 30 s. Les mêmes navigations tiennent en 8 à 13 s sur une
        // boucle à une seule largeur.
        //
        // En production les fragments sont préconstruits : ce délai n'existe
        // pas. On cesse donc d'interrompre un travail correct mais lent, sans
        // ajouter de `retries` — une seconde tentative masquerait, elle, un vrai
        // défaut de synchronisation.
        timeout: 45_000,
      })
      .not.toBe(texteAvant)
  }

  // On filtre sur la VISIBILITÉ, et non sur l'emplacement.
  //
  // Deux tentatives ratées avant celle-ci, et elles disent pourquoi :
  //  1. `page.getByText(...)` sur la page entière accrochait le lien de la barre
  //     de navigation desktop — présent dans le DOM mais masqué sous 768 px.
  //     `.first()` tombait dessus et attendait qu'un élément caché apparaisse.
  //  2. Restreindre à `<main>` échouait pour le tableau de bord, dont le
  //     marqueur était alors « Cartes Réseau » — rendu par le rideau du Layout,
  //     donc HORS de <main>. Ce marqueur-là a été remplacé au lot L7.4b (il
  //     était présent sur les huit écrans), mais la règle reste : un marqueur
  //     n'a pas à promettre où il se trouve dans la page.
  // Ce qu'on veut dire est simplement « un élément visible portant ce texte ».
  await expect(page.getByText(ecran.marqueur).filter({ visible: true }).first())
    .toBeVisible({ timeout: 30_000 })
  // Garde anti-faux-positif : on ne doit JAMAIS être retombé sur la connexion.
  await expect(page.locator('input[type="email"]')).toHaveCount(0)
}

/**
 * Mesure le débordement horizontal et DÉSIGNE le coupable.
 *
 * Un « déborde de 40 px » sans élément fautif oblige à fouiller la page à la
 * main ; ici le relevé dit où regarder. Le coupable est l'élément le plus à
 * droite dont le bord dépasse la fenêtre ET dont aucun ancêtre ne le contient
 * par un `overflow` — sinon on accuse le contenu d'une zone défilante, qui est
 * censé dépasser.
 */
export async function mesurerDebordement(page) {
  const d = await page.evaluate(() => {
    const client = document.documentElement.clientWidth
    const contenu = (el) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const ov = getComputedStyle(p).overflowX
        if (ov === 'auto' || ov === 'scroll' || ov === 'hidden') return true
      }
      return false
    }
    let pire = null
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.right <= client + 1) continue
      if (contenu(el)) continue
      if (!pire || r.right > pire.droite) {
        pire = {
          droite: Math.round(r.right),
          balise: el.tagName.toLowerCase(),
          classes: String(el.className || '').slice(0, 90),
        }
      }
    }
    return { scroll: document.documentElement.scrollWidth, client, pire }
  })

  d.coupable = d.pire
    ? `<${d.pire.balise} class="${d.pire.classes}"> atteint ${d.pire.droite}px`
    : 'aucun élément non contenu identifié'
  return d
}

/** Violations WCAG, réduites à ce qui se lit dans un message d'échec. */
export async function violationsAxe(page) {
  const resultats = await new AxeBuilder({ page }).withTags(TAGS_WCAG).analyze()
  return resultats.violations.map((v) => ({
    regle: v.id,
    impact: v.impact,
    description: v.help,
    elements: v.nodes.slice(0, 4).map((n) => n.target.join(' ')),
  }))
}
