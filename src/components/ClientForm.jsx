import { useState, useEffect, useId } from 'react'
import { useToast } from '../hooks/useToast'
import { getStorageKey } from '../config/clientIsolation'
import { NETWORK_OPTIONS } from '../utils/constants'
import Toast from './Toast'

// Réseaux du client actif (profil) → clés minuscules. Ex. salawu : orange…wave ; TAOFIC : orange.
const NETWORK_KEYS = NETWORK_OPTIONS.map((n) => n.toLowerCase())

// Modèle vide : champs de base + un « Code agent » plat par réseau (client[réseau], pilote les
// transactions — inchangé) + un map « numerosAgent » par réseau (Numéro agent, nouveau).
const EMPTY_CLIENT_FORM = {
  nom: '',
  prenom: '',
  numeroIdentite: '',
  numeroPersonnel: '',
  ...Object.fromEntries(NETWORK_KEYS.map((k) => [k, ''])),
  numerosAgent: Object.fromEntries(NETWORK_KEYS.map((k) => [k, ''])),
  localite: '',
  agentCommercial: ''
}

// Le brouillon appartient à UNE boutique. Sans suffixe, la saisie inachevée d'une
// boutique se retrouvait pré-remplie chez la suivante ouverte sur le même poste,
// qui pouvait l'enregistrer sous sa propre identité.
const CLIENT_FORM_DRAFT_PREFIX = getStorageKey('client_form_draft')

const draftKeyForStore = (storeId) =>
  storeId ? `${CLIENT_FORM_DRAFT_PREFIX}_${storeId}` : null

const readClientFormDraft = (storeId) => {
  const key = draftKeyForStore(storeId)
  if (!key || typeof window === 'undefined') return EMPTY_CLIENT_FORM

  try {
    const draft = window.localStorage.getItem(key)
    if (!draft) return EMPTY_CLIENT_FORM
    const parsed = JSON.parse(draft)
    return {
      ...EMPTY_CLIENT_FORM,
      ...parsed,
      numerosAgent: { ...EMPTY_CLIENT_FORM.numerosAgent, ...(parsed.numerosAgent || {}) }
    }
  } catch {
    return EMPTY_CLIENT_FORM
  }
}

// Vrai si au moins une valeur (y compris dans le map numerosAgent) est non vide.
const hasFormDraft = (data) => {
  const values = Object.values(data).flatMap((v) =>
    v && typeof v === 'object' ? Object.values(v) : [v]
  )
  return values.some((value) => String(value || '').trim())
}

