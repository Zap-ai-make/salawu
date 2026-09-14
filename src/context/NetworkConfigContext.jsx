import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { getStorageKey } from '../config/clientIsolation'
import { AuthContext } from './AuthContext'
import { firestoreService } from '../services/firestore'

const NetworkConfigContext = createContext()

// Configuration par défaut : STOCKS + LIQUIDITÉS par réseau
const DEFAULT_NETWORK_DATA = {
  Orange: { stock: 0, liquidite: 0 },
  Moov: { stock: 0, liquidite: 0 },
  Telecel: { stock: 0, liquidite: 0 },
  Coris: { stock: 0, liquidite: 0 },
  Sank: { stock: 0, liquidite: 0 },
  Wave: { stock: 0, liquidite: 0 }
}

// Clé du cache local. Le suffixe boutique est OBLIGATOIRE : sans lui, toutes les
// boutiques ouvertes sur un même navigateur partagent un seul jeu de soldes, et
// celui de la boutique précédente sert de valeurs initiales à la suivante.
const NETWORK_DATA_STORAGE_PREFIX = getStorageKey('network_data_v3')

const storageKeyForStore = (storeId) =>
  storeId ? `${NETWORK_DATA_STORAGE_PREFIX}_${storeId}` : null

export function useNetworkConfig() {
  const context = useContext(NetworkConfigContext)
  if (!context) {
    throw new Error('useNetworkConfig must be used within a NetworkConfigProvider')
  }
  return context
}

// Charger le cache d'UNE boutique. Sans boutique identifiée, on ne lit rien :
// il n'existe pas de soldes « génériques » à afficher.
const loadNetworkDataFromStorage = (storeId) => {
  const key = storageKeyForStore(storeId)
  if (!key) return { ...DEFAULT_NETWORK_DATA }

  try {
    const stored = localStorage.getItem(key)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (parsed && typeof parsed === 'object') {
        // Fusionner avec les défauts pour ajouter de nouveaux réseaux si nécessaire
        return { ...DEFAULT_NETWORK_DATA, ...parsed }
      }
    }
  } catch (error) {
    console.warn('Erreur lors du chargement des données réseau:', error)
  }
  return { ...DEFAULT_NETWORK_DATA }
}

// Sauvegarder le cache d'UNE boutique. Sans boutique identifiée, on n'écrit rien.
const saveNetworkDataToStorage = (storeId, data) => {
  const key = storageKeyForStore(storeId)
  if (!key) return

  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch (error) {
    console.warn('Erreur lors de la sauvegarde:', error)
  }
}

export function NetworkConfigProvider({ children }) {
  const { currentUser: user, userProfile, activeStore, loading: authLoading } = useContext(AuthContext)

  // Les soldes portent TOUJOURS l'identité de la boutique à laquelle ils
  // appartiennent. C'est ce couple — et non l'ordre des effets — qui rend une
  // fuite inter-boutiques impossible, à l'affichage comme au cache.
  // Au premier rendu la boutique n'est pas connue : on part des défauts, jamais
  // d'un cache dont on ignore le propriétaire.
  const [balanceState, setBalanceState] = useState(() => ({
    storeId: null,
    data: { ...DEFAULT_NETWORK_DATA },
  }))

  // Seule boutique dont le cache peut être lu ou écrit : celle de l'utilisateur
  // connecté, et seulement une fois le contexte boutique résolu.
  const scopedStoreId =
    user && userProfile?.storeId && activeStore?.id === userProfile.storeId
      ? userProfile.storeId
      : null

  // Purge de l'ancienne clé commune à toutes les boutiques (avant cloisonnement).
  // Elle ne doit plus jamais servir de source de soldes sur un poste déjà utilisé.
  useEffect(() => {
    try {
      localStorage.removeItem(NETWORK_DATA_STORAGE_PREFIX)
    } catch {
      // Stockage indisponible : rien à purger.
    }
  }, [])

  useEffect(() => {
    if (authLoading) return undefined

    if (!scopedStoreId) {
      setBalanceState({ storeId: null, data: { ...DEFAULT_NETWORK_DATA } })
      return undefined
    }

    // Repli hors ligne : les derniers soldes connus DE CETTE boutique.
    setBalanceState({
      storeId: scopedStoreId,
      data: loadNetworkDataFromStorage(scopedStoreId),
    })

    // Une boutique sans document de soldes démarre à zéro. Amorcer depuis le
    // cache navigateur graverait les soldes d'une autre boutique dans son
    // document Firestore, de façon définitive.
    firestoreService.ensureNetworkBalances({ ...DEFAULT_NETWORK_DATA })
      .catch((error) => {
        console.error('Erreur lors de l initialisation des soldes reseau:', error)
      })

    const unsubscribe = firestoreService.subscribeToNetworkBalances((balances) => {
      setBalanceState({ storeId: scopedStoreId, data: balances })
    })

    return unsubscribe
  }, [user, scopedStoreId, authLoading])

  // Sauvegarde locale de secours pour l'affichage hors ligne, écrite sous
  // l'identité que portent les soldes eux-mêmes.
  useEffect(() => {
    if (!balanceState.storeId) return
    saveNetworkDataToStorage(balanceState.storeId, balanceState.data)
  }, [balanceState])

  const networkData = balanceState.data

  // Mettre à jour un réseau (stock OU liquidité)
  const updateNetwork = useCallback((network, type, amount) => {
    const nextAmount = Math.max(0, Number(amount) || 0)

    // La boutique visée est figée à l'appel. Le provider ne se démonte pas entre
    // deux comptes : sans cette garde, une écriture qui se termine APRÈS un
    // changement de boutique estamperait ses montants de la nouvelle identité,
    // donc les afficherait et les écrirait dans le cache de celle-ci.
    const targetStoreId = scopedStoreId
    const applyData = (nextData) => setBalanceState(prev => (
      prev.storeId === targetStoreId ? { ...prev, data: nextData } : prev
    ))

    if (user) {
      return firestoreService.setNetworkBalance(network, type, nextAmount)
        .then((balances) => {
          applyData(balances)
          return balances
        })
        .catch((error) => {
          console.error('Erreur lors de la sauvegarde du solde reseau:', error)
          throw error
        })
    }

    setBalanceState(prev => {
      if (prev.storeId !== targetStoreId) return prev
      const current = prev.data[network] || { stock: 0, liquidite: 0 }

      return {
        ...prev,
        data: {
          ...prev.data,
          [network]: { ...current, [type]: nextAmount }
        }
      }
    })
    return Promise.resolve()
  }, [user, scopedStoreId])

  // Réinitialiser les soldes de la boutique courante, sans changer de propriétaire.
  // Pas de removeItem : l'effet de persistance réécrirait la clé dans la foulée.
  const resetToDefaults = useCallback(() => {
    setBalanceState(prev => ({ ...prev, data: { ...DEFAULT_NETWORK_DATA } }))
  }, [])

  const value = {
    networkData,
    updateNetwork,
    resetToDefaults
  }

  return (
    <NetworkConfigContext.Provider value={value}>
      {children}
    </NetworkConfigContext.Provider>
  )
}

export { DEFAULT_NETWORK_DATA }
