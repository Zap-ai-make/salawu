/**
 * TC-183 — Exemptions d'index du registre de guichet agent (app mobile).
 *
 * ⚠ CE TEST EXISTE PARCE QUE L'OUBLI EST INVISIBLE. Firestore indexe tout champ
 * par défaut. Un champ que l'app mobile ajoute sans exemption correspondante se
 * met donc à peser 3 à 6 fois son poids en index, SANS AUCUN SYMPTÔME : rien ne
 * casse, rien ne ralentit, seule la facture de stockage monte. L'équipe mobile a
 * mesuré le gain à 2,3× ; il s'érode en silence à chaque champ ajouté.
 *
 * Le schéma ci-dessous est celui que l'app mobile écrit, daté. Quand elle le fait
 * évoluer, ce test échoue — et c'est tout ce qu'on lui demande : transformer une
 * obligation d'intendance en rouge franc.
 *
 * Les index composites ne sont pas concernés : ces sous-collections se lisent
 * intégralement, triées sur documentId(), qui est indexé de toute façon.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const { fieldOverrides } = JSON.parse(readFileSync(path.join(ROOT, 'firestore.indexes.json'), 'utf8'))

/** Schéma écrit par l'app mobile agents — état au 2026-09-28. */
const SCHEMA = {
  customers: [
    'id', 'agent_id', 'nom', 'prenoms', 'type_piece', 'numero_piece',
    'telephone', 'cree_le', 'cree_par_appareil', 'updatedAt', 'createdAt',
  ],
  operations: [
    'id', 'agent_id', 'client_id', 'sens', 'reseau', 'montant',
    'heure_appareil', 'appareil_id', 'updatedAt', 'createdAt',
  ],
}

const exemptions = (collection) =>
  fieldOverrides.filter((f) => f.collectionGroup === collection)

describe('TC-183 — tout champ du registre agent est exempté d\'index', () => {
  for (const [collection, champs] of Object.entries(SCHEMA)) {
    it(`${collection} : les ${champs.length} champs du schéma sont exemptés`, () => {
      const exemptes = exemptions(collection).map((f) => f.fieldPath)
      expect([...exemptes].sort()).toEqual([...champs].sort())
    })

    it(`${collection} : chaque exemption désactive VRAIMENT l'indexation`, () => {
      // `indexes: []` est ce qui désactive. Une entrée présente mais portant des
      // index déclarés ne gagne rien et donne la fausse impression d'être réglée.
      for (const f of exemptions(collection)) {
        expect(f.indexes, `${collection}.${f.fieldPath}`).toEqual([])
      }
    })
  }

  it('n\'exempte aucun champ de history au passage', () => {
    // history garde ses index : c'est l'écran Historique et la synchronisation
    // incrémentale qui les consomment (TC-181).
    const h = exemptions('history')
    expect(h.length).toBeGreaterThan(0)
    expect(h.every((f) => Array.isArray(f.indexes) && f.indexes.length > 0)).toBe(true)
  })
})
