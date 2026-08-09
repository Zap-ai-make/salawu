import { activeProfile } from '../config/activeClientProfile.js'

// Collaborations inter-boutiques : pertinentes uniquement en multi-réseaux (une
// boutique sans SIM sur un réseau s'appuie sur une autre). En mono-réseau (ex.
// TAOFIC) → items masqués, navigation strictement inchangée (non-régression).
const IS_MULTI_NETWORK = (activeProfile?.networks?.enabled?.length ?? 0) > 1

export const NAV_ITEMS = [
  { name: 'Tableau de bord', path: '/' },
  { name: 'Clients', path: '/clients' },
  { name: 'Transactions', path: '/transactions' },
  { name: 'Historique', path: '/historique' },
  { name: 'Formulaire', path: '/formulaire' },
  { name: 'Demandes Dealer', path: '/dealer-requests' },
  ...(IS_MULTI_NETWORK ? [
    { name: 'Collaborations', path: '/store/collaborations' },
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
