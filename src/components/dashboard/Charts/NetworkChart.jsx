import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { useContext, useMemo } from 'react'
import { ClientsContext } from '../../../context/ClientsContext.jsx'
import { NETWORK_OPTIONS } from '../../../utils/constants'
import { NETWORK_CONFIG } from '../../../constants/networkConfig'
import { repartitionParReseau, totalDesParts } from '../../../utils/repartitionReseaux.js'
import { IS_REGISTRE } from '../../../constants/designSystem.js'
import AnneauDesReseaux from '../AnneauDesReseaux.jsx'

function NetworkChart() {
  const { clients } = useContext(ClientsContext)

  /**
   * ⚠ CE CALCUL NE CONNAIT PLUS UN SEUL RESEAU — décision du client, 2026-09-18.
   *
   * Il comptait `client.orange` et rien d'autre, écrit en dur. C'était juste
   * pour un profil mono-réseau et faux pour ESAHAF, qui en déclare six : l'écran
   * annonçait « Répartition par réseau » en taisant cinq parts sur six.
   *
   * La règle vit dans `utils/repartitionReseaux.js`, pure et testée (TC-173).
   * Elle parcourt les réseaux DU PROFIL — il n'y a donc aucun `if` de client
   * ici : TAOFIC déclare `['Orange']` et obtient exactement une part Orange,
   * comptée exactement comme avant. Son rendu ne change pas parce que ses
   * DONNÉES n'ont pas changé, et non parce qu'une condition l'aurait épargné.
   */
  const repartition = useMemo(
    () => repartitionParReseau(clients, NETWORK_OPTIONS),
    [clients],
  )
  const totalParts = useMemo(() => totalDesParts(repartition), [repartition])

  /**
   * La forme attendue par recharts, pour le rendu historique UNIQUEMENT. Le
   * filtre `value > 0` est CONSERVÉ ici : l'ancien calcul l'appliquait, et le
   * retirer changerait ce que TAOFIC affiche quand un réseau est à zéro.
   * L'identité « registre », elle, garde les zéros — c'est le tableau qui les
   * dit, et un réseau sans client est l'information qui fait agir.
   */
  const data = useMemo(
    () => repartition
      .filter((part) => part.clients > 0)
      .map((part) => ({
        name: part.nom,
        value: part.clients,
        color: NETWORK_CONFIG[part.nom]?.color || '#5b6470',
      })),
    [repartition],
  )

  const CustomLegend = ({ payload }) => {
    return (
      <div className="flex flex-col space-y-2 text-sm">
        {payload.map((entry, index) => {
          const networkData = data.find(d => d.name === entry.value)
          return (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center">
                <div
                  className="w-4 h-4 rounded mr-2"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-gray-700">{entry.value}</span>
              </div>
              <span className="text-gray-600 text-xs ml-2">
                {networkData ? networkData.value : 0} clients
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-gray-900 border border-gray-600 rounded-lg p-3 shadow-lg">
          <p className="text-white font-semibold">{data.name}</p>
          <p className="text-gray-300">
            <span className="text-blue-400">{data.value}</span> clients
          </p>
          <p className="text-gray-400 text-sm">
            {data.value > 0 ? `${((data.value / clients.length) * 100).toFixed(1)}% du total` : 'Aucun client'}
          </p>
        </div>
      )
    }
    return null
  }

  /**
   * ⚠ LE CADRE EST PARTAGÉ, LE CONTENU NE L'EST PAS.
   *
   * La surface, son bandeau de titre et son marqueur sont communs aux deux
   * identités — c'est du restylage, déjà acquis au lot L8.1d. Ce qu'elle
   * CONTIENT diverge, et cette fois un `IS_REGISTRE` est nécessaire : il ne
   * s'agit plus d'apparence mais de deux arbres de rendu différents, que le CSS
   * ne peut pas produire l'un depuis l'autre.
   *
   * TAOFIC garde son `PieChart` recharts au pixel près. Le bloc « registre » le
   * remplace par un anneau tracé à la main, DOUBLÉ d'un tableau nom / clients /
   * part — « l'anneau n'est jamais la seule lecture » (maquette). Sa hauteur est
   * libre : `h-64` et `calc(100% - 60px)` étaient la contrainte qui rognait
   * l'anneau de recharts, et le bloc registre n'en a pas besoin.
   */
  if (IS_REGISTRE) {
    return (
      <div data-surface="graphique" className="bg-gradient-to-br from-green-50 to-white rounded-xl shadow-sm border border-green-100">
        <div data-bloc-titre className="flex items-center space-x-3">
          <div data-vignette className="h-8 w-8 bg-green-100 rounded-lg flex items-center justify-center">
            <div className="h-4 w-4 bg-green-500 rounded-sm"></div>
          </div>
          <h3 className="text-green-800 text-lg font-semibold">Répartition par réseau</h3>
        </div>
        <AnneauDesReseaux
          repartition={repartition}
          totalParts={totalParts}
          nombreDeClients={clients.length}
        />
        {/* La note de la maquette, et elle n'est pas décorative : sans elle, un
            gérant qui additionne les parts et tombe au-dessus de son nombre de
            clients croit à une erreur de comptage. */}
        <p data-bloc-note>
          Un client présent sur plusieurs réseaux est compté dans chacun : la
          somme des parts peut donc dépasser le nombre de clients.
        </p>
      </div>
    )
  }

  return (
    // `data-surface="graphique"` : ce bloc se rembourre LUI-MÊME (`p-6`), là où
    // celui des derniers clients laisse ses enfants le faire. Ce n'est pas le
    // même objet, et son bandeau de titre ne se pose pas de la même façon —
    // src/index.css en tient compte.
    <div data-surface="graphique" className="bg-gradient-to-br from-green-50 to-white rounded-xl shadow-sm border border-green-100 p-6 h-64">
      <div data-bloc-titre className="flex items-center space-x-3 mb-4">
        <div data-vignette className="h-8 w-8 bg-green-100 rounded-lg flex items-center justify-center">
          <div className="h-4 w-4 bg-green-500 rounded-sm"></div>
        </div>
        <h3 className="text-green-800 text-lg font-semibold">Répartition par réseau</h3>
      </div>
      <div className="flex items-center justify-between" style={{ height: 'calc(100% - 60px)' }}>
        <ResponsiveContainer width="60%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="w-40%">
          <CustomLegend payload={data.map((item) => ({
            value: item.name,
            color: item.color
          }))} />
        </div>
      </div>
    </div>
  )
}

export default NetworkChart
