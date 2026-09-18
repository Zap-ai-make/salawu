import { defineConfig, devices } from '@playwright/test'

/**
 * Boucle QA — LE PROFIL EN PRODUCTION, ET RIEN QUE LUI.
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE SECOND FICHIER DE CONFIGURATION EXISTE
 *
 * Toute la refonte du design repose sur une affirmation : `.design-registre` est
 * posée sur <html> par le profil actif, donc aucune de ses règles ne peut
 * atteindre TAOFIC, qui est EN PRODUCTION.
 *
 * C'est un raisonnement solide. Ce n'était pas une mesure. Le bilan du chantier
 * (docs/audit/BILAN-REFONTE-ESAHAF.md §4) le dit sans détour : huit filets
 * montent les écrans avec les deux profils, mais « il n'existe AUCUNE
 * comparaison de pixels du rendu TAOFIC » — la boucle QA ne capturait que
 * `salawu`, parce que `playwright.config.js` fixe `VITE_CLIENT_ID: 'salawu'`.
 *
 * Ce fichier rend le profil `taofic-ajagbe` dans un VRAI moteur de rendu et
 * vérifie, sur les pixels calculés, que rien du chantier ne l'a atteint.
 *
 * ⚠ CE N'EST PAS UNE COMPARAISON AVANT / APRÈS, et il ne faut pas le prétendre.
 * Comparer à `main` demanderait de rendre la même page depuis deux révisions.
 * Ce banc fait autre chose, et de plus durable : il vérifie le MÉCANISME qui
 * garantit l'absence de changement — la classe de portée est absente, et les
 * propriétés que le chantier modifie sous cette portée gardent leurs valeurs
 * d'origine. Une comparaison de captures serait vraie un jour ; celle-ci
 * protège tous les lots à venir.
 *
 *   npm run qa:taofic
 *
 * ⚠ SÉCURITÉ (CLAUDE.md) : comme la boucle principale, ce montage impose des
 * identifiants Firebase FACTICES et les émulateurs. Même si la connexion aux
 * émulateurs échouait, le front ne pourrait joindre aucun projet réel. Il ne
 * s'agit pas de faire confiance à un drapeau, mais de rendre l'erreur impossible.
 */

// Port distinct de la boucle principale (5174) et d'un `npm run dev` (5173) :
// les deux boucles doivent pouvoir tourner sans se marcher dessus.
const PORT = 5175
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/qa-taofic',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 90_000,
  reporter: [['list'], ['html', { outputFolder: 'docs/audit/qa-report-taofic', open: 'never' }]],
  outputDir: 'docs/audit/qa-artefacts-taofic',

  use: {
    baseURL: BASE_URL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    locale: 'fr-FR',
    timezoneId: 'Africa/Ouagadougou',
  },

  // Une seule largeur, et c'est assumé. Ce banc ne juge pas une mise en page —
  // il vérifie qu'une feuille de style ne s'applique pas. La réponse est la même
  // à 375 qu'à 1440, et la boucle principale couvre déjà les trois largeurs
  // pour l'espace qui, lui, est refondu.
  projects: [
    {
      name: 'taofic-1440',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],

  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      // LA SEULE LIGNE QUI COMPTE : le profil en production, et non `salawu`.
      VITE_CLIENT_ID: 'taofic-ajagbe',
      VITE_USE_FIREBASE_EMULATORS: 'true',
      VITE_FIREBASE_PROJECT_ID: 'demo-akayis-test',
      VITE_FIREBASE_API_KEY: 'demo-cle-factice',
      VITE_FIREBASE_AUTH_DOMAIN: 'demo-akayis-test.firebaseapp.com',
      VITE_FIREBASE_STORAGE_BUCKET: 'demo-akayis-test.appspot.com',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
      VITE_FIREBASE_APP_ID: '1:000000000000:web:0000000000000000000000',
    },
  },
})
