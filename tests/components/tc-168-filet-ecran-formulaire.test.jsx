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
 * ⚠ CE FILET MONTE `ClientForm` NU — donc `enModale` a `false`, donc l'ECRAN
 * pleine page : sa carte, son titre, ses champs en une colonne, sans etoile et
 * sans pastille. C'est le dessin de TAOFIC, en production, et c'est exactement
 * ce qu'on veut figer ici : il ne doit pas bouger.
 *
 * La variante en modale — deux colonnes, etoiles, pastilles, pied de modale —
 * n'appartient qu'a l'identite « registre ». Elle est gardee par TC-179, qui
 * monte l'ecran Clients et ouvre la modale comme le fait un utilisateur.
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

  it("⚠ le champ SURVIT a la frappe : le meme noeud, pas un sosie", async () => {
    /**
     * LE DEFAUT QUE CE CAS EXISTE POUR FERMER, ET POURQUOI AUCUN AUTRE NE LE VOIT.
     *
     * `ClientForm` a declare un composant (`Duo`) DANS son corps de rendu. Une
     * fonction declaree la a une identite NOUVELLE a chaque rendu : React la
     * prend pour un autre type de composant, demonte tout son sous-arbre et le
     * remonte. Les <input> sont alors des noeuds DOM neufs — et un noeud neuf
     * n'a pas le focus.
     *
     * Consequence a la caisse : on tape « ZONGO », le « Z » declenche un rendu,
     * le champ est remplace, le curseur disparait. Il faut recliquer a chaque
     * lettre.
     *
     * ⚠ TOUTE LA SUITE ETAIT AVEUGLE, ET C'EST LA LECON. Les tests pilotent la
     * saisie par `fireEvent.change`, qui pose une valeur d'un coup sur le noeud
     * qu'il vient de chercher : il ne depend ni du focus ni de la persistance du
     * noeud. La valeur etait donc juste, et le formulaire inutilisable.
     *
     * On compare donc les IDENTITES DE NOEUD, avant et apres une frappe.
     */
    await monterLeFormulaire()

    const avant = screen.getByLabelText('Nom')
    fireEvent.change(avant, { target: { value: 'Z' } })
    const apres = screen.getByLabelText('Nom')

    expect(apres).toBe(avant)
    expect(apres).toHaveValue('Z')
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
  /**
   * ⟲ CES TROIS CAS ONT ÉTÉ RETOURNÉS LE 2026-09-23, ET ILS ONT FAIT EXACTEMENT
   * CE POUR QUOI ILS AVAIENT ÉTÉ ÉCRITS.
   *
   * Ils GELAIENT un défaut : les six blocs réseau construisaient leur `id` sans
   * la clé du réseau, donc douze champs pour deux identifiants. Ils exigeaient
   * que le défaut soit ENCORE LÀ (`.size).toBe(1)`), pour rougir le jour de sa
   * correction plutôt que de la laisser passer inaperçue.
   *
   * Ce jour est arrivé. Les trois ont rougi ensemble :
   *
   *     expected 6 to be 1
   *     expected 6 to be 1
   *     expected <input …(6)> to be <input …(6)>
   *
   * Ils exigent maintenant l'inverse : six associations distinctes, et une
   * étiquette qui désigne le champ de SON réseau.
   *
   * ⚠ LE BANC ÉTAIT VERT SUR CE DÉFAUT, AUX TROIS LARGEURS, PENDANT TOUT CE
   * TEMPS. Il scanne `wcag2a` à `wcag22aa` sans règle désactivée, mais axe-core
   * a retiré ses règles `duplicate-id`, et `label` ne vérifie que l'EXISTENCE
   * d'une association, pas son unicité. C'est la raison d'être de ces trois cas
   * écrits à la main.
   */
  it("les six champs « Numéro agent » portent six identifiants distincts", async () => {
    await monterLeFormulaire()

    const numeros = Array.from(document.querySelectorAll('input[name^="numerosAgent."]'))
    expect(numeros).toHaveLength(6)
    expect(new Set(numeros.map((i) => i.id)).size).toBe(6)
    // Un identifiant vide passerait le test du Set si tous l'étaient... sauf
    // qu'ils seraient alors identiques. On exige quand même qu'ils existent :
    // `htmlFor` ne peut désigner que ce qui a un nom.
    expect(numeros.every((i) => i.id)).toBe(true)
  })

  it("les six champs « Code agent » aussi", async () => {
    await monterLeFormulaire()

    const codes = RESEAUX_ESAHAF.map((r) =>
      document.querySelector(`input[name="${r.toLowerCase()}"]`),
    )
    expect(codes.every(Boolean)).toBe(true)
    expect(new Set(codes.map((i) => i.id)).size).toBe(6)
    expect(codes.every((i) => i.id)).toBe(true)
  })

  it("conséquence : l'étiquette d'un réseau désigne le champ de CE réseau", async () => {
    // Ce n'est pas une subtilité de conformité : cliquer « Code agent » sous
    // Wave plaçait le curseur dans le champ d'Orange. Sur un formulaire où une
    // erreur de réseau inscrit un code agent sur le mauvais compte, c'était un
    // défaut d'usage, pas de balisage.
    //
    // ⚠ ON VÉRIFIE LE DERNIER ET LE PREMIER. Une correction qui n'aurait traité
    // que le premier bloc laisserait ce cas vert s'il ne regardait que lui.
    await monterLeFormulaire()

    const groupes = document.querySelectorAll('fieldset')
    const wave = groupes[groupes.length - 1]
    const orange = groupes[0]

    const cibleWave = document.getElementById(
      within(wave).getByText('Code agent').getAttribute('for'),
    )
    expect(cibleWave).toBe(wave.querySelector('input[name="wave"]'))
    expect(cibleWave).not.toBe(orange.querySelector('input[name="orange"]'))

    const cibleOrange = document.getElementById(
      within(orange).getByText('Code agent').getAttribute('for'),
    )
    expect(cibleOrange).toBe(orange.querySelector('input[name="orange"]'))
  })
})
