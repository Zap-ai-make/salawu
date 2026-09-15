import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mkdir } from 'node:fs/promises'

/**
 * QA visuelle — écrans de travail (authentifiés).
 *
 * C'est ici que vit l'essentiel de la refonte : les tableaux de montants, les
 * cartes réseau, le bandeau. Ces écrans exigent un compte, donc un émulateur
 * peuplé — d'où `npm run qa:full`, qui enchaîne le seed et cette boucle.
 *
 * Deux choix de méthode, chacun payé par un échec :
 *
 *  • On navigue en CLIQUANT les liens, jamais par `page.goto`. `goto` provoque un
 *    rechargement complet ; enchaîné juste après la connexion, il devançait la
 *    persistance de la session Firebase et renvoyait à l'écran de connexion.
 *    Cliquer est aussi ce que fait un utilisateur : le routage est côté client.
 *  • Chaque écran est vérifié par UN test qui capture, scanne et mesure. Un test
 *    par contrôle doublait le nombre de connexions — 16 minutes de boucle.
 */

const CAPTURES = 'docs/audit/qa-captures'

// Doit rester synchronisé avec scripts/qa/seed-qa.mjs. Dupliqué plutôt
// qu'importé : ce fichier tourne sous Playwright, le seed sous l'Admin SDK.
const COMPTE = {
  email: 'qa.esahaf@example.test',
  motDePasse: 'QaEsahaf!2026',
}

// Montant de la boutique TÉMOIN (facteur 7 sur Orange : 1 250 000 × 7).
// S'il apparaissait sur un écran de la boutique QA, le cloisonnement serait rompu.
const MONTANT_TEMOIN = '8 750 000'

// `lien` = libellé exact dans la barre de navigation.
// `marqueur` = texte présent sur l'écran d'arrivée ET ABSENT de l'écran de
// connexion. C'est une contrainte, pas un détail : mon premier jeu de marqueurs
// contenait /profil|boutique/i, et « boutique » figure sur l'écran de connexion
// (« Créer un compte boutique ») — le test passait au vert en regardant la page
// de login. Un marqueur trop lâche ne vérifie rien.
const ECRANS = [
  { nom: 'tableau-de-bord', lien: 'Tableau de bord', chemin: '/', marqueur: /cartes réseau/i },
  { nom: 'transactions', lien: 'Transactions', chemin: '/transactions', marqueur: /transaction/i },
  { nom: 'historique', lien: 'Historique', chemin: '/historique', marqueur: /historique/i },
  { nom: 'clients', lien: 'Clients', chemin: '/clients', marqueur: /client/i },
  { nom: 'profil', lien: 'Profil', chemin: '/profil', marqueur: /se déconnecter/i },
  // ── Étendu de 5 à 8 écrans (lot L6.2 de la refonte) ───────────────────────
  //
  // Les cinq premiers etaient les seuls passes au crible d'un vrai moteur de
  // mise en page. Trois des huit points d'entree atteignables par la navigation
  // ne l'etaient pas du tout — donc ni axe, ni la sonde de debordement, ni la
  // capture. On les ajoute AVANT de les redessiner, pas apres.
  //
  // ⚠ Les marqueurs sont pris sur le CONTENU de la page, jamais sur un libelle
  // de navigation : « Demandes Dealer » et « Formulaire » sont aussi des liens,
  // visibles sur TOUTES les pages au-dessus de 768 px. L'URL est verifiee en
  // premier (cf. allerA), mais un marqueur qui accroche la barre de navigation
  // rend l'assertion de contenu creuse.
  { nom: 'formulaire', lien: 'Formulaire', chemin: '/formulaire', marqueur: /ajouter un client/i },
  // ⚠ `/actualiser/i` et NON `/actualiser la liste/i` : « Actualiser la liste »
  // est un `aria-label`, et `getByText` lit le CONTENU TEXTUEL, pas les noms
  // accessibles. Premier jet rouge aux trois largeurs, sur un ecran parfaitement
  // sain — le defaut etait dans mon marqueur. Le texte reellement rendu par ce
  // bouton est « Actualiser », ou « Chargement… » pendant le chargement.
  { nom: 'demandes-dealer', lien: 'Demandes Dealer', chemin: '/dealer-requests', marqueur: /actualiser|chargement/i },
  { nom: 'dettes-internes', lien: 'Dettes internes', chemin: '/store/debts', marqueur: /ce que je dois et ce qu'on me doit/i },
]

/**
 * Les deux routes de l'espace boutique SANS entree de navigation : on ne peut
 * y arriver que par une URL directe (`/store/closures`) ou depuis une demande
 * existante (`/dealer-requests/:id`).
 *
 * Elles ne sont PAS dans ECRANS, et ce n'est pas un oubli : `allerA` navigue
 * par lien ou par liste deroulante, et aucune des deux ne les propose. Elles
 * sont donc declarees ici, et couvertes par leur propre test. Le detail d'une
 * demande attend un identifiant seme — il reste decouvert, et c'est ecrit dans
 * le bilan plutot que masque.
 */
const ECRANS_SANS_LIEN = [
  { nom: 'clotures', chemin: '/store/closures', marqueur: /clôtures dealer|aucune clôture/i },
]

test.beforeAll(async () => {
  await mkdir(CAPTURES, { recursive: true })
})

async function seConnecter(page) {
  await page.goto('/')

  const champEmail = page.locator('input[type="email"]').first()
  const champMdp = page.locator('input[type="password"]').first()
  await expect(champEmail).toBeVisible({ timeout: 60_000 })

  // `pressSequentially` et NON `fill` — ce n'est pas une préférence de style.
  // Les champs sont contrôlés par useFormValidation : `fill` pose la valeur dans
  // le DOM sans que l'état React la reçoive, donc `values` reste vide, la
  // validation refuse la soumission, et AUCUNE requête ne part. Le pire est que
  // rien ne s'affiche : `getFieldError` ne montre une erreur que sur un champ
  // `touched`, et `fill` ne déclenche pas de blur. Diagnostiqué en observant le
  // réseau — zéro appel à l'émulateur — plutôt qu'en devinant.
  await champEmail.click()
  await champEmail.pressSequentially(COMPTE.email, { delay: 5 })
  await champEmail.blur()
  await champMdp.click()
  await champMdp.pressSequentially(COMPTE.motDePasse, { delay: 5 })
  await champMdp.blur()

  await page.getByRole('button', { name: /se connecter/i }).click()

  // Repère de sortie valable aux DEUX largeurs : la barre de navigation existe dans les
  // deux formes, alors qu'un lien nommé n'existe qu'au-dessus de `md`.
  await expect(page.locator('nav').first()).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('input[type="email"]')).toHaveCount(0, { timeout: 60_000 })
}

