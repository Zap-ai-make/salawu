import { NETWORK_CONFIG } from '../../constants/networkConfig'

/**
 * AnneauDesReseaux — la répartition, et jamais l'anneau tout seul.
 * ─────────────────────────────────────────────────────────────────────────────
 * « Chaque part est doublée du nom du réseau et de son compte : l'anneau n'est
 * jamais la seule lecture. » (docs/audit/maquette-espace-boutique.html)
 *
 * C'est la règle « aucune couleur ne porte seule une information », appliquée au
 * seul endroit du produit où elle est difficile : un graphique EST une couleur.
 * La réponse n'est pas de renoncer au graphique, c'est de le doubler — un
 * tableau nom / clients / part, et un `aria-label` qui énumère tout. Qui ne
 * distingue pas le violet du bleu lit le tableau ; qui n'a pas d'écran entend
 * l'étiquette ; qui voit l'anneau y trouve la forme d'un coup d'œil.
 *
 * ⚠ POURQUOI UN SVG ÉCRIT À LA MAIN PLUTÔT QUE recharts.
 * Ce n'est pas une préférence. Le `PieChart` posait `outerRadius={80}`, soit
 * 160 px de diamètre, dans un conteneur mesuré à 146 px : l'anneau était rogné
 * de 7 px en haut et en bas, ce que le dégradé vert masquait. Il exigeait un
 * `ResponsiveContainer`, donc un `ResizeObserver` — absent de jsdom, et qu'il
 * fallait donc simuler pour monter cet écran en test. Et son SVG ne porte ni
 * rôle ni étiquette : il est muet pour un lecteur d'écran.
 *
 * Un cercle tracé au trait épais règle les trois à la fois. `stroke-dasharray`
 * découpe la circonférence en segments : c'est la technique classique du
 * « donut », et elle a l'avantage de gérer sans cas particulier la part à 100 %
 * (qu'un chemin d'arc ne sait pas fermer) comme la part à 0 % (qui ne dessine
 * simplement rien).
 *
 * recharts RESTE une dépendance du projet : TAOFIC rend quatre autres
 * graphiques avec. Ce composant ne le remplace nulle part ailleurs.
 */

// Géométrie de la maquette : 184×184, rayon extérieur 74, intérieur 42.
// Le trait est donc épais de 32 et son axe passe au rayon 58.
const TAILLE = 184
const CENTRE = TAILLE / 2
const RAYON = 58
const EPAISSEUR = 32
const CIRCONFERENCE = 2 * Math.PI * RAYON

/** Le pourcentage affiché, à une décimale, à la française. */
function partEnPourcent(valeur, total) {
  if (!total) return '0,0 %'
  return `${((valeur / total) * 100).toFixed(1).replace('.', ',')} %`
}

function couleurDe(nom) {
  return NETWORK_CONFIG[nom]?.color || '#5b6470'
}

function AnneauDesReseaux({ repartition, totalParts, nombreDeClients }) {
  const parts = repartition.filter((p) => p.clients > 0)

  /**
   * L'étiquette énumère TOUT, zéros compris. C'est la seule lecture disponible
   * pour qui n'a pas d'écran, et un réseau sans client est précisément ce qu'on
   * veut savoir — le taire ici rendrait l'anneau plus informatif que sa
   * description, ce qui est l'inverse du but.
   */
  const etiquette = repartition.length
    ? `Répartition de ${nombreDeClients} client${nombreDeClients > 1 ? 's' : ''} par réseau : `
      + repartition.map((p) => `${p.nom} ${p.clients}`).join(', ') + '.'
    : 'Aucun réseau déclaré.'

  // Chaque segment part là où le précédent s'arrête. `stroke-dashoffset` est
  // compté à rebours : d'où le cumul négatif.
  let cumul = 0

  return (
    <div data-anneau className="flex flex-wrap items-center gap-4 p-4">
      <svg
        width={TAILLE}
        height={TAILLE}
        viewBox={`0 0 ${TAILLE} ${TAILLE}`}
        role="img"
        aria-label={etiquette}
        className="flex-none"
      >
        {/* Le fond de l'anneau : sans lui, une répartition vide ne dessine rien
            du tout et l'écran paraît cassé plutôt que vide. */}
        <circle
          cx={CENTRE}
          cy={CENTRE}
          r={RAYON}
          fill="none"
          stroke="var(--color-reglure)"
          strokeWidth={EPAISSEUR}
        />
        {parts.map((part) => {
          const longueur = totalParts ? (part.clients / totalParts) * CIRCONFERENCE : 0
          const decalage = -cumul
          cumul += longueur
          return (
            <circle
              key={part.nom}
              cx={CENTRE}
              cy={CENTRE}
              r={RAYON}
              fill="none"
              stroke={couleurDe(part.nom)}
              strokeWidth={EPAISSEUR}
              strokeDasharray={`${longueur} ${CIRCONFERENCE - longueur}`}
              strokeDashoffset={decalage}
              /* Le tracé commence à midi, comme on lit une horloge. Sans cette
                 rotation, il commencerait à 3 h — la convention de SVG, pas
                 celle d'un lecteur. */
              transform={`rotate(-90 ${CENTRE} ${CENTRE})`}
            />
          )
        })}
        <text
          x={CENTRE}
          y={CENTRE - 2}
          textAnchor="middle"
          data-anneau-nombre
        >
          {nombreDeClients}
        </text>
        <text x={CENTRE} y={CENTRE + 16} textAnchor="middle" data-anneau-mot>
          client{nombreDeClients > 1 ? 's' : ''}
        </text>
      </svg>

      <table className="flex-1 min-w-0 basis-56 w-full border-collapse">
        <thead>
          <tr>
            <th className="text-left">Réseau</th>
            <th data-nombre>Clients</th>
            <th data-nombre>Part</th>
          </tr>
        </thead>
        <tbody>
          {repartition.map((part) => (
            <tr key={part.nom}>
              <td>
                <span className="inline-flex items-center gap-2">
                  {/* `aria-hidden` : la pastille répète une couleur que le nom
                      juste à côté dit déjà en toutes lettres. L'annoncer une
                      seconde fois n'ajouterait rien. */}
                  <span
                    data-pastille
                    aria-hidden="true"
                    style={{ backgroundColor: couleurDe(part.nom) }}
                  />
                  {part.nom}
                </span>
              </td>
              <td data-nombre>{part.clients}</td>
              <td data-nombre>{partEnPourcent(part.clients, totalParts)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default AnneauDesReseaux
