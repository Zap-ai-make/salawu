import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { seConnecter, allerA, mesurerDebordement, violationsAxe } from './lib/parcours.mjs'
import { ETATS, MONTANT_TEMOIN as MONTANT_TEMOIN_NOMBRE } from '../../scripts/qa/etats-du-banc.mjs'

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

// Les identifiants viennent du MÊME module que le seed (`etats-du-banc.mjs`,
// données pures, aucun effet de bord). Ils étaient recopiés ici avec une note
// « doit rester synchronisé » — une note n'est pas un mécanisme.
const COMPTE = ETATS.dense.compte

/**
 * Montant de la boutique TÉMOIN (facteur 7 sur Orange : 1 250 000 × 7). S'il
 * apparaissait sur un écran de la boutique QA, le cloisonnement serait rompu.
 *
 * ⚠ En CHIFFRES NUS. Ce contrôle était écrit `'8 750 000'`, avec une espace
 * ordinaire — alors que le français sépare les milliers par une insécable
 * (U+00A0) ou une fine insécable (U+202F), selon ce qu'Intl choisit à
 * l'exécution. Un `not.toContain` sur la mauvaise espace ne peut JAMAIS
 * correspondre : le contrôle de cloisonnement passait au vert par construction,
 * y compris sur une fuite réelle. C'est le pire genre de test — celui qui
 * rassure sans rien vérifier. Le test voisin (« les soldes semés sont bien
 * affichés ») normalisait déjà ; celui-ci ne le faisait pas.
 */
const MONTANT_TEMOIN = String(MONTANT_TEMOIN_NOMBRE)

