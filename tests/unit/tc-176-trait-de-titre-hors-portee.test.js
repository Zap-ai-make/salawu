/**
 * TC-176 — un trait de titre que la portée ne peut pas atteindre.
 * ─────────────────────────────────────────────────────────────────────────────
 * LE DÉFAUT QUI A FAIT NAÎTRE CE FILET, ET POURQUOI IL EST REVENU TROIS FOIS
 *
 * La refonte retire le soulignement décoratif sous les titres d'écran. Elle le
 * fait depuis `src/index.css`, sans toucher au JSX partagé avec TAOFIC, à une
 * condition : que le JSX pose le FAIT que la règle vise.
 *
 *     .design-registre [data-espace='boutique'] [data-titre-ecran] { border-bottom: 0 }
 *     .design-registre [data-espace='boutique'] [data-tete-ecran]  { border-bottom: 0 }
 *
 * Un titre qui ne porte ni l'un ni l'autre est INVISIBLE à la portée. Il garde
 * son trait, et rien ne rougit — ni la suite, qui n'asserte sur aucune classe,
 * ni le banc, qui ne visite pas cet écran-là.
 *
 * Le même oubli s'est produit TROIS FOIS, sur trois formes différentes :
 *
 *   L7.1   `<h1 …border-b-2 border-green-500>` sur Transactions et Historique
 *          → corrigé, les deux `<h1>` marqués `data-titre-ecran`.
 *   L8.1d  le trait n'était pas sur le titre mais sur le DIV qui l'enveloppe
 *          (`border-b-2 border-current`, Dashboard et ClientsTable)
 *          → corrigé, `data-tete-ecran` ajouté sur les deux branches.
 *   L9.1   `<h2 …border-b-2 border-green-500>` dans ClientForm
 *          → le présent lot. Trouvé à l'œil, dans une capture du banc, en
 *            comparant l'écran Formulaire à la maquette. Pas par un test.
 *
 * Trois fois le même défaut, trois fois trouvé à la main : ce n'est plus un
 * oubli, c'est une classe d'oublis. D'où ce filet.
 *
 * CE QU'IL VÉRIFIE
 *
 * Il part des ONZE points d'entrée de l'espace boutique — le Layout et les dix
 * routes de src/App.jsx — puis SUIT LES IMPORTS, exactement comme les deux
 * sondes de `scripts/qa/`. C'est ce périmètre, et pas `src/` entier, qui
 * compte : les espaces dealer et gérant gardent leur apparence, la portée CSS ne
 * les atteint pas, et un trait vert y est hors sujet.
 *
 * Dans ce graphe, tout `<h1>`–`<h4>` qui porte une bordure basse doit porter
 * `data-titre-ecran` ou `data-tete-ecran`.
 *
 * ⚠ CE QU'IL NE VÉRIFIE PAS. Il lit le SOURCE, par expression régulière, et
 * n'attrape donc que le trait écrit EN CLAIR sur la balise du titre. Un trait
 * posé sur un div enveloppant — le cas L8.1d — lui échappe encore : le tenir
 * demanderait de parser le JSX. C'est assumé, et c'est écrit ici pour que le
 * prochain lecteur ne croie pas le filet plus large qu'il n'est.
 *
 * ⚠ LE GRAPHE EST RECOPIÉ, ET C'EST LA TROISIÈME COPIE. `comptage-` et
 * `vocabulaire-espace-boutique.mjs` en ont chacune une, et les deux DIVERGENT
 * déjà (l'une suit `import()` et `export … from`, l'autre non). Les unifier
 * changerait les chiffres que ces sondes ont déjà publiés — c'est un lot à soi
 * seul, pas un effet de bord de celui-ci. Cette copie suit la version la plus
 * large, celle de `comptage-`.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'

const RACINE = resolve('.')

/** Le Layout et les dix routes de src/App.jsx. */
const ENTREES = [
  'src/components/Layout.jsx',
  'src/pages/Dashboard.jsx',
  'src/pages/Clients.jsx',
  'src/pages/Transactions.jsx',
  'src/pages/Historique.jsx',
  'src/pages/Formulaire.jsx',
  'src/pages/Profil.jsx',
  'src/pages/store/StoreAdminDealerRequests.jsx',
  'src/pages/store/StoreAdminDealerRequestDetails.jsx',
  'src/pages/store/StoreAdminClosures.jsx',
  'src/pages/store/StoreInternalDebts.jsx',
]

