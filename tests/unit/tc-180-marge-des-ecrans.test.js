/**
 * TC-180 — la marge latérale d'un écran, et les écrans qu'on oublie de marquer.
 * ─────────────────────────────────────────────────────────────────────────────
 * LE DÉFAUT
 *
 * Le lot L9.14 a déplacé la marge latérale de `<main>` vers la carte :
 *
 *     .design-registre [data-espace='boutique']                { padding-inline: 0 }
 *     .design-registre [data-espace='boutique'] [data-surface] { padding-inline: 24px }
 *
 * Le raisonnement tenait — la carte garde son filet au bord de la fenêtre, et
 * son contenu respire à l'intérieur — mais il ne couvre QUE ce qui est dans une
 * carte. Or une seule page met la totalité de son écran dans une carte :
 * Clients. Partout ailleurs le titre, les onglets, la barre de filtres et la
 * note de convention vivent à nu sur la page — et ne recevaient rien. Cinq
 * écrans sur sept commençaient donc à ZÉRO pixel du bord de la fenêtre.
 *
 * Personne ne l'a vu pendant neuf lots. Ni la suite, qui n'asserte sur aucune
 * marge ; ni le banc, dont les captures le montraient pourtant — il a fallu que
 * le client le dise.
 *
 * CE QUE CE FILET VÉRIFIE, ET POURQUOI CE DÉCOUPAGE
 *
 * La correction (L9.22) fait porter la marge aux ENFANTS NUS d'un bloc marqué
 * `data-ecran`, en excluant les cartes qui la portent déjà. Elle a donc deux
 * points de rupture, et un seul des deux est du CSS :
 *
 *   1. UN ÉCRAN SANS MARQUEUR NE REÇOIT RIEN. C'est le défaut d'origine, reposé
 *      à l'identique : le jour où une route boutique s'ajoute sans `data-ecran`,
 *      sa page recolle au bord et rien ne rougit. Le cas part donc des ROUTES de
 *      src/App.jsx, et non d'une liste recopiée ici : une liste ne se met pas à
 *      jour toute seule, et c'est précisément ce qu'on veut attraper.
 *
 *   2. CLIENTS NE DOIT PAS ÊTRE MARQUÉ. Sa carte enveloppe tout l'écran : lui
 *      donner `data-ecran` ajouterait 24 px à ses 24 px. C'est la page que le
 *      client donne en référence — la doubler serait casser l'étalon.
 *
 *   3. LA VALEUR NE DOIT EXISTER QU'UNE FOIS. « exactement la même marge » est
 *      une demande sur l'ÉGALITÉ, pas sur le nombre : deux « 24px » recopiés la
 *      satisfont aujourd'hui et la trahissent au premier réglage.
 *
 * ⚠ CE QU'IL NE VÉRIFIE PAS. Il lit le SOURCE. Il ne sait pas si la marge REND —
 * ni jsdom ni cette suite n'appliquent src/index.css, et la suite tourne de
 * toute façon sous TAOFIC, hors de la portée `.design-registre`. Il garde que le
 * FAIT est posé et que la règle l'attend ; que les 24 px arrivent à l'écran est
 * l'affaire du banc et de l'œil. C'est écrit ici pour que le prochain lecteur ne
 * croie pas le filet plus large qu'il n'est.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const RACINE = resolve('.')
const lire = (chemin) => readFileSync(resolve(RACINE, chemin), 'utf8')

const APP = lire('src/App.jsx')
const CSS = lire('src/index.css')

/** Le marqueur, et lui seul : `data-ecran-tete` et `data-ecran-compte` existent. */
const MARQUEUR = /data-ecran(?![-\w])/

/**
 * Les écrans de l'espace boutique, relevés dans src/App.jsx.
 *
 * On isole le bloc de routes gardé par `AUTH_ROLES.STORE_ADMIN` — c'est
 * exactement le périmètre de la portée `[data-espace='boutique']`, puisque
 * `Layout` est le seul à poser ce marqueur — puis on résout chaque composant
 * d'élément vers son fichier via son `lazy(() => import(...))`.
 */
