import { useState, useMemo } from 'react'
import { parsefrenchDate, localDayKey } from '../../utils/helpers.js'
import { ChevronLeft, ChevronRight } from 'lucide-react'

function DailyPagination({ transactions, onDateSelect }) {
  const [currentPage, setCurrentPage] = useState(0)
  const daysPerPage = 7

  // Grouper les transactions par jour — clé LOCALE (parsefrenchDate + localDayKey), le
  // MÊME cadran que matchesDateFilter. Sinon le comptage/affichage (UTC via toISOString)
  // et le filtre (local) se décalaient d'un jour → cliquer une carte n'affichait rien.
  const transactionsByDay = useMemo(() => {
    const groups = {}

    transactions.forEach(transaction => {
      const parsed = parsefrenchDate(transaction.date) || new Date()
      const dateKey = localDayKey(parsed) || localDayKey(new Date())

      if (!groups[dateKey]) {
        groups[dateKey] = []
      }
      groups[dateKey].push(transaction)
    })

    return groups
  }, [transactions])

  // Obtenir les jours triés par date (plus récent en premier)
  const sortedDays = useMemo(() => {
    return Object.keys(transactionsByDay)
      .sort((a, b) => new Date(b) - new Date(a))
      .map(dateKey => ({
        date: dateKey,
        // Parse LOCAL ("T00:00:00" sans Z) pour afficher le bon jour quelle que soit la timezone.
        displayDate: new Date(dateKey + 'T00:00:00').toLocaleDateString('fr-FR'),
        count: transactionsByDay[dateKey].length
      }))
  }, [transactionsByDay])

  // Pagination des jours
  const totalPages = Math.ceil(sortedDays.length / daysPerPage)
  const startIndex = currentPage * daysPerPage
  const currentDays = sortedDays.slice(startIndex, startIndex + daysPerPage)

  const handleDayClick = (dateKey) => {
    // dateKey est déjà "YYYY-MM-DD" en cadran local (= celui de matchesDateFilter) :
    // on l'émet tel quel, sans re-conversion UTC.
    onDateSelect && onDateSelect({ from: dateKey, to: dateKey })
  }

  const handlePreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1)
    }
  }

  if (sortedDays.length === 0) {
    return (
      // `text-gray-600` (7,56:1 sur blanc, 6,24:1 sur --registre) et non
      // `text-gray-500` : ce dernier tient sur du blanc (4,83:1) mais tombe a
      // 3,99:1 sur le fond `--registre` de l'identite, sous le seuil AA de 4,5.
      // Cas typique d'une couleur de texte restee correcte tant que le fond n'a
      // pas bouge — le balayage du Lot 1 ne visait que gray-400 et gray-300, qui
      // echouaient DEJA sur blanc. Trouve par la boucle QA navigateur.
      <div className="text-center text-gray-600 py-4">
        Aucune transaction disponible
      </div>
    )
  }

  return (
    <div data-surface className="bg-white rounded-lg shadow-md p-6">
      {/* `flex-wrap` + `gap-3` : le titre et les deux boutons tenaient sur une
          rangee unique et depassaient de 40 px a 375 px. `justify-between` seul
          ne replie pas — il repartit l'espace, y compris negatif. */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <h3 className="text-lg font-semibold text-gray-700">Navigation par jour</h3>
        <div className="flex gap-2">
          <button
            onClick={handlePreviousPage}
            disabled={currentPage === 0}
            className="inline-flex items-center gap-1 px-3 py-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed rounded text-sm transition-colors"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Précédent
          </button>
          <span className="px-3 py-1 text-sm text-gray-600">
            Page {currentPage + 1} sur {totalPages}
          </span>
          <button
            onClick={handleNextPage}
            disabled={currentPage >= totalPages - 1}
            className="inline-flex items-center gap-1 px-3 py-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed rounded text-sm transition-colors"
          >
            Suivant
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
        {currentDays.map(({ date, displayDate, count }) => (
          <button
            key={date}
            onClick={() => handleDayClick(date)}
            className="p-3 border-2 border-gray-200 hover:border-green-500 hover:bg-green-50 rounded-lg text-center transition-colors"
          >
            <div className="text-sm font-medium text-gray-700">
              {displayDate}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {count} transaction{count > 1 ? 's' : ''}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default DailyPagination