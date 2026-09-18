/**
 * repartitionReseaux.js — combien de clients sur chaque réseau.
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CETTE RÈGLE CORRIGE
 *
 * Le tableau de bord annonçait « Répartition par réseau » et n'en comptait
 * qu'UN. Le calcul était écrit en dur dans le composant :
 *
 *   const networkCounts = { Orange: 0 }
 *   clients.forEach(client => { if (client.orange) networkCounts.Orange++ })
 *
 * C'était juste pour TAOFIC, dont le profil ne déclare qu'Orange. ESAHAF en
 * déclare SIX, et l'écran taisait cinq parts sur six — sans message, sans zéro,
 * sans rien.
 *
 * ⚠ IL N'Y A AUCUN `if` DE CLIENT ICI, ET C'EST LE POINT.
 * La fonction parcourt les réseaux QU'ON LUI DONNE. Le composant lui passe
 * `NETWORK_OPTIONS`, qui vient du profil actif. TAOFIC déclare `['Orange']` :
 * il obtient donc exactement une part Orange, comptée exactement comme avant.
 * Son rendu ne change pas parce que ses DONNÉES n'ont pas changé, et non parce
 * qu'une condition l'aurait épargné. Une condition, il aurait fallu penser à la
 * retirer le jour où TAOFIC ouvre un deuxième réseau.
 *
 * ⚠ LA SOMME PEUT DÉPASSER LE NOMBRE DE CLIENTS, et ce n'est pas un bug.
 * Un client inscrit chez Orange ET Moov compte dans les deux : il EST sur les
 * deux réseaux. « Répartition par réseau » ne répartit pas des clients entre des
 * cases exclusives, elle dit combien de clients chaque réseau touche. Les deux
 * questions sont différentes, et c'est la seconde que pose un gérant qui veut
 * savoir où est son activité.
 *
 * ⚠ LES RÉSEAUX À ZÉRO SONT CONSERVÉS.
 * L'ancien calcul filtrait `value > 0`. Un réseau déclaré mais sans client est
 * une INFORMATION — c'est même celle qui fait agir. Le filtrer, c'est effacer la
 * question. La part de zéro n'est pas dessinable dans un anneau ; c'est au
 * tableau qui le double de la dire, avec son nom et son chiffre.
 *
 * La clé plate d'un client est le nom du réseau en minuscules
 * (`client.orange`, `client.moov`, …) : convention posée par `excelUtils.js`,
 * reprise ici plutôt que redéfinie.
 */

/**
 * Un client est « sur » un réseau s'il y porte un code agent non vide.
 *
 * Une chaîne d'espaces ne compte pas : les imports XLSM en produisent, et une
 * cellule vide d'Excel arrive volontiers comme `' '`. Un nombre compte, parce
 * qu'un code agent tout en chiffres peut être lu comme tel par le tableur.
 */
function porteUnCode(valeur) {
  if (valeur === null || valeur === undefined || valeur === false) return false
  if (typeof valeur === 'number') return Number.isFinite(valeur)
  if (typeof valeur !== 'string') return false
  return valeur.trim() !== ''
}

/**
 * @param {Array<object>} clients — la liste des clients de la boutique.
 * @param {Array<string>} reseaux — les réseaux DÉCLARÉS PAR LE PROFIL, dans
 *        l'ordre d'affichage voulu.
 * @returns {Array<{nom: string, clients: number}>} une entrée par réseau
 *          déclaré, dans l'ordre reçu, zéros compris.
 */
export function repartitionParReseau(clients, reseaux) {
  if (!Array.isArray(reseaux)) return []
  const liste = Array.isArray(clients) ? clients : []

  return reseaux.map((nom) => {
    const cle = String(nom).toLowerCase()
    let compte = 0
    for (const client of liste) {
      if (client && porteUnCode(client[cle])) compte += 1
    }
    return { nom, clients: compte }
  })
}

/**
 * Le total des PARTS, et non le nombre de clients — voir la note ci-dessus sur
 * les clients multi-réseaux. Sert à calculer un pourcentage de part d'anneau :
 * c'est bien la somme des parts qui en est le dénominateur, jamais l'effectif.
 */
export function totalDesParts(repartition) {
  if (!Array.isArray(repartition)) return 0
  return repartition.reduce((somme, part) => somme + (part?.clients || 0), 0)
}
