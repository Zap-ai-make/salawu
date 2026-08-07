/**
 * Profil CLIENT — ESAHAF (id normalisé : « salawu »).
 * ─────────────────────────────────────────────────────────────────────────────
 * Client dealer MULTI-RÉSEAUX. Hérite du pilote (opt-out) puis restreint ce que
 * le client n'utilise pas. Ne JAMAIS confondre avec taofic-ajagbe.js (autre client,
 * mono-réseau, en production — intouchable).
 *
 * Particularité métier : la boutique vend les 5 réseaux, mais le circuit DEALER
 * n'approvisionne que Moov/Telecel/Coris/Sank. Orange est exclu du dealer car le
 * client n'est que sous-dealer Orange (ravitaillé par un fournisseur externe) —
 * d'où dealer.networks ⊊ networks.enabled (choix validé, pas une omission).
 */

import { pilotProfile, RESEAUX_SUPPORTES, METHODES_PAIEMENT_SUPPORTEES } from './_pilot.js'

export const salawuProfile = Object.freeze({
  ...pilotProfile,

  // ── Identité ────────────────────────────────────────────────────────────────
  // id = identifiant client NORMALISÉ (= VITE_CLIENT_ID normalisé, souligné) ;
  // firebaseProject = id réel du projet Firebase (tiret). Les deux peuvent différer.
  id: 'salawu',
  label: 'ESAHAF',
  firebaseProject: 'salawu-fa726',

  // ── Marque ──────────────────────────────────────────────────────────────────
  // theme = étiquette déclarative uniquement (le rendu couleur reste piloté par le
  // système de thème existant, cf. src/constants/branding.js) — aucun dev CSS induit.
  branding: Object.freeze({
    appName: 'ESAHAF',
    pwaName: 'ESAHAF',
    theme: 'orange',
  }),

  // ── Réseaux boutique : les 6 (superset complet, comme le pilote) ────────────
  networks: Object.freeze({
    enabled: [...RESEAUX_SUPPORTES],
  }),

  // ── Transactions : sans Crédit, toutes les méthodes de règlement ───────────
  transactions: Object.freeze({
    types: ['Dépôt', 'Retrait'],
    paymentMethods: [...METHODES_PAIEMENT_SUPPORTEES],
  }),

  // ── Édition des soldes par la boutique : DÉSACTIVÉE (masquage UI) ───────────
  cashier: Object.freeze({
    canEditBalances: false,
  }),

  // ── Dealer : MULTI-RÉSEAUX (Moov, Telecel, Coris, Sank, Wave) — Orange exclu ─
  // Cœur de cette mise en service : les branches IS_DEALER_MULTI_NETWORK
  // (sélecteur de réseau + inventaire multi) deviennent LIVE avec ≥ 2 réseaux.
  // Wave est approvisionné par le dealer (cahier des charges : Dealer → Assistant boutique).
  dealer: Object.freeze({
    enabled: true,
    networks: ['Moov', 'Telecel', 'Coris', 'Sank', 'Wave'],
  }),

  // ── Règles métier par réseau (cahier des charges ESAHAF) ────────────────────
  // Le spread écrase le champ ENTIER (pas de merge profond) → les 6 réseaux sont
  // redéclarés explicitement. Déclaratif : aucun enforcement en Vague 1.
  //   • Orange  : sous-dealer alimenté par un partenaire externe (saisie manuelle Gérant).
  //   • Moov    : « Envoi de stock uniquement ; jamais de retour de stock Moov de l'agent »
  //               → agentOperations ['deposit'] + allowStockReturn false.
  //   • Non enregistrés autorisés UNIQUEMENT pour Moov (Dealer de zone) et Wave (Assistant).
  networkRules: Object.freeze({
    Orange:  Object.freeze({ supplyMode: 'external_partner', agentOperations: ['deposit', 'withdrawal'], allowStockReturn: true,  allowUnregisteredAgents: false }),
    Moov:    Object.freeze({ supplyMode: 'dealer',           agentOperations: ['deposit'],               allowStockReturn: false, allowUnregisteredAgents: true }),
    Telecel: Object.freeze({ supplyMode: 'dealer',           agentOperations: ['deposit', 'withdrawal'], allowStockReturn: true,  allowUnregisteredAgents: false }),
    Coris:   Object.freeze({ supplyMode: 'dealer',           agentOperations: ['deposit', 'withdrawal'], allowStockReturn: true,  allowUnregisteredAgents: false }),
    Sank:    Object.freeze({ supplyMode: 'dealer',           agentOperations: ['deposit', 'withdrawal'], allowStockReturn: true,  allowUnregisteredAgents: false }),
    Wave:    Object.freeze({ supplyMode: 'dealer',           agentOperations: ['deposit', 'withdrawal'], allowStockReturn: true,  allowUnregisteredAgents: true }),
  }),

  // regional : hérité du pilote (Africa/Ouagadougou).
})

export default salawuProfile
