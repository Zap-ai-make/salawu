/**
 * TC-163 — Filet de caractérisation de la BANDE DES RÉSERVES de l'espace
 *          boutique : le rideau des cartes réseau et le rail de soldes collant.
 *
 * Ce que ce fichier protège
 * ─────────────────────────────────────────────────────────────────────────────
 * C'est la réponse à la seule question que le caissier se pose toute la
 * journée — « combien il me reste ? ». La direction validée la rend permanente
 * et la fusionne en une bande unique (lot L7.4). Avant de déplacer ce dispositif,
 * on fige ce qu'il DIT : les réseaux couverts, leur nom écrit en toutes lettres,
 * les montants rendus, et le comportement clavier de ses zones défilantes.
 *
 * Aucune assertion sur une classe CSS : sur le texte visible, les rôles, les
 * noms accessibles et les montants rendus.
 *
 * UN DÉFAUT EST FIGÉ TEL QUEL (⚠ DÉFAUT FIGÉ) : l'épuisement d'un stock est
 * annoncé par une couleur et un point d'exclamation, sans aucun mot. C'est une
 * violation de DESIGN.md §5 (« aucune couleur ne porte seule une information »),
 * et le premier non-négociable du brief. Il est gelé ici pour qu'on puisse
 * prouver plus tard qu'il a été corrigé et non déplacé.
 *
 * Les deux clients empruntent DEUX CHEMINS DE CODE DIFFÉRENTS — rideau
 * repliable en multi-réseaux, barre compacte en mono-réseau — et les deux sont
 * couverts : TAOFIC est en production et ne doit pas bouger.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import { pilotProfile } from '../../config/clients/_pilot.js'

vi.setConfig({ testTimeout: 30_000 })

const RESEAUX_ESAHAF = ['Orange', 'Moov', 'Telecel', 'Coris', 'Sank', 'Wave']

/**
 * Montants du banc d'essai, à l'échelle réelle du métier : sept chiffres pour la
 * liquidité, un réseau épuisé. Un écran vérifié à trois lignes rondes ne prouve
 * rien (METHODE §16.3).
 */
const SOLDES = {
  Orange: { stock: 1250000, liquidite: 430000 },
  Moov: { stock: 875500, liquidite: 210000 },
  Telecel: { stock: 12300, liquidite: 45000 },
  Coris: { stock: 0, liquidite: 8000 },
  Sank: { stock: 640000, liquidite: 120000 },
  Wave: { stock: 98750, liquidite: 63000 },
  Liquidite: { stock: 0, liquidite: 876000 },
}

/**
 * `Intl.NumberFormat('fr-FR')` sépare les milliers par une espace fine
 * insécable (U+202F) selon la version d'ICU. Asserter sur le codet exact
 * rendrait ce filet dépendant de la version de Node, pas du produit : on
 * normalise toutes les espaces avant de comparer.
 */
const normaliser = (texte) => texte.replace(/\s+/g, ' ').trim()

/** Profil factice dérivé du pilote — cf. la note de TC-162. */
function profil({ reseaux, designSystem }) {
  return {
    ...pilotProfile,
    id: 'profil-de-test',
    branding: { appName: 'ESAHAF', pwaName: 'ESAHAF', theme: 'orange' },
    design: { system: designSystem ?? 'legacy' },
    networks: { enabled: reseaux },
  }
}

function poserLesMocks({ reseaux, designSystem }) {
  vi.doMock('../../src/config/activeClientProfile.js', () => ({
    activeProfile: profil({ reseaux, designSystem }),
  }))
  vi.doMock('../../src/config/firebase', () => ({
    auth: {},
    db: {},
    functions: {},
    firebaseInfo: { projectId: 'test', isDev: true, useEmulators: false },
    default: {},
  }))
  const auth = () => ({ currentUser: { uid: 'u1' }, userProfile: { storeId: 'b1' } })
  vi.doMock('../../src/context/AuthContext', () => ({ useAuth: auth }))
  vi.doMock('../../src/context/AuthContext.jsx', () => ({ useAuth: auth }))
  vi.doMock('../../src/hooks/useSimpleNetworkData', () => ({
    useSimpleNetworkData: () => ({
      networkData: Object.fromEntries(
        [...reseaux, 'Liquidite'].map((r) => [r, SOLDES[r]]),
      ),
    }),
  }))
  // Cf. TC-163 : `NetworkCard` (chemin mono-réseau) ne consomme que ces deux
  // fonctions, et l'édition est refusée à une boutique de toute façon.
  vi.doMock('../../src/hooks/useNetworkCards', () => ({
    useNetworkCards: () => ({ updateStock: () => {}, updateLiquidity: () => {} }),
  }))
}

