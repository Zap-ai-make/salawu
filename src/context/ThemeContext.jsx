import { createContext, useContext, useState, useMemo } from 'react'
import { THEMES, DEFAULT_THEME, STORAGE_KEY } from '../constants/themes.js'
import { IS_REGISTRE } from '../constants/designSystem.js'

/**
 * ThemeContext — fournit l'apparence active aux composants.
 * ─────────────────────────────────────────────────────────────────────────────
 * Ce contexte exposait aussi `changeTheme`, `setCustomThemeColor`, `customColor`
 * et le catalogue `themes` : l'API d'un sélecteur de thème. Ce sélecteur
 * (src/pages/Personnalisation.jsx) a été retiré le 2026-05-29, un commit après
 * la création du dépôt. Depuis, aucun composant n'a jamais appelé ces fonctions.
 *
 * Elles ne sont pas retirées parce qu'un outil les signale inutilisées, mais
 * parce que deux d'entre elles étaient activement nuisibles :
 *
 *   • `setCustomThemeColor` fabriquait `bg-[${couleur}]` à l'exécution. Le JIT
 *     de Tailwind ne balaye que les fichiers sources : cette règle n'était
 *     jamais émise. La classe était bien posée sur l'élément et ne peignait
 *     rien — une barre de navigation transparente, sans erreur pour le dire.
 *     TC-158 caractérisait ce défaut avant le retrait.
 *   • `changeTheme` écrivait dans localStorage un identifiant qu'aucune UI ne
 *     pouvait produire, et que IS_REGISTRE ignore de toute façon.
 *
 * Ce qui reste est ce que les composants consomment réellement, et rien d'autre :
 * `themeClasses` (11 fichiers) et `backgroundImage` (Layout.jsx).
 */

const ThemeContext = createContext()

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

export const ThemeProvider = ({ children }) => {
  const [currentTheme] = useState(() => {
    // Un client portant une identité dessinée n'est pas « thémable » : son
    // apparence fait partie du produit livré. On ignore donc localStorage —
    // sans quoi une valeur résiduelle (thème choisi dans une version antérieure)
    // servirait la palette historique SOUS la portée `design-registre`, donnant
    // un écran mi-refondu mi-ancien. Le cas est silencieux et difficile à
    // reproduire : il se ferme ici, pas au support.
    if (IS_REGISTRE) return DEFAULT_THEME
    try {
      // Le filtre `THEMES[saved]` est ce qui rend le retrait des six thèmes
      // historiques sans risque : un identifiant devenu inconnu ('blue',
      // 'custom'…) suit le même chemin qu'une valeur corrompue et retombe sur
      // le défaut. Aucune migration de localStorage n'est nécessaire.
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved && THEMES[saved] ? saved : DEFAULT_THEME
    } catch {
      return DEFAULT_THEME
    }
  })

  const themeClasses = useMemo(() => {
    const theme = THEMES[currentTheme]
    return theme ? theme.classes : THEMES[DEFAULT_THEME].classes
  }, [currentTheme])

  const currentBackgroundImage = useMemo(() => {
    const theme = THEMES[currentTheme]
    // Test d'EXISTENCE du thème, et non `theme?.backgroundImage || défaut` comme
    // auparavant : l'identité « registre » déclare `backgroundImage: null`
    // VOLONTAIREMENT, et `||` traite ce null comme une absence. Le résultat est
    // identique aujourd'hui (le défaut de « registre » est lui-même null), mais
    // le piège se refermerait au premier thème ajouté au catalogue.
    return theme ? theme.backgroundImage : THEMES[DEFAULT_THEME].backgroundImage
  }, [currentTheme])

  const value = useMemo(() => ({
    currentTheme,
    themeClasses,
    backgroundImage: currentBackgroundImage,
  }), [currentTheme, themeClasses, currentBackgroundImage])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}
