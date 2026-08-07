import { useState, useEffect, useCallback } from 'react'
import { activeProfile } from '../../config/activeClientProfile.js'
import { networkSupplyMode } from '../../utils/networkRules.js'
import { getStoreNetworkConfig } from '../../services/adminService'
import { setStoreNetworkConfig } from '../../services/storeNetworkConfigService'

const ENABLED_NETWORKS = [...activeProfile.networks.enabled]

// État par défaut d'un réseau sans config enregistrée : la boutique opère le réseau,
// mode d'approvisionnement issu du profil (networkRules), non fournisseur/non couverte.
function defaultEntry(network) {
  return {
    operates: true,
    supplyMode: networkSupplyMode(network),
    isSupplied: false,
    isProvider: false,
  }
}

function buildInitialForm(loadedNetworks) {
  const form = {}
  for (const network of ENABLED_NETWORKS) {
    const loaded = loadedNetworks?.[network]
    form[network] = loaded
      ? {
          operates: loaded.operates === true,
          supplyMode: loaded.supplyMode === 'external_partner' ? 'external_partner' : 'dealer',
          isSupplied: loaded.isSupplied === true,
          isProvider: loaded.isProvider === true,
        }
      : defaultEntry(network)
  }
  return form
}

function StoreNetworkConfigEditor({ storeId, storeName }) {
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setSuccess(false)
    setDirty(false)
    getStoreNetworkConfig(storeId)
      .then(cfg => { if (!cancelled) { setForm(buildInitialForm(cfg?.networks)); setLoading(false) } })
      .catch(() => { if (!cancelled) { setForm(buildInitialForm(null)); setLoading(false) } })
    return () => { cancelled = true }
  }, [storeId])

  const updateField = useCallback((network, field, value) => {
    setForm(prev => ({ ...prev, [network]: { ...prev[network], [field]: value } }))
    setDirty(true)
    setSuccess(false)
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      await setStoreNetworkConfig({ storeId, networks: form })
      setSuccess(true)
      setDirty(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }, [storeId, form])

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-1">Configuration réseau</h3>
      <p className="text-xs text-gray-400 mb-3">
        Rôle de {storeName || 'la boutique'} pour chaque réseau (approvisionnement, couverture, fournisseur).
      </p>

      {loading ? (
        <div className="space-y-2">
          <div className="h-9 animate-pulse rounded bg-gray-100" />
          <div className="h-9 animate-pulse rounded bg-gray-100" />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <th className="px-3 py-2">Réseau</th>
                  <th className="px-3 py-2 text-center">Opère</th>
                  <th className="px-3 py-2">Approvisionnement</th>
                  <th className="px-3 py-2 text-center" title="Couverte : approvisionnée (dealer)">Couverte</th>
                  <th className="px-3 py-2 text-center" title="Fournisseur : peut approvisionner d'autres boutiques">Fournisseur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ENABLED_NETWORKS.map(network => {
                  const entry = form[network]
                  return (
                    <tr key={network}>
                      <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{network}</td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={entry.operates}
                          onChange={e => updateField(network, 'operates', e.target.checked)}
                          aria-label={`${network} : opère ce réseau`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={entry.supplyMode}
                          onChange={e => updateField(network, 'supplyMode', e.target.value)}
                          disabled={!entry.operates}
                          className="rounded border border-gray-300 px-2 py-1 text-sm disabled:opacity-50"
                          aria-label={`${network} : mode d'approvisionnement`}
                        >
                          <option value="dealer">Dealer</option>
                          <option value="external_partner">Partenaire externe</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={entry.isSupplied}
                          onChange={e => updateField(network, 'isSupplied', e.target.checked)}
                          disabled={!entry.operates}
                          aria-label={`${network} : couverte`}
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={entry.isProvider}
                          onChange={e => updateField(network, 'isProvider', e.target.checked)}
                          disabled={!entry.operates}
                          aria-label={`${network} : fournisseur`}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-700">{error}</p>
          )}
          {success && (
            <p className="mt-3 rounded-lg bg-green-50 border border-green-200 p-2 text-xs text-green-700">
              Configuration enregistrée.
            </p>
          )}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !dirty}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default StoreNetworkConfigEditor
