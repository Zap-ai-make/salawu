/**
 * TC-185 — La modale de ravitaillement.
 *
 * CE QUE CE FICHIER PROTÈGE
 * ─────────────────────────────────────────────────────────────────────────────
 * La modale est le seul endroit où un humain décide d'un mouvement d'argent sur
 * une carte réseau. Trois promesses s'y jouent :
 *
 *   1. ON SAISIT UN MONTANT À AJOUTER, PAS UN SOLDE FINAL. C'est l'écart avec le
 *      crayon des cartes qu'elle remplace, et il n'est visible que dans le
 *      libellé du champ. Un libellé « Montant » ferait retomber l'utilisateur
 *      dans l'ancien geste — taper le total — et doublerait le solde.
 *   2. LE RÉSEAU ET LA RESSOURCE PARTENT AU SERVEUR TELS QUE CHOISIS. Une
 *      ressource par défaut envoyée à la place du choix crédite la mauvaise
 *      carte, et rien à l'écran ne le montre.
 *   3. LE MESSAGE D'ERREUR DU SERVEUR EST AFFICHÉ TEL QUEL. « Solde insuffisant »
 *      et « montant invalide » appellent deux gestes différents ; un message
 *      générique transforme un refus explicable en panne supposée.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'

const creerRavitaillement = vi.fn()

vi.mock('../../src/services/storeSupplyService', () => ({
  createStoreSupply: (...args) => creerRavitaillement(...args),
}))

// Le profil décide des réseaux offerts : on en pose plusieurs pour que le choix
// soit réel, et non le seul possible.
vi.mock('../../src/config/activeClientProfile.js', () => ({
  activeProfile: { networks: { enabled: ['Orange', 'Moov', 'Wave'] } },
}))

const { default: SupplyFormModal } = await import('../../src/components/store/SupplyFormModal.jsx')

beforeEach(() => { creerRavitaillement.mockReset() })
afterEach(() => { cleanup(); vi.clearAllMocks() })

const monter = (props = {}) => render(<SupplyFormModal onClose={() => {}} {...props} />)

describe('TC-185 — le champ dit ce qu’il attend', () => {
  it('nomme le montant « à ajouter », et le répète sous le champ', async () => {
    // ⚠ CE CAS GARDE UN MOT, ET C'EST DÉLIBÉRÉ. Le champ s'appelait « Montant »
    // dans le crayon des cartes, où il fallait taper le TOTAL. Le même mot sur
    // un champ qui attend un APPORT produit un doublement silencieux du solde :
    // l'utilisateur tape 70 000 en croyant corriger, le serveur ajoute 70 000.
    monter()

    expect(screen.getByLabelText(/montant à ajouter/i)).toBeInTheDocument()
    expect(screen.getByText(/s’ajoute au solde actuel/i)).toBeInTheDocument()
  })

  it('offre stock et liquidité en RADIOS, les deux visibles à la fois', async () => {
    // Un <select> replié cacherait l'option non choisie. Ce choix décide de
    // QUELLE carte se remplit : il doit se lire avant de valider.
    monter()

    const stock = screen.getByRole('radio', { name: 'Stock' })
    const liquidite = screen.getByRole('radio', { name: 'Liquidité' })
    expect(stock).toBeChecked()
    expect(liquidite).not.toBeChecked()
  })
})

describe('TC-185 — ce qui part au serveur', () => {
  it('envoie le réseau et la ressource CHOISIS, pas les valeurs par défaut', async () => {
    creerRavitaillement.mockResolvedValue({ success: true, newBalance: 1 })
    monter()

    fireEvent.change(screen.getByLabelText(/réseau/i), { target: { value: 'Wave' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Liquidité' }))
    fireEvent.change(screen.getByLabelText(/montant à ajouter/i), { target: { value: '15000' } })
    fireEvent.click(screen.getByRole('button', { name: /enregistrer/i }))

    await waitFor(() => expect(creerRavitaillement).toHaveBeenCalledTimes(1))
    expect(creerRavitaillement).toHaveBeenCalledWith(
      expect.objectContaining({ network: 'Wave', resource: 'liquidite', amount: '15000' }),
    )
  })

  it('transmet la note quand elle est remplie, et n’en invente pas sinon', async () => {
    creerRavitaillement.mockResolvedValue({ success: true })
    monter()

    fireEvent.change(screen.getByLabelText(/montant à ajouter/i), { target: { value: '5000' } })
    fireEvent.click(screen.getByRole('button', { name: /enregistrer/i }))

    await waitFor(() => expect(creerRavitaillement).toHaveBeenCalled())
    expect(creerRavitaillement.mock.calls[0][0].note).toBe('')
  })
})

describe('TC-185 — quand le serveur refuse', () => {
  it('affiche le message du serveur, mot pour mot', async () => {
    // Le service traduit déjà le code métier en phrase utile. La modale ne doit
    // pas la remplacer par « une erreur est survenue » : le geste à faire
    // (réduire le montant, choisir une autre carte) est DANS cette phrase.
    creerRavitaillement.mockRejectedValue(
      new Error('Solde insuffisant : la carte ne porte plus assez pour reprendre ce montant.'),
    )
    monter()

    fireEvent.change(screen.getByLabelText(/montant à ajouter/i), { target: { value: '5000' } })
    fireEvent.click(screen.getByRole('button', { name: /enregistrer/i }))

    const alerte = await screen.findByRole('alert')
    expect(alerte).toHaveTextContent(/solde insuffisant/i)
  })

  it('ne ferme pas la modale sur échec : la saisie reste récupérable', async () => {
    // Fermer effacerait un montant déjà tapé, et l'utilisateur devrait tout
    // ressaisir sans savoir ce qui avait été refusé.
    creerRavitaillement.mockRejectedValue(new Error('Montant invalide.'))
    const onClose = vi.fn()
    monter({ onClose })

    fireEvent.change(screen.getByLabelText(/montant à ajouter/i), { target: { value: '5000' } })
    fireEvent.click(screen.getByRole('button', { name: /enregistrer/i }))

    await screen.findByRole('alert')
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/montant à ajouter/i)).toHaveValue('5000')
  })
})
