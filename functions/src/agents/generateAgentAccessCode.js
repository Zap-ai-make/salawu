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
import { validateClientId, generateAccessCode, hashAccessCode, extractAgentIdentifiers, isLocked } from './shared.js'

const NETWORK_KEYS = SUPPORTED_NETWORKS.map((n) => n.toLowerCase())

export async function generateAgentAccessCodeHandler(request, { db, FieldValue, revokeAgentSessions }) {
  // ── 1. Garde fonctionnalité (config générée par profil ; off chez TAOFIC) ────
  if (!MOBILE_APP.enabled) {
    throw new DealerRequestError('MOBILE_APP_DISABLED', "L'app mobile agents n'est pas activée.")
  }

  // ⚠ UNE DÉPENDANCE MANQUANTE EST UN DÉFAUT DE CÂBLAGE, PAS UN ÉCHEC DE
  // RÉVOCATION. Sans cette garde, un `revokeAgentSessions` oublié tombait dans le
  // `catch` de l'étape 5 : chaque régénération se serait déroulée normalement en
  // ne révoquant rien, et le seul signe aurait été une ligne d'audit que personne
  // ne lit. On préfère un échec bruyant, avant toute écriture.
  if (typeof revokeAgentSessions !== 'function') {
    throw new Error('generateAgentAccessCode : dépendance revokeAgentSessions absente (câblage index.js).')
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
      const existingData = existingSnap.exists ? existingSnap.data() : {}
      const codeVersion = existingSnap.exists ? (Number(existingData.codeVersion) || 0) + 1 : 1

      // Génération + hachage côté serveur : le clair ne quitte que la réponse callable.
      const accessCode = generateAccessCode(MOBILE_APP.accessCodePrefix)
      const { hash, salt } = hashAccessCode(accessCode)
      const now = FieldValue.serverTimestamp()

      // Régénération = déverrouillage volontaire (action gérant) : failedAttempts/lockedUntil
      // remis à zéro. Mais `set` écrase tout : on PRÉSERVE lastLoginAt (métadonnée d'audit, F3).
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
        lastLoginAt: existingData.lastLoginAt ?? null,
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
        wasLocked: isLocked(existingData, Date.now()), // trace un éventuel déverrouillage (F3)
        createdAt: now,
      })

      // `storeId` remonte pour l'étape 5 : la trace d'un échec de révocation
      // s'écrit dans la boutique, et le storeId est serveur-autoritatif (il vient
      // du profil relu DANS la transaction, jamais du client).
      return { accessCode, codeVersion, storeId }
    })
  } catch (err) {
    if (err instanceof DealerRequestError) throw err
    throw new DealerRequestError('TRANSACTION_FAILED', 'La transaction a échoué. Veuillez réessayer.')
  }

  // ── 5. Couper les sessions déjà ouvertes ────────────────────────────────────
  // ⚠ SANS CECI, RÉGÉNÉRER NE RÉVOQUE RIEN. Un jeton personnalisé ouvre une
  // session qui survit au changement de code : l'appareil déjà connecté garde son
  // jeton de rafraîchissement et continue indéfiniment. Le nouveau code ferme la
  // porte d'entrée ; il ne met dehors personne.
  //
  // `revokeRefreshTokens` est la moitié IMPOSÉE de la révocation : Firebase
  // refuse de renouveler, quoi que fasse l'appareil. Le jeton d'identité en cours
  // survit jusqu'à son expiration — une heure au plus —, donc la fenêtre passe
  // d'infinie à bornée. `agentSessionCheck` raccourcit ce reliquat quand l'app
  // coopère, mais lui seul ne garantit rien.
  //
  // ⚠ APRÈS LA TRANSACTION, ET SANS FAIRE ÉCHOUER L'APPEL. Le code est déjà
  // changé : lancer une erreur ici ferait croire au gérant que rien n'a bougé. Il
  // régénérerait, produisant un TROISIÈME code — et l'agent en aurait deux
  // périmés sans le savoir. L'échec est donc tracé et rendu à l'appelant, qui
  // peut le dire ; il n'annule pas ce qui a réussi.
  let sessionsRevoked = true
  try {
    await revokeAgentSessions(clientId)
  } catch {
    sessionsRevoked = false
    try {
      await db.collection(`clients/${result.storeId}/auditLogs`).add({
        action: 'AGENT_SESSION_REVOKE_FAILED',
        actorUid,
        clientId,
        codeVersion: result.codeVersion,
        createdAt: FieldValue.serverTimestamp(),
      })
    } catch {
      // La trace ne doit jamais renverser le résultat : le code EST régénéré.
    }
  }

  return {
    success: true,
    accessCode: result.accessCode,
    codeVersion: result.codeVersion,
    sessionsRevoked,
  }
}
