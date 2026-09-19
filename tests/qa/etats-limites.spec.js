import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { ETATS, STATUTS } from '../../scripts/qa/etats-du-banc.mjs'
import { seConnecter, allerA, mesurerDebordement, violationsAxe } from './lib/parcours.mjs'

/**
 * QA visuelle — LES ÉTATS QU'ON NE REGARDE JAMAIS.
 * ─────────────────────────────────────────────────────────────────────────────
 * `ecrans-authentifies.spec.js` regarde neuf écrans dans UN SEUL état : plein,
 * sain, tout validé. C'est l'état le plus rare de la vie d'une boutique.
 *
 * Ce fichier regarde les trois autres :
 *   • VIDE            — le premier jour ; le compte existe, rien n'a été saisi
 *   • CLAIRSEMÉ       — deux lignes ; une seule page, aucune pagination
 *   • ERREUR PARTIELLE — quatre statuts, un réseau épuisé, des champs manquants
 *
 * Chacun est une BOUTIQUE distincte avec son propre compte, jamais un paramètre
 * d'URL : le produit n'a pas à savoir qu'un banc l'observe (cf.
 * `scripts/qa/etats-du-banc.mjs`). Les identifiants viennent du même module que
 * le seed — aucune recopie, donc aucune dérive possible entre les deux.
 *
 * Pourquoi ce fichier existe : au lot précédent, l'écran Clients passait la
 * boucle depuis le début… à vide. Trois passes vertes, et huit défauts
 * d'accessibilité apparus d'un coup le jour où le banc a semé des clients. Le
 * même piège se referme ici dans l'autre sens.
 */

const CAPTURES = 'docs/audit/qa-captures/etats'

/** Les quatre écrans qui AFFICHENT des données — les seuls que l'état change. */
const ECRANS_DE_DONNEES = [
  // Marqueur pris sur le contenu propre de l'ecran — cf. la note detaillee dans
  // ecrans-authentifies.spec.js. « Cartes Réseau » etait le libelle du bouton de
  // repli du rideau, rendu par le Layout sur les huit ecrans, et disparu au lot
  // L7.4b avec le bouton lui-meme.
  { nom: 'tableau-de-bord', lien: 'Tableau de bord', chemin: '/', marqueur: /derniers clients enregistrés/i },
  { nom: 'transactions', lien: 'Transactions', chemin: '/transactions', marqueur: /transaction/i },
  { nom: 'historique', lien: 'Historique', chemin: '/historique', marqueur: /historique/i },
  { nom: 'clients', lien: 'Clients', chemin: '/clients', marqueur: /client/i },
]

/**
 * Ce qu'un écran DOIT dire quand il n'a rien à montrer.
 *
 * Une liste vide n'est pas une absence d'information : « tu n'as encore rien
 * saisi » et « le chargement a échoué » se ressemblent à l'écran et ne veulent
 * pas dire la même chose. Un tableau sans lignes et sans phrase laisse le
 * caissier décider lui-même laquelle des deux il regarde.
 *
 * ⚠ DEUX ÉCRANS SEULEMENT, et l'absence des deux autres est un FAIT DU PRODUIT,
 * pas un trou dans ce relevé.
 *
 * `globalClients` est un ANNUAIRE NATIONAL, partagé par toutes les boutiques :
 * la lecture inter-boutiques y est explicitement voulue et testée
 * (`tests/firestore/globalClients.rules.test.js:134` — « lecture inter-boutiques
 * intentionnelle » ; TC-007B-02 pour la collection entière), et
 * `firestore.js:883` s'y abonne sans filtre. La colonne « Ancienne base » n'a
 * d'ailleurs de sens que si l'on voit les clients enregistrés ailleurs.
 *
 * Conséquence directe : une boutique neuve NE PEUT PAS avoir un écran Clients
 * vide, ni un tableau de bord à zéro client, tant qu'une autre boutique existe.
 * Exiger ici une phrase de vacuité reviendrait à reprocher au produit une
 * décision de produit. Ce que ces deux écrans AFFICHENT au premier jour est une
 * question ouverte, posée au client — pas un défaut que je constate seul.
 *
 * Restent `transactions` et `historique`, qui vivent sous `clients/{storeId}/`
 * et sont donc réellement cloisonnés.
 */
const MOTS_DU_VIDE = {
  transactions: /aucune transaction/i,
  historique: /aucune transaction/i,
}

/**
 * Ce qui ne doit JAMAIS atteindre l'écran, quel que soit l'état.
 *
 * `NaN` et `undefined` sont ici pour une raison précise : l'état vide n'a PAS de
 * document `networkBalances/current`. C'est le chemin où un `toLocaleString()`
 * sur une valeur absente se voit — et il ne se voit que là.
 */
const TEXTES_INTERDITS = [
  { motif: /\bNaN\b/, quoi: 'calcul sur une valeur absente (NaN)' },
  { motif: /\bundefined\b/, quoi: 'valeur non définie' },
  { motif: /\[object Object\]/, quoi: 'objet non formaté' },
  { motif: /\bFirebaseError\b|\bpermission-denied\b/, quoi: 'erreur technique brute' },
]

