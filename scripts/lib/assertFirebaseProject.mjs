/**
 * Garde de projet Firebase — pure, sans connexion réseau.
 *
 * assertFirebaseProject(projectId) : vérifie qu'un projectId est sûr pour
 * les opérations émulateur. Lance une AssertFirebaseProjectError en cas d'échec.
 * Aucun SDK Firebase importé, aucune connexion réseau possible depuis ce module.
 *
 * Règles :
 *   1. projectId doit exister et être une string non vide (après trim).
 *   2. Tout projet CLIENT réel (production) est bloqué absolument
 *      (cf. BLOCKED_PRODUCTION_PROJECTS : taofic-ajagbe, salawu-fa726, …).
 *   3. Le projectId doit commencer par "demo-" (casse sensible).
 */

// Projets CLIENT réels (production) : aucune opération Firebase autorisée via cette
// garde émulateur. Ajouter ici chaque nouveau projet client pour le protéger comme
// TAOFIC (le reset dispose d'un opt-in dédié à 4 verrous, cf. assertResetProject).
export const BLOCKED_PRODUCTION_PROJECTS = Object.freeze(['taofic-ajagbe', 'salawu-fa726'])

export class AssertFirebaseProjectError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'AssertFirebaseProjectError'
    this.code = code
  }
}

export function assertFirebaseProject(rawProjectId) {
  if (rawProjectId === null || rawProjectId === undefined) {
    throw new AssertFirebaseProjectError(
      'MISSING_PROJECT_ID',
      'Aucun projectId fourni (null ou undefined).'
    )
  }
  if (typeof rawProjectId !== 'string') {
    throw new AssertFirebaseProjectError(
      'INVALID_PROJECT_ID_TYPE',
      `projectId doit être une chaîne, reçu : ${typeof rawProjectId}.`
    )
  }
  const projectId = rawProjectId.trim()
  if (projectId === '') {
    throw new AssertFirebaseProjectError(
      'MISSING_PROJECT_ID',
      'Le projectId est vide ou ne contient que des espaces.'
    )
  }
  if (BLOCKED_PRODUCTION_PROJECTS.includes(projectId)) {
    throw new AssertFirebaseProjectError(
      'PRODUCTION_PROJECT_BLOCKED',
      `Le projet de production ${projectId} est bloqué. Utiliser --project demo-akayis-test.`
    )
  }
  if (!projectId.startsWith('demo-')) {
    throw new AssertFirebaseProjectError(
      'NON_DEMO_PROJECT',
      `Le projectId "${projectId}" n'est pas un projet demo-. Aucune opération Firebase autorisée.`
    )
  }
  return projectId
}
