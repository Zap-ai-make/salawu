/**
 * Handler — génération d'un code d'accès agent (app mobile).
 *
 * Le GÉRANT (store_admin actif) génère un code d'accès pour UN agent de SA boutique.
 * Le code (préfixe marque + 8 caractères) est renvoyé EN CLAIR une seule fois pour être
 * remis à l'agent ; seul son hash (scrypt + sel) est stocké dans agentCredentials/{clientId}
 * (collection Admin-SDK only, cf. firestore.rules). Régénérer = nouveau code, ancien invalidé.
 *
 * Serveur-autoritatif : storeId issu du profil (jamais du client), appartenance du client
 * à la boutique vérifiée, exige au moins un identifiant agent (numéro/code) sur la fiche.
 * Aucun mouvement financier → aucune incidence sur la piste d'audit des soldes ; une entrée
 * d'audit boutique trace néanmoins la génération.
 *
 * db et FieldValue injectés (testabilité émulateur).
 */

import { DealerRequestError } from '../errors.js'
import { validateAuthUid, validateInputPayload, validateProfileData } from '../dealerRequests/shared.js'
import { SUPPORTED_NETWORKS } from '../storeNetworkConfig/shared.js'
import { MOBILE_APP } from '../config/mobileAppProfile.js'
import { validateClientId, generateAccessCode, hashAccessCode, extractAgentIdentifiers } from './shared.js'

const NETWORK_KEYS = SUPPORTED_NETWORKS.map((n) => n.toLowerCase())

export async function generateAgentAccessCodeHandler(request, { db, FieldValue }) {
  // ── 1. Garde fonctionnalité (config générée par profil ; off chez TAOFIC) ────
  if (!MOBILE_APP.enabled) {
    throw new DealerRequestError('MOBILE_APP_DISABLED', "L'app mobile agents n'est pas activée.")
  }

  // ── 2. Auth + payload (liste blanche stricte) ───────────────────────────────
  const actorUid = validateAuthUid(request.auth?.uid)
  const payload = validateInputPayload(request.data, ['clientId'])
  const clientId = validateClientId(payload.clientId)

  // ── 3. Prévalidation profil (store_admin actif) ─────────────────────────────
  const profileSnap = await db.doc(`users/${actorUid}`).get()
  if (!profileSnap.exists) {
    throw new DealerRequestError('PROFILE_NOT_FOUND', 'Profil utilisateur introuvable.')
  }
  validateProfileData(profileSnap.data())

  // ── 4. Transaction : lectures autoritatives + écriture credential + audit ────
  let result
  try {
    result = await db.runTransaction(async (t) => {
      const txProfileSnap = await t.get(db.doc(`users/${actorUid}`))
      if (!txProfileSnap.exists) {
        throw new DealerRequestError('PROFILE_NOT_FOUND', 'Profil utilisateur introuvable.')
      }
      const txProfile = txProfileSnap.data()
      const storeId = validateProfileData(txProfile)

      const clientSnap = await t.get(db.doc(`globalClients/${clientId}`))
      if (!clientSnap.exists) {
        throw new DealerRequestError('CLIENT_NOT_FOUND', 'Client introuvable.')
      }
      const clientData = clientSnap.data()
      if (clientData.registeredStoreId !== storeId) {
        throw new DealerRequestError('CLIENT_STORE_MISMATCH', "Ce client n'appartient pas à votre boutique.")
      }

      const identifiers = extractAgentIdentifiers(clientData, NETWORK_KEYS)
      if (identifiers.length === 0) {
        throw new DealerRequestError(
          'AGENT_IDENTIFIER_REQUIRED',
          "L'agent doit avoir au moins un numéro ou code agent avant de générer un code d'accès."
        )
      }

      const credRef = db.doc(`agentCredentials/${clientId}`)
      const existingSnap = await t.get(credRef)
      const codeVersion = existingSnap.exists ? (Number(existingSnap.data().codeVersion) || 0) + 1 : 1

      // Génération + hachage côté serveur : le clair ne quitte que la réponse callable.
      const accessCode = generateAccessCode(MOBILE_APP.accessCodePrefix)
      const { hash, salt } = hashAccessCode(accessCode)
      const now = FieldValue.serverTimestamp()

      t.set(credRef, {
        clientId,
        storeId,
        loginIdentifiers: identifiers,
        codeHash: hash,
        codeSalt: salt,
        codeVersion,
        active: true,
        failedAttempts: 0,
        lockedUntil: null,
        generatedBy: actorUid,
        generatedByEmail: txProfile.email ?? null,
        generatedAt: now,
        updatedAt: now,
      })

      const auditRef = db.collection(`clients/${storeId}/auditLogs`).doc()
      t.set(auditRef, {
        action: 'AGENT_ACCESS_CODE_GENERATED',
        actorUid,
        actorEmail: txProfile.email ?? null,
        actorName: txProfile.name ?? null,
        actorRole: 'store_admin',
        actorStoreId: storeId,
        clientId,
        codeVersion,
        createdAt: now,
      })

      return { accessCode, codeVersion }
    })
  } catch (err) {
    if (err instanceof DealerRequestError) throw err
    throw new DealerRequestError('TRANSACTION_FAILED', 'La transaction a échoué. Veuillez réessayer.')
  }

  return { success: true, accessCode: result.accessCode, codeVersion: result.codeVersion }
}
