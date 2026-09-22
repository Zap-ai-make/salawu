import { EXPORT_CONFIG } from './constants.js'
import { createExportData, generateExportFilename } from './helpers.js'

/**
 * Export XLSX de l'historique filtre.
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ EXTRAIT DE `ActionButtons` LE 2026-09-21, ET SANS RIEN CHANGER A SON
 * COMPORTEMENT. La maquette pose « Exporter en Excel » dans la TETE de l'ecran ;
 * le produit ne l'avait qu'en bas, dans la carte du tableau, a cote d'un bouton
 * d'import.
 *
 * Deplacer le bouton aurait separe l'export de l'import, qui se repondent.
 * Ecrire un second export aurait duplique la logique — et le jour ou les
 * colonnes changent, les deux fichiers auraient diverge en silence. On extrait
 * donc, et les deux boutons appellent LA MEME fonction.
 *
 * Elle rend un resultat plutot que d'afficher : c'est a l'appelant de dire ce
 * qu'il en fait, parce que les deux endroits n'annoncent pas de la meme facon.
 */
export async function exporterHistoriqueXLSX(filteredTransactions = []) {
  if (!filteredTransactions.length) {
    return { success: false, vide: true }
  }

  const exportData = createExportData(filteredTransactions)
  const XLSX = await import('xlsx')

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(exportData)
  ws['!cols'] = EXPORT_CONFIG.COLUMN_WIDTHS
  XLSX.utils.book_append_sheet(wb, ws, EXPORT_CONFIG.SHEET_NAME)
  XLSX.writeFile(wb, generateExportFilename(filteredTransactions.length))

  return { success: true, count: filteredTransactions.length }
}
