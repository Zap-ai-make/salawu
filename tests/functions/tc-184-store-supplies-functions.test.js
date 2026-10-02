/**
 * TC-184 — Ravitaillements boutique (storeSupplies).
 *   Handlers intégrés avec l'émulateur Firestore, { db, FieldValue } injectés.
 *
 * CE QUE CE FICHIER PROTÈGE, ET POURQUOI IL EXISTE
 * ─────────────────────────────────────────────────────────────────────────────
 * Avant ce chantier, augmenter un stock se faisait par le crayon de la carte
 * réseau : une écriture CLIENT du montant ABSOLU, sans aucune trace. Les règles
 * le nommaient déjà (firestore.rules l. 583-589) : « un compte boutique
 * compromis peut fixer un solde arbitraire SANS piste d'audit ».
 *
 * Les trois handlers ferment cette porte. Ce qui doit donc rester vrai :
 *
 *   1. LE SOLDE ET LE REGISTRE NE PEUVENT PAS DIVERGER. Toute écriture qui
 *      déplace un solde écrit sa ligne dans la même transaction.
 *   2. AUCUN MONTANT ABSOLU N'EST ACCEPTÉ. Le client dit combien AJOUTER ; le
 *      solde de départ est lu côté serveur.
 *   3. RIEN N'EST SUPPRIMÉ. Une annulation pose un statut et conserve le montant.
 *   4. UNE REPRISE QUI DÉPASSE LE SOLDE ÉCHOUE au lieu de raboter à zéro — un
 *      rabotage ferait disparaître la différence sans que personne ne l'apprenne.
 *
 * Exécution : npm run test:functions (émulateur Firestore, projet demo-akayis-test).
 */

