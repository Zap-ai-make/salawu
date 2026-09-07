import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { resolveProfile } from './config/clients/index.js'
import { pilotProfile } from './config/clients/_pilot.js'

/**
 * Configuration Vite pour le CRM (produit standard paramétré par profil client).
 * - React avec SWC pour compilation rapide
 * - Tailwind CSS v4 intégré
 * - PWA avec Service Worker automatique
 *
 * La marque (titre d'onglet, meta, nom PWA) dérive du profil du client ciblé par
 * VITE_CLIENT_ID — même source que le runtime (src/constants/branding.js). Défaut
 * « AKAYIS CRM » si l'id est absent/inconnu, pour ne jamais casser un build.
 */

// Résout la marque build-time depuis le profil. Défaut = marque du pilote (même
// repli que le runtime src/config/activeClientProfile.js → une seule source de vérité).
function resolveBuildBranding(clientId) {
  const fallback = pilotProfile.branding
  try {
    return resolveProfile(clientId).branding ?? fallback
  } catch {
    return fallback
  }
}

// Couleur de marque (barre d'adresse mobile / meta theme-color) dérivée du thème
// déclaré par le profil (branding.theme). Conservateur comme DEFAULT_THEME : seules les
// marques explicitement mappées changent ; tout le reste (dont TAOFIC 'green') garde le
// bleu historique #3b82f6 — comportement PWA inchangé pour les clients non mappés.
const BRAND_THEME_COLOR = { orange: '#ea580c' }
function resolveThemeColor(theme, designSystem) {
  // Un client portant une identité dessinée impose sa couleur de chrome : sur
  // Android, theme_color peint la barre d'état et la vignette du sélecteur
  // d'applications. La laisser sur l'orange de marque alors que la barre de
  // navigation est passée à l'encre donnerait un bandeau discordant AU-DESSUS
  // de l'application — précisément sur l'appareil visé.
  // #15202b est le jeton --color-encre de src/index.css, pas une valeur libre.
  if (designSystem === 'registre') return '#15202b'
  return BRAND_THEME_COLOR[theme] ?? '#3b82f6'
}

// Système visuel du client ciblé — même axe de profil que le runtime
// (src/constants/designSystem.js). Sert à ne précacher les polices que pour les
// clients qui les utilisent : sans ça, un client resté en 'legacy' embarquerait
// ~104 Ko de woff2 jamais affichés, dans une PWA destinée à des connexions
// instables. Repli 'legacy' comme partout ailleurs.
function resolveDesignSystem(clientId) {
  try {
    return resolveProfile(clientId).design?.system ?? 'legacy'
  } catch {
    return pilotProfile.design?.system ?? 'legacy'
  }
}

