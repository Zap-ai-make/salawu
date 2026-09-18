import { useMemo } from 'react'
import DashboardCard from '../ui/DashboardCard'
import { getColorTheme } from '../../constants/dashboardTheme'
import { formatAmount } from '../../constants/networkConfig'
import { chiffresDuJour } from '../../utils/chiffresDuJour.js'

/**
 * ChiffresDuJour — les deux nombres qu'un gérant demande en fin de journée.
 * ─────────────────────────────────────────────────────────────────────────────
 * L'activité du jour, et l'argent entré. Ils ne figuraient nulle part sur
 * l'accueil : il fallait aller les chercher dans l'historique, pendant que
 * quatre graphiques d'analyse occupaient la hauteur d'écran.
 *
 * CE COMPOSANT NE CALCULE RIEN. La règle vit dans `utils/chiffresDuJour.js`,
 * pure et testée (TC-172), avec son horloge injectée. Un `useMemo` au fond d'un
 * composant ne s'éprouve pas : on ne peut ni lui passer un jour, ni vérifier
 * qu'il compte les bons statuts.
 *
 * ⟲ RELEVÉ AU LOT L8.1c, TRANCHÉ AU POINT 9 (LA SIGNATURE).
 * Sur une tuile large, la réglure tombait au bord gauche du bloc pendant que le
 * nombre restait aligné à droite : l'écart valait la largeur de la tuile moins
 * celle du nombre, et CROISSAIT avec l'écran. Le trait ne bordait plus une
 * colonne de montants, il flottait seul. `src/index.css` donne désormais aux
 * porteurs hors tableau la largeur de leur contenu
 * (`[data-montant]:not(td):not(th)`), ce qui rend au trait sa distance de
 * cellule à toutes les largeurs.
 *
 * ⚠ LES DEUX NOMBRES NE SE DÉDUISENT PAS L'UN DE L'AUTRE, et c'est voulu.
 * L'activité compte tout ce qui s'est passé au comptoir sauf les annulations ;
 * le chiffre d'affaires ne compte que les opérations validées. Un jour avec des
 * opérations en attente affichera donc une activité supérieure à ce que le
 * chiffre d'affaires laisse supposer. C'est la réalité de la caisse — la note
 * de `chiffresDuJour.js` explique pourquoi ce n'est pas une incohérence.
 */
function ChiffresDuJour({ transactions }) {
  const { ventes, depots, retraits, chiffreAffaires } = useMemo(
    () => chiffresDuJour(transactions),
    [transactions],
  )

  const bleu = getColorTheme('blue')
  const vert = getColorTheme('green')

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <DashboardCard colorName="blue" height="auto" hover={true} className="min-h-[120px]">
        <h3 className={`text-sm font-medium ${bleu.accent} mb-3`}>Ventes du jour</h3>
        {/* `data-nombre` et non `data-montant` : c'est un DÉCOMPTE, pas de
            l'argent. La réglure verticale désigne l'argent et rien d'autre —
            posée sur un compteur, elle cesserait de désigner quoi que ce soit
            (src/index.css, § « LE FILET DU REGISTRE »). */}
        <div data-nombre className={`text-3xl font-bold ${bleu.title}`}>
          {ventes}
        </div>
        <p className={`text-xs ${bleu.accent} mt-1`}>
          {depots} dépôt{depots > 1 ? 's' : ''} · {retraits} retrait{retraits > 1 ? 's' : ''}
        </p>
      </DashboardCard>

      <DashboardCard colorName="green" height="auto" hover={true} className="min-h-[120px]">
        <h3 className={`text-sm font-medium ${vert.accent} mb-3`}>Chiffre d'affaires du jour</h3>
        {/* `data-montant` : celui-ci EST de l'argent en FCFA. Il reçoit donc les
            chiffres tabulaires et la réglure, comme tous les montants du
            produit. */}
        <div data-montant className={`text-3xl font-bold ${vert.title}`}>
          {formatAmount(chiffreAffaires)}
        </div>
        <p className={`text-xs ${vert.accent} mt-1`}>
          FCFA, tous réseaux confondus
        </p>
      </DashboardCard>
    </div>
  )
}

export default ChiffresDuJour