const EXTENSIONS = ['', '.js', '.jsx', '.ts', '.tsx', '/index.js', '/index.jsx']

const MOTIF_IMPORT =
  /(?:^|\n)\s*import\s[^'"]*?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|export\s[^'"]*?from\s*['"]([^'"]+)['"]/g

function resoudre(depuis, specificateur) {
  if (!specificateur.startsWith('.')) return null
  const base = join(dirname(depuis), specificateur)
  for (const ext of EXTENSIONS) {
    const candidat = base + ext
    if (!existsSync(candidat)) continue
    if (statSync(candidat).isDirectory()) continue
    return relative(RACINE, resolve(candidat)).split(sep).join('/')
  }
  return null
}

function grapheBoutique() {
  const vus = new Set()
  const file = [...ENTREES]
  while (file.length > 0) {
    const chemin = file.shift()
    if (vus.has(chemin)) continue
    if (!existsSync(chemin)) continue
    vus.add(chemin)
    const source = readFileSync(chemin, 'utf8')
    for (const m of source.matchAll(MOTIF_IMPORT)) {
      const specificateur = m[1] ?? m[2] ?? m[3]
      if (!specificateur) continue
      const cible = resoudre(chemin, specificateur)
      if (cible && !vus.has(cible)) file.push(cible)
    }
  }
  return [...vus].sort()
}

/** Les balises de titre, avec la suite de leurs attributs. */
const BALISE_TITRE = /<h([1-4])\b([^>]*)>/g

/** Les marqueurs que `src/index.css` sait atteindre. */
const MARQUEURS = /data-titre-ecran|data-tete-ecran/

describe('TC-176 — aucun trait de titre hors de portée de la refonte', () => {
  const fichiers = grapheBoutique()

  it('parcourt bien le graphe boutique (garde-fou du filet lui-même)', () => {
    // Un filet qui ne lit aucun fichier est vert pour rien — même piège que le
    // faux vert de la suite, même fermeture : un décompte, vérifié.
    // Relevé du 2026-09-18 : 135 fichiers. Le seuil est volontairement bas :
    // il attrape un graphe cassé, pas une variation normale du dépôt.
    expect(fichiers.length).toBeGreaterThan(100)
    expect(fichiers).toContain('src/components/ClientForm.jsx')
  })

  it('tout titre souligné de l’espace boutique porte un marqueur de portée', () => {
    const orphelins = []
    for (const chemin of fichiers) {
      const source = readFileSync(chemin, 'utf8')
      for (const m of source.matchAll(BALISE_TITRE)) {
        const attributs = m[2]
        if (!/border-b/.test(attributs)) continue
        if (MARQUEURS.test(attributs)) continue
        orphelins.push(`${chemin} : <h${m[1]}> souligné, sans marqueur`)
      }
    }

    expect(
      orphelins,
      'un titre souligné que `.design-registre [data-espace="boutique"]` ne peut pas\n' +
        'atteindre — ajouter `data-titre-ecran` (le titre) ou `data-tete-ecran`\n' +
        '(son enveloppe) sur la balise :\n' +
        orphelins.join('\n'),
    ).toEqual([])
  })

  it('⚠ les quatre titres soulignés connus gardent leur marqueur', () => {
    // Ce cas NOMME les porteurs. Sans lui, retirer un marqueur ET la classe
    // `border-b-2` du même geste laisserait le cas précédent vert, alors que le
    // titre aurait perdu la règle qui le tient sous la portée.
    const connus = [
      'src/components/ClientForm.jsx',
      'src/components/ClientsTable.jsx',
      'src/pages/Historique.jsx',
      'src/pages/Transactions.jsx',
    ]
    for (const chemin of connus) {
      const source = readFileSync(chemin, 'utf8')
      const titres = [...source.matchAll(BALISE_TITRE)].map((m) => m[2])
      expect(
        titres.some((attributs) => MARQUEURS.test(attributs)),
        `${chemin} doit garder au moins un titre marqué`,
      ).toBe(true)
    }
  })
})
