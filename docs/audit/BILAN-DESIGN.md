# Bilan d'audit — Interface ESAHAF

> Statut : **bilan d'audit**, aucune correction appliquée. Livrable du point d'arrêt n°1
> d'`ADOPTION.md` §3 : le périmètre des lots doit être validé avant toute modification.
>
> Périmètre : la couche présentation du profil `salawu` (ESAHAF). Le comportement métier,
> les règles Firestore et les Cloud Functions sont hors sujet. TAOFIC (`taofic-ajagbe`,
> en production) doit rester inchangé bit pour bit.
>
> Date : 2026-09-02 · Référentiels : `docs/DESIGN.md`, `docs/AGENTS2.md`, `docs/ECC.md`

## 1. Synthèse

Le code de cette application est mûr : services découpés, hooks isolés, une centaine de
tests, audits croisés antérieurs, et des commentaires qui expliquent les décisions plutôt
que de paraphraser le code. La couche présentation, elle, n'a jamais été conçue — elle
s'est accumulée.

Le constat central est simple et il explique tous les autres : **il n'existe aucun système
de design**. Pas de police chargée (`src/index.css:11` déclare `system-ui`), pas de bloc
`@theme`, pas un seul jeton. À la place, cinq fichiers de constantes se disputent la
définition des couleurs, chacun en palette Tailwind par défaut. Une interface sans jetons
ne peut pas être cohérente : elle ne peut qu'être la moyenne des valeurs par défaut de son
framework. C'est très exactement la définition du « générique ».

Deux référentiels indépendants nomment les mêmes symptômes dans ce dépôt. `DESIGN.md` §1
bannit les dégradés violet/indigo génériques : `src/constants/authStyles.js:38` sert
`bg-gradient-to-br from-blue-50 to-indigo-100` sur la page de connexion. La compétence
`design-system` du dépôt ECC liste comme marqueurs de génération automatique les
« purple-to-blue defaults » et la « sans-serif font stack with no personality » : les deux
sont présents. Le diagnostic n'est donc pas une affaire de goût.

Ce qui inquiète davantage que l'esthétique, c'est que **plusieurs défauts de forme sont
devenus des défauts d'usage**. Cette application est utilisée debout, sur un téléphone
Android d'entrée de gamme, en plein soleil, par des gens qui manipulent de l'argent réel.
Or 61 occurrences de texte gris tombent sous le seuil de contraste AA (jusqu'à 1,47:1 pour
un seuil requis de 4,5:1), 11 des 16 surfaces de recouvrement ne se ferment pas à `Escape`,
aucun montant n'est en chiffres tabulaires dans une application dont les montants sont le
contenu, et un décor de 1,8 Mo est précaché dans une PWA destinée à des agents de terrain à
connexion instable. Ce ne sont pas des finitions : ce sont des obstacles au travail.

Le point positif, et il est décisif pour le coût du chantier : **presque tout se corrige
par les primitives partagées**. Les écrans consomment déjà `StatCard`, `DashboardCard`,
`PageHeader`, `EmptyState`, `themedTable`. Réécrire une dizaine de fichiers propage la
direction aux quarante et quelques écrans sans les toucher. Le travail est concentré, pas
diffus.

Niveau global vis-à-vis des trois contrats : `SECURITY.md` et `ARCHITECTURE.md` sont
globalement respectés par cette couche (elle ne touche ni aux données ni aux accès).
**`DESIGN.md` est en défaut sur trois de ses quatre non-négociables** — emoji bruts (§8),
états manquants (§10), accessibilité (§11) — le quatrième (hygiène technique, §13) l'étant
partiellement.

## 2. Constats classés

Format : zone·fichier · problème · correction proposée · effort (S/M/L).

### CRITIQUE

| # | Zone · fichier | Problème | Correction | Effort |
|---|---|---|---|---|
| C1 | `src/index.css:11` | Aucun système de design : `font-family: system-ui`, aucun bloc `@theme`, aucun jeton. Tout le reste en découle. | Bloc `@theme` Tailwind v4 + `design-tokens.json` en miroir. | M |
| C2 | 25 fichiers, 61 occurrences de `text-gray-400` / `text-gray-300` | Contraste **2,54:1** et **1,47:1** sur fond blanc, pour un seuil AA de 4,5:1. Texte illisible dans le contexte d'usage réel (plein soleil). Violation `DESIGN.md` §5/§11. | Remplacer par un jeton de texte secondaire ≥ 4,5:1. | M |
| C3 | 30 sites JSX (liste §3) | **Emoji bruts rendus dans l'UI**. Non-négociable `DESIGN.md` §8, « le tic le plus visible de l'IA ». Rendu variable selon l'OS, non stylable, sémantique nulle pour un lecteur d'écran. | Icônes lucide, `aria-hidden` si décoratives, nom accessible sinon. | M |
| C4 | 10 des 15 surfaces de recouvrement | Pas de fermeture par `Escape` ; `role="dialog"` sur 9 seulement ; un seul fichier piégeait le focus, aucun ne le restituait. Violation `DESIGN.md` §11 et WCAG 2.2 AA. | Hook partagé : `Escape`, piège de focus, restitution du focus au déclencheur. | M |
| C5 | `src/constants/authStyles.js:38` | `from-blue-50 to-indigo-100` — le dégradé indigo générique nommément banni par `DESIGN.md` §1, sur le premier écran que voit l'utilisateur. | Dériver de la direction §4. | S |

### IMPORTANT

