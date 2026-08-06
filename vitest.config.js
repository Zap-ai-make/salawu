import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  plugins: [react()],
  test: {
    // Le suite de tests caractérise le profil de RÉFÉRENCE (TAOFIC), indépendamment
    // du VITE_CLIENT_ID du .env local (qui sert au build/déploiement d'un autre client).
    // Sans ce pin, changer .env pour builder salawu rendrait tc-092/tc-083 rouges.
    env: { VITE_CLIENT_ID: 'taofic_ajagbe' },
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    include: [
      'tests/unit/**/*.test.js',
      'tests/unit/**/*.test.jsx',
      'tests/components/**/*.test.js',
      'tests/components/**/*.test.jsx',
      'tests/integration/**/*.test.js',
      'tests/integration/**/*.test.jsx',
    ],
    globals: false,
  },
})
