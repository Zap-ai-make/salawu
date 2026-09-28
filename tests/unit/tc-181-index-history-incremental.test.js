/**
 * TC-181 — Index composite exigé par la synchronisation incrémentale de l'app mobile agents.
 *
 * ⚠ CET INDEX N'EST UTILISÉ PAR AUCUNE REQUÊTE DE CE DÉPÔT. C'est précisément pour
 * cela que ce test existe : sans lui, la prochaine revue d'index le verra « orphelin »
 * et le supprimera en toute bonne foi. La requête qui en dépend vit dans l'application
 * mobile agents, un autre dépôt :
 *
 *   query(
 *     collection(db, 'clients', storeId, 'history'),
 *     where('clientId', '==', uid),
 *     where('updatedAt', '>=', borne),
 *     orderBy('updatedAt', 'asc'),
 *   )
 *
 * Elle croise une égalité et une plage — Firestore n'accepte cette combinaison qu'avec
 * un index composite déclaré. Son absence ne casse aucun test et ne casse pas l'app :
 * celle-ci reçoit `failed-precondition` et retombe sur la relecture complète. Le seul
 * symptôme est une facture de lecture qui remonte, sans rien à l'écran pour le dire.
 *
 * Le champ `updatedAt` est garanti sur tout document `history` — voir la vérification
 * dans ce même test, et les quatre chemins d'écriture cités.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const { indexes } = JSON.parse(readFileSync(path.join(ROOT, 'firestore.indexes.json'), 'utf8'))
const lire = (relatif) => readFileSync(path.join(ROOT, relatif), 'utf8')

const ASC = 'ASCENDING'

/** Vrai si un index déclaré correspond exactement à la suite de champs attendue. */
const hasIndex = (collectionGroup, fields, queryScope = 'COLLECTION') =>
  indexes.some((idx) =>
    idx.collectionGroup === collectionGroup &&
    idx.queryScope === queryScope &&
    idx.fields.length === fields.length &&
    idx.fields.every((f, i) => f.fieldPath === fields[i][0] && f.order === fields[i][1]),
  )

describe('TC-181 — index de la synchronisation incrémentale agents', () => {
  it('déclare history (clientId + updatedAt), en portée Collection', () => {
    expect(hasIndex('history', [['clientId', ASC], ['updatedAt', ASC]])).toBe(true)
  })

  it('le déclare en COLLECTION et non COLLECTION_GROUP', () => {
    // La requête mobile cible clients/{storeId}/history, une sous-collection nommée :
    // la portée Collection suffit et couvre toutes les boutiques. Une portée
    // Collection group serait un index distinct, et ne répondrait pas à cette requête.
    expect(hasIndex('history', [['clientId', ASC], ['updatedAt', ASC]], 'COLLECTION_GROUP')).toBe(false)
  })

  it("ne remplace pas l'index (clientId + createdAt) déjà servi par l'écran Historique", () => {
    expect(hasIndex('history', [['clientId', ASC], ['createdAt', 'DESCENDING']])).toBe(true)
  })
})

describe('TC-181 — updatedAt est écrit sur tout document history', () => {
  // Une requête bornée sur un champ EXCLUT EN SILENCE les documents qui ne le portent
  // pas. Un seul chemin de création oubliant `updatedAt` rendrait ces mouvements
  // invisibles à l'app mobile — sans erreur, sans trace. Ces cas verrouillent les
  // quatre chemins qui écrivent un history.
  it('addDocument enrichit toute création de createdAt ET updatedAt', () => {
    const src = lire('src/services/firestore.js')
    const bloc = src.slice(src.indexOf('async addDocument('))
    const corps = bloc.slice(0, bloc.indexOf('async updateDocument('))
    expect(corps).toContain('createdAt: serverTimestamp()')
    expect(corps).toContain('updatedAt: serverTimestamp()')
  })

  it('updateDocument bump updatedAt à chaque modification', () => {
    const src = lire('src/services/firestore.js')
    const bloc = src.slice(src.indexOf('async updateDocument('))
    expect(bloc.slice(0, 1200)).toContain('updatedAt: serverTimestamp()')
  })

  it("l'annulation d'une transaction bump updatedAt (sinon l'app garderait une ligne annulée)", () => {
    const src = lire('src/services/historyService.js')
    const bloc = src.slice(src.indexOf('async deleteFromHistory('))
    expect(bloc).toContain('statut: FIRESTORE_CONFIG.STATUS.CANCELLED')
    expect(bloc).toContain('updatedAt: now')
  })

  it('le flux paiement-unique (draftService) écrit updatedAt sur le history créé', () => {
    const src = lire('src/services/draftService.js')
    const bloc = src.slice(src.indexOf('const historyData = {'))
    expect(bloc.slice(0, 1200)).toContain('updatedAt: now')
  })

  it('la Cloud Function de règlement écrit updatedAt sur le history créé', () => {
    const src = lire('functions/src/settlements/addTransactionPayment.js')
    const bloc = src.slice(src.indexOf('t.set(historyRef, {'))
    expect(bloc.slice(0, 1200)).toContain('updatedAt:')
  })

  it('le semis QA écrit updatedAt, comme la production', () => {
    // Le semis l'omettait : sur émulateur, la requête incrémentale rendait ZÉRO ligne
    // et ressemblait à « aucun changement », jamais à « champ absent ». Un banc d'essai
    // mobile lancé là-dessus aurait conclu que sa synchronisation fonctionnait.
    const src = lire('scripts/qa/seed-qa.mjs')
    const bloc = src.slice(src.indexOf('async function semerLHistorique('))
    expect(bloc).toContain('updatedAt: FieldValue.serverTimestamp()')
  })
})
