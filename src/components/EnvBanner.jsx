import { firebaseInfo } from '../config/firebase'

/**
 * Bandeau d'avertissement d'environnement.
 *
 * Visible UNIQUEMENT en développement local quand l'application est branchée sur un
 * Firestore RÉEL (émulateurs désactivés) — c'est-à-dire le cas où `npm run dev` tape
 * directement le projet de `VITE_FIREBASE_PROJECT_ID` (ex. la prod salawu-fa726).
 * C'est aussi la configuration qui provoque le crash « Missing or insufficient
 * permissions » + assertion Firestore (ca9/b815) quand un listener est refusé.
 *
 * En build de production (`import.meta.env.DEV === false`), il ne s'affiche JAMAIS :
 * aucun impact pour les utilisateurs réels.
 */
export default function EnvBanner() {
  if (!firebaseInfo.isDev || firebaseInfo.useEmulators) return null

  return (
    <div
      role="alert"
      className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-2 bg-red-600 px-4 py-1.5 text-center text-xs font-semibold text-white shadow-lg"
    >
      <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      DEV connecté au Firestore RÉEL «&nbsp;{firebaseInfo.projectId}&nbsp;» — active les émulateurs (VITE_USE_FIREBASE_EMULATORS=true) pour ne pas toucher la prod.
    </div>
  )
}
