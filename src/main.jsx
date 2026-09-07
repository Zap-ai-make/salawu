import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { installChunkReload } from './utils/chunkReload.js'
import { DESIGN_ROOT_CLASS } from './constants/designSystem.js'

// Récupère automatiquement d'un fragment lazy périmé après un déploiement
// (nouveau hash de chunk absent → MIME text/html). Doit être posé avant le rendu.
installChunkReload()

// Portée du système visuel, posée sur <html> AVANT le premier rendu pour éviter
// tout clignotement. C'est elle qui isole les identités : les règles de la refonte
// sont écrites sous `.design-registre` et ne peuvent donc pas atteindre un client
// resté en 'legacy' (TAOFIC), quelle que soit la feuille de style partagée.
document.documentElement.classList.add(DESIGN_ROOT_CLASS)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Le Service Worker est automatiquement enregistré par vite-plugin-pwa
// via registerSW.js injecté dans index.html
