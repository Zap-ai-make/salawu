/**
 * TC-172 — Les chiffres du jour (règle métier, lot L8.1).
 *
 * Deux nombres servent à arrêter une caisse : combien d'opérations aujourd'hui,
 * et combien d'argent est entré. Ce fichier verrouille leurs FILTRES, qui ne
 * sont pas les mêmes — et c'est le point le plus facile à casser en croyant
 * bien faire, puisqu'un lecteur pressé les prendrait pour une incohérence.
 *
 *   ACTIVITÉ  : tout sauf « Annulée » (une annulation n'a jamais eu lieu).
 *   AFFAIRES  : seulement « Validée » (l'argent est effectivement entré).
 *
 * L'horloge est INJECTÉE. Une règle qui lit `new Date()` au fond de son corps ne
 * se teste qu'en gelant le temps du processus entier ; celle-ci se teste en lui
 * passant un jour.
 */

import { describe, it, expect } from 'vitest'
import { chiffresDuJour } from '../../src/utils/chiffresDuJour.js'

/** Le jour qu'on interroge. `parsefrenchDate` lit « JJ/MM/AAAA hh:mm ». */
const AUJOURDHUI = new Date(2026, 8, 14, 17, 30) // 14 septembre 2026
const CE_JOUR = '14/09/2026'
const LA_VEILLE = '13/09/2026'

const op = (extra) => ({
  date: `${CE_JOUR} 09:15`,
  type: 'Dépôt',
  statut: 'Validée',
  montant: 100000,
  ...extra,
})

describe('TC-172 — l’activité du jour', () => {
  it('compte les dépôts et les retraits du jour, et eux seuls', () => {
    const resultat = chiffresDuJour([
      op({ type: 'Dépôt' }),
      op({ type: 'Dépôt' }),
      op({ type: 'Retrait' }),
      op({ date: `${LA_VEILLE} 18:00`, type: 'Dépôt' }),
    ], AUJOURDHUI)

    expect(resultat.depots).toBe(2)
    expect(resultat.retraits).toBe(1)
    expect(resultat.ventes).toBe(3)
  })

  it('le total est la SOMME de sa ventilation, toujours', () => {
    // « 37 » au-dessus de « 18 dépôts · 19 retraits » : si les deux ne tombent
    // pas juste, l'écran ment. Le pilote déclare un troisième type (« Crédit »)
    // qui n'entre dans aucun des deux paliers — le total ne doit pas le compter,
    // sans quoi il annoncerait une somme que sa propre ventilation ne justifie
    // pas.
    const resultat = chiffresDuJour([
      op({ type: 'Dépôt' }),
      op({ type: 'Retrait' }),
      op({ type: 'Crédit' }),
    ], AUJOURDHUI)

    expect(resultat.ventes).toBe(resultat.depots + resultat.retraits)
    expect(resultat.ventes).toBe(2)
  })

  it('une opération ANNULÉE n’a jamais eu lieu : elle ne compte nulle part', () => {
    const resultat = chiffresDuJour([
      op({ statut: 'Annulée' }),
      op({ statut: 'Annulée', type: 'Retrait' }),
    ], AUJOURDHUI)

    expect(resultat.ventes).toBe(0)
    expect(resultat.chiffreAffaires).toBe(0)
  })

  it('une opération NON TERMINÉE ou REMBOURSÉE compte dans l’activité', () => {
    // Le client s'est présenté, l'agent a saisi : l'opération a eu lieu. C'est
    // la sémantique de `useTodayTransactions`, reprise telle quelle.
    const resultat = chiffresDuJour([
      op({ statut: 'Non Terminées' }),
      op({ statut: 'Remboursée', type: 'Retrait' }),
    ], AUJOURDHUI)

    expect(resultat.ventes).toBe(2)
  })

  it('lit « Depot » sans accent comme « Dépôt » — d’anciennes lignes en portent', () => {
    const resultat = chiffresDuJour([
      op({ type: 'Depot' }),
      op({ type: 'RETRAIT' }),
    ], AUJOURDHUI)

    expect(resultat.depots).toBe(1)
    expect(resultat.retraits).toBe(1)
  })
})

