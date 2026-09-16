/**
 * etats-du-banc.mjs — les ÉTATS que le banc QA doit savoir montrer.
 * ─────────────────────────────────────────────────────────────────────────────
 * Module de DONNÉES PURES : aucun effet de bord, aucune dépendance. C'est ce qui
 * lui permet d'être importé à la fois par le seed (Admin SDK, sous
 * `emulators:exec`) et par les specs Playwright. `seed-qa.mjs` ne peut pas jouer
 * ce rôle : il exécute son garde de sécurité au chargement, donc l'importer
 * depuis un test le ferait échouer — d'où les identifiants recopiés à la main
 * dans les specs existantes, avec la note « doit rester synchronisé ». Une note
 * n'est pas un mécanisme : ce fichier en est un.
 *
 *
 * POURQUOI UNE BOUTIQUE PAR ÉTAT, ET NON UN PARAMÈTRE D'URL
 * ─────────────────────────────────────────────────────────────────────────────
 * La première formulation de ce lot parlait de « variantes d'état par adresse »
 * (`?etat=vide`). C'est la mauvaise réponse, et pour une raison qui n'est pas de
 * goût : l'application devrait alors LIRE ce paramètre. Cela veut dire un chemin
 * de code qui n'existe que pour le banc, donc un chemin que personne ne relit,
 * embarqué dans un produit en service chez un client réel. Le banc n'a aucune
 * raison d'être connu du produit.
 *
 * Un état est donc une BOUTIQUE, avec son propre compte et ses propres données.
 * L'application ne fait rien de particulier : elle affiche ce qu'elle trouve.
 * Effet secondaire recherché : quatre boutiques peuplées différemment dans la
 * même collection `globalClients` mettent le cloisonnement Firestore à
 * l'épreuve bien mieux que deux.
 *
 *
 * CE QUE CES ÉTATS SERVENT À VOIR
 * ─────────────────────────────────────────────────────────────────────────────
 * L'état vide est celui qu'on dessine le plus soigneusement et qu'on regarde le
 * moins. Le banc l'a prouvé au lot précédent, dans l'autre sens : l'écran
 * Clients passait la boucle QA depuis le début… à vide. Captures d'un « Aucun
 * client trouvé. », axe sans une seule ligne de tableau à analyser, sonde de
 * débordement sans aucune des quatorze colonnes à mesurer. Trois passes vertes
 * qui ne prouvaient rien. Le jour où le banc a semé des clients, huit défauts
 * d'accessibilité sont apparus d'un coup — ils étaient là depuis toujours.
 *
 * Le même piège existe à l'envers, et c'est celui-ci qu'on ferme maintenant :
 * une boucle qui ne regarde QUE des écrans pleins ne voit jamais ce que voit un
 * gérant le premier jour, ni ce que voit un caissier quand une opération reste
 * en suspens.
 *
 *
 * ⚠ RÈGLE DE FABRICATION : on ne sème que des états que le PRODUIT sait produire.
 * Le vocabulaire des statuts est celui de `src/constants/firestoreConstants.js`
 * (STATUS) — « Non Terminées », « Validée », « Remboursée », « Annulée ». Il n'y
 * a pas de statut « Échouée » dans ce logiciel, et en inventer un aurait fabriqué
 * un défaut imaginaire : le banc aurait signalé un écran mal dessiné pour une
 * donnée qui ne peut pas exister. Un banc qui ment coûte plus cher qu'un banc
 * absent.
 */

/** Statuts réellement écrits par l'application (firestoreConstants.js:40-45). */
export const STATUTS = Object.freeze({
  ATTENTE: 'Non Terminées',
  VALIDEE: 'Validée',
  REMBOURSEE: 'Remboursée',
  ANNULEE: 'Annulée',
})

