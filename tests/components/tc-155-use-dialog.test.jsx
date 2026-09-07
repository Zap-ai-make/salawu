import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import useDialog from '../../src/hooks/useDialog'

/**
 * TC-155 — useDialog : comportement d'accessibilité partagé des surfaces de recouvrement.
 *
 * Contexte : l'audit d'interface (docs/audit/BILAN-DESIGN.md, constat C4) relève 11 des
 * 16 surfaces de recouvrement sans fermeture au clavier, et aucune ne piégeait le focus
 * ni ne le restituait. Cinq modales portaient chacune leur propre écouteur `Escape`,
 * dupliqué et incomplet.
 *
 * Ces tests figent les trois garanties du hook — exigences de DESIGN.md §11 et de
 * WCAG 2.2 AA : on peut sortir au clavier, on ne peut pas tabuler hors de la modale,
 * et le focus revient d'où il venait.
 *
 * Note sur l'outillage : jsdom n'implémente pas la navigation Tab native, donc on ne
 * teste pas « Tab avance d'un élément » (ce serait tester le navigateur). On teste ce
 * que le hook fait réellement : intercepter Tab AUX BORNES pour refermer la boucle.
 */

function Harnais({ onClose }) {
  const ref = useDialog({ onClose })
  return (
    <div ref={ref} role="dialog" aria-modal="true">
      <button type="button">premier</button>
      <button type="button">milieu</button>
      <button type="button">dernier</button>
    </div>
  )
}

function HarnaisOuvrable() {
  const [ouvert, setOuvert] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOuvert(true)}>déclencheur</button>
      {ouvert && <Harnais onClose={() => setOuvert(false)} />}
    </>
  )
}

const premier = () => screen.getByRole('button', { name: 'premier' })
const dernier = () => screen.getByRole('button', { name: 'dernier' })

describe('TC-155 — useDialog', () => {
  it('Escape appelle onClose', () => {
    const onClose = vi.fn()
    render(<Harnais onClose={onClose} />)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('déplace le focus sur le premier élément focusable à l\'ouverture', () => {
    render(<Harnais onClose={() => {}} />)

    expect(premier()).toHaveFocus()
  })

  it('piège le focus : Tab depuis le dernier élément revient au premier', () => {
    render(<Harnais onClose={() => {}} />)
    dernier().focus()

    fireEvent.keyDown(document, { key: 'Tab' })

    expect(premier()).toHaveFocus()
  })

  it('piège le focus : Shift+Tab depuis le premier va au dernier', () => {
    render(<Harnais onClose={() => {}} />)
    premier().focus()

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })

    expect(dernier()).toHaveFocus()
  })

  it('laisse passer Tab entre deux éléments intérieurs (pas de piège abusif)', () => {
    render(<Harnais onClose={() => {}} />)
    screen.getByRole('button', { name: 'milieu' }).focus()

    fireEvent.keyDown(document, { key: 'Tab' })

    // Le hook ne doit PAS intervenir ici : le navigateur gère. En jsdom le focus
    // ne bouge donc pas — ce qui prouve justement l'absence d'interception.
    expect(screen.getByRole('button', { name: 'milieu' })).toHaveFocus()
  })

  it('restitue le focus au déclencheur à la fermeture', () => {
    render(<HarnaisOuvrable />)
    const declencheur = screen.getByRole('button', { name: 'déclencheur' })
    declencheur.focus()

    fireEvent.click(declencheur)
    expect(premier()).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(declencheur).toHaveFocus()
  })

  it('sans onClose, Escape ne lève pas', () => {
    render(<Harnais onClose={undefined} />)

    expect(() => fireEvent.keyDown(document, { key: 'Escape' })).not.toThrow()
  })
})
