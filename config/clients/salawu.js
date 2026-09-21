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
  // `theme` ne pilote PLUS l'apparence de l'interface : cette table a été retirée
  // au Lot 4 (deux mécanismes décidaient de la même chose). L'apparence dérive du
  // seul champ `design.system` ci-dessous. `theme` ne sert plus qu'à la couleur du
  // manifeste PWA pour un client resté en 'legacy' — et ESAHAF n'en est pas un :
  // sa couleur de manifeste vient de --color-encre (cf. vite.config.js).
  // Conservé car `branding` est un contrat de profil partagé, pas pour son effet.
  branding: Object.freeze({
    appName: 'ESAHAF',
    pwaName: 'ESAHAF',
    theme: 'orange',
    // Sous-titre du bandeau de marque, demande par le client le 2026-09-21.
    // Il vit ICI et non dans le Layout : un texte propre a une boutique n'a rien
    // a faire dans un composant partage avec TAOFIC, qui est en production. Un
    // profil sans `tagline` ne rend rien du tout — c'est la garantie mecanique.
    tagline: 'Service Mobile Money',
  }),

  // ── Système de design : l'identité « registre », propre à ESAHAF ────────────
  // Seul profil à la porter. TAOFIC n'ayant pas ce champ hérite de 'legacy' du
  // pilote : son rendu ne bouge pas, et c'est la garantie mécanique — pas une
  // discipline à tenir — qu'une refonte ESAHAF ne l'atteindra jamais.
  design: Object.freeze({
    system: 'registre',
  }),

  // ── Réseaux boutique : les 6 (superset complet, comme le pilote) ────────────
  networks: Object.freeze({
    enabled: [...RESEAUX_SUPPORTES],

    // Seuil de stock BAS, en FCFA. Fixé par le client le 2026-09-16.
    //
    // C'est une RÈGLE MÉTIER, pas un réglage d'apparence, et c'est pourquoi elle
    // vit ici et non dans un composant : elle décide de ce que la bande des
    // réserves DIT au caissier (« Stock », « Bas », « Épuisé »), et ce mot le
    // fait agir — il va se réapprovisionner, ou non.
    //
    // Un profil qui ne la déclare pas n'affiche aucun mot d'état : TAOFIC ne la
    // déclare pas, et sa bande reste ce qu'elle est. Aucun seuil n'est inventé
    // par défaut — un seuil devine faux pour toutes les boutiques sauf une.
    //
    // ⚠ UN SEUL SEUIL, donc TROIS états. La maquette montre quatre mots
    // (« Stock », « À surveiller », « Bas », « Épuisé ») mais « À surveiller »
    // et « Bas » y portent la même couleur : ce sont deux mots pour un seul
    // état, et les séparer demanderait un second seuil qui n'a pas été fixé.
    seuilStockBas: 100_000,
  }),

  // ── Transactions : sans Crédit, toutes les méthodes de règlement ───────────
  transactions: Object.freeze({
    types: ['Dépôt', 'Retrait'],
    paymentMethods: [...METHODES_PAIEMENT_SUPPORTEES],
  }),

  // ── Historique : plafond de chargement live (perf) ──────────────────────────
  // L'onglet « Transactions clients » ne charge en direct que les N transactions
  // les plus récentes (tri par createdAt desc) ; « voir plus » élargit la fenêtre.
  // Absent d'un profil (ex. TAOFIC) → illimité = comportement historique inchangé.
  history: Object.freeze({ pageSize: 200 }),

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

  // ── App mobile agents : ACTIVÉE pour ESAHAF (partage des reçus/fiche) ───────
  // L'agent se connecte à l'app mobile (téléphone + PIN remis en boutique) et lit
  // SES reçus + sa fiche. Active la génération des règles de lecture agent
  // (mobileAppEnabled() → true dans firestore.rules régénéré pour salawu).
  mobileApp: Object.freeze({
    enabled: true,
    shareReceipts: true,
  }),

  // Mode hors-ligne activé : agents sur mobile, terrain à connexion instable. Déverrouillage
  // par mot de passe du compte (vérifié localement, PBKDF2 WebCrypto) ; fenêtre hors-ligne
  // bornée à 7 jours avant re-authentification en ligne obligatoire.
  offlineMode: Object.freeze({
    enabled: true,
    unlock: 'password',
    maxOfflineDays: 7,
  }),

  // ── Règles métier par réseau (cahier des charges ESAHAF) ────────────────────
  // Le spread écrase le champ ENTIER (pas de merge profond) → les 6 réseaux sont
  // redéclarés explicitement. Déclaratif : aucun enforcement en Vague 1.
  //   • Orange  : sous-dealer alimenté par un partenaire externe (saisie manuelle Gérant).
  //   • Moov    : « jamais de retour de stock Moov » → allowStockReturn false (bloque le
  //               retour de stock boutique→dealer). Dépôt ET retrait client restent possibles
  //               (sémantique validée client 2026-08-09).
  //   • Non enregistrés autorisés UNIQUEMENT pour Moov (Dealer de zone) et Wave (Assistant).
  networkRules: Object.freeze({
    Orange:  Object.freeze({ supplyMode: 'external_partner', agentOperations: ['deposit', 'withdrawal'], allowStockReturn: true,  allowUnregisteredAgents: false }),
    Moov:    Object.freeze({ supplyMode: 'dealer',           agentOperations: ['deposit', 'withdrawal'], allowStockReturn: false, allowUnregisteredAgents: true }),
    Telecel: Object.freeze({ supplyMode: 'dealer',           agentOperations: ['deposit', 'withdrawal'], allowStockReturn: true,  allowUnregisteredAgents: false }),
    Coris:   Object.freeze({ supplyMode: 'dealer',           agentOperations: ['deposit', 'withdrawal'], allowStockReturn: true,  allowUnregisteredAgents: false }),
    Sank:    Object.freeze({ supplyMode: 'dealer',           agentOperations: ['deposit', 'withdrawal'], allowStockReturn: true,  allowUnregisteredAgents: false }),
    Wave:    Object.freeze({ supplyMode: 'dealer',           agentOperations: ['deposit', 'withdrawal'], allowStockReturn: true,  allowUnregisteredAgents: true }),
  }),

  // regional : hérité du pilote (Africa/Ouagadougou).
})

export default salawuProfile
