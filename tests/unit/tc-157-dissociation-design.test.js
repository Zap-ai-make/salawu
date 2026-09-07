import { describe, it, expect } from 'vitest'
import { pilotProfile } from '../../config/clients/_pilot.js'
import { salawuProfile } from '../../config/clients/salawu.js'
import { taoficProfile } from '../../config/clients/taofic-ajagbe.js'
import { resolveProfile } from '../../config/clients/index.js'

/**
 * TC-157 — Dissociation des systèmes visuels entre clients.
 *
 * Exigence : une refonte visuelle d'ESAHAF ne doit JAMAIS pouvoir atteindre
 * TAOFIC, qui est en production. Le code est partagé ; l'apparence ne l'est pas.
 *
 * Le mécanisme est l'axe déclaratif `design.system` du profil (AGENTS2.md :
 * « ajouter un axe de variation = ajouter un champ nommé dans _pilot.js »),
 * lu en UN SEUL endroit (src/constants/designSystem.js) et matérialisé par une
 * classe de portée sur <html>.
 *
 * Ces tests figent la garantie plutôt que la discipline : si quelqu'un bascule
 * un jour le défaut du pilote, ou déclare l'identité ESAHAF sur un autre profil,
 * c'est ici que ça casse — pas chez le client.
 *
 * NOTE : la suite est épinglée sur VITE_CLIENT_ID='taofic_ajagbe'
 * (vitest.config.js), ce qui rend le dernier bloc particulièrement utile : il
 * vérifie le comportement du module tel qu'il se résout POUR TAOFIC.
 */

describe('TC-157 — axe design du profil', () => {
  it("le pilote est en 'legacy' : tout profil qui ne déclare rien reste inchangé", () => {
    expect(pilotProfile.design.system).toBe('legacy')
  })

  it("ESAHAF (salawu) est le seul à déclarer l'identité « registre »", () => {
    expect(salawuProfile.design.system).toBe('registre')
  })

  it('TAOFIC hérite de legacy et ne déclare aucune identité propre', () => {
    // Il hérite par spread du pilote : il ne doit surtout PAS redéclarer 'registre'.
    expect(taoficProfile.design.system).toBe('legacy')
  })

  it('aucun profil du registre autre que salawu ne porte « registre »', () => {
    for (const id of ['pilot', 'nouveau_client', 'taofic_ajagbe']) {
      const profil = resolveProfile(id)
      expect(profil.design.system, `le profil ${id} ne doit pas porter l'identité ESAHAF`).toBe('legacy')
    }
    expect(resolveProfile('salawu').design.system).toBe('registre')
  })

  it("l'axe est gelé : on ne peut pas le modifier à l'exécution", () => {
    expect(Object.isFrozen(salawuProfile.design)).toBe(true)
    expect(Object.isFrozen(taoficProfile.design)).toBe(true)
  })
})

describe('TC-157 — résolution du système visuel', () => {
  it("résout 'legacy' pour le profil sur lequel la suite est épinglée (TAOFIC)", async () => {
    const { DESIGN_SYSTEM, IS_REGISTRE, DESIGN_ROOT_CLASS } = await import('../../src/constants/designSystem.js')

    expect(DESIGN_SYSTEM).toBe('legacy')
    expect(IS_REGISTRE).toBe(false)
    expect(DESIGN_ROOT_CLASS).toBe('design-legacy')
  })

  it('la classe de portée dérive du système, sans autre valeur possible', async () => {
    const { DESIGN_ROOT_CLASS } = await import('../../src/constants/designSystem.js')

    expect(['design-legacy', 'design-registre']).toContain(DESIGN_ROOT_CLASS)
  })
})

describe('TC-157 — thème dérivé du système visuel', () => {
  it("TAOFIC garde son thème historique : 'dark' (marque 'green', non mappée)", async () => {
    const { DEFAULT_THEME, THEMES } = await import('../../src/constants/themes.js')

    // La suite est épinglée sur taofic_ajagbe : ce test vérifie donc le thème
    // réellement servi au client en production. Il ne doit PAS être 'registre'.
    expect(DEFAULT_THEME).toBe('dark')
    expect(THEMES[DEFAULT_THEME].backgroundImage).toBe('/bg-noir.png')
  })

  it("le thème « registre » existe mais n'est pas sélectionné pour un client legacy", async () => {
    const { THEMES, DEFAULT_THEME } = await import('../../src/constants/themes.js')

    expect(THEMES.registre).toBeDefined()
    expect(DEFAULT_THEME).not.toBe('registre')
  })

  it("le thème « registre » dérive des jetons, et porte le bandeau photo demandé", async () => {
    const { THEMES } = await import('../../src/constants/themes.js')
    const c = THEMES.registre.classes

    // Le constat I4 (1,8 Mo de décor précaché) reste exact, mais le client a
    // demandé le rétablissement du bandeau (2026-09-04). Ce test a donc été
    // retourné : il vérifiait l'absence de l'image, il vérifie sa présence.
    //
    // Il ne s'agit pas d'un détail cosmétique — le profil salawu active
    // `offlineMode`. Une image affichée mais non précachée donnerait un écran
    // différent selon la connexion. L'assertion suivante est le rappel que
    // vite.config.js doit rester d'accord avec cette valeur.
    expect(THEMES.registre.backgroundImage).toBe('/bg-noir.png')
    // Aucune couleur Tailwind par défaut : tout vient des jetons @theme.
    expect(c.background).toBe('bg-papier')
    expect(c.text).toBe('text-encre')
    // themedTable extrait la bordure par recherche du jeton `border-` : sans elle,
    // tous les tableaux perdraient leur réglure en silence (constat M4).
    expect(c.tableHeader).toMatch(/\bborder-\S+/)
  })
})