import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest'
import { initializeApp, getApps, deleteApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { createStoreSupplyHandler } from '../../functions/src/supplies/createStoreSupply.js'
import { correctStoreSupplyHandler } from '../../functions/src/supplies/correctStoreSupply.js'
import { cancelStoreSupplyHandler } from '../../functions/src/supplies/cancelStoreSupply.js'

let adminApp
let db

const PROJECT_ID = process.env.GCLOUD_PROJECT
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST

beforeAll(() => {
  if (!FIRESTORE_HOST) throw new Error('SÉCURITÉ : FIRESTORE_EMULATOR_HOST non défini. Lancer via : npm run test:functions')
  if (!PROJECT_ID) throw new Error('SÉCURITÉ : GCLOUD_PROJECT non défini. Lancer via : npm run test:functions')
  if (PROJECT_ID !== 'demo-akayis-test') throw new Error(`SÉCURITÉ : projectId doit être "demo-akayis-test". Reçu : "${PROJECT_ID}"`)
  adminApp = getApps().length === 0 ? initializeApp({ projectId: PROJECT_ID }) : getApps()[0]
  db = getFirestore(adminApp)
})

afterAll(async () => {
  if (adminApp) await deleteApp(adminApp)
})

async function clearFirestoreEmulator() {
  const url = `http://${FIRESTORE_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`
  const res = await fetch(url, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Impossible de vider l'émulateur : HTTP ${res.status}`)
}

beforeEach(async () => { await clearFirestoreEmulator() })

// ── Fixtures ─────────────────────────────────────────────────────────────────
const ADMIN_UID = 'store-admin-uid'
const OTHER_ADMIN_UID = 'other-store-admin-uid'
const DEALER_UID = 'dealer-uid'
const STORE_A = 'store-A'
const STORE_B = 'store-B'

// ESAHAF est multi-réseaux ; le défaut committé de storeProfile.js est TAOFIC
// (['Orange']). On INJECTE donc la liste pour couvrir le cas réel du client qui
// commande la fonctionnalité, sans dépendre d'un fichier généré au déploiement.
const RESEAUX_ESAHAF = ['Orange', 'Moov', 'Telecel', 'Coris', 'Sank', 'Wave']

const ADMIN_PROFILE = { role: 'store_admin', active: true, storeId: STORE_A, email: 'admin@t.test', name: 'Salif Ouedraogo' }
const OTHER_ADMIN_PROFILE = { role: 'store_admin', active: true, storeId: STORE_B, email: 'b@t.test', name: 'Admin B' }
const DEALER_PROFILE = { role: 'dealer', active: true, email: 'dealer@t.test', name: 'Dealer Test' }

const BASE_BALANCE = {
  balances: {
    Orange: { stock: 50000, liquidite: 30000 },
    Moov: { stock: 10000, liquidite: 5000 },
  },
  updatedAt: new Date('2024-01-01T00:00:00Z'),
}

const seedUser = (uid, data) => db.doc(`users/${uid}`).set(data)
const seedBalance = (storeId, data) => db.doc(`clients/${storeId}/networkBalances/current`).set(data)
const seedStore = (storeId, name) => db.doc(`stores/${storeId}`).set({ name, active: true })
const makeRequest = (uid, data) => ({ auth: uid ? { uid, token: {} } : null, data: data ?? {} })

const deps = (extra = {}) => ({ db, FieldValue, storeNetworks: RESEAUX_ESAHAF, ...extra })

async function expectError(promise, code) {
  await expect(promise).rejects.toMatchObject({ code })
}

const readBalance = async (storeId, network, resource) => {
  const snap = await db.doc(`clients/${storeId}/networkBalances/current`).get()
  return snap.data()?.balances?.[network]?.[resource]
}

const readSupply = async (supplyId) => (await db.doc(`storeSupplies/${supplyId}`).get()).data()

const readAudits = async (storeId) => {
  const snap = await db.collection(`clients/${storeId}/auditLogs`).get()
  return snap.docs.map((d) => d.data())
}

/** Crée un ravitaillement et renvoie son id — raccourci des cas de correction. */
async function unRavitaillement({ network = 'Orange', resource = 'stock', amount = 20000 } = {}) {
  const res = await createStoreSupplyHandler(
    makeRequest(ADMIN_UID, { resource, amount, network }),
    deps(),
  )
  return res.supplyId
}

// ═══════════════════════════════════════════════════════════════════════════
// §CR — création
// ═══════════════════════════════════════════════════════════════════════════
describe('TC-184-CR — créer un ravitaillement', () => {
  beforeEach(async () => {
    await seedUser(ADMIN_UID, ADMIN_PROFILE)
    await seedStore(STORE_A, 'ESAHAF Gounghin Sud')
    await seedBalance(STORE_A, BASE_BALANCE)
  })

  it('[CR-01] crédite le stock du réseau choisi, et lui seul', async () => {
    const res = await createStoreSupplyHandler(
      makeRequest(ADMIN_UID, { resource: 'stock', amount: 15000, network: 'Orange' }),
      deps(),
    )

    expect(res.success).toBe(true)
    expect(res.previousBalance).toBe(50000)
    expect(res.newBalance).toBe(65000)
    expect(await readBalance(STORE_A, 'Orange', 'stock')).toBe(65000)

    // Les voisins n'ont pas bougé : c'est ce que garantit le `merge` sur un
    // chemin imbriqué, et c'est exactement ce qu'un `set` complet casserait.
    expect(await readBalance(STORE_A, 'Orange', 'liquidite')).toBe(30000)
    expect(await readBalance(STORE_A, 'Moov', 'stock')).toBe(10000)
  })

  it('[CR-02] crédite la liquidité du RÉSEAU CHOISI, sans la déverser ailleurs', async () => {
    // ⟲ CORRIGE UN COMPORTEMENT EXISTANT, et c'est délibéré.
    //
    // `useNetworkCards.addToLiquidity` ajoutait la liquidité au PREMIER réseau
    // de la liste, quel que soit celui qu'on regardait : la carte Liquidité
    // n'étant qu'une somme, le total était juste et la répartition fausse. La
    // modale demandant un réseau, on crédite celui-là.
    const res = await createStoreSupplyHandler(
      makeRequest(ADMIN_UID, { resource: 'liquidite', amount: 7000, network: 'Moov' }),
      deps(),
    )

    expect(res.newBalance).toBe(12000)
    expect(await readBalance(STORE_A, 'Moov', 'liquidite')).toBe(12000)
    expect(await readBalance(STORE_A, 'Orange', 'liquidite')).toBe(30000)
  })

  it('[CR-03] part de zéro sur un réseau encore absent du document', async () => {
    // Une boutique qui n'a jamais touché à Wave n'a pas de clé `balances.Wave`.
    // C'est un solde nul, pas une donnée corrompue.
    const res = await createStoreSupplyHandler(
      makeRequest(ADMIN_UID, { resource: 'stock', amount: 3000, network: 'Wave' }),
      deps(),
    )

    expect(res.previousBalance).toBe(0)
    expect(res.newBalance).toBe(3000)
  })

  it('[CR-04] crée le document de soldes quand la boutique n’en a pas encore', async () => {
    // ⚠ DIFFÉRENCE ASSUMÉE AVEC LES TRANSFERTS, qui exigent un document existant.
    // Eux DÉBITENT — sans solde connu il n'y a rien à retirer. Un ravitaillement
    // CRÉDITE : le premier geste d'une boutique neuve peut légitimement en être un.
    await db.doc(`clients/${STORE_A}/networkBalances/current`).delete()

    const res = await createStoreSupplyHandler(
      makeRequest(ADMIN_UID, { resource: 'stock', amount: 9000, network: 'Orange' }),
      deps(),
    )

    expect(res.previousBalance).toBe(0)
    expect(await readBalance(STORE_A, 'Orange', 'stock')).toBe(9000)
  })

  it('[CR-05] écrit la ligne de registre ET la piste d’audit dans la même transaction', async () => {
    const supplyId = await unRavitaillement({ amount: 20000 })

    const supply = await readSupply(supplyId)
    expect(supply).toMatchObject({
      storeId: STORE_A,
      storeName: 'ESAHAF Gounghin Sud',
      createdByUid: ADMIN_UID,
      createdByName: 'Salif Ouedraogo',
      network: 'Orange',
      resource: 'stock',
      amount: 20000,
      originalAmount: 20000,
      status: 'active',
      previousBalance: 50000,
      newBalance: 70000,
      correctionCount: 0,
    })

    const audits = await readAudits(STORE_A)
    expect(audits).toHaveLength(1)
    expect(audits[0]).toMatchObject({
      action: 'STORE_SUPPLY_CREATED',
      actorUid: ADMIN_UID,
      supplyId,
      amount: 20000,
      previousBalance: 50000,
      newBalance: 70000,
    })
  })

  it('[CR-06] refuse un montant non entier, nul ou négatif', async () => {
    for (const amount of [0, -100, 1500.5, '1500', null]) {
      await expectError(
        createStoreSupplyHandler(makeRequest(ADMIN_UID, { resource: 'stock', amount, network: 'Orange' }), deps()),
        'INVALID_SUPPLY_AMOUNT',
      )
    }
  })

  it('[CR-07] refuse une ressource inconnue', async () => {
    await expectError(
      createStoreSupplyHandler(makeRequest(ADMIN_UID, { resource: 'dette', amount: 1000, network: 'Orange' }), deps()),
      'INVALID_SUPPLY_RESOURCE',
    )
  })

  it('[CR-08] refuse un réseau hors du profil de la boutique', async () => {
    await expectError(
      createStoreSupplyHandler(makeRequest(ADMIN_UID, { resource: 'stock', amount: 1000, network: 'Airtel' }), deps()),
      'INVALID_SUPPLY_NETWORK',
    )
  })

  it('[CR-09] exige un réseau explicite en multi-réseaux, et le déduit en mono-réseau', async () => {
    // Aucun choix silencieux quand plusieurs cartes sont candidates : se tromper
    // de carte est une erreur qu'on ne peut pas voir à l'écran.
    await expectError(
      createStoreSupplyHandler(makeRequest(ADMIN_UID, { resource: 'stock', amount: 1000 }), deps()),
      'INVALID_SUPPLY_NETWORK',
    )

    // TAOFIC (mono-réseau) n'a qu'une carte : l'omettre n'est pas ambigu.
    const res = await createStoreSupplyHandler(
      makeRequest(ADMIN_UID, { resource: 'stock', amount: 1000 }),
      deps({ storeNetworks: ['Orange'] }),
    )
    expect(res.newBalance).toBe(51000)
  })

  it('[CR-10] refuse un appel non authentifié, un rôle non boutique, un compte inactif', async () => {
    await expectError(
      createStoreSupplyHandler(makeRequest(null, { resource: 'stock', amount: 1000, network: 'Orange' }), deps()),
      'UNAUTHENTICATED',
    )

    await seedUser(DEALER_UID, DEALER_PROFILE)
    await expectError(
      createStoreSupplyHandler(makeRequest(DEALER_UID, { resource: 'stock', amount: 1000, network: 'Orange' }), deps()),
      'ROLE_FORBIDDEN',
    )

    await seedUser(ADMIN_UID, { ...ADMIN_PROFILE, active: false })
    await expectError(
      createStoreSupplyHandler(makeRequest(ADMIN_UID, { resource: 'stock', amount: 1000, network: 'Orange' }), deps()),
      'PROFILE_INACTIVE',
    )
  })

  it('[CR-11] ne laisse AUCUNE trace quand la transaction échoue', async () => {
    // Le cœur de la promesse : pas de ligne de registre sans mouvement de solde,
    // et pas de mouvement de solde sans ligne.
    await expectError(
      createStoreSupplyHandler(makeRequest(ADMIN_UID, { resource: 'stock', amount: -1, network: 'Orange' }), deps()),
      'INVALID_SUPPLY_AMOUNT',
    )

    expect((await db.collection('storeSupplies').get()).empty).toBe(true)
    expect(await readAudits(STORE_A)).toHaveLength(0)
    expect(await readBalance(STORE_A, 'Orange', 'stock')).toBe(50000)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// §CO — correction
// ═══════════════════════════════════════════════════════════════════════════
describe('TC-184-CO — corriger un ravitaillement', () => {
  beforeEach(async () => {
    await seedUser(ADMIN_UID, ADMIN_PROFILE)
    await seedStore(STORE_A, 'ESAHAF Gounghin Sud')
    await seedBalance(STORE_A, BASE_BALANCE)
  })

  it('[CO-01] corriger à la hausse crédite la DIFFÉRENCE, pas le montant', async () => {
    // 50 000 + 20 000 = 70 000 ; corriger 20 000 → 25 000 doit donner 75 000.
    // Recréditer 25 000 donnerait 95 000 : c'est l'erreur que ce cas interdit.
    const supplyId = await unRavitaillement({ amount: 20000 })
    expect(await readBalance(STORE_A, 'Orange', 'stock')).toBe(70000)

    const res = await correctStoreSupplyHandler(
      makeRequest(ADMIN_UID, { supplyId, amount: 25000, reason: 'Erreur de saisie' }),
      deps(),
    )

    expect(res.previousAmount).toBe(20000)
    expect(res.amount).toBe(25000)
    expect(res.newBalance).toBe(75000)
    expect(await readBalance(STORE_A, 'Orange', 'stock')).toBe(75000)
  })

  it('[CO-02] corriger à la baisse reprend la différence', async () => {
    const supplyId = await unRavitaillement({ amount: 20000 })

    await correctStoreSupplyHandler(
      makeRequest(ADMIN_UID, { supplyId, amount: 15000, reason: 'Trop compté' }),
      deps(),
    )

    expect(await readBalance(STORE_A, 'Orange', 'stock')).toBe(65000)
  })

  it('[CO-03] annote la ligne sans effacer le montant d’origine', async () => {
    const supplyId = await unRavitaillement({ amount: 20000 })

    await correctStoreSupplyHandler(
      makeRequest(ADMIN_UID, { supplyId, amount: 25000, reason: 'Erreur de saisie' }),
      deps(),
    )

    const supply = await readSupply(supplyId)
    expect(supply.amount).toBe(25000)
    // ⚠ CE QUI REND L'HISTORIQUE LISIBLE : « 20 000, corrigé en 25 000 » se lit
    // sur la ligne, sans avoir à interroger les journaux.
    expect(supply.originalAmount).toBe(20000)
    expect(supply.correctionCount).toBe(1)
    expect(supply.correctedByUid).toBe(ADMIN_UID)
    expect(supply.correctionReason).toBe('Erreur de saisie')
    expect(supply.status).toBe('active')
  })

  it('[CO-04] journalise l’ancien ET le nouveau montant, à chaque correction', async () => {
    const supplyId = await unRavitaillement({ amount: 20000 })
    await correctStoreSupplyHandler(makeRequest(ADMIN_UID, { supplyId, amount: 25000, reason: 'r1' }), deps())
    await correctStoreSupplyHandler(makeRequest(ADMIN_UID, { supplyId, amount: 30000, reason: 'r2' }), deps())

    const corrections = (await readAudits(STORE_A)).filter((a) => a.action === 'STORE_SUPPLY_CORRECTED')
    expect(corrections).toHaveLength(2)
    expect(corrections.map((c) => [c.fromAmount, c.toAmount]).sort()).toEqual([[20000, 25000], [25000, 30000]])

    // Le compteur suit, et le montant d'origine ne bouge toujours pas.
    const supply = await readSupply(supplyId)
    expect(supply.correctionCount).toBe(2)
    expect(supply.originalAmount).toBe(20000)
  })

  it('[CO-05] refuse une baisse que la carte ne peut plus honorer', async () => {
    // Le ravitaillement a été dépensé depuis : le reprendre rendrait le solde
    // négatif. On échoue au lieu de raboter à zéro — raboter ferait disparaître
    // la différence sans que personne ne l'apprenne.
    const supplyId = await unRavitaillement({ amount: 20000, network: 'Wave' })
    await db.doc(`clients/${STORE_A}/networkBalances/current`)
      .set({ balances: { Wave: { stock: 500 } } }, { merge: true })

    await expectError(
      correctStoreSupplyHandler(makeRequest(ADMIN_UID, { supplyId, amount: 1000, reason: 'x' }), deps()),
      'INSUFFICIENT_BALANCE_FOR_REVERSAL',
    )

    // Et rien n'a bougé : ni le solde, ni la ligne.
    expect(await readBalance(STORE_A, 'Wave', 'stock')).toBe(500)
    expect((await readSupply(supplyId)).amount).toBe(20000)
  })

  it('[CO-06] refuse une correction vers le montant déjà en place', async () => {
    const supplyId = await unRavitaillement({ amount: 20000 })
    await expectError(
      correctStoreSupplyHandler(makeRequest(ADMIN_UID, { supplyId, amount: 20000, reason: 'x' }), deps()),
      'SUPPLY_UNCHANGED',
    )
  })

  it('[CO-07] refuse de corriger le ravitaillement d’une AUTRE boutique', async () => {
    // Le cloisonnement ne repose pas sur le payload : le storeId comparé vient
    // du profil relu DANS la transaction.
    const supplyId = await unRavitaillement({ amount: 20000 })
    await seedUser(OTHER_ADMIN_UID, OTHER_ADMIN_PROFILE)

    await expectError(
      correctStoreSupplyHandler(makeRequest(OTHER_ADMIN_UID, { supplyId, amount: 25000, reason: 'x' }), deps()),
      'SUPPLY_STORE_MISMATCH',
    )
    expect(await readBalance(STORE_A, 'Orange', 'stock')).toBe(70000)
  })

  it('[CO-08] refuse de corriger une ligne annulée', async () => {
    const supplyId = await unRavitaillement({ amount: 20000 })
    await cancelStoreSupplyHandler(makeRequest(ADMIN_UID, { supplyId, reason: 'doublon' }), deps())

    await expectError(
      correctStoreSupplyHandler(makeRequest(ADMIN_UID, { supplyId, amount: 25000, reason: 'x' }), deps()),
      'SUPPLY_ALREADY_CANCELLED',
    )
  })

  it('[CO-09] refuse un identifiant inconnu', async () => {
    await expectError(
      correctStoreSupplyHandler(makeRequest(ADMIN_UID, { supplyId: 'inexistant', amount: 1000, reason: 'x' }), deps()),
      'SUPPLY_NOT_FOUND',
    )
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// §AN — annulation
// ═══════════════════════════════════════════════════════════════════════════
describe('TC-184-AN — annuler un ravitaillement', () => {
  beforeEach(async () => {
    await seedUser(ADMIN_UID, ADMIN_PROFILE)
    await seedStore(STORE_A, 'ESAHAF Gounghin Sud')
    await seedBalance(STORE_A, BASE_BALANCE)
  })

  it('[AN-01] reprend le montant et CONSERVE la ligne, barrée', async () => {
    // ⚠ LE CŒUR DE CE BLOC. « Supprimable » à l'écran, jamais supprimé en base :
    // `delete()` effacerait le montant, l'auteur et la date, et un solde
    // cesserait d'être explicable. CLAUDE.md exige la piste d'audit.
    const supplyId = await unRavitaillement({ amount: 20000 })
    expect(await readBalance(STORE_A, 'Orange', 'stock')).toBe(70000)

    const res = await cancelStoreSupplyHandler(
      makeRequest(ADMIN_UID, { supplyId, reason: 'Saisi deux fois' }),
      deps(),
    )

    expect(res.newBalance).toBe(50000)
    expect(await readBalance(STORE_A, 'Orange', 'stock')).toBe(50000)

    const supply = await readSupply(supplyId)
    expect(supply).not.toBeUndefined()
    expect(supply.status).toBe('cancelled')
    expect(supply.cancelledByUid).toBe(ADMIN_UID)
    expect(supply.cancellationReason).toBe('Saisi deux fois')
    // Le montant reste lisible : une ligne annulée à 0 serait indéchiffrable.
    expect(supply.amount).toBe(20000)
  })

  it('[AN-02] exige un motif — c’est le seul geste dont la trace serait illisible sans lui', async () => {
    const supplyId = await unRavitaillement({ amount: 20000 })

    for (const reason of [undefined, null, '', '   ']) {
      await expectError(
        cancelStoreSupplyHandler(makeRequest(ADMIN_UID, { supplyId, reason }), deps()),
        'INVALID_SUPPLY_REASON',
      )
    }
    expect(await readBalance(STORE_A, 'Orange', 'stock')).toBe(70000)
  })

  it('[AN-03] refuse la seconde annulation : un double clic ne reprend pas deux fois', async () => {
    const supplyId = await unRavitaillement({ amount: 20000 })
    await cancelStoreSupplyHandler(makeRequest(ADMIN_UID, { supplyId, reason: 'doublon' }), deps())

    await expectError(
      cancelStoreSupplyHandler(makeRequest(ADMIN_UID, { supplyId, reason: 'encore' }), deps()),
      'SUPPLY_ALREADY_CANCELLED',
    )
    expect(await readBalance(STORE_A, 'Orange', 'stock')).toBe(50000)
  })

  it('[AN-04] échoue quand la carte ne peut plus rendre le montant', async () => {
    const supplyId = await unRavitaillement({ amount: 20000, network: 'Wave' })
    await db.doc(`clients/${STORE_A}/networkBalances/current`)
      .set({ balances: { Wave: { stock: 1 } } }, { merge: true })

    await expectError(
      cancelStoreSupplyHandler(makeRequest(ADMIN_UID, { supplyId, reason: 'x' }), deps()),
      'INSUFFICIENT_BALANCE_FOR_REVERSAL',
    )
    expect((await readSupply(supplyId)).status).toBe('active')
  })

  it('[AN-05] refuse d’annuler le ravitaillement d’une AUTRE boutique', async () => {
    const supplyId = await unRavitaillement({ amount: 20000 })
    await seedUser(OTHER_ADMIN_UID, OTHER_ADMIN_PROFILE)

    await expectError(
      cancelStoreSupplyHandler(makeRequest(OTHER_ADMIN_UID, { supplyId, reason: 'x' }), deps()),
      'SUPPLY_STORE_MISMATCH',
    )
    expect((await readSupply(supplyId)).status).toBe('active')
  })

  it('[AN-06] journalise l’annulation avec son motif', async () => {
    const supplyId = await unRavitaillement({ amount: 20000 })
    await cancelStoreSupplyHandler(makeRequest(ADMIN_UID, { supplyId, reason: 'Saisi deux fois' }), deps())

    const annulations = (await readAudits(STORE_A)).filter((a) => a.action === 'STORE_SUPPLY_CANCELLED')
    expect(annulations).toHaveLength(1)
    expect(annulations[0]).toMatchObject({
      supplyId,
      amount: 20000,
      reason: 'Saisi deux fois',
      previousBalance: 70000,
      newBalance: 50000,
    })
  })
})