/**
 * Types réellement proposés au caissier (config/clients/salawu.js:54).
 * ⚠ Avec leurs ACCENTS : `directionFromType` normalise, mais
 * `TRANSACTION_STYLES` (constants.js:32) indexe sur la chaîne exacte. Le premier
 * jet de ce banc écrivait « Depot », qui retombait donc sur le style par défaut :
 * les captures montraient un rendu que l'application ne produit jamais.
 */
export const TYPES = Object.freeze({ DEPOT: 'Dépôt', RETRAIT: 'Retrait' })

const PRENOMS = ['Aminata', 'Issa', 'Salif', 'Mariam', 'Boukare', 'Fatou', 'Paul', 'Alizeta', 'Rasmane', 'Kadiatou']
const NOMS = ['OUEDRAOGO', 'SAWADOGO', 'KABORE', 'TRAORE', 'ZONGO', 'COMPAORE', 'NIKIEMA', 'ZABSONRE', 'ILBOUDO', 'SORE']
const LOCALITES = ['Ouagadougou', 'Bobo-Dioulasso', 'Koudougou', 'Banfora', 'Ouahigouya']

/**
 * Le jeu de clients DENSE : trois cas limites, puis du volume.
 * Montants et longueurs délibérément inégaux — un jeu uniforme cacherait
 * justement le défaut que les chiffres tabulaires sont censés corriger.
 */
function clientsDenses(boutiqueId, boutiqueNom) {
  const liste = []

  liste.push({
    // Le nom le plus long du jeu : c'est lui qui tronque « FCFA » à 390 px.
    registeredStoreId: boutiqueId,
    registeredStoreName: boutiqueNom,
    nom: 'OUEDRAOGO/KABORE',
    prenom: 'Wendkuuni Alizeta',
    numeroIdentite: 'B10240031',
    numeroPersonnel: '70112233',
    orange: '1004500',
    moov: '1004813',
    numerosAgent: { orange: '70112233', moov: '70113344' },
    localite: 'Ouagadougou — Zone du Bois, Secteur 13',
    agentCommercial: 'ZABSONRE Alizeta',
    dateAjout: '15/09/2026',
  })
  liste.push({
    // Client importé avant le cloisonnement : la cellule doit rendre
    // « Ancienne base » et non une case blanche.
    registeredStoreId: boutiqueId,
    registeredStoreName: null,
    nom: 'ZONGO',
    prenom: 'Boukare',
    numeroIdentite: 'B10190877',
    numeroPersonnel: '76445566',
    sank: '1005752',
    numerosAgent: { sank: '76445566' },
    localite: 'Bobo-Dioulasso',
    agentCommercial: 'SAWADOGO Issa',
    dateAjout: '03/04/2026',
  })
  liste.push({
    // Un seul réseau renseigné : cinq colonnes de code agent restent vides.
    registeredStoreId: boutiqueId,
    registeredStoreName: boutiqueNom,
    nom: 'TRAORE',
    prenom: 'Salimata',
    numeroIdentite: 'B10221145',
    numeroPersonnel: '70998877',
    wave: '1006210',
    numerosAgent: {},
    localite: 'Koudougou',
    agentCommercial: 'ZABSONRE Alizeta',
    dateAjout: '15/09/2026',
  })

  // Puis du volume : la pagination par défaut est de 10 par page, donc trente
  // lignes donnent trois pages. Un écran vérifié à trois lignes ne prouve rien.
  for (let i = 0; i < 27; i += 1) {
    const reseau = ['orange', 'moov', 'telecel', 'coris', 'sank', 'wave'][i % 6]
    liste.push({
      registeredStoreId: boutiqueId,
      registeredStoreName: boutiqueNom,
      nom: NOMS[i % NOMS.length],
      prenom: PRENOMS[(i + 3) % PRENOMS.length],
      numeroIdentite: `B102${String(40000 + i * 7).slice(0, 5)}`,
      numeroPersonnel: `7${String(1000000 + i * 13579).slice(0, 7)}`,
      [reseau]: String(1004000 + i * 37),
      numerosAgent: { [reseau]: `7${String(2000000 + i * 24680).slice(0, 7)}` },
      localite: LOCALITES[i % LOCALITES.length],
      agentCommercial: `${NOMS[(i + 5) % NOMS.length]} ${PRENOMS[i % PRENOMS.length]}`,
      dateAjout: `${String((i % 28) + 1).padStart(2, '0')}/0${(i % 9) + 1}/2026`,
    })
  }

  return liste
}

