/**
 * agentAccessService.js — code d'accès agent pour l'app mobile (Vague « app mobile agents »).
 *
 * Écriture : exclusivement via Cloud Function (httpsCallable). Le code est GÉNÉRÉ et
 * HACHÉ côté serveur ; le clair n'est renvoyé qu'une fois pour être remis à l'agent.
 * Aucun write Firestore direct. Région Functions : europe-west1 (src/config/firebase.js).
 */

import { httpsCallable } from 'firebase/functions'
import { functions } from '../config/firebase'

const ERROR_MESSAGES = {
  UNAUTHENTICATED:           'Votre session a expiré. Reconnectez-vous.',
  PROFILE_NOT_FOUND:         'Votre profil est introuvable.',
  PROFILE_INACTIVE:          'Votre compte est inactif.',
  ROLE_FORBIDDEN:            'Action réservée au gérant de la boutique.',
  MOBILE_APP_DISABLED:       "L'app mobile agents n'est pas activée pour cette boutique.",
  INVALID_CLIENT_ID:         'Client invalide.',
  CLIENT_NOT_FOUND:          'Client introuvable.',
  CLIENT_STORE_MISMATCH:     "Ce client n'appartient pas à votre boutique.",
  AGENT_IDENTIFIER_REQUIRED: "L'agent doit avoir au moins un numéro ou code agent avant de générer un code d'accès.",
  TRANSACTION_FAILED:        "L'opération n'a pas pu être finalisée.",
}

export function mapAgentAccessError(err) {
  const detailCode = err?.details?.code
  if (detailCode) {
    const mapped = new Error(ERROR_MESSAGES[detailCode] || "L'opération n'a pas pu être finalisée.")
    mapped.code = detailCode
    return mapped
  }
  const funcCode = String(err?.code || '')
  if (funcCode.includes('unauthenticated')) {
    const e = new Error(ERROR_MESSAGES.UNAUTHENTICATED); e.code = 'UNAUTHENTICATED'; return e
  }
  if (import.meta.env.DEV) console.error('[agentAccessService]', err)
  return new Error("Une erreur inattendue s'est produite.")
}

/**
 * Génère (ou régénère) le code d'accès mobile d'un agent.
 * @param {string} clientId - id du doc globalClients de l'agent.
 * @returns {Promise<{ success: boolean, accessCode: string, codeVersion: number }>}
 */
export async function generateAgentAccessCode(clientId) {
  const id = String(clientId ?? '').trim()
  if (!id) throw new Error(ERROR_MESSAGES.INVALID_CLIENT_ID)
  try {
    const res = await httpsCallable(functions, 'generateAgentAccessCode')({ clientId: id })
    return res.data
  } catch (err) {
    throw mapAgentAccessError(err)
  }
}
