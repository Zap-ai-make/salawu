import { useContext, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { IS_REGISTRE } from '../constants/designSystem.js'
import { classesDuRang } from './ui/rangs.js'
import { useClientsFilter } from '../hooks/useClientsFilter'
import { useExcelOperations } from '../hooks/useExcelOperations'
import { usePagination } from '../hooks/usePagination'
import { useToast } from '../hooks/useToast'
import { useTheme } from '../context/ThemeContext.jsx'
import { AuthContext } from '../context/AuthContext'
import { MONTH_OPTIONS, TABLE_HEADERS } from '../constants'
import TableRow from './TableRow'
import Pagination from './Pagination'
import Toast from './Toast'

// La mise en page du contenu d'une action : icone + libelle. Elle vaut pour les
// deux identites — ce n'est pas une apparence, c'est un alignement.
const BASE_ACTION = 'inline-flex items-center gap-2'

// ⚠ L'APPARENCE EXACTE D'AVANT LE LOT L9.13, pour les deux contrôles qui en
// avaient une. Relevée dans l'historique (commit 8aaa655), recopiée sans la
// juger : le violet et le bleu n'ont rien d'un système, mais c'est ce que TAOFIC
// affiche en production, et ce lot n'est pas celui qui en décide.
const HISTORIQUE_IMPORTER = 'bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white px-6 py-2 rounded transition-colors'
const HISTORIQUE_EXPORTER = 'bg-blue-700 hover:bg-blue-700 text-white px-6 py-2 rounded transition-colors'

/**
 * ⚠ LA BARRE DE FILTRES AUSSI ÉTAIT NUE HORS DE L'IDENTITÉ.
 *
 * Le lot L9.11 lui a donné `data-filtres`, `data-filtre-bloc` et
 * `data-champ-icone`, et retiré toutes ses classes. Les trois marqueurs n'ont de
 * règle que sous `.design-registre [data-espace='boutique']` : en `legacy`, la
 * rangée perdait sa gouttière, les libellés leur graisse, les champs leur
 * bordure, et l'icône de recherche se posait À CÔTÉ du champ au lieu d'être
 * dedans — un SVG orphelin en début de ligne.
 *
 * `DateFilter` et `ClientSearch`, eux, avaient gardé leurs classes : c'est
 * pourquoi l'Historique dégrade proprement et que cet écran-ci était le seul
 * touché.
 *
 * Ces classes reprennent l'apparence d'avant le lot (commit 8aaa655) : bordure
 * grise, rayon, focus vert.
 */
const LEGACY_CHAMP = 'px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-green-500'
const LEGACY_LABEL = 'block text-sm font-medium text-gray-700 mb-1'

function ClientsTable({ clients, onDelete, onEdit, onAdd, onImportClients, onAccessCode }) {
  const { toasts, showToast, removeToast } = useToast()
  const { activeStore } = useContext(AuthContext)
  const { searchTerm, setSearchTerm, selectedMonth, setSelectedMonth, filteredClients } = useClientsFilter(clients)
  const { paginatedData, ...paginationProps } = usePagination(filteredClients)

  // Construire la map des boutiques pour la résolution du nom dans l'export.
  // L'utilisateur ne voit que les clients de sa propre boutique (activeStore).
  const storesById = useMemo(() => {
    if (!activeStore?.id) return {}
    return { [activeStore.id]: activeStore }
  }, [activeStore])

  const { isImporting, fileInputRef, handleExport, handleImportClick, handleFileImport } = useExcelOperations(
    onImportClients,
    showToast,
    storesById
  )
  const { themeClasses } = useTheme()

  // `data-surface` : la page entiere tient dans une carte blanche arrondie a
  // ombre portee. Sous l'identite elle devient un panneau plat borde d'un filet
  // — meme fonction, sans les trois tics que le chantier retire partout
  // ailleurs. La maquette, elle, ne met AUCUNE carte ici : l'ecran pose
  // directement sur le canvas. La supprimer serait un changement de structure,
  // pas un restylage ; l'aplatir est la mesure juste.
  return (
    <div data-surface className="bg-white rounded-lg shadow-md p-6">
      {/* LA TETE D'ECRAN — titre et compte a gauche, actions a droite.
          Le titre reste un <h2> : la maquette le dit elle-meme (« un h2, jamais
          un second h1 »), et changer le niveau modifierait l'arbre
          d'accessibilite, ce qui n'est pas un restylage. */}
      <div data-tete-ecran data-ecran-tete className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          {/* ⟲ `data-titre-ecran`, ET NON `data-tete-ecran` — LES DEUX ETAIENT
              INVERSES. `data-tete-ecran` designe l'ENVELOPPE du titre (sa seule
              regle annule un filet bas) ; `data-titre-ecran` designe le TITRE et
              porte sa typographie — 1,4375rem / 600 / --encre.

              Portes a l'envers, la regle de typographie ne trouvait rien :
              « Clients » restait en `text-2xl font-bold` du theme, seul des dix
              ecrans hors de l'echelle unifiee.

              ⚠ TC-176 NE POUVAIT PAS LE VOIR : son expression reguliere accepte
              l'un OU l'autre marqueur. Elle garde qu'un titre souligne reste
              ATTEIGNABLE, pas qu'il porte le bon des deux faits. */}
          <h2 data-titre-ecran className={`text-2xl font-bold ${themeClasses.text}`}>
            Clients
          </h2>
          {/* Le compte. DEUX nombres et non un : le total ENREGISTRE ne bouge
              pas avec les filtres, le nombre AFFICHE est celui de la page en
              cours. Les confondre ferait croire a une perte de donnees des
              qu'on filtre. */}
          <p data-ecran-compte>
            {clients.length} client{clients.length > 1 ? 's' : ''} enregistré{clients.length > 1 ? 's' : ''}
            {' · '}
            {paginatedData.length} affiché{paginatedData.length > 1 ? 's' : ''}
          </p>
        </div>

        <div data-ecran-actions className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleImportClick}
            disabled={isImporting}
            data-rang="second"
            className={`${BASE_ACTION} ${classesDuRang('second', HISTORIQUE_IMPORTER)}`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 15V3" /><path d="m7 8 5-5 5 5" /><path d="M4 19h16" />
            </svg>
            {isImporting ? 'Import en cours...' : 'Importer (XLSM)'}
          </button>
          <button
            type="button"
            onClick={() => handleExport(filteredClients)}
            data-rang="second"
            className={`${BASE_ACTION} ${classesDuRang('second', HISTORIQUE_EXPORTER)}`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M4 19h16" />
            </svg>
            Exporter (XLSM){filteredClients.length > 0 && ` · ${filteredClients.length}`}
          </button>
          {/* ⟲ UN BOUTON SOUS L'IDENTITE, LE LIEN D'AVANT PARTOUT AILLEURS.
              ────────────────────────────────────────────────────────────────
              Ce controle etait un <Link to="/formulaire">, avec cette raison
              ecrite ici : « c'est une NAVIGATION, et un <button> la volerait au
              clic-milieu, au Ctrl+clic et au menu contextuel ».

              L'argument vaut TANT QUE c'est une navigation — et il vaut encore
              pour TAOFIC, dont l'ecran Formulaire existe toujours. Sous
              l'identite « registre », cet ecran a ete retire : l'ajout se fait
              dans une modale posee sur cette liste. Un <a href> qui n'emmene
              nulle part y promettrait au clic-milieu un onglet qui s'ouvrirait
              sur la liste qu'on regarde deja — il mentirait sur ce qu'il fait.

              Les deux formes portent le meme `data-rang` : l'apparence du bouton
              primaire ne change pas. Ce qui change, c'est ce que le controle EST
              — et donc ce que le navigateur en fait. */}
          {IS_REGISTRE ? (
            <button
              type="button"
              onClick={onAdd}
              data-rang="primaire"
              className={`${BASE_ACTION} ${classesDuRang('primaire')}`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14" /><path d="M5 12h14" />
              </svg>
              Ajouter un client
            </button>
          ) : (
            <Link
              to="/formulaire"
              data-rang="primaire"
              className={`${BASE_ACTION} ${classesDuRang('primaire')}`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14" /><path d="M5 12h14" />
              </svg>
              Ajouter un client
            </Link>
          )}
        </div>
      </div>

      {/* Input caché pour l'import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileImport}
        accept=".xlsx,.xlsm,.xls"
        style={{ display: 'none' }}
      />

      {/* LA BARRE DE FILTRES.
          ⚠ UN <form> ET UN BOUTON « Rechercher », alors que le filtrage est
          DEJA immediat a la frappe. Ce n'est pas un bouton decoratif : sans lui,
          la touche Entree dans un champ de recherche isole recharge la page sur
          certains navigateurs. Le `preventDefault` la neutralise, et le bouton
          donne une action explicite a qui en attend une. Le filtrage reste
          instantane — le bouton ne declenche rien de plus.

          ⚠ LES DEUX <label> SONT VISIBLES, donc l'`aria-label` du mois
          disparait : il etait la faute de mieux (constat Q4 de la boucle QA).
          Un nom accessible visible vaut toujours mieux qu'un nom cache. */}
      <form
        data-filtres
        data-cadre
        onSubmit={(e) => e.preventDefault()}
        className={`flex flex-wrap mb-6${IS_REGISTRE ? '' : ' gap-4 items-end'}`}
      >
        <div data-filtre-bloc>
          <label htmlFor="clients-filtre-mois" className={IS_REGISTRE ? undefined : LEGACY_LABEL}>Mois</label>
          <select
            id="clients-filtre-mois"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className={IS_REGISTRE ? undefined : LEGACY_CHAMP}
          >
            {MONTH_OPTIONS.map(month => (
              <option key={month} value={month}>{month}</option>
            ))}
          </select>
        </div>

        <div data-filtre-bloc data-filtre-bloc-large className={IS_REGISTRE ? undefined : 'flex-1 min-w-64'}>
          <label htmlFor="clients-filtre-recherche" className={IS_REGISTRE ? undefined : LEGACY_LABEL}>Rechercher</label>
          {/* ⚠ L'ICONE EST DANS LE CHAMP SOUS L'IDENTITE, ET NULLE PART HORS
              D'ELLE. `data-champ-icone` la superpose au champ ; sans regle, elle
              se poserait simplement AVANT lui, en debut de ligne. On ne la rend
              donc pas en `legacy` : une loupe orpheline a cote d'un champ de
              recherche n'aide personne, et l'ecran n'en avait pas. */}
          <span data-champ-icone className={IS_REGISTRE ? undefined : 'block'}>
            {IS_REGISTRE && (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" /><path d="M16.5 16.5 21 21" />
              </svg>
            )}
            <input
              id="clients-filtre-recherche"
              type="search"
              placeholder="Nom, prénom, code ou numéro agent (tous réseaux), numéro personnel…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={IS_REGISTRE ? undefined : `w-full ${LEGACY_CHAMP}`}
            />
          </span>
        </div>

        <button type="submit" data-rang="primaire" className={classesDuRang('primaire')}>Rechercher</button>
      </form>

      {/* Tableau */}
      {/* `tabIndex={0}` : une zone qui defile horizontalement DOIT etre focalisable,
          sinon ses colonnes de droite sont hors d'atteinte sans souris (axe
          `scrollable-region-focusable`, constat Q3). `role="region"` exige un nom
          accessible — d'ou l'aria-label, qui dit AUSSI a l'utilisateur ou il vient
          d'arriver quand le focus y entre. */}
      <div
        tabIndex={0}
        role="region"
        aria-label="Tableau des clients, defilement horizontal"
        className={`overflow-x-auto border ${themeClasses.tableHeader.split(' ')[1]} rounded`}
      >
        <table className="w-full border-collapse min-w-max">
          <thead>
            <tr className={themeClasses.tableHeader}>
              {TABLE_HEADERS.map(header => (
                <th key={header.key} className={`border ${themeClasses.tableHeader.split(' ')[1]} px-4 py-3 text-left text-base font-medium ${themeClasses.text} whitespace-nowrap ${header.width}`}>
                  {header.label}
                </th>
              ))}
              <th className={`border ${themeClasses.tableHeader.split(' ')[1]} px-4 py-3 text-center text-base font-medium ${themeClasses.text} whitespace-nowrap min-w-48`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((client, index) => (
              <TableRow
                key={client.id}
                client={client}
                index={index}
                onEdit={onEdit}
                onDelete={onDelete}
                onAccessCode={onAccessCode}
              />
            ))}
          </tbody>
        </table>
      </div>

      <Pagination {...paginationProps} />

      {filteredClients.length === 0 && (
        <p className="text-center text-gray-500 mt-4">Aucun client trouvé.</p>
      )}

      {/* Toasts */}
      <div className="fixed top-0 right-0 z-50 space-y-2 p-4">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </div>
  )
}

export default ClientsTable