/**
 * La navigation change de NATURE selon la largeur : liens horizontaux au-dessus
 * de `md` (768 px), et un <select> en dessous (NavBar.jsx:191). Chercher un lien
 * à 375 px ne trouve donc rien — ce n'était pas un défaut de l'application mais
 * de mon relevé. On emprunte le chemin réellement offert à chaque largeur.
 */
async function allerA(page, ecran) {
  const lien = page.getByRole('link', { name: ecran.lien }).first()
  const selecteur = page.getByRole('combobox', { name: /navigation principale/i })

  if (await lien.isVisible().catch(() => false)) {
    await lien.click()
  } else {
    await expect(selecteur).toBeVisible({ timeout: 30_000 })
    // Selection par VALEUR (le chemin de route) et non par libelle : Playwright
    // exige une chaine exacte pour `label`, et le libelle porte un badge de
    // compteur quand il y a des elements en attente (« Transactions (2) »).
    // La valeur, elle, ne bouge pas.
    await selecteur.selectOption(ecran.chemin)
  }

  // ── D'ABORD l'URL, ENSUITE le contenu ────────────────────────────────────
  //
  // Cet ordre repare un faux positif que j'avais introduit : le marqueur de
  // l'historique est /historique/i, et « Historique » est aussi le LIBELLE DU
  // LIEN de navigation, visible en permanence au-dessus de 768 px. Le test
  // declarait donc l'arrivee alors que la page n'avait pas bouge — il validait
  // sa propre navigation ratee. Idem pour /transaction/i et /client/i.
  //
  // Ce n'etait invisible qu'a 375 px, ou la navigation est un <select> : aucun
  // texte de lien a accrocher, donc le test attendait vraiment.
  //
  // L'URL, elle, ne peut pas etre confondue avec un libelle. Et quand elle
  // echoue, le message dit ou l'on se trouve reellement — ce qui distingue « le
  // clic n'a pas navigue » de « la route a rendu une page vide ».
  await expect
    .poll(() => new URL(page.url()).pathname, {
      message: `la navigation vers ${ecran.chemin} n'a pas eu lieu`,
      timeout: 30_000,
    })
    .toBe(ecran.chemin)

  // On filtre sur la VISIBILITE, et non sur l'emplacement.
  //
  // Deux tentatives ratees avant celle-ci, et elles disent pourquoi :
  //  1. `page.getByText(...)` sur la page entiere accrochait le lien de la barre
  //     de navigation desktop — present dans le DOM mais masque sous 768 px.
  //     `.first()` tombait dessus et attendait qu'un element cache apparaisse.
  //  2. Restreindre a `<main>` echouait pour le tableau de bord : « Cartes Reseau »
  //     est rendu par le rideau, qui vit HORS de <main> (Layout.jsx).
  // Ce qu'on veut dire est simplement « un element visible portant ce texte ».
  await expect(page.getByText(ecran.marqueur).filter({ visible: true }).first())
    .toBeVisible({ timeout: 30_000 })
  // Garde anti-faux-positif : on ne doit JAMAIS être retombé sur la connexion.
  await expect(page.locator('input[type="email"]')).toHaveCount(0)
}