// Injecte la marque dans index.html (titre + meta) au build/dev. On utilise des
// fonctions de remplacement : le 2e argument littéral de String.replace interprète
// `$&`/`$1`/`$\`` → une marque contenant `$` corromprait la sortie. Les fonctions non.
function brandingHtmlPlugin({ appFullName, description, themeColor }) {
  return {
    name: 'branding-html',
    transformIndexHtml(html) {
      return html
        .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${appFullName}</title>`)
        .replace(/(<meta name="description" content=")[\s\S]*?(">)/, (_m, p1, p2) => `${p1}${description}${p2}`)
        .replace(/(<meta name="apple-mobile-web-app-title" content=")[\s\S]*?(">)/, (_m, p1, p2) => `${p1}${appFullName}${p2}`)
        .replace(/(<meta name="theme-color" content=")[\s\S]*?(">)/, (_m, p1, p2) => `${p1}${themeColor}${p2}`)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const branding = resolveBuildBranding(env.VITE_CLIENT_ID)
  const appFullName = branding.pwaName
  const description = `Application CRM pour la gestion des clients et transactions de ${branding.appName}`
  const designSystem = resolveDesignSystem(env.VITE_CLIENT_ID)
  const themeColor = resolveThemeColor(branding.theme, designSystem)

  return {
  build: {
    rollupOptions: {
      output: {
        // Découpe les grosses dépendances en chunks vendor séparés : cache stable entre
        // déploiements et sortie du chemin critique. Recharts (+ d3/victory) ne charge
        // qu'avec le Dashboard (route lazy), Firebase reste au boot (auth) mais isolé.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-vendor')) return 'vendor-recharts'
          if (id.includes('/firebase/') || id.includes('/@firebase/')) return 'vendor-firebase'
          if (id.includes('/react-router') || id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) return 'vendor-react'
          return undefined
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    brandingHtmlPlugin({ appFullName, description, themeColor }),
    VitePWA({
      // Auto-update du SW quand une nouvelle version est disponible
      registerType: 'autoUpdate',
      injectRegister: 'auto',

      // Activer le PWA en dev pour tester facilement
      devOptions: {
        enabled: true,
        type: 'module'
      },

      // Configuration du Service Worker (Workbox)
      workbox: {
        // Fichiers à mettre en cache automatiquement.
        // Les polices ne sont précachées QUE pour les clients qui les affichent.
        //  • identité « registre » (ESAHAF) : `woff2` est indispensable — ce profil
        //    active `offlineMode`, et une police non précachée retomberait sur la
        //    police système au premier usage hors connexion, changeant l'aspect de
        //    l'application au moment précis où l'agent est sur le terrain.
        //  • 'legacy' (TAOFIC) : elles ne sont jamais affichées, les précacher
        //    imposerait ~104 Ko inutiles à une PWA sur connexion instable.
        globPatterns: designSystem === 'registre'
          ? ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,woff2}']
          : ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp}'],
        // Deux mécanismes alimentent le manifeste, et il faut les traiter TOUS LES
        // DEUX — constaté au build, en trois essais :
        //   • `globPatterns` ratisse dist/ ; `globIgnores` (ici) en retire.
        //   • `includeAssets` (plus bas) AJOUTE par-dessus et ignore `globIgnores` :
        //     un fichier listé ici mais couvert par un motif d'includeAssets
        //     revient quand même dans le précache.
        // Chaque motif est écrit SANS `**/` : ces fichiers sont copiés à la racine
        // de dist/, et `**/` exige au moins un segment de répertoire.
        //
        // ⚠ `bg-noir.png` N'EST PLUS exclu : le client a demandé le rétablissement
        // du bandeau photo (2026-09-04). Il DOIT être précaché — le profil salawu
        // active `offlineMode`, et un fond servi en ligne mais absent du cache
        // donnerait un écran différent selon la connexion. Cette ligne suit donc
        // `THEMES.registre.backgroundImage` : si l'image redevient nulle un jour,
        // remettre 'bg-noir.png' ici.
        //
        // Restent écartés sous l'identité « registre » :
        //   • akayis-bg.* et akayis-logo.* (~175 Ko) — zéro référence dans le
        //     code (vérifié), et marque d'un autre client. Les fichiers restent
        //     dans public/ : on ne les précache plus, on ne les supprime pas.
        globIgnores: designSystem === 'registre'
          ? ['akayis-bg.png', 'akayis-bg.svg', 'akayis-logo.png', 'akayis-logo.svg']
          : [],
        navigateFallback: '/index.html',
        navigateFallbackAllowlist: [/^\/(?!__).*/],

        // Nettoyer les anciens caches à chaque déploiement
        cleanupOutdatedCaches: true,

        // Stratégies de cache pour les ressources externes
        runtimeCaching: [
          // Google Fonts - feuilles de style CSS
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst', // Cache d'abord car change rarement
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 an
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Google Fonts - fichiers de police
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Firebase Realtime Database
          {
            urlPattern: /^https:\/\/.*\.firebaseio\.com\/.*/i,
            handler: 'NetworkFirst', // Réseau en premier pour données fraîches
            options: {
              cacheName: 'firebase-data',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 jours
              }
            }
          },
          // Firebase App (Auth, Firestore)
          {
            urlPattern: /^https:\/\/.*\.firebaseapp\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firebase-app',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 jours
              }
            }
          }
        ]
      },
      // Assets à inclure dans le cache
      // `includeAssets` ajoute EXPLICITEMENT ces fichiers au manifeste de précache
      // et court-circuite `globIgnores` — c'est par ce `*.png` que bg-noir.png
      // revenait malgré son exclusion (constaté, pas supposé).
      //
      // Sous l'identité « registre », on ÉNUMÈRE au lieu de ratisser : `*.svg`
      // réintroduisait akayis-bg.svg et akayis-logo.svg — la marque d'un autre
      // client — malgré leur présence dans `globIgnores`. L'énumération reste le
      // bon mécanisme ; seule sa liste change.
      //
      // `bg-noir.png` y figure de nouveau : le bandeau photo est rétabli à la
      // demande du client, et il doit être disponible hors connexion.
      // Restent écartés : akayis-bg.png et akayis-logo.png (~175 Ko, zéro
      // référence dans le code, marque d'un autre client).
      includeAssets: designSystem === 'registre'
        ? ['favicon.ico', 'brand-mark.svg', 'pwa-192x192.png', 'pwa-512x512.png', 'bg-noir.png']
        : ['*.ico', '*.svg', '*.png', '*.jpg'],

      // Manifest PWA - métadonnées de l'application
      manifest: {
        name: appFullName,
        short_name: appFullName,
        description,
        theme_color: themeColor, // Couleur de la barre d'adresse mobile (dérivée du profil)
        background_color: '#ffffff',
        display: 'standalone', // Affichage en plein écran (comme une app native)
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        lang: 'fr',
        categories: ['business', 'productivity', 'utilities'],

        // Icônes de l'app (utilisées sur l'écran d'accueil)
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any' // Icône standard
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable' // Icône adaptive (s'adapte aux formes d'icônes Android)
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
  }
})
