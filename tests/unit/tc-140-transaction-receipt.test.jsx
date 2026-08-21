/**
 * TC-140 — Reçu de transaction (Dépôt / Retrait / Remboursement).
 *
 * Verrouille la présentation du reçu imprimable :
 *  - en-tête marque (APP_NAME, résolu depuis VITE_CLIENT_ID — jamais codé en dur) ;
 *  - nature affichée (Dépôt / Retrait), et « Remboursement » dérivé d'un Crédit remboursé ;
 *  - montant, client, réseau, N° reçu ;
 *  - bloc détail de règlement (payé / remboursé / restant) pour un crédit réglé.
 *
 * Le composant est purement présentationnel (aucun contexte requis).
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TransactionReceipt from '../../src/components/receipt/TransactionReceipt.jsx'
import ReceiptModal from '../../src/components/receipt/ReceiptModal.jsx'
import { APP_NAME } from '../../src/constants/branding.js'

// fr-FR insère des espaces insécables dans les montants — on normalise avant comparaison.
const norm = (s) => (s || '').replace(/\s/g, ' ')

const baseTx = (over = {}) => ({
  id: 'aBcD1234efGH5678',
  type: 'Dépôt',
  client: { prenom: 'Awa', nom: 'Traoré' },
  reseau: 'Orange Money',
  code: '07 12 34 56',
  montant: 10000,
  statut: 'Terminée',
  operatorName: 'Salif K.',
  storeName: 'Boutique El Hadj',
  date: '20/08/2026 14:32',
  ...over,
})

describe('TC-140 — Reçu de transaction', () => {
  it('affiche la marque, la nature, le client, le réseau et le montant (Dépôt)', () => {
    render(<TransactionReceipt transaction={baseTx()} />)

    // Marque active (ESAHAF pour salawu, marque par défaut en test taofic) — jamais codée en dur.
    expect(screen.getAllByText(APP_NAME).length).toBeGreaterThan(0)

    expect(norm(screen.getByTestId('receipt-nature').textContent)).toBe('Dépôt')
    expect(screen.getByText('Awa Traoré')).toBeInTheDocument()
    expect(screen.getByText('Orange Money')).toBeInTheDocument()
    expect(norm(screen.getByTestId('receipt-amount').textContent)).toContain('10 000 FCFA')

    // N° reçu dérivé de l'id (8 derniers, en majuscules, groupés).
    expect(norm(screen.getByTestId('receipt-number').textContent)).toContain('EFGH-5678')

    // Pas de bloc règlement pour un simple dépôt.
    expect(screen.queryByTestId('receipt-settlement')).not.toBeInTheDocument()
  })

  it('affiche la nature « Retrait »', () => {
    render(<TransactionReceipt transaction={baseTx({ type: 'Retrait' })} />)
    expect(norm(screen.getByTestId('receipt-nature').textContent)).toBe('Retrait')
  })

  it('dérive « Remboursement » pour un Crédit remboursé + détaille le règlement', () => {
    render(
      <TransactionReceipt
        transaction={baseTx({
          type: 'Crédit',
          montant: 10000,
          paidAmount: 6000,
          refundedAmount: 4000,
          remainingAmount: 0,
          settlementStatus: 'partial',
        })}
      />
    )

    expect(norm(screen.getByTestId('receipt-nature').textContent)).toBe('Remboursement')

    const settlement = screen.getByTestId('receipt-settlement')
    const text = norm(settlement.textContent)
    expect(text).toContain('Déjà payé')
    expect(text).toContain('6 000 FCFA')
    expect(text).toContain('Remboursé')
    expect(text).toContain('4 000 FCFA')
    expect(text).toContain('Reste')
  })

  it('un Crédit non remboursé reste « Crédit » (pas de dérivation)', () => {
    render(<TransactionReceipt transaction={baseTx({ type: 'Crédit', refundedAmount: 0 })} />)
    expect(norm(screen.getByTestId('receipt-nature').textContent)).toBe('Crédit')
  })

  // ── Non terminé partiellement payé (Dépôt/Retrait) — le cas signalé ──────────
  it('Retrait partiellement payé → détaille payé / reste (quel que soit le type)', () => {
    render(
      <TransactionReceipt
        transaction={baseTx({
          type: 'Retrait',
          montant: 50000,
          paidAmount: 15000,
          remainingAmount: 35000,
          settlementStatus: 'partial',
          statut: 'Non Terminées',
        })}
      />
    )
    const text = norm(screen.getByTestId('receipt-settlement').textContent)
    expect(text).toContain('Montant total')
    expect(text).toContain('Déjà payé')
    expect(text).toContain('15 000 FCFA')
    expect(text).toContain('Reste')
    expect(text).toContain('35 000 FCFA')
    // Remboursé = 0 → non affiché.
    expect(text).not.toContain('Remboursé')
  })

  it('non terminé SANS méthode → « Statut : Partiellement payé » (plus « Non Terminées »)', () => {
    render(
      <TransactionReceipt
        transaction={baseTx({ type: 'Retrait', settlementStatus: 'partial', statut: 'Non Terminées', paidAmount: 15000, remainingAmount: 35000 })}
      />
    )
    const receipt = norm(screen.getByTestId('transaction-receipt').textContent)
    expect(receipt).toContain('Partiellement payé')
    expect(receipt).not.toContain('Non Terminées')
  })

  it('avec paymentMethod → « Moyen de paiement : {méthode} » (comme l’historique)', () => {
    render(
      <TransactionReceipt
        transaction={baseTx({ type: 'Retrait', settlementStatus: 'partial', paymentMethod: 'Orange Money', paidAmount: 15000, remainingAmount: 35000 })}
      />
    )
    const receipt = norm(screen.getByTestId('transaction-receipt').textContent)
    expect(receipt).toContain('Moyen de paiement')
    expect(receipt).toContain('Orange Money')
  })

  it('transaction réglée (historique, paymentMethod présent) → pas de bloc détail', () => {
    render(
      <TransactionReceipt
        transaction={baseTx({ type: 'Dépôt', montant: 40000, paymentMethod: 'Cash', settlementStatus: 'settled', remainingAmount: 0 })}
      />
    )
    expect(screen.queryByTestId('receipt-settlement')).not.toBeInTheDocument()
    const receipt = norm(screen.getByTestId('transaction-receipt').textContent)
    expect(receipt).toContain('Moyen de paiement')
    expect(receipt).toContain('Cash')
  })
})

describe('TC-140 — ReceiptModal (aperçu + impression)', () => {
  it('rien tant que transaction est nulle', () => {
    render(<ReceiptModal transaction={null} onClose={() => {}} />)
    expect(screen.queryByTestId('receipt-modal')).not.toBeInTheDocument()
  })

  it('affiche le reçu, imprime via window.print, se ferme (bouton + Escape)', () => {
    const onClose = vi.fn()
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})
    render(<ReceiptModal transaction={baseTx()} onClose={onClose} />)

    const modal = screen.getByTestId('receipt-modal')
    expect(modal).toBeInTheDocument()
    expect(screen.getByTestId('transaction-receipt')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Imprimer/i }))
    expect(printSpy).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)

    printSpy.mockRestore()
  })
})
