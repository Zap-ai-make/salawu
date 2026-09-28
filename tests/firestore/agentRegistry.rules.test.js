/**
 * TC-182 — Règles Firestore : registre de guichet d'un agent (sauvegarde app mobile).
 *
 * Surface d'ÉCRITURE nouvelle, et la première que l'app mobile obtienne : jusqu'ici
 * l'agent ne faisait que LIRE (TC-150). Comportement protégé, app mobile ACTIVÉE :
 *   - l'agent lit, crée et met à jour SON sous-arbre, dans SA boutique, sur les deux
 *     sous-collections prévues ;
 *   - il LISTE la sous-collection entière sans clause `where` — c'est la restauration,
 *     et c'est la raison pour laquelle la règle ne touche pas à `resource.data` ;
 *   - il n'écrit NI sous un autre agent, NI dans une AUTRE BOUTIQUE, NI dans une
 *     troisième sous-collection, et ne SUPPRIME jamais ;
 *   - ni la boutique ni la supervision n'y accèdent (décision de moindre privilège :
 *     ces documents portent des pièces d'identité de tiers).
 * App mobile DÉSACTIVÉE : tout est refusé.
 *
 * ⚠ LE CAS QUI COMPTE EST [RG-05]. La règle proposée par l'équipe mobile ne vérifiait
 * que `request.auth.uid == agentId`. Or `agentId` est un segment de chemin FOURNI PAR
 * L'APPELANT : un agent de la boutique A y met son propre uid et écrit sous
 * clients/store-B/agentRegistry/<son-uid>/…. La condition passait, et le cloisonnement
 * inter-boutiques n'existait pas. C'est `token.storeId == storeId` qui garde.
 *
 * Deux boutiques dans tous les cas, comme l'exige le protocole du projet.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertSucceeds, assertFails, seedDocument } from './helpers.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rulesRaw = readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf-8')

/** Règles committées avec mobileAppEnabled() forcé (baseline committée = TAOFIC = false). */
function rulesWith(enabled) {
  const out = rulesRaw.replace(
    /function mobileAppEnabled\(\) \{ return (true|false); \}/,
    `function mobileAppEnabled() { return ${enabled}; }`,
  )
  if (!out.includes(`function mobileAppEnabled() { return ${enabled}; }`)) {
    throw new Error('Motif mobileAppEnabled() introuvable dans firestore.rules — adapter le test.')
  }
  return out
}

const AGENT_A = 'cli-agent-a'      // agent de store-A
const AGENT_A2 = 'cli-agent-a2'    // autre agent de store-A
const CLAIMS_A = { role: 'agent', clientId: AGENT_A, storeId: 'store-A' }

const ctxAgentA = (env) => env.authenticatedContext(AGENT_A, CLAIMS_A)

const OPERATION = {
  id: 'op-1', agent_id: AGENT_A, client_id: 'cl-1',
  sens: 'depot', reseau: 'orange', montant: 5000,
  heure_appareil: '2026-09-28T08:05:00.000Z', appareil_id: 'dev-1',
}
const FICHE = {
  id: 'cl-1', agent_id: AGENT_A, nom: 'Ouedraogo', prenoms: 'Awa',
  type_piece: 'cnib', numero_piece: 'B1234', telephone: '70112233',
  cree_le: '2026-09-28T08:00:00.000Z', cree_par_appareil: 'dev-1',
}

/** Deux boutiques, et dans chacune un registre déjà peuplé : la restauration lit du réel. */
async function seedAll(env) {
  await seedDocument(env, 'users', 'uid-member-a', { active: true, storeId: 'store-A', role: 'member' })
  await seedDocument(env, 'clients/store-A/agentRegistry/' + AGENT_A + '/operations', 'op-seed', OPERATION)
  await seedDocument(env, 'clients/store-A/agentRegistry/' + AGENT_A + '/customers', 'cl-seed', FICHE)
  await seedDocument(env, 'clients/store-A/agentRegistry/' + AGENT_A2 + '/operations', 'op-autre', { ...OPERATION, agent_id: AGENT_A2 })
  // Boutique B : un registre portant l'uid de l'agent A. Il ne doit NI se lire NI s'écrire.
  await seedDocument(env, 'clients/store-B/agentRegistry/' + AGENT_A + '/operations', 'op-b', OPERATION)
}