async function monterLeRideau(options, proprietes) {
  poserLesMocks(options)
  const { default: NetworkCardsDrawer } = await import(
    '../../src/components/network/NetworkCardsDrawer.jsx'
  )
  render(<NetworkCardsDrawer {...proprietes} />)
}

async function monterLeRail(options, proprietes) {
  poserLesMocks(options)
  const { default: StickyBalanceRail } = await import(
    '../../src/components/network/StickyBalanceRail.jsx'
  )
  render(<StickyBalanceRail top={64} {...proprietes} />)
}

const ESAHAF = { reseaux: RESEAUX_ESAHAF, designSystem: 'registre' }
const TAOFIC = { reseaux: ['Orange'] }

beforeEach(() => {
  vi.resetModules()
})
afterEach(() => {
  cleanup()
  vi.resetModules()
  vi.clearAllMocks()
})

describe('TC-163 — la bande des réserves (ESAHAF, multi-réseaux)', () => {
  it('nomme chaque réseau en toutes lettres, les six plus la liquidité', async () => {
    // La pastille de couleur est un repère de balayage, jamais un code : le nom
    // doit être écrit. C'est ce qui rend les 49 couleurs d'opérateur
    // admissibles (DESIGN.md §5).
    await monterLeRideau(ESAHAF)

    for (const nom of ['Orange', 'Moov', 'Telecel', 'Coris', 'Sank', 'Wave', 'Liquidité']) {
      expect(screen.getByText(nom)).toBeInTheDocument()
    }
  })

  it('affiche le montant de chaque réseau, groupé par milliers', async () => {
    await monterLeRideau(ESAHAF)

    const textes = Array.from(document.querySelectorAll('div')).map((n) =>
      normaliser(n.textContent),
    )
    expect(textes.some((t) => t === '1 250 000')).toBe(true)
    expect(textes.some((t) => t === '12 300')).toBe(true)
  })

  it('distingue le stock d\'un réseau de la liquidité de la caisse', async () => {
    await monterLeRideau(ESAHAF)

    expect(screen.getAllByText('Stock FCFA').length).toBe(6)
    expect(screen.getAllByText('Liquidité FCFA')).toHaveLength(1)
  })

  it('⟲ RETOURNÉ AU LOT L7.4b — la bande ne se replie plus, et n\'a plus de bouton', async () => {
    // Ce cas figeait l'inverse : un bouton « Réduire les cartes réseau »,
    // `aria-expanded` passant de true à false, et les soldes escamotables.
    //
    // Un repli n'est une bonne affordance que si ce qu'il cache est secondaire.
    // Ici il cachait la réponse à la seule question que le caissier se pose
    // toute la journée, et il la cachait DE FAÇON PERSISTANTE : replié une fois,
    // il le restait. La bande ne se replie plus ; il n'y a donc plus de bouton à
    // nommer.
    await monterLeRideau(ESAHAF)

    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Orange')).toBeInTheDocument()
    expect(screen.getByText('Liquidité')).toBeInTheDocument()
  })

  it('se cale sous la navigation à la hauteur qu\'on lui donne, jamais à une valeur devinée', async () => {
    // La navigation passe en `fixed` au défilement : une bande collée à 0 se
    // glisserait dessous. Le décalage est donc MESURÉ par le Layout et transmis
    // — une constante codée en dur cesserait d'être vraie à la première
    // modification de la barre (même raison que le seuil de bascule, TC-159).
    //
    // C'est le seul aspect de son placement qu'un filet peut tenir : le reste
    // (`position: sticky`) est une règle de feuille de style, et l'asserter
    // reviendrait à vérifier une classe CSS — ce que ces filets s'interdisent.
    await monterLeRideau(ESAHAF, { top: 64 })

    const bande = document.querySelector('[data-bande-reserves]')
    expect(bande).not.toBeNull()
    expect(bande.style.top).toBe('64px')
  })

  it('rend sa bande défilante atteignable au clavier', async () => {
    // Constat Q3 de la boucle QA : une zone à défilement horizontal non
    // focalisable rend ses derniers réseaux inatteignables sans souris.
    await monterLeRideau(ESAHAF)

    const bande = screen.getByRole('region', { name: /soldes par reseau/i })
    expect(bande).toHaveAttribute('tabindex', '0')
  })

  it('⚠ DÉFAUT FIGÉ — un stock épuisé n\'est annoncé par AUCUN mot', async () => {
    // État actuel : `NetworkBalanceCard` signale `stock <= 0` par une pastille
    // rouge et le caractère « ! ». Ni le mot « Épuisé », ni nom accessible : un
    // lecteur d'écran annonce « point d'exclamation », et un daltonien ne voit
    // qu'une ponctuation. La couleur porte seule l'information — DESIGN.md §5,
    // et le premier des quatre points sur lesquels le brief ne cède pas.
    //
    // ⟲ À RETOURNER AU LOT L7.4 : le palier s'écrira en toutes lettres, et cette
    // assertion exigera le mot au lieu de constater son absence.
    await monterLeRideau(ESAHAF)

    // Coris est à 0 : l'indicateur existe…
    expect(screen.getByText('!')).toBeInTheDocument()
    // …et aucun mot ne le double, sur toute la bande.
    expect(screen.queryByText(/épuisé/i)).toBeNull()
    expect(screen.queryByText(/\bbas\b/i)).toBeNull()
  })
})

