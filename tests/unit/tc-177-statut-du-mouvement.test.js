/**
 * TC-177 — la couleur d'un statut ne contredit jamais son mot.
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CE FILET GARDE
 *
 * `HistoriqueTable.jsx` peignait sa pastille de statut en vert, en dur, sans
 * jamais lire le statut. « Annulée » portait donc la couleur de « Validée ».
 *
 * Le banc navigateur le dénonce déjà (`etats-limites.spec.js`, « la couleur du
 * statut ne contredit pas le mot »), et il le fait sur les PIXELS — ce qui est
 * la seule preuve qui compte. Mais il demande un émulateur, un semis, une
 * connexion et deux minutes. Ce filet-ci tient la RÈGLE, en quelques
 * millisecondes, et il rougit sur la table de correspondance bien avant que
 * quiconque ouvre un navigateur. Les deux sont nécessaires ; aucun ne remplace
 * l'autre.
 *
 * ⚠ LE CAS QUI COMPTE LE PLUS EST LE DERNIER : un statut INCONNU ne doit
 * jamais hériter du vert. C'est par là que le défaut d'origine reviendrait, en
 * plus discret — une valeur venue de Firestore qu'on ne reconnaît pas, peinte
 * comme une réussite.
 */

import { describe, it, expect } from 'vitest'
import {
  PALIER_STATUT,
  palierDuStatut,
  cleDuStatut,
  formeDuStatut,
} from '../../src/utils/statutDuMouvement.js'
import { FIRESTORE_CONFIG } from '../../src/constants/firestoreConstants.js'

const { STATUS } = FIRESTORE_CONFIG

describe('TC-177 — le palier d’apparence d’un statut', () => {
  it('rend « Validée » seule en palier de réussite', () => {
    expect(cleDuStatut(STATUS.VALIDATED)).toBe('valide')
    for (const autre of [STATUS.PENDING, STATUS.REFUNDED, STATUS.CANCELLED]) {
      expect(cleDuStatut(autre), `« ${autre} » ne doit pas porter le vert`).not.toBe('valide')
    }
  })

  it('rend « Non Terminées » en attente — l’opération court encore', () => {
    expect(cleDuStatut(STATUS.PENDING)).toBe('attente')
  })

  it('rend « Remboursée » et « Annulée » en neutre : elles n’ont rien laissé', () => {
    // Décision documentée dans l'en-tête du module : ni l'une ni l'autre n'est
    // une réussite, ni un échec. Ce qui les sépare est le mot et la forme.
    expect(cleDuStatut(STATUS.REFUNDED)).toBe('neutre')
    expect(cleDuStatut(STATUS.CANCELLED)).toBe('neutre')
  })

  it('⚠ donne une FORME distincte à chacun des quatre statuts', () => {
    // C'est le troisième canal exigé par la maquette, et c'est LUI qui permet à
    // deux statuts de partager une teinte sans devenir indiscernables. Si ce
    // cas rougit parce que deux formes se sont rejointes, la teinte partagée
    // n'est plus défendable et il faut rouvrir la décision, pas le test.
    const formes = [STATUS.VALIDATED, STATUS.PENDING, STATUS.REFUNDED, STATUS.CANCELLED].map(
      (s) => formeDuStatut(s),
    )
    expect(new Set(formes).size, `formes rendues : ${formes.join(', ')}`).toBe(4)
  })

  it('⚠ AUCUN statut d’opération ne prend --echec', () => {
    // Le jeton porte son contrat dans src/index.css : « RÉSERVÉ à l'échec :
    // aucune opération normale ne le porte ». Annuler ou rembourser sont des
    // gestes normaux du comptoir. Ce cas empêche qu'un lot futur « simplifie »
    // la table en réattribuant le rouge par réflexe.
    for (const statut of Object.values(STATUS)) {
      expect(cleDuStatut(statut), `« ${statut} » ne doit pas porter --echec`).not.toBe('rejete')
    }
  })

  it('lit un libellé quelle que soit sa casse ou son accentuation', () => {
    // Les libellés voyagent : saisis à la main, importés d'un fichier, relus
    // d'un vieux document Firestore. La normalisation est celle que tout le
    // reste du produit emploie déjà (normalizeTransactionLabel).
    expect(cleDuStatut('validee')).toBe('valide')
    expect(cleDuStatut('VALIDÉE')).toBe('valide')
    expect(cleDuStatut('  Validée  ')).toBe('valide')
    expect(cleDuStatut('annulee')).toBe('neutre')
    expect(cleDuStatut('NON TERMINEES')).toBe('attente')
  })

  it('⚠ un statut INCONNU rend neutre, et jamais valide', () => {
    // Le cas par lequel le défaut d'origine reviendrait.
    for (const inconnu of ['', null, undefined, 'Échouée', 'Truc', 0, {}]) {
      expect(cleDuStatut(inconnu), `« ${String(inconnu)} » ne doit pas être vert`).toBe('neutre')
    }
  })

  it('rend toujours un objet gelé et complet', () => {
    const palier = palierDuStatut(STATUS.VALIDATED)
    expect(Object.isFrozen(palier)).toBe(true)
    expect(palier).toHaveProperty('cle')
    expect(palier).toHaveProperty('forme')
    expect(Object.isFrozen(PALIER_STATUT)).toBe(true)
  })
})
