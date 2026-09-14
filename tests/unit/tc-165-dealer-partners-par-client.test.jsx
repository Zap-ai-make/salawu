/**
 * TC-165 — L'annuaire des sous-dealers partenaires est cloisonné par client.
 *
 * Constat production : dans l'espace Dealer de salawu (ESAHAF), le formulaire de
 * ravitaillement « Partenaire » listait les 25 sous-dealers de TAOFIC — noms,
 * localités et numéros DA réels d'un AUTRE client.
 *
 * Cause : la liste était une constante figée de src/constants/dealerPartners.js,
 * donc embarquée à l'identique dans le build de chaque client. Ce n'était pas une
 * fuite de base de données (les clients sont sur des projets Firebase distincts)
 * mais une donnée d'un client codée en dur dans du code partagé.
 *
 * Le profil client ne convient pas non plus comme hôte : config/clients/index.js
 * importe TOUS les profils dans un même bundle. L'annuaire est donc injecté au
 * build (define __DEALER_PARTNERS__) pour le seul client ciblé.
 *
 * Ces tests verrouillent les garanties :
 *   1. chaque client ne reçoit que son propre annuaire, et un identifiant inconnu
 *      n'en reçoit aucun ;
 *   2. aucune identité réelle ne transite par les profils, qui sont tous livrés
 *      ensemble à chaque client ;
 *   3. sans annuaire, le formulaire n'expose pas l'onglet « Partenaire ».
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { PROFILES, resolveProfile } from '../../config/clients/index.js'
import { partnersFor } from '../../config/clients/partners.js'

// Identités réelles appartenant à TAOFIC : elles ne doivent apparaître dans
// aucun autre profil, ni dans le pilote dont héritent les futurs clients.
const IDENTITES_TAOFIC = ['54525263', '7688964', '55991935']

afterEach(() => {
  cleanup()
  vi.resetModules()
  vi.clearAllMocks()
})

/**
 * Rend le formulaire dealer avec l'annuaire fourni, et attend la fin du
 * chargement des boutiques (sinon on n'observe que l'écran « Chargement… »).
 */
async function renderFormAvecPartenaires(partners) {
  vi.resetModules()
  vi.doMock('../../src/constants/dealerPartners', () => ({
    DEALER_PARTNERS: partners,
    HAS_DEALER_PARTNERS: partners.length > 0,
    partnerLabel: (p) => (p ? `${p.nom} ${p.prenom}` : ''),
    findPartner: () => null,
  }))
  vi.doMock('../../src/context/AuthContext', () => ({
    useAuth: () => ({ currentUser: { uid: 'd1' }, userProfile: { name: 'Dealer' } }),
  }))
  vi.doMock('../../src/services/dealerService', () => ({
    // Contrat réel du service : { stores, hasMore, lastDoc }.
    listActiveStores: vi.fn(() => Promise.resolve({ stores: [], hasMore: false, lastDoc: null })),
    createDealerRequest: vi.fn(),
    parseDealerAmount: (v) => Number(v),
  }))
  vi.doMock('../../src/services/storeTransferService', () => ({
    createPartnerDeposit: vi.fn(),
  }))
  vi.doMock('react-router-dom', () => ({
    useNavigate: () => vi.fn(),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  }))

  const { default: Formulaire } = await import('../../src/pages/dealer/NewDealerRequest.jsx')
  render(<Formulaire />)
  await screen.findByText('Nouvelle demande')
}

describe('TC-165 — annuaire partenaires cloisonné par client', () => {
  it('TAOFIC conserve son annuaire complet', () => {
    const partners = partnersFor('taofic-ajagbe')

    expect(partners.length).toBeGreaterThan(0)
    for (const numeroDA of IDENTITES_TAOFIC) {
      expect(partners.some(p => p.numeroDA === numeroDA)).toBe(true)
    }
  })

  it("salawu n'a aucun partenaire", () => {
    expect(partnersFor('salawu')).toEqual([])
  })

  it('un identifiant client inconnu ne recoit jamais un annuaire par defaut', () => {
    // Un build mal configure doit rester vide, pas heriter de l annuaire d autrui.
    expect(partnersFor('client-inexistant')).toEqual([])
    expect(partnersFor(undefined)).toEqual([])
    expect(partnersFor('_pilot')).toEqual([])
  })

  it('AUCUNE identite reelle ne transite par les profils clients', () => {
    // config/clients/index.js importe TOUS les profils dans un meme bundle :
    // une donnee nominative placee dans un profil est livree a chaque client.
    const serialise = JSON.stringify(PROFILES)
    for (const numeroDA of IDENTITES_TAOFIC) {
      expect(serialise).not.toContain(numeroDA)
    }
    expect(serialise).not.toContain('THIOMBIANO')
    expect(resolveProfile('salawu').dealer.partners).toBeUndefined()
    expect(resolveProfile('taofic-ajagbe').dealer.partners).toBeUndefined()
  })

  it("sans partenaire au profil, le formulaire n'affiche pas l'onglet Partenaire", async () => {
    await renderFormAvecPartenaires([])

    expect(screen.queryByTestId('target-partner')).toBeNull()
    expect(screen.queryByTestId('select-partner')).toBeNull()
    // La bascule n'a plus lieu d'être : le formulaire cible directement une boutique.
    expect(screen.queryByTestId('target-store')).toBeNull()
  })

  it("avec des partenaires au profil, l'onglet reste disponible", async () => {
    await renderFormAvecPartenaires([
      { id: '1', numeroDA: '1', nom: 'N', prenom: 'P', localite: 'L' },
    ])

    expect(screen.getByTestId('target-partner')).toBeInTheDocument()
    expect(screen.getByTestId('target-store')).toBeInTheDocument()
  })
})
