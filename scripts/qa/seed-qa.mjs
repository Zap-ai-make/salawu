/**
 * seed-qa.mjs — jeu de données minimal pour la boucle QA visuelle.
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
 * Le front doit voir les MÊMES données : l'émulateur Firestore cloisonne par
 * identifiant de projet. `playwright.config.js` force donc
 * VITE_FIREBASE_PROJECT_ID sur le projet de démonstration. C'est aussi une
 * garantie de sûreté — avec un projet et une clé factices, le front ne peut pas
 * joindre la production même si la connexion à l'émulateur échouait.
 *
 * Deux boutiques, et ce n'est pas décoratif : les règles Firestore doivent être
 * exercées avec au moins deux boutiques (CLAUDE.md), et une seule boutique ne
 * prouve jamais qu'une requête est correctement cloisonnée.
 */

import { initializeApp, deleteApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { validateEmulatorEnv, PRODUCTION_BLOCKED_PROJECTS } from '../lib/technicalUserProvisioning.mjs'

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

// ── Données ───────────────────────────────────────────────────────────────────
export const COMPTE_QA = Object.freeze({
  email: 'qa.esahaf@example.test',
  motDePasse: 'QaEsahaf!2026',
  boutiqueId: 'qa-boutique-ouaga',
  boutiqueNom: 'ESAHAF QA OUAGA',
})

// Seconde boutique : sert à prouver le cloisonnement, jamais connectée.
const BOUTIQUE_TEMOIN = Object.freeze({
  email: 'qa.temoin@example.test',
  motDePasse: 'QaTemoin!2026',
  boutiqueId: 'qa-boutique-temoin',
  boutiqueNom: 'BOUTIQUE TÉMOIN',
})

// Montants volontairement inégaux en nombre de chiffres : c'est ce qui rend
// visible (ou non) l'alignement des chiffres tabulaires dans les colonnes.
const SOLDES = [
  { reseau: 'Orange', stock: 1_250_000 },
  { reseau: 'Moov', stock: 87_500 },
  { reseau: 'Telecel', stock: 0 },
  { reseau: 'Coris', stock: 940_000 },
  { reseau: 'Sank', stock: 12_300 },
  { reseau: 'Wave', stock: 5_000 },
]

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

async function semerLesSoldes(boutiqueId, facteur = 1) {
  // UN SEUL document `current`, contenant une map `balances` — et non un document
  // par réseau. Première version de ce seed : six documents que l'application ne
  // lit jamais, donc six réseaux à 0 sur le tableau de bord, sans la moindre
  // erreur. Forme réelle attendue par normalizeNetworkBalances
  // (src/utils/financialImpact.js:65) :
  //     { balances: { Orange: { stock, liquidite }, ... } }
  // ⚠ Le champ est `liquidite` SANS accent : `liquidity` est ignoré en silence.
  const balances = {}
  for (const { reseau, stock } of SOLDES) {
    balances[reseau] = { stock: Math.round(stock * facteur), liquidite: 0 }
  }

  await db.doc(`clients/${boutiqueId}/networkBalances/current`).set(
    { balances, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  )
}

// Montants a nombre de chiffres DELIBEREMENT inegal : c'est la seule facon de
// voir si les chiffres tabulaires alignent reellement les colonnes. Un jeu de
// donnees uniforme aurait cache le defaut que la chasse fixe est censee corriger.
// Le filet du registre n'a lui non plus rien a montrer sur un tableau vide —
// premiere version de ce seed : des captures d'ecrans vides qui ne prouvaient rien.
const TRANSACTIONS = [
  { client: 'OUEDRAOGO Aminata', type: 'Depot',   reseau: 'Orange',  code: '70112233', montant: 1_250_000 },
  { client: 'SAWADOGO Issa',     type: 'Retrait', reseau: 'Moov',    code: '60998877', montant: 87_500 },
  { client: 'KABORE Salif',      type: 'Depot',   reseau: 'Coris',   code: '65004411', montant: 940_000 },
  { client: 'TRAORE Mariam',     type: 'Retrait', reseau: 'Sank',    code: '55220099', montant: 12_300 },
  { client: 'ZONGO Boukare',     type: 'Depot',   reseau: 'Wave',    code: '76543210', montant: 5_000 },
  { client: 'COMPAORE Fatou',    type: 'Retrait', reseau: 'Orange',  code: '70445566', montant: 250 },
  { client: 'NIKIEMA Paul',      type: 'Depot',   reseau: 'Telecel', code: '51122334', montant: 3_400_000 },
]

async function semerLHistorique(boutiqueId, uid, email) {
  const lot = db.batch()
  TRANSACTIONS.forEach((t, i) => {
    const ref = db.collection(`clients/${boutiqueId}/history`).doc()
    lot.set(ref, {
      // `storeId` est OBLIGATOIRE : historyService filtre dessus
      // (where storeId == activeStore.id). Sans lui, l'ecran reste vide.
      storeId: boutiqueId,
      clientId: `qa-client-${i}`,
      clientNom: t.client,
      type: t.type,
      reseau: t.reseau,
      code: t.code,
      montant: t.montant,
      statut: 'Validee',
      operatorName: 'QA',
      userEmail: email,
      userId: uid,
      date: `0${i + 1}/09/2026 10:0${i}`,
      createdAt: FieldValue.serverTimestamp(),
    })
  })
  await lot.commit()
}

const uidPrincipal = await creerCompte(COMPTE_QA)
await semerLesSoldes(COMPTE_QA.boutiqueId)
await semerLHistorique(COMPTE_QA.boutiqueId, uidPrincipal, COMPTE_QA.email)

const uidTemoin = await creerCompte(BOUTIQUE_TEMOIN)
// Facteur différent : si un écran de la boutique QA affichait ces montants, le
// cloisonnement serait rompu et cela se verrait immédiatement sur la capture.
await semerLesSoldes(BOUTIQUE_TEMOIN.boutiqueId, 7)

console.log(`[seed-qa] projet          : ${PROJECT_ID}`)
console.log(`[seed-qa] boutique QA     : ${COMPTE_QA.boutiqueId} (uid ${uidPrincipal})`)
console.log(`[seed-qa] boutique témoin : ${BOUTIQUE_TEMOIN.boutiqueId} (uid ${uidTemoin})`)
console.log(`[seed-qa] identifiants    : ${COMPTE_QA.email} / ${COMPTE_QA.motDePasse}`)

await deleteApp(app)
