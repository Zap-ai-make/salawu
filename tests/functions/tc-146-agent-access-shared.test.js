/**
 * TC-146 — Helpers purs du code d'accès agent (functions/src/agents/shared.js).
 *
 * Vérifie : format du code (préfixe + alphabet non ambigu), hachage/vérification
 * scrypt (aller-retour, mauvais code refusé, timing-safe), extraction des
 * identifiants agent (numéros + codes, tous réseaux), normalisation, validation.
 */

import { describe, it, expect } from 'vitest'
import {
  ACCESS_CODE_ALPHABET,
  ACCESS_CODE_LENGTH,
  generateAccessCode,
  hashAccessCode,
  verifyAccessCode,
  normalizeIdentifier,
  extractAgentIdentifiers,
  validateClientId,
  normalizeCode,
  validateLoginIdentifier,
  validateLoginCode,
  nextFailureState,
  isLocked,
  MAX_FAILED_ATTEMPTS,
  LOCK_DURATION_MS,
} from '../../functions/src/agents/shared.js'
import { DealerRequestError } from '../../functions/src/errors.js'

describe('TC-146 — génération du code', () => {
  it('format <PREFIX>-XXXXXXXX, alphabet sans caractères ambigus', () => {
    // rnd déterministe → corps = premier caractère de l'alphabet répété.
    const code = generateAccessCode('ESAHAF', ACCESS_CODE_LENGTH, () => 0)
    expect(code).toBe(`ESAHAF-${ACCESS_CODE_ALPHABET[0].repeat(ACCESS_CODE_LENGTH)}`)
  })

  it('n\'utilise jamais de caractère ambigu (I, L, O, 0, 1)', () => {
    expect(ACCESS_CODE_ALPHABET).not.toMatch(/[ILO01]/)
    const body = generateAccessCode('ESAHAF').split('-')[1]
    expect(body).toMatch(new RegExp(`^[${ACCESS_CODE_ALPHABET}]{${ACCESS_CODE_LENGTH}}$`))
  })

  it('normalise/assainit le préfixe (majuscule, alphanumérique)', () => {
    expect(generateAccessCode('es-ahaf', 2, () => 0).startsWith('ESAHAF-')).toBe(true)
    expect(generateAccessCode('', 2, () => 0).startsWith('ACCES-')).toBe(true)
  })
})

describe('TC-146 — hachage / vérification', () => {
  it('aller-retour : le bon code vérifie, un mauvais échoue', () => {
    const { hash, salt } = hashAccessCode('ESAHAF-ABCD2345')
    expect(verifyAccessCode('ESAHAF-ABCD2345', hash, salt)).toBe(true)
    expect(verifyAccessCode('ESAHAF-WRONG999', hash, salt)).toBe(false)
  })

  it('le sel diffère à chaque génération (pas de hash déterministe global)', () => {
    const a = hashAccessCode('MEME-CODE00')
    const b = hashAccessCode('MEME-CODE00')
    expect(a.salt).not.toBe(b.salt)
    expect(a.hash).not.toBe(b.hash)
  })

  it('entrées invalides → false sans lever', () => {
    expect(verifyAccessCode('x', null, null)).toBe(false)
    expect(verifyAccessCode('x', '', '')).toBe(false)
  })
})

describe('TC-146 — identifiants agent', () => {
  const client = {
    nom: 'Diallo', prenom: 'Ali', numeroPersonnel: '70000000',
    orange: 'or123', moov: 'CODEMOOV',
    numerosAgent: { orange: '70 11 22 33', moov: '' , wave: '75000000' },
  }

  it('extrait codes + numéros (tous réseaux), normalisés et dédoublonnés', () => {
    const ids = extractAgentIdentifiers(client, ['orange', 'moov', 'wave'])
    expect(ids).toContain('OR123')        // code orange normalisé (majuscule)
    expect(ids).toContain('CODEMOOV')     // code moov
    expect(ids).toContain('70112233')     // numéro orange (espaces retirés)
    expect(ids).toContain('75000000')     // numéro wave (présent via numerosAgent)
    expect(new Set(ids).size).toBe(ids.length) // pas de doublon
  })

  it('ignore les valeurs vides ; ne remonte pas le téléphone perso ni le nom', () => {
    const ids = extractAgentIdentifiers(client, ['orange', 'moov', 'wave'])
    expect(ids).not.toContain('')
    expect(ids).not.toContain('70000000') // numeroPersonnel non exposé comme identifiant
    expect(ids).not.toContain('DIALLO')
  })

  it('fiche sans aucun identifiant → tableau vide', () => {
    expect(extractAgentIdentifiers({ nom: 'X', prenom: 'Y', numerosAgent: {} }, ['orange'])).toEqual([])
    expect(extractAgentIdentifiers(null, ['orange'])).toEqual([])
  })

  it('normalizeIdentifier : trim + majuscule + suppression des espaces', () => {
    expect(normalizeIdentifier('  70 11 22 33 ')).toBe('70112233')
    expect(normalizeIdentifier(null)).toBe('')
  })
})

describe('TC-146 — validateClientId', () => {
  it('accepte un id non vide (trim)', () => {
    expect(validateClientId('  gclient-1 ')).toBe('gclient-1')
  })
  it('rejette vide/non-string', () => {
    expect(() => validateClientId('')).toThrow(DealerRequestError)
    expect(() => validateClientId(null)).toThrow(DealerRequestError)
  })
})

describe('TC-146 — connexion : entrées + verrouillage', () => {
  it('normalizeCode : trim + majuscule + espaces retirés, tiret conservé', () => {
    expect(normalizeCode('  esahaf-abcd2345 ')).toBe('ESAHAF-ABCD2345')
    expect(normalizeCode('ESAHAF ABCD2345')).toBe('ESAHAFABCD2345')
  })

  it('validateLoginIdentifier/Code : normalisent, rejettent vide/trop long', () => {
    expect(validateLoginIdentifier('  70 11 22 33 ')).toBe('70112233')
    expect(validateLoginCode(' esahaf-abcd2345 ')).toBe('ESAHAF-ABCD2345')
    expect(() => validateLoginIdentifier('')).toThrow(DealerRequestError)
    expect(() => validateLoginCode('x'.repeat(65))).toThrow(DealerRequestError)
  })

  it('nextFailureState : incrémente, puis verrouille au seuil (compteur remis à zéro)', () => {
    expect(nextFailureState(0, 1000)).toEqual({ failedAttempts: 1, lockedUntil: 0 })
    expect(nextFailureState(MAX_FAILED_ATTEMPTS - 2, 1000)).toEqual({ failedAttempts: MAX_FAILED_ATTEMPTS - 1, lockedUntil: 0 })
    expect(nextFailureState(MAX_FAILED_ATTEMPTS - 1, 1000)).toEqual({ failedAttempts: 0, lockedUntil: 1000 + LOCK_DURATION_MS })
  })

  it('isLocked : vrai tant que lockedUntil > now', () => {
    expect(isLocked({ lockedUntil: 5000 }, 4000)).toBe(true)
    expect(isLocked({ lockedUntil: 5000 }, 6000)).toBe(false)
    expect(isLocked({}, 6000)).toBe(false)
  })
})
