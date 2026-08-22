/**
 * Profil PILOTE — le produit standard « AKAYIS CRM » (référence).
 * ─────────────────────────────────────────────────────────────────────────────
 * Politique : OPT-OUT. Ici, TOUT est activé (superset complet). Un client réel
 * hérite de ce profil et DÉSACTIVE ce qu'il n'utilise pas (voir taofic-ajagbe.js).
 *
 * Ce fichier ne contient AUCUNE logique — uniquement des drapeaux déclaratifs.
 * Les 3 couches en dérivent (une seule source de vérité) :
 *   • Front     : listes de réseaux / types / méthodes, affordances UI.
 *   • Règles    : firestore.rules GÉNÉRÉ depuis le profil (enforcement strict).
 *   • Functions : réseaux dealer valides, etc.
 *
 * Convention : ne jamais lire une variation ailleurs qu'ici. Ajouter un axe =
 * ajouter un champ nommé + commenté dans ce profil, défaut « le plus riche ».
 *
 * ⚠ Phase 0 : ce module n'est encore IMPORTÉ nulle part. Le câblage des 3 couches
 * se fait aux phases suivantes, chacune prouvée sans régression pour les clients.
 */

// Ensemble figé des réseaux supportés par le produit (ordre = ordre d'affichage).
export const RESEAUX_SUPPORTES = ['Orange', 'Moov', 'Telecel', 'Coris', 'Sank', 'Wave']

// Les méthodes de règlement supportées (les callables serveur les acceptent déjà toutes).
export const METHODES_PAIEMENT_SUPPORTEES = [
  'Orange Money', 'Moov Money', 'Telecel Money', 'Coris Money', 'Sank Money', 'Wave', 'Cash',
]

export const pilotProfile = Object.freeze({
  // ── Identité (pour le registre + le script de déploiement) ─────────────────
  id: '_pilot',
  label: 'Pilote (standard)',
  firebaseProject: null,          // le pilote ne se déploie pas tel quel

  // ── Marque ─────────────────────────────────────────────────────────────────
  branding: Object.freeze({
    appName: 'AKAYIS',
    pwaName: 'AKAYIS CRM',
    theme: 'green',
  }),

  // ── Réseaux boutique (cartes réseau + choix dans le formulaire) ────────────
  // Superset = les 5 réseaux. Un client mono-réseau met p. ex. ['Orange'].
  networks: Object.freeze({
    enabled: [...RESEAUX_SUPPORTES],
  }),

  // ── Transactions ───────────────────────────────────────────────────────────
  transactions: Object.freeze({
    types: ['Dépôt', 'Retrait', 'Crédit'],                  // Crédit inclus
    paymentMethods: [...METHODES_PAIEMENT_SUPPORTEES],       // les 6 méthodes
  }),

  // ── Édition directe des soldes réseau par la boutique (caissière) ──────────
  // true  = la boutique saisit ses soldes en direct (règle Firestore permissive,
  //         exception V1 assumée, sans piste d'audit serveur).
  // false = soldes pilotés UNIQUEMENT côté serveur.
  //   ⚠ Dépendance : passer à false avec enforcement strict impose de router les
  //   écritures de solde (y compris celles des flux de transaction) via des
  //   callables auditées — une règle Firestore ne distingue pas le chemin de code.
  //   Voir docs/client-profiles.md (« Dépendance canEditBalances »).
  cashier: Object.freeze({
    canEditBalances: true,
  }),

  // ── Circuit dealer (ravitaillement stock/liquidité) ────────────────────────
  // enabled=false → pas d'espace dealer du tout.
  // networks     → réseaux qu'UN dealer approvisionne (multi-réseaux supporté).
  //   Invariant produit conservé : un seul dealer actif dans tout le système.
  dealer: Object.freeze({
    enabled: true,
    networks: [...RESEAUX_SUPPORTES],
  }),

  // ── App mobile agents (partage des reçus/fiche vers l'app mobile) ──────────
  // Surface de SÉCURITÉ nouvelle → défaut OFF (contrairement à l'opt-out habituel :
  // exposer des données à un acteur externe ne doit JAMAIS être activé par héritage).
  //   enabled       : l'agent peut ouvrir un compte mobile et lire SES reçus + sa fiche.
  //   shareReceipts : les reçus finalisés sont exposés en lecture à l'agent concerné.
  // Un client réel l'active explicitement (voir salawu.js). Aucun câblage runtime ne
  // lit encore ce champ — il pilote la génération des règles (mobileAppEnabled()).
  mobileApp: Object.freeze({
    enabled: false,
    shareReceipts: false,
  }),

  // Mode hors-ligne (offline-first + déverrouillage local). OFF par défaut : un client réel
  // l'active explicitement (voir salawu.js). `unlock: 'password'` → vérification locale du
  // mot de passe du compte (PBKDF2 WebCrypto) ; `maxOfflineDays` borne la fenêtre hors-ligne
  // avant re-authentification en ligne obligatoire.
  offlineMode: Object.freeze({
    enabled: false,
    unlock: 'password',
    maxOfflineDays: 7,
  }),

  // ── Règles métier différenciées par réseau (déclaratif) ─────────────────────
  // Défaut = le PLUS permissif / générique (opt-out) → n'altère AUCUN client
  // existant. Aucun câblage comportemental ne lit encore ce champ (fondation posée
  // pour la Vague 2). Un client restreint réseau par réseau dans son propre profil.
  //   supplyMode              : 'dealer' | 'external_partner' — qui approvisionne le stock du réseau.
  //   agentOperations         : opérations agent/boutique autorisées ⊂ ['deposit','withdrawal'].
  //   allowStockReturn        : le stock du réseau peut-il être RETOURNÉ (agent→boutique / boutique→dealer) ?
  //   allowUnregisteredAgents : transactions sans fiche client autorisées pour ce réseau ?
  networkRules: Object.freeze({
    Orange:  Object.freeze({ supplyMode: 'dealer', agentOperations: ['deposit', 'withdrawal'], allowStockReturn: true, allowUnregisteredAgents: true }),
    Moov:    Object.freeze({ supplyMode: 'dealer', agentOperations: ['deposit', 'withdrawal'], allowStockReturn: true, allowUnregisteredAgents: true }),
    Telecel: Object.freeze({ supplyMode: 'dealer', agentOperations: ['deposit', 'withdrawal'], allowStockReturn: true, allowUnregisteredAgents: true }),
    Coris:   Object.freeze({ supplyMode: 'dealer', agentOperations: ['deposit', 'withdrawal'], allowStockReturn: true, allowUnregisteredAgents: true }),
    Sank:    Object.freeze({ supplyMode: 'dealer', agentOperations: ['deposit', 'withdrawal'], allowStockReturn: true, allowUnregisteredAgents: true }),
    Wave:    Object.freeze({ supplyMode: 'dealer', agentOperations: ['deposit', 'withdrawal'], allowStockReturn: true, allowUnregisteredAgents: true }),
  }),

  // ── Régional ────────────────────────────────────────────────────────────────
  // Fuseau horaire de référence pour l'affichage/formatage des dates : fixe le
  // rendu quel que soit le fuseau du navigateur de l'utilisateur.
  regional: Object.freeze({
    timezone: 'Africa/Ouagadougou',   // Burkina Faso (UTC+0)
  }),
})

export default pilotProfile
