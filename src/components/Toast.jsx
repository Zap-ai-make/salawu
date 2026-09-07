import { useState, useEffect } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'

function Toast({ message, type = 'info', duration = 4000, onClose }) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(() => onClose(), 300)
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-green-500 border-green-600'
      case 'error':
        return 'bg-red-500 border-red-600'
      case 'warning':
        return 'bg-yellow-500 border-yellow-600'
      default:
        return 'bg-blue-500 border-blue-600'
    }
  }

  // Icone ET libelle : le type d'un toast ne doit jamais reposer sur la seule
  // couleur ni sur la seule forme (DESIGN.md §5). Le libelle est visuellement
  // masque mais annonce par les lecteurs d'ecran, avant le message.
  const getIcon = () => {
    switch (type) {
      case 'success': return CheckCircle2
      case 'error':   return XCircle
      case 'warning': return AlertTriangle
      default:        return Info
    }
  }

  const TYPE_LABELS = {
    success: 'Succes',
    error:   'Erreur',
    warning: 'Avertissement',
    info:    'Information',
  }

  const Icon = getIcon()

  return (
    <div
      // Une erreur interrompt ; le reste s'annonce sans couper la lecture en cours.
      role={type === 'error' || type === 'warning' ? 'alert' : 'status'}
      className={`fixed top-4 right-4 z-50 p-4 rounded-lg text-white shadow-lg border-l-4 transition-all duration-300 max-w-sm ${
        isVisible ? 'opacity-100 transform translate-x-0' : 'opacity-0 transform translate-x-full'
      } ${getTypeStyles()}`}
    >
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="flex-1">
          <p className="text-sm font-medium">
            <span className="sr-only">{TYPE_LABELS[type] ?? TYPE_LABELS.info} : </span>
            {message}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsVisible(false)
            setTimeout(() => onClose(), 300)
          }}
          className="shrink-0 rounded text-white transition-colors hover:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Fermer la notification"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

export default Toast