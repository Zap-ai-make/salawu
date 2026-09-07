import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'

/**
 * TC-160 — Les tuiles d'indicateurs de l'espace Admin varient par CLIENT.
 *
 * Ce que ce test protège, et pourquoi il existe :
 *
 * Le constat M5 du bilan de design ramène les six tuiles de `AdminDashboard` à
 * quatre. Or `AdminDashboard` n'a AUCUN garde de design : la première version du
 * changement s'appliquait donc aussi à TAOFIC, client en service. La frontière
 * retenue — et c'est elle que ce test fige :
 *
 *   • une CORRECTION (contraste, emoji, focus) vaut pour le produit entier ;
 *   • un PARTI PRIS de mise en page vaut pour un client, et passe par
 *     `profil.design` (config/clients/_pilot.js).
 *
 * D'où les deux cas ci-dessous. Le cas « legacy » est le plus important des
 * deux : c'est le seul qui protège un client réel d'un changement qu'il n'a pas
 * demandé.
 *
 * ⚠ On vérifie aussi que les emoji ne reviennent PAS avec les six tuiles. Leur
 * retrait est un non-négociable de DESIGN.md §8 — donc une correction, donc
 * product-wide. Sans cette assertion, « rétablir TAOFIC » se confondrait avec
 * « annuler tout le lot pour TAOFIC ».
 */

const COMPTES = {
  totalStores: 12,
  activeStores: 9,
  inactiveStores: 3,
  totalUsers: 40,
  totalClients: 250,
  pendingRequests: 5,
}

function poserLesMocks({ registre }) {
  vi.doMock('../../src/constants/designSystem.js', () => ({
    IS_REGISTRE: registre,
    DESIGN_SYSTEM: registre ? 'registre' : 'legacy',
    DESIGN_ROOT_CLASS: registre ? 'design-registre' : 'design-legacy',
  }))

  vi.doMock('../../src/services/adminService', () => ({
    getAdminDashboardCounts: vi.fn().mockResolvedValue(COMPTES),
    getDealerRequestCounts: vi.fn().mockResolvedValue({ confirmed: 7, rejected: 2 }),
    getUserCountsByRole: vi.fn().mockResolvedValue({ dealer: 4, store_admin: 30 }),
    getRecentDealerRequests: vi.fn().mockResolvedValue([]),
  }))

  vi.doMock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
}

async function rendre({ registre }) {
  poserLesMocks({ registre })
  const { default: AdminDashboard } = await import('../../src/pages/admin/AdminDashboard.jsx')
  render(<AdminDashboard />)
  // Les compteurs arrivent de façon asynchrone : sans cette attente on
  // mesurerait le squelette de chargement, pas les tuiles.
  await waitFor(() => expect(screen.getByText('Boutiques actives')).toBeInTheDocument())
}

// Les libellés servent de sonde : ils sont stables, contrairement aux classes.
//
// ⚠ Le relevé est SCOPÉ à la section des indicateurs, et ce n'est pas un détail :
// l'écran porte aussi des cartes d'« Accès rapides » dont l'une s'intitule
// « Utilisateurs ». Une recherche sur la page entière en ramenait cinq là où
// quatre étaient attendues — le test accusait alors le code d'un défaut qui était
// le sien. On s'appuie sur `aria-labelledby="kpi-heading"`, qui fait de cette
// section une région nommée : la structure d'accessibilité sert ici de prise.
function libellesDesTuiles() {
  const indicateurs = screen.getByRole('region', { name: /indicateurs clés/i })
  return within(indicateurs).getAllByText(
    /^(Boutiques totales|Boutiques actives|Boutiques inactives|Utilisateurs|Agents \/ Clients|Demandes en attente)$/,
  ).map((n) => n.textContent)
}

// `vi.resetModules()` + import dynamique recharge une instance de React
// COMPLETE a chaque cas : c'est ce qui isole les deux valeurs de `IS_REGISTRE`,
// et cela coute plusieurs secondes. Sous charge, les 5 s par defaut de vitest
// sont depassees et le fichier rend un ROUGE qui ne dit rien du code — il a
// echoue une fois et passe deux fois sur le meme commit. On paie le vrai cout du
// harnais au lieu de tirer au sort.
vi.setConfig({ testTimeout: 30_000 })

beforeEach(() => { vi.resetModules() })
afterEach(() => { vi.doUnmock('../../src/constants/designSystem.js'); vi.clearAllMocks() })

describe('TC-160 — client « legacy » (TAOFIC) : les six tuiles d\'origine', () => {
  it('conserve les six tuiles dans leur ordre historique', async () => {
    await rendre({ registre: false })

    expect(libellesDesTuiles()).toEqual([
      'Boutiques totales',
      'Boutiques actives',
      'Boutiques inactives',
      'Utilisateurs',
      'Agents / Clients',
      'Demandes en attente',
    ])
  })

  it('affiche bien les trois compteurs de boutiques comme valeurs de plein droit', async () => {
    await rendre({ registre: false })

    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('9')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('ne réintroduit aucun emoji avec les six tuiles', async () => {
    await rendre({ registre: false })

    // Plage des pictogrammes et symboles divers + emoji supplémentaires.
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u
    expect(emoji.test(document.body.textContent)).toBe(false)
  })
})

describe('TC-160 — client « registre » (ESAHAF) : quatre tuiles', () => {
  it('réduit à quatre tuiles et place « Demandes en attente » en tête', async () => {
    await rendre({ registre: true })

    expect(libellesDesTuiles()).toEqual([
      'Demandes en attente',
      'Boutiques actives',
      'Utilisateurs',
      'Agents / Clients',
    ])
  })

  it('ne perd AUCUN chiffre : total et inactives passent en ligne secondaire', async () => {
    await rendre({ registre: true })

    // C'est la promesse explicite de M5 — les chiffres changent de rang, ils ne
    // disparaissent pas. Un test qui ne compterait que les tuiles laisserait
    // passer une suppression pure et simple.
    expect(screen.getByText('3 inactives · 12 au total')).toBeInTheDocument()
  })
})
