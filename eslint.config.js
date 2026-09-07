import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Les deux derniers sont des SORTIES de la boucle QA Playwright (rapport HTML
  // et artefacts d'échec). Ils contiennent du JavaScript groupé et minifié : sans
  // cette exclusion, `npm run lint` remonte des centaines d'erreurs dans du code
  // qui n'est pas le nôtre et masque les vraies.
  globalIgnores(['dist', 'dev-dist', 'docs/audit/qa-report', 'docs/audit/qa-artefacts']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', {
        varsIgnorePattern: '^[A-Z_]',
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      'react-refresh/only-export-components': 'off',
    },
  },
])