| # | Zone · fichier | Problème | Correction | Effort |
|---|---|---|---|---|
| I1 | `themes.js`, `styles/themes.css`, `dashboardTheme.js`, `workspaceTheme.js`, `authStyles.js` | **Cinq sources de vérité concurrentes** pour la couleur, mutuellement incohérentes : `workspaceTheme.js:16-23` code en dur une marque verte AKAYIS alors que le profil ESAHAF déclare `theme: 'orange'`. | Effondrer sur les jetons `@theme`. | L |
| I2 | `src/context/ThemeContext.jsx:32` | **Les 7 thèmes sont du code mort** : aucun `.jsx` n'appelle `changeTheme`, il n'existe aucun sélecteur. Le thème `custom` génère une classe arbitraire que le JIT Tailwind ne peut jamais émettre — cassée par construction. C'est ce système inutilisé qui impose la palette générique. | Retirer via le protocole de suppression de `CLAUDE.md`, derrière un axe `design` du profil. | M |
| I3 | Toute l'application — 0 occurrence de `tabular-nums` | Application 100 % financière dont les montants ne s'alignent pas en colonne. Violation directe `DESIGN.md` §4. Un caissier compare des montants toute la journée. | Jeton typographique mono + `font-variant-numeric: tabular-nums`. | S |
| I4 | `src/components/Layout.jsx:38-88` · `public/bg-noir.png` | **1,8 Mo de décor**, chargé deux fois (header 200 px + calque `opacity-5`), en `background-attachment: fixed` (coûteux au scroll mobile), précaché par le service worker. Zéro information portée. Anti-patterns ECC `frontend-design-direction` : « generic oversized hero text », « hiding the primary product behind marketing sections ». | Retirer ; remplacer par un bandeau de solde utile. | M |
| | | ⚠ **Constat maintenu, correction ANNULÉE par le client le 2026-09-04.** Le bandeau photo a été rétabli après qu'il l'a vu retiré. La mesure reste vraie (précache ESAHAF : 2242 → 4006 Ko) ; l'arbitrage entre poids et identité visuelle appartient au client. Cf. §8. | — |
| I5 | ~~49 lignes `focus:outline-none` sans `focus-visible`~~ | **Constat surévalué, corrigé à la vérification.** Sur 50 lignes, **une seule** perd réellement le focus (`NavBar.jsx:157`, un `select` sans aucun indicateur). 45 portent bien un indicateur, écrit en `focus:` au lieu de `focus-visible:` — raffinement, pas défaut. 3 étaient des faux positifs (l'indicateur est sur la ligne suivante du littéral de classes). 1 est volontaire et correct (`tabIndex={-1}` sur une zone `role="status"` focalisée par programme, qui ne doit pas afficher d'anneau). | La violation réelle est corrigée ; les 45 `focus:` → `focus-visible:` passent en backlog MINEUR. | S |
| I6 | `src/components/network/NetworkCard.jsx:31-52` | **Statut porté par la couleur seule** : `low` (< 10 000) et `warning` (< 25 000) ne diffèrent de `normal` que par la teinte ; seul `critical` porte le libellé « Bas ». Violation `DESIGN.md` §5 et anti-pattern ECC `accessibility`. | Un libellé texte par palier. | S |
| I7 | `tests/components/` — **un seul test** | Aucun filet de sécurité au rendu. Toucher les primitives partagées sans test de caractérisation, c'est modifier à l'aveugle. | Tests de rendu figeant la sortie actuelle, **avant** le Lot 2. | M |

### MINEUR

| # | Zone · fichier | Problème | Correction | Effort |
|---|---|---|---|---|
| M1 | `tailwind.config.js` | **Fichier mort** : Tailwind v4 via `@tailwindcss/vite`, aucun `@config` dans le CSS, aucune référence dans le dépôt. La `safelist` de 30 classes ne protège rien — elle donne une fausse assurance à qui composerait des classes dynamiquement. | Supprimer via le protocole `CLAUDE.md`. | S |
| M2 | `vite.config.js:97` | `globPatterns` n'inclut pas `woff2`. Bloquant **dès qu'on ajoutera des polices** : elles casseraient hors-ligne, en contradiction avec `offlineMode` du profil salawu. | Ajouter `woff2` en même temps que les polices. | S |
| M3 | Aucune occurrence de `prefers-reduced-motion` | Violation `DESIGN.md` §9. | Bloc global. | S |
| M4 | `src/components/ui/themedTable.js:33` | La bordure est déduite en **parsant une chaîne de classes**. Le commentaire du fichier documente déjà la fragilité de l'idiome précédent. Contrat implicite qui casse dès qu'on retire les thèmes. | Jeton explicite. À traiter en tête du Lot 2. | S |
| M5 | `src/pages/admin/AdminDashboard.jsx` | 9 tuiles de statistiques sans hiérarchie. Principe ECC `dashboard-builder` : « the goal is not *show every metric* » — chaque panneau doit répondre à une question d'exploitation. | Réduire à ce qui répond à « combien il reste, qu'est-ce qui bloque ». | M |
| M6 | `docs/AGENTS2.md`, bloc « Le projet » | Décrit « C2EGF BURKINA » (mono-réseau Orange, sans production) au lieu d'ESAHAF (6 réseaux, `salawu-fa726`, en service). Instance sœur du même produit : la méthode vaut, la description non. | Réécrire le bloc. | S |
| M7 | `docs/ECC.md` §2-3 | Ne recense que des agents de revue de code ; **omet tous les composants de design** du dépôt officiel (`design-system`, `frontend-design-direction`, `accessibility`, `browser-qa`, `a11y-architect`). | Compléter. | S |

## 3. Inventaire des emoji (constat C3)

| Fichier · ligne | Emoji |
|---|---|
| `components/agents/AgentAccessCodeModal.jsx:71` | ⚠ |
| `components/dealer/DealerInventoryBar.jsx:158,163,167,168` | 📦 💵 📦 💵 |
| `components/receipt/ReceiptModal.jsx:48` | 🖨 |
| `components/Toast.jsx:35` | ⚠ |
| `components/transactions/TransactionForm.jsx:63,458,465` | ⚠️ 💡 ⚠️ |
| `pages/admin/AdminDashboard.jsx:97,226,232,238,245,251,258,272,279,286` | 📭 🏪 ✅ ⚠️ 👤 👥 📋 🏪 👥 📊 |
| `pages/admin/AdminDealerInventory.jsx:96,109,114,118,119` | ⚠️ 📦 💵 📦 💵 |
| `pages/dealer/DealerDashboard.jsx:86,109,114,121,124` | 👋 🏪 📋 📥 📊 |

Plus **9 flèches typographiques** employées comme icônes de pagination et de navigation,
à reprendre dans le même mouvement.

## 4. Direction proposée

Le détail et la justification figurent dans le plan de chantier. En résumé :

L'ancrage n'est pas décoratif. Ces boutiques tenaient un **cahier de caisse** à deux
colonnes avant ce CRM, et l'application le remplace ; le code couleur entrée/sortie existe
d'ailleurs déjà dans le produit (commit `55812b4`), simplement jamais dessiné. La direction
formalise ce qui est déjà vrai du métier au lieu d'inventer un thème.

Ton : **dense, silencieux, scannable** — un outil de travail, pas une vitrine.

