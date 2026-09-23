import { useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useNavigate } from 'react-router-dom'
import ChangePasswordModal from '../components/auth/ChangePasswordModal'
import { formatDate, getAvatarInitial } from '../utils/authHelpers'
import { AUTH_LABELS, AUTH_ROLE_LABELS } from '../constants/authMessages'
import { AUTH_STYLES } from '../constants/authStyles'
import { useUserActivity } from '../hooks/useUserActivity'
import CelluleReseau from '../components/ui/CelluleReseau'
import { NETWORK_OPTIONS } from '../utils/constants'
import { IS_REGISTRE } from '../constants/designSystem.js'

/**
 * Une information en LECTURE : un libelle, une valeur, rien a remplir.
 *
 * `data-faux-label` dit « ceci a l'air d'une etiquette de champ mais n'en est
 * pas une » — la portee CSS lui donne la graisse et la taille d'un libelle sans
 * qu'un `<label>` mente sur l'existence d'un controle.
 *
 * `nombre` : une date prend la chasse fixe, comme partout ailleurs dans le
 * produit. Elle n'est pas un montant — pas de calage a droite.
 */
function ChampLecture({ libelle, valeur, children, fort = false, nombre = false }) {
  return (
    <div>
      <span data-faux-label className="block text-sm font-medium text-gray-700 mb-2">
        {libelle}
      </span>
      {valeur !== undefined && (
        <p data-nombre={nombre ? '' : undefined} className={`m-0 break-words${fort ? ' font-semibold' : ''}`}>
          {valeur}
        </p>
      )}
      {children}
    </div>
  )
}

