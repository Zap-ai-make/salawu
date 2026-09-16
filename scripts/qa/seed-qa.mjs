/**
 * seed-qa.mjs — peuple l'émulateur pour la boucle QA visuelle.
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ ÉMULATEURS UNIQUEMENT (CLAUDE.md). Ce script écrit dans Firestore et crée des
 * comptes Auth : il refuse de démarrer hors émulateur, et il réutilise pour cela
 * le garde déjà présent dans le dépôt (`validateEmulatorEnv`) plutôt que d'en
 * inventer un second — deux gardes divergeraient tôt ou tard, et c'est celui qui
 * serait le plus laxiste qui ferait loi.
 *
 * Lancement :
 *   firebase emulators:exec --only auth,firestore --project demo-akayis-test \
 *     "node scripts/qa/seed-qa.mjs && npm run qa"
 *
 * Restreindre à un ou deux états pendant une mise au point :
 *   node scripts/qa/seed-qa.mjs --etat=vide,erreur-partielle
 *
 * Le front doit voir les MÊMES données : l'émulateur Firestore cloisonne par
 * identifiant de projet. `playwright.config.js` force donc
 * VITE_FIREBASE_PROJECT_ID sur le projet de démonstration. C'est aussi une
 * garantie de sûreté — avec un projet et une clé factices, le front ne peut pas
 * joindre la production même si la connexion à l'émulateur échouait.
 *
 * CINQ boutiques, et ce n'est pas décoratif. Quatre portent les ÉTATS que le banc
 * doit savoir montrer (cf. `etats-du-banc.mjs`, qui explique pourquoi un état est
 * une boutique et non un `?etat=` lu par l'application) ; la cinquième est le
 * témoin de cloisonnement, jamais visitée. Les règles Firestore doivent être
 * exercées avec au moins deux boutiques (CLAUDE.md), et une seule ne prouve
 * jamais qu'une requête est correctement cloisonnée.
 */

