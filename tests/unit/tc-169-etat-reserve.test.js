/**
 * TC-169 — L'état d'une réserve réseau (règle métier, lot L7.4).
 *
 * Le seuil de stock bas a été fixé par le client le 2026-09-16 : 100 000 FCFA.
 * C'est une RÈGLE, pas un réglage d'apparence — le mot rendu fait agir un
 * caissier. Ce fichier verrouille les bornes, les cas limites et, surtout, le
 * comportement quand le seuil ou la donnée manquent.
 *
 * Aucune assertion sur une couleur : uniquement sur le MOT et sur la clé d'état.
 */

import { describe, it, expect } from 'vitest'
import { etatDeLaReserve, ETATS_RESERVE } from '../../src/utils/etatReserve.js'

const SEUIL = 100_000

describe('TC-169 — les trois états, et leurs bornes exactes', () => {
  it.each([
    [0, 'Épuisé'],
    [1, 'Bas'],
    [12_300, 'Bas'],
    [99_999, 'Bas'],
    [100_000, 'Stock'],
    [100_001, 'Stock'],
    [1_250_000, 'Stock'],
  ])('%d FCFA → « %s »', (stock, mot) => {
    expect(etatDeLaReserve(stock, SEUIL).mot).toBe(mot)
  })

  it('le seuil lui-même est du bon côté : 100 000 est « Stock », pas « Bas »', () => {
    // La borne est le seul endroit où une règle de comparaison se trompe, et
    // elle se trompe silencieusement. `<` et non `<=` : une boutique qui a
    // exactement son seuil n'est pas en difficulté.
    expect(etatDeLaReserve(SEUIL, SEUIL)).toBe(ETATS_RESERVE.NORMAL)
    expect(etatDeLaReserve(SEUIL - 1, SEUIL)).toBe(ETATS_RESERVE.BAS)
  })

  it('zéro est « Épuisé » et non « Bas » — ce n’est pas le même geste', () => {
    // « Bas » veut dire « pense à te réapprovisionner » ; « Épuisé » veut dire
    // « tu ne peux plus servir ce réseau ». Les confondre ferait accepter une
    // opération impossible.
    expect(etatDeLaReserve(0, SEUIL)).toBe(ETATS_RESERVE.EPUISE)
  })

  it('un montant négatif reste « Épuisé », il ne franchit pas la borne par le bas', () => {
    expect(etatDeLaReserve(-5000, SEUIL).mot).toBe('Épuisé')
  })
})

describe('TC-169 — absence de seuil : aucun mot, et c’est voulu', () => {
  it.each([[undefined], [null], ['100000'], [Number.NaN], [Number.POSITIVE_INFINITY]])(
    'seuil %p → aucun état',
    (seuil) => {
      // C'est ce qui garde TAOFIC strictement inchangé : son profil ne déclare
      // pas `networks.seuilStockBas`, donc sa bande n'affiche aucun mot d'état.
      // Aucune valeur par défaut n'est inventée — un seuil deviné se trompe pour
      // toutes les boutiques sauf une.
      expect(etatDeLaReserve(250_000, seuil)).toBeNull()
    },
  )
})

describe('TC-169 — donnée illisible : le silence plutôt qu’un mensonge', () => {
  it.each([[undefined], [null], [''], ['   '], ['beaucoup'], [Number.NaN], [{}], [true]])(
    'stock %p → aucun état',
    (stock) => {
      // Une valeur absente n'est PAS zéro. Annoncer « Épuisé » sur une donnée
      // qu'on n'a pas su lire enverrait le caissier se réapprovisionner d'un
      // stock qui existe peut-être. Le repli honnête est de ne rien dire.
      //
      // ⚠ `null` et `''` sont ici pour une raison précise : `Number(null)` et
      // `Number('')` valent tous deux ZÉRO. La première version de la règle se
      // contentait de `Number.isFinite` et rendait donc « Épuisé » sur une
      // donnée manquante. Ce test l'a attrapé avant le premier rendu.
      expect(etatDeLaReserve(stock, SEUIL)).toBeNull()
    },
  )

  it('une chaîne numérique reste lue — elle vient parfois de Firestore', () => {
    expect(etatDeLaReserve('5000', SEUIL).mot).toBe('Bas')
    expect(etatDeLaReserve('250000', SEUIL).mot).toBe('Stock')
  })
})

describe('TC-169 — le mot ne dépend jamais de la couleur seule', () => {
  it('chaque état porte un mot non vide et une clé distincte', () => {
    const etats = [ETATS_RESERVE.EPUISE, ETATS_RESERVE.BAS, ETATS_RESERVE.NORMAL]

    for (const etat of etats) {
      expect(etat.mot.trim().length, `l’état ${etat.cle} doit être écrit`).toBeGreaterThan(0)
    }
    expect(new Set(etats.map((e) => e.cle)).size).toBe(3)
    expect(new Set(etats.map((e) => e.mot)).size).toBe(3)
  })
})
