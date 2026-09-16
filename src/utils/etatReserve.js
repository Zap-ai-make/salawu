/**
 * etatReserve.js — l'état d'une réserve réseau, en un mot.
 * ─────────────────────────────────────────────────────────────────────────────
 * RÈGLE MÉTIER, et non une règle d'apparence. Le mot rendu ici fait AGIR : un
 * caissier qui lit « Bas » va se réapprovisionner, un caissier qui lit « Stock »
 * ne le fera pas. C'est pour cela que cette décision est une fonction pure,
 * testée, et que le seuil vient du profil client (`networks.seuilStockBas`) au
 * lieu d'être écrit dans un composant.
 *
 * POURQUOI UN MOT, ET PAS SEULEMENT UNE COULEUR
 * La bande des réserves colorait chaque carte d'un pastel différent — orange,
 * bleu, violet, jaune, rose, cyan — sept teintes qui n'encodaient rien. Et le
 * seul signal d'alerte était un « ! ». La première exigence non négociable du
 * chantier est qu'aucune couleur ne porte seule une information : l'état est
 * donc écrit en toutes lettres, et la couleur ne fait que le redire.
 *
 * TROIS ÉTATS, PARCE QU'IL Y A UN SEUL SEUIL
 * La maquette affiche quatre mots — « Stock », « À surveiller », « Bas »,
 * « Épuisé » — mais « À surveiller » et « Bas » y portent la MÊME couleur
 * (`etat--alerte`) : ce sont deux mots pour un seul état. Les distinguer
 * demanderait un second seuil, qui n'a pas été fixé. On n'en invente pas :
 * un seuil deviné se trompe pour toutes les boutiques sauf une.
 */

/** Les trois états possibles d'une réserve. `cle` sert au CSS, `mot` à l'humain. */
export const ETATS_RESERVE = Object.freeze({
  EPUISE: Object.freeze({ cle: 'epuise', mot: 'Épuisé' }),
  BAS: Object.freeze({ cle: 'bas', mot: 'Bas' }),
  NORMAL: Object.freeze({ cle: 'normal', mot: 'Stock' }),
})

/**
 * @param {number} stock - montant en FCFA.
 * @param {number|null|undefined} seuilBas - `networks.seuilStockBas` du profil.
 *   ABSENT → aucun état n'est rendu. C'est ce qui garde les profils qui ne
 *   déclarent pas de seuil (TAOFIC) strictement inchangés : pas de seuil, pas de
 *   mot, donc rien de neuf à l'écran.
 * @returns {{cle: string, mot: string}|null}
 */
export function etatDeLaReserve(stock, seuilBas) {
  if (typeof seuilBas !== 'number' || !Number.isFinite(seuilBas)) return null

  // Une valeur absente ou illisible n'est PAS zéro. Annoncer « Épuisé » sur une
  // donnée qu'on n'a pas su lire enverrait le caissier se réapprovisionner d'un
  // stock qui existe peut-être — le silence est le seul repli honnête.
  //
  // ⚠ `Number(null)` vaut 0, et `Number('')` aussi. Un simple `Number.isFinite`
  // laissait donc passer `null` et la chaîne vide, qui ressortaient en
  // « Épuisé ». Le test de ce comportement a attrapé le défaut avant le premier
  // rendu — c'est précisément le cas qu'une conversion implicite rend invisible.
  if (stock === null || stock === undefined) return null
  if (typeof stock !== 'number' && typeof stock !== 'string') return null
  if (typeof stock === 'string' && stock.trim() === '') return null

  const montant = Number(stock)
  if (!Number.isFinite(montant)) return null

  if (montant <= 0) return ETATS_RESERVE.EPUISE
  if (montant < seuilBas) return ETATS_RESERVE.BAS
  return ETATS_RESERVE.NORMAL
}
