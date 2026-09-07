/**
 * TC-158 — Caractérisation du système de thèmes AVANT le retrait des thèmes morts.
 *
 * Pourquoi ce test existe
 * ───────────────────────────────────────────────────────────────────────────────
 * Le Lot 4 retire les thèmes que plus aucun client ne peut atteindre. TAOFIC est
 * en production et rend le thème 'dark' : la suppression ne doit RIEN changer
 * pour lui. Ce fichier fige donc le rendu réel de TAOFIC — les chaînes de classes
 * exactes, pas une approximation — pour que la même assertion serve de preuve
 * avant et après la suppression.
 *
 * La suite est épinglée sur VITE_CLIENT_ID='taofic_ajagbe' (vitest.config.js) :
 * ce que ce test observe est littéralement ce que voit le client en production.
 *
 * Le troisième bloc est le cœur de la démonstration de sûreté. Un utilisateur
 * peut porter dans son localStorage un identifiant de thème hérité d'une version
 * antérieure (`src/pages/Personnalisation.jsx`, page de personnalisation présente
 * dans le commit initial d72d5d7 et retirée dès 32e21b0). Le garde
 * `THEMES[saved] ? saved : DEFAULT_THEME` de ThemeContext fait déjà retomber
 * toute valeur inconnue sur le défaut. C'est ce garde — et non la chance — qui
 * rend le retrait sans risque : après suppression, 'blue' devient une valeur
 * inconnue et suit exactement le même chemin qu'un identifiant fantaisiste.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider, useTheme } from '../../src/context/ThemeContext.jsx'
import { THEMES, DEFAULT_THEME, STORAGE_KEY } from '../../src/constants/themes.js'

// Rend les valeurs du contexte en texte : on observe ce qu'un composant reçoit
// réellement, pas ce que le module exporte.
function Sonde() {
  const { themeClasses, backgroundImage } = useTheme()
  return (
    <>
      <span data-testid="background">{themeClasses.background}</span>
      <span data-testid="text">{themeClasses.text}</span>
      <span data-testid="accent">{themeClasses.accent}</span>
      <span data-testid="navbar">{themeClasses.navbar}</span>
      <span data-testid="tableHeader">{themeClasses.tableHeader}</span>
      <span data-testid="tableAccent">{themeClasses.tableAccent}</span>
      <span data-testid="bg-image">{String(backgroundImage)}</span>
    </>
  )
}

const lire = (id) => screen.getByTestId(id).textContent

beforeEach(() => {
  localStorage.clear()
})
afterEach(() => {
  localStorage.clear()
})

describe('TC-158 — rendu réel de TAOFIC (client en production)', () => {
  it("sert le thème 'dark', sans stockage local", () => {
    expect(DEFAULT_THEME).toBe('dark')

    render(<ThemeProvider><Sonde /></ThemeProvider>)

    // Les six chaînes exactes que rend TAOFIC aujourd'hui. Toute divergence
    // introduite par le retrait des thèmes casse ici, avant le client.
    expect(lire('background')).toBe('bg-slate-100')
    expect(lire('text')).toBe('text-gray-900')
    expect(lire('accent')).toBe('bg-slate-900')
    expect(lire('navbar')).toBe('bg-slate-950/95 backdrop-blur-sm text-white')
    expect(lire('tableHeader')).toBe('bg-slate-100/80 border-slate-300')
    expect(lire('tableAccent')).toBe('bg-slate-50/60')
    expect(lire('bg-image')).toBe('/bg-noir.png')
  })

  it("le thème 'dark' reste présent dans le catalogue : il n'est pas mort", () => {
    // Garde explicite contre un retrait trop zélé. 'dark' est le seul thème
    // historique encore servi à un client réel.
    expect(THEMES.dark).toBeDefined()
    expect(THEMES.dark.backgroundImage).toBe('/bg-noir.png')
  })
})

describe('TC-158 — le catalogue ne contient que des thèmes atteignables', () => {
  it('tout thème du catalogue produit un jeu de classes complet', () => {
    // Contrat de forme, indépendant de la liste : il survit au retrait.
    for (const [id, theme] of Object.entries(THEMES)) {
      expect(theme.id, `THEMES.${id}.id doit refléter sa clé`).toBe(id)
      expect(typeof theme.name, `THEMES.${id}.name`).toBe('string')
      for (const cle of ['background', 'text', 'accent', 'navbar', 'tableHeader', 'tableAccent']) {
        expect(theme.classes[cle], `THEMES.${id}.classes.${cle}`).toBeTruthy()
      }
    }
  })

  it("le catalogue ne déclare aucune classe Tailwind arbitraire", () => {
    // Contrôle du catalogue seul. La fabrication dynamique, elle, a lieu dans le
    // contexte — c'est le bloc suivant qui l'observe, parce que c'est là qu'elle
    // se produit réellement.
    for (const [id, theme] of Object.entries(THEMES)) {
      for (const [cle, valeur] of Object.entries(theme.classes)) {
        expect(valeur, `THEMES.${id}.classes.${cle} ne doit pas être une classe arbitraire`)
          .not.toMatch(/\[\$?\{|\[#/)
      }
    }
  })
})

describe("TC-158 — le défaut du thème 'custom' est corrigé", () => {
  it("un ancien 'custom' rend désormais une vraie couleur, plus une classe morte", () => {
    // AVANT le Lot 4, ce même cas produisait :
    //     navbar = 'bg-[#3b82f6]/95 backdrop-blur-sm'
    //     accent = 'bg-[#3b82f6] text-white'
    // `bg-[#3b82f6]` n'apparaît dans aucun fichier source. Le JIT de Tailwind ne
    // balaye que les sources : la règle n'était jamais émise. La classe était
    // bien posée sur l'élément et ne peignait rien — une barre de navigation
    // transparente, sans la moindre erreur pour le signaler.
    //
    // Ce test a été écrit AVANT la suppression pour figer ce défaut, puis
    // retourné ici. C'est la preuve que le retrait corrige quelque chose, au
    // lieu de seulement effacer du code mort.
    localStorage.setItem(STORAGE_KEY, 'custom')

    render(<ThemeProvider><Sonde /></ThemeProvider>)

    expect(lire('navbar')).not.toContain('[#')
    expect(lire('accent')).not.toContain('[#')
    expect(lire('navbar')).toBe(THEMES[DEFAULT_THEME].classes.navbar)
    expect(lire('accent')).toBe(THEMES[DEFAULT_THEME].classes.accent)
  })

  it("le contexte n'expose plus d'API de mutation sans interface", () => {
    // `changeTheme` / `setCustomThemeColor` n'avaient plus de site d'appel depuis
    // le retrait de src/pages/Personnalisation.jsx (2026-05-29). Une API publique
    // qu'aucune UI n'atteint finit par être rebranchée par erreur : on la ferme.
    let recu
    function Espion() {
      recu = useTheme()
      return null
    }
    render(<ThemeProvider><Espion /></ThemeProvider>)

    expect(recu.changeTheme).toBeUndefined()
    expect(recu.setCustomThemeColor).toBeUndefined()
    expect(recu.customColor).toBeUndefined()
    expect(recu.themes).toBeUndefined()
    // Ce que les composants consomment réellement reste exposé.
    expect(recu.themeClasses).toBeDefined()
    expect(recu.currentTheme).toBe(DEFAULT_THEME)
  })
})

describe('TC-158 — un identifiant de thème inconnu retombe sur le défaut', () => {
  it("une valeur résiduelle inconnue dans localStorage ne casse pas le rendu", () => {
    // C'est LE scénario qui rend la suppression sûre : après retrait, un ancien
    // 'blue' est traité exactement comme ce 'theme_supprime_en_2026'.
    localStorage.setItem(STORAGE_KEY, 'theme_supprime_en_2026')

    render(<ThemeProvider><Sonde /></ThemeProvider>)

    expect(lire('background')).toBe(THEMES[DEFAULT_THEME].classes.background)
    expect(lire('navbar')).toBe(THEMES[DEFAULT_THEME].classes.navbar)
    expect(lire('bg-image')).toBe(String(THEMES[DEFAULT_THEME].backgroundImage))
  })

  it('un localStorage indisponible ne casse pas le rendu', () => {
    // Mode privé de certains navigateurs : getItem lève. Le contexte a déjà un
    // try/catch ; on fige le comportement pour qu'il survive à la réécriture.
    const original = Object.getOwnPropertyDescriptor(Storage.prototype, 'getItem')
    Storage.prototype.getItem = () => {
      throw new Error('localStorage indisponible')
    }
    try {
      render(<ThemeProvider><Sonde /></ThemeProvider>)
      expect(lire('background')).toBe(THEMES[DEFAULT_THEME].classes.background)
    } finally {
      Object.defineProperty(Storage.prototype, 'getItem', original)
    }
  })
})
