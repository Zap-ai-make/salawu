import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import NavBar from './NavBar'
import NetworkCardsDrawer from './network/NetworkCardsDrawer'
import { IS_REGISTRE } from '../constants/designSystem.js'
import { APP_NAME } from '../constants/branding'

/**
 * ⚠ `StickyBalanceRail` n'est plus monté ici — et son fichier est CONSERVÉ.
 *
 * Il répondait à un vrai manque : le rideau des cartes réseau disparaissait dès
 * qu'on faisait défiler une liste, c'est-à-dire au moment exact où la question
 * « combien il me reste » se pose. Il compensait donc un effet. La bande des
 * réserves supprime la cause — elle ne s'en va plus — et deux rendus de la même
 * donnée redeviennent un seul.
 *
 * Le fichier reste sur disque et ses contrats d'accessibilité restent testés
 * (TC-161) : supprimer un fichier relève du protocole de CLAUDE.md, pas d'un lot
 * de design.
 */
/**
 * La balise du wordmark — et c'est une décision d'ACCESSIBILITÉ, pas de style.
 *
 * Le bandeau de marque portait un `<h1>`, et chaque écran porte le sien : deux
 * titres de niveau 1 par page, donc un plan de document qui annonce deux fois
 * « ce document parle de… ». Un lecteur d'écran qui liste les titres commence par
 * « ESAHAF » sur les dix écrans, et le titre utile arrive en second.
 *
 * La maquette tranche dans le même sens : le wordmark y est
 * `<span class="marque__nom">`, et le seul `h1` est celui de l'écran
 * (`.ecran h1`, maquette l.111). Le bandeau photographique, lui, est CONSERVÉ.
 *
 * ⚠ GARDÉ PAR `IS_REGISTRE`, et pas appliqué à tous. TAOFIC emprunte la même
 * branche d'en-tête (son thème déclare aussi `backgroundImage`, themes.js:50) et
 * il est en production : son arbre d'accessibilité ne doit pas bouger dans un lot
 * de refonte visuelle. Le défaut y reste, et il est écrit dans le bilan plutôt
 * que corrigé au passage.
 *
 * `IS_REGISTRE` et non un identifiant de client : c'est le même mécanisme que le
 * rail de soldes ci-dessous — un parti pris de mise en page, porté par
 * `profil.design`. Une constante calculée une fois, et non un `if` répété dans
 * l'arbre JSX.
 */
const Marque = IS_REGISTRE ? 'span' : 'h1'

function Layout({ children }) {
  const { themeClasses, backgroundImage } = useTheme()
  const [navbarHeight, setNavbarHeight] = useState(0)
  const [isNavbarSticky, setIsNavbarSticky] = useState(false)

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

    // Le ResizeObserver qui mesurait la hauteur du rail a disparu avec lui, et
    // ce n'est pas un nettoyage de circonstance : un élément `fixed` est hors
    // flux, donc sa hauteur devait être mesurée puis reversée en `padding-top`
    // sur <main>, sinon le contenu passait dessous. La bande des réserves est
    // `sticky` — elle garde sa place dans le flux. Il n'y a plus de hauteur à
    // mesurer, donc plus rien à resynchroniser quand elle change.

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
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
            <Marque
              data-marque
              className="text-4xl font-bold text-center text-white"
              style={{
                textShadow: '0 3px 12px rgba(0, 0, 0, 0.8), 0 2px 6px rgba(0, 0, 0, 0.6)'
              }}
            >
              {APP_NAME}
            </Marque>
          </div>
        </header>
      ) : (
        <header className="w-full border-b border-reglure bg-papier px-4 py-3">
          <Marque data-marque className="text-lg font-semibold tracking-tight text-encre">
            {APP_NAME}
          </Marque>
        </header>
      )}

      {/* Navigation */}
      <NavBar />

      {/* La bande des réserves. `top` est la hauteur de la navigation, mesurée :
          celle-ci passe en `fixed` au défilement, et une bande collée à 0 se
          glisserait dessous. Une valeur codée en dur cesserait d'être vraie à la
          première modification de la barre — même raison que le seuil de bascule
          (TC-159). Le rideau repliable des profils sans identité « registre » ne
          lit pas cette propriété. */}
      <NetworkCardsDrawer top={navbarHeight} />

      {/* Contenu principal avec padding top conditionnel.
          `data-espace="boutique"` est un FAIT : ce Layout sert EXCLUSIVEMENT
          l'espace boutique (App.jsx:125 ; l'admin a `AdminLayout`, le dealer
          `DealerLayout`). Il n'y a donc rien à vérifier à l'exécution.

          Ce marqueur existe parce que `.design-registre` ne suffit pas : posée
          sur <html>, cette portée couvre TOUT le client ESAHAF, espaces admin et
          dealer compris — or `PageHeader` est partagé par treize écrans, dont
          neuf hors de ce chantier. Les restyler serait déborder du mandat.
          Ensemble, les deux sélecteurs disent exactement « cette identité, dans
          cet espace », et rien de plus. */}
      <main
        data-espace="boutique"
        className="w-full px-4 py-6 transition-all duration-300"
        style={{
          paddingTop: isNavbarSticky ? `${navbarHeight + 24}px` : '24px'
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
