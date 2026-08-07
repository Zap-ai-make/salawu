import { useState, useMemo } from 'react'
import { MONTHS } from '../constants'
import { NETWORK_OPTIONS } from '../utils/constants'

export const useClientsFilter = (clients) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('Tous les mois')

  const filteredClients = useMemo(() => {
    const search = searchTerm.trim().toLowerCase()
    return clients.filter(client => {
      // Recherche sur : nom, prénom, numéro personnel, et pour CHAQUE réseau du profil
      // le Code agent (client[réseau]) + le Numéro agent (client.numerosAgent[réseau]).
      // Champs potentiellement absents → coalescer en chaîne vide avant toLowerCase().
      const networkFields = NETWORK_OPTIONS.flatMap((network) => {
        const key = network.toLowerCase()
        return [client[key], client.numerosAgent?.[key]]
      })
      const matchesSearch = !search || [
        client.nom,
        client.prenom,
        client.numeroPersonnel,
        ...networkFields,
      ].some(field => String(field ?? '').toLowerCase().includes(search))

      let matchesMonth = true
      if (selectedMonth !== 'Tous les mois') {
        const selectedMonthNumber = MONTHS[selectedMonth]
        if (selectedMonthNumber && client.dateAjout) {
          const dateParts = client.dateAjout.split('/')
          if (dateParts.length === 3) {
            const clientMonth = dateParts[1]
            matchesMonth = clientMonth === selectedMonthNumber
          } else {
            matchesMonth = false
          }
        }
      }
      
      return matchesSearch && matchesMonth
    })
  }, [clients, searchTerm, selectedMonth])

  return {
    searchTerm,
    setSearchTerm,
    selectedMonth,
    setSelectedMonth,
    filteredClients
  }
}