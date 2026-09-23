import { useState, useEffect } from 'react'
import useDialog from '../hooks/useDialog'
import ConventionDeSigne from '../components/ui/ConventionDeSigne.jsx'
import { useSearchParams } from 'react-router-dom'
import { useClients } from '../hooks/useClients'
import { useAuth } from '../context/AuthContext.jsx'
import { IS_MULTI_NETWORK } from '../constants/navigation'
import { subscribeIncomingCollaborationsCount } from '../services/collaborationService'
import TransactionForm from '../components/transactions/TransactionForm'
import TransactionTable from '../components/transactions/TransactionTable'
import DealerTransferForm from '../components/transactions/DealerTransferForm'
import StoreCollaborations from './store/StoreCollaborations.jsx'
import ErrorBoundary from '../components/ui/ErrorBoundary'
import { tabButtonClass, TabBadge } from '../components/ui/Tabs.jsx'
import { useTransactions } from '../context/transactions.jsx'
import { exportTransactionsToXLSM } from '../utils/excelUtils'
import { useToast } from '../hooks/useToast'
import Toast from '../components/Toast'
import { classesDuRang } from '../components/ui/rangs.js'

const MODES = ['client', 'dealer', 'collaborations']

function Transactions() {
  const { clients } = useClients()
  const { userProfile } = useAuth()
  const [incomingCollabCount, setIncomingCollabCount] = useState(0)

  // ── La saisie passe en modale (demande du client, maquette a l'appui) ─────
  //
  // ⚠ CE N'EST PAS UN RESTYLAGE, ET CELA A ETE DIT AVANT D'ETRE FAIT. Le
  // formulaire etait pose en pleine page sous les onglets ; il s'ouvre desormais
  // par « Enregistrer une transaction ». C'est la facon dont le caissier saisit
  // qui change, sur l'ecran qu'il utilise toute la journee. La maquette le
  // prescrit — « le bouton primaire ouvre le formulaire actuel en modale » — et
  // le client a tranche apres que la question lui a ete posee.
  //
  // Le formulaire lui-meme n'est pas touche : c'est le MEME composant, champ
  // pour champ. Seul son contenant change.
  const [saisieOuverte, setSaisieOuverte] = useState(false)

  // `pendingTransactions` vient du CONTEXTE, pas d'un etat de TransactionTable :
  // la page peut le lire sans qu'on remonte quoi que ce soit.
  const { pendingTransactions, editingTransaction, clearEditTransaction } = useTransactions()

  /**
   * ⚠ LA MODALE A DEUX PORTES, ET LA SECONDE AVAIT ETE MUREE.
   * ───────────────────────────────────────────────────────────────────────────
   * « Enregistrer une transaction » ouvre une saisie neuve — c'est `saisieOuverte`.
   * Mais « Modifier », sur une ligne en attente, ne passe pas par ce bouton :
   * `TransactionTable` appelle `startEditTransaction` sur le CONTEXTE, et c'est
   * tout ce qu'il fait. Les deux ne se connaissent pas autrement.
   *
   * Tant que le formulaire etait pose en pleine page, cela suffisait : il etait
   * deja monte, il lisait `editingTransaction` et se pre-remplissait. Le lot
   * L9.14 l'a mis derriere `{saisieOuverte && …}` — qui vaut `false` quand on
   * clique « Modifier ». MODIFIER UNE TRANSACTION N'OUVRAIT PLUS RIEN.
   *
   * Et le defaut ne s'arretait pas la : `editingTransaction` restait arme dans
   * le contexte. La saisie SUIVANTE s'ouvrait donc pre-remplie avec l'ancienne
   * operation, en mode modification, sans que rien ne l'annonce — on croyait
   * enregistrer une transaction neuve, on en reecrivait une autre.
   *
   * La modale est donc visible si l'une OU l'autre porte est ouverte, et la
   * fermer referme les deux.
   */
  const saisieVisible = saisieOuverte || Boolean(editingTransaction)

  /**
   * ⚠ LE COMPORTEMENT CLAVIER MANQUAIT, ET LA MODALE SE DECLARAIT POURTANT
   * `aria-modal="true"` — c'est-a-dire qu'elle annoncait aux technologies
   * d'assistance que le reste de la page est inerte. Sans piege de focus, la
   * tabulation en sortait quand meme : l'utilisateur se retrouvait a naviguer
   * dans un contenu declare inexistant, sans le voir. Echap ne fermait rien, et
   * le focus ne revenait pas au bouton d'ouverture.
   *
   * `ClientFormModal` nommait ce manque en toutes lettres (« La modale de
   * transaction du lot L9.14 ne l'a PAS — c'est un manque releve, pas un
   * precedent a suivre »). Il est comble ici.
   *
   * `isOpen` : cette modale est montee/demontee avec son ouverture, mais le hook
   * le recoit explicitement — c'est ce qui rend l'intention lisible.
   */
  const dialogRef = useDialog({ isOpen: saisieVisible, onClose: () => fermerLaSaisie() })

  const fermerLaSaisie = () => {
    setSaisieOuverte(false)
    // ⚠ INDISPENSABLE, ET C'EST LA MOITIE LA PLUS DISCRETE DE LA CORRECTION.
    // Sans cela, fermer la modale d'une modification laisserait le contexte
    // arme : la modale se rouvrirait toute seule au rendu suivant, et la saisie
    // d'apres heriterait de l'operation abandonnee.
    if (editingTransaction) clearEditTransaction()
  }
  const { toasts, showToast, removeToast } = useToast()

  const enAttente = pendingTransactions || []
  const compteDepots = enAttente.filter(
    (t) => String(t.type || '').toLowerCase().includes('dépôt')
      || String(t.type || '').toLowerCase().includes('depot'),
  ).length
  const compteRetraits = enAttente.filter(
    (t) => String(t.type || '').toLowerCase().includes('retrait'),
  ).length

  const exporter = async () => {
    const r = await exportTransactionsToXLSM(enAttente)
    showToast(
      r.success
        ? `Export réussi : ${r.count} transaction${r.count > 1 ? 's' : ''}.`
        : `Erreur lors de l'export : ${r.error}`,
      r.success ? 'success' : 'error',
    )
  }

  // Le compteur doit rester visible onglet fermé : on ne peut pas le déduire de
  // StoreCollaborations, qui n'est monté que lorsque son onglet est actif.
  useEffect(() => {
    setIncomingCollabCount(0)
    if (!IS_MULTI_NETWORK) return undefined
    return subscribeIncomingCollaborationsCount({
      storeId: userProfile?.storeId ?? null,
      onUpdate: setIncomingCollabCount,
    })
  }, [userProfile])

  // L'onglet vit dans l'URL : partageable, compatible bouton Retour, et cible des
  // redirections depuis les anciennes routes /store/collaborations.
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('tab')
  const mode = MODES.includes(requested) && (requested !== 'collaborations' || IS_MULTI_NETWORK)
    ? requested
    : 'client'
  const setMode = (next) => setSearchParams(next === 'client' ? {} : { tab: next }, { replace: true })
  // L'onglet Collaborations pointe sur la tâche : s'il y a des reçues en attente,
  // il ouvre leur sous-onglet (?sub=incoming) ; sinon « Mes demandes ». C'est tout
  // le bouton qui mène au travail à faire, pas seulement la pastille.
  const openCollab = () =>
    setSearchParams(
      incomingCollabCount > 0 ? { tab: 'collaborations', sub: 'incoming' } : { tab: 'collaborations' },
      { replace: true },
    )
  const collabInitialTab = searchParams.get('sub') === 'incoming' ? 'incoming' : 'outgoing'

  return (
    <div data-chassis className="min-h-screen bg-gray-100">
      <div data-chassis data-ecran className="max-w-7xl mx-auto px-4 py-6">
        <div data-ecran-tete className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <h1 data-titre-ecran className="text-3xl font-bold text-gray-800">
              Transactions
            </h1>
            <p data-ecran-compte>
              {enAttente.length} transaction{enAttente.length > 1 ? 's' : ''} non terminée{enAttente.length > 1 ? 's' : ''}
              {' · '}
              {compteDepots} dépôt{compteDepots > 1 ? 's' : ''}, {compteRetraits} retrait{compteRetraits > 1 ? 's' : ''}
            </p>
          </div>

          <div data-ecran-actions className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exporter}
              data-rang="second"
              className={`inline-flex items-center gap-2 ${classesDuRang('second')}`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M4 19h16" />
              </svg>
              Exporter
            </button>
            <button
              type="button"
              onClick={() => setSaisieOuverte(true)}
              data-rang="primaire"
              className={`inline-flex items-center gap-2 ${classesDuRang('primaire')}`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14" /><path d="M5 12h14" />
              </svg>
              Enregistrer une transaction
            </button>
          </div>
        </div>

        {/* Basculeur de mode. L'ordre suit la maquette : le travail courant
            d'abord, puis ce qui vient des autres boutiques, puis le dealer. */}
        <div className="mb-4 flex flex-wrap gap-2">
          <button type="button" aria-pressed={mode === 'client'} className={tabButtonClass(mode === 'client')} onClick={() => setMode('client')}>
            Transaction client
            {enAttente.length > 0 && (
              <TabBadge
                count={enAttente.length}
                active={mode === 'client'}
                testId="client-tab-badge"
                label={`${enAttente.length} transaction${enAttente.length > 1 ? 's' : ''} non terminée${enAttente.length > 1 ? 's' : ''}`}
              />
            )}
          </button>
          {IS_MULTI_NETWORK && (
            <button type="button" aria-pressed={mode === 'collaborations'} className={tabButtonClass(mode === 'collaborations')} onClick={openCollab}>
              Collaborations
              {/* Masquée à zéro : l'onglet fermé ne doit alerter que s'il y a à faire. */}
              {incomingCollabCount > 0 && (
                <TabBadge
                  count={incomingCollabCount}
                  tone="alert"
                  active={mode === 'collaborations'}
                  testId="collab-tab-badge"
                  label={`${incomingCollabCount} collaboration${incomingCollabCount > 1 ? 's' : ''} à exécuter`}
                />
              )}
            </button>
          )}
          <button type="button" aria-pressed={mode === 'dealer'} className={tabButtonClass(mode === 'dealer')} onClick={() => setMode('dealer')}>
            Envois dealer
          </button>
        </div>

        {/* La note vient APRES les onglets : elle explique le signe des montants
            du tableau, pas le choix de l'onglet. */}
        <ConventionDeSigne />

        {mode === 'client' && (
          <ErrorBoundary>
            <TransactionTable />
          </ErrorBoundary>
        )}

        {mode === 'dealer' && (
          <ErrorBoundary>
            <DealerTransferForm />
          </ErrorBoundary>
        )}

        {mode === 'collaborations' && (
          <ErrorBoundary>
            <StoreCollaborations embedded initialTab={collabInitialTab} />
          </ErrorBoundary>
        )}

        {/* LA MODALE DE SAISIE.
            Les marqueurs sont ceux du lot L9.6 (`data-modale-voile`,
            `data-modale`) et du lot L9.10 (`data-modale-tete`,
            `data-modale-fermer`) : aucune apparence n'est inventee ici, elle
            vient de src/index.css comme pour les onze autres modales. */}
        {saisieVisible && (
          <div
            data-modale-voile
            className="fixed inset-0 z-[9998] flex items-start justify-center overflow-y-auto bg-black/40 p-4"
          >
            <div
              ref={dialogRef}
              data-modale
              role="dialog"
              aria-modal="true"
              aria-labelledby="saisie-transaction-titre"
              className="my-8 w-full max-w-3xl rounded-lg bg-white p-6 shadow-2xl"
            >
              <div data-modale-tete data-modale-bande className="flex items-start justify-between gap-4 pb-3">
                {/* Le titre DIT dans quel mode on est. Ouvrir le meme panneau
                    sous « Enregistrer une transaction » pour une modification
                    ferait croire a une saisie neuve — et c'est exactement ce qui
                    arrivait quand l'edition restait armee. */}
                <h2 id="saisie-transaction-titre" className="text-base font-semibold text-gray-900">
                  {editingTransaction ? 'Modifier la transaction' : 'Enregistrer une transaction'}
                </h2>
                <button
                  type="button"
                  data-modale-fermer
                  onClick={fermerLaSaisie}
                  aria-label="Fermer"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <ErrorBoundary>
                <TransactionForm clients={clients} />
              </ErrorBoundary>
            </div>
          </div>
        )}

        {/* ⚠ `Toast` REND UN SEUL MESSAGE — il attend `message`, `type`,
            `duration`, `onClose`. Cette ligne lui passait `toasts` et
            `removeToast`, qu'il n'accepte pas, HORS de tout `.map` et de toute
            condition : chaque visite de l'ecran peignait donc une notification
            VIDE en haut a droite, puis jetait `TypeError: onClose is not a
            function` au bout de 4 secondes, quand son minuteur appelait un
            `onClose` inexistant.

            Et pendant ce temps le VRAI message — le resultat de l'export,
            construit plus haut — n'etait montre a personne. */}
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
      </div>
    </div>
  )
}

export default Transactions
