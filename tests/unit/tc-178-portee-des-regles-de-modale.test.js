/**
 * TC-178 — aucune règle de modale n'échappe à sa portée.
 * ─────────────────────────────────────────────────────────────────────────────
 * LA FUITE QUI A FAIT NAÎTRE CE FILET
 *
 * Le lot L9.6 a marqué les modales de l'espace boutique (`data-modale`,
 * `data-modale-voile`) et les a habillées depuis `src/index.css`. La première
 * portée écrite était :
 *
 *     .design-registre [data-modale] { … }
 *
 * Elle est FAUSSE, et pas d'un cheveu. `.design-registre` est posée sur `<html>`
 * : elle couvre TOUT ESAHAF, espaces dealer et gérant compris. Or
 * `RejectionRemarkButton` — dont la modale porte le marqueur — est rendu par
 * `DealerDashboard`, `DealerHistory` ET `DealerRequests`. La règle serait donc
 * allée restyler trois écrans que la consigne du client met hors chantier
 * (« la maquette ne concerne pas dealer et gérant »).
 *
 * ⚠ ET LA PORTÉE ÉVIDENTE NE MARCHE PAS NON PLUS. `[data-espace='boutique']`
 * seule manque `ReceiptModal`, qui rend par `createPortal` dans `document.body`
 * — donc hors de `<main>`. Onze modales sur douze auraient été habillées, en
 * silence.
 *
 * Les deux erreurs sont symétriques : l'une déborde, l'autre n'atteint pas.
 * La forme juste est la réunion des deux cas, et c'est elle que ce filet tient.
 *
 * CE QU'IL VÉRIFIE
 *
 * Toute règle de `src/index.css` dont le sélecteur mentionne un marqueur de
 * modale doit être bornée, soit par `[data-espace='boutique']`, soit par
 * `[data-portail]`. Rien d'autre.
 *
 * ⚠ CE QU'IL NE VÉRIFIE PAS. Il lit le TEXTE de la feuille, pas le rendu. Il ne
 * dira pas si une règle bornée atteint bien sa cible — c'est le travail du banc
 * (`ecrans-authentifies.spec.js`, les deux contrôles de modale), qui mesure des
 * pixels dans un vrai navigateur. Les deux sont nécessaires : celui-ci empêche
 * la portée de déborder, l'autre vérifie qu'elle porte.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const FEUILLE = join(process.cwd(), 'src', 'index.css')

/** Les marqueurs posés par le lot L9.6. */
const MARQUEURS = /\[data-modale(-voile)?\]/

/** Les deux seules bornes admises. */
const BORNES = [/\[data-espace='boutique'\]/, /\[data-portail\]/]

/**
 * Découpe la feuille en sélecteurs. On ne parse pas du CSS : on retire les
 * commentaires — sans quoi les explications, qui CITENT les sélecteurs fautifs,
 * seraient comptées comme des règles — puis on lit ce qui précède chaque `{`.
 *
 * ⚠ C'est exactement le piège qui avait fait compter 46 phrases de vide au lieu
 * de 27 dans la sonde de vocabulaire. Une sonde qui lit ses propres
 * avertissements se dénonce elle-même.
 */
function selecteurs(css) {
  const sansCommentaires = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const trouves = []
  for (const bloc of sansCommentaires.split('}')) {
    const avant = bloc.split('{')[0]
    if (!avant || !avant.trim()) continue
    for (const sel of avant.split(',')) {
      const propre = sel.trim().replace(/\s+/g, ' ')
      if (propre) trouves.push(propre)
    }
  }
  return trouves
}

describe('TC-178 — la portée des règles de modale', () => {
  const css = readFileSync(FEUILLE, 'utf8')
  const tous = selecteurs(css)

  it('lit bien la feuille (garde-fou du filet lui-même)', () => {
    // Un filet qui ne lit aucun sélecteur est vert pour rien.
    expect(tous.length).toBeGreaterThan(50)
    expect(tous.some((s) => MARQUEURS.test(s))).toBe(true)
  })

  it('chaque règle de modale est bornée à la boutique ou à un portail', () => {
    const horsPortee = tous
      .filter((s) => MARQUEURS.test(s))
      .filter((s) => !BORNES.some((b) => b.test(s)))

    expect(
      horsPortee,
      'une règle de modale sans borne : elle atteindrait aussi les espaces\n' +
        'dealer et gérant, que la consigne du client met hors chantier.\n' +
        'Borner par `[data-espace="boutique"]`, ou par `[data-portail]` si la\n' +
        'modale sort du DOM par `createPortal` :\n' +
        horsPortee.join('\n'),
    ).toEqual([])
  })

  it('⚠ les DEUX cas sont couverts, et pas seulement le plus simple', () => {
    // Sans ce cas, retirer toutes les règles `[data-portail]` laisserait le cas
    // précédent vert — et `ReceiptModal`, qui est la modale la plus visible de
    // l'historique, cesserait d'être habillée sans que rien ne le dise.
    const deModale = tous.filter((s) => MARQUEURS.test(s))
    expect(
      deModale.some((s) => /\[data-espace='boutique'\]/.test(s)),
      'aucune règle ne couvre les modales rendues DANS <main>',
    ).toBe(true)
    expect(
      deModale.some((s) => /\[data-portail\]/.test(s)),
      'aucune règle ne couvre les modales sorties par createPortal',
    ).toBe(true)
  })
})
