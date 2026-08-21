import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'
import { getTransactionStyles, getAvailableActions, isDraftSettling, parsefrenchDate, dedupById } from '../utils/helpers.js'
import { STORAGE_KEYS } from '../constants/index.js'
import { HISTORY_PAGE_SIZE } from '../utils/constants.js'
import { firestoreService } from '../services/firestore'
import { addTransactionPayment, addTransactionRefund } from '../services/settlementService'
import { toUserMessage } from '../utils/friendlyError.js'
import { AuthContext } from './AuthContext'

const TransactionsContext = createContext()

/**
 * Horodatage (ms) d'un élément d'historique pour le tri décroissant.
 * Priorité au Timestamp Firestore `createdAt` ; repli sur la date FR `date`
 * ("DD/MM/YYYY HH:mm"). On ne dépend d'aucun orderBy Firestore (le service
 * n'en pose pas volontairement, pour inclure TOUS les éléments).
 */
const historyTimestamp = (item) => {
  if (item?.createdAt?.toMillis) return item.createdAt.toMillis()
  if (item?.createdAt) {
    const t = new Date(item.createdAt).getTime()
    if (!Number.isNaN(t)) return t
  }
  const parsed = parsefrenchDate(item?.date)
  return parsed ? parsed.getTime() : 0
}

/** Tri décroissant (le dernier enregistré en haut). Exporté pour test. */
export const sortHistoryDesc = (list) =>
  [...list].sort((a, b) => historyTimestamp(b) - historyTimestamp(a))

export const useTransactions = () => {
  const context = useContext(TransactionsContext)
  if (!context) {
    throw new Error('useTransactions must be used within a TransactionsProvider')
  }
  return context
}

