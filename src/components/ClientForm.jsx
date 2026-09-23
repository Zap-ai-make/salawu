import { useState, useEffect, useId } from 'react'
import { useToast } from '../hooks/useToast'
import { getStorageKey } from '../config/clientIsolation'
import { NETWORK_OPTIONS } from '../utils/constants'
import { NETWORK_CONFIG } from '../constants/networkConfig'
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

/**
 * Les deux rangees de champs d'identite.
 *
 * En modale : une grille de deux colonnes, comme la maquette. `sm:` et non
 * `md:` — sous 640px la colonne unique est le bon dessin, et c'est le point de
 * rupture que les blocs reseau emploient deja.
 *
 * ⚠ L'ORDRE DU DOM RESTE CELUI DE LA SAISIE — Nom, Prenom, Numero d'identite,
 * Numero personnel. La maquette, elle, empile par COLONNE (Nom puis Numero
 * d'identite a gauche), ce qui donnerait au clavier un parcours Nom → Numero
 * d'identite → Prenom. Une grille rend le meme dessin a l'oeil en gardant
 * l'ordre de tabulation d'aujourd'hui.
 *
 * Hors modale : AUCUN ELEMENT. Le fragment laisse les champs enfants directs du
 * `<form class="space-y-4">`, c'est-a-dire exactement la pile d'avant.
 *
 * ⚠ DECLARE ICI, AU NIVEAU DU MODULE, ET JAMAIS DANS LE CORPS DE `ClientForm`.
 * Ce composant y a vecu, et c'etait un defaut grave : une fonction declaree
 * dans un rendu a une identite NEUVE a chaque rendu. React la prend pour un
 * autre type, demonte tout son sous-arbre et le remonte — les <input>
 * deviennent des noeuds DOM neufs, qui n'ont pas le focus. A la caisse : on
 * tape « Z », le champ est remplace, le curseur disparait, il faut recliquer
 * pour la lettre suivante.
 *
 * ⚠ ET LA SUITE DE TESTS NE POUVAIT PAS LE VOIR : `fireEvent.change` pose une
 * valeur d'un coup sur le noeud qu'il vient de chercher, sans dependre ni du
 * focus ni de la survie du noeud. La valeur etait juste, le formulaire
 * inutilisable. TC-168 compare desormais les IDENTITES DE NOEUD avant et apres
 * une frappe — c'est le seul angle sous lequel ce defaut est visible.
 */
function Duo({ enModale, children }) {
  if (!enModale) return <>{children}</>
  return (
    <div data-duo className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
      {children}
    </div>
  )
}

// `draftScopeId` : boutique propriétaire du brouillon. Absent ⇒ la sauvegarde de
// brouillon est désactivée. C'est le sens de défaillance voulu : perdre une aide
// de saisie, jamais exposer la saisie d'une boutique à une autre.
/**
 * `enModale` — QUI APPELLE, ET DONC QUEL DESSIN.
 * ─────────────────────────────────────────────────────────────────────────────
 * `false` (defaut) : le formulaire EST un ecran. Il rend sa carte, son titre et
 * sa pile de champs sur une colonne — le dessin de TAOFIC, qui est en
 * production et n'a rien demande. Inchange a l'octet pres.
 *
 * `true` : le formulaire est le CORPS d'une modale (`ClientFormModal`). La
 * carte, le titre et la largeur viennent du contenant ; le corps prend la
 * maquette ESAHAF — deux colonnes, l'etoile des champs obligatoires, la pastille
 * de chaque reseau, un pied de modale.
 *
 * ⚠ UNE PROPRIETE, ET NON UNE LECTURE DE `IS_REGISTRE` ICI. Ce composant ne doit
 * pas savoir quel client l'emploie : il doit savoir dans quoi il est pose. C'est
 * l'appelant qui tranche — `pages/Formulaire.jsx` d'un cote, `ClientFormModal`
 * de l'autre — et c'est `src/App.jsx` et `pages/Clients.jsx` qui lisent le
 * drapeau, une fois chacun.
 */
