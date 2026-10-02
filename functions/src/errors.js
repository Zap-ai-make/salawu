/**
 * Codes d'erreur métier et leur correspondance HttpsError.
 * Les handlers lancent DealerRequestError ; index.js les convertit en HttpsError.
 */

export const HTTP_CODES = {
  UNAUTHENTICATED:          'unauthenticated',
  PROFILE_NOT_FOUND:        'permission-denied',
  PROFILE_INACTIVE:         'permission-denied',
  ROLE_FORBIDDEN:           'permission-denied',
  STORE_ID_REQUIRED:        'permission-denied',
  INVALID_REQUEST_ID:       'invalid-argument',
  REQUEST_NOT_FOUND:        'not-found',
  REQUEST_NOT_PENDING:      'failed-precondition',
  REQUEST_STORE_MISMATCH:   'permission-denied',
  INVALID_REQUEST_DATA:     'failed-precondition',
  INVALID_REJECTION_REASON: 'invalid-argument',
  BALANCE_NOT_FOUND:        'failed-precondition',
  INVALID_BALANCE_DATA:     'internal',
  BALANCE_OVERFLOW:         'failed-precondition',
  TRANSACTION_FAILED:       'internal',
  // Clôtures Dealer
  STORE_NOT_FOUND:              'not-found',
  STORE_INACTIVE:               'failed-precondition',
  INVALID_CLOSURE_DATA:         'invalid-argument',
  INVALID_CLOSURE_ID:           'invalid-argument',
  REASON_REQUIRED:              'invalid-argument',
  CLOSURE_ALREADY_EXISTS:       'failed-precondition',
  CLOSURE_NOT_FOUND:            'not-found',
  CLOSURE_STORE_MISMATCH:       'permission-denied',
  CLOSURE_NOT_PENDING:          'failed-precondition',
  // Règlements (settlements)
  SETTLEMENT_DRAFT_NOT_FOUND:   'not-found',
  SETTLEMENT_ALREADY_SETTLED:   'failed-precondition',
  SETTLEMENT_EXCEEDS_REMAINING: 'failed-precondition',
  REFUND_EXCEEDS_PAID:          'failed-precondition',
  INVALID_SETTLEMENT_AMOUNT:    'invalid-argument',
  INVALID_PAYMENT_METHOD:       'invalid-argument',
  SETTLEMENT_STORE_MISMATCH:    'permission-denied',
  SETTLEMENT_DATA_INVALID:      'invalid-argument',
  // Même clé d'idempotence, payload différent (montant ou méthode)
  IDEMPOTENCY_CONFLICT:         'failed-precondition',
  // Transferts boutique → dealer (retours de stock / liquidité)
  INVALID_TRANSFER_TYPE:        'invalid-argument',
  INVALID_TRANSFER_AMOUNT:      'invalid-argument',
  INVALID_TRANSFER_ID:          'invalid-argument',
  INVALID_TRANSFER_DATA:        'failed-precondition',
  TRANSFER_NOT_FOUND:           'not-found',
  TRANSFER_NOT_PENDING:         'failed-precondition',
  TRANSFER_DEALER_MISMATCH:     'permission-denied',
  INSUFFICIENT_STORE_BALANCE:   'failed-precondition',
  DEALER_NOT_FOUND:             'failed-precondition',
  MULTIPLE_DEALERS_ACTIVE:      'failed-precondition',
  // Approvisionnement de l'inventaire dealer
  INVALID_INVENTORY_RESOURCE:   'invalid-argument',
  INSUFFICIENT_DEALER_BALANCE:  'failed-precondition',
  // Dépôt partenaire (sous-dealer hors boîte)
  INVALID_PARTNER:              'invalid-argument',
  // Config Boutique × Réseau
  INVALID_STORE_ID:             'invalid-argument',
  INVALID_NETWORK_CONFIG:       'invalid-argument',
  // Collaborations inter-boutiques
  INVALID_OPERATION_TYPE:       'invalid-argument',
  INVALID_COLLABORATION_AMOUNT: 'invalid-argument',
  INVALID_COLLABORATION_ID:     'invalid-argument',
  INVALID_COLLABORATION_NETWORK:'invalid-argument',
  SAME_STORE_COLLABORATION:     'failed-precondition',
  CLIENT_NOT_FOUND:             'not-found',
  SUPPLIER_STORE_NOT_FOUND:     'not-found',
  SUPPLIER_NOT_PROVIDER:        'failed-precondition',
  INSUFFICIENT_SUPPLIER_BALANCE:'failed-precondition',
  COLLABORATION_NOT_FOUND:      'not-found',
  COLLABORATION_NOT_PENDING:    'failed-precondition',
  COLLABORATION_STORE_MISMATCH: 'permission-denied',
  // Dettes internes + règlement
  INVALID_DEBT_ID:              'invalid-argument',
  INVALID_SETTLEMENT_ID:        'invalid-argument',
  INVALID_SETTLEMENT_METHOD:    'invalid-argument',
  INVALID_IDEMPOTENCY_KEY:      'invalid-argument',
  DEBT_NOT_FOUND:               'not-found',
  DEBT_ALREADY_SETTLED:         'failed-precondition',
  DEBT_STORE_MISMATCH:          'permission-denied',
  SETTLEMENT_NOT_DECLARED:      'failed-precondition',
  SETTLEMENT_NOT_FOUND:         'not-found',
  SETTLEMENT_INSUFFICIENT_BALANCE: 'failed-precondition',
  // App mobile agents — génération du code d'accès
  MOBILE_APP_DISABLED:          'failed-precondition',
  INVALID_CLIENT_ID:            'invalid-argument',
  CLIENT_STORE_MISMATCH:        'permission-denied',
  AGENT_IDENTIFIER_REQUIRED:    'failed-precondition',
  // App mobile agents — connexion (agentSignIn)
  INVALID_LOGIN_INPUT:          'invalid-argument',
  INVALID_CREDENTIALS:          'permission-denied',
  ACCOUNT_LOCKED:               'resource-exhausted',
  // Limite de débit par IP sur l'endpoint public agentSignIn (voir agents/throttle.js).
  // Même famille qu'ACCOUNT_LOCKED : c'est une ressource épuisée, pas un refus d'identité.
  TOO_MANY_ATTEMPTS:            'resource-exhausted',
  // Emission du jeton personnalise impossible (agentSignIn). 'internal' est honnete :
  // c'est une defaillance serveur, pas un refus d'identite. Mais elle porte desormais
  // un NOM, la ou un 500 nu ne disait rien ni au client ni au journal.
  TOKEN_MINT_FAILED:            'internal',
  // Ravitaillements (storeSupplies) — crédit d'une carte réseau de la boutique.
  //
  // ⚠ SUPPLY_UNCHANGED est 'failed-precondition' et NON 'invalid-argument' :
  // corriger un ravitaillement vers son montant actuel n'est pas une saisie
  // invalide, c'est une opération sans objet. La distinction compte pour qui lit
  // les journaux — un flot d'invalid-argument ferait croire à un bug de formulaire.
  INVALID_SUPPLY_RESOURCE:      'invalid-argument',
  INVALID_SUPPLY_AMOUNT:        'invalid-argument',
  INVALID_SUPPLY_NETWORK:       'invalid-argument',
  INVALID_SUPPLY_ID:            'invalid-argument',
  INVALID_SUPPLY_REASON:        'invalid-argument',
  SUPPLY_NOT_FOUND:             'not-found',
  SUPPLY_STORE_MISMATCH:        'permission-denied',
  SUPPLY_ALREADY_CANCELLED:     'failed-precondition',
  SUPPLY_UNCHANGED:             'failed-precondition',
  // Corriger à la baisse ou annuler REPREND l'argent : si la carte a déjà été
  // dépensée, le solde ne peut pas devenir négatif. Cas métier réel, pas un bug.
  INSUFFICIENT_BALANCE_FOR_REVERSAL: 'failed-precondition',
}

export class DealerRequestError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'DealerRequestError'
    this.code = code
    this.httpCode = HTTP_CODES[code] ?? 'internal'
  }
}