/** Deux clients : une seule page, aucun bouton de pagination à dessiner. */
function clientsClairsemes(boutiqueId, boutiqueNom) {
  return [
    {
      registeredStoreId: boutiqueId,
      registeredStoreName: boutiqueNom,
      nom: 'SAWADOGO',
      prenom: 'Issa',
      numeroIdentite: 'B10250001',
      numeroPersonnel: '70000001',
      orange: '1004500',
      numerosAgent: { orange: '70000001' },
      localite: 'Ouagadougou',
      agentCommercial: 'NIKIEMA Paul',
      dateAjout: '14/09/2026',
    },
    {
      registeredStoreId: boutiqueId,
      registeredStoreName: boutiqueNom,
      nom: 'ILBOUDO',
      prenom: 'Kadiatou',
      numeroIdentite: 'B10250002',
      numeroPersonnel: '70000002',
      moov: '1004813',
      numerosAgent: { moov: '70000002' },
      localite: 'Banfora',
      agentCommercial: 'NIKIEMA Paul',
      dateAjout: '15/09/2026',
    },
  ]
}

/**
 * Des clients à TROUS — et uniquement des trous que l'application sait rencontrer.
 * Chacun correspond à un repli déjà écrit dans le code (`|| '-'`,
 * « Ancienne base ») : si l'écran les rend mal, c'est bien le dessin qui manque,
 * pas la donnée qui est absurde.
 */
function clientsAvecTrous(boutiqueId, boutiqueNom) {
  return [
    {
      registeredStoreId: boutiqueId,
      registeredStoreName: null, // → « Ancienne base »
      nom: 'COMPAORE',
      prenom: 'Fatou',
      numeroIdentite: 'B10230414',
      numeroPersonnel: '76112200',
      orange: '1004500',
      // ni `numerosAgent`, ni `localite`, ni `agentCommercial`
      dateAjout: '22/07/2026',
    },
    {
      registeredStoreId: boutiqueId,
      registeredStoreName: boutiqueNom,
      nom: 'ZABSONRE',
      prenom: 'Rasmane',
      numeroIdentite: 'B10231180',
      numeroPersonnel: '65330011',
      numerosAgent: {},
      localite: 'Ouahigouya',
      agentCommercial: 'TRAORE Mariam',
      dateAjout: '09/08/2026',
    },
  ]
}

const HISTORIQUE_DENSE = [
  { client: { nom: 'OUEDRAOGO', prenom: 'Aminata' }, type: TYPES.DEPOT, reseau: 'Orange', code: '70112233', montant: 1_250_000, statut: STATUTS.VALIDEE },
  { client: { nom: 'SAWADOGO', prenom: 'Issa' }, type: TYPES.RETRAIT, reseau: 'Moov', code: '60998877', montant: 87_500, statut: STATUTS.VALIDEE },
  { client: { nom: 'KABORE', prenom: 'Salif' }, type: TYPES.DEPOT, reseau: 'Coris', code: '65004411', montant: 940_000, statut: STATUTS.VALIDEE },
  { client: { nom: 'TRAORE', prenom: 'Mariam' }, type: TYPES.RETRAIT, reseau: 'Sank', code: '55220099', montant: 12_300, statut: STATUTS.VALIDEE },
  { client: { nom: 'ZONGO', prenom: 'Boukare' }, type: TYPES.DEPOT, reseau: 'Wave', code: '76543210', montant: 5_000, statut: STATUTS.VALIDEE },
  { client: { nom: 'COMPAORE', prenom: 'Fatou' }, type: TYPES.RETRAIT, reseau: 'Orange', code: '70445566', montant: 250, statut: STATUTS.VALIDEE },
  { client: { nom: 'NIKIEMA', prenom: 'Paul' }, type: TYPES.DEPOT, reseau: 'Telecel', code: '51122334', montant: 3_400_000, statut: STATUTS.VALIDEE },
]

