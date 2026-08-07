import { NETWORK_OPTIONS } from '../../utils/constants'

function ClientInfoDisplay({ client }) {
  if (!client) {
    return null
  }

  // Comptes agent par réseau : Code agent (client[réseau]) + Numéro agent (client.numerosAgent[réseau]).
  // On n'affiche une ligne que pour les réseaux où au moins une des deux valeurs est renseignée.
  const networkAccounts = NETWORK_OPTIONS
    .map((network) => {
      const key = network.toLowerCase()
      const code = String(client[key] ?? '').trim()
      const numero = String(client.numerosAgent?.[key] ?? '').trim()
      return { network, code, numero }
    })
    .filter(({ code, numero }) => code || numero)

  return (
    <div className="bg-green-100 border border-green-500 rounded p-4 mt-4">
      <h3 className="font-bold text-lg text-gray-800 mb-2">
        {client.nom} {client.prenom}
        {client.isManual && (
          <span className="ml-2 rounded bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-800">
            Non enregistré
          </span>
        )}
      </h3>
      {networkAccounts.length > 0 && (
        <div className="text-gray-700 mb-1">
          <span className="font-medium">Comptes agent :</span>
          <ul className="mt-1 space-y-0.5">
            {networkAccounts.map(({ network, code, numero }) => (
              <li key={network} className="text-sm">
                <span className="font-semibold">{network}</span>
                {code && <span> — Code: {code}</span>}
                {numero && <span> · N° agent: {numero}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {client.numeroPersonnel && (
        <p className="text-gray-700">
          <span className="font-medium">Numéro personnel :</span> {client.numeroPersonnel}
        </p>
      )}
    </div>
  )
}

export default ClientInfoDisplay
