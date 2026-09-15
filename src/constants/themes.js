import { getStorageKey } from '../config/clientIsolation'
import { IS_REGISTRE } from './designSystem.js'

/**
 * themes.js — catalogue des apparences servies par l'application.
 * ─────────────────────────────────────────────────────────────────────────────
 * DEUX entrées, et deux seulement, parce que deux clients existent :
 *
 *   registre → ESAHAF (design.system = 'registre'), identité dessinée
 *   dark     → tout profil resté en 'legacy', dont TAOFIC en production
 *
 * Le catalogue en comptait huit. Six ne pouvaient être atteints par AUCUN
 * chemin de code : la page qui permettait de choisir un thème
 * (src/pages/Personnalisation.jsx) a été retirée le 2026-05-29, un commit après
 * la création du dépôt (d72d5d7 → 32e21b0). Depuis, `changeTheme` n'a plus
 * jamais eu de site d'appel, et `currentTheme` ne peut donc valoir que
 * DEFAULT_THEME. Un catalogue de huit apparences pour un produit qui n'en
 * expose aucune, c'était la principale source de la palette générique.
 *
 * Un identifiant résiduel dans localStorage (hérité de cette page) reste sans
 * danger : ThemeContext filtre par `THEMES[saved]`, donc une valeur devenue
 * inconnue retombe sur DEFAULT_THEME. TC-158 le vérifie.
 *
 * ⚠ Ne pas remettre de thème ici pour « faire joli » : la couleur de cette
 * application appartient aux jetons de src/index.css et aux six couleurs
 * opérateur de src/constants/networkConfig.js.
 */
export const THEMES = {
  // ── Identité « registre » (ESAHAF) ─────────────────────────────────────────
  // Dérivée des jetons @theme de src/index.css, pas de la palette Tailwind par
  // défaut. Elle n'est atteignable que par un profil déclarant design.system =
  // 'registre' : DEFAULT_THEME ci-dessous ne la sélectionne pas autrement, et
  // aucun autre client ne peut y tomber.
  //
  // `backgroundImage` : le bandeau photo est RÉTABLI à la demande explicite du
  // client (2026-09-04), après l'avoir vu retiré. Le constat I4 du bilan (1,8 Mo
  // de décor précaché dans une PWA destinée à des connexions instables) reste
  // exact — c'est un arbitrage assumé entre poids et identité visuelle, et il
  // appartient au client, pas à l'audit.
  //
  // ⚠ Ce champ ne se change pas seul. Deux choses en dépendent :
  //   • vite.config.js doit garder bg-noir.png dans le précache d'ESAHAF, sinon
  //     le fond manque hors connexion — or le profil salawu active `offlineMode`.
  //   • Layout.jsx rend un bandeau de marque compact quand ce champ est nul, et
  //     le bandeau photo de 200 px sinon. Le seuil de bascule de la navbar suit
  //     automatiquement (il est mesuré, cf. TC-159) : rien d'autre à ajuster.
  registre: {
    id: 'registre',
    name: 'ESAHAF — registre',
    backgroundImage: '/bg-noir.png',
    classes: {
      background: 'bg-papier',
      text: 'text-encre',
      accent: 'bg-encre',
      // Barre de navigation à l'encre : calme, et surtout elle laisse les six
      // couleurs opérateur être les seules taches de couleur de l'écran.
      navbar: 'bg-encre text-white',
      // `border-filet` (3,81:1) et NON `border-reglure` (1,21:1) : une réglure
      // de tableau structure la lecture d'une colonne de montants — en plein
      // soleil, un trait à 1,21:1 est invisible et la colonne se disloque.
      // Chiffre vérifié par `npm run qa:jetons`, pas recopié.
      tableHeader: 'bg-reglure/60 border-filet',
      tableAccent: 'bg-reglure/30',
    }
  },

  // ── Apparence historique (TAOFIC, et tout profil 'legacy') ─────────────────
  // Conservée À L'IDENTIQUE, octet pour octet : c'est ce que rend un client en
  // production. TC-158 fige ces six chaînes ; ne pas les « harmoniser » avec les
  // jetons ESAHAF, ce serait faire entrer la refonte chez un autre client.
  dark: {
    id: 'dark',
    name: 'Thème Sombre',
    backgroundImage: '/bg-noir.png',
    classes: {
      background: 'bg-slate-100',
      text: 'text-gray-900',
      accent: 'bg-slate-900',
      navbar: 'bg-slate-950/95 backdrop-blur-sm text-white',
      tableHeader: 'bg-slate-100/80 border-slate-300',
      tableAccent: 'bg-slate-50/60'
    }
  }
}

// L'apparence d'un client est décidée par UN SEUL axe : `design.system` du
// profil. Auparavant une seconde table (BRAND_DEFAULT_THEME) faisait aussi
// dériver l'apparence de `branding.theme` — deux mécanismes concurrents pour la
// même question, exactement la dispersion que ce chantier supprime. La marque
// pilote désormais le nom, le logo et la couleur du manifeste ; pas le chrome.
//
// TAOFIC (branding.theme = 'green') rendait déjà 'dark' : son résultat est
// inchangé, seul le chemin qui y mène est devenu direct.
export const DEFAULT_THEME = IS_REGISTRE ? 'registre' : 'dark'

export const STORAGE_KEY = getStorageKey('theme')
