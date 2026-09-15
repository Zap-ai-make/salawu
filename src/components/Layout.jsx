import { useState, useEffect, useRef } from 'react'
import { Outlet } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import NavBar from './NavBar'
import NetworkCardsDrawer from './network/NetworkCardsDrawer'
import StickyBalanceRail from './network/StickyBalanceRail'
import { IS_REGISTRE } from '../constants/designSystem.js'
import { APP_NAME } from '../constants/branding'
function Layout({ children }) {
  const { themeClasses, backgroundImage } = useTheme()
  const [navbarHeight, setNavbarHeight] = useState(0)
  const [isNavbarSticky, setIsNavbarSticky] = useState(false)
  const railRef = useRef(null)
  const [railHeight, setRailHeight] = useState(0)

  // Ce composant compense le passage de la navbar en position fixe par un
  // padding sur <main>. Il DOIT donc basculer au même seuil qu'elle, sinon le
  // contenu saute — soit masqué sous la barre, soit décalé de sa hauteur dans
  // le vide. Le seuil est mesuré à la même source que dans NavBar (l'offsetTop
  // du <nav>, c'est-à-dire la hauteur du bandeau) et non codé en dur à 200 :
  // le bandeau « registre » ne fait qu'une cinquantaine de pixels.
  useEffect(() => {
    const navbar = document.querySelector('nav')
    const seuilRef = { current: 0 }

    const mesurer = () => {
      if (!navbar) return
      setNavbarHeight(navbar.offsetHeight)
      if (!navbar.classList.contains('fixed')) {
        seuilRef.current = navbar.offsetTop
      }
    }
    mesurer()

    const handleScroll = () => {
      setIsNavbarSticky(window.scrollY >= seuilRef.current)
    }
    const handleResize = () => {
      mesurer()
      handleScroll()
    }

    window.addEventListener('scroll', handleScroll)
    window.addEventListener('resize', handleResize)

    // Le rail de soldes est MESURÉ, jamais supposé. Sa hauteur dépend de données
    // réseau qui arrivent après le montage : la mesurer une fois donnerait 0, et
    // <main> passerait sous le rail au défilement. Même raison de fond que le
    // seuil de la navbar (TC-159) — une hauteur codée en dur cesse d'être vraie
    // à la première modification de ce qu'elle décrit.
    let observateur
    if (railRef.current && typeof ResizeObserver !== 'undefined') {
      observateur = new ResizeObserver(([entree]) => {
        setRailHeight(entree.target.offsetHeight)
      })
      observateur.observe(railRef.current)
    }

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
      observateur?.disconnect()
    }
  }, [])

  return (
    <div className={`min-h-screen ${themeClasses.background}`}>
      {/* Header. Un thème sans image (identité « registre ») rend un bandeau de
          marque compact : 200 px de photo décorative sur un téléphone, c'est
          autant d'écran en moins pour les soldes et les transactions, qui sont
          le travail réel. Les thèmes historiques gardent leur bandeau photo. */}
      {backgroundImage ? (
        <header
          className="relative text-white w-full overflow-hidden"
          style={{
            backgroundImage: `url(${backgroundImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundAttachment: 'fixed',
            minHeight: '200px'
          }}
        >
          {/* Overlay pour garder la visibilité */}
          <div className="absolute inset-0 bg-black/20"></div>

          {/* Contenu du header */}
          <div className="relative z-10 w-full px-4 py-12 flex items-center justify-center">
            <h1
              className="text-4xl font-bold text-center text-white"
              style={{
                textShadow: '0 3px 12px rgba(0, 0, 0, 0.8), 0 2px 6px rgba(0, 0, 0, 0.6)'
              }}
            >
              {APP_NAME}
            </h1>
          </div>
        </header>
      ) : (
        <header className="w-full border-b border-reglure bg-papier px-4 py-3">
          <h1 className="text-lg font-semibold tracking-tight text-encre">{APP_NAME}</h1>
        </header>
      )}

      {/* Navigation */}
      <NavBar />

      {/* Rail de soldes collant — identité « registre » uniquement. C'est un
          parti pris de mise en page, pas une correction : il passe donc par
          `profil.design`, comme M5. */}
      {IS_REGISTRE && (
        <StickyBalanceRail ref={railRef} visible={isNavbarSticky} top={navbarHeight} />
      )}

      {/* Rideau des cartes réseau */}
      <NetworkCardsDrawer />

      {/* Contenu principal avec padding top conditionnel */}
      <main
        className="w-full px-4 py-6 transition-all duration-300"
        style={{
          paddingTop: isNavbarSticky ? `${navbarHeight + railHeight + 24}px` : '24px'
        }}
      >
        <div className="relative">
          {/* Second calque de la même image, à 5 % d'opacité. Décoratif, et coûteux
              au scroll mobile (`background-attachment: fixed`). Absent de l'identité
              « registre », qui n'a pas d'image. */}
          {backgroundImage && (
            <div
              className="fixed inset-0 -z-10 opacity-5"
              style={{
                backgroundImage: `url(${backgroundImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                backgroundAttachment: 'fixed'
              }}
            />
          )}
          {children !== undefined ? children : <Outlet />}
        </div>
      </main>

    </div>
  )
}

export default Layout
