import { activeProfile } from '../config/activeClientProfile.js'
import { IS_REGISTRE } from './designSystem.js'

// Collaborations inter-boutiques : pertinentes uniquement en multi-réseaux (une
// boutique sans SIM sur un réseau s'appuie sur une autre). En mono-réseau (ex.
// TAOFIC) → items masqués, navigation strictement inchangée (non-régression).
export const IS_MULTI_NETWORK = (activeProfile?.networks?.enabled?.length ?? 0) > 1

export const NAV_ITEMS = [
  { name: 'Tableau de bord', path: '/' },
  { name: 'Clients', path: '/clients' },
  { name: 'Transactions', path: '/transactions' },
  { name: 'Historique', path: '/historique' },
  // ⟲ « Formulaire » N'EXISTE PLUS QUE HORS DE L'IDENTITE « REGISTRE ».
  //
  // C'est une entrée de navigation vers un écran qui ne fait qu'UNE chose :
  // ajouter un client. La liste Clients offre déjà « Ajouter un client », qui y
  // mène — deux chemins pour une seule saisie, et un onglet dont le nom ne dit
  // pas ce qu'il ouvre. Sous l'identité, l'ajout passe par une modale ouverte
  // depuis la liste, et la route `/formulaire` redirige vers `/clients`
  // (src/App.jsx) : ni signet ni raccourci PWA ne tombe dans le vide.
  //
  // ⚠ `IS_REGISTRE` ET NON UN IDENTIFIANT DE CLIENT, et surtout pas un booléen
  // de plus. TAOFIC est en production et n'a rien demandé : il garde son onglet,
  // son écran et son formulaire pleine page, à l'octet près. C'est le même
  // mécanisme que le bandeau de marque et la bande des réserves — une seule
  // lecture de `profil.design`, dans designSystem.js, et jamais ailleurs.
  ...(IS_REGISTRE ? [] : [
    { name: 'Formulaire', path: '/formulaire' },
  ]),
  { name: 'Demandes Dealer', path: '/dealer-requests' },
  // Les collaborations sont un sous-onglet de Transactions (une collaboration EST
  // une transaction) — pas d'entrée de premier niveau. Les dettes internes gardent
  // la leur : une dette n'est pas une transaction.
  ...(IS_MULTI_NETWORK ? [
    { name: 'Dettes internes', path: '/store/debts' },
  ] : []),
  { name: 'Profil', path: '/profil' }
]

/** Alias sémantique pour l'espace Boutique (store_admin) — utilisé dans NavBar. */
export const STORE_NAV_ITEMS = NAV_ITEMS

export const ADMIN_NAV_ITEMS = [
  { name: 'Vue générale', path: '/admin', section: 'main' },
  { name: 'Boutiques', path: '/admin/stores', section: 'supervision' },
  { name: 'Utilisateurs', path: '/admin/users', section: 'supervision' },
  { name: 'Dealer', path: '/admin/dealer', section: 'supervision' },
  { name: 'Inventaire Dealer', path: '/admin/dealer-inventory', section: 'supervision' },
  { name: 'Clients', path: '/admin/clients', section: 'supervision' },
  { name: 'Historique', path: '/admin/history', section: 'supervision' },
  { name: 'Rapports', path: '/admin/reports', section: 'supervision' },
  { name: 'Profil', path: '/admin/profile', section: 'admin' },
]

export const DEALER_NAV_ITEMS = [
  { name: 'Vue générale', path: '/dealer' },
  { name: 'Boutiques', path: '/dealer/stores' },
  { name: 'Ravitaillements', path: '/dealer/requests' },
  { name: 'Retours boutiques', path: '/dealer/transfers' },
  { name: 'Historique', path: '/dealer/history' },
  { name: 'Profil', path: '/dealer/profile' },
]
