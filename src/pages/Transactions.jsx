import { useState, useEffect } from 'react'
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

const MODES = ['client', 'dealer', 'collaborations']

function Transactions() {
  const { clients } = useClients()
  const { userProfile } = useAuth()
  const [incomingCollabCount, setIncomingCollabCount] = useState(0)

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
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 border-b-2 border-green-500 pb-2">
          Transactions
        </h1>

        {/* Basculeur de mode */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button type="button" aria-pressed={mode === 'client'} className={tabButtonClass(mode === 'client')} onClick={() => setMode('client')}>
            Transaction client
          </button>
          <button type="button" aria-pressed={mode === 'dealer'} className={tabButtonClass(mode === 'dealer')} onClick={() => setMode('dealer')}>
            Opération dealer
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
        </div>

        {mode === 'client' && (
          <div className="space-y-8">
            <ErrorBoundary>
              <TransactionForm clients={clients} />
            </ErrorBoundary>
            <ErrorBoundary>
              <TransactionTable />
            </ErrorBoundary>
          </div>
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
      </div>
    </div>
  )
}

export default Transactions
