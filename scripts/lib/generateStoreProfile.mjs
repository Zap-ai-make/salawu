/**
 * generateStoreProfile.mjs — génère le contenu de functions/src/config/storeProfile.js
 * depuis un profil client. PUR (aucune I/O) → testable et réutilisé par le CLI
 * scripts/generate-functions-config.mjs.
 *
 * ⚠ POURQUOI UN FICHIER DE PLUS, ET PAS `dealerProfile.js`.
 *
 * `dealer.networks` est le circuit d'APPROVISIONNEMENT (les SIM que le dealer
 * livre) ; `networks.enabled` est ce que la BOUTIQUE exploite. Chez ESAHAF les
 * deux diffèrent — six réseaux exploités, un sous-ensemble livré par le dealer
 * (config/clients/salawu.js l. 11, « dealer.networks ⊊ networks.enabled, choix
 * validé, pas une omission »).
 *
 * Un ravitaillement crédite une CARTE de la boutique : il doit donc être validé
 * contre `networks.enabled`. Valider contre `dealer.networks` aurait rendu
 * impossible de ravitailler Telecel ou Wave chez ESAHAF — et l'erreur aurait
 * ressemblé à un bug de saisie plutôt qu'à une liste mal choisie.
 */

/**
 * @param {object} profile - profil client (doit porter networks.enabled non vide)
 * @returns {string} contenu complet du module functions/src/config/storeProfile.js
 */
export function generateStoreProfileFile(profile) {
  const networks = profile?.networks?.enabled
  if (!Array.isArray(networks) || networks.length === 0) {
    throw new Error('Profil invalide : networks.enabled doit être une liste non vide.')
  }
  const list = networks.map((n) => `'${String(n)}'`).join(', ')

  return `/**
 * storeProfile.js — réseaux EXPLOITÉS par la boutique, côté Cloud Functions.
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ FICHIER GÉNÉRÉ par scripts/generate-functions-config.mjs depuis le profil client
 * (config/clients/<id>.js, champ networks.enabled). NE PAS ÉDITER À LA MAIN.
 *
 * À ne pas confondre avec dealerProfile.js (\`DEALER_NETWORKS\`), qui liste le
 * circuit d'approvisionnement du dealer. Ici : ce que la boutique exploite, donc
 * les cartes qu'un ravitaillement peut créditer.
 *
 * Défaut committé = référence TAOFIC (['Orange']) → mono-réseau identique à
 * l'historique. Le déploiement régénère ce fichier depuis le profil du client déployé.
 * Les handlers acceptent aussi \`storeNetworks\` en injection (tests multi-réseaux).
 */
export const STORE_NETWORKS = [${list}]
`
}
