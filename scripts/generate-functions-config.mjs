#!/usr/bin/env node
/**
 * generate-functions-config.mjs — régénère les configs runtime des Cloud Functions
 * depuis le profil d'un client :
 *   • functions/src/config/dealerProfile.js   (réseaux dealer)
 *   • functions/src/config/mobileAppProfile.js (app mobile agents : enabled + préfixe)
 *
 *   node scripts/generate-functions-config.mjs --client taofic_ajagbe          # régénère
 *   node scripts/generate-functions-config.mjs --client taofic_ajagbe --check  # échoue si dérive (CI)
 *
 * À lancer au déploiement, en tandem avec scripts/generate-rules.mjs, pour aligner
 * les 3 couches (front, règles, functions) sur le même profil client.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { resolveProfile } from '../config/clients/index.js'
import { generateDealerProfileFile } from './lib/generateDealerProfile.mjs'
import { generateMobileAppProfileFile } from './lib/generateMobileAppProfile.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Chaque cible : chemin du fichier généré + fonction pure qui produit son contenu.
const TARGETS = [
  { path: resolve(__dirname, '../functions/src/config/dealerProfile.js'), generate: generateDealerProfileFile },
  { path: resolve(__dirname, '../functions/src/config/mobileAppProfile.js'), generate: generateMobileAppProfileFile },
]

function argValue(flag) {
  const i = process.argv.indexOf(flag)
  return i !== -1 ? process.argv[i + 1] : undefined
}

const clientId = argValue('--client')
const check = process.argv.includes('--check')

if (!clientId) {
  console.error('Usage : node scripts/generate-functions-config.mjs --client <id> [--check]')
  process.exit(2)
}

const profile = resolveProfile(clientId)
let drift = false

for (const { path, generate } of TARGETS) {
  const generated = generate(profile)
  const current = readFileSync(path, 'utf8')
  // Préserve la fin de ligne du fichier (CRLF sous Windows) pour un --check stable.
  const eol = current.includes('\r\n') ? '\r\n' : '\n'
  const next = generated.replace(/\n/g, eol)
  const name = path.split(/[\\/]/).pop()

  if (check) {
    if (next !== current) {
      console.error(`Dérive : functions/src/config/${name} ne correspond pas au profil "${clientId}". Régénérez sans --check.`)
      drift = true
    } else {
      console.log(`OK — ${name} à jour pour le profil "${clientId}".`)
    }
  } else {
    writeFileSync(path, next)
    console.log(`functions/src/config/${name} régénéré pour le profil "${clientId}".`)
  }
}

if (check && drift) process.exit(1)
