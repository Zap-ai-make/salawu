/**
 * TC-173 — la répartition par réseau compte TOUS les réseaux déclarés.
 * ─────────────────────────────────────────────────────────────────────────────
 * Ce fichier est le test de caractérisation exigé avant de toucher à une règle
 * métier (CLAUDE.md). La règle changée : « Répartition par réseau » ne comptait
 * qu'Orange, écrit en dur, ce qui était juste pour un profil mono-réseau et faux
 * pour ESAHAF qui en déclare six.
 *
 * Décision du client, 2026-09-18 : « taofic n'est pas concerné par cela, tout
 * doit être limité ici à salawu qui est multi-réseaux, tous les réseaux ».
 *
 * CE QUE CES CAS VERROUILLENT, ET POURQUOI CHACUN
 *
 *   · L'ordre des réseaux est celui du profil, pas celui des données. Un anneau
 *     dont les parts changent de place d'un chargement à l'autre est illisible.
 *   · Les zéros survivent. Un réseau sans client est l'information qui fait
 *     agir ; le filtrer efface la question.
 *   · Un client multi-réseaux compte dans CHAQUE réseau. La somme des parts peut
 *     donc dépasser l'effectif, et c'est la réponse juste à la question posée.
 *   · Un profil mono-réseau obtient exactement ce qu'il obtenait. C'est la
 *     garantie que TAOFIC ne bouge pas — et elle est vérifiée ici, pas espérée.
 */

import { describe, it, expect } from 'vitest'
import { repartitionParReseau, totalDesParts } from '../../src/utils/repartitionReseaux.js'

const SIX = ['Orange', 'Moov', 'Telecel', 'Coris', 'Sank', 'Wave']

/** Un jeu proche du banc : des mono-réseau, un multi-réseau, un sans aucun. */
const CLIENTS = [
  { nom: 'OUEDRAOGO', orange: '1004500', moov: '1004813' }, // compte DEUX fois
  { nom: 'ZONGO', sank: '1005752' },
  { nom: 'TRAORE', wave: '1006210' },
  { nom: 'KABORE', orange: '1004222' },
  { nom: 'SAWADOGO' }, // aucun réseau : ne compte nulle part
]

describe('TC-173 — la répartition compte tous les réseaux déclarés', () => {
  it('rend une entrée par réseau du profil, dans l\'ordre du profil', () => {
    const r = repartitionParReseau(CLIENTS, SIX)
    expect(r.map((p) => p.nom)).toEqual(SIX)
  })

  it('compte les clients de chaque réseau', () => {
    const r = repartitionParReseau(CLIENTS, SIX)
    const par = Object.fromEntries(r.map((p) => [p.nom, p.clients]))
    expect(par).toEqual({ Orange: 2, Moov: 1, Telecel: 0, Coris: 0, Sank: 1, Wave: 1 })
  })

  it('CONSERVE les réseaux à zéro — c\'est l\'information qui fait agir', () => {
    const r = repartitionParReseau(CLIENTS, SIX)
    expect(r.find((p) => p.nom === 'Telecel')).toEqual({ nom: 'Telecel', clients: 0 })
    expect(r.find((p) => p.nom === 'Coris')).toEqual({ nom: 'Coris', clients: 0 })
  })

  it('compte un client multi-réseaux dans CHACUN de ses réseaux', () => {
    const r = repartitionParReseau([{ orange: 'a', moov: 'b', wave: 'c' }], SIX)
    const par = Object.fromEntries(r.map((p) => [p.nom, p.clients]))
    expect(par.Orange).toBe(1)
    expect(par.Moov).toBe(1)
    expect(par.Wave).toBe(1)
  })

  it('⚠ la somme des parts PEUT dépasser le nombre de clients, et c\'est juste', () => {
    const r = repartitionParReseau(CLIENTS, SIX)
    // Cinq clients, cinq codes agent répartis sur quatre réseaux.
    expect(totalDesParts(r)).toBe(5)
    // Le client OUEDRAOGO en porte deux à lui seul : les parts ne se divisent
    // pas entre des cases exclusives.
    const r2 = repartitionParReseau([{ orange: 'a', moov: 'b' }], SIX)
    expect(totalDesParts(r2)).toBe(2)
    expect(totalDesParts(r2)).toBeGreaterThan(1)
  })

  it('⚠ UN PROFIL MONO-RÉSEAU OBTIENT EXACTEMENT CE QU\'IL OBTENAIT', () => {
    // C'est la garantie TAOFIC. Son profil déclare `['Orange']` : la règle lui
    // rend une seule part, avec le même compte que l'ancien calcul en dur
    // (`if (client.orange) networkCounts.Orange++`).
    const r = repartitionParReseau(CLIENTS, ['Orange'])
    expect(r).toEqual([{ nom: 'Orange', clients: 2 }])
  })

  describe('ce qui compte comme « présent sur le réseau »', () => {
    it('ignore une chaîne vide ou faite d\'espaces — les imports XLSM en produisent', () => {
      const r = repartitionParReseau([{ orange: '' }, { orange: '   ' }], ['Orange'])
      expect(r[0].clients).toBe(0)
    })

    it('accepte un code agent numérique — un tableur le rend en nombre', () => {
      const r = repartitionParReseau([{ orange: 1004500 }], ['Orange'])
      expect(r[0].clients).toBe(1)
    })

    it('ignore null, undefined et false', () => {
      const r = repartitionParReseau(
        [{ orange: null }, { orange: undefined }, { orange: false }],
        ['Orange'],
      )
      expect(r[0].clients).toBe(0)
    })

    it('ignore NaN, qu\'un parseFloat raté peut produire', () => {
      const r = repartitionParReseau([{ orange: Number.NaN }], ['Orange'])
      expect(r[0].clients).toBe(0)
    })
  })

  describe('entrées dégradées — un tableau de bord ne doit jamais casser', () => {
    it('rend des zéros quand la liste de clients est vide', () => {
      expect(repartitionParReseau([], SIX).every((p) => p.clients === 0)).toBe(true)
    })

    it('rend des zéros quand les clients ne sont pas un tableau', () => {
      expect(repartitionParReseau(null, ['Orange'])).toEqual([{ nom: 'Orange', clients: 0 }])
      expect(repartitionParReseau(undefined, ['Orange'])).toEqual([{ nom: 'Orange', clients: 0 }])
    })

    it('rend une liste vide quand aucun réseau n\'est déclaré', () => {
      expect(repartitionParReseau(CLIENTS, [])).toEqual([])
      expect(repartitionParReseau(CLIENTS, null)).toEqual([])
    })

    it('traverse une entrée nulle dans la liste des clients', () => {
      const r = repartitionParReseau([null, { orange: 'a' }, undefined], ['Orange'])
      expect(r[0].clients).toBe(1)
    })
  })

  describe('totalDesParts', () => {
    it('somme les parts', () => {
      expect(totalDesParts([{ nom: 'A', clients: 3 }, { nom: 'B', clients: 4 }])).toBe(7)
    })

    it('rend 0 sur une entrée absente ou mal formée', () => {
      expect(totalDesParts(null)).toBe(0)
      expect(totalDesParts([])).toBe(0)
      expect(totalDesParts([{ nom: 'A' }])).toBe(0)
    })
  })
})
