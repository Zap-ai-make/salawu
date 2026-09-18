/**
 * vocabulaire-espace-boutique.mjs — un mot par chose, et le meme partout.
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CETTE SONDE EXISTE (point 10 de la methode)
 *
 * Les points 5 a 9 ont unifie ce que l'ecran MONTRE : une palette, un chassis,
 * un rang d'action, une signature. Rien n'a encore regarde ce qu'il DIT.
 *
 * Or le vocabulaire derive plus vite que la couleur, et sans bruit. Personne ne
 * decide un jour d'appeler la meme chose « Rejeter » ici et « Refuser » la :
 * deux ecrans sont ecrits a six mois d'intervalle, et le produit parle deux
 * langues. Le caissier, lui, apprend les deux.
 *
 * Cette sonde ne corrige rien. Elle RELEVE, et elle est rejouable — comme
 * `comptage-espace-boutique.mjs`, dont elle reprend le graphe : les onze points
 * d'entree de l'espace boutique, imports suivis. « Un chiffre porte la commande
 * qui l'a produit, ou il ne figure pas dans le rapport. »
 *
 * CE QU'ELLE RELEVE
 *
 *   1. LES VERBES D'ACTION, groupes par famille de sens. Deux verbes dans la
 *      meme famille = une divergence a trancher.
 *   2. LES PHRASES DE VIDE (« Aucun… »), avec leur ponctuation. Un point final
 *      ici, pas la : c'est le symptome le plus visible d'un texte ecrit a la
 *      main, ecran par ecran.
 *   3. LES TITRES D'ECRAN, pour verifier qu'un ecran s'appelle partout comme
 *      dans sa navigation.
 *
 * ⚠ CE QU'ELLE NE PROUVE PAS. Elle lit le SOURCE, pas l'ecran. Un libelle
 * calcule, traduit ou venu de Firestore lui echappe. Elle mesure la dispersion
 * du vocabulaire dans le code, pas ce que l'utilisateur lit — comme sa sœur,
 * elle est un point de depart pour la boucle QA, pas un substitut.
 *
 *   node scripts/qa/vocabulaire-espace-boutique.mjs
 *   node scripts/qa/vocabulaire-espace-boutique.mjs --detail   (avec fichiers)
 */

