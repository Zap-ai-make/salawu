import { useState, useEffect } from 'react'

function ClientSearch({ onSearch, onSearchChange }) {
  const [searchTerm, setSearchTerm] = useState('')

  // Recherche en temps réel avec debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      onSearchChange && onSearchChange(searchTerm)
    }, 300) // Délai de 300ms pour éviter trop d'appels

    return () => clearTimeout(timeoutId)
  }, [searchTerm, onSearchChange])

  const handleInputChange = (e) => {
    setSearchTerm(e.target.value)
  }

  const handleSearch = () => {
    onSearch && onSearch(searchTerm)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSearch()
    }
  }

  return (
    <div className="flex flex-wrap gap-3 items-end">
      {/* ⚠ UN LIBELLE VISIBLE, ET PAS SEULEMENT UN `placeholder`. Un placeholder
          disparait des qu'on tape : celui qui revient sur un champ rempli ne
          sait plus ce qu'il contient, et un lecteur d'ecran n'a rien de stable a
          annoncer. Le libelle reste. */}
      <div data-filtre-bloc data-filtre-bloc-large>
        <label htmlFor="historique-recherche" className="block font-semibold text-gray-700 mb-1">
          Rechercher
        </label>
        <span data-champ-icone>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="M16.5 16.5 21 21" />
          </svg>
          <input
            id="historique-recherche"
            type="search"
            placeholder="Rechercher par nom, prénom ou code réseau..."
            value={searchTerm}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            className="w-full px-3 py-2 border-2 border-gray-300 rounded focus:outline-none focus:border-green-500 bg-white transition-colors"
          />
        </span>
      </div>
      
      <button data-rang="primaire"
        onClick={handleSearch}
        className="bg-green-700 hover:bg-green-800 text-white px-6 py-2 rounded font-medium transition-colors"
      >
        Rechercher
      </button>
    </div>
  )
}

export default ClientSearch