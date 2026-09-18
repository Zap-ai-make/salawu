import { IS_REGISTRE } from '../../constants/designSystem.js'

/**
 * ConventionDeSigne — la phrase sans laquelle le signe ment.
 * ─────────────────────────────────────────────────────────────────────────────
 * Un dépôt fait ENTRER des espèces en caisse et SORTIR du stock électronique.
 * Les deux sont vrais en même temps. Un « − » posé devant un montant ne dit donc
 * rien tant qu'on n'a pas dit DE QUELLE GRANDEUR il parle — et selon la réponse,
 * le même signe désigne deux mouvements opposés.
 *
 * Décision du client, 2026-09-18 : le signe suit le STOCK ÉLECTRONIQUE, sur
 * Transactions comme sur Historique. Cette phrase l'annonce sur chaque écran qui
 * affiche ces signes.
 *
 * ⚠ UN SEUL COMPOSANT, ET C'EST LE POINT. Écrire la phrase à la main sur deux
 * écrans, c'est garantir qu'elle divergera : l'un sera corrigé, l'autre oublié,
 * et le produit annoncera deux conventions pour un seul signe. La maquette en
 * porte d'ailleurs DEUX versions différentes (« l'effet sur le stock
 * électronique » et « l'effet sur la caisse ») — ce qui est cohérent chez elle,
 * puisqu'elle assume deux grandeurs, et ne le serait plus ici.
 *
 * ⚠ ELLE NE S'AFFICHE QUE SOUS L'IDENTITÉ « REGISTRE ». TAOFIC n'affiche aucun
 * signe : lui annoncer une convention qu'il n'applique pas serait pire que le
 * silence.
 */
function ConventionDeSigne() {
  if (!IS_REGISTRE) return null

  return (
    <p data-convention>
      Le signe dit l&apos;effet sur le <b>stock électronique</b> : un dépôt fait
      sortir le stock <b>−</b>, un retrait l&apos;y fait rentrer <b>+</b>.
    </p>
  )
}

export default ConventionDeSigne
