import { CHART_TEXT_COLORS } from '../../../constants/dashboardTheme'

/**
 * ⚠ SUR UN FOND SOMBRE, L'ENCRE DOIT ÊTRE CLAIRE — corrigé le 2026-09-18.
 *
 * Ces infobulles se posent sur `bg-gray-900`. Un passage global de la refonte a
 * remplacé leurs gris clairs par `text-encre-doux`, le jeton de texte secondaire
 * de l'identité — excellent sur du papier (6,00:1), illisible ici :
 *
 *     avant   text-gray-300 sur gray-900   12,05:1
 *     avant   text-gray-400 sur gray-900    6,82:1
 *     après   --encre-doux sur gray-900     2,96:1   ✗ sous les 4,5:1 exigés
 *
 * Le remplacement avait lieu partout à la fois, et il était JUSTE partout
 * ailleurs : `text-gray-400` sur blanc ne tient que 2,54:1, là où --encre-doux
 * en tient 6,00. Il ne l'était pas ici, parce que le fond est l'inverse.
 *
 * ⚠ ET LE BANC NE POUVAIT PAS LE VOIR : une infobulle n'apparaît qu'au SURVOL,
 * et le scan axe lit la page statique. C'est une comparaison du CSS construit
 * entre `main` et cette branche qui l'a trouvé — pas une capture.
 *
 * ⚠ CE DÉFAUT ATTEIGNAIT AUSSI TAOFIC. `text-encre-doux` est un utilitaire NON
 * PORTÉ, et ce composant est rendu par les deux profils. On restaure donc les
 * gris d'origine plutôt que d'inventer un jeton clair : c'est la correction qui
 * remet le client en production exactement où il était.
 */

function ChartTooltip({ active, payload, labelFormatter, valueFormatter, extraInfo }) {
  if (!active || !payload || !payload.length) {
    return null
  }

  const data = payload[0].payload

  return (
    <div className="bg-gray-900 border border-gray-600 rounded-lg p-3 shadow-lg">
      <p className="text-white font-semibold">
        {labelFormatter ? labelFormatter(data) : data.name}
      </p>
      <p className={`${CHART_TEXT_COLORS.primary} text-gray-300`}>
        <span className="text-blue-400">
          {valueFormatter ? valueFormatter(data.value) : data.value}
        </span>
        {extraInfo && ` ${extraInfo}`}
      </p>
      {data.percentage && (
        <p className={`${CHART_TEXT_COLORS.secondary} text-gray-400 text-sm`}>
          {data.percentage}% du total
        </p>
      )}
    </div>
  )
}

export default ChartTooltip