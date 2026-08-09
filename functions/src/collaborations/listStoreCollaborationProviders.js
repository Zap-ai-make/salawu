/**
 * Handler — liste des boutiques FOURNISSEUSES éligibles pour un réseau.
 *
 * Nécessaire car les règles cloisonnent la lecture de storeNetworkConfig (une
 * boutique ne lit pas la config d'une autre). Ce callable renvoie l'annuaire
 * MINIMAL des fournisseurs (id + nom) d'un réseau, pour peupler le sélecteur de
 * la demandeuse. Réservé aux store_admin actifs. Lecture seule (pas de transaction).
 *
 * db injecté (testabilité émulateur).
 */

import { DealerRequestError } from '../errors.js'
import { validateAuthUid, validateInputPayload, validateProfileData } from '../dealerRequests/shared.js'
import { SUPPORTED_NETWORKS } from '../storeNetworkConfig/shared.js'

const SUPPORTED_NETWORK_SET = new Set(SUPPORTED_NETWORKS)

export async function listStoreCollaborationProvidersHandler(request, { db }) {
  const actorUid = validateAuthUid(request.auth?.uid)
  const payload = validateInputPayload(request.data, ['network'])
  const network = payload.network
  if (typeof network !== 'string' || !SUPPORTED_NETWORK_SET.has(network)) {
    throw new DealerRequestError('INVALID_COLLABORATION_NETWORK', 'Réseau invalide.')
  }

  const profileSnap = await db.doc(`users/${actorUid}`).get()
  if (!profileSnap.exists) {
    throw new DealerRequestError('PROFILE_NOT_FOUND', 'Profil utilisateur introuvable.')
  }
  const actorStoreId = validateProfileData(profileSnap.data())

  const snap = await db.collection('storeNetworkConfig').get()
  const providers = []
  snap.forEach((doc) => {
    if (doc.id === actorStoreId) return // pas soi-même
    const netCfg = doc.data()?.networks?.[network]
    if (netCfg && netCfg.isProvider === true) {
      providers.push({ storeId: doc.id, storeName: doc.data().storeName ?? null })
    }
  })

  return { success: true, providers }
}