describe('TC-182 — app mobile ACTIVÉE : le registre d\'un agent est le sien seul', () => {
  let testEnv
  beforeAll(async () => {
    if (process.env.GCLOUD_PROJECT !== 'demo-akayis-test') throw new Error('SÉCURITÉ : projectId doit être "demo-akayis-test".')
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-akayis-test',
      firestore: { rules: rulesWith(true), host: '127.0.0.1', port: 8080 },
    })
  })
  afterAll(async () => { if (testEnv) await testEnv.cleanup() })
  beforeEach(async () => { await testEnv.clearFirestore(); await seedAll(testEnv) })

  it('[RG-01] crée une opération dans SON sous-arbre — allow', async () => {
    const fs = ctxAgentA(testEnv).firestore()
    await assertSucceeds(setDoc(doc(fs, `clients/store-A/agentRegistry/${AGENT_A}/operations`, 'op-neuve'), OPERATION))
  })

  it('[RG-02] crée une fiche client dans SON sous-arbre — allow', async () => {
    const fs = ctxAgentA(testEnv).firestore()
    await assertSucceeds(setDoc(doc(fs, `clients/store-A/agentRegistry/${AGENT_A}/customers`, 'cl-neuve'), FICHE))
  })

  it('[RG-03] met à jour en merge (marqueur de suppression) — allow', async () => {
    const fs = ctxAgentA(testEnv).firestore()
    await assertSucceeds(setDoc(doc(fs, `clients/store-A/agentRegistry/${AGENT_A}/operations`, 'op-seed'), { supprime: true }, { merge: true }))
    await assertSucceeds(updateDoc(doc(fs, `clients/store-A/agentRegistry/${AGENT_A}/customers`, 'cl-seed'), { telephone: '70998877' }))
  })

  it('[RG-04] LISTE la sous-collection ENTIÈRE sans where — allow (c\'est la restauration)', async () => {
    // Le cas que casserait toute condition en resource.data : l'agent récupérerait un
    // registre VIDE en croyant n'avoir rien eu, au lieu d'un refus franc.
    const fs = ctxAgentA(testEnv).firestore()
    const ops = await assertSucceeds(getDocs(collection(fs, `clients/store-A/agentRegistry/${AGENT_A}/operations`)))
    expect(ops.docs.map((d) => d.id)).toEqual(['op-seed'])
    const fiches = await assertSucceeds(getDocs(collection(fs, `clients/store-A/agentRegistry/${AGENT_A}/customers`)))
    expect(fiches.docs.map((d) => d.id)).toEqual(['cl-seed'])
  })

  it('[RG-05] écrit sous SON uid mais dans une AUTRE BOUTIQUE — deny', async () => {
    // ⚠ Le trou de la règle proposée. `uid == agentId` était vrai ici : c'est bien son
    // uid, dans un chemin qu'il a choisi. Seul token.storeId l'arrête.
    const fs = ctxAgentA(testEnv).firestore()
    await assertFails(setDoc(doc(fs, `clients/store-B/agentRegistry/${AGENT_A}/operations`, 'op-intrus'), OPERATION))
    await assertFails(getDocs(collection(fs, `clients/store-B/agentRegistry/${AGENT_A}/operations`)))
    await assertFails(getDoc(doc(fs, `clients/store-B/agentRegistry/${AGENT_A}/operations`, 'op-b')))
  })

  it('[RG-06] écrit ou lit sous un AUTRE AGENT de sa boutique — deny', async () => {
    const fs = ctxAgentA(testEnv).firestore()
    await assertFails(setDoc(doc(fs, `clients/store-A/agentRegistry/${AGENT_A2}/operations`, 'op-vole'), OPERATION))
    await assertFails(getDocs(collection(fs, `clients/store-A/agentRegistry/${AGENT_A2}/operations`)))
  })

  it('[RG-07] une TROISIÈME sous-collection — deny', async () => {
    const fs = ctxAgentA(testEnv).firestore()
    await assertFails(setDoc(doc(fs, `clients/store-A/agentRegistry/${AGENT_A}/notes`, 'n-1'), { texte: 'x' }))
    await assertFails(getDocs(collection(fs, `clients/store-A/agentRegistry/${AGENT_A}/notes`)))
  })

  it('[RG-08] SUPPRIME un document du sien — deny (conservation longue)', async () => {
    const fs = ctxAgentA(testEnv).firestore()
    await assertFails(deleteDoc(doc(fs, `clients/store-A/agentRegistry/${AGENT_A}/operations`, 'op-seed')))
    await assertFails(deleteDoc(doc(fs, `clients/store-A/agentRegistry/${AGENT_A}/customers`, 'cl-seed')))
  })

  it('[RG-09] un membre boutique n\'y accède PAS — deny (pièces d\'identité de tiers)', async () => {
    // Décision explicite, pas un oubli : ouvrir isStoreMember exposerait toutes les
    // pièces d'identité de tous les clients de tous les agents de la boutique.
    const fs = testEnv.authenticatedContext('uid-member-a').firestore()
    await assertFails(getDocs(collection(fs, `clients/store-A/agentRegistry/${AGENT_A}/operations`)))
    await assertFails(setDoc(doc(fs, `clients/store-A/agentRegistry/${AGENT_A}/operations`, 'op-membre'), OPERATION))
  })

  it('[RG-10] un jeton NON agent (rôle absent) — deny', async () => {
    const fs = testEnv.authenticatedContext(AGENT_A, { clientId: AGENT_A, storeId: 'store-A' }).firestore()
    await assertFails(getDocs(collection(fs, `clients/store-A/agentRegistry/${AGENT_A}/operations`)))
    await assertFails(setDoc(doc(fs, `clients/store-A/agentRegistry/${AGENT_A}/operations`, 'op-x'), OPERATION))
  })

  it('[RG-11] non authentifié — deny', async () => {
    const fs = testEnv.unauthenticatedContext().firestore()
    await assertFails(getDocs(collection(fs, `clients/store-A/agentRegistry/${AGENT_A}/operations`)))
  })
})

describe('TC-182 — app mobile DÉSACTIVÉE : le registre est fermé (profil TAOFIC)', () => {
  let testEnv
  beforeAll(async () => {
    if (process.env.GCLOUD_PROJECT !== 'demo-akayis-test') throw new Error('SÉCURITÉ : projectId doit être "demo-akayis-test".')
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-akayis-test',
      firestore: { rules: rulesWith(false), host: '127.0.0.1', port: 8080 },
    })
  })
  afterAll(async () => { if (testEnv) await testEnv.cleanup() })
  beforeEach(async () => { await testEnv.clearFirestore(); await seedAll(testEnv) })

  it('[RG-12] l\'agent ne lit ni n\'écrit rien, même dans SON sous-arbre — deny', async () => {
    const fs = ctxAgentA(testEnv).firestore()
    await assertFails(getDocs(collection(fs, `clients/store-A/agentRegistry/${AGENT_A}/operations`)))
    await assertFails(setDoc(doc(fs, `clients/store-A/agentRegistry/${AGENT_A}/operations`, 'op-neuve'), OPERATION))
  })
})