| Jeton | Valeur | Rôle | Contraste sur `--papier` |
|---|---|---|---|
| `--encre` | `#15202B` | Texte, wordmark — **repris du logo ESAHAF** | **16,49:1** |
| `--papier` | `#FFFFFF` | Fond | — |
| `--registre` | `#ECE9E3` | Filets, zébrage — jamais un aplat de fond | 1,21:1 — décor seul |
| `--filet-fort` | `#8F897D` | Bordures d'entrée, anneaux de focus | **3,48:1** (WCAG 1.4.11) |
| `--entree` | `#0F6E3F` | Entrée d'argent | **6,32:1** |
| `--sortie` | `#B3400F` | Sortie d'argent | **5,74:1** |

Les 6 couleurs opérateur de `src/constants/networkConfig.js` restent l'unique vocabulaire
chromatique supplémentaire : elles portent une identité réelle, pas une décoration.

### Les couleurs de la marque ne peuvent pas devenir des jetons d'interface

Le logo ESAHAF (`branding/salawu/brand-mark.svg`) porte un orange `#EA6A21`/`#D8551A`, un bleu
`#1B62B0`/`#2E86E0` et une encre `#15202B`. Le réflexe serait d'en faire la palette de l'appli.
**Mesure faite, c'est impossible** — et la raison est métier, pas esthétique :

| Couleur de marque | Couleur réseau la plus proche | Distance RVB |
|---|---|---|
| bleu clair `#2E86E0` | **Moov** `#1E88E5` | **17** — quasi identique |
| orange moyen `#EA6A21` | **Orange** `#FF6B35` | **29** — très proche |

Dans une application où six opérateurs se distinguent par leur couleur, un accent de marque
bleu se lirait « Moov » et un accent orange se lirait « Orange ». La marque entrerait en
concurrence avec l'information. S'ajoute une contrainte de contraste : l'orange de marque
plafonne à **3,19:1** et l'orange foncé à **4,01:1** — sous le seuil texte de 4,5:1.

**Conclusion : les couleurs de marque restent dans le logo, et nulle part ailleurs.** Le
wordmark se pose en `--encre`, reprise du `#15202B` du logo lui-même — la marque donne donc
bien sa teinte à l'interface, mais par son noir, pas par ses couleurs. Ce que la direction
avançait par défaut d'un logo se trouve confirmé par la mesure une fois le logo connu.

Deux jetons de filet et non un seul : `--registre` (1,21:1) convient au zébrage et aux
séparateurs, mais **ne peut porter aucune bordure d'information** — WCAG 1.4.11 exige 3:1
pour les limites de composants d'interface. D'où `--filet-fort` pour les champs de saisie
et le focus.

Typographie : **IBM Plex Sans** 400/500/600 pour le corps, **IBM Plex Mono** 500/600 pour
les montants, codes et numéros. Auto-hébergées (le mode hors-ligne interdit un CDN),
sous-ensemble latin, ~70-90 Ko. Aucun display serif : les montants *sont* le contenu, c'est
le mono tabulaire qui porte la personnalité — mémorable et fonctionnel à la fois, colonnes
alignées au chiffre, `0`/`O` et `1`/`l` non confondables quand un caissier lit un montant à
voix haute.

Signature : **le filet du registre**, un trait continu longeant la colonne des montants,
ininterrompu d'une ligne et d'une carte à l'autre. Le sens du mouvement est porté par un
signe, un mot et une icône — jamais par la couleur seule.

## 5. Plan de remédiation par lots

Un point d'arrêt entre chaque lot. Aucun lot ne mélange refonte et changement métier.

- **Lot 0 — Fondations.** C1, M1, M2, M3, M6, M7. Jetons `@theme`, polices auto-hébergées,
  `lucide-react`, Playwright + axe-core, correction des deux documents. Aucun changement
  visuel : on installe le socle dont tout le reste dérive.
- **Lot 1 — Lisibilité et accès.** **C2**, C3, C4, I5, I6, plus les cibles tactiles
  ≥ 24×24 px. Ce lot ferme les violations de `DESIGN.md` §8 et §11 indépendamment de
  l'esthétique.
  C2 a été **remonté du Lot 2 vers ce lot** (décision du 2026-09-02) : un contraste à
  1,47:1 est un défaut d'usage, pas un défaut de goût, et il se corrige par le jeton de
  texte secondaire posé au Lot 0 — sans rien attendre de la refonte visuelle.
- **Lot 2 — L'identité.** C5, I1, I2, I3, M4 — précédés de I7 (tests de
  caractérisation, non négociable avant de toucher aux primitives). Le levier maximal :
  une dizaine de fichiers pour quarante écrans.
- **Lot 3 — Structure et signature.** I4, M5, le filet du registre, le bandeau de solde
  permanent, et **tous les états** de `DESIGN.md` §10 sur les écrans principaux.
- **Lot 4 — Retrait du système de thèmes mort.** Ajouté en cours de chantier, sur
  décision explicite du client (2026-09-03), et traité **à part** parce qu'il touche un
  client en production : voir §7.

Les mineurs non repris ci-dessus restent en backlog, traités au fil de l'eau.

## 6. Corrections apportées à ce bilan en cours de remédiation

Un audit se corrige quand l'exécution le dément. Deux constats l'ont été :

- **C4** annonçait « 11 des 16 surfaces ». Le recensement s'appuyait sur la présence
  d'un `fixed inset-0`, ce qui a fait entrer `Layout.jsx:77` dans la liste — or c'est
  un calque décoratif (`-z-10 opacity-5`), pas une modale. Chiffre réel : **10 sur 15**.
- **I5** annonçait « 49 lignes, focus supprimé sans remplacement », classé IMPORTANT.
  Le détecteur travaillait ligne à ligne et ne voyait pas les indicateurs portés par
  la ligne suivante d'un littéral de classes multiligne. Après vérification pièce par
  pièce : **une seule violation réelle**. Le constat est déclassé.

Aucun autre constat n'a bougé dans son diagnostic : C1, C2, C3, C5, I1, I2, I3, I4, I6
et I7 ont été confirmés par la mesure. **I4 fait exception sur la suite donnée** : le
constat est exact, mais sa correction a été annulée sur décision du client (§8).

## 7. Lot 4 — Retrait du système de thèmes (2026-09-03)

### Pourquoi ce lot a été instruit séparément

Les huit thèmes de `src/constants/themes.js` étaient la source principale de la palette
générique constatée en §1. Mais `DEFAULT_THEME` en servait un (`dark`) à **TAOFIC, en
production** : les retirer n'était pas un nettoyage, c'était une décision sur un autre
client. Le lot a donc été sorti de la refonte et conduit sous le protocole de suppression
complet de `CLAUDE.md`.

### La preuve, pas l'intuition

