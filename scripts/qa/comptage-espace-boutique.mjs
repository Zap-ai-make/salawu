/**
 * comptage-espace-boutique.mjs — le tableau du diagnostic, rejouable.
 * ─────────────────────────────────────────────────────────────────────────────
 * Pourquoi cette sonde existe
 *
 * Le diagnostic de la refonte tient dans un tableau : combien de couleurs hors
 * palette, de neutres, de hex en dur et d'emoji vivent dans l'espace boutique.
 * Ce tableau ne doit plus bouger qu'en BAISSANT, et chaque lot doit pouvoir le
 * prouver. Or les chiffres d'origine (566 / 511 / 36 / 20) ont été produits par
 * un comptage qui n'a jamais été versionné : ils ne sont donc ni rejouables, ni
 * vérifiables, ni opposables au lot suivant.
 *
 * « Un chiffre porte la commande qui l'a produit, ou il ne figure pas dans le
 * rapport. » Voici la commande.
 *
 * CE QU'ELLE COMPTE, ET SUR QUEL PÉRIMÈTRE
 *
 * Elle part des ONZE points d'entrée de l'espace boutique — le Layout et les dix
 * routes de src/App.jsx — puis SUIT LES IMPORTS. C'est le point qui avait piégé
 * le premier relevé du chantier C2EGF : compter les fichiers de `pages/` annonce
 * « Clients 0 · Formulaire 0 », alors que les écrans sont faits par des
 * COMPOSANTS. On compte les pages ET les composants qui les font.
 *
 * Les espaces dealer et gérant sont hors périmètre et n'entrent pas dans le
 * graphe : ils gardent leur apparence actuelle, et c'est assumé.
 *
 * ⚠ CE QU'ELLE NE PROUVE PAS. Un utilitaire compté n'est pas un pixel rendu :
 * une classe peut être morte, conditionnelle, ou masquée. Le comptage mesure
 * la DISPERSION de la couleur dans le code, pas ce que l'écran montre. Ce que
 * l'écran montre se mesure dans la boucle QA navigateur.
 *
 *   node scripts/qa/comptage-espace-boutique.mjs
 *   node scripts/qa/comptage-espace-boutique.mjs --detail   (par fichier)
 */

