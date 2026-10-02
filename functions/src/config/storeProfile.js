/**
 * storeProfile.js — réseaux EXPLOITÉS par la boutique, côté Cloud Functions.
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ FICHIER GÉNÉRÉ par scripts/generate-functions-config.mjs depuis le profil client
 * (config/clients/<id>.js, champ networks.enabled). NE PAS ÉDITER À LA MAIN.
 *
 * À ne pas confondre avec dealerProfile.js (`DEALER_NETWORKS`), qui liste le
 * circuit d'approvisionnement du dealer. Ici : ce que la boutique exploite, donc
 * les cartes qu'un ravitaillement peut créditer.
 *
 * Défaut committé = référence TAOFIC (['Orange']) → mono-réseau identique à
 * l'historique. Le déploiement régénère ce fichier depuis le profil du client déployé.
 * Les handlers acceptent aussi `storeNetworks` en injection (tests multi-réseaux).
 */
export const STORE_NETWORKS = ['Orange']
