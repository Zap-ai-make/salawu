import ClientForm from './ClientForm'
import useDialog from '../hooks/useDialog'

/**
 * ClientFormModal — la saisie d'un client, en modale.
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ CE N'EST PAS UN RESTYLAGE, ET C'EST DIT AVANT D'ETRE FAIT.
 *
 * L'espace boutique offrait TROIS dessins pour un seul formulaire :
 *
 *   • l'onglet « Formulaire » de la navigation, un ecran a lui seul ;
 *   • le lien « Ajouter un client » de la liste, qui menait au meme ecran ;
 *   • la modification, qui REMPLACAIT la liste par le formulaire, avec un
 *     bouton « Retour a la liste ».
 *
 * Il n'en reste qu'un : cette modale, ouverte depuis la liste. C'est la facon
 * dont la boutique enregistre ses clients qui change — pas seulement son
 * apparence. La maquette le prescrit (ecran « Ajouter un client »,
 * `docs/audit/maquette-espace-boutique.html`), le lot L9.14 a pris la meme
 * decision pour la saisie d'une transaction, et le client a tranche apres que
 * la question lui a ete posee.
 *
 * Le formulaire lui-meme n'est pas reecrit : c'est le MEME composant, champ pour
 * champ, avec les memes noms et le meme objet remonte au parent.
 *
 * CE QUE CE FICHIER APPORTE, ET RIEN DE PLUS
 *
 *   • la boite et le voile (`data-modale-voile`, `data-modale` — lot L9.6) ;
 *   • la tete et son filet (`data-modale-tete`, `data-modale-fermer` — L9.10) ;
 *   • le comportement clavier, par `useDialog` : Echap ferme, le focus est
 *     piege, et il revient au bouton qui a ouvert.
 *
 * ⚠ `useDialog`, ET NON UN `onKeyDown` MAISON. Le depot en comptait cinq copies
 * partielles avant que ce hook ne les remplace ; en ecrire une sixieme ici
 * rendrait au produit le defaut qu'il vient de retirer. La modale de transaction
 * du lot L9.14 ne l'a PAS — c'est un manque releve, pas un precedent a suivre.
 *
 * ⚠ AUCUNE FERMETURE AU CLIC SUR LE FOND. C'est un formulaire de saisie : un
 * clic a cote ne doit pas jeter dix champs remplis. Meme raison que dans
 * `CollaborationFormModal`.
 */
function ClientFormModal({ onSubmit, onClose, initialData = null, draftScopeId = null }) {
  const dialogRef = useDialog({ onClose })

  const enModification = Boolean(initialData)
  const titre = enModification ? 'Modifier le client' : 'Ajouter un client'

  return (
    <div
      data-modale-voile
      className="fixed inset-0 z-[9998] flex items-start justify-center overflow-y-auto bg-black/40 p-4"
    >
      <div
        ref={dialogRef}
        data-modale
        role="dialog"
        aria-modal="true"
        aria-labelledby="saisie-client-titre"
        className="my-8 w-full max-w-3xl rounded-lg bg-white p-6 shadow-2xl"
      >
        <div data-modale-tete data-modale-bande className="flex items-start justify-between gap-4 pb-3">
          <div>
            <h2 id="saisie-client-titre" className="text-base font-semibold text-gray-900">
              {titre}
            </h2>
            {/* La convention s'annonce AVANT d'etre subie. L'etoile des deux
                champs obligatoires ne veut rien dire pour qui la voit pour la
                premiere fois ; cette ligne est sa traduction, et elle vient de
                la maquette. Inutile en modification : les deux champs sont deja
                remplis. */}
            {!enModification && (
              <p className="mt-0.5 text-xs text-gray-500">
                Les champs marqués d'une étoile sont obligatoires
              </p>
            )}
          </div>
          <button
            type="button"
            data-modale-fermer
            onClick={onClose}
            aria-label="Fermer"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <ClientForm
          enModale
          onSubmit={onSubmit}
          onCancel={onClose}
          initialData={initialData}
          draftScopeId={draftScopeId}
        />
      </div>
    </div>
  )
}

export default ClientFormModal