import { initializeApp, deleteApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { validateEmulatorEnv, PRODUCTION_BLOCKED_PROJECTS } from '../lib/technicalUserProvisioning.mjs'
import { ETATS, TEMOIN, CLES_ETATS } from './etats-du-banc.mjs'

// ── Garde de sécurité, avant toute initialisation ─────────────────────────────
const envCheck = validateEmulatorEnv(process.env)
if (!envCheck.ok) {
  console.error(
    `[SÉCURITÉ] Environnement émulateur invalide : [${envCheck.code}] ${envCheck.message}\n` +
    'Lance via : firebase emulators:exec --only auth,firestore --project demo-akayis-test "node scripts/qa/seed-qa.mjs"',
  )
  process.exit(1)
}

const PROJECT_ID = envCheck.projectId

if (PRODUCTION_BLOCKED_PROJECTS.includes(PROJECT_ID)) {
  console.error(`[SÉCURITÉ] "${PROJECT_ID}" est un projet de production : refus.`)
  process.exit(1)
}
if (PROJECT_ID !== 'demo-akayis-test') {
  console.error(`[SÉCURITÉ] GCLOUD_PROJECT doit valoir "demo-akayis-test" (reçu : "${PROJECT_ID}").`)
  process.exit(1)
}

/**
 * Toute boutique écrite ou purgée par ce script porte ce préfixe, et la fonction
 * de purge REFUSE d'agir sur autre chose. C'est une seconde serrure derrière le
 * garde d'émulateur : celui-ci protège le projet, celle-ci protège du voisin.
 */
const PREFIXE_BANC = 'qa-boutique-'

// ── Sélection des états à semer ───────────────────────────────────────────────
//
// Les noms sont validés contre la liste réelle et le script REFUSE un nom
// inconnu en le nommant. Un `--etat=vid` silencieusement ignoré ne sèmerait rien
// et rendrait une boucle verte sur des écrans qui n'existent pas.
const argEtat = process.argv.find((a) => a.startsWith('--etat='))
const etatsDemandes = argEtat
  ? argEtat.slice('--etat='.length).split(',').map((s) => s.trim()).filter(Boolean)
  : CLES_ETATS

const inconnus = etatsDemandes.filter((cle) => !CLES_ETATS.includes(cle))
if (inconnus.length > 0) {
  console.error(
    `[seed-qa] état(s) inconnu(s) : ${inconnus.join(', ')}\n` +
    `          états disponibles : ${CLES_ETATS.join(', ')}`,
  )
  process.exit(1)
}

// ── Exports historiques ───────────────────────────────────────────────────────
// Conservés : d'autres scripts et la documentation s'y réfèrent. La source est
// désormais `etats-du-banc.mjs`, pour que les specs Playwright lisent les mêmes
// identifiants sans les recopier.
export const COMPTE_QA = Object.freeze({ ...ETATS.dense.compte })

const app = initializeApp({ projectId: PROJECT_ID })
const auth = getAuth()
const db = getFirestore()

async function creerCompte({ email, motDePasse, boutiqueId, boutiqueNom }) {
  let utilisateur
  try {
    utilisateur = await auth.getUserByEmail(email)
    await auth.updateUser(utilisateur.uid, { password: motDePasse, emailVerified: true })
  } catch {
    utilisateur = await auth.createUser({
      email,
      password: motDePasse,
      displayName: boutiqueNom,
      emailVerified: true,
    })
  }

  // `stores` et `users` sont à la RACINE (cf. firestore.js resolveCollectionPath) ;
  // tout le reste vit sous `clients/{boutiqueId}/`. Se tromper de niveau donne un
  // écran vide sans la moindre erreur.
  await db.doc(`stores/${boutiqueId}`).set({
    name: boutiqueNom,
    email,
    active: true,
    adminUid: utilisateur.uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true })

  await db.doc(`users/${utilisateur.uid}`).set({
    name: boutiqueNom,
    email,
    role: 'store_admin',
    active: true,
    storeId: boutiqueId,
    storeName: boutiqueNom,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true })

  return utilisateur.uid
}

/**
 * Remet une boutique du banc à zéro avant de la semer.
 *
 * Nécessaire pour une raison précise : l'historique est écrit avec des
 * identifiants AUTOMATIQUES. Relancer le seed sur un émulateur déjà démarré
 * empilait donc les transactions au lieu de les remplacer — et l'état « vide »,
 * lui, ne pouvait tout simplement pas exister sur un émulateur réutilisé. Un
 * état qui dépend de l'ordre des lancements n'est pas un état.
 *
 * Portée volontairement étroite : uniquement les boutiques du banc, uniquement
 * sous l'émulateur (le garde en tête de fichier a déjà tranché), et refus
 * bruyant pour tout le reste.
 */
async function viderLaBoutique(boutiqueId) {
  if (!boutiqueId.startsWith(PREFIXE_BANC)) {
    throw new Error(
      `[SÉCURITÉ] purge refusée sur « ${boutiqueId} » : ` +
      `seules les boutiques du banc (préfixe « ${PREFIXE_BANC} ») sont purgeables.`,
    )
  }

  const historique = await db.collection(`clients/${boutiqueId}/history`).get()
  const globaux = await db.collection('globalClients').where('registeredStoreId', '==', boutiqueId).get()

  const aSupprimer = [
    ...historique.docs.map((d) => d.ref),
    ...globaux.docs.map((d) => d.ref),
    db.doc(`clients/${boutiqueId}/networkBalances/current`),
  ]

  // Firestore plafonne un lot à 500 écritures.
  for (let i = 0; i < aSupprimer.length; i += 450) {
    const lot = db.batch()
    aSupprimer.slice(i, i + 450).forEach((ref) => lot.delete(ref))
    await lot.commit()
  }

  return { historique: historique.size, clients: globaux.size }
}

/**
 * Écrit UN SEUL document `current` contenant une map `balances` — et non un
 * document par réseau. Première version de ce seed : six documents que
 * l'application ne lit jamais, donc six réseaux à 0 sur le tableau de bord, sans
 * la moindre erreur. Forme réelle attendue par normalizeNetworkBalances
 * (src/utils/financialImpact.js:65) :
 *     { balances: { Orange: { stock, liquidite }, ... } }
 * ⚠ Le champ est `liquidite` SANS accent : `liquidity` est ignoré en silence.
 *
 * `soldes === null` → on n'écrit RIEN. Le document n'existe pas, comme le premier
 * jour d'une vraie boutique. Ce n'est pas la même chose que des zéros, et c'est
 * précisément la différence que l'état « vide » sert à regarder.
 */
async function semerLesSoldes(boutiqueId, soldes, facteur = 1) {
  if (soldes === null) return 0

  const balances = {}
  for (const { reseau, stock } of soldes) {
    balances[reseau] = { stock: Math.round(stock * facteur), liquidite: 0 }
  }

  await db.doc(`clients/${boutiqueId}/networkBalances/current`).set(
    { balances, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  )
  return Object.keys(balances).length
}

/**
 * `globalClients` est une collection de PREMIER NIVEAU (firestore.js
 * resolveCollectionPath la traite à part, comme `stores` et `users`) : la semer
 * sous clients/{boutique}/ donnerait un écran vide sans la moindre erreur.
 * L'isolation passe par `registeredStoreId`.
 *
 * L'écran Clients était passé au crible de la boucle QA depuis le début… À VIDE :
 * le banc ne semait aucun client. Les captures montraient « Aucun client
 * trouvé. », axe ne voyait aucune ligne, et la sonde de débordement n'avait
 * aucune des quatorze colonnes à mesurer. Un test vert sur un écran vide ne
 * prouve rien.
 */
async function semerLesClients(boutiqueId, liste) {
  if (liste.length === 0) return 0

  const lot = db.batch()
  liste.forEach((client, i) => {
    lot.set(db.doc(`globalClients/${boutiqueId}-c${String(i).padStart(3, '0')}`), {
      ...client,
      createdAt: FieldValue.serverTimestamp(),
    })
  })
  await lot.commit()
  return liste.length
}

async function semerLHistorique(boutiqueId, uid, email, lignes) {
  if (lignes.length === 0) return 0

  const lot = db.batch()
  lignes.forEach((t, i) => {
    const ref = db.collection(`clients/${boutiqueId}/history`).doc()
    lot.set(ref, {
      // `storeId` est OBLIGATOIRE : historyService filtre dessus
      // (where storeId == activeStore.id). Sans lui, l'écran reste vide.
      storeId: boutiqueId,
      clientId: `qa-client-${i}`,
      // ⚠ `client`, un OBJET — et non `clientNom`, une chaîne.
      //
      // C'est la forme qu'écrit réellement l'application
      // (TransactionForm.jsx:240 : `client: transactionClient`), et
      // `getClientName` (helpers.js:8) lit `client.prenom` / `client.nom`. Le
      // premier jet de ce banc écrivait `clientNom`, un champ que personne ne
      // lit : les SEPT lignes de l'historique affichaient « Client inconnu »,
      // sur toutes les captures, depuis le début. Le repli faisait exactement
      // son travail, et c'est pour cela que rien n'a protesté.
      //
      // Vu seulement en REGARDANT une capture au lot L7.2b — ni axe, ni la
      // sonde de débordement, ni le décompte de colonnes ne pouvaient
      // l'attraper : la cellule était remplie, lisible et contrastée. Elle
      // disait simplement autre chose que ce qu'un utilisateur verrait.
      client: t.client,
      type: t.type,
      reseau: t.reseau,
      code: t.code,
      montant: t.montant,
      statut: t.statut,
      operatorName: 'QA',
      userEmail: email,
      userId: uid,
      date: `0${i + 1}/09/2026 10:0${i}`,
      createdAt: FieldValue.serverTimestamp(),
    })
  })
  await lot.commit()
  return lignes.length
}

async function semerUnEtat(cle) {
  const etat = ETATS[cle]
  const { boutiqueId, boutiqueNom, email } = etat.compte

  const uid = await creerCompte(etat.compte)
  const purge = await viderLaBoutique(boutiqueId)
  const nbSoldes = await semerLesSoldes(boutiqueId, etat.soldes)
  const nbClients = await semerLesClients(boutiqueId, etat.clients(boutiqueId, boutiqueNom))
  const nbHistorique = await semerLHistorique(boutiqueId, uid, email, etat.historique)

  return { cle, uid, boutiqueId, purge, nbSoldes, nbClients, nbHistorique, libelle: etat.libelle }
}

// ── Exécution ─────────────────────────────────────────────────────────────────
const releves = []
for (const cle of etatsDemandes) {
  releves.push(await semerUnEtat(cle))
}

// La boutique témoin est semée à chaque fois, quelle que soit la sélection : les
// contrôles de cloisonnement sont dans TOUTES les specs, et un banc sans témoin
// les rendrait verts en regardant une collection à propriétaire unique.
const uidTemoin = await creerCompte(TEMOIN.compte)
await viderLaBoutique(TEMOIN.compte.boutiqueId)
await semerLesSoldes(TEMOIN.compte.boutiqueId, TEMOIN.soldes, TEMOIN.facteurSoldes)
const nbClientsTemoin = await semerLesClients(
  TEMOIN.compte.boutiqueId,
  TEMOIN.clients(TEMOIN.compte.boutiqueId, TEMOIN.compte.boutiqueNom),
)

console.log(`[seed-qa] projet : ${PROJECT_ID}`)
console.log('[seed-qa] ─────────────────────────────────────────────────────────────')
for (const r of releves) {
  console.log(`[seed-qa] ${r.cle.padEnd(17)} ${r.boutiqueId}`)
  console.log(`[seed-qa] ${''.padEnd(17)} ${r.libelle}`)
  console.log(
    `[seed-qa] ${''.padEnd(17)} ${r.nbClients} client(s) · ${r.nbHistorique} opération(s) · ` +
    `${ETATS[r.cle].soldes === null ? 'aucun document de soldes' : `${r.nbSoldes} réseau(x) garni(s)`}` +
    (r.purge.historique + r.purge.clients > 0
      ? ` · purge : ${r.purge.historique} opération(s), ${r.purge.clients} client(s)`
      : ''),
  )
  console.log(`[seed-qa] ${''.padEnd(17)} ${ETATS[r.cle].compte.email} / ${ETATS[r.cle].compte.motDePasse}`)
}
console.log('[seed-qa] ─────────────────────────────────────────────────────────────')
console.log(`[seed-qa] témoin (jamais visité) : ${TEMOIN.compte.boutiqueId} (uid ${uidTemoin}, ${nbClientsTemoin} clients)`)

await deleteApp(app)