// Budget de temps propre a ce fichier : CHAQUE test y paie une connexion
// complete en `beforeEach` (formulaire saisi caractere par caractere, aller-retour
// avec l'emulateur Auth, puis navigation cote client). Sur cette machine, les
// tests voisins mesurent 31,8 s, 44,7 s et 55,0 s — et passent. Les 60 s heritees
// de la configuration ne laissaient donc aucune marge : le test du filet a rendu
// un ROUGE sans la moindre erreur d'assertion, juste un depassement.
//
// On releve le plafond, on ne met PAS de `retries` : une nouvelle tentative
// masquerait un vrai probleme de synchronisation, alors qu'un plafond realiste
// ne fait que cesser d'interrompre un travail correct mais lent.
test.describe.configure({ timeout: 150_000 })

test.describe('Écrans de travail', () => {
  test.beforeEach(async ({ page }) => {
    await seConnecter(page)
  })

  for (const ecran of ECRANS) {
    test(`${ecran.nom} — capture, WCAG 2.2 AA, et pas de débordement`, async ({ page }, info) => {
      await allerA(page, ecran)

      await page.screenshot({
        path: `${CAPTURES}/${ecran.nom}-${info.project.name}.png`,
        fullPage: true,
      })

      // On ne se contente pas de constater le debordement : on DESIGNE le coupable.
      // Un « deborde de 40 px » sans element fautif oblige a fouiller la page a
      // la main ; ici l'echec dit ou regarder. Le coupable est l'element le plus
      // a droite dont le bord depasse la fenetre ET dont aucun ancetre ne le
      // contient par un `overflow` — sinon on accuse le contenu d'une zone
      // defilante, qui est cense depasser.
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

      const coupable = d.pire
        ? `<${d.pire.balise} class="${d.pire.classes}"> atteint ${d.pire.droite}px`
        : 'aucun element non contenu identifie'
      expect(d.scroll, `deborde de ${d.scroll - d.client} px — ${coupable}`)
        .toBeLessThanOrEqual(d.client)

      const resultats = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze()

      const lisible = resultats.violations.map((v) => ({
        regle: v.id,
        impact: v.impact,
        description: v.help,
        elements: v.nodes.slice(0, 4).map((n) => n.target.join(' ')),
      }))

      expect(lisible, JSON.stringify(lisible, null, 2)).toEqual([])
    })
  }

  // Les routes sans entree de navigation : meme exigence, autre chemin d'arrivee.
  for (const ecran of ECRANS_SANS_LIEN) {
    test(`${ecran.nom} — capture, WCAG 2.2 AA, et pas de débordement`, async ({ page }, info) => {
      await page.goto(ecran.chemin)

      // Meme ordre que `allerA` : l'URL d'abord, le contenu ensuite. Un
      // `goto` qui retombe sur la connexion rendrait un ecran parfaitement
      // conforme… et faux.
      await expect
        .poll(() => new URL(page.url()).pathname, {
          message: `la navigation directe vers ${ecran.chemin} n'a pas abouti`,
          timeout: 30_000,
        })
        .toBe(ecran.chemin)
      await expect(page.locator('input[type="email"]')).toHaveCount(0)
      await expect(page.getByText(ecran.marqueur).filter({ visible: true }).first())
        .toBeVisible({ timeout: 30_000 })

      await page.screenshot({
        path: `${CAPTURES}/${ecran.nom}-${info.project.name}.png`,
        fullPage: true,
      })

      const d = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }))
      expect(d.scroll, `deborde de ${d.scroll - d.client} px`).toBeLessThanOrEqual(d.client)

      const resultats = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze()

      const lisible = resultats.violations.map((v) => ({
        regle: v.id,
        impact: v.impact,
        description: v.help,
        elements: v.nodes.slice(0, 4).map((n) => n.target.join(' ')),
      }))
      expect(lisible, JSON.stringify(lisible, null, 2)).toEqual([])
    })
  }

  test("aucun texte technique ne s'affiche a l'utilisateur", async ({ page }) => {
    // NE PAS SUPPRIMER — ce controle vient d'un defaut REEL, vu par le client sur
    // son ecran : un commentaire de code s'affichait en toutes lettres au-dessus
    // de « Navigation par jour ».
    //
    // La cause est un piege propre a JSX. Un `//` juste apres `return (` est en
    // position d'EXPRESSION JavaScript : le compilateur le supprime. Le meme `//`
    // place entre deux balises est un ENFANT JSX : il devient du TEXTE RENDU.
    //
    //     return (            <div>
    //       // invisible        // AFFICHE A L'ECRAN
    //       <div/>              <span/>
    //     )                   </div>
    //
    // Aucun test unitaire ne pouvait l'attraper : le composant se montait sans
    // erreur, le rendu etait valide, et la chaine parasite n'etait qu'un noeud
    // texte de plus. Il fallait REGARDER la page.
    //
    // On elargit au-dela des commentaires : tout ce qui trahit de la mecanique
    // interne n'a rien a faire devant un caissier.
    const INTERDITS = [
      { motif: /\/\/\s*\S/, quoi: 'commentaire de code (//)' },
      { motif: /\/\*|\*\//, quoi: 'commentaire de code (/* */)' },
      { motif: /className|classname/i, quoi: 'attribut de style' },
      { motif: /=>|===|!==/, quoi: 'operateur JavaScript' },
      { motif: /\b(undefined|NaN)\b/, quoi: 'valeur non definie' },
      { motif: /\[object Object\]/, quoi: 'objet non formate' },
      { motif: /\b(flex-wrap|justify-between|text-gray-\d|px-\d|py-\d)\b/, quoi: 'classe utilitaire' },
      { motif: /\bFirebaseError\b|\bpermission-denied\b/, quoi: 'erreur technique brute' },
    ]

    for (const ecran of ECRANS) {
      await allerA(page, ecran)
      const texte = await page.locator('body').innerText()

      for (const { motif, quoi } of INTERDITS) {
        const trouve = texte.match(motif)
        expect(
          trouve,
          `${quoi} visible sur « ${ecran.nom} » : ${JSON.stringify(texte.slice(Math.max(0, (trouve?.index ?? 0) - 60), (trouve?.index ?? 0) + 120))}`,
        ).toBeNull()
      }
    }
  })

  test('les soldes semés sont bien affichés', async ({ page }) => {
    // Sans ce contrôle, une erreur de forme dans le seed donnerait des écrans à
    // zéro et des captures qui ne prouvent rien. C'est arrivé : la première
    // version écrivait un document par réseau alors que l'application en lit un
    // seul (`networkBalances/current`), et les six réseaux affichaient 0.
    await allerA(page, ECRANS[0])
    const corps = await page.locator('body').innerText()
    // On compare des CHIFFRES NUS. Le francais separe les milliers par une
    // espace insecable (U+00A0) ou fine insecable (U+202F) selon ce que choisit
    // Intl a l'execution : une expression reguliere devrait enumerer ces variantes,
    // et elles sont invisibles a la relecture comme au lint. Normaliser supprime
    // la question au lieu de la gerer.
    const chiffres = corps.replace(/[^0-9]/g, '')
    expect(chiffres, 'le solde Orange seme doit apparaitre').toContain('1250000')
  })

  test('le filet du registre est bien pose sur la colonne des montants', async ({ page }) => {
    // La signature de l'identite (DESIGN.md §2). Sans ce controle, une capture
    // d'ecran ne dirait pas si le filet est rendu ou seulement declare : la regle
    // CSS peut etre emise et ne s'appliquer a aucun element si `data-montant`
    // manque, ou si aucune transaction n'est affichee.
    await allerA(page, ECRANS[2]) // historique

    const cellule = page.locator('td[data-montant]').first()
    await expect(cellule).toBeVisible({ timeout: 30_000 })

    const rendu = await cellule.evaluate((el) => {
      const cs = getComputedStyle(el)
      return {
        alignement: cs.textAlign,
        bordure: cs.borderLeftWidth,
        police: cs.fontFamily,
        chiffres: cs.fontVariantNumeric,
      }
    })

    expect(rendu.alignement, 'les montants doivent etre cales a droite').toBe('right')
    expect(parseFloat(rendu.bordure), 'le filet doit etre visible').toBeGreaterThanOrEqual(2)
    expect(rendu.police, 'les montants doivent etre en chasse fixe').toMatch(/Plex Mono/i)
    expect(rendu.chiffres, 'chiffres tabulaires').toContain('tabular-nums')
  })

  test('le rail de soldes apparait au defilement, colle sous la navigation', async ({ page }) => {
    // Ce controle ne peut pas exister ailleurs : il porte sur le DEFILEMENT et
    // sur des elements en `position: fixed`. jsdom ne calcule aucune mise en
    // page, donc la suite unitaire est aveugle a exactement ce risque-la.
    await allerA(page, ECRANS[2]) // historique — la liste la plus longue

    const rail = page.locator('[data-balance-rail]')
    await expect(rail).toHaveCount(1)

    // En haut de page, le rail doit etre HORS de l'ecran : il ne coute aucune
    // hauteur tant que le bandeau photo est visible. C'est toute sa raison
    // d'etre — un bandeau permanent supplementaire aurait repousse les
    // transactions vers le bas sur un telephone.
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect(rail).toHaveAttribute('aria-hidden', 'true')
    const auRepos = await rail.boundingBox()
    expect(auRepos.y + auRepos.height, 'le rail doit etre hors ecran au repos')
      .toBeLessThanOrEqual(1)

    // Une fois le bandeau photo sorti de l'ecran, la navigation passe en fixe et
    // le rail vient s'y accrocher : la place qu'il prend est celle que la photo
    // vient de liberer.
    await page.evaluate(() => window.scrollTo(0, 600))
    await expect(rail).toHaveAttribute('aria-hidden', 'false')

    // Colle SOUS la navigation, sans trou ni recouvrement. C'est le vrai risque
    // d'integration : la position du rail derive d'une hauteur MESUREE, et une
    // mesure fausse se voit ici et nulle part ailleurs.
    //
    // `expect.poll` et NON une mesure unique : le rail arrive avec une
    // transition. Prise a l'instant ou `aria-hidden` bascule, la mesure tombe au
    // milieu de l'animation — c'est ce qui avait donne trois ecarts DIFFERENTS
    // aux trois largeurs (13,1 / 13,1 / 20,1 px) et masque la nature du defaut
    // derriere trois chiffres qui n'avaient rien a se dire. On attend l'etat
    // final au lieu de le supposer atteint.
    await expect
      .poll(async () => {
        const [barre, r] = await Promise.all([
          page.locator('nav').first().boundingBox(),
          rail.boundingBox(),
        ])
        return Math.abs(r.y - (barre.y + barre.height))
      }, { message: 'le rail doit venir toucher le bas de la navigation', timeout: 10_000 })
      .toBeLessThanOrEqual(2)

    // Les soldes semes doivent s'y lire, sinon le rail est une decoration.
    const chiffres = (await rail.innerText()).replace(/[^0-9]/g, '')
    expect(chiffres, 'le solde Orange doit apparaitre dans le rail').toContain('1250000')

    // Et il ne doit pas fabriquer de debordement horizontal : il defile
    // lui-meme, il ne pousse pas la page.
    const d = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }))
    expect(d.scroll, `le rail fait deborder la page de ${d.scroll - d.client} px`)
      .toBeLessThanOrEqual(d.client)

    const resultats = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    const lisible = resultats.violations.map((v) => ({
      regle: v.id, impact: v.impact, description: v.help,
      elements: v.nodes.slice(0, 4).map((n) => n.target.join(' ')),
    }))
    expect(lisible, JSON.stringify(lisible, null, 2)).toEqual([])
  })

  test("n'affiche jamais les données de l'autre boutique", async ({ page }) => {
    // Le cloisonnement par boutique est une exigence de CLAUDE.md, et la seule
    // manière honnête de l'éprouver est d'avoir une seconde boutique peuplée de
    // montants reconnaissables. Une boutique unique ne prouve rien.
    for (const ecran of ECRANS) {
      await allerA(page, ecran)
      const corps = await page.locator('body').innerText()
      expect(corps, `fuite de données de la boutique témoin sur ${ecran.nom}`)
        .not.toContain(MONTANT_TEMOIN)
    }
  })
})
