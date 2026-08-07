/**
 * Helpers purs — validation de la Config Boutique × Réseau (adminSetStoreNetworkConfig).
 * Aucune dépendance externe. Testés directement en TC-100.
 *
 * Conventions (identiques à dealerRequests/shared.js) :
 *   - Toute validation échouée lance DealerRequestError (jamais HttpsError).
 *   - Les fonctions retournent la valeur normalisée quand c'est utile.
 */

import { DealerRequestError } from '../errors.js'

// Référentiel produit : les 6 réseaux supportés (indépendant du profil client).
// La config d'une boutique ne peut porter que sur ces réseaux (borne = networks.enabled
// du superset, PAS dealer.networks — Orange doit rester configurable en external_partner).
export const SUPPORTED_NETWORKS = Object.freeze([
  'Orange', 'Moov', 'Telecel', 'Coris', 'Sank', 'Wave',
])
const SUPPORTED_NETWORK_SET = new Set(SUPPORTED_NETWORKS)

const VALID_SUPPLY_MODES = new Set(['dealer', 'external_partner'])
const NETWORK_ENTRY_KEYS = ['operates', 'supplyMode', 'isSupplied', 'isProvider']

// ---------------------------------------------------------------------------
// Identifiant de boutique
// ---------------------------------------------------------------------------

export function validateStoreId(storeId) {
  if (typeof storeId !== 'string' || storeId.trim() === '' || storeId !== storeId.trim()) {
    throw new DealerRequestError('INVALID_STORE_ID', 'Identifiant de boutique invalide.')
  }
  return storeId
}

// ---------------------------------------------------------------------------
// Profil acteur : Gérant global (system_manager) actif
// ---------------------------------------------------------------------------

export function validateSystemManagerProfile(profile) {
  if (!profile || typeof profile !== 'object') {
    throw new DealerRequestError('PROFILE_NOT_FOUND', 'Profil utilisateur introuvable.')
  }
  if (!profile.active) {
    throw new DealerRequestError('PROFILE_INACTIVE', 'Votre compte est désactivé.')
  }
  if (profile.role !== 'system_manager') {
    throw new DealerRequestError('ROLE_FORBIDDEN', 'Action réservée au gérant global.')
  }
}

// ---------------------------------------------------------------------------
// Carte de config réseau { <Réseau>: { operates, supplyMode, isSupplied, isProvider } }
// ---------------------------------------------------------------------------

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

function validateNetworkEntry(network, entry) {
  if (!isPlainObject(entry)) {
    throw new DealerRequestError('INVALID_NETWORK_CONFIG', `Config du réseau ${network} invalide.`)
  }
  const keys = Reflect.ownKeys(entry)
  if (keys.some((k) => typeof k !== 'string' || !NETWORK_ENTRY_KEYS.includes(k))) {
    throw new DealerRequestError('INVALID_NETWORK_CONFIG', `Config du réseau ${network} : champs non autorisés.`)
  }
  if (typeof entry.operates !== 'boolean' || typeof entry.isSupplied !== 'boolean' || typeof entry.isProvider !== 'boolean') {
    throw new DealerRequestError('INVALID_NETWORK_CONFIG', `Config du réseau ${network} : drapeaux booléens requis.`)
  }
  if (!VALID_SUPPLY_MODES.has(entry.supplyMode)) {
    throw new DealerRequestError('INVALID_NETWORK_CONFIG', `Config du réseau ${network} : supplyMode invalide.`)
  }
  return {
    operates: entry.operates,
    supplyMode: entry.supplyMode,
    isSupplied: entry.isSupplied,
    isProvider: entry.isProvider,
  }
}

/**
 * Valide et normalise la carte de config réseau.
 * @returns {object} carte normalisée (uniquement les 4 champs par réseau).
 */
export function validateNetworkConfigMap(networks) {
  if (!isPlainObject(networks)) {
    throw new DealerRequestError('INVALID_NETWORK_CONFIG', 'Carte de configuration réseau invalide.')
  }
  const keys = Reflect.ownKeys(networks)
  if (keys.some((k) => typeof k !== 'string' || !SUPPORTED_NETWORK_SET.has(k))) {
    throw new DealerRequestError('INVALID_NETWORK_CONFIG', 'Réseau non reconnu dans la configuration.')
  }
  const normalized = {}
  for (const network of keys) {
    normalized[network] = validateNetworkEntry(network, networks[network])
  }
  return normalized
}