Le point décisif est venu de l'historique, pas d'un détecteur de code mort :

| Question | Réponse | Preuve |
|---|---|---|
| Un sélecteur de thème a-t-il existé ? | Oui, `src/pages/Personnalisation.jsx`, routé et présent au menu | `git show d72d5d7:src/App.jsx` |
| Quand a-t-il disparu ? | Le **2026-05-29**, un commit plus tard | `d72d5d7` → `32e21b0` |
| A-t-il pu atteindre la production ? | Les deux commits sont du même jour, à un commit d'écart | `git log --date=short` |
| `changeTheme` a-t-il un site d'appel depuis ? | **Aucun**, dans aucun commit | `git grep -l changeTheme <rev> -- src` |

Conséquence : `currentTheme` ne peut valoir que `DEFAULT_THEME`. Six des huit thèmes
n'étaient atteignables par **aucun chemin de code**.

### Ce qui rendait le retrait sûr

Le garde déjà présent dans `ThemeContext` — `saved && THEMES[saved] ? saved :
DEFAULT_THEME` — fait retomber tout identifiant inconnu sur le défaut. Après suppression,
un `'blue'` résiduel dans le `localStorage` d'un utilisateur suit exactement le même
chemin qu'une valeur corrompue. **Aucune migration n'est nécessaire**, et c'est vérifié
plutôt que supposé (TC-158).

### Ce qui a été retiré, et ce qui ne pouvait pas l'être

| Élément | Sort | Motif |
|---|---|---|
| `blue`, `light`, `green`, `purple` | retirés | inatteignables |
| `custom` | retiré | inatteignable **et défectueux** (ci-dessous) |
| `orange` | retiré | inatteignable depuis que salawu porte `design.system = 'registre'` |
| `dark` | **conservé à l'identique** | rendu par TAOFIC en production |
| `registre` | conservé | identité ESAHAF |
| `BRAND_DEFAULT_THEME` | retiré | seconde table décidant de l'apparence — la dispersion même que le chantier supprime |
| `changeTheme`, `setCustomThemeColor`, `customColor`, `themes` | retirés du contexte | sans site d'appel depuis le 2026-05-29 |

### Un défaut trouvé au passage

Le thème `custom` fabriquait `bg-[#3b82f6]` **à l'exécution**. Le JIT de Tailwind ne
balaye que les fichiers sources : cette règle n'était jamais émise. La classe était bien
posée sur l'élément et ne peignait rien — une barre de navigation transparente, sans la
moindre erreur pour le signaler. TC-158 a d'abord **figé ce défaut**, puis a été retourné
pour vérifier sa correction : la suppression répare, elle n'efface pas seulement.

### Cohérence du manifeste PWA

`vite.config.js` servait encore `theme_color: '#ea580c'` à ESAHAF via la marque, alors
que la barre de navigation est passée à l'encre. Sur Android, `theme_color` peint la barre
d'état et la vignette du sélecteur d'applications : le bandeau aurait été orange
**au-dessus** d'une application à l'encre, sur l'appareil précisément visé. La couleur
dérive désormais du même axe `design`, et vaut `#15202b` (le jeton `--color-encre`).
TAOFIC conserve `#3b82f6`, inchangé.

### Vérification

- TC-158 écrit **avant** la suppression, vert avant et après, figeant les six chaînes de
  classes exactes que rend TAOFIC.
- TC-096 réécrit : il caractérisait le câblage marque → thème, qui n'existe plus. Le
  changement de contrat est documenté dans son en-tête plutôt que silencieux.
- TC-118 : catalogue ramené de huit identifiants à deux, en liste explicite — quand elle
  casse, elle dit *lequel* a bougé.
- Restauration : les modifications ne sont pas commitées ; l'état antérieur est celui du
  commit `2f4bd78`.

### Mesure — et une erreur de méthode à ne pas refaire

| Mesure | 8 thèmes | 2 thèmes |
|---|---|---|
| CSS final (`npm run build`, ESAHAF) | 98 059 o | **95 898 o** |
| CSS final, TAOFIC | — | **95 898 o**, à l'octet près |

Le gain imputable au retrait est de **2 161 octets** (−2,2 %), obtenu par A/B contrôlé :
le catalogue à huit thèmes reconstitué à l'identique, deux builds, une seule variable.
Ce lot n'était pas un lot de poids ; son gain est la fin de la palette générique et
d'un mécanisme de variation en double.

Deux pièges de mesure rencontrés, consignés parce qu'ils produisent des chiffres faux
et crédibles :

1. **Deux pipelines confondus.** `npx vite build` rend 71 183 o ; `npm run build`
   enchaîne `scripts/compatCss.mjs` (dépliage des `@layer`, préfixes de compatibilité)
   et rend 95 898 o. Comparer l'un à l'autre faisait apparaître une baisse de 27 % qui
   n'existait pas. **Toujours mesurer avec `npm run build`.**
2. **Le total de précache annoncé par vite-plugin-pwa est calculé avant `compatCss`** :
   le chiffre affiché (2242 KiB) sous-estime le précache réel d'environ 24 Ko. Sans
   conséquence — le service worker référence le CSS avec `revision: null` et s'appuie
   sur le nom de fichier haché, donc la réécriture en place ne désynchronise rien
   (vérifié dans `dist/sw.js`).

Le CSS est **identique pour les deux clients**, comme depuis le Lot 2 : une seule
feuille, et c'est la classe de portée sur `<html>` qui décide de ce qui s'applique.
`theme_color` diffère en revanche par construction — `#15202b` pour ESAHAF, `#3b82f6`
pour TAOFIC — parce qu'il est écrit dans le manifeste, pas dans la feuille.

## 8. Rétablissement du bandeau photo (2026-09-04)

Le client a demandé le retour du fond après avoir vu l'écran sans lui. C'est sa décision
et elle est appliquée telle quelle. Ce qui suit n'est pas une objection : c'est le
relevé de ce que la décision coûte, pour qu'elle reste révisable en connaissance de cause.

| | Sans le bandeau | Avec (état livré) |
|---|---|---|
| Précache ESAHAF | 2242 Ko | **4006 Ko** |
| Assets d'un autre client (akayis-*) | écartés | écartés (inchangé) |
| Polices IBM Plex | précachées | précachées (inchangé) |

Le constat I4 reste exact sur les faits : 1,8 Mo de décor, chargé deux fois, en
`background-attachment: fixed`. Ce qui change est l'arbitrage — le poids contre la
présence visuelle de la marque — et cet arbitrage n'appartient pas à l'audit.

