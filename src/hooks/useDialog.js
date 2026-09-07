import { useCallback, useEffect, useRef } from 'react'

/**
 * useDialog — comportement clavier partagé des surfaces de recouvrement.
 * ─────────────────────────────────────────────────────────────────────────────
 * Source unique de vérité pour les trois garanties d'accessibilité d'une modale
 * (DESIGN.md §11, WCAG 2.2 AA) :
 *
 *   1. `Escape` ferme.
 *   2. Le focus est piégé : on ne tabule pas derrière la modale, sur un contenu
 *      qu'on ne voit pas et qu'on ne peut pas atteindre à la souris.
 *   3. Le focus revient au déclencheur à la fermeture — sans quoi l'utilisateur
 *      au clavier repart du début du document à chaque fermeture.
 *
 * Existait auparavant en cinq copies partielles (Escape seul, jamais le piège ni
 * la restitution) et manquait sur onze autres surfaces. Une seule façon de faire.
 *
 * Usage — attacher le ref renvoyé au conteneur de la modale :
 *
 *   const dialogRef = useDialog({ onClose })
 *   return <div ref={dialogRef} role="dialog" aria-modal="true">…</div>
 *
 * Le hook suppose que la modale est montée/démontée avec son ouverture (idiome
 * dominant du dépôt : `if (!open) return null`). Pour une modale qui reste
 * montée, passer `isOpen` pour que le hook s'active au bon moment.
 *
 * @param {object}   options
 * @param {Function} [options.onClose]  appelé sur Escape. Absent = non fermable au clavier.
 * @param {boolean}  [options.isOpen=true]  false désactive tout (aucun écouteur posé).
 * @param {boolean}  [options.autoFocus=true]  déplacer le focus dans la modale à l'ouverture.
 * @returns {React.RefObject<HTMLElement>} ref à poser sur le conteneur.
 */

// Éléments réellement atteignables au clavier. `:not([disabled])` et l'exclusion
// des tabindex négatifs évitent de « piéger » le focus sur un élément inerte, ce
// qui bloquerait l'utilisateur au lieu de l'aider.
const FOCUSABLES = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function useDialog({ onClose, isOpen = true, autoFocus = true } = {}) {
  const ref = useRef(null)
  // Le callback est gardé dans un ref : sans cela, une modale qui recrée son
  // `onClose` à chaque rendu (cas courant : fonction fléchée inline) reposerait
  // l'écouteur à chaque frappe.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const focusables = useCallback(() => {
    const node = ref.current
    if (!node) return []
    // Filtrage par ATTRIBUTS et non par géométrie : `offsetParent` / `getClientRects`
    // valent toujours « masqué » sous jsdom, qui ne calcule aucune mise en page. Un
    // filtre géométrique se neutraliserait donc silencieusement en test tout en
    // paraissant correct — on ne saurait plus ce qui est vérifié.
    return Array.from(node.querySelectorAll(FOCUSABLES)).filter(
      (el) => !el.closest('[hidden]') && !el.closest('[aria-hidden="true"]'),
    )
  }, [])

  // ── Restitution du focus ────────────────────────────────────────────────
  // Mémorisé à l'ouverture, restitué au démontage. Effet séparé du reste pour
  // que sa fonction de nettoyage ne se rejoue pas quand une autre dépendance change.
  useEffect(() => {
    if (!isOpen) return undefined
    const declencheur = document.activeElement
    return () => {
      // `isConnected` : le déclencheur peut avoir disparu du DOM entre-temps
      // (ligne de tableau supprimée par l'action même qu'on vient de valider).
      if (declencheur instanceof HTMLElement && declencheur.isConnected) {
        declencheur.focus()
      }
    }
  }, [isOpen])

  // ── Focus initial ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !autoFocus) return
    const cibles = focusables()
    if (cibles.length > 0) {
      cibles[0].focus()
    } else if (ref.current) {
      // Modale purement informative : on la rend atteignable pour que le lecteur
      // d'écran annonce son contenu au lieu de rester derrière.
      ref.current.setAttribute('tabindex', '-1')
      ref.current.focus()
    }
  }, [isOpen, autoFocus, focusables])

  // ── Escape et piège de focus ────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onCloseRef.current?.()
        return
      }
      if (event.key !== 'Tab') return

      const cibles = focusables()
      if (cibles.length === 0) return

      const premier = cibles[0]
      const dernier = cibles[cibles.length - 1]
      const actif = document.activeElement

      // On n'intervient QU'AUX BORNES : entre deux éléments intérieurs, la
      // navigation native du navigateur est meilleure que tout ce qu'on
      // réimplémenterait (ordre DOM, éléments composites, champs de formulaire).
      if (!event.shiftKey && actif === dernier) {
        event.preventDefault()
        premier.focus()
      } else if (event.shiftKey && actif === premier) {
        event.preventDefault()
        dernier.focus()
      }
    }

    // Écoute sur `window` et non sur `document` : les deux sont équivalents pour
    // une frappe réelle (elle remonte de l'élément focalisé jusqu'à window), mais
    // un événement émis DIRECTEMENT sur window ne redescend pas vers document.
    // C'est la cible qu'utilisaient les modales avant mutualisation, et celle
    // qu'attendent leurs tests de caractérisation (tc-113). `window` capte donc
    // tout ce que `document` capterait, plus les émissions directes.
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, focusables])

  return ref
}

export default useDialog
