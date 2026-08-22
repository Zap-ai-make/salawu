import { useState, useEffect } from 'react'

/**
 * Statut de connexion réseau (navigator.onLine + événements 'online'/'offline').
 *
 * Source unique réutilisable : bandeau hors-ligne, écran de déverrouillage offline,
 * moteur de synchronisation. `navigator.onLine` reflète la connectivité de l'appareil
 * (pas la joignabilité réelle du serveur) ; c'est suffisant pour basculer l'UI en mode
 * hors-ligne. Repli `true` si `navigator` est absent (SSR/tests hors DOM).
 *
 * @returns {boolean} true si l'appareil est en ligne.
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )

  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return isOnline
}

export default useOnlineStatus
