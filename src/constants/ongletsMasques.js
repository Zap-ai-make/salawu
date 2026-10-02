/**
 * ongletsMasques.js — quels circuits secondaires sont VISIBLES dans l'espace boutique.
 * ─────────────────────────────────────────────────────────────────────────────
 * Décision client du 2026-09-30 : ESAHAF ne veut plus voir, dans son interface,
 * les onglets des circuits qu'il n'utilise pas au quotidien.
 *
 *   Navigation   « Dettes internes »
 *   Transactions « Collaborations », « Envois dealer »
 *   Historique   « Opérations dealer », « Collaborations », « Dettes internes »
 *
 * ⚠ MASQUÉ, PAS SUPPRIMÉ — ET LA DISTINCTION EST LA RAISON D'ÊTRE DE CE FICHIER.
 *
 * Aucun écran, aucune route, aucun service, aucun test n'a été retiré. Les pages
 * `/store/debts` et les composants de collaboration existent toujours et
 * fonctionnent ; seuls les BOUTONS qui y menaient sont retirés de la vue. C'est
 * le même parti pris que le rail de soldes (décision du 2026-09-15) : le client
 * change d'avis plus vite qu'on ne réécrit un circuit financier, et un onglet
 * masqué se rallume en changeant UNE ligne ci-dessous.
 *
 * ⚠ CONSÉQUENCE POUR QUI PASSERA APRÈS : les composants, services et branches de
 * code devenus inatteignables depuis l'interface NE SONT PAS DU CODE MORT. Un
 * outil d'analyse les signalera comme inutilisés — c'est attendu, et CLAUDE.md
 * l'interdit explicitement comme motif de suppression. Leurs filets de test
 * restent verts et doivent le rester.
 *
 * ⚠ ET POUR TAOFIC : il est en production, mono-réseau, et n'a rien demandé. Le
 * drapeau suit `IS_REGISTRE`, comme le bandeau de marque, la bande des réserves
 * et la disposition de la navigation — une seule lecture de `profil.design`, et
 * jamais un identifiant de client.
 */

import { IS_REGISTRE } from './designSystem.js'

/**
 * Vrai quand les onglets des circuits secondaires (dealer, collaborations,
 * dettes internes) sont affichés. Faux sous l'identité « registre ».
 *
 * Nommé à l'AFFIRMATIF : les sites d'appel lisent
 * `{AFFICHER_CIRCUITS_SECONDAIRES && <button …>}`, ce qui se lit « on affiche
 * si… ». Un `MASQUER_…` aurait produit des doubles négations à chaque usage.
 */
export const AFFICHER_CIRCUITS_SECONDAIRES = !IS_REGISTRE