/**
 * L'historique DÉGRADÉ : les quatre statuts que l'application écrit réellement,
 * plus une ligne d'import ancien sans réseau (repli `|| '-'`, HistoriqueTable:60).
 *
 * C'est l'état qui vérifie la première des exigences non négociables : aucune
 * couleur ne porte seule une information. Quatre statuts distincts doivent se
 * distinguer autrement que par une teinte — et surtout, la teinte ne doit pas
 * CONTREDIRE le mot.
 */
const HISTORIQUE_DEGRADE = [
  { client: { nom: 'COMPAORE', prenom: 'Fatou' }, type: TYPES.DEPOT, reseau: 'Orange', code: '70112233', montant: 75_000, statut: STATUTS.VALIDEE },
  { client: { nom: 'ZABSONRE', prenom: 'Rasmane' }, type: TYPES.RETRAIT, reseau: 'Moov', code: '60998877', montant: 150_000, statut: STATUTS.ATTENTE },
  { client: { nom: 'COMPAORE', prenom: 'Fatou' }, type: TYPES.RETRAIT, reseau: 'Telecel', code: '51122334', montant: 40_000, statut: STATUTS.ANNULEE },
  { client: { nom: 'ZABSONRE', prenom: 'Rasmane' }, type: TYPES.DEPOT, reseau: 'Coris', code: '65004411', montant: 9_500, statut: STATUTS.REMBOURSEE },
  // Ligne importée avant que le réseau ne soit obligatoire : la cellule doit
  // rendre « - » et non une case blanche au milieu du tableau.
  { client: { nom: 'COMPAORE', prenom: 'Fatou' }, type: TYPES.DEPOT, reseau: null, code: '', montant: 61_200, statut: STATUTS.VALIDEE },
]

/** Six réseaux garnis, dont un à zéro (Telecel) : la rupture de stock existe. */
const SOLDES_DENSES = [
  { reseau: 'Orange', stock: 1_250_000 },
  { reseau: 'Moov', stock: 87_500 },
  { reseau: 'Telecel', stock: 0 },
  { reseau: 'Coris', stock: 940_000 },
  { reseau: 'Sank', stock: 12_300 },
  { reseau: 'Wave', stock: 5_000 },
]

/** Deux réseaux seulement : les quatre autres n'ont AUCUNE entrée dans la map. */
const SOLDES_CLAIRSEMES = [
  { reseau: 'Orange', stock: 45_000 },
  { reseau: 'Moov', stock: 8_000 },
]

/**
 * Deux opérations, sur les deux seuls réseaux garnis, à des montants qui tiennent
 * dans ces stocks. Première rédaction : les deux premières lignes de l'historique
 * DENSE, dont un dépôt de 1 250 000 sur une boutique qui affiche 45 000 de stock.
 * L'application ne recalcule pas les soldes depuis l'historique, donc rien
 * n'aurait protesté — mais une capture d'écran incohérente se lit, et un banc
 * qu'on cesse de croire ne sert plus à rien.
 */
const HISTORIQUE_CLAIRSEME = [
  { client: { nom: 'SAWADOGO', prenom: 'Issa' }, type: TYPES.DEPOT, reseau: 'Orange', code: '70000001', montant: 25_000, statut: STATUTS.VALIDEE },
  { client: { nom: 'ILBOUDO', prenom: 'Kadiatou' }, type: TYPES.RETRAIT, reseau: 'Moov', code: '70000002', montant: 3_500, statut: STATUTS.VALIDEE },
]