### Ce que le rétablissement a obligé à traiter

Remettre `backgroundImage` seul aurait livré un bug. Trois choses en dépendaient :

1. **Le précache.** `bg-noir.png` était exclu du manifeste d'ESAHAF par *deux*
   mécanismes (`globIgnores` et l'énumération d'`includeAssets`). Le profil salawu
   active `offlineMode` : une image affichée en ligne mais absente du cache aurait donné
   un écran différent selon la connexion — le défaut le plus difficile à reproduire au
   support. Les deux listes ont été corrigées.
2. **Le seuil de la navbar.** Il n'a rien demandé, et c'est le résultat recherché : il
   est mesuré depuis la correction du même jour, donc il repasse de ~53 à ~200 px tout
   seul. Une constante en dur aurait dû être rééditée ici.
3. **Le test qui figeait le contraire.** TC-157 vérifiait `backgroundImage === null`.
   Il a été retourné, avec la raison écrite dans le test plutôt que dans un commit.

TAOFIC est inchangé sur toute la ligne : 4080 Ko de précache, `bg-noir.png` présent,
`theme_color` `#3b82f6`, aucune police IBM Plex.

## 9. Boucle QA navigateur — constats (2026-09-04)

Trois lots avaient ete livres sans qu'aucun ecran ne soit rendu dans un vrai
moteur de mise en page. La boucle Playwright + axe-core (`npm run qa:full`) comble
ce trou. Elle a trouve, sur des ecrans deja audites, des defauts que la suite
vitest ne pouvait PAS voir : jsdom ne calcule ni couleur resolue ni geometrie, et
axe ne teste pas les comportements (Escape, piege de focus).

### Ce que la boucle couvre

Trois largeurs (375 / 768 / 1440), scan WCAG 2.2 AA contraste compris, mesure du
debordement horizontal, et un controle de cloisonnement entre DEUX boutiques
peuplees de montants distincts (exigence `CLAUDE.md`). Emulateurs uniquement :
`playwright.config.js` impose un projet Firebase factice, de sorte que le front
ne PEUT pas joindre la production, meme si la connexion aux emulateurs echouait.

### Constats — accessibilite

| # | Ecran | Regle axe | Gravite |
|---|---|---|---|
| Q1 | Transactions, Clients | `select-name` — liste deroulante sans nom accessible | **critique** |
| Q2 | Historique | `label` — deux champs `date` sans etiquette | **critique** |
| Q3 | Clients, Tableau de bord (375) | `scrollable-region-focusable` — zone defilable inatteignable au clavier | serieux |
| Q4 | Transactions, Historique | `color-contrast` sur `.bg-green-600`, `.bg-blue-500`, `.bg-green-500` | serieux |

Q1 et Q2 signifient qu'un lecteur d'ecran annonce « liste deroulante » sans dire
de quoi. Q3 signifie qu'un tableau large ne peut pas etre parcouru au clavier :
les colonnes de droite sont hors d'atteinte sans souris.

Q4 mérite une correction de ma part : **le constat C1 sous-estimait la dispersion
de la couleur**. J'ai centralise les primitives partagees et j'en ai conclu que la
couleur etait centralisee. Le navigateur montre que chaque ecran garde ses propres
couleurs Tailwind codees en dur. Meme schema que le degrade du panneau de
connexion, trouve au meme moment.

### Constats — mise en page

| # | Constat | Portee |
|---|---|---|
| Q5 | **Debordement horizontal de 68 px a 768 px** | les CINQ ecrans |
| Q6 | **Debordement de 187 px a 375 px** sur Profil | un ecran |

Q5 se produit a la largeur exacte du point de rupture `md` : la barre de
navigation horizontale a huit entrees ne tient pas dans 768 px. Il faut faire
defiler lateralement pour lire un montant — le defaut que `DESIGN.md` §11 vise
avec l'exigence de reflow.

### Ce que la boucle a corrige dans mes propres livrables

Trouves et corriges dans la foulee : le degrade orange/bleu du panneau de
connexion (aux teintes de deux operateurs, cf. §4) ; `bg-opacity-*`, supprime par
Tailwind v4, qui rendait le voile de TOUTES les modales noir opaque au lieu de
50 % — defaut present depuis le commit initial et touchant les deux clients ; et
l'absence d'`Escape` et de piege de focus sur les deux modales d'authentification,
que mon relevé C4 avait omises faute d'avoir inspecte `src/components/auth/`.

### Suite donnee — les six constats sont clos (2026-09-04)

Boucle finale : **36/36 aux trois largeurs**, zero violation WCAG 2.2 AA, zero
debordement horizontal.

| # | Correction | Portee |
|---|---|---|
| Q1 | 15 controles nommes : `aria-label` quand aucune etiquette n'existait, association `htmlFor`/`id` quand une etiquette VISIBLE existait deja | 6 fichiers |
| Q2 | idem pour les champs `date` | 2 fichiers |
| Q3 | 4 zones defilantes rendues focalisables (`tabIndex`, `role="region"`, nom) | 4 fichiers |
| Q4 | 39 lignes de contraste relevees (`green-500`→`700`, `green-600`→`700`, `blue-500`/`600`→`700`) | 23 fichiers |
| Q5 | barre de navigation en `flex-wrap` : plus de debordement a 768 px | 1 fichier |
| Q6 | en-tete du profil empile sous 640 px | 1 fichier |

Trois points de methode qui ont oriente ces corrections :

**Les noms accessibles n'ont pas ete inventes.** La ou une etiquette visible
existait, elle a ete ASSOCIEE plutot que doublee d'un `aria-label` plus
descriptif : faire diverger le nom accessible du texte affiche casse la commande
vocale (WCAG 2.5.3). Les identifiants viennent de `useId()`, jamais de chaines
fixes — ces formulaires peuvent apparaitre plusieurs fois sur une page.

**Les contrastes ont ete releves DANS la famille Tailwind d'origine**, et non
bascules sur les jetons de l'identite. Ces composants sont partages et ne sont pas
portes par l'axe `design` : les basculer sur `--encre` aurait impose l'apparence
d'ESAHAF a TAOFIC. Corriger un contraste repare le defaut pour les deux clients
sans decider de l'apparence de l'un d'eux.

**Q5 a coute une seule ligne grace a TC-159.** Le repli de la barre change sa
hauteur ; le seuil de bascule en position fixe est MESURE depuis la correction de
la veille, il a suivi tout seul. Avec la constante `200` en dur, il aurait fallu
la rectifier ici, et l'oublier aurait rouvert le bug de navigation.

