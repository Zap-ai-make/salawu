import { useState, useCallback } from 'react'
import { generateAgentAccessCode } from '../../services/agentAccessService'

/**
 * Fenêtre de génération du code d'accès mobile d'un agent.
 *
 * Le code est généré côté serveur et n'est renvoyé QU'UNE FOIS : on l'affiche pour
 * que le gérant le communique à l'agent, avec un avertissement explicite (il faudra
 * régénérer si perdu). La génération n'est pas automatique au montage — elle invalide
 * tout code précédent — elle est déclenchée par le gérant.
 *
 * @param {{ clientId: string, clientName?: string, onClose: () => void }} props
 */
function AgentAccessCodeModal({ clientId, clientName, onClose }) {
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState(null)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  const generate = useCallback(async () => {
    setBusy(true); setError(null); setCopied(false)
    try {
      const res = await generateAgentAccessCode(clientId)
      setCode(res.accessCode)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }, [clientId])

  const copy = useCallback(async () => {
    if (!code) return
    try {
      await navigator.clipboard?.writeText(code)
      setCopied(true)
    } catch { /* presse-papiers indisponible : le gérant peut recopier à la main */ }
  }, [code])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()} data-testid="agent-access-modal">
        <h3 className="mb-1 text-base font-semibold text-gray-800">Code d'accès mobile</h3>
        <p className="mb-4 text-sm text-gray-500">
          {clientName ? `Agent : ${clientName}` : 'Générer le code d\'accès de cet agent.'}
        </p>

        {error && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700" data-testid="agent-access-error">{error}</p>}

        {!code ? (
          <>
            <p className="mb-4 text-sm text-gray-600">
              L'agent se connectera à l'application mobile avec son <strong>numéro ou code agent</strong> et
              ce code d'accès. Générer un nouveau code invalide l'ancien.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm">Annuler</button>
              <button type="button" disabled={busy} onClick={generate} data-testid="btn-generate-access-code"
                className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                {busy ? 'Génération…' : 'Générer le code'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-3 rounded-lg border border-green-200 bg-green-50 p-4 text-center">
              <div className="text-xs text-gray-500 mb-1">Code d'accès (à communiquer à l'agent)</div>
              <div className="font-mono text-xl font-bold tracking-wider text-gray-900 break-all" data-testid="agent-access-code-value">{code}</div>
            </div>
            <p className="mb-4 text-xs text-amber-700">
              ⚠ Notez-le maintenant : il ne sera plus réaffiché. En cas de perte, régénérez un nouveau code.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={copy} data-testid="btn-copy-access-code"
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50">
                {copied ? 'Copié ✓' : 'Copier'}
              </button>
              <button type="button" disabled={busy} onClick={generate}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50">
                {busy ? '…' : 'Régénérer'}
              </button>
              <button type="button" onClick={onClose}
                className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700">Fermer</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default AgentAccessCodeModal