function ecransDeLaBoutique() {
  const debut = APP.indexOf('AUTH_ROLES.STORE_ADMIN')
  expect(debut, 'le bloc de routes boutique doit exister dans src/App.jsx').toBeGreaterThan(-1)
  const suivant = APP.indexOf('AUTH_ROLES.SYSTEM_MANAGER', debut)
  const bloc = APP.slice(debut, suivant > -1 ? suivant : APP.length)

  const noms = new Set()
  for (const m of bloc.matchAll(/element=\{<([A-Z][A-Za-z0-9_]*)[\s/>]/g)) noms.add(m[1])
  noms.delete('Navigate')

  return [...noms].map((nom) => {
    const imp = APP.match(new RegExp(`const ${nom} = lazy\\(\\(\\) => import\\('([^']+)'\\)\\)`))
    expect(imp, `${nom} doit etre importe par src/App.jsx`).not.toBeNull()
    const base = imp[1].replace(/^\.\//, 'src/')
    const chemin = existsSync(resolve(RACINE, base)) ? base : `${base}.jsx`
    return { nom, chemin }
  })
}

const ECRANS = ecransDeLaBoutique()

/**
 * Les deux écrans qui n'ont PAS à porter le marqueur, et la raison de chacun.
 * Toute autre absence est le défaut que ce filet existe pour attraper.
 */
const SANS_MARQUEUR = {
  // Sa carte (`ClientsTable`, `[data-surface]`) enveloppe le titre, les filtres
  // ET le tableau : elle porte déjà les 24 px. C'est l'étalon de la demande.
  Clients: {
    chemin: 'src/pages/Clients.jsx',
    raison: 'toute la page tient dans une carte, qui porte deja la marge',
  },
  // Écran legacy : sous l'identité « registre », `/formulaire` redirige vers
  // `/clients` et cette page ne rend jamais. La portée ne l'atteint pas.
  //
  // ⚠ IL N'APPARAÎT PAS DANS LE RELEVÉ DES ROUTES, et c'est normal : son
  // `element` est un ternaire (`IS_REGISTRE ? <Navigate/> : <Formulaire/>`),
  // pas un composant nu. D'où le chemin écrit ici — le fichier est vérifié
  // directement, sans passer par le relevé.
  Formulaire: {
    chemin: 'src/pages/Formulaire.jsx',
    raison: 'ecran hors identite — la route redirige sous « registre »',
  },
}

describe('TC-180 — chaque ecran de la boutique declare son niveau', () => {
  it('le releve des routes boutique n\'est pas vide', () => {
    // Si le bloc de routes change de forme, les cas suivants passeraient au vert
    // sur une liste VIDE — un filet qui n'observe rien.
    expect(ECRANS.length).toBeGreaterThanOrEqual(8)
    expect(ECRANS.map((e) => e.nom)).toContain('Transactions')
  })

  it.each(ECRANS.filter((e) => !(e.nom in SANS_MARQUEUR)))(
    '$nom pose `data-ecran` sur sa racine',
    ({ chemin }) => {
      expect(MARQUEUR.test(lire(chemin))).toBe(true)
    }
  )

  it.each(Object.entries(SANS_MARQUEUR).map(([nom, e]) => [nom, e.raison, e.chemin]))(
    '⚠ %s ne le pose PAS — %s',
    (nom, raison, chemin) => {
      expect(existsSync(resolve(RACINE, chemin)), `${chemin} doit exister`).toBe(true)
      expect(MARQUEUR.test(lire(chemin))).toBe(false)
    }
  )

  it('la carte de Clients ne prend pas la marge une seconde fois', () => {
    // `ClientsTable` est le composant qui ouvre la carte. Le marqueur posé là
    // aurait le même effet que sur la page : 24 px + 24 px.
    expect(MARQUEUR.test(lire('src/components/ClientsTable.jsx'))).toBe(false)
  })
})

describe('TC-180 — la regle attend ces faits, et une seule valeur', () => {
  it('une carte est exclue de la marge : sinon elle la prend deux fois', () => {
    const regle = CSS.match(/\[data-ecran\]\s*>\s*\*([^{]*)\{/)
    expect(regle, 'la regle `[data-ecran] > *` doit exister dans src/index.css').not.toBeNull()
    // Sans cette exclusion, le contenu d'un tableau passe de 24 à 48 px — soit
    // 26 % de la largeur sur un téléphone de 375 px, la largeur utile que le lot
    // L9.14 était justement allé rechercher.
    expect(regle[1]).toContain(':not([data-surface])')
    // Un bloc qui relaie la marge (le corps de l'Historique) ne la prend pas.
    expect(regle[1]).toContain(':not([data-ecran])')
    // Un voile `inset-0` rétréci de 48 px cesse de couvrir les bords.
    expect(regle[1]).toContain(':not(.fixed)')
    // ⚠ ET LA REPRISE POUR LES CADRES. Les deux barres de filtres du produit ne
    // déclarent pas les mêmes faits — celle de l'Historique est aussi une
    // surface, celle des Demandes Dealer non. Sans cette reprise, l'une irait à
    // fleur de fenêtre pendant que l'autre resterait à 24 px, et la barre de
    // l'Historique déborderait sous ses propres onglets.
    expect(regle[1]).toContain('[data-cadre]')
  })

  it('la marge est UNE valeur, pas trois nombres qui se ressemblent', () => {
    expect(CSS).toMatch(/--marge-ecran:\s*24px/)
    // La carte et l'écran lisent la même variable : « exactement la même marge »
    // devient vrai par construction, et pas par coïncidence.
    const lectures = CSS.match(/var\(--marge-ecran\)/g) ?? []
    expect(lectures.length).toBeGreaterThanOrEqual(4)
  })
})
