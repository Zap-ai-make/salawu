/**
 * networkRules.js — sélecteurs des règles métier différenciées par réseau.
 * ─────────────────────────────────────────────────────────────────────────────
 * Lit `activeProfile.networkRules` (défini dans config/clients/*.js). Fonctions
 * PURES, sans effet de bord.
 *
 * ⚠ Repli PERMISSIF si le réseau n'a pas de règle (ou si le profil n'a pas de
 * `networkRules`) : la valeur retournée reproduit le comportement historique
 * (tout autorisé). Un profil sans `networkRules` (ancien client, futur client non
 * profilé) se comporte donc EXACTEMENT comme avant — deploy-safe.
 *
 * Vague 1 : ces sélecteurs ne sont câblés à AUCUN comportement (fondation posée
 * pour la Vague 2). Voir le plan « Fondations réseau ».
 */

import { activeProfile } from '../config/activeClientProfile.js'

// Règle par défaut = la plus permissive (comportement historique préservé).
const PERMISSIVE_RULE = Object.freeze({
  supplyMode: 'dealer',
  agentOperations: ['deposit', 'withdrawal'],
  allowStockReturn: true,
  allowUnregisteredAgents: true,
})

/**
 * Règle effective d'un réseau, avec repli permissif si absente.
 * @param {string} network - nom du réseau (ex. 'Orange', 'Moov').
 * @returns {{supplyMode: string, agentOperations: string[], allowStockReturn: boolean, allowUnregisteredAgents: boolean}}
 */
export function getNetworkRule(network) {
  const rule = activeProfile?.networkRules?.[network]
  return rule || PERMISSIVE_RULE
}

/**
 * Mode d'approvisionnement du stock d'un réseau.
 * @returns {'dealer'|'external_partner'}
 */
export function networkSupplyMode(network) {
  return getNetworkRule(network).supplyMode
}

/**
 * Une opération agent/boutique est-elle autorisée pour ce réseau ?
 * @param {string} network
 * @param {'deposit'|'withdrawal'} operation
 * @returns {boolean}
 */
export function isAgentOperationAllowed(network, operation) {
  return getNetworkRule(network).agentOperations.includes(operation)
}

/**
 * Le stock du réseau peut-il être retourné (agent→boutique / boutique→dealer) ?
 * @returns {boolean}
 */
export function isStockReturnAllowed(network) {
  return getNetworkRule(network).allowStockReturn === true
}

/**
 * Les transactions avec des agents non enregistrés sont-elles autorisées pour ce réseau ?
 * @returns {boolean}
 */
export function areUnregisteredAgentsAllowed(network) {
  return getNetworkRule(network).allowUnregisteredAgents === true
}
