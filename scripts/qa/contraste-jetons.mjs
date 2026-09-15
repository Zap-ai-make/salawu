/**
 * contraste-jetons.mjs — vérifie les contrastes ANNONCÉS dans src/index.css.
 * ─────────────────────────────────────────────────────────────────────────────
 * Pourquoi cette sonde existe
 *
 * `src/index.css` écrit un ratio de contraste en commentaire à côté de chaque
 * jeton. Un commentaire ne se vérifie pas tout seul : il vieillit, il survit à
 * la valeur qu'il décrit, et il finit par affirmer une conformité que le fichier
 * n'a plus. Un chiffre porte la commande qui l'a produit, ou il ne figure pas
 * dans le dépôt.
 *
 * Cette sonde LIT les valeurs réellement déclarées dans la feuille, recalcule
 * chaque ratio selon la formule WCAG 2.x, et les compare à la table ci-dessous.
 * Elle échoue bruyamment si l'un des deux bouge sans l'autre.
 *
 * CE QU'ELLE NE FAIT PAS, et c'est important : elle ne dit rien du contraste
 * RÉEL à l'écran. Un texte posé sur une photographie ou un dégradé ne se calcule
 * pas — il se mesure sur les pixels rendus, et c'est le travail de la sonde de
 * contraste de la boucle QA navigateur. Ici on vérifie une arithmétique ; là-bas
 * on vérifie un rendu. Les deux sont nécessaires, aucune ne remplace l'autre.
 *
 *   node scripts/qa/contraste-jetons.mjs
 */

import { readFile } from 'node:fs/promises'

const FEUILLE = 'src/index.css'

const PAPIER = '#ffffff'
const CANVAS = '#f0f6fe'

/**
 * Les ratios annoncés dans src/index.css, jeton par jeton.
 * `canvas` — mesuré sur --canvas quand le jeton sert sur les deux fonds, null
 * quand il ne sert que sur le papier.
 */
const ANNONCES = [
  { jeton: 'canvas', papier: 1.09, canvas: null },
  { jeton: 'surface-100', papier: 1.22, canvas: 1.12 },
  { jeton: 'trait-200', papier: 1.47, canvas: 1.35 },
  { jeton: 'brand-400', papier: 4.67, canvas: 4.3 },
  { jeton: 'brand-500', papier: 6.14, canvas: 5.65 },
  { jeton: 'brand-600', papier: 9.39, canvas: 8.64 },
  { jeton: 'encre', papier: 16.49, canvas: 15.17 },
  { jeton: 'encre-doux', papier: 6.0, canvas: 5.52 },
  { jeton: 'reglure', papier: 1.21, canvas: 1.11 },
  { jeton: 'filet', papier: 3.81, canvas: 3.5 },
  { jeton: 'entree', papier: 6.32, canvas: 5.81 },
  { jeton: 'sortie', papier: 5.74, canvas: 5.28 },
  { jeton: 'alerte', papier: 5.93, canvas: null },
  { jeton: 'echec', papier: 7.87, canvas: null },
]

/**
 * La rampe de neutres retintée, avec le défaut Tailwind v4 en regard.
 * La contrainte n'est pas « être plus contrasté » : c'est « ne JAMAIS l'être
 * moins ». Retinter des gris ne doit rien coûter en lisibilité.
 */
const RAMPE = [
  { niveau: 50, tailwind: '#f9fafb' },
  { niveau: 100, tailwind: '#f3f4f6' },
  { niveau: 200, tailwind: '#e5e7eb' },
  { niveau: 300, tailwind: '#d1d5dc' },
  { niveau: 400, tailwind: '#99a1af' },
  { niveau: 500, tailwind: '#6a7282' },
  { niveau: 600, tailwind: '#4a5565' },
  { niveau: 700, tailwind: '#364153' },
  { niveau: 800, tailwind: '#1e2939' },
  { niveau: 900, tailwind: '#101828' },
]

/** Niveaux autorisés à rester sous AA : WCAG exempte les états désactivés. */
const EXEMPTES_DE_AA = new Set([50, 100, 200, 300, 400])

