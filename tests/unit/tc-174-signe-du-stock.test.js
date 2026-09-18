/**
 * TC-174 — le signe suit le stock électronique, et il ne ment pas.
 * ─────────────────────────────────────────────────────────────────────────────
 * Test de caractérisation exigé avant de toucher à ce que l'écran RAPPORTE
 * (CLAUDE.md). Décision du client, 2026-09-18, capture d'écran à l'appui :
 * un dépôt est précédé de « − », un retrait de « + », sur Transactions ET sur
 * Historique.
 *
 * CE QUI SE JOUE ICI. Un dépôt fait ENTRER des espèces et SORTIR du stock
 * électronique : les deux sont vrais. Le signe ne veut rien dire tant qu'on n'a
 * pas dit de quelle grandeur il parle — d'où la phrase de convention affichée
 * sur chaque écran, et vérifiée par les filets d'écran (TC-166, TC-167).
 *
 * Ce fichier ne vérifie que la RÈGLE. Elle est pure, sans horloge ni contexte,
 * et ne touche AUCUN calcul de solde : `financialImpact.js` reste seul maître
 * des montants réels.
 */

import { describe, it, expect } from 'vitest'
import { sensDuStock, montantSigne, SENS_STOCK } from '../../src/utils/signeDuStock.js'

/**
 * ⚠ `toLocaleString('fr-FR')` NE SÉPARE PAS LES MILLIERS PAR UNE ESPACE ORDINAIRE.
 *
 * Node rend une ESPACE INSÉCABLE ÉTROITE (U+202F). Mes premiers cas attendaient
 * « −1 250 000 » avec une espace ordinaire et rougissaient : le TEST avait tort,
 * pas le code. On normalise ici, une fois, plutôt que d'écrire le caractère exact
 * dans chaque attente — ce qui est vérifié est le REGROUPEMENT par milliers, non
 * l'octet choisi par Intl, qui peut changer d'une version de Node à l'autre.
 */
const lisible = (texte) => texte.replace(new RegExp('[\u202f\u00a0 ]', 'g'), ' ')

describe('TC-174 — le sens d\'une opération pour le stock', () => {
  it('un DÉPÔT fait SORTIR le stock : −', () => {
    expect(sensDuStock('Dépôt')).toBe(SENS_STOCK.SORTIE)
    expect(sensDuStock('Dépôt').signe).toBe('−')
  })

  it('un RETRAIT fait RENTRER le stock : +', () => {
    expect(sensDuStock('Retrait')).toBe(SENS_STOCK.ENTREE)
    expect(sensDuStock('Retrait').signe).toBe('+')
  })

  it('⚠ C\'EST L\'INVERSE DE LA LECTURE « CAISSE », et c\'est voulu', () => {
    // Un dépôt fait entrer des espèces en caisse — la lecture historique du
    // dépôt, encore portée par le vocabulaire de règlement (« Encaissé par… »).
    // Le signe affiché suit désormais le STOCK, pas la caisse : la ligne
    // « − Dépôt » porte donc un bouton « Encaisser », et les deux disent vrai.
    // Ce cas existe pour que personne ne « corrige » ce qui ressemble à un bug.
    expect(sensDuStock('Dépôt').signe).toBe('−')
    expect(sensDuStock('Retrait').signe).toBe('+')
  })

  it('un CRÉDIT ne déplace aucun stock : aucun signe', () => {
    // Une créance n'est pas un mouvement nul : elle n'est pas un mouvement du
    // tout. Un « 0 » laisserait croire à un déplacement de valeur zéro.
    expect(sensDuStock('Crédit')).toBe(SENS_STOCK.NEUTRE)
    expect(sensDuStock('Crédit').signe).toBe('')
  })

  it('tolère la casse, les accents et les espaces', () => {
    for (const forme of ['DÉPÔT', 'depot', ' Dépôt ', 'Depot']) {
      expect(sensDuStock(forme).signe, `« ${forme} » doit être un dépôt`).toBe('−')
    }
    for (const forme of ['RETRAIT', 'retrait', ' Retrait ']) {
      expect(sensDuStock(forme).signe, `« ${forme} » doit être un retrait`).toBe('+')
    }
  })

  it('ne casse pas sur une entrée absente ou inconnue', () => {
    expect(sensDuStock(null)).toBe(SENS_STOCK.NEUTRE)
    expect(sensDuStock(undefined)).toBe(SENS_STOCK.NEUTRE)
    expect(sensDuStock('')).toBe(SENS_STOCK.NEUTRE)
    expect(sensDuStock('Virement interplanétaire')).toBe(SENS_STOCK.NEUTRE)
  })
})

