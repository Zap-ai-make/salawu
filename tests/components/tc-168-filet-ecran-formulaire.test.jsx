/**
 * TC-168 — Filet de caractérisation de l'ÉCRAN FORMULAIRE (`ClientForm`).
 *
 * Ce que ce fichier fige
 * ─────────────────────────────────────────────────────────────────────────────
 * Cet écran est l'AJOUT D'UN CLIENT, pas une transaction — le diagnostic notait
 * que la première maquette s'était trompée là-dessus. Champs, ordre, groupes par
 * réseau, champs requis et libellé du bouton sont figés ici : le lot L8.5 ne
 * change que le dessin, et rien de ce qui suit ne doit bouger.
 *
 * Aucune assertion sur une classe CSS.
 *
 * UN DÉFAUT EST FIGÉ TEL QUEL (⚠ DÉFAUT FIGÉ), et il n'était pas au diagnostic :
 * douze champs de saisie partagent DEUX identifiants. Les six étiquettes
 * « Numéro agent » pointent toutes vers le champ du premier réseau, et les six
 * « Code agent » aussi. Cliquer l'étiquette « Code agent » sous Wave place donc
 * le curseur dans le champ d'Orange — sur un formulaire où une erreur de réseau
 * met un code agent sur le mauvais compte.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup, fireEvent } from '@testing-library/react'
import { pilotProfile } from '../../config/clients/_pilot.js'

vi.setConfig({ testTimeout: 30_000 })

const RESEAUX_ESAHAF = ['Orange', 'Moov', 'Telecel', 'Coris', 'Sank', 'Wave']

function poserLesMocks() {
  vi.doMock('../../src/config/activeClientProfile.js', () => ({
    activeProfile: {
      ...pilotProfile,
      id: 'profil-de-test',
      branding: { appName: 'ESAHAF', pwaName: 'ESAHAF', theme: 'orange' },
      design: { system: 'registre' },
      networks: { enabled: RESEAUX_ESAHAF },
    },
  }))
  vi.doMock('../../src/config/firebase', () => ({
    auth: {},
    db: {},
    functions: {},
    firebaseInfo: { projectId: 'test', isDev: true, useEmulators: false },
    default: {},
  }))
}

async function monterLeFormulaire(proprietes = {}) {
  poserLesMocks()
  const { default: ClientForm } = await import('../../src/components/ClientForm.jsx')
  render(<ClientForm onSubmit={() => {}} {...proprietes} />)
}

beforeEach(() => {
  vi.resetModules()
  window.localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.resetModules()
  vi.clearAllMocks()
})

describe("TC-168 — les champs de l'ajout d'un client", () => {
  it('se présente comme un ajout de client, pas comme une transaction', async () => {
    await monterLeFormulaire()

    expect(screen.getByRole('heading', { name: 'Ajouter un client' })).toBeInTheDocument()
    expect(screen.queryByText(/montant|dépôt|retrait/i)).toBeNull()
  })

  it('rend les champs de base dans cet ordre', async () => {
    await monterLeFormulaire()

    const etiquettes = Array.from(document.querySelectorAll('form > div > label')).map(
      (l) => l.textContent.trim(),
    )
    expect(etiquettes).toEqual([
      'Nom',
      'Prénom',
      "Numéro d'identité",
      'Numéro personnel',
      'Localité',
      "Nom de l'agent commercial",
    ])
  })

  it('exige le nom et le prénom, et eux seuls', async () => {
    // Une règle de saisie s'annonce AVANT l'échec : le champ porte `required`,
    // il ne se contente pas de refuser après coup.
    await monterLeFormulaire()

    expect(screen.getByLabelText('Nom')).toBeRequired()
    expect(screen.getByLabelText('Prénom')).toBeRequired()
    expect(screen.getByLabelText("Numéro d'identité")).not.toBeRequired()
    expect(screen.getByLabelText('Localité')).not.toBeRequired()
  })

  it('ouvre un groupe par réseau du profil, nommé par le réseau', async () => {
    await monterLeFormulaire()

    const groupes = Array.from(document.querySelectorAll('fieldset legend')).map((l) =>
      l.textContent.trim(),
    )
    expect(groupes).toEqual(RESEAUX_ESAHAF)
  })

  it('donne à chaque réseau deux champs : numéro agent et code agent', async () => {
    await monterLeFormulaire()

    const groupes = document.querySelectorAll('fieldset')
    expect(groupes).toHaveLength(6)
    for (const groupe of groupes) {
      expect(groupe.querySelectorAll('input')).toHaveLength(2)
    }
  })
})

describe('TC-168 — ce que le formulaire remonte', () => {
  it("nomme les champs de réseau par leur clé plate et par la carte des numéros", async () => {
    // `client.orange` porte le CODE agent (il pilote les transactions, contrat
    // historique), `client.numerosAgent.orange` porte le NUMÉRO. Les deux
    // cohabitent et ne doivent pas être confondus.
    await monterLeFormulaire()

    const orange = document.querySelectorAll('fieldset')[0]
    const champs = Array.from(orange.querySelectorAll('input')).map((i) => i.name)
    expect(champs).toEqual(['numerosAgent.orange', 'orange'])
  })

  it('remonte la saisie complète au parent', async () => {
    const onSubmit = vi.fn()
    await monterLeFormulaire({ onSubmit })

    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'OUEDRAOGO/KABORE' } })
    fireEvent.change(screen.getByLabelText('Prénom'), { target: { value: 'Wendkuuni Alizeta' } })
    fireEvent.submit(document.querySelector('form'))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ nom: 'OUEDRAOGO/KABORE', prenom: 'Wendkuuni Alizeta' }),
    )
  })

  it("dit « Enregistrer » à la création et « Modifier » à l'édition", async () => {
    // Un mot d'action garde le même nom dans tout le flux (DESIGN.md §12).
    await monterLeFormulaire()
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeInTheDocument()

    cleanup()
    await monterLeFormulaire({
      initialData: { id: 'c1', nom: 'ZONGO', prenom: 'Boukare' },
      title: 'Modifier le client',
    })
    expect(screen.getByRole('button', { name: 'Modifier' })).toBeInTheDocument()
  })
})

describe('TC-168 — ⚠ DÉFAUT FIGÉ : douze champs, deux identifiants', () => {
  it("les six champs « Numéro agent » partagent un seul identifiant", async () => {
    // État actuel : l'identifiant est construit sur un `useId()` unique, sans la
    // clé du réseau. Les six champs le portent donc à l'identique — HTML
    // invalide, et toutes les étiquettes pointent sur le premier.
    //
    // ⟲ À RETOURNER AU LOT L8.5 : l'identifiant portera la clé du réseau, et
    // cette assertion exigera six identifiants distincts. C'est une CORRECTION
    // d'accessibilité, donc elle vaut pour le produit entier, TAOFIC compris —
    // et non un parti pris réservé à ESAHAF.
    await monterLeFormulaire()

    const numeros = Array.from(document.querySelectorAll('input[name^="numerosAgent."]'))
    expect(numeros).toHaveLength(6)
    expect(new Set(numeros.map((i) => i.id)).size).toBe(1)
  })

  it("les six champs « Code agent » aussi", async () => {
    await monterLeFormulaire()

    const codes = RESEAUX_ESAHAF.map((r) =>
      document.querySelector(`input[name="${r.toLowerCase()}"]`),
    )
    expect(codes.every(Boolean)).toBe(true)
    expect(new Set(codes.map((i) => i.id)).size).toBe(1)
  })

  it("conséquence : l'étiquette du dernier réseau désigne le champ du premier", async () => {
    // Ce n'est pas une subtilité de conformité : cliquer « Code agent » sous
    // Wave place le curseur dans le champ d'Orange. Sur un formulaire où une
    // erreur de réseau inscrit un code agent sur le mauvais compte, c'est un
    // défaut d'usage, pas de balisage.
    await monterLeFormulaire()

    const groupes = document.querySelectorAll('fieldset')
    const wave = groupes[groupes.length - 1]
    const orange = groupes[0]

    const etiquetteWave = within(wave).getByText('Code agent')
    const cible = document.getElementById(etiquetteWave.getAttribute('for'))

    expect(cible).toBe(orange.querySelector('input[name="orange"]'))
    expect(cible).not.toBe(wave.querySelector('input[name="wave"]'))
  })
})
