/**
 * generateRulesBlock.mjs — génère le bloc « PROFIL-GÉNÉRÉ » de firestore.rules
 * à partir d'un profil client. PUR (aucune I/O) → testable et réutilisé par le CLI
 * scripts/generate-rules.mjs.
 *
 * Axes paramétrés :
 *   • profileDealerNetworks() = réseaux du circuit dealer (profil.dealer.networks)
 *   • mobileAppEnabled()      = l'app mobile agents est-elle activée (profil.mobileApp.enabled) ?
 *       Sert de garde aux (futures) clauses de lecture agent des reçus/fiche. Défaut sûr
 *       false si l'axe est absent → un client sans mobileApp n'expose rien.
 * Les autres axes des règles (types de transaction, réseaux des soldes, édition des
 * soldes) restent volontairement permissifs (surensemble) — un resserrement est une
 * décision opt-in par client, hors de ce générateur. Voir docs/client-profiles.md.
 */

export const RULES_BLOCK_START =
  '// <<< PROFIL-GÉNÉRÉ — DÉBUT (généré par scripts/generate-rules.mjs, ne pas éditer à la main) >>>'
export const RULES_BLOCK_END =
  '// <<< PROFIL-GÉNÉRÉ — FIN >>>'

/**
 * @param {object} profile - profil client (doit porter dealer.networks non vide)
 * @param {string} [indent='    '] - indentation de chaque ligne du bloc
 * @returns {string} bloc de règles prêt à injecter (marqueurs inclus)
 */
export function generateProfileRulesBlock(profile, indent = '    ') {
  const networks = profile?.dealer?.networks
  if (!Array.isArray(networks) || networks.length === 0) {
    throw new Error('Profil invalide : dealer.networks doit être une liste non vide.')
  }
  // Réseaux échappés en littéraux de règles (ex. ['Orange', 'Moov']).
  const list = networks.map((n) => `'${String(n)}'`).join(', ')
  // App mobile agents : défaut sûr false si l'axe est absent du profil.
  const mobileAppEnabled = profile?.mobileApp?.enabled === true

  return [
    `${indent}${RULES_BLOCK_START}`,
    `${indent}// Réseaux du circuit dealer autorisés pour ce client (depuis profil.dealer.networks).`,
    `${indent}function profileDealerNetworks() { return [${list}]; }`,
    `${indent}// App mobile agents activée pour ce client (depuis profil.mobileApp.enabled).`,
    `${indent}function mobileAppEnabled() { return ${mobileAppEnabled}; }`,
    `${indent}${RULES_BLOCK_END}`,
  ].join('\n')
}