describe('TC-172 — le chiffre d’affaires du jour', () => {
  it('ne somme QUE les opérations validées', () => {
    // C'est la sémantique de `CAChart`, reprise telle quelle : une opération non
    // terminée n'a rien encaissé, une remboursée a rendu ce qu'elle avait pris.
    const resultat = chiffresDuJour([
      op({ statut: 'Validée', montant: 1_000_000 }),
      op({ statut: 'Non Terminées', montant: 500_000 }),
      op({ statut: 'Remboursée', montant: 300_000 }),
      op({ statut: 'Annulée', montant: 900_000 }),
    ], AUJOURDHUI)

    expect(resultat.chiffreAffaires).toBe(1_000_000)
  })

  it('les deux nombres ne se déduisent PAS l’un de l’autre, et c’est voulu', () => {
    // Trois opérations au comptoir, une seule encaissée. Un jour comme celui-ci
    // affiche une activité superieure a ce que le chiffre d'affaires laisse
    // supposer : c'est la realite de la caisse, pas un defaut de calcul.
    const resultat = chiffresDuJour([
      op({ statut: 'Validée', montant: 250_000 }),
      op({ statut: 'Non Terminées', montant: 400_000 }),
      op({ statut: 'Non Terminées', montant: 150_000, type: 'Retrait' }),
    ], AUJOURDHUI)

    expect(resultat.ventes).toBe(3)
    expect(resultat.chiffreAffaires).toBe(250_000)
  })

  it('un montant formaté avec une espace n’est PAS encaissé de travers', () => {
    // ⚠ `parseFloat('12 000')` rend 12 — il s'arrête a la premiere espace, et
    // encaisserait un montant faux de trois ordres de grandeur, en silence.
    // `Number('12 000')` rend NaN, qu'on ecarte franchement.
    const resultat = chiffresDuJour([
      op({ montant: '12 000' }),
      op({ montant: 8000 }),
    ], AUJOURDHUI)

    expect(resultat.chiffreAffaires).toBe(8000)
  })

  it('lit un montant en chaîne de chiffres — il en vient parfois de Firestore', () => {
    const resultat = chiffresDuJour([op({ montant: '45000' })], AUJOURDHUI)

    expect(resultat.chiffreAffaires).toBe(45000)
  })
})

describe('TC-172 — le silence plutôt qu’un chiffre faux', () => {
  it.each([[undefined], [null], [[]], ['beaucoup'], [{}]])(
    'transactions %p → tout à zéro',
    (transactions) => {
      expect(chiffresDuJour(transactions, AUJOURDHUI)).toEqual({
        ventes: 0, depots: 0, retraits: 0, chiffreAffaires: 0,
      })
    },
  )

  it('une horloge illisible ne fabrique pas un jour au hasard', () => {
    expect(chiffresDuJour([op()], new Date('pas une date'))).toEqual({
      ventes: 0, depots: 0, retraits: 0, chiffreAffaires: 0,
    })
  })

  it('une ligne sans date, ou avec une date illisible, est ignorée', () => {
    const resultat = chiffresDuJour([
      op({ date: undefined }),
      op({ date: 'hier' }),
      op(),
    ], AUJOURDHUI)

    expect(resultat.ventes).toBe(1)
  })

  it('une ligne nulle dans le tableau ne fait pas tomber le calcul', () => {
    // Les listes viennent d'un abonnement Firestore : un trou y est possible, et
    // une exception ici viderait tout le tableau de bord.
    const resultat = chiffresDuJour([null, op(), undefined], AUJOURDHUI)

    expect(resultat.ventes).toBe(1)
  })
})
