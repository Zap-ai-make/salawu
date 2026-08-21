import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/themes.css'
import App from './App.jsx'
import { installChunkReload } from './utils/chunkReload.js'

// Récupère automatiquement d'un fragment lazy périmé après un déploiement
// (nouveau hash de chunk absent → MIME text/html). Doit être posé avant le rendu.
installChunkReload()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Le Service Worker est automatiquement enregistré par vite-plugin-pwa
// via registerSW.js injecté dans index.html
