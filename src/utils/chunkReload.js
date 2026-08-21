/**
 * Résilience aux déploiements pour une SPA à découpage de code (React.lazy) + PWA.
 *
 * Après un déploiement, un onglet resté ouvert exécute encore l'ANCIEN index.html :
 * il référence des fragments (`Historique-<hash>.js`) dont le hash a changé. Le
 * nouveau Service Worker (registerType:'autoUpdate' → skipWaiting + clientsClaim +
 * cleanupOutdatedCaches) a déjà purgé l'ancien cache ; la requête part au réseau,
 * Vercel renvoie index.html (SPA fallback) avec un type MIME text/html → l'import
 * dynamique échoue :
 *   « Failed to fetch dynamically imported module … / MIME type text/html ».
 *
 * Remède : recharger UNE fois. Le rechargement sert le nouvel index.html (précaché
 * par le nouveau SW) qui pointe vers les bons hash → l'import réussit. Garde-fou
 * horodaté : pas de nouveau rechargement auto dans les 10 s → évite la boucle si
 * l'échec est réel (réseau coupé) tout en récupérant d'un déploiement ultérieur.
 */

const RELOAD_TS_KEY = 'chunk-reload-ts'
const RELOAD_COOLDOWN_MS = 10_000

/** Reconnaît le message d'un import dynamique de fragment périmé/introuvable. */
export function isChunkLoadError(err) {
  const msg = String(err?.message ?? err ?? '')
  return /dynamically imported module|module script failed|Failed to fetch dynamically|error loading dynamically imported|Importing a module script failed/i.test(msg)
}

/**
 * Recharge au plus une fois par fenêtre de {@link RELOAD_COOLDOWN_MS}.
 * @returns {boolean} true si un rechargement a été déclenché.
 */
export function reloadForStaleChunk(reload = () => window.location.reload()) {
  let last = 0
  try {
    last = Number(sessionStorage.getItem(RELOAD_TS_KEY) || 0)
  } catch {
    return false // sessionStorage indisponible (mode privé strict) → ne pas risquer la boucle
  }
  if (Date.now() - last < RELOAD_COOLDOWN_MS) return false
  try { sessionStorage.setItem(RELOAD_TS_KEY, String(Date.now())) } catch { /* ignore */ }
  reload()
  return true
}

/**
 * À appeler au démarrage (main.jsx). Écoute les deux voies d'échec d'un import
 * dynamique et déclenche un rechargement borné. Idempotent en pratique (appelé une fois).
 * @param {{ reload?: () => void }} [opts]
 */
export function installChunkReload({ reload } = {}) {
  if (typeof window === 'undefined') return
  const doReload = () => reloadForStaleChunk(reload)

  // Voie 1 : événement Vite dédié aux échecs de préchargement d'import dynamique.
  window.addEventListener('vite:preloadError', (e) => {
    e.preventDefault?.() // empêche Vite de relancer l'erreur : on gère par rechargement.
    doReload()
  })

  // Voie 2 : filet pour un rejet de promesse non capté issu d'un import de fragment.
  window.addEventListener('unhandledrejection', (e) => {
    if (isChunkLoadError(e.reason)) doReload()
  })
}
