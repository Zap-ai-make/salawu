#!/usr/bin/env node
/**
 * apply-branding.mjs — applique les IMAGES de logo d'un client avant le build/déploiement.
 *
 *   node scripts/apply-branding.mjs --client salawu
 *
 * Copie branding/<clientId>/{brand-mark.svg,pwa-192x192.png,pwa-512x512.png} dans public/
 * (mêmes noms de fichiers — cf. docs : « Remplacer seulement les images de logo »). Les noms
 * sont volontairement NEUTRES : index.html est statique et ne peut référencer qu'un seul nom
 * pour tous les clients, donc le fichier ne porte jamais le nom d'un client — c'est le dossier
 * branding/<clientId>/ qui porte l'identité. C'est un geste de DÉPLOIEMENT transitoire (comme
 * la régénération des règles).
 *
 * Sûr par défaut : si le client n'a pas de dossier branding dédié (ex. taofic_ajagbe), le
 * script ne fait RIEN — la marque déjà présente dans public/ reste en place. Depuis 1de88c2,
 * c'est celle d'ESAHAF (dépôt dédié à ce client).
 *
 * À enchaîner : node scripts/apply-branding.mjs --client <id> && VITE_CLIENT_ID=<id> npm run build
 */

import { existsSync, copyFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')

// Même normalisation que config/clients/index.js et src/config/clientIsolation.js.
function normalizeClientId(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function argValue(flag) {
  const i = process.argv.indexOf(flag)
  return i !== -1 ? process.argv[i + 1] : undefined
}

const rawClient = argValue('--client') ?? process.env.VITE_CLIENT_ID ?? process.env.CLIENT_ID
if (!rawClient) {
  console.error('Usage : node scripts/apply-branding.mjs --client <id>')
  process.exit(2)
}

const clientId = normalizeClientId(rawClient)
const brandingDir = resolve(repoRoot, 'branding', clientId)
const publicDir = resolve(repoRoot, 'public')

const ASSETS = ['brand-mark.svg', 'pwa-192x192.png', 'pwa-512x512.png']

if (!existsSync(brandingDir)) {
  console.log(`Aucun dossier branding/${clientId} — marque par défaut (public/) conservée. Rien à faire.`)
  process.exit(0)
}

mkdirSync(publicDir, { recursive: true })
let applied = 0
for (const asset of ASSETS) {
  const src = resolve(brandingDir, asset)
  if (!existsSync(src)) {
    console.warn(`  ⚠ branding/${clientId}/${asset} manquant — ignoré.`)
    continue
  }
  copyFileSync(src, resolve(publicDir, asset))
  console.log(`  ✓ public/${asset} ← branding/${clientId}/${asset}`)
  applied += 1
}

console.log(`Marque « ${clientId} » appliquée (${applied}/${ASSETS.length} image(s)). Ne pas committer public/ sur main.`)
