/**
 * TC-084 — Génération du bloc « PROFIL-GÉNÉRÉ » des règles depuis le profil client.
 *
 * Chantier dealer multi-réseaux (couche règles). Vérifie :
 *   • le générateur produit la liste de réseaux dealer du profil ;
 *   • comportement-préservant TAOFIC : ['Orange'] (équivaut à data.network == 'Orange') ;
 *   • un profil multi-réseaux élargit la liste ;
 *   • profil invalide (dealer.networks vide) → erreur ;
 *   • ANTI-DÉRIVE : firestore.rules commité contient exactement le bloc généré pour TAOFIC
 *     (sinon `node scripts/generate-rules.mjs --client taofic_ajagbe` doit être relancé).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveProfile } from '../../config/clients/index.js'
import { generateProfileRulesBlock } from '../../scripts/lib/generateRulesBlock.mjs'
import { generateDealerProfileFile } from '../../scripts/lib/generateDealerProfile.mjs'
import { generateMobileAppProfileFile } from '../../scripts/lib/generateMobileAppProfile.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rulesPath = resolve(__dirname, '../../firestore.rules')
const dealerProfilePath = resolve(__dirname, '../../functions/src/config/dealerProfile.js')
const mobileAppProfilePath = resolve(__dirname, '../../functions/src/config/mobileAppProfile.js')

describe('TC-084 — Génération des règles depuis le profil (axe dealer)', () => {
  it('TAOFIC → un seul réseau dealer (Orange), équivalent au comportement historique', () => {
    const block = generateProfileRulesBlock(resolveProfile('taofic_ajagbe'))
    expect(block).toContain("function profileDealerNetworks() { return ['Orange']; }")
  })

  it('profil multi-réseaux → liste élargie', () => {
    const block = generateProfileRulesBlock({ dealer: { networks: ['Orange', 'Moov', 'Telecel', 'Coris', 'Sank'] } })
    expect(block).toContain("return ['Orange', 'Moov', 'Telecel', 'Coris', 'Sank']")
  })

  it('profil pilote → les 5 réseaux (opt-out : tout activé)', () => {
    const block = generateProfileRulesBlock(resolveProfile('_pilot'))
    expect(block).toContain("'Orange', 'Moov', 'Telecel', 'Coris', 'Sank'")
  })

  it('dealer.networks vide → erreur explicite (pas de règle réseau vide)', () => {
    expect(() => generateProfileRulesBlock({ dealer: { networks: [] } })).toThrow(/liste non vide/)
  })

  it('ANTI-DÉRIVE : firestore.rules contient le bloc généré pour TAOFIC', () => {
    const rules = readFileSync(rulesPath, 'utf8').replace(/\r\n/g, '\n')
    const block = generateProfileRulesBlock(resolveProfile('taofic_ajagbe'))
    expect(rules).toContain(block)
  })
})

describe('TC-084c — Génération du toggle mobileApp (mobileAppEnabled)', () => {
  it('salawu (mobileApp activée) → mobileAppEnabled() = true', () => {
    const block = generateProfileRulesBlock(resolveProfile('salawu'))
    expect(block).toContain('function mobileAppEnabled() { return true; }')
  })

  it('TAOFIC (défaut hérité) → mobileAppEnabled() = false', () => {
    const block = generateProfileRulesBlock(resolveProfile('taofic_ajagbe'))
    expect(block).toContain('function mobileAppEnabled() { return false; }')
  })

  it('profil sans axe mobileApp → défaut sûr false', () => {
    const block = generateProfileRulesBlock({ dealer: { networks: ['Orange'] } })
    expect(block).toContain('function mobileAppEnabled() { return false; }')
  })

  it('ANTI-DÉRIVE : firestore.rules commité porte le toggle TAOFIC (false)', () => {
    const rules = readFileSync(rulesPath, 'utf8').replace(/\r\n/g, '\n')
    expect(rules).toContain('function mobileAppEnabled() { return false; }')
  })
})

describe('TC-084b — Génération du config functions (dealerProfile) depuis le profil', () => {
  it('TAOFIC → DEALER_NETWORKS = [\'Orange\']', () => {
    expect(generateDealerProfileFile(resolveProfile('taofic_ajagbe')))
      .toContain("export const DEALER_NETWORKS = ['Orange']")
  })

  it('profil multi-réseaux → liste élargie', () => {
    expect(generateDealerProfileFile({ dealer: { networks: ['Orange', 'Moov'] } }))
      .toContain("export const DEALER_NETWORKS = ['Orange', 'Moov']")
  })

  it('dealer.networks vide → erreur explicite', () => {
    expect(() => generateDealerProfileFile({ dealer: { networks: [] } })).toThrow(/liste non vide/)
  })

  it('ANTI-DÉRIVE : functions/src/config/dealerProfile.js == généré pour TAOFIC', () => {
    const committed = readFileSync(dealerProfilePath, 'utf8').replace(/\r\n/g, '\n')
    const generated = generateDealerProfileFile(resolveProfile('taofic_ajagbe'))
    expect(committed).toBe(generated)
  })
})

describe('TC-084d — Génération du config functions mobileApp (app mobile agents)', () => {
  it('salawu → activée + préfixe dérivé de la marque (ESAHAF)', () => {
    const file = generateMobileAppProfileFile(resolveProfile('salawu'))
    expect(file).toContain("export const MOBILE_APP = { enabled: true, accessCodePrefix: 'ESAHAF' }")
  })

  it('TAOFIC → désactivée (défaut hérité), préfixe marque AKAYIS', () => {
    const file = generateMobileAppProfileFile(resolveProfile('taofic_ajagbe'))
    expect(file).toContain("export const MOBILE_APP = { enabled: false, accessCodePrefix: 'AKAYIS' }")
  })

  it('profil sans axe mobileApp → défaut sûr désactivé', () => {
    const file = generateMobileAppProfileFile({ branding: { appName: 'X' } })
    expect(file).toContain('enabled: false')
  })

  it('ANTI-DÉRIVE : functions/src/config/mobileAppProfile.js == généré pour TAOFIC', () => {
    const committed = readFileSync(mobileAppProfilePath, 'utf8').replace(/\r\n/g, '\n')
    const generated = generateMobileAppProfileFile(resolveProfile('taofic_ajagbe'))
    expect(committed).toBe(generated)
  })
})
