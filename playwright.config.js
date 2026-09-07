import { defineConfig, devices } from '@playwright/test'

/**
 * Boucle QA visuelle — protocole `browser-qa` d'ECC adapté (DESIGN.md §14).
 * ─────────────────────────────────────────────────────────────────────────────
 * Elle existe parce que la suite vitest ne peut PAS voir certains défauts : jsdom
 * ne calcule aucune mise en page. Le bug du seuil de la navbar (TC-159) en est la
 * démonstration — 2268 tests verts, et un `offsetTop` faux invisible par
 * construction. Ce qui suit rend les pages dans un vrai moteur.
 *
 * ⚠ SÉCURITÉ (CLAUDE.md) : `VITE_USE_FIREBASE_EMULATORS=true` est imposé ici et
 * non laissé au `.env` local — lequel pointe sur le Firestore RÉEL de production.
 * Aucune exécution de cette boucle ne doit pouvoir écrire chez le client.
 *
 * Trois points de rupture, imposés par le protocole et par l'usage réel :
 *   375  — le téléphone d'entrée de gamme du caissier, le cas dimensionnant
 *   768  — tablette
 *   1440 — poste du gérant
 */

const PORT = 5174 // volontairement différent du 5173 d'un `npm run dev` en cours
// `localhost` et NON `127.0.0.1` : vite écoute sur `localhost`, qui résout en
// IPv6 (::1) sur cette machine. Interroger 127.0.0.1 (IPv4) trouvait porte close
// et Playwright concluait à un serveur lent — 120 s d'attente pour un serveur
// prêt en 2 s. Le symptôme (timeout) ne désignait pas la cause (mauvaise pile).
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/qa',
  // Sérialisé : la boucle partage un émulateur et un serveur de dev, et le
  // parallélisme est précisément ce qui rend cette machine instable (cf. les
  // « Failed to start worker » de la suite vitest).
  workers: 1,
  fullyParallel: false,
  // Aucun `retries` : un test visuel qui ne passe qu'à la seconde tentative
  // cache un vrai problème de timing plutôt qu'il ne le corrige.
  retries: 0,
  // 60 s et non les 30 s par défaut : le PREMIER test d'un run paie la
  // compilation à froid de Vite (~25 s mesurées), et il échouait pour cette
  // seule raison. Relever le délai traite la lenteur réelle du démarrage ; ce
  // n'est pas la même chose que d'autoriser une nouvelle tentative, qui aurait
  // masqué le problème au lieu de l'expliquer.
  timeout: 60_000,
  reporter: [['list'], ['html', { outputFolder: 'docs/audit/qa-report', open: 'never' }]],
  outputDir: 'docs/audit/qa-artefacts',

  use: {
    baseURL: BASE_URL,
    // Capture systématique : c'est le livrable de cette boucle, pas un extra.
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    locale: 'fr-FR',
    timezoneId: 'Africa/Ouagadougou',
  },

  projects: [
    {
      name: 'mobile-375',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 } },
    },
    {
      name: 'tablette-768',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'bureau-1440',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],

  webServer: {
    // `vite` et non `npm run dev` : on impose les variables d'environnement ici,
    // sans dépendre du .env local du poste.
    command: `npx vite --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_CLIENT_ID: 'salawu',
      VITE_USE_FIREBASE_EMULATORS: 'true',

      // L'émulateur Firestore cloisonne les données par identifiant de projet :
      // sans cette ligne, le front interrogerait l'émulateur sous
      // `salawu-fa726` pendant que le seed écrit sous `demo-akayis-test`, et
      // tous les écrans seraient vides sans la moindre erreur.
      //
      // C'est aussi la garantie de sûreté la plus forte de ce montage : projet
      // et clé factices: même si la connexion aux émulateurs échouait, le front
      // ne pourrait joindre AUCUN projet réel. Il ne s'agit pas de faire
      // confiance à `VITE_USE_FIREBASE_EMULATORS`, mais de rendre l'erreur
      // impossible.
      VITE_FIREBASE_PROJECT_ID: 'demo-akayis-test',
      VITE_FIREBASE_API_KEY: 'demo-cle-factice',
      VITE_FIREBASE_AUTH_DOMAIN: 'demo-akayis-test.firebaseapp.com',
      VITE_FIREBASE_STORAGE_BUCKET: 'demo-akayis-test.appspot.com',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
      VITE_FIREBASE_APP_ID: '1:000000000000:web:0000000000000000000000',
    },
  },
})
