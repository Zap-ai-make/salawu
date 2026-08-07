/**
 * storeNetworkConfigService.js — écriture de la Config Boutique × Réseau.
 *
 * Écriture EXCLUSIVEMENT via Cloud Function auditée (adminSetStoreNetworkConfig,
 * system_manager). Aucun write Firestore direct — le backend reste autoritatif.
 * La lecture est dans adminService.getStoreNetworkConfig.
 *
 * Région Functions : europe-west1 (config dans src/config/firebase.js).
 */

import { httpsCallable } from 'firebase/functions'
import { functions } from '../config/firebase'

const ERROR_MESSAGES = {
  UNAUTHENTICATED:        'Votre session a expiré. Reconnectez-vous.',
  PROFILE_NOT_FOUND:      'Votre profil est introuvable.',
  PROFILE_INACTIVE:       'Votre compte est inactif.',
  ROLE_FORBIDDEN:         "Action réservée au gérant global.",
  INVALID_STORE_ID:       'Identifiant de boutique invalide.',
  INVALID_NETWORK_CONFIG: 'Configuration réseau invalide.',
  STORE_NOT_FOUND:        'Boutique introuvable.',
  TRANSACTION_FAILED:     "L'enregistrement n'a pas pu être finalisé.",
}

export function mapConfigError(err) {
  const detailCode = err?.details?.code
  if (detailCode) {
    const mapped = new Error(ERROR_MESSAGES[detailCode] || "L'enregistrement n'a pas pu être finalisé.")
    mapped.code = detailCode
    return mapped
  }
  const funcCode = String(err?.code || '')
  if (funcCode.includes('unauthenticated')) {
    const e = new Error(ERROR_MESSAGES.UNAUTHENTICATED); e.code = 'UNAUTHENTICATED'; return e
  }
  if (import.meta.env.DEV) console.error('[storeNetworkConfigService]', err)
  return new Error("Une erreur inattendue s'est produite.")
}

/**
 * Enregistre la config réseau d'une boutique (remplacement intégral côté serveur).
 * @param {{storeId: string, networks: object}} params
 * @returns {Promise<{success: boolean, storeId: string}>}
 */
export async function setStoreNetworkConfig({ storeId, networks }) {
  try {
    const callable = httpsCallable(functions, 'adminSetStoreNetworkConfig')
    const res = await callable({ storeId, networks })
    return res.data
  } catch (err) {
    throw mapConfigError(err)
  }
}
