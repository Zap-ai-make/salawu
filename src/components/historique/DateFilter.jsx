import { useState, useId } from 'react'

function DateFilter({ onDateChange, onResetToToday }) {
  // `useId` et non une chaine fixe : ces composants peuvent etre rendus
  // plusieurs fois sur une meme page, et des identifiants dupliques
  // rattacheraient toutes les etiquettes au PREMIER champ — un defaut
  // invisible a l'oeil et bien reel au lecteur d'ecran.
  const idBase = useId()

  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const handleDateFromChange = (e) => {
    setDateFrom(e.target.value)
  }

  const handleDateToChange = (e) => {
    setDateTo(e.target.value)
  }

  const handleFilter = () => {
    if (isValidDateRange()) {
      onDateChange && onDateChange({ from: dateFrom, to: dateTo })
    }
  }

  const handleResetToToday = () => {
    setDateFrom('')
    setDateTo('')
    onResetToToday && onResetToToday()
  }


  // Validation des dates
  const isValidDateRange = () => {
    if (!dateFrom || !dateTo) return true
    return new Date(dateFrom) <= new Date(dateTo)
  }

  return (
    <div className="space-y-4">
      {/* Date Du */}
      <div>
        <label htmlFor={`${idBase}-du`} className="block text-lg font-semibold text-gray-700 mb-1">
          Du :
        </label>
        <input
          id={`${idBase}-du`}
          type="date"
          value={dateFrom}
          onChange={handleDateFromChange}
          className="w-full px-3 py-2 border-2 border-gray-300 rounded focus:outline-none focus:border-green-500 bg-white transition-colors"
        />
      </div>

      {/* Date Au */}
      <div>
        <label htmlFor={`${idBase}-au`} className="block text-lg font-semibold text-gray-700 mb-1">
          Au :
        </label>
        <input
          id={`${idBase}-au`}
          type="date"
          value={dateTo}
          onChange={handleDateToChange}
          className="w-full px-3 py-2 border-2 border-gray-300 rounded focus:outline-none focus:border-green-500 bg-white transition-colors"
        />
      </div>

      {/* Validation et actions */}
      {!isValidDateRange() && (
        <div className="text-red-600 text-sm">
          La date de fin doit être postérieure à la date de début
        </div>
      )}
      
      {/* Boutons d'action */}
      <div className="flex gap-2">
        <button data-rang="second"
          onClick={handleFilter}
          disabled={!isValidDateRange() || (!dateFrom && !dateTo)}
          className="bg-green-700 hover:bg-green-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-2 rounded font-medium transition-colors"
        >
          Filtrer
        </button>
        
        <button data-rang="second"
          onClick={handleResetToToday}
          className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-2 rounded font-medium transition-colors"
        >
          Aujourd'hui
        </button>
      </div>
    </div>
  )
}

export default DateFilter