/* global __DEALER_PARTNERS__ */
/**
 * Annuaire des sous-dealers partenaires du client ACTIF (hors boutiques de la maison).
 *
 * Sélectionnables dans le formulaire de ravitaillement à la place d'une boutique.
 * Un « dépôt partenaire » agit uniquement sur l'inventaire du dealer
 * (−stock, +liquidité, 1:1), sans notification ni confirmation, et n'est là que
 * pour la piste d'historique. Les partenaires n'ont aucun solde propre.
 *
 * ⚠ La liste n'est PAS écrite ici. Ce sont des personnes réelles (noms, localités,
 * numéros DA) : figée dans ce module partagé, elle était embarquée à l'identique
 * dans le build de CHAQUE client, et l'espace Dealer d'un client affichait
 * l'annuaire d'un autre. Elle ne peut pas non plus vivre dans le profil client,
 * car config/clients/index.js importe TOUS les profils dans le même bundle.
 *
 * Elle est donc injectée au build par vite.config.js (define __DEALER_PARTNERS__)
 * depuis config/clients/partners.js, pour le SEUL client ciblé : les annuaires
 * des autres clients ne sont jamais livrés. Source : VITE_CLIENT_ID.
 */

// `define` est une substitution textuelle : sans configuration (outil tiers,
// analyse statique), on retombe sur un annuaire vide plutôt que de planter.
const INJECTED = typeof __DEALER_PARTNERS__ === 'undefined' ? [] : __DEALER_PARTNERS__

export const DEALER_PARTNERS = Object.freeze(INJECTED)

// Un client sans partenaire n'a pas de destinataire « Partenaire » : le
// formulaire masque la bascule plutôt que d'offrir une liste vide.
export const HAS_DEALER_PARTNERS = DEALER_PARTNERS.length > 0

/** Libellé d'affichage d'un partenaire (liste déroulante, historique). */
export const partnerLabel = (p) =>
  p ? `${p.nom} ${p.prenom} — ${p.localite} (${p.numeroDA})` : ''

/** Recherche par id (NUMERO DA). */
export const findPartner = (id) => DEALER_PARTNERS.find(p => p.id === String(id)) ?? null