const canalLineaire = (octet) => {
  const c = octet / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

const luminance = (hex) => {
  const h = hex.replace('#', '')
  const plein = h.length === 3 ? [...h].map((c) => c + c).join('') : h
  const [r, v, b] = [0, 2, 4].map((i) => parseInt(plein.slice(i, i + 2), 16))
  return 0.2126 * canalLineaire(r) + 0.7152 * canalLineaire(v) + 0.0722 * canalLineaire(b)
}

const contraste = (a, b) => {
  const [la, lb] = [luminance(a), luminance(b)]
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

const arrondi = (n) => Math.round(n * 100) / 100

async function lireLesJetons() {
  const css = await readFile(FEUILLE, 'utf8')
  const declarations = new Map()
  for (const [, nom, valeur] of css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    // La PREMIÈRE déclaration gagne : celles du bloc @theme précèdent les
    // redéfinitions de portée, et ce sont elles que les commentaires décrivent.
    if (!declarations.has(nom)) declarations.set(nom, valeur.toLowerCase())
  }
  return declarations
}

async function main() {
  const jetons = await lireLesJetons()
  const ecarts = []

  console.log(`\nContrastes annoncés dans ${FEUILLE}, recalculés\n`)
  console.log(
    'jeton'.padEnd(14) +
      'hex'.padEnd(10) +
      '/papier'.padStart(9) +
      'annoncé'.padStart(9) +
      '/canvas'.padStart(9) +
      'annoncé'.padStart(9),
  )

  for (const { jeton, papier, canvas } of ANNONCES) {
    const hex = jetons.get(jeton)
    if (!hex) {
      ecarts.push(`--color-${jeton} est annoncé mais ABSENT de ${FEUILLE}`)
      continue
    }
    const surPapier = arrondi(contraste(hex, PAPIER))
    const surCanvas = arrondi(contraste(hex, CANVAS))

    if (Math.abs(surPapier - papier) > 0.005) {
      ecarts.push(`--color-${jeton} sur papier : annoncé ${papier}, mesuré ${surPapier}`)
    }
    if (canvas !== null && Math.abs(surCanvas - canvas) > 0.005) {
      ecarts.push(`--color-${jeton} sur canvas : annoncé ${canvas}, mesuré ${surCanvas}`)
    }

    console.log(
      jeton.padEnd(14) +
        hex.padEnd(10) +
        surPapier.toFixed(2).padStart(9) +
        String(papier).padStart(9) +
        (canvas === null ? '—' : surCanvas.toFixed(2)).padStart(9) +
        (canvas === null ? '—' : String(canvas)).padStart(9),
    )
  }

  console.log('\nRampe de neutres — aucun niveau ne doit PERDRE en contraste\n')
  console.log(
    'niveau'.padEnd(10) +
      'Tailwind'.padEnd(10) +
      'ratio'.padStart(7) +
      'ESAHAF'.padStart(10) +
      'ratio'.padStart(8) +
      'écart'.padStart(8),
  )

  for (const { niveau, tailwind } of RAMPE) {
    const hex = jetons.get(`gray-${niveau}`)
    if (!hex) {
      ecarts.push(`--color-gray-${niveau} est absent de ${FEUILLE}`)
      continue
    }
    const avant = contraste(tailwind, PAPIER)
    const apres = contraste(hex, PAPIER)
    const delta = apres - avant

    if (delta < -0.005) {
      ecarts.push(
        `gray-${niveau} RÉGRESSE : ${arrondi(avant)} chez Tailwind, ${arrondi(apres)} ici`,
      )
    }
    if (apres < 4.5 && !EXEMPTES_DE_AA.has(niveau)) {
      ecarts.push(`gray-${niveau} tombe sous AA (${arrondi(apres)}) sans exemption déclarée`)
    }

    console.log(
      `gray-${niveau}`.padEnd(10) +
        tailwind.padEnd(10) +
        avant.toFixed(2).padStart(7) +
        hex.padStart(10) +
        apres.toFixed(2).padStart(8) +
        (delta >= 0 ? '+' : '') + delta.toFixed(2).padStart(7),
    )
  }

  // Le blanc POSÉ SUR la marque : c'est ce qu'on lit dans la barre de navigation
  // et sur le bouton primaire, et cela ne se déduit pas des lignes ci-dessus.
  console.log('\nTexte blanc posé sur la marque\n')
  for (const niveau of ['brand-500', 'brand-600']) {
    const hex = jetons.get(niveau)
    const ratio = arrondi(contraste(PAPIER, hex))
    console.log(`  blanc sur --${niveau} (${hex}) : ${ratio.toFixed(2)}:1`)
    if (ratio < 4.5) ecarts.push(`du texte blanc sur --${niveau} tombe sous AA (${ratio})`)
  }

  if (ecarts.length > 0) {
    console.error('\n✗ ÉCARTS ENTRE CE QUI EST ANNONCÉ ET CE QUI EST DÉCLARÉ :\n')
    for (const e of ecarts) console.error(`  · ${e}`)
    console.error('')
    process.exit(1)
  }

  console.log('\n✓ Tous les contrastes annoncés sont confirmés, zéro régression sur la rampe.\n')
}

main().catch((erreur) => {
  console.error(erreur)
  process.exit(1)
})