function ClientForm({
  onSubmit,
  initialData = null,
  title = 'Ajouter un client',
  onCancel = null,
  enModale = false,
  draftScopeId = null,
}) {
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
  const labelClasses = "block text-sm font-medium text-gray-700 mb-1"

  /**
   * L'etoile d'un champ obligatoire, telle que la maquette la pose.
   *
   * ⚠ `aria-hidden`, ET CE N'EST PAS UN OUBLI. `required` est deja porte par le
   * champ, et un lecteur d'ecran l'annonce. Sans cette exclusion il dirait
   * « Nom etoile, obligatoire » — l'etoile deux fois, dont une en tant que
   * ponctuation. Elle est la pour l'oeil, qui n'a pas `required`.
   *
   * La mention qui la traduit (« Les champs marques d'une etoile… ») est posee
   * par le contenant, au-dessus du formulaire : une convention typographique
   * s'explique une fois, avant d'etre employee.
   */
  const etoile = enModale ? <span data-requis aria-hidden="true"> *</span> : null

  /**
   * ⚠ SOUS L'IDENTITE, CE COMPOSANT N'EST PLUS UN ECRAN : C'EST LE CORPS D'UNE
   * MODALE.
   * ───────────────────────────────────────────────────────────────────────────
   * Il rendait sa propre carte (`data-surface`), son propre titre d'ecran
   * (`data-titre-ecran`) et sa propre colonne de lecture (`data-colonne-lecture`,
   * lot L9.19) parce qu'il ETAIT la page `/formulaire`. Cette page n'existe plus :
   * l'ajout et la modification passent par `ClientFormModal`, qui apporte la
   * boite, le titre et la largeur.
   *
   * Les garder aurait donne une carte blanche ombree DANS une carte blanche
   * ombree, et deux titres pour un seul formulaire.
   *
   * Ce qui ne change pas : les champs, leur ordre, leurs noms, et ce qui est
   * remonte au parent. TC-168 le garde.
   */
  const corps = (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* LES QUATRE CHAMPS D'IDENTITE, SUR DEUX COLONNES.
            La maquette les range en deux colonnes de deux : un nom et un prenom
            se lisent cote a cote, pas l'un sous l'autre.

            ⚠ L'ORDRE DU DOM RESTE CELUI DE LA SAISIE — Nom, Prenom, Numero
            d'identite, Numero personnel. La maquette, elle, empile par COLONNE
            (Nom puis Numero d'identite a gauche), ce qui donnerait au clavier un
            parcours Nom → Numero d'identite → Prenom. Une grille rend le meme
            dessin a l'oeil en gardant l'ordre de tabulation d'aujourd'hui.

            `sm:` et non `md:` : sous 640px la colonne unique est le bon dessin,
            et c'est le point de rupture que les blocs reseau emploient deja. */}
        <Duo enModale={enModale}>
          <div>
            <label htmlFor={`${idChamps}-nom`} className={labelClasses}>
              Nom{etoile}
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
            <label htmlFor={`${idChamps}-pr-nom`} className={labelClasses}>
              Prénom{etoile}
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
            <label htmlFor={`${idChamps}-num-ro-d-identit`} className={labelClasses}>
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
            <label htmlFor={`${idChamps}-num-ro-personnel`} className={labelClasses}>
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
        </Duo>

        {/* Codes agent par réseau : Numéro agent + Code agent (2 champs dédiés par réseau) */}
        <div className="pt-1">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">
            Comptes agent par réseau
          </h3>
          {/* ⟲ LA GRILLE EST RETIREE (2026-09-23), SUR DEMANDE DU CLIENT.
              Le lot L9.8 avait mis les six blocs reseau en grille
              `repeat(auto-fill, minmax(232px, 1fr))`, au motif qu'empiles ils
              occupent un ecran entier pour douze champs.

              Le client a demande la disposition d'avant pour ces champs-la, et
              seulement ceux-la. Ce n'etait pas un defaut a corriger : c'etait MA
              decision de dessin, et elle est renversee. La question a ete reposee
              le 2026-09-23, avec le passage en modale sous les yeux, et la
              reponse n'a pas change : les blocs restent empiles.

              `space-y-3` : la pile d'origine, inchangee depuis. */}
          <div className="space-y-3">
            {NETWORK_OPTIONS.map((network) => {
              const key = network.toLowerCase()
              return (
                <fieldset key={key} className="rounded-lg border border-gray-200 p-3">
                  {/* ⚠ LA PASTILLE NE DIT RIEN QUE LA LEGENDE NE DISE DEJA, d'ou
                      `aria-hidden`. Sa couleur vient de NETWORK_CONFIG : les
                      couleurs des operateurs sont des DONNEES, pas des jetons de
                      l'identite — elles ne nous appartiennent pas. C'est la meme
                      carte que lisent l'anneau du tableau de bord et la bande des
                      reserves, et `data-pastille` lui rend le meme anneau d'encre
                      (le jaune Coris et le cyan Wave disparaissent sur du
                      papier). */}
                  <legend className={
                    enModale
                      ? 'px-1 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700'
                      : 'px-1 text-sm font-semibold text-gray-700'
                  }>
                    {enModale && (
                      <span
                        data-pastille
                        aria-hidden="true"
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: NETWORK_CONFIG[network]?.color || '#5b6470' }}
                      />
                    )}
                    {network}
                  </legend>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      {/* ⚠ LA CLE DU RESEAU FAIT PARTIE DE L'IDENTIFIANT.
                          Sans elle, les six blocs construisaient le MEME `id` :
                          douze champs pour deux identifiants. Un `htmlFor`
                          pointe vers le PREMIER element qui porte l'identifiant,
                          donc toucher « Numero agent » sous Wave posait le
                          curseur dans le champ d'Orange.

                          ⚠ LE BANC ETAIT VERT DESSUS, AUX TROIS LARGEURS. Il
                          scanne wcag2a a wcag22aa sans regle desactivee, mais
                          axe-core a retire ses regles `duplicate-id`, et `label`
                          ne verifie que l'EXISTENCE d'une association, pas son
                          unicite. */}
                      <label htmlFor={`${idChamps}-${key}-numero-agent`} className="block text-xs font-medium text-gray-600 mb-1">
                        Numéro agent
                      </label>
                      <input
                        id={`${idChamps}-${key}-numero-agent`}
                        type="text"
                        inputMode="numeric"
                        name={`numerosAgent.${key}`}
                        value={formData.numerosAgent?.[key] ?? ''}
                        onChange={handleChange}
                        className={inputClasses}
                      />
                    </div>
                    <div>
                      <label htmlFor={`${idChamps}-${key}-code-agent`} className="block text-xs font-medium text-gray-600 mb-1">
                        Code agent
                      </label>
                      <input
                        id={`${idChamps}-${key}-code-agent`}
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

        <Duo enModale={enModale}>
          <div>
            <label htmlFor={`${idChamps}-localit`} className={labelClasses}>
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
            <label htmlFor={`${idChamps}-nom-de-l-agent-commercia`} className={labelClasses}>
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
        </Duo>

        {/* La note de la maquette. Elle dit ce que l'enregistrement PRODUIT —
            aucun libelle de bouton ne peut le dire. Seulement a la creation : une
            modification ne fait entrer personne dans la liste. */}
        {enModale && !initialData && (
          <p data-champ-regle className="text-xs text-gray-500">
            Le client enregistré est ajouté à la liste et devient sélectionnable
            dans le formulaire de transaction.
          </p>
        )}

        {/* LE PIED DE LA MODALE.
            `data-modale-pied` est le marqueur du lot L9.10 : le filet et la
            gouttiere viennent de src/index.css, comme pour les neuf autres
            modales. Aucune apparence n'est inventee ici.

            ⚠ LE PIED EST DANS LE `<form>`, et c'est ce qui fait marcher la touche
            Entree : un `type="submit"` pose hors du formulaire ne le soumet pas. */}
        {enModale ? (
          <div data-modale-pied className="flex flex-wrap justify-end gap-3">
            {onCancel && (
              <button type="button" data-rang="second" onClick={onCancel}>
                Annuler
              </button>
            )}
            <button
              data-rang="primaire"
              type="submit"
              disabled={isSubmitting}
              className="bg-green-700 hover:bg-green-700 disabled:bg-green-300 text-white font-medium py-2 px-6 rounded"
            >
              {isSubmitting ? 'Enregistrement...' : initialData ? 'Modifier' : 'Enregistrer'}
            </button>
          </div>
        ) : (
          <button
            data-rang="primaire"
            type="submit"
            disabled={isSubmitting}
            className="bg-green-700 hover:bg-green-700 disabled:bg-green-300 text-white font-medium py-2 px-6 rounded mt-6"
          >
            {isSubmitting ? 'Enregistrement...' : initialData ? 'Modifier' : 'Enregistrer'}
          </button>
        )}
      </form>

      {/* Toasts — les refus de validation (« le nom doit comporter au moins
          2 caracteres ») et les echecs d'enregistrement, qui laissent tous deux
          la modale ouverte. Le message de SUCCES, lui, est remonte par la page :
          la modale se ferme, et un toast monte dans un composant demonte ne
          s'affiche jamais. */}
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
    </>
  )

  if (enModale) return corps

  /* ⚠ LE DESSIN D'AVANT, RENDU INTACT. `data-surface` (la carte),
     `data-titre-ecran` (le marqueur qui met le soulignement vert sous la portee
     CSS, lot L9.1) et `data-colonne-lecture` (lot L9.19) : c'est l'ecran
     `/formulaire`, celui que TAOFIC ouvre depuis sa navigation.

     La balise reste un `h2` : changer son niveau changerait l'arbre
     d'accessibilite d'un client en production. */
  return (
    <div data-surface data-colonne-lecture className="bg-white rounded-lg shadow-md p-6 w-full">
      <h2 data-titre-ecran className="text-2xl font-bold text-gray-800 mb-6 border-b-2 border-green-500 pb-2">
        {title}
      </h2>
      {corps}
    </div>
  )
}

export default ClientForm
