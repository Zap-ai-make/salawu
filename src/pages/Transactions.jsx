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

  const tabClass = (active) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 inline-flex items-center ${
      active ? 'bg-green-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
    }`

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 border-b-2 border-green-500 pb-2">
          Transactions
        </h1>

        {/* Basculeur de mode */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button type="button" className={tabClass(mode === 'client')} onClick={() => setMode('client')}>
            Transaction client
          </button>
          <button type="button" className={tabClass(mode === 'dealer')} onClick={() => setMode('dealer')}>
            Opération dealer
          </button>
          {IS_MULTI_NETWORK && (
            <button type="button" className={tabClass(mode === 'collaborations')} onClick={() => setMode('collaborations')}>
              Collaborations
              {incomingCollabCount > 0 && (
                <span
                  className="ml-1.5 inline-flex items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none min-w-[1.2rem]"
                  aria-label={`${incomingCollabCount} collaboration${incomingCollabCount > 1 ? 's' : ''} à exécuter`}
                  data-testid="collab-tab-badge"
                >
                  {incomingCollabCount > 99 ? '99+' : incomingCollabCount}
                </span>
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
            <StoreCollaborations embedded />
          </ErrorBoundary>
        )}
      </div>
    </div>
  )
}

export default Transactions