const ETATS_OBSERVES = ['vide', 'clairseme', 'erreur-partielle']

// Chaque test parcourt QUATRE écrans après une connexion complète : même budget
// que les tests voisins, multiplié par le nombre d'écrans visités.
test.describe.configure({ timeout: 180_000 })

test.beforeAll(async () => {
  await mkdir(CAPTURES, { recursive: true })
})

/**
 * ⚠ Ce fichier ne tourne QU'À 375 et 1440 px — le filtre est dans
 * `playwright.config.js` (projet `tablette-768`, `testIgnore`), et non ici.
 *
 * Premier jet : un `test.skip((_fixtures, info) => …)` en tête de fichier.
 * Playwright REFUSE cette signature — il exige un patron de déstructuration en
 * premier argument — et ESLint refuse le patron vide `({}, info)` qu'il attend
 * (`no-empty-pattern`). Les deux règles sont légitimes et inconciliables sur
 * cette ligne. La configuration, elle, exprime la même chose sans contorsion,
 * et met la raison à côté des largeurs qu'elle concerne.
 */
test.describe('États limites', () => {
  for (const cle of ETATS_OBSERVES) {
    const etat = ETATS[cle]

    test(`${cle} — quatre écrans : capture, WCAG 2.2 AA, débordement`, async ({ page }, info) => {
      await seConnecter(page, etat.compte)

      // ── ON ACCUMULE, ON N'INTERROMPT PAS ──────────────────────────────────
      //
      // Première rédaction : une assertion par écran, dans la boucle. Le tableau
      // de bord échouait sur un défaut de contraste déjà connu et daté (L8.1), et
      // le test s'arrêtait là — les trois écrans suivants n'étaient JAMAIS
      // regardés, dans aucun des trois états. Un défaut connu masquait ainsi neuf
      // écrans inconnus, et il l'aurait fait jusqu'au lot qui le corrige.
      //
      // C'est exactement le travers que ce chantier combat ailleurs : une boucle
      // dont le rouge cache ce qu'elle n'a pas pu voir. On relève tout, on échoue
      // une fois, et le message dit les quatre écrans.
      const problemes = []

      for (const ecran of ECRANS_DE_DONNEES) {
        await allerA(page, ecran)

        await page.screenshot({
          path: `${CAPTURES}/${cle}-${ecran.nom}-${info.project.name}.png`,
          fullPage: true,
        })

        const d = await mesurerDebordement(page)
        if (d.scroll > d.client) {
          problemes.push(
            `[${cle} · ${ecran.nom}] déborde de ${d.scroll - d.client} px — ${d.coupable}`,
          )
        }

        const texte = await page.locator('body').innerText()
        for (const { motif, quoi } of TEXTES_INTERDITS) {
          const trouve = texte.match(motif)
          if (trouve) {
            const autour = texte.slice(Math.max(0, trouve.index - 60), trouve.index + 120)
            problemes.push(`[${cle} · ${ecran.nom}] ${quoi} : ${JSON.stringify(autour)}`)
          }
        }

        for (const v of await violationsAxe(page)) {
          problemes.push(
            `[${cle} · ${ecran.nom}] ${v.regle} (${v.impact}) — ${v.description}\n` +
              v.elements.map((e) => `        · ${e}`).join('\n'),
          )
        }
      }

      expect(problemes, `\n${problemes.join('\n')}\n`).toEqual([])
    })
  }

  // « cloisonné » et non « chaque » : deux des quatre écrans lisent l'annuaire
  // national et ne peuvent pas être vides (cf. MOTS_DU_VIDE). Le titre d'un test
  // ne doit pas promettre plus que ce que le test regarde.
  test('vide — chaque écran cloisonné DIT qu’il est vide, au lieu de le laisser deviner', async ({ page }) => {
    // Un tableau sans lignes ne distingue pas « rien à montrer » de « le
    // chargement a échoué ». C'est l'état qu'on dessine le plus soigneusement
    // et qu'on regarde le moins — celui-là même que la boucle a traversé trois
    // fois au vert sur l'écran Clients sans rien voir.
    await seConnecter(page, ETATS.vide.compte)

    for (const ecran of ECRANS_DE_DONNEES) {
      const attendu = MOTS_DU_VIDE[ecran.nom]
      if (!attendu) continue // annuaire national — cf. MOTS_DU_VIDE

      await allerA(page, ecran)
      const texte = await page.locator('body').innerText()

      expect(
        texte,
        `[vide · ${ecran.nom}] aucune phrase ne dit au caissier que l’écran est vide ` +
          `(attendu : ${attendu})`,
      ).toMatch(attendu)
    }
  })

  test('clairsemé — deux lignes suffisent à poser le filet des montants', async ({ page }) => {
    // Le filet du registre est la signature de l'identité (DESIGN.md §2). Un
    // contrôle fait sur trois pages de transactions ne prouve pas qu'il tient
    // quand il n'y a que deux lignes — or c'est la moitié des journées.
    await seConnecter(page, ETATS.clairseme.compte)
    await allerA(page, ECRANS_DE_DONNEES[2]) // historique

    const cellules = page.locator('td[data-montant]')
    await expect(cellules.first()).toBeVisible({ timeout: 30_000 })
    expect(await cellules.count(), 'deux opérations semées, deux montants attendus').toBe(2)

    const rendu = await cellules.first().evaluate((el) => {
      const cs = getComputedStyle(el)
      return { alignement: cs.textAlign, bordure: cs.borderLeftWidth, police: cs.fontFamily }
    })
    expect(rendu.alignement).toBe('right')
    expect(parseFloat(rendu.bordure), 'le filet doit être visible').toBeGreaterThanOrEqual(2)
    expect(rendu.police).toMatch(/Plex Mono/i)
  })

  test('erreur partielle — la couleur du statut ne contredit pas le mot', async ({ page }) => {
    // PREMIÈRE EXIGENCE NON NÉGOCIABLE : aucune couleur ne porte seule une
    // information. Ici le défaut est pire que « seule » — elle CONTREDIT le mot
    // qu'elle entoure.
    //
    // ⟲ CORRIGÉ AU LOT L9.5. Ce qui suit décrit l'état d'AVANT, et reste écrit
    // parce que c'est ce que ce contrôle empêche de revenir. Le défaut avait été
    // attribué au lot L8.4, qui a corrigé autre chose : ce test est donc resté
    // rouge d'un lot à l'autre, sans que personne le voie.
    //
    // `HistoriqueTable.jsx` peignait la pastille de statut en
    // `bg-green-100 text-green-800` SANS JAMAIS REGARDER LE STATUT. Une
    // opération « Annulée » s'affiche donc dans le vert de la réussite. Sur un
    // écran parcouru vite, la couleur se lit avant le mot.
    //
    // Invisible jusqu'ici parce que le banc ne semait que des « Validée » :
    // l'unique cas où ce code a raison par accident.
    await seConnecter(page, ETATS['erreur-partielle'].compte)
    await allerA(page, ECRANS_DE_DONNEES[2]) // historique

    const motsDeStatut = Object.values(STATUTS)
    // ⚠ « L'ÉLÉMENT LE PLUS INTÉRIEUR QUI PORTE LE MOT », ET NON « UN SPAN SANS
    // ENFANT ». La première version retenait les `span` FEUILLES, ce qui était
    // vrai du produit au moment où elle a été écrite et a cessé de l'être dès que
    // la pastille a reçu sa forme (un `<span>` vide, `aria-hidden`). La sonde
    // n'a alors plus rien trouvé — « 0 trouvé(s) à l'écran » — et c'est son
    // garde-fou, et non son assertion, qui l'a dit. Sans ce garde, elle serait
    // passée au vert en n'ayant rien mesuré.
    //
    // La règle ci-dessous ne suppose plus rien de la structure : on garde
    // l'élément dont le texte est le mot de statut et dont AUCUN descendant ne
    // porte déjà ce même texte. C'est la pastille, quelle que soit la façon dont
    // elle est composée — et le `<td>` qui l'enveloppe est écarté tout seul.
    const releve = await page.evaluate((mots) => {
      const trouves = []
      for (const el of document.querySelectorAll('span, div, td, p')) {
        const mot = (el.textContent || '').trim()
        if (!mots.includes(mot)) continue
        const plusInterieur = ![...el.querySelectorAll('*')].some(
          (enfant) => (enfant.textContent || '').trim() === mot,
        )
        if (!plusInterieur) continue
        const cs = getComputedStyle(el)
        trouves.push({ mot, fond: cs.backgroundColor, encre: cs.color })
      }
      return trouves
    }, motsDeStatut)

    // Sans ce garde, un relevé vide rendrait le test vert sans rien avoir mesuré.
    const distincts = new Set(releve.map((r) => r.mot))
    expect(
      distincts.size,
      `le banc sème quatre statuts distincts ; ${distincts.size} trouvé(s) à l’écran — ` +
        'la mesure n’a rien à quoi se rattacher',
    ).toBeGreaterThanOrEqual(3)

    const peinture = new Map()
    for (const r of releve) peinture.set(r.mot, `${r.fond} sur ${r.encre}`)
    const couleurDeLaReussite = peinture.get(STATUTS.VALIDEE)

    for (const [mot, couleur] of peinture) {
      if (mot === STATUTS.VALIDEE) continue
      expect(
        couleur,
        `« ${mot} » est peint exactement comme « ${STATUTS.VALIDEE} » (${couleur}). ` +
          'La pastille ne lit plus le statut : une opération annulée porte le vert ' +
          'de la réussite. Vérifier que `data-statut` est bien posé dans ' +
          'HistoriqueTable.jsx et que le bloc « LA PASTILLE DE STATUT » de ' +
          'src/index.css (lot L9.5) est toujours là — la règle de la table vit ' +
          'dans utils/statutDuMouvement.js (TC-177).',
      ).not.toBe(couleurDeLaReussite)
    }
  })
})
