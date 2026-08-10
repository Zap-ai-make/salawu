import { useState, useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { STORE_NAV_ITEMS, IS_MULTI_NETWORK } from '../constants/navigation'
import { useTheme } from '../context/ThemeContext.jsx'
import { useAuth } from '../context/AuthContext'
import { subscribeStorePendingCount } from '../services/storeAdminDealerService'
import { subscribeIncomingCollaborationsCount } from '../services/collaborationService'
import PWAInstallButton from './PWAInstallButton'

const DEALER_REQUESTS_PATH = '/dealer-requests'
const TRANSACTIONS_PATH = '/transactions'

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
function badgeFor(path, { pendingCount, incomingCollabCount }) {
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
  return { count: 0 }
}

function NavBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { themeClasses } = useTheme()
  const { currentUser, userProfile } = useAuth()
  const [isSticky, setIsSticky] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [incomingCollabCount, setIncomingCollabCount] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY
      const headerHeight = 200 // hauteur approximative du header

      setIsSticky(scrollTop >= headerHeight)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
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

  const counts = { pendingCount, incomingCollabCount }

  return (
    <nav
      className={`${themeClasses.navbar} shadow-md w-full transition-all duration-300 z-50 ${
        isSticky
          ? 'fixed top-0 left-0 right-0 shadow-lg'
          : 'relative'
      }`}
    >
      <div className="w-full px-4">
        {/* Navigation desktop */}
        <div className="hidden md:flex justify-between items-center">
          <div className="flex-1"></div>
          <div className="flex justify-center space-x-1">
            {STORE_NAV_ITEMS.map((item) => {
              const badge = badgeFor(item.path, counts)
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `px-4 py-3 text-white font-medium transition-colors duration-200 hover:bg-black/20 inline-flex items-center ${
                      isActive ? 'bg-black/30 border-b-2 border-white/50' : ''
                    }`
                  }
                >
                  {item.name}
                  <PendingBadge count={badge.count} label={badge.label} testId={badge.testId} />
                </NavLink>
              )
            })}
          </div>
          <div className="flex-1 flex justify-end">
            <PWAInstallButton />
          </div>
        </div>

        {/* Navigation mobile */}
        <div className="md:hidden flex items-center gap-2 py-2">
          <select
            className={`min-w-0 flex-1 py-3 px-4 ${themeClasses.navbar} text-white border border-white/20 rounded focus:outline-none`}
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
