/**
 * designSystem.js — quel système visuel ce client utilise.
 * ─────────────────────────────────────────────────────────────────────────────
 * SEUL point du front qui lit `profil.design`. Tout le reste importe `DESIGN_SYSTEM`
 * ou `IS_REGISTRE` d'ici — jamais `activeProfile.design` directement, et jamais
 * l'identifiant du client. C'est ce qui rend la dissociation mécanique : pour
 * qu'une identité fuie vers un autre client, il faudrait modifier ce fichier.
 *
 * Deux systèmes coexistent pendant la refonte :
 *
 *   'legacy'   — apparence historique (thème 'dark' de src/constants/themes.js),
 *                police système, palette Tailwind par défaut. Défaut du pilote,
 *                donc rendu de TAOFIC strictement inchangé.
 *   'registre' — identité ESAHAF : jetons @theme (encre/papier/registre/filet/
 *                entrée/sortie), IBM Plex auto-hébergée, montants tabulaires.
 *
 * Un identifiant inconnu retombe sur 'legacy' : sur un profil mal configuré on
 * préfère l'apparence historique à une interface à moitié dessinée.
 */

import { activeProfile } from '../config/activeClientProfile.js'

const SYSTEMES_CONNUS = ['legacy', 'registre']

const declare = activeProfile.design?.system

export const DESIGN_SYSTEM = SYSTEMES_CONNUS.includes(declare) ? declare : 'legacy'

/**
 * Vrai quand ce client utilise l'identité « registre ».
 * À préférer à une comparaison de chaîne sur les sites d'appel.
 */
export const IS_REGISTRE = DESIGN_SYSTEM === 'registre'

/**
 * Classe posée sur <html> par src/main.jsx. Elle sert de portée CSS : les règles
 * de l'identité ne s'appliquent qu'à l'intérieur, ce qui garantit qu'un client
 * en 'legacy' ne peut pas en hériter par accident — même si une feuille de style
 * partagée les déclare.
 */
export const DESIGN_ROOT_CLASS = `design-${DESIGN_SYSTEM}`