### Un defaut que la refonte a CREE, et non revele

`text-gray-500` sur « Aucune transaction disponible » vaut **4,83:1 sur blanc** :
conforme, et donc hors du balayage du Lot 1 qui ne visait que `gray-400` et
`gray-300` (deja fautifs sur blanc). Il tombe a **3,99:1 sur le fond
`--registre`** — le fond a change sous lui. Corrige en `text-gray-600` (7,56:1 sur
blanc, 6,24:1 sur registre).

Aucun test unitaire ne pouvait le voir : il nait de la COMPOSITION d'une couleur
de texte et d'une couleur de fond decidees dans deux fichiers differents. C'est
l'argument le plus net en faveur de cette boucle.

**122 occurrences de `text-gray-500` subsistent** et n'ont pas ete touchees :
conformes partout ou le fond est blanc, et on ne sait pas lesquelles se retrouvent
sur un fond teinte sans les rendre. Les corriger en masse serait un changement
visuel sur 122 sites au juge. La boucle les debusquera sur constat.

## 10. Lot 3 — Structure et signature (2026-09-07)

### La signature, posee de facon declarative

Le filet du registre (direction, §2) n'est pas ecrit dans les composants. Ceux-ci
emettent un FAIT — `data-montant` sur les cellules de montant — et
`src/index.css` decide de l'apparence, sous `.design-registre` :

```css
.design-registre [data-montant] {
  text-align: right;
  border-left: 2px solid var(--color-filet);
  padding-left: 1rem;
}
```

Deux consequences qui justifient ce partage :

- **TAOFIC ne voit rien.** La regle est presente dans le CSS mais inerte : elle
  n'a aucun element a atteindre hors de `.design-registre`, pose par
  `src/main.jsx` sur `<html>`. Verifie au build — `theme_color` du manifeste
  TAOFIC reste `#3b82f6`.
