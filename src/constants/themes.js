import { getStorageKey } from '../config/clientIsolation'
import { BRAND_THEME } from './branding.js'

export const THEMES = {
  blue: {
    id: 'blue',
    name: 'Thème Bleu',
    backgroundImage: '/bg-noir.png',
    classes: {
      background: 'bg-blue-50',
      text: 'text-gray-900',
      accent: 'bg-blue-600',
      navbar: 'bg-blue-600/95 backdrop-blur-sm',
      tableHeader: 'bg-blue-100/80 border-blue-300',
      tableAccent: 'bg-blue-50/60'
    }
  },
  light: {
    id: 'light',
    name: 'Thème Clair',
    backgroundImage: '/bg-noir.png',
    classes: {
      background: 'bg-white',
      text: 'text-gray-900',
      accent: 'bg-gray-600',
      navbar: 'bg-gray-600/95 backdrop-blur-sm text-white',
      tableHeader: 'bg-gray-100/80 border-gray-300',
      tableAccent: 'bg-gray-50/60'
    }
  },
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
  },
  green: {
    id: 'green',
    name: 'Thème Vert',
    backgroundImage: '/bg-noir.png',
    classes: {
      background: 'bg-green-50',
      text: 'text-gray-900',
      accent: 'bg-green-600',
      navbar: 'bg-green-600/95 backdrop-blur-sm',
      tableHeader: 'bg-green-100/80 border-green-300',
      tableAccent: 'bg-green-50/60'
    }
  },
  orange: {
    id: 'orange',
    name: 'Thème Orange',
    backgroundImage: '/bg-noir.png',
    classes: {
      background: 'bg-orange-50',
      text: 'text-gray-900',
      accent: 'bg-orange-600',
      navbar: 'bg-orange-600/95 backdrop-blur-sm',
      tableHeader: 'bg-orange-100/80 border-orange-300',
      tableAccent: 'bg-orange-50/60'
    }
  },
  purple: {
    id: 'purple',
    name: 'Thème Violet',
    backgroundImage: '/bg-noir.png',
    classes: {
      background: 'bg-purple-50',
      text: 'text-gray-900',
      accent: 'bg-purple-600',
      navbar: 'bg-purple-600/95 backdrop-blur-sm',
      tableHeader: 'bg-purple-100/80 border-purple-300',
      tableAccent: 'bg-purple-50/60'
    }
  },
  custom: {
    id: 'custom',
    name: 'Couleur personnalisée',
    backgroundImage: '/bg-noir.png',
    classes: {
      background: 'bg-white',
      text: 'text-gray-900',
      accent: 'bg-blue-500',
      navbar: 'bg-blue-500/95 backdrop-blur-sm',
      tableHeader: 'bg-gray-100/80 border-gray-300',
      tableAccent: 'bg-gray-50/60'
    }
  }
}

// Thème par défaut dérivé de la marque du profil client actif (branding.theme).
// Conservateur : seules les marques explicitement mappées ici pilotent le défaut ;
// toute autre marque (dont 'green' = TAOFIC/pilote) retombe sur 'dark' — le
// comportement historique reste identique pour les clients non mappés.
const BRAND_DEFAULT_THEME = { orange: 'orange' }

export const DEFAULT_THEME = BRAND_DEFAULT_THEME[BRAND_THEME] ?? 'dark'

export const STORAGE_KEY = getStorageKey('theme')