function Profil() {
  const { currentUser, userProfile, activeStore, logout } = useAuth()
  const { themeClasses } = useTheme()
  const navigate = useNavigate()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [loading, setLoading] = useState(false)

  // Utiliser les données Firebase Auth comme fallback
  const displayName = activeStore?.name || userProfile?.storeName || userProfile?.name || currentUser?.email?.split('@')[0] || 'Boutique'
  const displayEmail = userProfile?.email || currentUser?.email || 'Non renseigné'
  const isEmailVerified = currentUser?.emailVerified || false
  const creationTime = userProfile?.createdAt || currentUser?.metadata?.creationTime || null
  const lastSignInTime = userProfile?.lastLogin || currentUser?.metadata?.lastSignInTime || null

  // Calculer les vraies statistiques d'activité
  const userActivity = useUserActivity(currentUser, userProfile)

  const handleLogout = useCallback(async () => {
    try {
      setLoading(true)
      await logout()
      navigate('/')
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error)
    } finally {
      setLoading(false)
      setShowLogoutConfirm(false)
    }
  }, [logout, navigate])

  const getRoleLabel = useCallback((role) => AUTH_ROLE_LABELS[role] || 'Utilisateur', [])

  return (
    <div data-chassis data-ecran className="max-w-4xl mx-auto space-y-6">
      {/* En-tête du profil */}
      <div data-surface className="bg-white rounded-lg shadow-md p-6">
        {/* Empile sous 640 px : avatar, identite et deux boutons sur une seule
            rangee depassaient de 187 px a 375 px (constat Q6). `gap-4` remplace
            `space-x-4`, qui n'espace pas les rangees une fois le repli actif. */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className={`w-16 h-16 ${themeClasses.accent} rounded-full flex items-center justify-center text-white text-2xl font-bold`}>
              {getAvatarInitial(displayName, displayEmail)}
            </div>
            {/* ⚠ SOUS L'IDENTITE, LE TITRE EST « Profil », PAS LE NOM DE LA
                BOUTIQUE. L'ecran faisait de `displayName` son <h1> : le titre de
                la page changeait donc d'une boutique a l'autre, et l'ecran
                n'avait plus de nom — ni dans l'onglet du navigateur, ni pour qui
                navigue au clavier de titre en titre. La maquette ecrit
                « Profil », et le nom de la boutique en sous-titre.

                ⚠ LA BALISE RESTE UN <h1>, et son texte seul change : deplacer
                le niveau toucherait l'arbre d'accessibilite d'un ecran que
                TAOFIC ouvre aussi. */}
            <div>
              <h1 data-titre-ecran className="text-2xl sm:text-3xl font-bold text-gray-800 break-words">
                {IS_REGISTRE ? 'Profil' : displayName}
              </h1>
              {IS_REGISTRE ? (
                <p data-ecran-compte>{displayName}</p>
              ) : (
                <p className="text-gray-600">{displayEmail}</p>
              )}
              {!IS_REGISTRE && (
                <>
                  <p className="text-sm text-gray-500">
                    Boutique: {activeStore?.name || userProfile?.storeName || 'Non rattachée'}
                  </p>
                  <p className="text-sm text-gray-500">
                    Rôle: {getRoleLabel(userProfile?.role)}
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              data-rang="second"
              onClick={() => setShowChangePassword(true)}
              className={AUTH_STYLES.button.primary}
            >
              {AUTH_LABELS.CHANGE_PASSWORD}
            </button>
            <button
              data-rang="danger"
              onClick={() => setShowLogoutConfirm(true)}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-md transition-colors"
            >
              {AUTH_LABELS.SIGN_OUT}
            </button>
          </div>
        </div>
      </div>

      {/* INFORMATIONS DE LA BOUTIQUE.
          ────────────────────────────────────────────────────────────────────
          ⚠ UNE VALEUR EN LECTURE N'EST PAS UN CHAMP, ET LE CADRE GRIS MENTAIT.
          Chaque ligne etait un `<label>` suivi d'un `<div class="p-3 bg-gray-50
          rounded-md border">` — c'est-a-dire le dessin exact d'un champ de
          saisie desactive. Il promet une modification qui n'existe pas : rien
          ici ne se modifie depuis cet ecran.

          La maquette pose un libelle gras (`.faux-label`) et la valeur dessous,
          sans cadre. C'est ce que `data-faux-label` rend.

          ⚠ `<span>` ET PLUS `<label>`. Un `<label>` qui ne designe aucun
          controle est du balisage faux : les lecteurs d'ecran l'annoncent comme
          l'etiquette d'un champ, et il n'y en a pas. Le changement vaut pour les
          deux identites — c'est une correction, pas un parti pris. */}
      <div data-surface className="bg-white rounded-lg shadow-md p-6">
        <h2 data-bloc-titre className={`text-xl font-bold ${themeClasses.text} mb-6`}>
          {IS_REGISTRE ? 'Informations de la boutique' : 'Informations du compte'}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ChampLecture libelle="Nom de la boutique" valeur={displayName} fort />

          <ChampLecture libelle="Adresse électronique" valeur={displayEmail}>
            {/* L'etat de verification passe SOUS l'adresse, en note de champ :
                il qualifie cette adresse-la, il n'est pas une information a
                part. C'est ce que la maquette ecrit, et cela retire une ligne
                du tableau sans rien perdre. */}
            {IS_REGISTRE && (
              <p data-champ-regle className={isEmailVerified ? 'text-green-700 font-semibold' : 'text-yellow-700 font-semibold'}>
                {isEmailVerified ? 'Adresse vérifiée' : 'Adresse non vérifiée'}
              </p>
            )}
          </ChampLecture>

          {/* Hors identite, l'etat du compte garde sa propre ligne et son badge. */}
          {!IS_REGISTRE && (
            <div>
              <span className="block text-sm font-medium text-gray-700 mb-2">
                Statut du compte
              </span>
              <div className="p-3 bg-gray-50 rounded-md border">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  isEmailVerified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {isEmailVerified ? 'Email vérifié' : 'Email non vérifié'}
                </span>
              </div>
            </div>
          )}

          {IS_REGISTRE && (
            <ChampLecture libelle="Rôle" valeur={getRoleLabel(userProfile?.role)} />
          )}

          {/* LES RESEAUX SERVIS — la maquette les met ici, avec leur pastille.
              La liste vient du PROFIL : six chez ESAHAF, un chez TAOFIC. Aucun
              `if` de client, et un futur client a trois reseaux en montrera
              trois. */}
          {IS_REGISTRE && (
            <ChampLecture libelle="Réseaux servis">
              <p className="m-0 flex flex-wrap gap-x-4 gap-y-1">
                {NETWORK_OPTIONS.map((reseau) => (
                  <CelluleReseau key={reseau} reseau={reseau} />
                ))}
              </p>
            </ChampLecture>
          )}

          <ChampLecture libelle="Date de création" valeur={formatDate(creationTime)} nombre />
          <ChampLecture libelle="Dernière connexion" valeur={formatDate(lastSignInTime)} nombre />
        </div>
      </div>

      {/* Statistiques rapides */}
      <div data-surface className="bg-white rounded-lg shadow-md p-6">
        <h2 data-bloc-titre className={`text-xl font-bold ${themeClasses.text} mb-6`}>
          Activité
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div data-tuile className={`${themeClasses.tableHeader} p-4 rounded-lg`}>
            <div className="text-center">
              <div className={`text-2xl font-bold ${themeClasses.text}`}>
                {userActivity.monthlyLogins}
              </div>
              <div className="text-sm text-gray-600">Connexions ce mois</div>
            </div>
          </div>

          <div data-tuile className={`${themeClasses.tableHeader} p-4 rounded-lg`}>
            <div className="text-center">
              <div className={`text-2xl font-bold ${themeClasses.text}`}>
                {userActivity.daysSinceRegistration}
              </div>
              <div className="text-sm text-gray-600">Jours depuis l'inscription</div>
            </div>
          </div>

          <div data-tuile className={`${themeClasses.tableHeader} p-4 rounded-lg`}>
            <div className="text-center">
              <div className={`text-2xl font-bold ${themeClasses.text}`}>
                {userActivity.accountStatus}
              </div>
              <div className="text-sm text-gray-600">Statut du compte</div>
            </div>
          </div>
        </div>

        {/* Statistiques supplémentaires */}
        {userActivity.totalTransactions > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div data-tuile className={`${themeClasses.tableAccent} p-4 rounded-lg`}>
                <div className="text-center">
                  <div className={`text-xl font-bold ${themeClasses.text}`}>
                    {userActivity.totalTransactions}
                  </div>
                  <div className="text-sm text-gray-600">Transactions effectuées</div>
                </div>
              </div>

              <div data-tuile className={`${themeClasses.tableAccent} p-4 rounded-lg`}>
                <div className="text-center">
                  <div className={`text-xl font-bold ${themeClasses.text}`}>
                    {userActivity.hasTransactions ? 'Oui' : 'Non'}
                  </div>
                  <div className="text-sm text-gray-600">Activité récente</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de confirmation de déconnexion */}
      {showLogoutConfirm && (
        <div className={AUTH_STYLES.modal.overlay}>
          <div className={AUTH_STYLES.modal.container}>
            <h3 className={AUTH_STYLES.modal.title}>
              {AUTH_LABELS.CONFIRM_LOGOUT}
            </h3>
            <p className={`${AUTH_STYLES.text.body} ${AUTH_STYLES.spacing.modal}`}>
              Êtes-vous sûr de vouloir vous déconnecter ? Vous devrez vous reconnecter pour accéder à l'application.
            </p>
            <div className={AUTH_STYLES.modal.footer}>
              <button
                data-rang="second"
                onClick={() => setShowLogoutConfirm(false)}
                className={`flex-1 ${AUTH_STYLES.button.tertiary}`}
              >
                {AUTH_LABELS.CANCEL}
              </button>
              <button
                data-rang="danger"
                onClick={handleLogout}
                disabled={loading}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-md transition-colors disabled:opacity-50"
              >
                {loading ? AUTH_LABELS.LOADING_LOGOUT : AUTH_LABELS.SIGN_OUT}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de changement de mot de passe */}
      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
    </div>
  )
}

export default Profil
