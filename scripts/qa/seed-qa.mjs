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

// ── Clients ──────────────────────────────────────────────────────────────────
//
// L'ecran Clients etait passe au crible de la boucle QA depuis le debut… A VIDE :
// le banc ne semait aucun client. Les captures montraient « Aucun client
// trouve. », axe ne voyait aucune ligne, et la sonde de debordement n'avait
// aucune des quatorze colonnes a mesurer. Un test vert sur un ecran vide ne
// prouve rien — c'est la meme lecon que l'historique vide du lot 3, sous une
// autre forme.
//
// `globalClients` est une collection de PREMIER NIVEAU (firestore.js
// resolveCollectionPath la traite a part, comme `stores` et `users`) : la semer
// sous clients/{boutique}/ donnerait un ecran vide sans la moindre erreur.
// L'isolation passe par `registeredStoreId`.
const PRENOMS = ['Aminata', 'Issa', 'Salif', 'Mariam', 'Boukare', 'Fatou', 'Paul', 'Alizeta', 'Rasmane', 'Kadiatou']
const NOMS = ['OUEDRAOGO', 'SAWADOGO', 'KABORE', 'TRAORE', 'ZONGO', 'COMPAORE', 'NIKIEMA', 'ZABSONRE', 'ILBOUDO', 'SORE']
const LOCALITES = ['Ouagadougou', 'Bobo-Dioulasso', 'Koudougou', 'Banfora', 'Ouahigouya']

function clientsDuBanc(boutiqueId, boutiqueNom) {
  const liste = []

  // Les trois cas limites d'abord — ce sont eux qui cassent une mise en page.
  liste.push({
    // Le nom le plus long du jeu : c'est lui qui tronque « FCFA » a 390 px.
    registeredStoreId: boutiqueId,
    registeredStoreName: boutiqueNom,
    nom: 'OUEDRAOGO/KABORE',
    prenom: 'Wendkuuni Alizeta',
    numeroIdentite: 'B10240031',
    numeroPersonnel: '70112233',
    orange: '1004500',
    moov: '1004813',
    numerosAgent: { orange: '70112233', moov: '70113344' },
    localite: 'Ouagadougou — Zone du Bois, Secteur 13',
    agentCommercial: 'ZABSONRE Alizeta',
    dateAjout: '15/09/2026',
  })
  liste.push({
    // Client importe avant le cloisonnement : la cellule doit rendre
    // « Ancienne base » et non une case blanche.
    registeredStoreId: boutiqueId,
    registeredStoreName: null,
    nom: 'ZONGO',
    prenom: 'Boukare',
    numeroIdentite: 'B10190877',
    numeroPersonnel: '76445566',
    sank: '1005752',
    numerosAgent: { sank: '76445566' },
    localite: 'Bobo-Dioulasso',
    agentCommercial: 'SAWADOGO Issa',
    dateAjout: '03/04/2026',
  })
  liste.push({
    // Un seul reseau renseigne : cinq colonnes de code agent restent vides.
    registeredStoreId: boutiqueId,
    registeredStoreName: boutiqueNom,
    nom: 'TRAORE',
    prenom: 'Salimata',
    numeroIdentite: 'B10221145',
    numeroPersonnel: '70998877',
    wave: '1006210',
    numerosAgent: {},
    localite: 'Koudougou',
    agentCommercial: 'ZABSONRE Alizeta',
    dateAjout: '15/09/2026',
  })

  // Puis du volume : la pagination par defaut est de 10 par page, donc trente
  // lignes donnent trois pages. Un ecran verifie a trois lignes ne prouve rien.
  for (let i = 0; i < 27; i += 1) {
    const reseau = ['orange', 'moov', 'telecel', 'coris', 'sank', 'wave'][i % 6]
    liste.push({
      registeredStoreId: boutiqueId,
      registeredStoreName: boutiqueNom,
      nom: NOMS[i % NOMS.length],
      prenom: PRENOMS[(i + 3) % PRENOMS.length],
      numeroIdentite: `B102${String(40000 + i * 7).slice(0, 5)}`,
      numeroPersonnel: `7${String(1000000 + i * 13579).slice(0, 7)}`,
      [reseau]: String(1004000 + i * 37),
      numerosAgent: { [reseau]: `7${String(2000000 + i * 24680).slice(0, 7)}` },
      localite: LOCALITES[i % LOCALITES.length],
      agentCommercial: `${NOMS[(i + 5) % NOMS.length]} ${PRENOMS[i % PRENOMS.length]}`,
      dateAjout: `${String((i % 28) + 1).padStart(2, '0')}/0${(i % 9) + 1}/2026`,
    })
  }

  return liste
}

async function semerLesClients(boutiqueId, boutiqueNom) {
  const liste = clientsDuBanc(boutiqueId, boutiqueNom)
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
const nbClients = await semerLesClients(COMPTE_QA.boutiqueId, COMPTE_QA.boutiqueNom)

const uidTemoin = await creerCompte(BOUTIQUE_TEMOIN)
// Facteur différent : si un écran de la boutique QA affichait ces montants, le
// cloisonnement serait rompu et cela se verrait immédiatement sur la capture.
await semerLesSoldes(BOUTIQUE_TEMOIN.boutiqueId, 7)
// Et des clients chez la témoin : `subscribeToClients` écoute la collection
// globale SANS filtre, l'isolation venant des règles Firestore. Sans client
// témoin, le contrôle de cloisonnement de la boucle QA n'a rien à attraper —
// il passerait au vert en regardant une collection qui ne contient qu'un seul
// propriétaire.
await semerLesClients(BOUTIQUE_TEMOIN.boutiqueId, BOUTIQUE_TEMOIN.boutiqueNom)

console.log(`[seed-qa] projet          : ${PROJECT_ID}`)
console.log(`[seed-qa] boutique QA     : ${COMPTE_QA.boutiqueId} (uid ${uidPrincipal})`)
console.log(`[seed-qa] boutique témoin : ${BOUTIQUE_TEMOIN.boutiqueId} (uid ${uidTemoin})`)
console.log(`[seed-qa] clients semés   : ${nbClients} par boutique (globalClients)`)
console.log(`[seed-qa] identifiants    : ${COMPTE_QA.email} / ${COMPTE_QA.motDePasse}`)

await deleteApp(app)
