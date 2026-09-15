import { IS_REGISTRE } from './designSystem.js'

/**
 * dashboardTheme.js — habillage des cartes de tableau de bord et des graphiques.
 *
 * ⚠ DEUX NATURES DE VALEURS ICI, à ne pas confondre :
 *
 *   • Le CHROME de la carte (background, border, iconBg, title, accent) est de
 *     la décoration : l'identité « registre » le remplace par du papier et des
 *     filets.
 *   • `chart` / `chartAccent` ENCODENT DES SÉRIES DE DONNÉES. Deux séries qui
 *     se ressemblent, c'est un graphique qu'on lit de travers. Ces valeurs sont
 *     donc IDENTIQUES dans les deux systèmes : la refonte n'a pas à rendre une
 *     courbe moins lisible. Idem pour NETWORK_COLORS, qui porte l'identité réelle
 *     des opérateurs.
 */

// Chrome neutre commun à toutes les « couleurs » sous l'identité : sur un tableau
// de bord, la teinte d'une carte ne dit rien du contenu — c'est son titre qui le
// dit. On garde donc les six clés (les sites d'appel les passent encore) mais
// elles rendent la même surface de papier.
const CHROME_REGISTRE = {
  background: 'from-papier',
  border: 'border-reglure',
  iconBg: 'bg-reglure/60',
  iconColor: 'bg-encre',
  title: 'text-encre',
  accent: 'text-encre-doux',
}

const DASHBOARD_COLORS_LEGACY = {
  blue: {
    background: 'from-blue-50 to-white',
    border: 'border-blue-100',
    iconBg: 'bg-blue-100',
    iconColor: 'bg-blue-500',
    title: 'text-blue-800',
    accent: 'text-blue-600',
    chart: '#3B82F6',
    chartAccent: '#1E40AF'
  },
  green: {
    background: 'from-green-50 to-white',
    border: 'border-green-100',
    iconBg: 'bg-green-100',
    iconColor: 'bg-green-500',
    title: 'text-green-800',
    accent: 'text-green-600',
    chart: '#10B981',
    chartAccent: '#059669'
  },
  orange: {
    background: 'from-orange-50 to-white',
    border: 'border-orange-100',
    iconBg: 'bg-orange-100',
    iconColor: 'bg-orange-500',
    title: 'text-orange-800',
    accent: 'text-orange-600',
    chart: '#F97316',
    chartAccent: '#EA580C'
  },
  purple: {
    background: 'from-purple-50 to-white',
    border: 'border-purple-100',
    iconBg: 'bg-purple-100',
    iconColor: 'bg-purple-500',
    title: 'text-purple-800',
    accent: 'text-purple-600',
    chart: '#8B5CF6',
    chartAccent: '#7C3AED'
  },
  emerald: {
    background: 'from-emerald-50 to-white',
    border: 'border-emerald-100',
    iconBg: 'bg-emerald-100',
    iconColor: 'bg-emerald-500',
    title: 'text-emerald-800',
    accent: 'text-emerald-600',
    chart: '#10B981',
    chartAccent: '#059669'
  },
  gray: {
    background: 'from-gray-50 to-white',
    border: 'border-gray-100',
    iconBg: 'bg-gray-100',
    iconColor: 'bg-gray-500',
    title: 'text-gray-800',
    accent: 'text-gray-600',
    chart: '#6B7280',
    chartAccent: '#374151'
  }
}

// Sous l'identité, chaque clé garde ses couleurs de GRAPHIQUE (encodage des
// données) et reçoit le chrome de papier. Construit par dérivation plutôt que
// recopié : ajouter une couleur au rendu historique la propage automatiquement,
// et les deux jeux ne peuvent pas diverger en silence.
const DASHBOARD_COLORS_REGISTRE = Object.fromEntries(
  Object.entries(DASHBOARD_COLORS_LEGACY).map(([nom, v]) => [
    nom,
    { ...CHROME_REGISTRE, chart: v.chart, chartAccent: v.chartAccent },
  ]),
)

export const DASHBOARD_COLORS = IS_REGISTRE ? DASHBOARD_COLORS_REGISTRE : DASHBOARD_COLORS_LEGACY

// Identité réelle des opérateurs : jamais retouchée par un système de design.
export const NETWORK_COLORS = {
  Orange: '#FB923C',
  Moov: '#3B82F6',
  Telecel: '#8B5CF6',
  Coris: '#EAB308',
  Sank: '#EF4444',
  Wave: '#06B6D4'
}

export const CHART_TEXT_COLORS = {
  primary: 'text-gray-700',
  secondary: 'text-gray-600',
  muted: 'text-gray-500'
}

export const getColorTheme = (colorName) => {
  return DASHBOARD_COLORS[colorName] || DASHBOARD_COLORS.gray
}

export const calculatePercentage = (value, total) => {
  return total > 0 ? ((value / total) * 100).toFixed(1) : 0
}