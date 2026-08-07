/**
 * Handler — Config Boutique × Réseau (adminSetStoreNetworkConfig).
 *
 * Écrit la configuration réseau d'une boutique (rôle de la boutique par réseau).
 * Réservé au Gérant global (system_manager). Écriture serveur-autoritative et
 * AUDITÉE (ancien + nouveau) — la config pilote les collaborations (Vague 2).
 *
 * Le document est REMPLACÉ intégralement (set sans merge) : l'appelant envoie
 * l'état complet désiré, un réseau retiré de la carte est réellement retiré.
 *
 * db et FieldValue injectés (testabilité sur émulateur, sans Functions).
 */

import { DealerRequestError } from '../errors.js'
import { validateAuthUid, validateInputPayload } from '../dealerRequests/shared.js'
import {
  validateStoreId,
  validateSystemManagerProfile,
  validateNetworkConfigMap,
} from './shared.js'

export async function setStoreNetworkConfigHandler(request, { db, FieldValue }) {
  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const actorUid = validateAuthUid(request.auth?.uid)

  // ── 2. Payload (liste blanche stricte) ──────────────────────────────────────
  const payload = validateInputPayload(request.data, ['storeId', 'networks'])
  const storeId = validateStoreId(payload.storeId)
  const networks = validateNetworkConfigMap(payload.networks)

  // ── 3. Prévalidation rôle (lue depuis users/, jamais le payload) ────────────
  const profileSnap = await db.doc(`users/${actorUid}`).get()
  if (!profileSnap.exists) {
    throw new DealerRequestError('PROFILE_NOT_FOUND', 'Profil utilisateur introuvable.')
  }
  validateSystemManagerProfile(profileSnap.data())

  // ── 4. Transaction : config + audit (ancien/nouveau) ────────────────────────
  let result
  try {
    result = await db.runTransaction(async (t) => {
      const txProfileSnap = await t.get(db.doc(`users/${actorUid}`))
      if (!txProfileSnap.exists) {
        throw new DealerRequestError('PROFILE_NOT_FOUND', 'Profil utilisateur introuvable.')
      }
      validateSystemManagerProfile(txProfileSnap.data())

      const storeSnap = await t.get(db.doc(`stores/${storeId}`))
      if (!storeSnap.exists) {
        throw new DealerRequestError('STORE_NOT_FOUND', 'Boutique introuvable.')
      }
      const storeName = storeSnap.data().name ?? null

      const configRef = db.doc(`storeNetworkConfig/${storeId}`)
      const prevSnap = await t.get(configRef)
      const previousNetworks = prevSnap.exists ? (prevSnap.data().networks ?? null) : null

      const now = FieldValue.serverTimestamp()

      // Remplacement intégral (pas de merge) : l'état envoyé fait foi.
      t.set(configRef, { storeId, storeName, networks, updatedAt: now, updatedBy: actorUid })

      // Piste d'audit (exigence : conserver ancien + nouveau, auteur, date).
      const auditRef = db.collection('storeNetworkConfigAuditLogs').doc()
      t.set(auditRef, {
        action: 'STORE_NETWORK_CONFIG_SET',
        actorUid,
        actorEmail: txProfileSnap.data().email ?? null,
        actorName: txProfileSnap.data().name ?? null,
        actorRole: 'system_manager',
        storeId,
        storeName,
        previousNetworks,
        newNetworks: networks,
        createdAt: now,
      })

      return { storeId }
    })
  } catch (err) {
    if (err instanceof DealerRequestError) throw err
    throw new DealerRequestError('TRANSACTION_FAILED', 'La transaction a échoué. Veuillez réessayer.')
  }

  return { success: true, ...result }
}
