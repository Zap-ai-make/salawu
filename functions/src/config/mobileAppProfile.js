/**
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
export const MOBILE_APP = { enabled: false, accessCodePrefix: 'AKAYIS' }
