import { useSearchParams } from 'react-router-dom'
import { useClients } from '../hooks/useClients'
import { IS_MULTI_NETWORK } from '../constants/navigation'
import TransactionForm from '../components/transactions/TransactionForm'
import TransactionTable from '../components/transactions/TransactionTable'
import DealerTransferForm from '../components/transactions/DealerTransferForm'
import StoreCollaborations from './store/StoreCollaborations.jsx'
import ErrorBoundary from '../components/ui/ErrorBoundary'

const MODES = ['client', 'dealer', 'collaborations']

function Transactions() {
  const { clients } = useClients()

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