- **La couleur du filet est `--filet` et non `--registre`.** `--registre`
  (#ECE9E3) vaut **1,21:1** sur blanc : un filet a ce contraste est un filet
  qu'on ne voit pas. `--filet` tient **3,48:1**, au-dessus du seuil de 3:1 exige
  par WCAG 1.4.11 pour un element graphique porteur de sens. La direction disait
  « un trait en --registre » ; la mesure a corrige la direction, pas l'inverse.

### Le controle qui verifie le RENDU, pas la declaration

Une capture d'ecran ne dit pas si le filet est applique ou seulement declare : la
regle peut etre emise et n'atteindre aucun element si `data-montant` manque, ou
si le tableau est vide. Le test lit donc le style calcule d'une vraie cellule
(`tests/qa/ecrans-authentifies.spec.js`) : alignement a droite, bordure >= 2 px,
police en chasse fixe, `tabular-nums` present.

### Un defaut que seules des DONNEES pouvaient reveler

Trois runs QA verts avaient precede celui-ci. Le quatrieme — le premier avec un
historique peuple — a echoue : debordement de 40 px a 375 px. Sur un historique
vide, `DailyPagination` rend son etat vide et le bloc fautif n'existe pas.

**Une capture d'un ecran vide ne prouve rien, et un test vert sur un ecran vide
non plus.** C'est le meme piege que les soldes a zero du seed, sous une autre
forme.

Le coupable a ete nomme par l'assertion elle-meme, qui parcourt `body *` et
signale l'element le plus a droite dont aucun ancetre ne le contient par un
`overflow` — sans quoi elle accuserait le contenu d'une zone defilante, qui est
cense depasser :

> `deborde de 40 px — <button class="inline-flex items-center gap-1 px-3 py-1 bg-gray-200 ..."> atteint 415px`

Je cherchais dans le tableau. C'etait `DailyPagination.jsx:79`. Correction :
`flex flex-wrap justify-between items-center gap-3`. `justify-between` seul ne
replie pas — il repartit l'espace, y compris quand il est negatif.

### M5 — `AdminDashboard` : six tuiles ramenees a quatre, aucun chiffre perdu

« Boutiques totales / actives / inactives » etaient trois tuiles pour deux faits :
le total est la somme des deux autres. Total et inactives passent en ligne
secondaire de « Boutiques actives », qui est la grandeur d'exploitation.

« Demandes en attente » passe en premiere position : c'est la seule tuile qui
appelle une action, les autres decrivent un etat. C'est la traduction du principe
retenu de `dashboard-builder` — repondre a « qu'est-ce qui bloque ? », et non
« montrer toutes les metriques ».

`SkeletonCards count` suit de 6 a 4, sinon le squelette annonce une mise en page
que le rendu ne tient pas.

### Ce qui reste ouvert dans ce lot

- **Le bandeau de solde permanent : tranche autrement que prevu** — voir
  ci-dessous.
- **Les etats de `DESIGN.md` §10** (vide, chargement, clairseme, dense, erreur,
  permission refusee, desactive, optimiste, perime, destructif, mobile) ne sont
  pas tous couverts.

### Verification

Boucle QA : **42/42** aux trois largeurs (375 / 768 / 1440), zero violation
axe-core WCAG 2.2 AA, zero debordement horizontal, cloisonnement des deux
boutiques verifie sur les cinq ecrans, et desormais l'URL verifiee a chaque
navigation.

Non-regression : **108 fichiers / 2278 tests**, tous verts (106/2268 avant ce lot,
plus TC-160 et TC-161 a 5 cas chacun — le delta se reconcilie exactement). Le run
groupe donnait 1 echec sur `tc-154-offline-auth`, qui passe seul (8/8) : le flake
PBKDF2 sous charge deja connu, pas une regression.

⚠ Le code de sortie ne suffit PAS a lire ce resultat : un worker qui ne demarre
pas laisse vitest sortir en 0. C'est le DECOMPTE de fichiers qui l'a revele.

Lint : 0. Build salawu : 0. Build TAOFIC : 0.

### Le defaut le plus grave de ce lot etait dans MON harnais

`allerA` declarait l'arrivee sur un ecran des qu'un texte correspondant au
marqueur devenait visible. Or le marqueur de l'historique est `/historique/i`, et
« Historique » est aussi **le libelle du lien de navigation**, visible en
permanence au-dessus de 768 px. Le test validait donc sa propre navigation ratee.
Idem pour `/transaction/i` et `/client/i`.

Ce n'etait invisible qu'a 375 px, ou la navigation est un `<select>` : aucun texte
de lien a accrocher, donc le test attendait vraiment. D'ou un echec qui semblait se
promener entre les largeurs alors qu'il designait quelque chose de reel.

**C'est la deuxieme fois que ce fichier se fait prendre sur ce point** — un
marqueur `/profil|boutique/i` accrochait deja « Creer un compte boutique » sur
l'ecran de connexion (§9). La lecon est donc a retenir une fois pour toutes :

> **Un texte visible n'est pas une preuve d'arrivee.** Un libelle de navigation est
> present sur TOUTES les pages ; le confondre avec le contenu de la page cible
> fabrique un test qui passe au vert en regardant ailleurs.

Corrige en verifiant **l'URL d'abord, le contenu ensuite** : un chemin de route ne
peut pas etre confondu avec un libelle, et quand il echoue le message dit ou l'on se
trouve reellement — ce qui separe « le clic n'a pas navigue » de « la route a rendu
une page vide ».

### Trois runs rouges, un seul defaut — et comment on les a separes

La boucle a rendu 5 echecs, puis 5 autres, puis 1. Un seul venait du code. Ce qui a
permis de les separer, et qui vaut pour la suite :

**1. Un vrai defaut se reproduit a l'identique.** Le rail tombait aux TROIS largeurs,
avec une erreur d'assertion chiffree. C'etait le seul.

**2. Les echecs de machine se DEPLACENT.** Deuxieme run : 5 echecs, jeu different du
premier, tous en depassement de delai (axe qui ne rend pas, connexion qui n'aboutit
pas), disperses au hasard entre les largeurs, sur des tests sans rapport avec le
changement. Et la meme suite passait de 9,0 a 14,1 puis 22,6 minutes.

Cause : cette machine a **8 Go**, il en restait **582 Mo**. Un `java` d'emulateur
Firestore de 843 Mo etait reste resident apres la sortie de `firebase emulators:exec`,
plus quatre `chrome-headless-shell` orphelins — des restes accumules pendant la
session. Fermes : 422 -> 1 471 Mo libres, et le temps total retombe a 12,9 min.

⚠ Cela n'a PAS ete conclu par confort. L'hypothese de code la plus plausible etait que
le rail double les abonnements Firestore, puisqu'il appelle `useSimpleNetworkData`
comme le rideau. Verifiee : `useSimpleNetworkData` -> `useNetworkCards` ->
`NetworkConfigContext`, un seul abonnement partage dans le fournisseur. Ecartee sur
preuve.

**3. Un plafond de temps trop court n'est pas un echec, mais il ne doit pas non plus
etre traite comme un flake.** Dernier run : 1 echec, un depassement NU — aucune erreur
d'assertion. Les tests voisins du meme fichier mesuraient 31,8 / 44,7 / 55,0 s sous un
plafond de 60 s, parce que chacun paie une connexion complete en `beforeEach`. Plafond
porte a 150 s pour ce fichier.

Et toujours **zero `retries`** : une nouvelle tentative masquerait un probleme de
synchronisation, la ou un plafond realiste cesse simplement d'interrompre un travail
correct mais lent. La distinction est tout l'interet de la boucle.

### Garde TAOFIC — l'identite ne fuit pas, mais deux changements la traversent

Build `VITE_CLIENT_ID=taofic_ajagbe` verifie :

- `theme_color` du manifeste reste **#3b82f6** (salawu : #15202b) ;
- les **huit** regles de l'identite sont presentes dans le CSS mais toutes
  scopees sous `.design-registre`, classe que `src/main.jsx` derive de
  `profil.design.system`. TAOFIC ne declarant pas ce champ, il retombe sur
  `legacy` et ces regles n'atteignent aucun element.

En revanche, deux changements de ce chantier ne sont PAS scopes, et il faut le
dire plutot que de laisser croire a une etancheite totale :

1. **`text-gray-400` → `text-encre-doux` (#5b6470).** Le jeton est global, donc
   TAOFIC en herite. C'est assume : `gray-400` vaut **2,54:1**, sous le seuil
   AA. Une correction d'accessibilite vaut pour le produit, pas pour un client.
2. **M5 s'appliquait aussi a TAOFIC — corrige.** `AdminDashboard.jsx` n'avait
   aucun garde de design. La portee etait limitee (`/admin` est reserve au role
   `SYSTEM_MANAGER`, `src/App.jsx:145-153` : la console de l'exploitant, pas un
   ecran de boutiquier), mais c'est un choix EDITORIAL, pas une correction
   d'accessibilite. **Arbitrage du client (2026-09-07) : retirer TAOFIC de M5.**
   La liste de tuiles passe derriere `IS_REGISTRE` — TAOFIC retrouve ses six
   tuiles dans leur ordre d'origine, salawu en a quatre.

   ⚠ Les emoji ne reviennent PAS avec les six tuiles : leur retrait est un
   non-negociable de DESIGN.md §8, donc une correction, donc product-wide. Sans
   cette distinction, « retablir TAOFIC » se confondrait avec « annuler tout le
   lot pour TAOFIC ». C'est la frontiere que ce chantier s'impose desormais :

   | Nature | Portee | Exemples |
   |---|---|---|
   | Correction | produit entier | contraste, emoji, focus visible, `Escape`, debordement |
   | Parti pris | un client, via `profil.design` | M5, filet du registre, rail de soldes |

   Fige par `tests/components/tc-160-m5-tuiles-par-client.test.jsx` (5 cas), dont
   le plus important est le cas « legacy » : c'est le seul qui protege un client
   reel d'un changement qu'il n'a pas demande.

### Le bandeau de solde permanent — une premisse fausse, et une autre reponse

Le plan prevoyait de « promouvoir `NetworkCardsDrawer` en bandeau de solde
permanent ». En l'examinant, la premisse s'est revelee fausse sur un point :
**ce rideau est deja permanent.** `Layout.jsx:90` le rend systematiquement,
deplie par defaut, juste sous la navigation.

Ce qui manque n'est donc pas sa presence en haut de page — c'est qu'il disparait
des qu'on fait defiler une liste de transactions, au moment exact ou la question
« combien il me reste » se pose. Et la justification d'origine du bandeau,
remplacer les 200 px de photo, est tombee quand la photo a ete retablie (§8) :
un bandeau de plus s'AJOUTERAIT.

Reponse retenue : **un rail de soldes collant**
(`src/components/network/StickyBalanceRail.jsx`), qui n'apparait QUE lorsque la
navigation passe en position fixe — donc lorsque les 200 px de photo sont deja
sortis de l'ecran. **Cout vertical au repos : zero.** Il occupe de la place
pendant le defilement seulement, en echange de la seule question qui se pose a ce
moment-la.

Trois decisions de construction, chacune avec sa raison :

- **La position derive d'une hauteur MESUREE**, pas d'une constante. Un
  `ResizeObserver` suit la hauteur du rail, parce qu'elle depend de donnees
  reseau qui arrivent APRES le montage : mesurer une seule fois donnerait 0 et
  `<main>` passerait sous le rail. Meme raison de fond que le seuil de la navbar
  (TC-159) — une hauteur codee en dur cesse d'etre vraie a la premiere
  modification de ce qu'elle decrit.
- **`tabIndex` suit la visibilite.** Le rail defile horizontalement, donc il est
  focalisable (constat Q3) ; mais un element focalisable dans un `aria-hidden`
  est une violation axe (`aria-hidden-focus`) — le clavier entrerait dans une
  zone que le lecteur d'ecran ignore.
- **Il n'affiche AUCUN statut** (« Bas », « Epuise »). Ces paliers sont une regle
  d'exploitation qui vit dans `NetworkCard` ; les recopier ici en ferait une
  seconde source de verite, et les extraire serait une refactorisation a mener
  dans son propre lot, sous test de caracterisation (CLAUDE.md). Le rail dit le
  montant ; les cartes, restees en haut de page, disent le statut.

La liste des reseaux affiches vient de `useVisibleCards`, desormais exportee par
`NetworkCardsDrawer` : dupliquer la derivation aurait recree une seconde source
de verite sur « quels reseaux ce client voit ».

#### Le defaut que la boucle a trouve dans ce rail

Premiere version : le rail deplacait `top` ET `transform` en meme temps — `top`
de 0 a la hauteur de la navigation, et la translation de -100 % a 0. Il
n'atterrissait donc jamais a l'endroit annonce. La boucle l'a mesure aux trois
largeurs :

| Largeur | Bas de la navigation | Haut du rail | Ecart |
|---|---|---|---|
| 375 | 64 | 50,9 | 13,1 |
| 768 | 102 | 88,9 | 13,1 |
| 1440 | 50 | 29,9 | 20,1 |

Trois ecarts differents, parce qu'ils dependaient de l'instant ou la mesure
tombait dans l'animation. C'est ce qui rendait le defaut illisible : trois
chiffres qui n'avaient rien a se dire.

Corrige en deux temps, et les deux comptent :

- **Le code** : `top` devient CONSTANT, seul le `transform` bouge —
  `translateY(calc(-100% - Npx))` a l'etat masque, ce qui sort le rail franchement
  de l'ecran sans laisser de lisere par-dessus le bandeau de marque.
- **Le test** : `expect.poll` au lieu d'une mesure unique. Mesurer a l'instant ou
  `aria-hidden` bascule, c'est mesurer pendant l'animation. Un test qui court
  apres une transition rend un rouge ou un vert au hasard.

Retire au passage : le `backdrop-blur-sm` du rail. Un flou d'arriere-plan sur un
element fixe se recalcule a chaque image pendant le defilement, et ce depot a deja
paye cette lecon avec `background-attachment: fixed` (lot Perf). Sur un fond
papier, il n'apportait rien de visible.

Couvert par `tests/components/tc-161-rail-soldes-collant.test.jsx` (5 cas) et par
un controle de la boucle QA qui, lui, defile reellement : le rail hors ecran au
repos, accroche au bas de la navigation apres defilement (tolerance 2 px), les
soldes semes lisibles dedans, aucun debordement, axe propre.

## 11. Audit d'interface avant commit (2026-09-07)

### Le client a vu mes notes de travail a l'ecran

Signale par capture d'ecran : un commentaire de code s'affichait en toutes lettres
au-dessus de « Navigation par jour », dans l'historique.

**La cause est un piege propre a JSX.** Un `//` place juste apres `return (` est en
position d'EXPRESSION JavaScript : le compilateur le supprime. Le meme `//` place
entre deux balises est un ENFANT JSX : il devient du TEXTE RENDU.

```
return (              <div>
  // invisible          // AFFICHE A L'ECRAN
  <div/>                <span/>
)                     </div>
```

Cinq blocs etaient suspects. Verifies non pas au jugé mais **sur le bundle
construit** — un `grep` du texte dans `dist/assets/*.js` : quatre etaient bien
supprimes a la compilation, **un seul survivait**
(`DailyPagination.jsx:79`). Corrige en `{/* */}`, et confirme absent du bundle
apres reconstruction.

### Pourquoi rien ne l'avait vu

Le composant se montait sans erreur, le rendu etait valide, ESLint ne voit qu'une
chaine de caracteres, et 2278 tests ne lisaient jamais ce noeud texte. **La boucle
QA elle-meme passait a cote** : elle verifiait le contraste, les debordements,
l'accessibilite — jamais *ce que les mots veulent dire*.

C'est la limite de tout ce dispositif, et elle merite d'etre ecrite : un controle
automatique verifie ce qu'on lui a appris a regarder. Il fallait un oeil humain sur
la page.

### Le garde ajoute

`tests/qa/ecrans-authentifies.spec.js` balaie desormais le texte visible des cinq
ecrans et refuse : commentaires `//` et `/* */`, `className`, operateurs
JavaScript, `undefined` / `NaN`, `[object Object]`, classes utilitaires, erreurs
techniques brutes. Vert aux trois largeurs.

### Vocabulaire interne : rien a signaler

Balayage des textes affiches et des `aria-label` pour Firebase, Firestore, uid,
storeId, token, payload, snapshot, API, null, undefined... : **0 occurrence**.

### Constat ouvert — messages d'erreur bruts (hors perimetre de ce lot)

**39 endroits** passent `err.message` directement a l'interface. L'authentification
est traduite (`getAuthErrorMessage`), mais les autres chemins exposeraient un
message brut de Firebase a un caissier.

C'est **anterieur a la refonte** et cela touche 39 chemins d'erreur. Le corriger ici
melangerait presentation et gestion d'erreur dans un meme lot, ce que `CLAUDE.md`
interdit. **A traiter dans son propre lot.**

## 12. Ce qui n'est pas dans ce bilan

Aucun audit de sécurité, de performance serveur ni de règles Firestore : ils ont leurs
propres rapports dans `docs/audit/`. Aucune proposition ne touche au comportement métier.
Aucune installation d'ECC n'est proposée — son harnais vise Postgres/Supabase/Next, hors de
notre stack ; seules ses idées de design sont reprises, en lecture.