import { readFile } from 'node:fs/promises'
import { existsSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

const RACINE = resolve('.')

/**
 * Les onze points d'entrée : le Layout et les dix routes de l'espace boutique
 * (src/App.jsx). Écrits en clair plutôt que déduits d'un parseur de routes —
 * quand cette liste se désaccorde de App.jsx, on veut le voir ici, pas le
 * deviner.
 */
const POINTS_ENTREE = [
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

/** Familles Tailwind qui portent une COULEUR — celles que le restyle doit vider. */
const FAMILLES_CHROMATIQUES = [
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal',
  'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
]

/** Familles NEUTRES — retintées par une redéfinition de rampe, pas fichier par fichier. */
const FAMILLES_NEUTRES = ['slate', 'gray', 'zinc', 'neutral', 'stone']

/** Préfixes d'utilitaires Tailwind qui prennent une couleur. */
const PREFIXES = [
  'bg', 'text', 'border', 'ring', 'divide', 'from', 'to', 'via', 'outline',
  'decoration', 'shadow', 'accent', 'caret', 'fill', 'stroke', 'placeholder',
]

const motifUtilitaires = (familles) =>
  new RegExp(
    `\\b(?:${PREFIXES.join('|')})-(?:${familles.join('|')})-(?:50|\\d{3})\\b`,
    'g',
  )

const MOTIF_CHROMATIQUE = motifUtilitaires(FAMILLES_CHROMATIQUES)
const MOTIF_NEUTRE = motifUtilitaires(FAMILLES_NEUTRES)

/** Valeur hexadécimale écrite en dur dans du JS/JSX (hors CSS, qui est la source). */
const MOTIF_HEX = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g

/**
 * Emoji. On compte les PICTOGRAMMES, pas toute la plage symbole : les flèches
 * typographiques et les signes mathématiques sont traités à part parce qu'ils
 * sont parfois légitimes.
 *
 * ⚠ U+FE0F (sélecteur de variante) est EXCLU, et ce n'est pas un détail : c'est
 * un modificateur, pas un pictogramme. L'inclure comptait « ⚠️ » pour DEUX
 * emoji et gonflait le total de 23 au lieu de 20 sur src/ — un chiffre faux et
 * parfaitement crédible, du genre qui se recopie ensuite dans un bilan.
 */
const MOTIF_EMOJI =
  /[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F0FF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu

/**
 * Un emoji dans un commentaire ou un `console.*` n'atteint jamais l'écran ; un
 * emoji dans du JSX, si. Le diagnostic affirme « ZÉRO rendu dans l'UI » : c'est
 * cette affirmation-là qu'il faut pouvoir rejouer, pas le total brut.
 *
 * Heuristique volontairement PRUDENTE : elle classe « hors écran » seulement ce
 * qu'elle reconnaît avec certitude, et laisse tout le reste en « à vérifier ».
 * Une heuristique qui se trompe dans le sens rassurant est pire qu'aucune.
 */
const estHorsEcran = (ligne) => {
  const t = ligne.trim()
  return (
    t.startsWith('//') ||
    t.startsWith('*') ||
    t.startsWith('/*') ||
    // `[a-zA-Z]` et non `[a-z]` : `console.timeEnd(` porte une majuscule, et la
    // première version laissait passer le seul cas du dépôt — une heuristique
    // qui se trompe dans le sens ALARMANT, au moins, se fait corriger.
    /console\.[a-zA-Z]+\(/.test(t) ||
    /logger\.[a-zA-Z]+\(/.test(t)
  )
}

/**
 * Le fichier des identités d'opérateur. Ses couleurs sont des DONNÉES, pas du
 * chrome : elles restent, et elles sont comptées à part pour que le total
 * « à traiter » ne les inclue jamais.
 */
const FICHIER_IDENTITES_TIERS = 'src/constants/networkConfig.js'

/** Regroupement en zones — celles du tableau de diagnostic. */
function zoneDe(chemin) {
  if (chemin === FICHIER_IDENTITES_TIERS) return 'src/constants/ — networkConfig (tiers)'
  if (chemin.startsWith('src/pages/store/')) return 'src/pages/store/'
  if (chemin.startsWith('src/pages/')) return 'src/pages/ — racine'
  if (chemin.startsWith('src/components/ui/')) return 'src/components/ui/ — primitives'
  if (chemin.startsWith('src/components/transactions/')) return 'src/components/transactions/'
  if (chemin.startsWith('src/components/historique/')) return 'src/components/historique/'
  if (chemin.startsWith('src/components/network/')) return 'src/components/network/'
  if (
    chemin.startsWith('src/components/dashboard/') ||
    chemin.startsWith('src/components/Charts/')
  ) {
    return 'src/components/dashboard/ + Charts/'
  }
  if (chemin.startsWith('src/components/')) {
    return chemin.slice('src/components/'.length).includes('/')
      ? 'src/components/ — agents, store, receipt, auth'
      : 'src/components/ — racine'
  }
  if (chemin.startsWith('src/constants/')) return 'src/constants/'
  if (chemin.startsWith('src/utils/')) return 'src/utils/'
  return 'src/hooks, services, context, config'
}

const EXTENSIONS = ['', '.js', '.jsx', '.ts', '.tsx', '/index.js', '/index.jsx']

/** Résout un import relatif vers un chemin de fichier réel, ou null. */
function resoudre(depuis, specificateur) {
  if (!specificateur.startsWith('.')) return null
  const base = join(dirname(depuis), specificateur)
  for (const ext of EXTENSIONS) {
    const candidat = base + ext
    if (!existsSync(candidat)) continue
    if (statSync(candidat).isDirectory()) continue
    return relative(RACINE, resolve(candidat)).split('\\').join('/')
  }
  return null
}

const MOTIF_IMPORT = /(?:^|\n)\s*import\s[^'"]*?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|export\s[^'"]*?from\s*['"]([^'"]+)['"]/g

async function construireLeGraphe() {
  const vus = new Set()
  const file = [...POINTS_ENTREE]
  const manquants = []

  while (file.length > 0) {
    const chemin = file.shift()
    if (vus.has(chemin)) continue
    if (!existsSync(chemin)) {
      manquants.push(chemin)
      continue
    }
    vus.add(chemin)

    const source = await readFile(chemin, 'utf8')
    for (const m of source.matchAll(MOTIF_IMPORT)) {
      const specificateur = m[1] ?? m[2] ?? m[3]
      if (!specificateur) continue
      const cible = resoudre(chemin, specificateur)
      if (cible && !vus.has(cible)) file.push(cible)
    }
  }

  return { fichiers: [...vus].sort(), manquants }
}

const compter = (texte, motif) => (texte.match(motif) ?? []).length

async function main() {
  const detaille = process.argv.includes('--detail')
  const { fichiers, manquants } = await construireLeGraphe()

  if (manquants.length > 0) {
    // Un point d'entrée introuvable veut dire que App.jsx a bougé sans que
    // cette liste suive. On CRIE plutôt que de rendre un total trop bas :
    // un comptage incomplet qui s'annonce complet est pire qu'aucun comptage.
    console.error('\n✗ POINTS D\'ENTRÉE INTROUVABLES — le relevé serait faux :\n')
    for (const m of manquants) console.error(`  · ${m}`)
    console.error('\n  Mettre POINTS_ENTREE en accord avec src/App.jsx.\n')
    process.exit(1)
  }

  const parZone = new Map()
  const parFichier = []
  const emojiAVerifier = []

  for (const chemin of fichiers) {
    const source = await readFile(chemin, 'utf8')

    // Les emoji sont relevés LIGNE À LIGNE : le total ne dit rien d'utile si
    // l'on ne sait pas lesquels peuvent atteindre l'écran.
    let emoji = 0
    source.split('\n').forEach((ligne, i) => {
      const trouves = ligne.match(MOTIF_EMOJI)
      if (!trouves) return
      emoji += trouves.length
      if (!estHorsEcran(ligne)) {
        emojiAVerifier.push({ chemin, ligne: i + 1, emoji: trouves.join(' '), texte: ligne.trim().slice(0, 70) })
      }
    })

    const mesure = {
      chromatiques: compter(source, MOTIF_CHROMATIQUE),
      neutres: compter(source, MOTIF_NEUTRE),
      hex: compter(source, MOTIF_HEX),
      emoji,
    }
    parFichier.push({ chemin, ...mesure })

    const zone = zoneDe(chemin)
    const acc = parZone.get(zone) ?? { fichiers: 0, chromatiques: 0, neutres: 0, hex: 0, emoji: 0 }
    acc.fichiers += 1
    acc.chromatiques += mesure.chromatiques
    acc.neutres += mesure.neutres
    acc.hex += mesure.hex
    acc.emoji += mesure.emoji
    parZone.set(zone, acc)
  }

  const total = { fichiers: 0, chromatiques: 0, neutres: 0, hex: 0, emoji: 0 }
  for (const v of parZone.values()) {
    for (const k of Object.keys(total)) total[k] += v[k]
  }

  const identites = parFichier.find((f) => f.chemin === FICHIER_IDENTITES_TIERS)
  const chromatiquesTiers = identites?.chromatiques ?? 0

  const col = (v, n) => String(v).padStart(n)
  console.log('\nESPACE BOUTIQUE — relevé depuis les 11 points d\'entrée, imports suivis\n')
  console.log(
    'zone'.padEnd(46) + col('fich.', 6) + col('chrom.', 8) + col('neutres', 9) + col('hex', 6) + col('emoji', 7),
  )
  console.log('─'.repeat(82))

  for (const [zone, v] of [...parZone.entries()].sort((a, b) => b[1].chromatiques - a[1].chromatiques)) {
    console.log(
      zone.padEnd(46) + col(v.fichiers, 6) + col(v.chromatiques, 8) + col(v.neutres, 9) + col(v.hex, 6) + col(v.emoji, 7),
    )
  }

  console.log('─'.repeat(82))
  console.log(
    'TOTAL'.padEnd(46) + col(total.fichiers, 6) + col(total.chromatiques, 8) + col(total.neutres, 9) + col(total.hex, 6) + col(total.emoji, 7),
  )

  // Le graphe sort de src/ : les profils client sont importés en relatif depuis
  // src/config/. Le dire explicitement, sinon le total de fichiers ne se
  // réconcilie avec aucun `find src/` et l'écart passe pour une erreur.
  const horsSrc = parFichier.filter((f) => !f.chemin.startsWith('src/'))
  if (horsSrc.length > 0) {
    console.log(
      `\n  Périmètre : ${total.fichiers} fichiers, dont ${horsSrc.length} HORS src/ —`,
    )
    console.log('  atteints par import relatif depuis src/config/ :')
    for (const f of horsSrc) console.log(`    · ${f.chemin}`)
  }

  console.log(
    `\n  dont ${chromatiquesTiers} dans ${FICHIER_IDENTITES_TIERS} — identités d'opérateur,`,
  )
  console.log('  ce sont des DONNÉES et elles restent (hors périmètre du restyle).')
  console.log(
    `\n  ➜ COULEURS CHROMATIQUES À TRAITER : ${total.chromatiques - chromatiquesTiers}\n`,
  )

  console.log(
    `Emoji : ${total.emoji} au total, dont ${emojiAVerifier.length} hors commentaire et hors console.\n`,
  )
  if (emojiAVerifier.length === 0) {
    console.log('  ✓ Aucun emoji ne peut atteindre l\'interface de l\'espace boutique.\n')
  } else {
    for (const e of emojiAVerifier) {
      console.log(`  · ${e.chemin}:${e.ligne}  ${e.emoji}   ${e.texte}`)
    }
    console.log('')
  }

  // ── Les défauts de STRUCTURE, écran par écran ────────────────────────────
  //
  // Le comptage de couleurs ne dit rien des neuf défauts de structure du
  // diagnostic. Ceux-ci se relèvent sur les points d'entrée eux-mêmes, et c'est
  // la seule couverture dont disposent Profil, Clôtures et Détail de demande —
  // qui n'ont pas de filet de rendu, faute d'un rapport coût/protection
  // raisonnable. Le dire ici vaut mieux que de laisser croire à une couverture
  // qui n'existe pas.
  console.log('\nSTRUCTURE — relevé sur les onze points d\'entrée\n')
  console.log(
    'écran'.padEnd(46) + col('h1', 4) + col('largeur', 9) + col('Header', 8) + col('Empty', 7) + col('«Aucun»', 9),
  )
  console.log('─'.repeat(83))

  const largeurs = new Set()
  const totalStructure = { h1: 0, pageHeader: 0, emptyState: 0, aucun: 0 }

  for (const chemin of POINTS_ENTREE) {
    const source = await readFile(chemin, 'utf8')
    const h1 = compter(source, /<h1[\s>]/g)
    const cadres = [...source.matchAll(/\bmax-w-(\w+)\b/g)].map((m) => m[1])
    const pageHeader = /<PageHeader[\s/>]/.test(source) ? 1 : 0
    const emptyState = /<EmptyState[\s/>]/.test(source) ? 1 : 0
    const aucun = compter(source, /['"`>]\s*Aucun[e]?\b/g)
    for (const c of cadres) largeurs.add(c)

    totalStructure.h1 += h1
    totalStructure.pageHeader += pageHeader
    totalStructure.emptyState += emptyState
    totalStructure.aucun += aucun

    const nom = chemin.replace('src/pages/', '').replace('src/components/', '')
    console.log(
      nom.padEnd(46) +
        col(h1, 4) +
        col(cadres.length ? [...new Set(cadres)].join(',') : '—', 9) +
        col(pageHeader ? 'oui' : '—', 8) +
        col(emptyState ? 'oui' : '—', 7) +
        col(aucun || '—', 9),
    )
  }

  console.log('─'.repeat(83))

  // Le tableau ci-dessus ne lit que les onze points d'entrée. Or un écran est
  // fait par ses COMPOSANTS : c'est le piège du relevé incomplet, qui annonçait
  // « Clients 0 » sur un écran qui en portait quatorze. On recompte donc sur
  // TOUT le graphe, et on affiche les deux — l'écart entre les deux chiffres
  // est précisément la part de titres que les pages délèguent.
  const h1DansLeGraphe = []
  for (const chemin of fichiers) {
    const n = compter(await readFile(chemin, 'utf8'), /<h1[\s>]/g)
    if (n > 0) h1DansLeGraphe.push({ chemin, n })
  }
  const totalH1Graphe = h1DansLeGraphe.reduce((s, f) => s + f.n, 0)

  console.log(
    `\n  <h1> : ${totalStructure.h1} sur les points d'entrée, ` +
      `${totalH1Graphe} dans TOUT le graphe (${h1DansLeGraphe.length} fichiers) —` +
      '\n         un écran est fait par ses composants, pas par son fichier de page.',
  )
  for (const f of h1DansLeGraphe.filter((f) => !POINTS_ENTREE.includes(f.chemin))) {
    console.log(`         + ${f.chemin} (${f.n})`)
  }
  console.log(
    `\n  ${largeurs.size} largeurs de châssis déclarées (${[...largeurs].sort().join(', ')})`,
  )
  console.log(
    `  PageHeader : ${totalStructure.pageHeader}/11 écrans · ` +
      `EmptyState : ${totalStructure.emptyState}/11 écrans · ` +
      `${totalStructure.aucun} phrases « Aucun… » écrites à la main`,
  )
  console.log(
    '\n  Cible du chantier : 1 h1 par écran, 1 largeur (portée par le Layout),\n' +
      '  PageHeader 11/11, et zéro phrase « Aucun… » écrite à la main.\n',
  )

  if (detaille) {
    console.log('Détail par fichier (les non nuls, décroissant)\n')
    for (const f of parFichier
      .filter((f) => f.chromatiques + f.hex + f.emoji > 0)
      .sort((a, b) => b.chromatiques - a.chromatiques)) {
      console.log(
        `  ${f.chemin.padEnd(56)}${col(f.chromatiques, 5)} chrom.${col(f.hex, 5)} hex${col(f.emoji, 5)} emoji`,
      )
    }
    console.log('')
  }
}

main().catch((erreur) => {
  console.error(erreur)
  process.exit(1)
})
