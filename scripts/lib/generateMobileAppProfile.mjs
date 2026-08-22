/**
 * generateMobileAppProfile.mjs — génère le contenu de
 * functions/src/config/mobileAppProfile.js depuis un profil client. PUR (aucune I/O)
 * → testable et réutilisé par le CLI scripts/generate-functions-config.mjs.
 *
 * Équivalent « functions » de l'axe mobileApp : la source de vérité est
 * profil.mobileApp.enabled (garde serveur de generateAgentAccessCode) et
 * profil.branding.appName (préfixe des codes d'accès agent). Défaut sûr : désactivé.
 */

/**
 * @param {object} profile - profil client
 * @returns {string} contenu complet du module functions/src/config/mobileAppProfile.js
 */
export function generateMobileAppProfileFile(profile) {
  const enabled = profile?.mobileApp?.enabled === true
  // Préfixe = marque, normalisée en littéral sûr (A-Z0-9). Défaut 'AKAYIS' (marque pilote).
  const raw = String(profile?.branding?.appName ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const accessCodePrefix = raw || 'AKAYIS'

  return `/**
 * mobileAppProfile.js — config app mobile agents, côté Cloud Functions.
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ FICHIER GÉNÉRÉ par scripts/generate-functions-config.mjs depuis le profil client
 * (config/clients/<id>.js : mobileApp.enabled + branding.appName). NE PAS ÉDITER À LA MAIN.
 *
 * Défaut committé = référence TAOFIC (désactivé). Le déploiement régénère ce fichier
 * depuis le profil du client déployé (salawu → enabled: true, prefix 'ESAHAF').
 *   enabled          : la Cloud Function generateAgentAccessCode est-elle autorisée ?
 *   accessCodePrefix : préfixe des codes d'accès agent (dérivé de branding.appName).
 */
export const MOBILE_APP = { enabled: ${enabled}, accessCodePrefix: '${accessCodePrefix}' }
`
}
