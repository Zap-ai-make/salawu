import { IS_REGISTRE } from './designSystem.js'

/**
 * workspaceTheme.js — Jetons de design partagés des espaces Gérant & Dealer.
 *
 * Source unique de vérité pour les classes Tailwind de ces deux back-offices,
 * afin d'éviter la dispersion de couleurs codées en dur.
 *
 * DEUX SYSTÈMES, choisis par le profil (design.system) :
 *
 *   'legacy'   — marque AKAYIS verte, accent de rôle bleu/vert. Rendu historique,
 *                strictement inchangé pour les clients qui ne déclarent rien.
 *   'registre' — identité ESAHAF : sidebar à l'encre, surfaces de papier, filets.
 *
 * Le choix se fait ICI, une fois, et les sites d'appel n'en savent rien : ils
 * importent les mêmes noms qu'avant. Aucun composant ne teste le client.
 *
 * ── Pourquoi la sidebar passe à l'encre ────────────────────────────────────
 * Le rendu historique code en dur un vert AKAYIS, y compris pour un client dont
 * la marque est orange — incohérence relevée par l'audit (constat I1). Mais la
 * réponse n'est pas de le repeindre en orange : dans une application où six
 * opérateurs se distinguent par leur couleur, une grande surface colorée entre
 * en concurrence avec l'information. L'encre laisse les couleurs réseau être les
 * seules taches de couleur de l'écran.
 *
 * ── Pourquoi les rôles ne sont plus distingués par la couleur ──────────────
 * L'accent de rôle (Gérant = bleu, Dealer = vert) réutilisait deux teintes qui
 * appartiennent au vocabulaire métier : le vert dit « entrée d'argent », le bleu
 * dit « Moov ». Sous l'identité, le rôle est porté par son LIBELLÉ, qui était
 * déjà là et se lit sans ambiguïté.
 */

// ── Marque ──────────────────────────────────────────────────────────────────
const BRAND_LEGACY = {
  sidebar:       'bg-green-900',
  sidebarBorder: 'border-green-800',
  sidebarMuted:  'text-green-300',
  navActive:     'bg-green-700 text-white',
  navIdle:       'text-green-100 hover:bg-green-800/60 hover:text-white',
  wordmark:      'text-green-900',
}

const BRAND_REGISTRE = {
  sidebar:       'bg-encre',
  sidebarBorder: 'border-white/10',
  // Blanc atténué plutôt qu'un gris : sur l'encre, un gris moyen tombe sous le
  // seuil de contraste, et cet écran se lit en plein soleil.
  sidebarMuted:  'text-white/70',
  navActive:     'bg-white/15 text-white',
  navIdle:       'text-white/75 hover:bg-white/10 hover:text-white',
  wordmark:      'text-encre',
}

export const BRAND = IS_REGISTRE ? BRAND_REGISTRE : BRAND_LEGACY

// ── Accent par rôle (barre supérieure, labels de section, focus ring) ───────
const ROLE_ACCENT_LEGACY = {
  admin:  {
    label:    'Administration',
    bar:      'bg-blue-500',
    section:  'text-blue-300',
    ring:     'focus-visible:ring-blue-400',
  },
  dealer: {
    label:    'Espace Dealer',
    bar:      'bg-green-500',
    section:  'text-green-300',
    ring:     'focus-visible:ring-green-400',
  },
}

// Même barre à l'encre pour les deux rôles : c'est le libellé qui les distingue,
// pas la teinte. L'anneau de focus prend l'encre plutôt que le filet — un
// indicateur de focus doit être franc, pas discret.
const ROLE_ACCENT_REGISTRE = {
  admin:  {
    label:    'Administration',
    bar:      'bg-encre',
    section:  'text-white/70',
    ring:     'focus-visible:ring-encre',
  },
  dealer: {
    label:    'Espace Dealer',
    bar:      'bg-encre',
    section:  'text-white/70',
    ring:     'focus-visible:ring-encre',
  },
}

export const ROLE_ACCENT = IS_REGISTRE ? ROLE_ACCENT_REGISTRE : ROLE_ACCENT_LEGACY

export const getRoleAccent = (role) => ROLE_ACCENT[role] ?? ROLE_ACCENT.dealer

// ── Vocabulaire de surfaces ─────────────────────────────────────────────────
// L'identité troque l'ombre portée contre un filet et un rayon discret : une
// ombre molle et omniprésente ne dit rien, un trait dit « ceci est une surface ».
export const CARD = IS_REGISTRE
  ? 'rounded-md bg-papier ring-1 ring-registre'
  : 'rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm'

export const TABLE_WRAP = IS_REGISTRE
  ? 'overflow-x-auto rounded-md bg-papier ring-1 ring-registre'
  : 'overflow-x-auto rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm'

export const TABLE_HEAD = IS_REGISTRE
  ? 'bg-registre/60 text-encre'
  : 'bg-green-50/70 text-green-900'   // en-tête tinté marque

// ── Boutons ─────────────────────────────────────────────────────────────────
// L'action principale est à l'encre, pas colorée : la couleur reste réservée au
// sens d'un mouvement d'argent et à l'identité des opérateurs.
export const BTN_PRIMARY = IS_REGISTRE
  ? 'rounded-md bg-encre px-4 py-2 text-sm font-medium text-white hover:bg-encre-doux focus:outline-none focus-visible:ring-2 focus-visible:ring-encre focus-visible:ring-offset-2 disabled:opacity-50 transition-colors'
  : 'rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 disabled:opacity-50 transition-colors'

export const BTN_SECOND = IS_REGISTRE
  ? 'rounded-md border border-filet bg-papier px-4 py-2 text-sm font-medium text-encre hover:bg-registre/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-encre focus-visible:ring-offset-2 disabled:opacity-50 transition-colors'
  : 'rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 disabled:opacity-50 transition-colors'