export const TransactionsProvider = ({ children }) => {
  const { currentUser: user, userProfile, activeStore, loading: authLoading } = useContext(AuthContext)

  // États pour les deux collections Firestore
  const [pendingTransactions, setPendingTransactions] = useState([])
  const [completedTransactions, setCompletedTransactions] = useState([])
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // Fenêtre de chargement de l'historique. null = illimité (comportement historique,
  // ex. TAOFIC). Un nombre (ex. salawu = 200) = plafond ; « voir plus » l'élargit.
  const [historyLimit, setHistoryLimit] = useState(HISTORY_PAGE_SIZE)

  // Synchronisation temps réel avec Firestore pour les deux collections - seulement si authentifié
  useEffect(() => {
    // Ne pas initialiser si l'auth est encore en cours de chargement
    if (authLoading) {
      return
    }

    // Si pas d'utilisateur connecté, ne pas essayer de charger depuis Firestore
    if (!user || !userProfile?.storeId || activeStore?.id !== userProfile.storeId) {
      setPendingTransactions([])
      setCompletedTransactions([])
      setLoading(false)
      return
    }

    let isMounted = true
    let unsubscribeDrafts

    const initializeTransactions = async () => {
      try {
        setLoading(true)
        setError(null)

        // Vérifier s'il y a des données localStorage à migrer
        const pendingData = localStorage.getItem(STORAGE_KEYS.PENDING_TRANSACTIONS)
        const completedData = localStorage.getItem(STORAGE_KEYS.COMPLETED_TRANSACTIONS)

        if (pendingData || completedData) {
          const pendingTx = pendingData ? JSON.parse(pendingData) : []
          const completedTx = completedData ? JSON.parse(completedData) : []

          if (pendingTx.length > 0 || completedTx.length > 0) {
            await firestoreService.migrateLocalStorageData({
              pendingTransactions: pendingTx,
              completedTransactions: completedTx
            })
            localStorage.removeItem(STORAGE_KEYS.PENDING_TRANSACTIONS)
            localStorage.removeItem(STORAGE_KEYS.COMPLETED_TRANSACTIONS)
          }
        }

        // Écouter les drafts (transactions non terminées)
        unsubscribeDrafts = firestoreService.subscribeToDrafts((draftsData) => {
          if (isMounted) {
            // Déduplication des drafts (O(n))
            setPendingTransactions(dedupById(draftsData))
          }
        })

        // (L'historique a son propre abonnement — voir l'effet dédié plus bas —
        //  car il doit se réabonner quand la fenêtre « voir plus » change.)

        if (isMounted) {
          setLoading(false)
        }
      } catch (error) {
        console.error('Erreur lors de l\'initialisation des transactions:', error)
        if (isMounted) {
          setError(toUserMessage(error))
          setLoading(false)
          // Fallback vers localStorage en cas d'erreur
          try {
            const savedPending = localStorage.getItem(STORAGE_KEYS.PENDING_TRANSACTIONS)
            const savedCompleted = localStorage.getItem(STORAGE_KEYS.COMPLETED_TRANSACTIONS)
            setPendingTransactions(savedPending ? JSON.parse(savedPending) : [])
            // Même tri décroissant qu'en mode nominal, pour une cohérence d'affichage.
            setCompletedTransactions(savedCompleted ? sortHistoryDesc(JSON.parse(savedCompleted)) : [])
          } catch {
            setPendingTransactions([])
            setCompletedTransactions([])
          }
        }
      }
    }

    initializeTransactions()

    return () => {
      isMounted = false
      if (unsubscribeDrafts && typeof unsubscribeDrafts === 'function') {
        unsubscribeDrafts()
      }
    }
  }, [user, userProfile?.storeId, activeStore?.id, authLoading])

  // Abonnement HISTORIQUE dédié : se réabonne quand la fenêtre change (« voir plus »).
  // Plafonné par `historyLimit` (profil client) ; null = illimité (inchangé, ex. TAOFIC).
  // setActiveStore() est posé sur le service AVANT que l'état React activeStore change
  // (AuthContext) → _requireActiveStore() est déjà valide ici.
  useEffect(() => {
    if (authLoading) return undefined
    if (!user || !userProfile?.storeId || activeStore?.id !== userProfile.storeId) {
      setCompletedTransactions([])
      return undefined
    }

    let isMounted = true
    let unsubscribeHistory
    try {
      const filters = historyLimit ? { limit: historyLimit } : {}
      unsubscribeHistory = firestoreService.subscribeToHistory((historyData) => {
        if (isMounted) {
          // Déduplication O(n) puis tri décroissant : le dernier enregistré en haut.
          setCompletedTransactions(sortHistoryDesc(dedupById(historyData)))
        }
      }, filters)
    } catch (err) {
      console.error('Erreur abonnement historique:', err)
    }

    return () => {
      isMounted = false
      if (unsubscribeHistory && typeof unsubscribeHistory === 'function') {
        unsubscribeHistory()
      }
    }
  }, [user, userProfile?.storeId, activeStore?.id, authLoading, historyLimit])

  const addTransaction = useCallback(async (transactionData) => {
    try {
      setError(null)
      const transaction = {
        ...transactionData,
        statut: transactionData.statut || 'Non Terminées',
        storeId: userProfile?.storeId,
        storeName: activeStore?.name || userProfile?.storeName,
        role: userProfile?.role,
        operatorId: user?.uid,
        operatorName: userProfile?.name || user?.displayName || user?.email,
        operatorEmail: user?.email || 'Utilisateur inconnu',
        userId: user?.uid,
        userEmail: user?.email || 'Utilisateur inconnu'
      }

      await firestoreService.addTransaction(transaction)
      // La mise à jour de l'état se fera automatiquement via onSnapshot
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la transaction:', error)
      setError(toUserMessage(error))
      throw error
    }
  }, [activeStore?.name, user, userProfile?.name, userProfile?.role, userProfile?.storeId, userProfile?.storeName])

  const updateTransaction = useCallback(async (id, updates) => {
    try {
      setError(null)
      await firestoreService.updateDraft(id, updates)
      // La mise à jour de l'état se fera automatiquement via onSnapshot
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la transaction:', error)
      setError(toUserMessage(error))
      throw error
    }
  }, [])

  const validateTransaction = useCallback(async (id, customStatus = 'Validée', selectedPaymentMethod = null, amountOverride = null) => {
    try {
      setError(null)

      const success = await firestoreService.validateTransaction(id, customStatus, selectedPaymentMethod, amountOverride)
      if (!success) {
        console.warn(`Transaction ${id} n'a pas pu être validée (probablement déjà supprimée)`)
        return false
      }

      return true
    } catch (error) {
      console.error('Erreur lors de la validation de la transaction:', error)
      setError(toUserMessage(error))
      throw error
    }
  }, [])

  const addPaymentTranche = useCallback(async (draftId, amount, paymentMethod, idempotencyKey) => {
    try {
      setError(null)
      await addTransactionPayment({ draftId, amount, paymentMethod, idempotencyKey })
      return true
    } catch (error) {
      console.error('Erreur de règlement (paiement):', error)
      setError(toUserMessage(error) || 'Erreur lors du paiement')
      throw error
    }
  }, [])

  const addRefundTranche = useCallback(async (draftId, amount, paymentMethod, idempotencyKey) => {
    try {
      setError(null)
      await addTransactionRefund({ draftId, amount, paymentMethod, idempotencyKey })
      return true
    } catch (error) {
      console.error('Erreur de règlement (remboursement):', error)
      setError(toUserMessage(error) || 'Erreur lors du remboursement')
      throw error
    }
  }, [])

  const deleteTransaction = useCallback(async (id) => {
    try {
      setError(null)
      // Vérifier d'abord si c'est dans les drafts ou l'historique
      const isDraft = pendingTransactions.some(t => t.id === id)

      if (isDraft) {
        await firestoreService.deleteDraft(id)
      } else {
        await firestoreService.deleteFromHistory(id)
      }
      // La mise à jour de l'état se fera automatiquement via onSnapshot
    } catch (error) {
      console.error('Erreur lors de la suppression de la transaction:', error)
      setError(toUserMessage(error))
      throw error
    }
  }, [pendingTransactions])

  const startEditTransaction = useCallback((transaction) => {
    setEditingTransaction(transaction)
  }, [])

  const clearEditTransaction = useCallback(() => {
    setEditingTransaction(null)
  }, [])

  const getActionButtons = useCallback((transaction) => {
    const actions = getAvailableActions(transaction.type)
    // Dès qu'un règlement est engagé, `type`/`montant`/`clientId` sont figés côté
    // règles Firestore : on masque donc « Modifier » pour rester cohérent avec le
    // serveur (les tranches restent accessibles via Encaisser/Payer/Rembourser).
    if (isDraftSettling(transaction)) {
      return { ...actions, modifier: false }
    }
    return actions
  }, [])

  const getTransactionStylesFunc = useCallback((type) => {
    return getTransactionStyles(type)
  }, [])

  // « Voir plus » : élargit la fenêtre de l'historique (no-op si illimité).
  const loadMoreHistory = useCallback(() => {
    setHistoryLimit((cur) => (cur == null ? cur : cur + HISTORY_PAGE_SIZE))
  }, [])

  // Reste-t-il potentiellement des transactions plus anciennes à charger ?
  // Heuristique : la fenêtre est pleine (autant chargé que la limite demandée).
  const canLoadMore = historyLimit != null && completedTransactions.length >= historyLimit

  // Mémoïsé : sans cela, un nouvel objet `value` à chaque render re-rendrait TOUS les
  // consommateurs du contexte à chaque snapshot Firestore (les fonctions sont déjà useCallback).
  const value = useMemo(() => ({
    pendingTransactions,
    completedTransactions,
    editingTransaction,
    loading,
    error,
    addTransaction,
    updateTransaction,
    validateTransaction,
    addPaymentTranche,
    addRefundTranche,
    deleteTransaction,
    startEditTransaction,
    clearEditTransaction,
    getActionButtons,
    getTransactionStyles: getTransactionStylesFunc,
    loadMoreHistory,
    canLoadMore
  }), [
    pendingTransactions,
    completedTransactions,
    editingTransaction,
    loading,
    error,
    addTransaction,
    updateTransaction,
    validateTransaction,
    addPaymentTranche,
    addRefundTranche,
    deleteTransaction,
    startEditTransaction,
    clearEditTransaction,
    getActionButtons,
    getTransactionStylesFunc,
    loadMoreHistory,
    canLoadMore
  ])

  return (
    <TransactionsContext.Provider value={value}>
      {children}
    </TransactionsContext.Provider>
  )
}