describe('TC-163 — la barre compacte (TAOFIC, mono-réseau) reste inchangée', () => {
  it('rend une région nommée « Soldes opérationnels », et non le rideau', async () => {
    await monterLeRideau(TAOFIC)

    expect(screen.getByRole('region', { name: /soldes opérationnels/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cartes réseau/i })).toBeNull()
  })

  it('ne montre que le réseau du profil, plus la liquidité', async () => {
    await monterLeRideau(TAOFIC)

    expect(screen.getByText('Orange')).toBeInTheDocument()
    expect(screen.getByText('Liquidité')).toBeInTheDocument()
    expect(screen.queryByText('Moov')).toBeNull()
  })
})

describe('TC-163 — le rail de soldes collant', () => {
  it('au repos : masqué de l\'arbre d\'accessibilité ET du parcours clavier', async () => {
    // Un élément focalisable à l'intérieur d'un `aria-hidden` est une violation
    // axe (`aria-hidden-focus`) : le clavier entrerait dans une zone que le
    // lecteur d'écran ignore. Les deux attributs doivent basculer ENSEMBLE.
    await monterLeRail(ESAHAF, { visible: false })

    const rail = document.querySelector('[data-balance-rail]')
    expect(rail).toHaveAttribute('aria-hidden', 'true')
    expect(within(rail).getByRole('region', { hidden: true })).toHaveAttribute(
      'tabindex',
      '-1',
    )
  })

  it('visible : annoncé, atteignable au clavier, et nommé', async () => {
    await monterLeRail(ESAHAF, { visible: true })

    const rail = document.querySelector('[data-balance-rail]')
    expect(rail).toHaveAttribute('aria-hidden', 'false')

    const bande = screen.getByRole('region', { name: /soldes par réseau/i })
    expect(bande).toHaveAttribute('tabindex', '0')
  })

  it('montre EXACTEMENT les mêmes réseaux que le rideau', async () => {
    // La liste vient de `useVisibleCards`, exportée par le rideau. Dupliquer la
    // dérivation recréerait une seconde source de vérité sur « quels réseaux ce
    // client voit », et les deux divergeraient au premier client ajouté.
    await monterLeRail(ESAHAF, { visible: true })

    const bande = screen.getByRole('region', { name: /soldes par réseau/i })
    for (const nom of ['Orange', 'Moov', 'Telecel', 'Coris', 'Sank', 'Wave', 'Liquidité']) {
      expect(within(bande).getByText(nom)).toBeInTheDocument()
    }
  })

  it('dit le montant et JAMAIS le palier — les paliers restent aux cartes', async () => {
    // Décision de construction du lot 3, conservée : recopier « Bas » / « Épuisé »
    // ici en ferait une seconde source de vérité sur une règle d'exploitation.
    await monterLeRail(ESAHAF, { visible: true })

    const bande = screen.getByRole('region', { name: /soldes par réseau/i })
    expect(normaliser(bande.textContent)).toContain('1 250 000')
    expect(within(bande).queryByText(/\bbas\b|épuisé/i)).toBeNull()
  })
})