/** Cinq réseaux garnis, un épuisé : la carte « Orange » doit dire la rupture. */
const SOLDES_DEGRADES = [
  { reseau: 'Orange', stock: 0 },
  { reseau: 'Moov', stock: 310_000 },
  { reseau: 'Telecel', stock: 4_500 },
  { reseau: 'Coris', stock: 128_000 },
  { reseau: 'Sank', stock: 64_000 },
  { reseau: 'Wave', stock: 900 },
]

/**
 * Les états du banc, dans l'ordre où on les regarde.
 *
 * `soldes: null` n'est PAS « tous les réseaux à zéro » : c'est l'ABSENCE du
 * document `networkBalances/current`. Les deux se ressemblent à l'écran et ne se
 * ressemblent pas du tout dans le code — le premier jour d'une boutique, ce
 * document n'existe pas encore, et c'est ce chemin-là qu'on veut voir rendu.
 */
export const ETATS = Object.freeze({
  dense: {
    libelle: 'DENSE — trois pages de clients, six réseaux, sept opérations validées',
    compte: {
      email: 'qa.esahaf@example.test',
      motDePasse: 'QaEsahaf!2026',
      boutiqueId: 'qa-boutique-ouaga',
      boutiqueNom: 'ESAHAF QA OUAGA',
    },
    soldes: SOLDES_DENSES,
    clients: clientsDenses,
    historique: HISTORIQUE_DENSE,
  },

  vide: {
    libelle: "VIDE — premier jour : le compte existe, rien n'a encore été saisi",
    compte: {
      email: 'qa.vide@example.test',
      motDePasse: 'QaVide!2026',
      boutiqueId: 'qa-boutique-vide',
      boutiqueNom: 'ESAHAF QA BOUTIQUE NEUVE',
    },
    soldes: null, // absence du document, et non des zéros
    clients: () => [],
    historique: [],
  },

  clairseme: {
    libelle: 'CLAIRSEMÉ — deux clients, deux opérations, deux réseaux sur six',
    compte: {
      email: 'qa.clairseme@example.test',
      motDePasse: 'QaClairseme!2026',
      boutiqueId: 'qa-boutique-clairseme',
      boutiqueNom: 'ESAHAF QA DÉBUT DE MOIS',
    },
    soldes: SOLDES_CLAIRSEMES,
    clients: clientsClairsemes,
    historique: HISTORIQUE_CLAIRSEME,
  },

  'erreur-partielle': {
    libelle: 'ERREUR PARTIELLE — quatre statuts, un réseau épuisé, des champs manquants',
    compte: {
      email: 'qa.erreur@example.test',
      motDePasse: 'QaErreur!2026',
      boutiqueId: 'qa-boutique-erreur',
      boutiqueNom: 'ESAHAF QA JOURNÉE DIFFICILE',
    },
    soldes: SOLDES_DEGRADES,
    clients: clientsAvecTrous,
    historique: HISTORIQUE_DEGRADE,
  },
})

/**
 * La boutique TÉMOIN n'est pas un état : elle n'est jamais visitée. Elle existe
 * pour qu'une requête mal cloisonnée ait quelque chose à laisser fuir. Son
 * facteur de 7 rend la fuite immédiatement lisible sur une capture.
 */
export const TEMOIN = Object.freeze({
  compte: {
    email: 'qa.temoin@example.test',
    motDePasse: 'QaTemoin!2026',
    boutiqueId: 'qa-boutique-temoin',
    boutiqueNom: 'BOUTIQUE TÉMOIN',
  },
  facteurSoldes: 7,
  soldes: SOLDES_DENSES,
  clients: clientsDenses,
})

/** Le montant qui ne doit JAMAIS apparaître ailleurs : 1 250 000 × 7. */
export const MONTANT_TEMOIN = 8_750_000

export const CLES_ETATS = Object.freeze(Object.keys(ETATS))
