/**
 * TC-114 — Index composites requis par les requêtes de collaborationService.
 *
 * Caractérisation : chaque abonnement onSnapshot du service combine un filtre
 * d'égalité et un orderBy('createdAt'), ce qui exige un index composite déclaré.
 * Leur absence ne casse aucun test unitaire mais fait échouer les listeners en
 * production (FirebaseError "The query requires an index"). Ce test verrouille
 * la correspondance requête ↔ index.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const { indexes } = JSON.parse(readFileSync(path.join(ROOT, 'firestore.indexes.json'), 'utf8'))

/** Vrai si un index déclaré correspond exactement à la suite de champs attendue. */
const hasIndex = (collectionGroup, fields) =>
  indexes.some(idx =>
    idx.collectionGroup === collectionGroup &&
    idx.fields.length === fields.length &&
    idx.fields.every((f, i) => f.fieldPath === fields[i][0] && f.order === fields[i][1]),
  )

const ASC = 'ASCENDING'
const DESC = 'DESCENDING'

describe('TC-114 — index composites collaborations et dettes internes', () => {
  it('couvre subscribeOutgoingCollaborations (requestingStoreId + createdAt)', () => {
    expect(hasIndex('storeCollaborations', [['requestingStoreId', ASC], ['createdAt', DESC]])).toBe(true)
  })

  it('couvre subscribeIncomingCollaborations sans filtre de statut', () => {
    expect(hasIndex('storeCollaborations', [['supplierStoreId', ASC], ['createdAt', DESC]])).toBe(true)
  })

  it('couvre subscribeIncomingCollaborations avec statut, et le compteur des collaborations en attente', () => {
    expect(hasIndex('storeCollaborations', [['supplierStoreId', ASC], ['status', ASC], ['createdAt', DESC]])).toBe(true)
  })

  it('couvre subscribeMyDebts (debtorStoreId + createdAt)', () => {
    expect(hasIndex('internalDebts', [['debtorStoreId', ASC], ['createdAt', DESC]])).toBe(true)
  })

  it('couvre subscribeMyCredits (creditorStoreId + createdAt)', () => {
    expect(hasIndex('internalDebts', [['creditorStoreId', ASC], ['createdAt', DESC]])).toBe(true)
  })
})