import { readFile } from 'node:fs/promises'
import { existsSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

const RACINE = resolve('.')
const DETAIL = process.argv.includes('--detail')

// Les onze points d'entree : le Layout et les dix routes de src/App.jsx.
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

function resoudre(depuis, specifieur) {
  if (!specifieur.startsWith('.')) return null
  const base = join(dirname(depuis), specifieur)
  for (const ext of EXTENSIONS) {
    const candidat = base + ext
    if (existsSync(candidat) && statSync(candidat).isFile()) return candidat
  }
  return null
}

async function grapheDesFichiers() {
  const vus = new Set()
  const file = [...ENTREES.map((e) => resolve(RACINE, e))]
  while (file.length) {
    const fichier = file.pop()
    if (vus.has(fichier)) continue
    if (!existsSync(fichier)) continue
    vus.add(fichier)
    const source = await readFile(fichier, 'utf8')
    for (const m of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const cible = resoudre(fichier, m[1])
      if (cible) file.push(resolve(cible))
    }
  }
  return [...vus]
}

/**
 * Les familles de sens. Chaque famille est UNE action du metier ; plusieurs
 * verbes dans une famille, c'est le produit qui parle deux langues.
 *
 * Elles sont ecrites a la main et c'est assume : aucune heuristique ne sait que
 * « Rejeter » et « Refuser » disent la meme chose, ni que « Valider » et
 * « Confirmer » ne la disent PAS — le premier termine une operation, le second
 * repond a une question. C'est un jugement de metier, il se declare.
 */
const FAMILLES = {
  'refuser une demande': ['Rejeter', 'Refuser', 'Decliner', 'Décliner'],
  'effacer une donnee': ['Supprimer', 'Effacer', 'Retirer'],
  'modifier une donnee': ['Modifier', 'Éditer', 'Editer', 'Changer'],
  'recharger une liste': ['Actualiser', 'Rafraîchir', 'Recharger', 'Rafraichir'],
  'abandonner une saisie': ['Annuler', 'Abandonner'],
  'sortir de session': ['Se déconnecter', 'Quitter'],
  'ajouter une ligne': ['Ajouter', 'Nouveau', 'Nouvelle', 'Créer', 'Enregistrer'],
  'charger la suite': ['Charger plus', 'Voir plus', 'Afficher plus'],
}

/**
 * ⚠ DEUX FAMILLES ONT ÉTÉ RESSERRÉES, APRÈS LECTURE DE CE QU'ELLES SIGNALAIENT.
 *
 * Le premier relevé annonçait TROIS divergences. Deux étaient des défauts de
 * cette sonde, pas du produit :
 *
 * • « quitter sans agir » réunissait Annuler · Fermer · Retour. Ce sont trois
 *   gestes DIFFÉRENTS : on annule une saisie, on ferme un panneau, on retourne
 *   à une liste. Les confondre aurait poussé à écrire le même mot pour trois
 *   choses — l'inverse exact de ce que cherche ce point. La famille est réduite
 *   à l'abandon de saisie ; `Fermer` et `Retour` n'en sont pas des synonymes.
 *
 * • « sortir de session » réunissait « Se déconnecter » et « Déconnexion ».
 *   Or les deux occurrences du second sont « Déconnexion réussie » et
 *   « Déconnexion… » : des ÉTATS, pas des actions, et le français y impose le
 *   nom. Seul le verbe est un libellé d'action.
 *
 * Une sonde qui crie trop fort finit ignorée. Celles qui restent sont vraies.
 */

const VIDE = /(Aucune?|Pas de|Rien)\s+[a-zA-ZéèêàûôÉÈÀ'][^<>{}"'`\n]{2,60}/g

/**
 * ⚠ LES COMMENTAIRES NE SONT PAS DU VOCABULAIRE D'INTERFACE.
 *
 * Premiere version de cette sonde : elle relevait « Aucun write Firestore
 * direct », « Aucun cablage comportemental ne lit encore ce champ » et une
 * dizaine d'autres phrases qui ne sont ecrites nulle part a l'ecran — ce sont
 * les commentaires de ce depot, qui commencent volontiers par une negation.
 * Le relevé annoncait 43 phrases de vide la ou l'interface en dit une vingtaine.
 *
 * Un chiffre faux est pire qu'un chiffre absent : il aurait servi de reference
 * au lot suivant. On retire donc les commentaires AVANT de lire.
 *
 * Le remplacement se fait par des espaces de meme longueur, pour que les
 * numeros de ligne restent justes si on veut les afficher un jour.
 */
function sansCommentaires(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (t, avant) => avant + ' '.repeat(t.length - avant.length))
}

async function principal() {
  const fichiers = await grapheDesFichiers()

  const verbes = new Map()   // verbe -> Set(fichier)
  const vides = new Map()    // phrase -> Set(fichier)

  for (const fichier of fichiers) {
    const brut = await readFile(fichier, 'utf8')
    const source = sansCommentaires(brut)
    const court = relative(RACINE, fichier).replace(/\\/g, '/')

    for (const [, liste] of Object.entries(FAMILLES)) {
      for (const verbe of liste) {
        // Le verbe doit etre un LIBELLE : entre guillemets ou entre balises,
        // jamais un fragment d'identifiant (`handleRefuser`, `canSupprimer`).
        const motif = new RegExp(`(['">}]\\s*)${verbe}(\\s*['"<{.,!?]|\\s*$)`, 'gm')
        if (motif.test(source)) {
          if (!verbes.has(verbe)) verbes.set(verbe, new Set())
          verbes.get(verbe).add(court)
        }
      }
    }

    for (const m of source.matchAll(VIDE)) {
      const phrase = m[0].trim().replace(/\s+/g, ' ')
      if (!vides.has(phrase)) vides.set(phrase, new Set())
      vides.get(phrase).add(court)
    }
  }

  console.log('')
  console.log('ESPACE BOUTIQUE — VOCABULAIRE, relevé depuis les 11 points d\'entrée, imports suivis')
  console.log(`  ${fichiers.length} fichiers parcourus`)
  console.log('')

  // ── 1. Les verbes, par famille ────────────────────────────────────────────
  console.log('1. VERBES D\'ACTION — une famille = une action du métier')
  console.log('   ' + '─'.repeat(74))
  let divergences = 0
  for (const [famille, liste] of Object.entries(FAMILLES)) {
    const presents = liste.filter((v) => verbes.has(v))
    if (presents.length === 0) continue
    const marque = presents.length > 1 ? '  ⚠' : '   '
    if (presents.length > 1) divergences += 1
    console.log(`${marque} ${famille.padEnd(24)} ${presents.join(' · ')}`)
    if (DETAIL) {
      for (const v of presents) {
        console.log(`        ${v} : ${[...verbes.get(v)].join(', ')}`)
      }
    }
  }
  console.log('')
  console.log(`   ➜ ${divergences} famille(s) où le produit parle DEUX langues`)
  console.log('')

  // ── 2. Les phrases de vide ────────────────────────────────────────────────
  const listeVides = [...vides.keys()].sort()
  const avecPoint = listeVides.filter((p) => p.endsWith('.')).length
  console.log('2. PHRASES DE VIDE — écrites à la main, écran par écran')
  console.log('   ' + '─'.repeat(74))
  for (const phrase of listeVides) {
    const fin = phrase.endsWith('.') ? '.' : ' '
    console.log(`   ${fin} ${phrase}`)
    if (DETAIL) console.log(`        ${[...vides.get(phrase)].join(', ')}`)
  }
  console.log('')
  console.log(`   ➜ ${listeVides.length} phrases distinctes — ${avecPoint} finissent par un point, `
    + `${listeVides.length - avecPoint} non`)
  console.log('     La colonne de gauche montre la ponctuation : c\'est le symptôme le plus')
  console.log('     visible d\'un texte écrit écran par écran plutôt qu\'une fois.')
  console.log('')
}

principal().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
