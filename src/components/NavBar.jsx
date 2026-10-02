import { Fragment, useState, useEffect, useRef } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { STORE_NAV_ITEMS, IS_MULTI_NETWORK } from '../constants/navigation'
import { useTheme } from '../context/ThemeContext.jsx'
import { useAuth } from '../context/AuthContext'
import { getAvatarInitial } from '../utils/authHelpers'
import { subscribeStorePendingCount } from '../services/storeAdminDealerService'
import {
  subscribeIncomingCollaborationsCount,
  subscribeSettlementsToConfirmCount,
} from '../services/collaborationService'
import PWAInstallButton from './PWAInstallButton'

const DEALER_REQUESTS_PATH = '/dealer-requests'
const TRANSACTIONS_PATH = '/transactions'
const DEBTS_PATH = '/store/debts'

// Pastille blanche et non rouge : la navbar prend la couleur du thème choisi
// (orange ESAHAF, mais aussi bleu, vert, violet…), et un rouge sur orange est
// illisible en plein soleil, qui est le contexte d'usage réel. Le blanc opaque
// tranche sur les sept thèmes comme sur une couleur personnalisée.
function PendingBadge({ count, label, testId }) {
  if (!count) return null
  return (
    <span
      className="ml-1.5 inline-flex items-center justify-center rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-gray-900 leading-none min-w-[1.2rem] shadow-sm ring-1 ring-black/5"
      aria-label={label}
      data-testid={testId}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

// Badge de l'entrée de navigation, sur le modèle de badgeFor() dans DealerLayout.
function badgeFor(path, { pendingCount, incomingCollabCount, settlementsToConfirmCount }) {
  if (path === DEALER_REQUESTS_PATH) {
    return {
      count: pendingCount,
      testId: 'store-pending-badge',
      label: `${pendingCount} demande${pendingCount > 1 ? 's' : ''} en attente`,
    }
  }
  if (path === TRANSACTIONS_PATH) {
    return {
      count: incomingCollabCount,
      testId: 'store-collab-badge',
      label: `${incomingCollabCount} collaboration${incomingCollabCount > 1 ? 's' : ''} à exécuter`,
    }
  }
  if (path === DEBTS_PATH) {
    return {
      count: settlementsToConfirmCount,
      testId: 'store-debts-badge',
      label: `${settlementsToConfirmCount} règlement${settlementsToConfirmCount > 1 ? 's' : ''} à confirmer`,
    }
  }
  return { count: 0 }
}

// ═══════════════════════════════════════════════════════════════════════════
// LA DISPOSITION DE LA BARRE, DÉRIVÉE DE `groupe` ET DE RIEN D'AUTRE.
// ───────────────────────────────────────────────────────────────────────────
// La barre ne connaît ni « Clients », ni « Profil », ni aucun chemin : elle lit
// le `groupe` déclaré dans navigation.js, découpe sur ses changements de valeur
// et pose un filet à chaque frontière. Déplacer une entrée ou en créer un
// troisième groupe se fait donc dans la constante, sans revenir ici.
//
// ⚠ C'EST AUSSI CE QUI PROTÈGE TAOFIC. Ses entrées n'ont pas de `groupe` :
// `ENTREES_COMPTE` est vide, `NAV_EPINGLEE` est faux, et le rendu emprunte la
// branche historique — le même DOM qu'avant ce lot, aux mêmes classes près. Le
// garde n'est pas un `if` sur le client, c'est l'absence de la donnée.
//
// Calculé UNE FOIS au chargement du module et non à chaque rendu : la liste est
// figée à l'import (elle dépend du profil actif, pas de l'état de l'écran).
const ENTREES_COMPTE = STORE_NAV_ITEMS.filter((item) => item.groupe === 'compte')

const BLOCS_PRINCIPAUX = STORE_NAV_ITEMS
  .filter((item) => item.groupe !== 'compte')
  .reduce((blocs, item) => {
    const dernier = blocs[blocs.length - 1]
    if (dernier && dernier.groupe === item.groupe) dernier.items.push(item)
    else blocs.push({ groupe: item.groupe, items: [item] })
    return blocs
  }, [])

const NAV_EPINGLEE = ENTREES_COMPTE.length > 0

// Les classes du lien ordinaire, extraites pour que les deux branches de rendu
// ne puissent pas diverger : TAOFIC doit obtenir la chaîne d'avant, au caractère.
const CLASSES_LIEN =
  'px-4 py-3 text-white font-medium transition-colors duration-200 hover:bg-black/20 inline-flex items-center'

function LienDeNav({ item, counts }) {
  const badge = badgeFor(item.path, counts)
  return (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        `${CLASSES_LIEN} ${isActive ? 'bg-black/30 border-b-2 border-white/50' : ''}`
      }
    >
      {item.name}
      <PendingBadge count={badge.count} label={badge.label} testId={badge.testId} />
    </NavLink>
  )
}

// L'entrée de compte : une pastille d'initiales et le libellé, dans une pilule.
//
// La pastille est `aria-hidden` PARCE QUE LE LIEN DIT DÉJÀ « Profil ». Deux
// lettres annoncées avant lui n'apprendraient rien à qui écoute la page — elles
// ajouteraient du bruit sur le seul lien qu'on atteint au clavier après six
// autres. C'est une aide à la reconnaissance visuelle, pas une information.
//
// Au repos la pilule porte un anneau plutôt qu'un fond : sur les sept thèmes,
// un fond clair permanent à cet endroit ferait concurrence à l'onglet courant,
// qui est le seul élément de la barre autorisé à se remplir.
function LienDeCompte({ item, initiales }) {
  return (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        `pl-1.5 pr-4 py-1.5 gap-2 rounded-full text-white font-medium transition-colors duration-200 hover:bg-black/20 inline-flex items-center ${
          isActive ? 'bg-black/30' : 'ring-1 ring-white/25'
        }`
      }
    >
      <span
        data-nav-initiales
        aria-hidden="true"
        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-[11px] font-bold leading-none ring-1 ring-white/30"
      >
        {initiales}
      </span>
      {item.name}
    </NavLink>
  )
}

function NavBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { themeClasses } = useTheme()
  const { currentUser, userProfile, activeStore } = useAuth()
  const navRef = useRef(null)
  const [isSticky, setIsSticky] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [incomingCollabCount, setIncomingCollabCount] = useState(0)
  const [settlementsToConfirmCount, setSettlementsToConfirmCount] = useState(0)

  // Seuil de bascule en barre fixe : la hauteur RÉELLE du bandeau qui précède,
  // mesurée, et non une constante.
  //
  // Elle valait 200 en dur — la hauteur du bandeau photo historique. L'identité
  // « registre » rend un bandeau de marque compact (~53 px) : entre 53 px et
  // 200 px de défilement, la navigation sortait de l'écran sans être remplacée,
  // puis réapparaissait d'un coup. Un menu qui disparaît pendant 150 px de
  // défilement est un défaut d'usage, pas un détail d'animation.
  //
  // `offsetTop` du <nav> EST la hauteur de ce qui le précède : la mesure vaut
  // pour les deux identités, et rend ~200 pour un client resté en 'legacy' —
  // donc comportement inchangé pour TAOFIC, sans avoir à le coder.
  const seuilStickyRef = useRef(0)

  useEffect(() => {
    const nav = navRef.current

    // Ne mesurer que lorsque le <nav> est dans le flux : une fois `fixed`, son
    // offsetTop vaut 0 et le seuil s'effondrerait à chaque défilement.
    const mesurer = () => {
      if (nav && !nav.classList.contains('fixed')) {
        seuilStickyRef.current = nav.offsetTop
      }
    }
    mesurer()

    const handleScroll = () => {
      setIsSticky(window.scrollY >= seuilStickyRef.current)
    }

    // Le bandeau peut changer de hauteur au redimensionnement (titre qui passe
    // sur deux lignes en étroit) : on remesure, sinon le seuil se fige sur la
    // première orientation de l'appareil.
    const handleResize = () => {
      mesurer()
      handleScroll()
    }

    window.addEventListener('scroll', handleScroll)
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    setPendingCount(0)
    const unsub = subscribeStorePendingCount({
      currentUser,
      userProfile,
      onUpdate: setPendingCount,
    })
    return unsub
  }, [currentUser, userProfile])

  // Les collaborations reçues sont passées dans un sous-onglet de Transactions :
  // sans ce compteur, une boutique fournisseuse ne verrait plus qu'on attend une
  // exécution. Rien à écouter chez un client mono-réseau.
  useEffect(() => {
    setIncomingCollabCount(0)
    if (!IS_MULTI_NETWORK) return undefined
    return subscribeIncomingCollaborationsCount({
      storeId: userProfile?.storeId ?? null,
      onUpdate: setIncomingCollabCount,
    })
  }, [userProfile])

  // Tranches de règlement déclarées attendant ma confirmation : c'est une action à
  // faire, donc le badge s'éteint dès qu'il n'y a plus rien à traiter — au contraire
  // d'un compteur de dettes ouvertes, qui resterait allumé en permanence.
  useEffect(() => {
    setSettlementsToConfirmCount(0)
    if (!IS_MULTI_NETWORK) return undefined
    return subscribeSettlementsToConfirmCount({
      storeId: userProfile?.storeId ?? null,
      onUpdate: setSettlementsToConfirmCount,
    })
  }, [userProfile])

  const counts = { pendingCount, incomingCollabCount, settlementsToConfirmCount }

  // Les initiales de la pastille de compte. MÊME CHAÎNE DE REPLI QUE L'ÉCRAN
  // Profil (src/pages/Profil.jsx l. 49-50), et c'est la raison d'être de la
  // duplication : la barre et l'écran doivent désigner la MÊME boutique. Deux
  // chaînes divergentes donneraient une pastille qui n'est le raccourci de rien.
  // `getAvatarInitial` retombe sur « U » quand il n'a ni nom ni courriel — la
  // pastille n'est donc jamais vide, et la pilule ne change pas de largeur
  // pendant que le profil se charge.
  const initiales = getAvatarInitial(
    activeStore?.name || userProfile?.storeName || userProfile?.name || '',
    userProfile?.email || currentUser?.email || '',
  )

  // `data-nav` est un FAIT : « ceci est la navigation de la boutique ». Il
  // n'existe que dans ce composant, qui n'est monté que par le Layout boutique —
  // les espaces dealer et gérant ont leurs propres barres et ne lisent même pas
  // `themeClasses.navbar`. C'est ce qui permet à src/index.css de dessiner
  // l'onglet courant sans déborder sur un espace hors chantier.
  return (
    <nav
      ref={navRef}
      data-nav
      className={`${themeClasses.navbar} shadow-md w-full transition-all duration-300 z-50 ${
        isSticky
          ? 'fixed top-0 left-0 right-0 shadow-lg'
          : 'relative'
      }`}
    >
      <div className="w-full px-4">
        {/* Navigation desktop — deux dispositions, choisies par la DONNÉE. */}
        {NAV_EPINGLEE ? (
          /* La disposition demandée : l'exploitation à gauche, le répertoire
             après un filet, le compte épinglé à droite. `justify-between` fait
             tout l'épinglage — aucune règle n'a à compter les entrées.

             `flex-wrap` sur le seul bloc de gauche, et `shrink-0` à droite : si
             la place manque a 768 px, ce sont les onglets qui passent a la
             ligne, jamais la pilule de compte — elle doit rester au coin, c'est
             ce qui la rend reperable. Meme lecon que le constat Q5, ou les huit
             entrees faisaient deborder la PAGE de 68 px.
             La hauteur de la barre change avec le repli — c'est sans consequence :
             le seuil de bascule en position fixe est MESURE depuis TC-159. */
          <div className="hidden md:flex justify-between items-center gap-4">
            <div className="flex flex-wrap items-center gap-1">
              {BLOCS_PRINCIPAUX.map((bloc, rang) => (
                <Fragment key={bloc.groupe}>
                  {rang > 0 && (
                    <span
                      data-nav-filet
                      aria-hidden="true"
                      className="self-stretch my-2 mx-2 w-px bg-white/25"
                    />
                  )}
                  {bloc.items.map((item) => (
                    <LienDeNav key={item.path} item={item} counts={counts} />
                  ))}
                </Fragment>
              ))}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div data-nav-compte className="flex items-center gap-1">
                {ENTREES_COMPTE.map((item) => (
                  <LienDeCompte key={item.path} item={item} initiales={initiales} />
                ))}
              </div>
              <PWAInstallButton />
            </div>
          </div>
        ) : (
          /* La disposition historique, INCHANGÉE — c'est celle de TAOFIC. */
          <div className="hidden md:flex justify-between items-center">
            <div className="flex-1"></div>
            {/* `flex-wrap` : a 768 px pile — la largeur du point de rupture `md` — les
                huit entrees ne tiennent pas sur une ligne et faisaient deborder la PAGE
                de 68 px (constat Q5). On les laisse passer a la ligne plutot que de
                masquer des entrees ou d'imposer un defilement lateral.
                `gap-1` et non `space-x-1` : `space-x` n'espace que l'axe horizontal,
                donc les deux rangees se toucheraient.
                La hauteur de la barre change avec le repli — c'est sans consequence :
                le seuil de bascule en position fixe est MESURE depuis TC-159, il suit
                tout seul. Une constante en dur aurait ete a rectifier ici. */}
            <div className="flex flex-wrap justify-center gap-1">
              {STORE_NAV_ITEMS.map((item) => (
                <LienDeNav key={item.path} item={item} counts={counts} />
              ))}
            </div>
            <div className="flex-1 flex justify-end">
              <PWAInstallButton />
            </div>
          </div>
        )}

        {/* Navigation mobile */}
        <div className="md:hidden flex items-center gap-2 py-2">
          <select
            // Anneau blanc et non coloré : ce select vit DANS la navbar, dont la
            // couleur suit le thème. Un anneau teinté disparaîtrait sur le thème
            // de même teinte ; le blanc tranche sur les sept.
            className={`min-w-0 flex-1 py-3 px-4 ${themeClasses.navbar} text-white border border-white/20 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-1 focus-visible:ring-offset-black/20`}
            onChange={(e) => navigate(e.target.value)}
            value={location.pathname}
            aria-label="Navigation principale"
          >
            <option value="" disabled>Sélectionner une page</option>
            {STORE_NAV_ITEMS.map((item) => {
              const { count } = badgeFor(item.path, counts)
              return (
                <option key={item.path} value={item.path}>
                  {count > 0 ? `${item.name} (${count > 99 ? '99+' : count})` : item.name}
                </option>
              )
            })}
          </select>
          <div className="shrink-0">
            <PWAInstallButton />
          </div>
        </div>
      </div>
    </nav>
  )
}

export default NavBar
