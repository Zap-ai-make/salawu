/**
 * TC-175 — une encre sombre ne se pose pas sur un fond sombre.
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CE FILET GARDE, ET COMMENT IL EST NÉ
 *
 * La refonte a remplacé, dans tout le produit, les gris pâles de Tailwind par
 * `--encre-doux`. C'était juste presque partout : `text-gray-400` sur blanc ne
 * tient que 2,54:1, là où `--encre-doux` en tient 6,00.
 *
 * Ce ne l'était pas sur les trois infobulles de graphique, qui se posent sur
 * `bg-gray-900` :
 *
 *     avant   text-gray-300 sur gray-900   12,05:1
 *     avant   text-gray-400 sur gray-900    6,82:1
 *     après   --encre-doux sur gray-900     2,96:1   ✗ sous les 4,5:1 exigés
 *
 * ⚠ NI LA SUITE NI LE BANC NE POUVAIENT LE VOIR. jsdom ne calcule aucune
 * couleur ; et une infobulle n'apparaît qu'au SURVOL, alors que le scan axe lit
 * la page statique. Le défaut a été trouvé en comparant le CSS CONSTRUIT entre
 * `main` et cette branche, à la recherche de ce que TAOFIC pouvait recevoir.
 *
 * ⚠ ET IL ATTEIGNAIT TAOFIC, qui est en production : `text-encre-doux` est un
 * utilitaire NON PORTÉ, et ces composants sont rendus par les deux profils.
 *
 * CE QU'IL VÉRIFIE, ET CE QU'IL NE VÉRIFIE PAS
 *
 * Il lit le SOURCE, pas les pixels : un fond posé par une variable ou calculé à
 * l'exécution lui échappe. C'est assumé. Il attrape la faute qui s'est produite,
 * et il la rattrapera au prochain remplacement global — ce qui est exactement ce
 * qu'on lui demande.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const RACINE = join(process.cwd(), 'src')

/** Les fonds sombres écrits en clair dans le produit. */
const FONDS_SOMBRES = ['bg-gray-900', 'bg-gray-800', 'bg-encre', 'bg-black']

/** Les encres de la palette destinées à un fond CLAIR. */
const ENCRES_SOMBRES = ['text-encre-doux', 'text-encre', 'text-brand-600', 'text-filet']

function fichiersJsx(dossier) {
  const trouves = []
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree)
    if (statSync(chemin).isDirectory()) trouves.push(...fichiersJsx(chemin))
    else if (/\.(jsx|js)$/.test(entree)) trouves.push(chemin)
  }
  return trouves
}

/**
 * Découpe grossièrement les attributs `className` d'un fichier. On ne cherche
 * pas à parser du JSX : on veut les chaînes de classes, et elles suivent
 * toujours `className=` entre guillemets ou accents graves.
 */
function listesDeClasses(source) {
  const listes = []
  const motif = /className=\{?[`'"]([^`'"]*)[`'"]/g
  let m
  while ((m = motif.exec(source)) !== null) listes.push(m[1])
  return listes
}

const contient = (classes, mot) => new RegExp(`(^|\\s)${mot}(\\s|$)`).test(classes)

describe('TC-175 — aucune encre sombre sur un fond sombre', () => {
  const fichiers = fichiersJsx(RACINE)

  it('parcourt bien le produit (garde-fou du filet lui-même)', () => {
    // Un filet qui ne lit aucun fichier est vert pour rien. C'est le même piège
    // que le faux vert de la suite, et il se ferme de la même façon : un
    // décompte, vérifié.
    expect(fichiers.length).toBeGreaterThan(80)
  })

  /**
   * ⚠ LA PORTÉE DE CE CAS A ÉTÉ ÉLARGIE, parce que sa première version n'aurait
   * PAS attrapé le défaut qu'elle prétend garder.
   *
   * Elle cherchait le fond et l'encre dans le MÊME attribut `className`. Or dans
   * les trois infobulles, le fond était sur le `<div>` parent et l'encre sur le
   * `<p>` enfant : deux attributs distincts. Un filet incapable de rougir sur le
   * cas qui l'a fait naître ne garde rien.
   *
   * On raisonne donc par FICHIER. C'est plus grossier — un composant qui porte
   * légitimement les deux sur des éléments éloignés serait un faux positif — et
   * c'est le prix à payer pour attraper la vraie faute. Ajouter un fichier aux
   * exceptions demande de MESURER le contraste réel et de l'écrire à côté.
   */
  it('ne pose jamais --encre-doux (ni --encre) dans un composant à fond sombre', () => {
    const EXCEPTIONS_MESUREES = []

    const fautes = []
    for (const chemin of fichiers) {
      const court = chemin.slice(process.cwd().length).split('\\').join('/')
      if (EXCEPTIONS_MESUREES.includes(court)) continue

      const classes = listesDeClasses(readFileSync(chemin, 'utf8')).join(' ')
      const fond = FONDS_SOMBRES.find((f) => contient(classes, f))
      const encre = ENCRES_SOMBRES.find((e) => contient(classes, e))
      if (fond && encre) fautes.push(`${court} : « ${encre} » avec « ${fond} »`)
    }

    expect(fautes, `encre sombre dans un composant à fond sombre :\n${fautes.join('\n')}`)
      .toEqual([])
  })

  it('⚠ les trois infobulles de graphique gardent une encre CLAIRE', () => {
    // Elles portent le défaut d'origine : ce cas les nomme, pour qu'un futur
    // remplacement global ne les reprenne pas au passage. Leur fond reste
    // `bg-gray-900` — c'est du chrome de graphique, partagé avec TAOFIC.
    const infobulles = [
      'components/dashboard/shared/ChartTooltip.jsx',
      'components/dashboard/Charts/NetworkChart.jsx',
      'components/dashboard/TransactionsTodayChart.jsx',
    ]
    for (const rel of infobulles) {
      const classes = listesDeClasses(
        readFileSync(join(RACINE, ...rel.split('/')), 'utf8'),
      ).join(' ')
      expect(classes, `${rel} doit garder son fond sombre`).toContain('bg-gray-900')
      expect(
        /text-gray-(300|400)/.test(classes),
        `${rel} doit porter une encre claire sur son fond sombre`,
      ).toBe(true)
    }
  })
})
