import { useContext } from 'react'
import { ClientsContext } from '../context/ClientsContext.jsx'
import { useAllTransactions } from '../hooks/useAllTransactions.js'
import { useDashboardData } from '../hooks/useDashboardData.js'
import { useTheme } from '../context/ThemeContext.jsx'
import InfoCards from '../components/dashboard/InfoCards'
import CAChart from '../components/dashboard/Charts/CAChart'
import NetworkChart from '../components/dashboard/Charts/NetworkChart'
import AgentsChart from '../components/dashboard/Charts/AgentsChart'
import LoyaltyChart from '../components/dashboard/Charts/LoyaltyChart'
import TransactionsTodayChart from '../components/dashboard/TransactionsTodayChart'
import LastClientsTable from '../components/dashboard/LastClientsTable'
import ChiffresDuJour from '../components/dashboard/ChiffresDuJour'
import { IS_REGISTRE } from '../constants/designSystem.js'

/**
 * ⚠ LES QUATRE GRAPHIQUES RESTENT IMPORTÉS, ET CE N'EST PAS UN OUBLI.
 *
 * `App.jsx:129` sert ce même tableau de bord à TOUS les clients boutique, TAOFIC
 * compris — qui est en production. Un profil sans l'identité « registre » les
 * rend donc toujours : les retirer du fichier les lui retirerait aussi.
 *
 * Ce que l'identité « registre » écarte — « Évolution du CA (14 jours) »,
 * « Top agents », « Fidèles clients », « Transactions du jour » — ce sont des
 * questions d'ANALYSE, posées une fois par mois par un gérant. Pas au comptoir,
 * où l'on veut savoir combien on a vendu aujourd'hui et combien il reste. Elles
 * occupaient précisément la hauteur d'écran de ces deux réponses-là.
 *
 * TC-171 monte cet écran avec les deux profils : l'un exige les cinq graphiques,
 * l'autre le seul qui reste. Le cloisonnement est prouvé, pas espéré.
 */

function Dashboard() {
  const { clients, loading: clientsLoading } = useContext(ClientsContext)
  const allTransactions = useAllTransactions()
  const { themeClasses } = useTheme()

  // Utiliser le hook centralisé pour les données
  const stats = useDashboardData(clients, allTransactions)

  // État de chargement général - ne pas bloquer si les clients sont vides mais chargés
  const isLoading = clientsLoading

  // Affichage de chargement
  if (isLoading) {
    return (
      <div className="space-y-8">
        {/* Titre */}
        <div className={`border-b-2 border-current pb-4 ${themeClasses.text}`}>
          <h1 data-titre-ecran className={`text-3xl font-bold ${themeClasses.text}`}>Tableau de bord</h1>
        </div>

        {/* Indicateur de chargement */}
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className={`inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent ${themeClasses.text}`}></div>
            <p className={`mt-4 ${themeClasses.text}`}>Chargement des données...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Titre */}
      <div className={`border-b-2 border-current pb-4 ${themeClasses.text}`}>
        <h1 data-titre-ecran className={`text-3xl font-bold ${themeClasses.text}`}>Tableau de bord</h1>
      </div>

      {/* Cartes d'informations */}
      <InfoCards
        totalClients={stats.totalClients}
        monthlyClients={stats.monthlyClients}
        dailyClients={stats.dailyClients}
        topClient={stats.topClient}
      />

      {IS_REGISTRE ? (
        <>
          {/* Les deux nombres qu'un gérant demande en fin de journée. Ils ne
              figuraient nulle part sur l'accueil : il fallait aller les chercher
              dans l'historique. */}
          <ChiffresDuJour transactions={allTransactions} />

          {/* « Répartition par réseau » est le seul graphique conservé, et il
              tient à côté des derniers clients au lieu d'occuper sa propre
              rangée. C'est ce que fait la maquette, et cela tient : l'un se
              regarde, l'autre se lit. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <NetworkChart />
            <LastClientsTable clients={clients} />
          </div>
        </>
      ) : (
        <>
          {/* Première ligne de graphiques */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CAChart />
            <NetworkChart />
          </div>

          {/* Deuxième ligne de graphiques */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <AgentsChart />
            <LoyaltyChart />
            <TransactionsTodayChart />
          </div>

          {/* Tableau des derniers clients */}
          <LastClientsTable clients={clients} />
        </>
      )}
    </div>
  )
}

export default Dashboard