// `draftScopeId` : boutique propriétaire du brouillon. Absent ⇒ la sauvegarde de
// brouillon est désactivée. C'est le sens de défaillance voulu : perdre une aide
// de saisie, jamais exposer la saisie d'une boutique à une autre.
function ClientForm({ onSubmit, initialData = null, title = 'Ajouter un client', draftScopeId = null }) {
  // `useId` : ces formulaires peuvent apparaitre plusieurs fois sur une page.
  // Des identifiants fixes rattacheraient toutes les etiquettes au PREMIER
  // champ — invisible a l'oeil, faux pour un lecteur d'ecran.
  const idChamps = useId()

  const { toasts, showToast, removeToast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState(() => initialData ? EMPTY_CLIENT_FORM : readClientFormDraft(draftScopeId))

  // Charger les données initiales si on modifie
  useEffect(() => {
    if (initialData) {
      setFormData({
        ...EMPTY_CLIENT_FORM,
        nom: initialData.nom || '',
        prenom: initialData.prenom || '',
        numeroIdentite: initialData.numeroIdentite || '',
        numeroPersonnel: initialData.numeroPersonnel || '',
        localite: initialData.localite || '',
        agentCommercial: initialData.agentCommercial || '',
        // Code agent par réseau (clés plates existantes)
        ...Object.fromEntries(NETWORK_KEYS.map((k) => [k, initialData[k] || ''])),
        // Numéro agent par réseau (map)
        numerosAgent: {
          ...EMPTY_CLIENT_FORM.numerosAgent,
          ...(initialData.numerosAgent || {})
        }
      })
    }
  }, [initialData])

  useEffect(() => {
    const key = draftKeyForStore(draftScopeId)
    if (initialData || !key || typeof window === 'undefined') return

    try {
      if (hasFormDraft(formData)) {
        window.localStorage.setItem(key, JSON.stringify(formData))
      } else {
        window.localStorage.removeItem(key)
      }
    } catch {
      // Le brouillon est une aide UX; l'enregistrement principal reste prioritaire.
    }
  }, [formData, initialData, draftScopeId])

  // Purge du brouillon partagé par toutes les boutiques (avant cloisonnement).
  useEffect(() => {
    try {
      window.localStorage.removeItem(CLIENT_FORM_DRAFT_PREFIX)
    } catch {
      // Stockage indisponible : rien à purger.
    }
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    // Champ imbriqué « numerosAgent.<reseau> » vs champ plat.
    if (name.startsWith('numerosAgent.')) {
      const key = name.slice('numerosAgent.'.length)
      setFormData(prev => ({
        ...prev,
        numerosAgent: { ...prev.numerosAgent, [key]: value }
      }))
      return
    }
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validation alignée sur validClient() de firestore.rules (nom/prenom : 2-50 caractères)
    if (!formData.nom || !formData.prenom) {
      showToast('Le nom et le prénom sont obligatoires', 'error')
      return
    }
    if (formData.nom.length < 2) {
      showToast('Le nom doit comporter au moins 2 caractères', 'error')
      return
    }
    if (formData.nom.length > 50) {
      showToast('Le nom ne peut pas dépasser 50 caractères', 'error')
      return
    }
    if (formData.prenom.length < 2) {
      showToast('Le prénom doit comporter au moins 2 caractères', 'error')
      return
    }
    if (formData.prenom.length > 50) {
      showToast('Le prénom ne peut pas dépasser 50 caractères', 'error')
      return
    }

    try {
      setIsSubmitting(true)
      await onSubmit(formData)
      showToast(initialData ? 'Client modifié avec succès' : 'Client enregistré avec succès', 'success')

      // Reset du formulaire seulement si on n'est pas en mode modification
      if (!initialData) {
        const key = draftKeyForStore(draftScopeId)
        if (key) window.localStorage.removeItem(key)
        setFormData(EMPTY_CLIENT_FORM)
      }
    } catch (error) {
      console.error('Erreur formulaire client:', error)
      showToast(error.message || 'Impossible d’enregistrer le client', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputClasses = "w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-green-500"

  return (
    <div data-surface className="bg-white rounded-lg shadow-md p-6 w-full">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b-2 border-green-500 pb-2">
        {title}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor={`${idChamps}-nom`} className="block text-sm font-medium text-gray-700 mb-1">
            Nom
          </label>
          <input
            id={`${idChamps}-nom`}
            type="text"
            name="nom"
            value={formData.nom}
            onChange={handleChange}
            className={inputClasses}
            required
          />
        </div>

        <div>
          <label htmlFor={`${idChamps}-pr-nom`} className="block text-sm font-medium text-gray-700 mb-1">
            Prénom
          </label>
          <input
            id={`${idChamps}-pr-nom`}
            type="text"
            name="prenom"
            value={formData.prenom}
            onChange={handleChange}
            className={inputClasses}
            required
          />
        </div>

        <div>
          <label htmlFor={`${idChamps}-num-ro-d-identit`} className="block text-sm font-medium text-gray-700 mb-1">
            Numéro d'identité
          </label>
          <input
            id={`${idChamps}-num-ro-d-identit`}
            type="text"
            name="numeroIdentite"
            value={formData.numeroIdentite}
            onChange={handleChange}
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor={`${idChamps}-num-ro-personnel`} className="block text-sm font-medium text-gray-700 mb-1">
            Numéro personnel
          </label>
          <input
            id={`${idChamps}-num-ro-personnel`}
            type="text"
            name="numeroPersonnel"
            value={formData.numeroPersonnel}
            onChange={handleChange}
            className={inputClasses}
          />
        </div>

        {/* Codes agent par réseau : Numéro agent + Code agent (2 champs dédiés par réseau) */}
        <div className="pt-1">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">
            Comptes agent par réseau
          </h3>
          <div className="space-y-3">
            {NETWORK_OPTIONS.map((network) => {
              const key = network.toLowerCase()
              return (
                <fieldset key={key} className="rounded-lg border border-gray-200 p-3">
                  <legend className="px-1 text-sm font-semibold text-gray-700">
                    {network}
                  </legend>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor={`${idChamps}-num-ro-agent`} className="block text-xs font-medium text-gray-600 mb-1">
                        Numéro agent
                      </label>
                      <input
            id={`${idChamps}-num-ro-agent`}
                        type="text"
                        inputMode="numeric"
                        name={`numerosAgent.${key}`}
                        value={formData.numerosAgent?.[key] ?? ''}
                        onChange={handleChange}
                        className={inputClasses}
                      />
                    </div>
                    <div>
                      <label htmlFor={`${idChamps}-code-agent`} className="block text-xs font-medium text-gray-600 mb-1">
                        Code agent
                      </label>
                      <input
            id={`${idChamps}-code-agent`}
                        type="text"
                        inputMode="numeric"
                        name={key}
                        value={formData[key] ?? ''}
                        onChange={handleChange}
                        className={inputClasses}
                      />
                    </div>
                  </div>
                </fieldset>
              )
            })}
          </div>
        </div>

        <div>
          <label htmlFor={`${idChamps}-localit`} className="block text-sm font-medium text-gray-700 mb-1">
            Localité
          </label>
          <input
            id={`${idChamps}-localit`}
            type="text"
            name="localite"
            value={formData.localite}
            onChange={handleChange}
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor={`${idChamps}-nom-de-l-agent-commercia`} className="block text-sm font-medium text-gray-700 mb-1">
            Nom de l'agent commercial
          </label>
          <input
            id={`${idChamps}-nom-de-l-agent-commercia`}
            type="text"
            name="agentCommercial"
            value={formData.agentCommercial}
            onChange={handleChange}
            className={inputClasses}
          />
        </div>

        <button
          data-rang="primaire"
          type="submit"
          disabled={isSubmitting}
          className="bg-green-700 hover:bg-green-700 disabled:bg-green-300 text-white font-medium py-2 px-6 rounded mt-6"
        >
          {isSubmitting ? 'Enregistrement...' : initialData ? 'Modifier' : 'Enregistrer'}
        </button>
      </form>

      {/* Toasts */}
      <div className="fixed top-0 right-0 z-50 space-y-2 p-4">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </div>
  )
}

export default ClientForm
