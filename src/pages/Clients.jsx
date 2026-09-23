import { useState } from 'react'
import { useClients } from '../hooks/useClients'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../hooks/useToast'
import { IS_REGISTRE } from '../constants/designSystem.js'
import ClientsTable from '../components/ClientsTable'
import ClientForm from '../components/ClientForm'
import ClientFormModal from '../components/ClientFormModal'
import AgentAccessCodeModal from '../components/agents/AgentAccessCodeModal'
import Toast from '../components/Toast'
import { activeProfile } from '../config/activeClientProfile'
import { getClientName } from '../utils/helpers'
import { ArrowLeft } from 'lucide-react'

// App mobile agents activée pour ce client (profil) → affiche l'action « code d'accès ».
const MOBILE_APP_ENABLED = activeProfile?.mobileApp?.enabled === true

function Clients() {
  const { clients, deleteClient, editClient, addClient } = useClients()
  const { userProfile, activeStore } = useAuth()
  const { toasts, showToast, removeToast } = useToast()
  const [accessCodeClient, setAccessCodeClient] = useState(null)

  /**
   * LA SAISIE D'UN CLIENT, EN UN SEUL ETAT.
   * ───────────────────────────────────────────────────────────────────────────
   * `null` : rien n'est ouvert. Sinon `{ client }` — `null` pour un ajout, la
   * fiche pour une modification.
   *
   * ⚠ UN SEUL ETAT, ET NON UN BOOLEEN « ouverte » PLUS UN « client en cours ».
   * Deux etats pour une seule question permettent l'etat impossible : ouverte
   * sans client alors qu'on modifie, ou un client reste en memoire apres la
   * fermeture et revient pre-remplir l'ajout suivant.
   *
   * Sous l'identite, la modale est MONTEE avec son ouverture et DEMONTEE avec sa
   * fermeture — c'est ce qui remet `ClientForm` a zero sans avoir a le lui
   * demander, et l'idiome que `useDialog` suppose.
   */
  const [saisie, setSaisie] = useState(null)

  const ouvrirLAjout = () => setSaisie({ client: null })
  const ouvrirLaModification = (client) => setSaisie({ client })
  const fermerLaSaisie = () => setSaisie(null)

  /**
   * Le brouillon n'est conservé que sous l'identité de la boutique connectée, et
   * seulement une fois son contexte résolu (même garde que les soldes réseau).
   * Repris de `pages/Formulaire.jsx`, qui garde le sien pour l'écran pleine page.
   *
   * ⚠ IL NE VAUT QUE POUR L'AJOUT. Le passer a une modification ferait ecrire la
   * fiche d'un client existant par-dessus le brouillon d'un autre.
   */
  const draftScopeId =
    userProfile?.storeId && activeStore?.id === userProfile.storeId
      ? userProfile.storeId
      : null

  const handleDelete = (clientId) => {
    const client = clients.find(c => c.id === clientId)
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer définitivement le client ${client?.nom} ${client?.prenom} ?`)) {
      deleteClient(clientId)
    }
  }

  /**
   * ⚠ AUCUN `try/catch` ICI, ET C'EST LE POINT DELICAT.
   *
   * Si l'ecriture echoue, la promesse doit REMONTER a `ClientForm` : c'est lui
   * qui affiche le refus et qui garde la saisie a l'ecran. L'avaler fermerait la
   * modale sur un enregistrement qui n'a pas eu lieu, en silence — dix champs
   * perdus et un client qu'on croit enregistre.
   *
   * La fermeture n'arrive donc qu'a la ligne suivante, c'est-a-dire seulement si
   * l'ecriture a abouti.
   */
  const enregistrerLAjout = async (nouveauClient) => {
    await addClient(nouveauClient)
    fermerLaSaisie()
    showToast('Client enregistré avec succès', 'success')
  }

  const enregistrerLaModification = async (donneesModifiees) => {
    await editClient(saisie.client.id, donneesModifiees)
    fermerLaSaisie()
    showToast('Client modifié avec succès', 'success')
  }

  const handleImportClients = async (importedClients) => {
    // Ajouter chaque client importé sans l'ID généré automatiquement
    const results = await Promise.allSettled(importedClients.map(clientData => {
      const { id: _id, ...clientWithoutId } = clientData
      return addClient(clientWithoutId)
    }))

    const failedCount = results.filter(result => result.status === 'rejected').length
    if (failedCount > 0) {
      throw new Error(`${failedCount} client(s) non importé(s)`)
    }
  }

  const enModification = Boolean(saisie?.client)

  /**
   * ⚠ LE CHEMIN D'AVANT, RENDU INTACT. Hors de l'identite « registre », modifier
   * un client REMPLACE la liste par le formulaire pleine page, avec « Retour a la
   * liste ». C'est ce que TAOFIC a en production, et ce qu'il garde : il n'a rien
   * demande, et une facon de saisir qui change du jour au lendemain n'est pas un
   * detail d'apparence.
   *
   * Sous l'identite, ce meme geste ouvre la modale — la liste reste derriere,
   * avec son defilement et ses filtres.
   */
  if (!IS_REGISTRE && enModification) {
    return (
      <div>
        <div className="mb-4">
          <button
            onClick={fermerLaSaisie}
            className="inline-flex items-center gap-1.5 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Retour à la liste
          </button>
        </div>
        <ClientForm
          onSubmit={enregistrerLaModification}
          initialData={saisie.client}
          title="Modifier le client"
        />
      </div>
    )
  }

  return (
    <>
      <ClientsTable
        clients={clients}
        onDelete={handleDelete}
        onEdit={ouvrirLaModification}
        onAdd={IS_REGISTRE ? ouvrirLAjout : undefined}
        onImportClients={handleImportClients}
        onAccessCode={MOBILE_APP_ENABLED ? setAccessCodeClient : undefined}
      />

      {/* LA MODALE DE SAISIE — ajout ET modification, un seul dessin pour deux
          usages : le titre, le libelle du bouton et la note suivent `initialData`. */}
      {IS_REGISTRE && saisie && (
        <ClientFormModal
          onSubmit={enModification ? enregistrerLaModification : enregistrerLAjout}
          onClose={fermerLaSaisie}
          initialData={saisie.client}
          draftScopeId={enModification ? null : draftScopeId}
        />
      )}

      {accessCodeClient && (
        <AgentAccessCodeModal
          clientId={accessCodeClient.id}
          clientName={getClientName(accessCodeClient)}
          onClose={() => setAccessCodeClient(null)}
        />
      )}

      {/* ⚠ LE MESSAGE DE SUCCES EST REMONTE ICI, ET PAS LAISSE AU FORMULAIRE.
          `ClientForm` affiche le sien apres l'attente du parent — mais le parent
          vient de fermer la modale, donc le formulaire est demonte et son toast
          ne s'affiche jamais. */}
      <div className="fixed top-0 right-0 z-[9999] space-y-2 p-4">
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
}

export default Clients
