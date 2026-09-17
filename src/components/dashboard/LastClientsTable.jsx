import { parsefrenchDate } from '../../utils/helpers.js'
import { NETWORK_OPTIONS } from '../../utils/constants'
import { IS_REGISTRE } from '../../constants/designSystem.js'

// Premier Code agent renseigné (tous réseaux), préfixé du réseau — aperçu compact du dashboard.
const firstAgentCode = (client) => {
  for (const network of NETWORK_OPTIONS) {
    const code = client[network.toLowerCase()]
    if (code) return `${network}: ${code}`
  }
  return '-'
}

/**
 * TROIS COLONNES, ET NON SEPT — pour l'identité « registre » seulement.
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI QUATRE COLONNES PARTENT
 *
 * « Numéro personnel », « Code agent » et « Commercial » sont des informations
 * de FICHE : on les consulte quand on ouvre un client, jamais depuis l'accueil.
 * Les porter ici coûtait sept colonnes, donc un tableau qui déborde à 375 px et
 * se lit au doigt — et ce sont justement les colonnes de droite, les moins
 * utiles, qui devenaient les plus difficiles à atteindre.
 *
 * « Nom » et « Prénom » fusionnent : personne ne lit un nom sans son prénom, et
 * deux colonnes pour une seule identité doublaient la largeur pour rien.
 *
 * ⚠ CE CHANGEMENT EMPORTE UN DÉFAUT D'ACCESSIBILITÉ. Le code agent était rendu
 * en `text-orange-600` sur blanc : 3,57:1, contre 4,5:1 exigé. Il n'est pas
 * corrigé — la colonne qui le portait n'existe plus. C'est la meilleure façon de
 * régler un défaut de contraste : retirer ce qui n'avait pas à être là.
 *
 * ⚠ GARDÉ PAR `IS_REGISTRE`, ET CE N'EST PAS DE LA PRUDENCE DÉCORATIVE.
 * `App.jsx:129` sert le même tableau de bord à TOUS les clients boutique, TAOFIC
 * compris — qui est en production. Retirer quatre colonnes les lui retirerait
 * aussi, alors qu'il n'a rien demandé. TC-171 monte l'écran avec les deux
 * profils et exige sept colonnes pour l'un, trois pour l'autre.
 */
const COLONNES_REGISTRE = ['Nom et prénom', 'Localité', 'Date d\'ajout']

const COLONNES_LEGACY = [
  'Nom',
  'Prénom',
  'Numéro personnel',
  'Code agent',
  'Localité',
  'Commercial',
  'Date d\'ajout',
]

function LastClientsTable({ clients = [] }) {
  // Prendre les 5 derniers clients
  const lastClients = clients.slice(-5).reverse()

  const headers = IS_REGISTRE ? COLONNES_REGISTRE : COLONNES_LEGACY

  const formatDate = (client) => {
    // Si le client a une date d'ajout, l'utiliser avec le bon parseur, sinon date actuelle
    if (client.dateAjout) {
      const date = parsefrenchDate(client.dateAjout)
      if (!date) return '-'
      return date.toLocaleDateString('fr-FR')
    }
    return new Date().toLocaleDateString('fr-FR')
  }

  return (
    <div data-surface className="bg-gradient-to-br from-gray-50 to-white rounded-xl shadow-sm border border-gray-100">
      {/* En-tête avec design moderne */}
      <div data-bloc-titre className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white rounded-t-xl">
        <div className="flex items-center space-x-3">
          <div data-vignette className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <div className="h-4 w-4 bg-blue-500 rounded-sm"></div>
          </div>
          <h2 className="text-xl font-bold text-gray-800">Derniers clients enregistrés</h2>
        </div>
      </div>

      {/* Focalisable : sur telephone ce tableau defile lateralement, et sans
          cela ses colonnes de droite sont hors d'atteinte au clavier (Q3). */}
      <div
        tabIndex={0}
        role="region"
        aria-label="Derniers clients, defilement horizontal"
        className="overflow-x-auto"
      >
        <table className="w-full border-collapse min-w-max">
          <thead>
            <tr className="bg-gradient-to-r from-blue-50 to-white border-b border-blue-100">
              {headers.map((header, index) => (
                <th
                  key={index}
                  className="px-4 py-4 text-left text-sm font-semibold text-blue-900 whitespace-nowrap"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white">
            {lastClients.length === 0 ? (
              <tr>
                <td
                  colSpan={headers.length}
                  className="px-4 py-12 text-center"
                >
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center">
                      <div className="h-6 w-6 bg-gray-400 rounded-full"></div>
                    </div>
                    <p className="text-gray-500 text-sm">Aucun client enregistré</p>
                  </div>
                </td>
              </tr>
            ) : (
              lastClients.map((client, index) => (
                <tr
                  key={client.id || `${client.nom || 'client'}-${client.prenom || ''}-${index}`}
                  className={`border-b border-gray-50 hover:bg-blue-50 transition-colors duration-150 ${
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  }`}
                >
                  {IS_REGISTRE ? (
                    <>
                      {/* Le nom et le prénom se lisent ensemble : ce sont une
                          seule identité, pas deux données. */}
                      <td className="px-4 py-4 text-sm font-medium text-gray-900">
                        {[client.nom, client.prenom].filter(Boolean).join(' ') || '-'}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">
                        {client.localite || '-'}
                      </td>
                      <td data-nombre className="px-4 py-4 text-sm text-gray-600">
                        {formatDate(client)}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-4 text-sm font-medium text-gray-900">
                        {client.nom || '-'}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">
                        {client.prenom || '-'}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700 font-mono">
                        {client.numeroPersonnel || '-'}
                      </td>
                      <td className="px-4 py-4 text-sm text-orange-600 font-medium">
                        {firstAgentCode(client)}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">
                        {client.localite || '-'}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">
                        {client.agentCommercial || '-'}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        <span className="bg-gray-100 px-2 py-1 rounded-md text-xs">
                          {formatDate(client)}
                        </span>
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default LastClientsTable