// `lien` = libellé exact dans la barre de navigation.
// `marqueur` = texte présent sur l'écran d'arrivée ET ABSENT de l'écran de
// connexion. C'est une contrainte, pas un détail : mon premier jeu de marqueurs
// contenait /profil|boutique/i, et « boutique » figure sur l'écran de connexion
// (« Créer un compte boutique ») — le test passait au vert en regardant la page
// de login. Un marqueur trop lâche ne vérifie rien.
const ECRANS = [
  // ⚠ Le marqueur du tableau de bord etait `/cartes réseau/i` — le libelle du
  // bouton de repli du rideau. Il etait DEJA mauvais avant de disparaitre au lot
  // L7.4b : rendu par le Layout, il etait present sur les huit ecrans, donc
  // satisfait par la page qu'on venait de quitter (cf. la note de `allerA`).
  // Celui-ci est pris sur le contenu propre du tableau de bord, et sur rien
  // d'autre — c'est la regle enoncee douze lignes plus bas.
  //
  // ⟲ TOLERANCE RETIREE AU LOT L8.1b, et elle s'est eteinte d'elle-meme.
  //
  // Un `defautFige` gelait ici le contraste du code agent — `text-orange-600`
  // sur blanc, 3,57:1 contre 4,5:1 exige. Il etait ecrit pour EXIGER que le
  // defaut soit encore la : le jour de sa correction, il rougissait et devait
  // etre retire. C'est ce qui vient d'arriver.
  //
  // Le contraste n'a pas ete repeint : la colonne qui le portait n'existe plus.
  // Le tableau de bord ne garde que trois colonnes (nom et prenom, localite,
  // date), et les informations de FICHE sont retournees a la fiche.
  { nom: 'tableau-de-bord', lien: 'Tableau de bord', chemin: '/', marqueur: /derniers clients enregistrés/i },
  { nom: 'transactions', lien: 'Transactions', chemin: '/transactions', marqueur: /transaction/i },
  { nom: 'historique', lien: 'Historique', chemin: '/historique', marqueur: /historique/i },
  // 〉 RETOURNÉ AU LOT L8.2 — DEUX DÉFAUTS FIGÉS ONT DISPARU ENSEMBLE.
  //
  // 1. Un débordement de 249 px à 375 px, causé par une rangée de pagination en
  //    `flex` SANS `flex-wrap` (Pagination.jsx) : un flex sans wrap ne rétrécit
  //    pas, il pousse. La barre passe désormais à la ligne.
  //
  // 2. Du blanc sur `bg-orange-500` — 2,82:1 contre 4,5:1 exigé — sur le bouton
  //    « Modifier » de CHAQUE ligne, aux trois largeurs. Les actions de ligne
  //    portent maintenant `data-rang="second"` : un contour, pas un aplat, et
  //    du --brand-600 à 9,39:1 sur le papier.
  //
  // ⚠ LE SECOND ÉTAIT CACHÉ PAR LE PREMIER : l'assertion de débordement
  // interrompait le test AVANT le scan axe. C'est ce qui justifie de geler par
  // la VALEUR plutôt que de laisser rouge — un rouge arrête tout, un gel laisse
  // le reste du contrôle travailler.
  //
  // Les deux tolérances ont ROUGI d'elles-mêmes au premier banc suivant la
  // correction (« le débordement figé de « clients » a disparu », « le défaut
  // figé de « clients » a disparu »), aux trois largeurs. Elles sont retirées
  // ici : c'est la preuve que la correction a eu lieu, et non le souvenir.
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
// ⚠ 180 s et non 150 : le plafond d'un test doit rester SUPÉRIEUR à la somme des
// attentes qu'il contient, sinon c'est lui qui rompt en premier et le rouge ne
// dit plus quoi. `allerA` attend désormais jusqu'à 45 s le rendu d'une route
// `lazy` compilée à la demande (cf. parcours.mjs) ; avec la connexion, la
// stabilisation et le contrôle d'URL, 150 s ne laissaient plus de marge.
test.describe.configure({ timeout: 180_000 })

test.describe('Écrans de travail', () => {
  test.beforeEach(async ({ page }) => {
    await seConnecter(page, COMPTE)
  })

  for (const ecran of ECRANS) {
    test(`${ecran.nom} — capture, WCAG 2.2 AA, et pas de débordement`, async ({ page }, info) => {
      await allerA(page, ecran)

      await page.screenshot({
        path: `${CAPTURES}/${ecran.nom}-${info.project.name}.png`,
        fullPage: true,
      })

      // ── Relevé des titres RENDUS (relevé, pas assertion) ──────────────────
      //
      // `npm run qa:comptage` compte les `<h1>` DÉCLARÉS dans le source, et il
      // en compte trop : Dashboard.jsx et Layout.jsx en déclarent deux chacun,
      // dont un seul s'exécute (chargement/chargé, bandeau photo/en-tête sobre).
      // Une sonde qui lit du texte ne sait pas quelle branche tourne.
      //
      // Ici on est dans un navigateur, donc on MESURE. On RELÈVE sans asserter :
      // le double titre est le défaut déjà gelé par tc-162, et l'exiger ici
      // rendrait la boucle rouge pour une correction déjà datée.
      // ⟲ DEVIENT UNE ASSERTION AU LOT L7.1.
      const titres = await page.evaluate(() =>
        [...document.querySelectorAll('h1')]
          .filter((h) => h.getClientRects().length > 0)
          .map((h) => h.textContent.trim().slice(0, 40)),
      )
      console.log(`  h1 rendus [${ecran.nom}] : ${titres.length} — ${titres.join(' | ')}`)

      const d = await mesurerDebordement(page)
      const depassement = d.scroll - d.client

      const debordementFige = ecran.debordementFige?.[info.project.name]

      if (debordementFige) {
        // Figé PAR SA VALEUR, et borné des DEUX côtés. Un simple « on tolère un
        // débordement ici » laisserait passer n'importe quelle aggravation, et
        // ne dirait jamais que le défaut a été corrigé. Avec les deux bornes, ce
        // bloc rougit dans les deux cas, et doit alors être revu.
        expect(depassement, `le débordement figé de « ${ecran.nom} » a disparu — retirer sa tolérance`)
          .toBeGreaterThan(0)
        expect(depassement, `le débordement de « ${ecran.nom} » s'est AGGRAVÉ : ${depassement} px ` +
          `au lieu de ${debordementFige} — ${d.coupable}`)
          .toBeLessThanOrEqual(debordementFige)
      } else {
        expect(d.scroll, `deborde de ${depassement} px — ${d.coupable}`)
          .toBeLessThanOrEqual(d.client)
      }

      const violations = await violationsAxe(page)

      // ── Défauts FIGÉS : nommés, pas masqués ───────────────────────────────
      //
      // Une tolérance d'accessibilité qui se contente d'ignorer une règle est un
      // mensonge qui dure. Celle-ci fait l'inverse : elle EXIGE que le défaut
      // soit encore là. Le jour où il est corrigé — ou disparaît parce que
      // l'écran a été redessiné — ce bloc rougit, et la tolérance doit être
      // retirée. Un filet ne peut pas se périmer en silence.
      const fige = ecran.defautFige
      if (fige) {
        expect(
          violations.some((v) => v.regle === fige.regle && v.elements.some((e) => fige.element.test(e))),
          `le défaut figé de « ${ecran.nom} » a disparu — retirer sa tolérance ici et dans ECRANS`,
        ).toBe(true)
      }

      const restantes = fige
        ? violations
            .map((v) => v.regle !== fige.regle
              ? v
              : { ...v, elements: v.elements.filter((e) => !fige.element.test(e)) })
            .filter((v) => v.elements.length > 0)
        : violations

      expect(restantes, JSON.stringify(restantes, null, 2)).toEqual([])
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

      // Ces routes mesuraient le débordement SANS désigner de coupable — un
      // reliquat de la première version. Elles partagent maintenant la sonde
      // complète : même exigence, même message d'échec exploitable.
      const d = await mesurerDebordement(page)
      expect(d.scroll, `deborde de ${d.scroll - d.client} px — ${d.coupable}`)
        .toBeLessThanOrEqual(d.client)

      const violations = await violationsAxe(page)
      expect(violations, JSON.stringify(violations, null, 2)).toEqual([])
    })
  }

  test("aucun texte technique ne s'affiche a l'utilisateur", async ({ page }) => {
    // ⚠ BUDGET PROPRE : ce test paie HUIT navigations la ou les douze autres en
    // paient une. Mesure du 2026-09-16 : 2,1 min et 2,8 min pour les deux tests
    // qui parcourent tous les ecrans, contre 8 a 30 s pour les autres. A 180 s,
    // c'est le PLAFOND qui rompait en premier — et le rouge accusait alors la
    // derniere attente en cours (« la page precedente est encore rendue »)
    // plutot que la vraie cause. Un test doit echouer sur ce qu'il mesure.
    test.setTimeout(420_000)

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

  test('les champs de saisie sont bornes et montrent ou lon tape', async ({ page }) => {
    // ⚠ CE CONTROLE NE PEUT PAS ETRE UN TEST UNITAIRE, et c'est le coeur de son
    // interet. jsdom ne calcule aucune couleur, aucune specificite, aucun
    // `outline`. Or tout le lot L9.2 repose sur une course de specificite : une
    // regle a (0,5,1) doit battre dix-huit `focus:outline-none` a (0,2,0). Seul
    // un vrai moteur tranche cela, et il faut un champ REELLEMENT rendu.
    //
    // CE QUE LE LOT CORRIGE, mesure sur les onze points d'entree de l'espace :
    //   26 champs sur 43 portaient une bordure sous 3:1  (WCAG 1.4.11)
    //   18 retiraient l'anneau de focus du navigateur    (WCAG 2.4.7)
    //   11 ne le remplacaient QUE par une bordure verte  — une couleur seule
    //
    // axe ne voit ni l'un ni l'autre : 1.4.11 sur une bordure n'est pas
    // automatisable, et un anneau de focus n'existe qu'une fois le champ focus,
    // alors que le scan lit la page au repos. D'ou ces assertions nommees.
    await allerA(page, ECRANS[5]) // formulaire

    const champ = page.locator('input[name="nom"]').first()
    await expect(champ).toBeVisible({ timeout: 30_000 })

    const auRepos = await champ.evaluate((el) => {
      const cs = getComputedStyle(el)
      return { bordure: cs.borderTopColor, rayon: cs.borderTopLeftRadius }
    })

    // #778495 — le jeton --filet, 3,81:1 sur papier. C'est la valeur que WCAG
    // 1.4.11 exige (3:1) et que `border-gray-300` (1,47:1) ne tenait pas.
    expect(auRepos.bordure, 'la bordure du champ doit porter --filet')
      .toBe('rgb(119, 132, 149)')
    expect(auRepos.rayon, 'le registre est carre').toBe('2px')

    // `focus()` et non `click()` : on veut le focus programmatique, celui que
    // recoit aussi la navigation au clavier. C'est le cas que
    // `focus:outline-none` cassait.
    await champ.focus()
    const auFocus = await champ.evaluate((el) => {
      const cs = getComputedStyle(el)
      return {
        style: cs.outlineStyle,
        largeur: cs.outlineWidth,
        couleur: cs.outlineColor,
      }
    })

    expect(auFocus.style, 'l anneau de focus ne doit pas etre supprime')
      .not.toBe('none')
    expect(parseFloat(auFocus.largeur), 'l anneau doit etre visible au soleil')
      .toBeGreaterThanOrEqual(3)
    // #2a75ca — le jeton --brand-400, 4,67:1 sur papier.
    expect(auFocus.couleur, 'l anneau prend la marque').toBe('rgb(42, 117, 202)')
  })

  test('une liste deroulante recoit le meme traitement qu un champ', async ({ page }) => {
    // Un `<select>` n'est pas un `<input>` : il a ses propres regles par defaut,
    // et c'est sur lui que le choix `:focus` plutot que `:focus-visible` se
    // joue. Le verifier sur le seul champ texte du formulaire aurait laisse la
    // moitie des controles de filtre de cet espace hors du controle.
    await allerA(page, ECRANS[3]) // clients

    // ⚠ `main[data-espace="boutique"]` ET NON `select` SEUL. Premier jet rouge :
    // `page.locator('select').first()` accroche la liste de NAVIGATION de la
    // barre, qui est masquee au-dessus de 768 px — donc jamais visible a la
    // largeur du bureau. Elle vit hors de `<main>`, elle n'est pas dans la
    // portee du lot, et elle n'avait rien a faire dans ce controle.
    const liste = page.locator('main[data-espace="boutique"] select').first()
    await expect(liste).toBeVisible({ timeout: 30_000 })

    const rendu = await liste.evaluate((el) => {
      const cs = getComputedStyle(el)
      return { bordure: cs.borderTopColor, rayon: cs.borderTopLeftRadius }
    })
    expect(rendu.bordure, 'la bordure de la liste doit porter --filet')
      .toBe('rgb(119, 132, 149)')
    expect(rendu.rayon, 'le registre est carre').toBe('2px')

    await liste.focus()
    const anneau = await liste.evaluate((el) => getComputedStyle(el).outlineStyle)
    expect(anneau, 'une liste deroulante aussi doit montrer ou lon est')
      .not.toBe('none')
  })

  test('la modale du recu porte le voile du registre, et reste hors de main', async ({ page }) => {
    // ⚠ C'EST LA MODALE PAR PORTAIL QUI EST CHOISIE ICI, ET CE N'EST PAS UN
    // HASARD. `ReceiptModal` rend par `createPortal` dans `document.body` : elle
    // vit HORS de `<main data-espace="boutique">`. Une regle portee par l'espace
    // l'aurait manquee — onze modales habillees sur douze, en silence. C'est ce
    // qui justifie que le lot L9.6 porte sur `.design-registre` + un marqueur.
    //
    // Le premier controle VERIFIE CE FAIT plutot que de le croire : si la modale
    // cesse un jour d'etre portalisee, il rougit, et l'argument de portee ecrit
    // dans src/index.css devra etre relu.
    await allerA(page, ECRANS[2]) // historique

    await page.getByRole('button', { name: 'Reçu' }).first().click()

    const voile = page.locator('[data-testid="receipt-modal"]')
    await expect(voile).toBeVisible({ timeout: 30_000 })

    const horsDeMain = await voile.evaluate((el) => !el.closest('main[data-espace]'))
    expect(horsDeMain, 'la modale du recu doit rester hors de <main> (createPortal)')
      .toBe(true)

    // rgb(9 20 33 / .55) — l'encre du registre, pas un noir pur. Le produit
    // ecrivait `bg-black/40` sur sept modales et `bg-black/50` sur quatre.
    const fond = await voile.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(fond, 'le voile doit porter l encre du registre a 55 %')
      .toBe('rgba(9, 20, 33, 0.55)')

    // Le panneau de CETTE modale n'est volontairement pas marque : son enfant
    // direct n'est qu'une enveloppe de largeur, qui contient un recu deja
    // dessine. Le panneau est mesure par le test suivant.
  })

  test('le panneau d une modale est carre et porte le filet de marque', async ({ page }) => {
    // La modale de code d'acces est la seule qu'on puisse ouvrir d'un seul clic,
    // sans remplir de formulaire et sans donnee particuliere a semer : le bouton
    // est sur chaque ligne de la liste des clients. Son panneau porte
    // `data-modale`, contrairement a celui du recu.
    //
    // ⚠ Elle n'existe que si le profil declare `mobileApp.enabled` — c'est le
    // cas de salawu (config/clients/salawu.js). On ne met PAS de `test.skip`
    // ici : un controle qui s'absente quand sa cible disparait ne garde rien,
    // et si ce bouton s'en va, ce test doit le dire.
    await allerA(page, ECRANS[3]) // clients

    await page.locator('[data-testid="btn-access-code"]').first().click()

    const panneau = page.locator('[data-modale]').first()
    await expect(panneau).toBeVisible({ timeout: 30_000 })

    const rendu = await panneau.evaluate((el) => {
      const cs = getComputedStyle(el)
      return {
        rayon: cs.borderTopLeftRadius,
        filet: cs.borderTopWidth,
        couleurFilet: cs.borderTopColor,
        fond: cs.backgroundColor,
      }
    })

    expect(rendu.rayon, 'le registre est carre').toBe('2px')
    expect(parseFloat(rendu.filet), 'le filet de tete doit faire 3 px')
      .toBeGreaterThanOrEqual(3)
    // #1b62b0 — le jeton --brand-500.
    expect(rendu.couleurFilet, 'le filet de tete prend la marque')
      .toBe('rgb(27, 98, 176)')
    expect(rendu.fond, 'le panneau est pose sur le papier').toBe('rgb(255, 255, 255)')
  })

  test('la bande des reserves ne s en va jamais, meme au defilement', async ({ page }) => {
    // ⟲ RETOURNE AU LOT L7.4b. Ce controle exigeait l'inverse : un rail qui
    // apparaissait au defilement pour COMPENSER la disparition du rideau. La
    // bande ne disparait plus — il n'y a plus rien a compenser, et le contrat
    // devient plus fort : les soldes se lisent en haut de page ET a mi-liste.
    //
    // Ce controle ne peut pas exister ailleurs : il porte sur le DEFILEMENT et
    // sur du positionnement colle. jsdom ne calcule aucune mise en page, donc la
    // suite unitaire est aveugle a exactement ce risque-la.
    await allerA(page, ECRANS[2]) // historique — la liste la plus longue

    const bande = page.locator('[data-bande-reserves]')
    await expect(bande).toHaveCount(1)
    await expect(page.locator('[data-balance-rail]'),
      'le rail collant ne doit plus etre monte').toHaveCount(0)

    // En haut de page : dans le flux, sous la navigation, et LISIBLE. C'est le
    // changement — auparavant le rideau etait la mais repliable, et le rail
    // hors ecran.
    await page.evaluate(() => window.scrollTo(0, 0))
    const auRepos = await bande.boundingBox()
    expect(auRepos.height, 'la bande doit occuper une hauteur reelle au repos')
      .toBeGreaterThan(0)

    // A mi-liste : la navigation passe en fixe et la bande vient s'y accrocher,
    // sans trou ni recouvrement. C'est le vrai risque d'integration — la
    // position de la bande derive d'une hauteur MESUREE, et une mesure fausse se
    // voit ici et nulle part ailleurs.
    //
    // `expect.poll` et NON une mesure unique : <main> compense le passage en
    // fixe par une transition de 300 ms sur son `padding-top`. Prise pendant, la
    // mesure tombe au milieu de l'animation. On attend l'etat final au lieu de
    // le supposer atteint.
    await page.evaluate(() => window.scrollTo(0, 600))
    await expect
      .poll(async () => {
        const [barre, b] = await Promise.all([
          page.locator('nav').first().boundingBox(),
          bande.boundingBox(),
        ])
        return Math.abs(b.y - (barre.y + barre.height))
      }, { message: 'la bande doit venir toucher le bas de la navigation', timeout: 10_000 })
      .toBeLessThanOrEqual(2)

    // Les soldes semes doivent s'y lire, sinon la bande est une decoration.
    const chiffres = (await bande.innerText()).replace(/[^0-9]/g, '')
    expect(chiffres, 'le solde Orange doit apparaitre dans la bande').toContain('1250000')

    // Et elle ne doit pas fabriquer de debordement horizontal : elle defile
    // elle-meme, elle ne pousse pas la page.
    const d = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }))
    expect(d.scroll, `la bande fait deborder la page de ${d.scroll - d.client} px`)
      .toBeLessThanOrEqual(d.client)

    const violations = await violationsAxe(page)
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([])
  })

  test("n'affiche jamais les données de l'autre boutique", async ({ page }) => {
    // Même budget propre que le test voisin, et pour la même raison : huit
    // navigations dans un seul test. Mesuré à 2,1 min, donc sans marge à 180 s.
    test.setTimeout(420_000)

    // Le cloisonnement par boutique est une exigence de CLAUDE.md, et la seule
    // manière honnête de l'éprouver est d'avoir une seconde boutique peuplée de
    // montants reconnaissables. Une boutique unique ne prouve rien.
    for (const ecran of ECRANS) {
      await allerA(page, ecran)
      const corps = await page.locator('body').innerText()
      const chiffres = corps.replace(/[^0-9]/g, '')
      expect(chiffres, `fuite de données de la boutique témoin sur ${ecran.nom}`)
        .not.toContain(MONTANT_TEMOIN)
    }
  })
})