describe('TC-174 — le montant tel qu\'il s\'affiche', () => {
  it('préfixe un dépôt d\'un moins et un retrait d\'un plus', () => {
    expect(lisible(montantSigne(1250000, 'Dépôt'))).toBe('−1 250 000')
    expect(montantSigne(250, 'Retrait')).toBe('+250')
  })

  it('⚠ le signe est un MOINS TYPOGRAPHIQUE (U+2212), pas un trait d\'union', () => {
    // Ce n'est pas du purisme : dans IBM Plex Mono, le moins mathématique a la
    // largeur d'un chiffre, le trait d'union non. Une colonne qui mêle les deux
    // perd l'alignement tabulaire qui justifie toute la typographie des montants.
    const rendu = montantSigne(1000, 'Dépôt')
    expect(rendu.charCodeAt(0)).toBe(0x2212)
    expect(rendu.startsWith('-')).toBe(false)
  })

  it('sépare les milliers par une espace, à la française', () => {
    // `toLocaleString('fr-FR')` rend une espace insécable étroite (U+202F) sur
    // Node moderne. On vérifie le regroupement, pas l'octet exact.
    expect(lisible(montantSigne(3400000, 'Retrait')))
      .toBe('+3 400 000')
  })

  it('n\'ajoute aucun signe à un crédit', () => {
    expect(lisible(montantSigne(5000, 'Crédit'))).toBe('5 000')
  })

  it('⚠ prend la VALEUR ABSOLUE : le signe vient de la convention, pas de la donnée', () => {
    // Un montant stocké en négatif ne doit pas produire « −−1 250 000 ».
    expect(lisible(montantSigne(-1250000, 'Dépôt'))).toBe('−1 250 000')
    expect(montantSigne(-250, 'Retrait')).toBe('+250')
  })

  it('⚠ lit « 12 000 » comme douze mille, et non comme douze', () => {
    // `parseFloat('12 000')` rend 12 : il s'arrête à l'espace. Le piège a déjà
    // coûté un lot dans ce dépôt, d'où `Number` et ce cas pour l'y clouer.
    expect(lisible(montantSigne('12000', 'Retrait'))).toBe('+12 000')
    expect(lisible(montantSigne(12000, 'Retrait'))).toBe('+12 000')
  })

  it('rend une chaîne VIDE sur un montant absent ou illisible', () => {
    // Un tableau de caisse n'affiche jamais « NaN » ni « −NaN ».
    for (const rien of [null, undefined, '', 'abc', Number.NaN]) {
      expect(montantSigne(rien, 'Dépôt'), `« ${String(rien)} » doit rendre ''`).toBe('')
    }
  })

  it('⚠ ZÉRO NE SE SIGNE PAS — ce cas a trouvé un vrai défaut', () => {
    // À la première exécution, la règle rendait « −0 » : un moins devant rien, qui
    // annonce un mouvement là où il n'y en a aucun. Le signe dit un SENS de
    // déplacement ; sans déplacement, il n'a rien à dire.
    expect(montantSigne(0, 'Dépôt')).toBe('0')
    expect(montantSigne(0, 'Retrait')).toBe('0')
    expect(montantSigne('0', 'Dépôt')).toBe('0')
  })
})
