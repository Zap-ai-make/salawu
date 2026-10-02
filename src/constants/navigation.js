import { activeProfile } from '../config/activeClientProfile.js'
import { IS_REGISTRE } from './designSystem.js'
import { AFFICHER_CIRCUITS_SECONDAIRES } from './ongletsMasques.js'

// Collaborations inter-boutiques : pertinentes uniquement en multi-réseaux (une
// boutique sans SIM sur un réseau s'appuie sur une autre). En mono-réseau (ex.
// TAOFIC) → items masqués, navigation strictement inchangée (non-régression).
export const IS_MULTI_NETWORK = (activeProfile?.networks?.enabled?.length ?? 0) > 1

// ═══════════════════════════════════════════════════════════════════════════
// LA NAVIGATION DE L'ESPACE BOUTIQUE — DEUX ORDRES, ET POURQUOI.
// ───────────────────────────────────────────────────────────────────────────
// Il y a ici DEUX listes et non une liste conditionnelle de plus. L'ordre d'une
// barre de navigation n'est pas un détail d'apparence : c'est la carte mentale
// de qui l'ouvre trente fois par jour. Le client ESAHAF a commandé le sien ; le
// client TAOFIC est en production et n'a rien demandé. Mêler les deux dans un
// seul tableau parsemé de ternaires aurait rendu impossible de lire l'ordre de
// l'un SANS dérouler les conditions de l'autre — et c'est exactement dans ce
// pli qu'un lot futur aurait déplacé une entrée pour les deux à la fois.
//
// ⚠ LE DISCRIMINANT EST `IS_REGISTRE`, JAMAIS UN IDENTIFIANT DE CLIENT. C'est
// le même mécanisme que le bandeau de marque et la bande des réserves : une
// seule lecture de `profil.design`, dans designSystem.js, et jamais ailleurs.
// ═══════════════════════════════════════════════════════════════════════════

// L'ordre historique. Il est reproduit ICI TEL QUEL, y compris « Formulaire » et
// la condition multi-réseaux : ce n'est pas un ordre qu'on maintient, c'est un
// ordre qu'on GÈLE. Toute envie de le « ranger » doit passer par une demande du
// client qui l'utilise (TC-162 le tient ligne à ligne).
const NAV_LEGACY = [
  { name: 'Tableau de bord', path: '/' },
  { name: 'Clients', path: '/clients' },
  { name: 'Transactions', path: '/transactions' },
  { name: 'Historique', path: '/historique' },
  // « Formulaire » : une entrée vers un écran qui ne fait qu'UNE chose, ajouter
  // un client. Elle survit hors de l'identité parce que TAOFIC s'en sert.
  { name: 'Formulaire', path: '/formulaire' },
  { name: 'Demandes Dealer', path: '/dealer-requests' },
  // Les collaborations sont un sous-onglet de Transactions (une collaboration EST
  // une transaction) — pas d'entrée de premier niveau. Les dettes internes gardent
  // la leur : une dette n'est pas une transaction.
  ...(IS_MULTI_NETWORK ? [
    { name: 'Dettes internes', path: '/store/debts' },
  ] : []),
  { name: 'Profil', path: '/profil' },
]

// L'ordre demandé par ESAHAF, et les trois groupes qui le portent.
//
//   'exploitation' — la journée de travail, dans son ordre : on regarde le
//                    tableau de bord, on saisit, on réclame au dealer, on règle
//                    ce qu'on doit aux autres boutiques.
//   'repertoire'   — ce qu'on consulte, et non ce qu'on fait : l'annuaire des
//                    clients et le passé. Un filet les sépare du travail courant.
//   'compte'       — ce n'est pas un écran de travail. Épinglé à droite, à part.
//
// `groupe` EST LA DONNÉE, et la barre n'en sait rien d'autre : NavBar découpe
// sur les changements de valeur et pose un filet à chaque frontière. Déplacer
// une entrée d'un groupe à l'autre se fait donc ici, en une ligne, sans toucher
// au rendu — et un client sans `groupe` (legacy) rend la barre d'avant.
//
// ⟲ « Formulaire » EST ABSENT, et c'est une décision produit du 2026-09-23,
// reconduite le 2026-09-30 : la liste Clients offre déjà « Ajouter un client »,
// qui ouvre une modale. Deux chemins pour une seule saisie, et un onglet dont le
// nom ne disait pas ce qu'il ouvrait. La route `/formulaire` redirige vers
// `/clients` (src/App.jsx) : ni signet ni raccourci PWA ne tombe dans le vide.
// ⟲ « Demandes Dealer » S'APPELLE « Ravitaillement » (2026-09-30), et l'écran
// porte désormais DEUX sous-onglets : « Ravitaillement » (le geste de la
// boutique sur sa propre carte) et « Demandes Dealer » (la livraison proposée
// par le dealer, inchangée). Le libellé nomme ce que l'onglet SERT — remplir
// une carte — plutôt que le seul circuit qui savait le faire jusqu'ici.
//
// ⚠ LE CHEMIN NE CHANGE PAS. `/dealer-requests` reste la route : un renommage
// d'URL casserait les signets, le raccourci PWA et l'historique du navigateur de
// chaque caissier, pour un gain purement cosmétique. Le libellé est ce que
// l'utilisateur lit ; le chemin est ce que son navigateur a mémorisé.
const NAV_REGISTRE = [
  { name: 'Tableau de bord', path: '/', groupe: 'exploitation' },
  { name: 'Transactions', path: '/transactions', groupe: 'exploitation' },
  { name: 'Ravitaillement', path: '/dealer-requests', groupe: 'exploitation' },
  // ⟲ MASQUÉ le 2026-09-30 (demande client), PAS SUPPRIMÉ.
  //
  // L'entrée reste écrite ICI, et la route `/store/debts` reste servie par
  // App.jsx : un signet ou un raccourci existant continue d'ouvrir l'écran des
  // dettes internes, qui fonctionne. Seul le bouton de la barre disparaît.
  // La rallumer est UNE ligne à changer dans constants/ongletsMasques.js.
  ...(AFFICHER_CIRCUITS_SECONDAIRES && IS_MULTI_NETWORK ? [
    { name: 'Dettes internes', path: '/store/debts', groupe: 'exploitation' },
  ] : []),
  { name: 'Clients', path: '/clients', groupe: 'repertoire' },
  { name: 'Historique', path: '/historique', groupe: 'repertoire' },
  { name: 'Profil', path: '/profil', groupe: 'compte' },
]

export const NAV_ITEMS = IS_REGISTRE ? NAV_REGISTRE : NAV_LEGACY

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
