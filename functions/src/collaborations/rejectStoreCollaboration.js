/**
 * Handler — rejet d'une collaboration par la boutique FOURNISSEUSE.
 *
 * Aucun mouvement de solde ni dette (rien n'a bougé à la création). La
 * collaboration passe simplement `pending → rejected` avec un motif obligatoire.
 *
 * db et FieldValue injectés (testabilité émulateur).
 */

import { DealerRequestError } from '../errors.js'
import { validateAuthUid, validateInputPayload, validateProfileData, validateRejectionReason } from '../dealerRequests/shared.js'
import { validateCollaborationId } from './shared.js'

export async function rejectStoreCollaborationHandler(request, { db, FieldValue }) {
  const actorUid = validateAuthUid(request.auth?.uid)
  const payload = validateInputPayload(request.data, ['collaborationId', 'rejectionReason'])
  const collaborationId = validateCollaborationId(payload.collaborationId)
  const rejectionReason = validateRejectionReason(payload.rejectionReason)

  const profileSnap = await db.doc(`users/${actorUid}`).get()
  if (!profileSnap.exists) {
    throw new DealerRequestError('PROFILE_NOT_FOUND', 'Profil utilisateur introuvable.')
  }
  validateProfileData(profileSnap.data())

  try {
    await db.runTransaction(async (t) => {
      const txProfileSnap = await t.get(db.doc(`users/${actorUid}`))
      if (!txProfileSnap.exists) {
        throw new DealerRequestError('PROFILE_NOT_FOUND', 'Profil utilisateur introuvable.')
      }
      const txProfile = txProfileSnap.data()
      const actorStoreId = validateProfileData(txProfile)

      const collabRef = db.doc(`storeCollaborations/${collaborationId}`)
      const collabSnap = await t.get(collabRef)
      if (!collabSnap.exists) {
        throw new DealerRequestError('COLLABORATION_NOT_FOUND', 'Collaboration introuvable.')
      }
      const collab = collabSnap.data()

      if (collab.supplierStoreId !== actorStoreId) {
        throw new DealerRequestError('COLLABORATION_STORE_MISMATCH', 'Cette collaboration ne vous est pas destinée.')
      }
      if (collab.status !== 'pending') {
        throw new DealerRequestError('COLLABORATION_NOT_PENDING', 'Cette collaboration a déjà été traitée.')
      }

      const now = FieldValue.serverTimestamp()
      t.update(collabRef, {
        status: 'rejected',
        updatedAt: now,
        rejectedBy: actorUid,
        rejectedAt: now,
        rejectionReason,
      })

      const auditRef = db.collection(`clients/${actorStoreId}/auditLogs`).doc()
      t.set(auditRef, {
        action: 'STORE_COLLABORATION_REJECTED',
        actorUid,
        actorEmail: txProfile.email ?? null,
        actorName: txProfile.name ?? null,
        actorRole: 'store_admin',
        actorStoreId,
        collaborationId,
        requestingStoreId: collab.requestingStoreId,
        network: collab.network,
        operationType: collab.operationType,
        amount: collab.amount,
        rejectionReason,
        createdAt: now,
      })
    })
  } catch (err) {
    if (err instanceof DealerRequestError) throw err
    throw new DealerRequestError('TRANSACTION_FAILED', 'La transaction a échoué. Veuillez réessayer.')
  }

  return { success: true, collaborationId }
}
