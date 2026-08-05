// @vitest-environment node
/**
 * TC-095 — Le projet client salawu-fa726 est protégé EXACTEMENT comme TAOFIC.
 *
 * Onboarding multi-clients : chaque projet CLIENT réel doit être verrouillé par les
 * gardes admin. Ce test fige que salawu-fa726 se comporte comme taofic-ajagbe :
 *   • assertFirebaseProject        → PRODUCTION_PROJECT_BLOCKED (aucune op émulateur) ;
 *   • resolveAndAssertAdminProject → PRODUCTION_PROJECT_BLOCKED (aucun script admin) ;
 *   • resolveRestoreProject (exec) → PRODUCTION_PROJECT_BLOCKED (aucune restauration) ;
 *   • resolveResetProject          → traité comme PRODUCTION (dry-run OK ; --execute
 *     verrouillé derrière flag + env 'true', comme TAOFIC).
 * La prod TAOFIC reste protégée à l'identique (non-régression : cf. tc-042/043/075).
 */

import { describe, it, expect } from 'vitest'
import { assertFirebaseProject, AssertFirebaseProjectError, BLOCKED_PRODUCTION_PROJECTS } from '../../scripts/lib/assertFirebaseProject.mjs'
import { resolveAndAssertAdminProject } from '../../scripts/lib/resolveAndAssertAdminProject.mjs'
import { resolveRestoreProject } from '../../scripts/lib/assertRestoreProject.mjs'
import { resolveResetProject, PRODUCTION_PROJECT_IDS } from '../../scripts/lib/assertResetProject.mjs'

const SALAWU = 'salawu-fa726'
const sa = (project_id) => ({ project_id })

function expectCode(fn, code) {
  expect(fn).toThrow(AssertFirebaseProjectError)
  try { fn() } catch (e) { expect(e.code).toBe(code) }
}

describe('TC-095 — salawu-fa726 protégé comme TAOFIC', () => {
  it('est bien répertorié comme projet de production bloqué', () => {
    expect(BLOCKED_PRODUCTION_PROJECTS).toContain(SALAWU)
    expect(PRODUCTION_PROJECT_IDS).toContain(SALAWU)
  })

  it('assertFirebaseProject → PRODUCTION_PROJECT_BLOCKED', () => {
    expectCode(() => assertFirebaseProject(SALAWU), 'PRODUCTION_PROJECT_BLOCKED')
  })

  it('resolveAndAssertAdminProject (SA) → PRODUCTION_PROJECT_BLOCKED', () => {
    expectCode(() => resolveAndAssertAdminProject({ serviceAccount: sa(SALAWU), envProjectId: undefined }), 'PRODUCTION_PROJECT_BLOCKED')
  })

  it('resolveRestoreProject --execute → PRODUCTION_PROJECT_BLOCKED', () => {
    expectCode(() => resolveRestoreProject({ serviceAccount: sa(SALAWU), envProjectId: undefined, execute: true }), 'PRODUCTION_PROJECT_BLOCKED')
  })

  describe('resolveResetProject : traité comme PRODUCTION', () => {
    it('dry-run → autorisé, isProduction=true', () => {
      expect(resolveResetProject({ serviceAccount: sa(SALAWU), envProjectId: undefined, execute: false }))
        .toEqual({ projectId: SALAWU, isProduction: true })
    })

    it('--execute sans verrous → PRODUCTION_RESET_NOT_UNLOCKED', () => {
      expectCode(
        () => resolveResetProject({ serviceAccount: sa(SALAWU), envProjectId: undefined, execute: true }),
        'PRODUCTION_RESET_NOT_UNLOCKED',
      )
    })

    it("--execute + flag + env 'true' → autorisé, isProduction=true", () => {
      expect(resolveResetProject({
        serviceAccount: sa(SALAWU), envProjectId: undefined, execute: true,
        allowProductionFlag: true, envAllowProductionReset: 'true',
      })).toEqual({ projectId: SALAWU, isProduction: true })
    })
  })
})
