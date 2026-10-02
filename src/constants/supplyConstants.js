/**
 * supplyConstants.js — vocabulaire des RAVITAILLEMENTS (crédit d'une carte réseau).
 * ─────────────────────────────────────────────────────────────────────────────
 * Un ravitaillement est de l'argent qui entre dans une carte de la boutique sans
 * passer par le dealer : un apport du gérant, un retour de terrain, une
 * régularisation d'ouverture.
 *
 * ⚠ À NE PAS CONFONDRE AVEC LES DEMANDES DEALER, qui partagent désormais le même
 * onglet. Une demande dealer est une livraison PROPOSÉE par le dealer, que la
 * boutique confirme ou rejette ; un ravitaillement est un geste de la boutique
 * sur son propre solde. Les deux créditent une carte, mais l'un a un tiers et
 * l'autre non — d'où deux circuits, deux collections, deux registres.
 */

/** Les deux ressources d'une carte. Orthographe Firestore : `liquidite`, sans accent. */
export const SUPPLY_RESOURCES = Object.freeze({
  STOCK: 'stock',
  LIQUIDITE: 'liquidite',
})

export const SUPPLY_RESOURCE_LABELS = Object.freeze({
  stock: 'Stock',
  liquidite: 'Liquidité',
})

/**
 * Un ravitaillement est vivant, ou annulé. Il n'est JAMAIS supprimé.
 *
 * L'écran offre « supprimer » ; le backend pose `cancelled` et reprend le
 * montant. La ligne reste lisible, barrée — un registre qui escamote ses
 * annulations ne se recoupe plus avec la carte.
 */
export const SUPPLY_STATUSES = Object.freeze({
  ACTIVE: 'active',
  CANCELLED: 'cancelled',
})

export const SUPPLY_STATUS_LABELS = Object.freeze({
  active: 'Enregistré',
  cancelled: 'Annulé',
})

/**
 * Fenêtre de l'historique des ravitaillements.
 *
 * Bornée CÔTÉ SERVEUR, et l'écran n'en retire ensuite AUCUNE ligne : filtrer
 * après un `limit()` est le bug « limiter puis filtrer » déjà payé sur les
 * collaborations et les dettes internes — la fenêtre se vide de ses lignes
 * visibles et l'écran paraît incomplet sans que rien ne soit en panne.
 */
export const STORE_SUPPLIES_PAGE_SIZE = 50
