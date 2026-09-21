# Bilan — refonte du design, espace boutique ESAHAF

> Point 11 de `METHODE-REFONTE-DESIGN.md` §17.2.
>
> ⚠ **Le point d'arrêt a été levé le 2026-09-19**, avec une contrainte
> ajoutée : « ne touche pas aux écrans dealer et gérant pour l'instant ». La
> campagne L9 (§10) s'est déroulée sous cette instruction. Les §1 à §9 décrivent
> l'état au point d'arrêt ; le §10 décrit ce qui a suivi.
>
> Branche : `refonte-design-esahaf` · Date : 2026-09-18
> Périmètre : le `Layout` et les dix routes boutique de `src/App.jsx`.
> TAOFIC (`taofic-ajagbe`, en production) devait rester inchangé.
>
> **Chaque chiffre de ce document porte la commande qui l'a produit.** Un chiffre
> sans commande n'y figure pas.

---

## 1. Ce que la branche contient

```
git log --oneline $(git merge-base main refonte-design-esahaf)..HEAD | wc -l
  54 commits          (42 au point d'arrêt, + 12 pendant la campagne L9)

git diff --shortstat $(git merge-base main refonte-design-esahaf)..HEAD
  238 files changed, 21091 insertions(+), 996 deletions(-)

git diff --name-only --diff-filter=A <base>..HEAD | grep -c '^tests/'
  36 fichiers de test ajoutés
```

Les onze points de la méthode ont été parcourus : le filet (4), les jetons (5),
l'outillage (6), le châssis (7), les huit lots d'écran (8), la signature (9), le
vocabulaire (10), et ce bilan (11).

---

## 2. Ce qui est mesuré, et ce qui ne l'est pas

### 2.1 Le rendu — mesuré

```
firebase emulators:exec … "seed-qa && playwright test tests/qa/ecrans-authentifies.spec.js"
  42 passed (13,5 min)
```

Dix écrans × trois largeurs (375 / 768 / 1440), chacun soumis à trois épreuves :
capture, scan **axe-core WCAG 2.2 AA**, et absence de débordement horizontal.

**Sans aucune tolérance, sur aucun écran.** C'est le chiffre qui compte le plus
dans ce document : au début de la campagne, le banc portait des défauts gelés —
un débordement de 249 px sur Clients, un contraste de 2,82:1 sur le bouton
« Modifier » de chaque ligne, un texte orange à 3,57:1 sur le tableau de bord.
Chacun exigeait que le défaut soit **encore présent**, et a rougi de lui-même le
jour de sa correction. Il n'en reste aucun.

### 2.2 Les contrastes — mesurés, pas annoncés

```
npm run qa:jetons
  ✓ Tous les contrastes annoncés sont confirmés, zéro régression sur la rampe.
  blanc sur --brand-500 (#1b62b0) : 6.14:1
  blanc sur --brand-600 (#00458d) : 9.39:1
  bouton désactivé : --encre-doux sur --reglure : 4.96:1  [seuil 4.5]
```

Le dernier mérite un mot : un contrôle désactivé est **exempté** du seuil par
WCAG. Ce n'est pas une raison pour l'effacer. Le dépôt rendait « Filtrer » en
`disabled:bg-gray-300` avec du texte blanc — environ 1,6:1, où le verbe
*disparaît* au lieu d'être désactivé, et l'utilisateur ne sait plus ce que le
bouton fera quand il redeviendra possible.

### 2.3 Les tests

```
npx vitest run tests/unit tests/components --no-file-parallelism --pool=forks
  Test Files  124 passed (124)
       Tests  2472 passed (2472)
```

```
npx eslint src/ tests/ scripts/    exit 0
```

### 2.4 Le vocabulaire — mesuré

```
npm run qa:vocabulaire
  133 fichiers parcourus
  ➜ 0 famille(s) où le produit parle DEUX langues
  ➜ 28 phrases distinctes — 13 finissent par un point, 15 non
```

---

## 3. ⚠ LE CHIFFRE QUI N'A PAS BAISSÉ, ET POURQUOI

```
npm run qa:comptage
  TOTAL   133 fichiers   572 chromatiques   515 neutres   36 hex   41 emoji
  ➜ COULEURS CHROMATIQUES À TRAITER : 523
```

Le diagnostic du 2026-09-02 annonçait **566**. Après quarante-deux commits de
refonte, la sonde en compte **572**. Elle n'a pas baissé — elle a monté.

**Ce n'est pas un échec, c'est une sonde qui mesure autre chose que ce chantier**,
et son propre en-tête le dit depuis le premier jour :

> ⚠ CE QU'ELLE NE PROUVE PAS. Un utilitaire compté n'est pas un pixel rendu :
> une classe peut être morte, conditionnelle, ou masquée. Le comptage mesure la
> DISPERSION de la couleur dans le code, pas ce que l'écran montre.

La méthode retenue **conserve délibérément** les classes Tailwind d'origine dans
le JSX, parce que ces composants servent aussi TAOFIC. Le JSX ne déclare que des
**faits inertes** — `data-rang`, `data-surface`, `data-montant`, `data-tuile` — et
toute l'apparence vit dans `src/index.css`, sous la portée
`.design-registre [data-espace='boutique']`. Un `bg-orange-500` conservé mais
neutralisé compte donc **une couleur de plus** pour la sonde, et **zéro pixel
orange** à l'écran.

Une campagne qui aurait voulu faire baisser ce chiffre aurait dû supprimer les
classes — donc changer TAOFIC. C'était le choix à ne pas faire.

**Conséquence à assumer :** cette sonde est désormais inutilisable pour juger
l'espace boutique. Elle reste valable pour les espaces admin et dealer, qui n'ont
pas été touchés.

---

## 4. TAOFIC — ce qui est prouvé, et ce qui est seulement argumenté

C'est la contrainte la plus lourde de la campagne, et il faut être exact sur son
niveau de preuve.

**Argumenté, structurellement :** `.design-registre` est posée sur `<html>` par le
profil actif. Aucune des règles de ce chantier ne s'applique sans elle. Un profil
qui ne la porte pas ne peut pas être atteint par une feuille de style qui
commence toutes ses règles par cette classe. L'argument est solide, mais c'est un
argument.

**Prouvé, par des tests :** huit fichiers de filet montent l'écran **avec les deux
profils** et exigent du rendu historique qu'il soit intact —
`tc-159`, `tc-160`, `tc-161`, `tc-162`, `tc-163`, `tc-166`, `tc-168`, `tc-171`.
Exemple : `tc-171` exige que TAOFIC garde ses **cinq** graphiques là où le
registre n'en rend plus qu'un, et que sa répartition mono-réseau compte
exactement comme avant.

**Mesuré dans un vrai moteur de rendu** — ajouté après la première rédaction de ce
bilan, qui signalait cette lacune :

```
npm run qa:taofic
  5 passed (1,1 min)
```

`playwright.taofic.config.js` rend le profil **`taofic-ajagbe`** et vérifie sur
les valeurs **calculées** que : `<html>` ne porte pas `design-registre` ; la page
n'affiche pas la marque ESAHAF ; le corps n'est pas en IBM Plex ; le canvas
bleuté de l'identité ne le peint pas.

Le cinquième cas est celui qui donne sa valeur aux quatre autres. Il pose la
classe de portée **à la main** sur `<html>` et exige qu'une propriété change
réellement — la bordure d'une tuile témoin passe à `rgb(192, 215, 245)`, soit
`--trait-200`. Sans lui, les quatre premiers cas seraient verts si la feuille de
l'identité n'était **pas servie du tout** sur ce montage : verts par absence, et
non par cloisonnement. Un banc qui ne peut pas rougir ne prouve rien.

**Comparé au CSS construit de `main` — et cela a trouvé une vraie fuite.**

Plutôt que de comparer une capture, on a comparé ce que TAOFIC peut *recevoir* :
la feuille construite, privée de toute règle dont le sélecteur contient
`.design-registre`. Ce résidu couvre **tous** les écrans à la fois, là où une
capture ne parlerait que de l'écran capturé.

```
VITE_CLIENT_ID=taofic-ajagbe npm run build     (sur chaque révision)
  main     868 règles non portées
  branche  922 règles, dont 71 portées → 851 non portées
```

Les variables de `:root` d'abord, qui décident de tout le reste :
**17 ajoutées, zéro retirée, zéro modifiée.** Aucune variable consommée par
TAOFIC n'a changé de valeur.

Les règles disparues sont des utilitaires que plus aucune source ne mentionne —
le système de thèmes mort retiré au lot 4 (`bg-theme-primary`, `border-theme`…).
Une classe cesse d'être émise seulement si plus rien ne l'écrit : aucun élément
ne peut donc la porter.

⚠ **MAIS UNE RÈGLE AJOUTÉE ATTEIGNAIT BIEN TAOFIC.** `text-encre-doux` est un
utilitaire **non porté**, et un remplacement global de la refonte l'avait posé
sur les trois infobulles de graphique — composants rendus par les deux profils,
sur fond `bg-gray-900` :

```
main      text-gray-300 sur gray-900   12,05:1
main      text-gray-400 sur gray-900    6,82:1
branche   --encre-doux  sur gray-900    2,96:1   ✗ sous les 4,5:1 exigés
```

Le remplacement était juste partout ailleurs (`text-gray-400` sur blanc ne tient
que 2,54:1, `--encre-doux` en tient 6,00). Il ne l'était pas là, parce que le
fond est l'inverse.

**Ni la suite ni le banc ne pouvaient le voir** : jsdom ne calcule aucune
couleur, et une infobulle n'apparaît qu'au *survol* alors que le scan axe lit la
page statique. Les gris d'origine sont restaurés, et `tc-175` garde désormais la
classe de faute — vérifié capable de rougir en réintroduisant le défaut.

**Toujours NON prouvé :** ce n'est pas une **comparaison de pixels avant/après**.
Le différentiel porte sur le CSS, pas sur le rendu : un changement venu du JSX
lui échapperait.

C'est un choix, et il est défendable : une comparaison de captures serait vraie
le jour où on la fait, tandis que cette garde rougira au premier lot qui écrira
une règle hors portée — dans six mois, et écrite par quelqu'un d'autre.

> **Recommandation maintenue, mais allégée.** Une capture différentielle de
> `taofic-ajagbe` entre `main` et cette branche resterait le contrôle le plus
> direct avant mise en production. Elle n'est plus le *seul* filet : `qa:taofic`
> couvre désormais le mécanisme en continu.

---

## 5. Les deux règles métier qui ont changé, et sous quelle autorité

La refonte devait s'arrêter au design. Deux exceptions, toutes deux **demandées
par le client** et couvertes par un test de caractérisation, comme l'exige
`CLAUDE.md`.

| Règle | Décision | Filet |
|---|---|---|
| Les **chiffres du jour** (ventes, chiffre d'affaires) n'existaient nulle part sur l'accueil | client, sur maquette | `tc-172` (17 cas) |
| La **répartition par réseau** ne comptait qu'Orange, écrit en dur | client, 2026-09-18 | `tc-173` (16 cas) |

Sur la seconde, un point de méthode qui vaut pour la suite : le correctif ne
contient **aucun `if` de client**. La règle parcourt les réseaux **du profil**.
TAOFIC obtient une seule part parce que son profil n'en déclare qu'une — pas
parce qu'une condition l'épargne. Une condition aurait dû être retirée le jour où
TAOFIC ouvre un deuxième réseau, et personne n'y aurait pensé.

Deux conséquences de comptage sont **voulues** et ne doivent pas être « corrigées » :

- la somme des parts **peut dépasser** le nombre de clients (un client inscrit
  chez deux réseaux compte dans les deux — une note sous le bloc le dit) ;
- les réseaux **à zéro sont conservés** : c'est l'information qui fait agir.

---

## 6. Ce qui reste, chiffré

```
npm run qa:comptage
  PageHeader : 2/11 écrans · EmptyState : 0/11 écrans · 9 phrases « Aucun… » écrites à la main
  <h1> DÉCLARÉS : 7 sur les points d'entrée, 8 dans TOUT le graphe
  4 largeurs de châssis DÉCLARÉES (2xl, 4xl, 6xl, 7xl)
```

> ⚠ **Deux chiffres différents pour les phrases de vide, et les deux sont justes.**
> `qa:comptage` en annonce **9**, `qa:vocabulaire` en relève **28**. Ils ne
> comptent pas la même chose : le premier compte les **occurrences sur les onze
> fichiers de page** (`/['"`>]\s*Aucun[e]?\b/`), le second les **phrases
> distinctes sur les 133 fichiers du graphe**, « Pas de » et « Rien à » compris.
> Un écran est fait par ses composants, pas par son fichier de page : c'est le
> second chiffre qui décrit le travail restant.

| Sujet | État | Nature |
|---|---|---|
| **28 phrases de vide** écrites à la main, 13 avec point final, 15 sans | relevé, non unifié | décision de **contenu** |
| `ui/EmptyState` : 0 écran boutique sur 11 (9 en admin et dealer) | non adopté | décision de **contenu** |
| `PageHeader` : 2 écrans sur 11 | déclarations conservées pour TAOFIC | structurel |
| 4 largeurs de châssis, 8 `<h1>` déclarés | **neutralisés au rendu** depuis L7.1 | déclarations, pas pixels |
| Bandeau photo de 200 px à 375 px | **DÉCIDÉ, pas en attente** — rétabli à la demande explicite du client le 2026-09-04, après l'avoir vu retiré (`src/constants/themes.js:35`) | arbitrage client, clos |
| Convention de signe (Transactions = stock, Historique = caisse) | signalée, non traitée | décision **métier** |
| Rendu TAOFIC | mécanisme gardé (`qa:taofic`), capture différentielle non faite | voir §4 |

Les deux premières lignes sont liées : unifier les phrases de vide demande de
choisir **ce que chaque écran propose** quand il n'a rien à montrer. Un état vide
est une invitation à agir, pas un trou — mais décider de l'action est un choix de
produit, pas de design.

---

## 7. Ce que la campagne a appris, et qui vaut au-delà d'elle

**Un défaut peut en masquer un autre.** Sur Clients, l'assertion de débordement
interrompait le test **avant** le scan axe. Ce n'est qu'en gelant le débordement
par sa valeur que le scan s'est exécuté et a trouvé du blanc sur orange à 2,82:1
sur le bouton de chaque ligne. Un rouge arrête tout ; un gel nommé laisse le
reste du contrôle travailler.

**Une tolérance doit avoir une date de péremption.** Chaque défaut gelé exigeait
que le défaut soit **encore présent**. Tous ont rougi d'eux-mêmes le jour de leur
correction, ce qui interdit d'oublier de les retirer — et interdit aussi qu'ils
protègent une régression.

**Le décompte, pas le code de sortie.** Une exécution a rendu
`122 passed (122)` / `2439 passed (2439)` — verte, code 0 — avec
`Failed to start forks worker` sur le fichier le plus lourd. Douze tests étaient
tombés du décompte sans échouer. Seul l'écart au chiffre attendu l'a désigné.

**Un dégradé cache un défaut de contraste au scanner.** axe classe un élément
portant un `background-image` comme *incomplete*, jamais *violation* : il ne sait
pas calculer un contraste sur un dégradé. Chaque dégradé retiré a rendu une zone
**mesurable**, en plus de la rendre sobre. C'est ainsi que sont apparus les
défauts de la bande des réserves.

**Suivre une maquette à la lettre peut trahir son intention.** La réglure de
l'argent est posée en `border-left` sur un bloc aligné à droite. Dans la maquette
les tuiles sont étroites, le trait tombe près du nombre. Le produit les étale sur
1440 px : l'écart croissait avec l'écran et le trait flottait seul. La maquette
avait raison sur le geste, pas sur la largeur.

**Vérifier ses affirmations contre le code, jamais contre ses propres commits.**
Deux affirmations écrites au cours de cette campagne étaient fausses et ont été
corrigées : `StatCard` n'hérite pas de `DashboardCard` (le mot apparaissait dans
un **commentaire**), et l'anneau rogné n'a pas été cassé par le restylage — il
l'était déjà, mesuré à 160 px demandés dans 146 px de conteneur, et le dégradé
vert le masquait.

**Un commit ment ou il ne ment pas.** Un renommage de libellé — un changement
déclaré — avait été commis dans un lot intitulé « RESTYLE PUR ». Les deux commits
locaux ont été refaits pour que le lot de restylage n'en contienne plus une
ligne. Un commit qui se trompe sur sa propre nature ruine la seule chose qui rend
les autres vérifiables.

---

## 8. Les trois sondes rejouables

```
npm run qa:jetons        les contrastes de la palette, mesurés
npm run qa:comptage      la dispersion de la couleur dans le code (voir §3)
npm run qa:vocabulaire   les verbes d'action et les phrases de vide
npm run qa:full          la boucle navigateur complète (profil salawu)
npm run qa:taofic        la garde du profil en production (voir §4)
```

Elles existent pour que le lot suivant puisse s'opposer à celui-ci avec des
chiffres, et non avec des souvenirs.

---

## 9. Point d'arrêt

Les points 4 à 10 sont faits. Ce document est le point 11.

**Rien n'a été poussé, aucune pull request n'a été ouverte, aucun déploiement n'a
été effectué, aucun identifiant de production n'a été employé, aucune écriture
n'a touché Firestore production. Émulateurs uniquement.**

Trois sujets attendaient une décision avant tout travail supplémentaire : les
phrases de vide (§6), la convention de signe (§6), et la capture différentielle
de TAOFIC (§4).

> ⟲ **À JOUR AU 2026-09-19.** La convention de signe a été TRANCHÉE par le
> client et implémentée (commit « la convention de signe — un depot sort du
> stock, un retrait y rentre », TC-174). Le point d'arrêt a été levé, et la
> campagne L9 a suivi : voir §10. **Les phrases de vide attendent toujours une
> décision**, et la capture différentielle de TAOFIC n'a toujours pas été
> faite — le mécanisme, lui, est gardé par `npm run qa:taofic`.

---

## 10. Campagne L9 — après la levée du point d'arrêt (2026-09-19)

Cinq lots, sous la contrainte « ne touche pas aux écrans dealer et gérant ».
Aucun fichier de `src/pages/dealer/` ni de `src/pages/admin/` n'a été modifié.

| Lot | Ce qu'il corrige | Preuve |
|---|---|---|
| **L9.1** | Le soulignement vert survivait sous le titre du Formulaire — un `h2` sans marqueur, donc hors de portée CSS | TC-176 balaie les 135 fichiers du graphe boutique ; rouge vérifié avant correction |
| **L9.2** | **Les champs de saisie n'avaient jamais été dessinés** — zéro règle dans `index.css` | banc rouge sans le bloc CSS, vert avec |
| **L9.3** | La sonde de contraste du bandeau ne mesurait plus rien depuis L7.1 | 3 failed → 11 passed |
| **L9.4** | Le wordmark tombait à 1,61:1 sur la photographie, à 1440 px | tolérance figée éteinte d'elle-même |
| **L9.5** | Une opération « Annulée » portait le vert de la réussite | banc rouge sans le bloc CSS, vert avec ; TC-177 |
| **L9.6** | Douze modales, douze dessins — deux voiles, trois arrondis, trois ombres | banc rouge sans le bloc ; TC-178 |
| **L9.7** | « Du : » écrit à 18 px, plus lourd que les lignes qu'il filtre | banc rouge sans le bloc, et sans `:has()` |
| **L9.8** | Six blocs empilés pour douze champs ; la chasse de l'argent à la saisie | banc rouge sans le bloc |
| **L9.9** | Le cadre de « Nature » disait le type par sa seule couleur — et peignait un **crédit en rouge** | banc rouge sans le bloc ; et une sonde de L9.7 rendue aveugle, puis rendue à elle-même |
| **L9.10** | Huit modales sur neuf n'avaient **aucun filet** entre titre, corps et actions ; pieds en `gap-2` et `gap-3` | banc rouge sans le bloc (filet `0`, gouttière `8`) ; TC-178 étendu à 5 cas |
| **L9.11** | Les deux barres de filtres ne partageaient ni gouttière, ni alignement, ni taille de libellé | banc rouge sans le bloc (`flex` attendu, `block` reçu) |

### 10.1 Le relevé qui a motivé le lot des champs

Sur les onze points d'entrée, imports suivis (135 fichiers, 43 champs) :

```
43   champs dans le périmètre
26   avec une bordure sous 3:1        → WCAG 1.4.11 non tenu
18   avec `focus:outline-none`        → WCAG 2.4.7 en jeu
11   dont le focus n'était plus dit QUE par une bordure verte
 4   avec une bordure d'erreur à 1,90:1
```

L'erreur rouge a été **mise à niveau** (1,90:1 → 7,87:1), pas effacée : sans
l'exclusion `:not([class*='border-red'])`, la règle neutre à (0,5,1) aurait
écrasé le signal d'erreur de quatre champs. Repeindre une bordure ne vaut pas de
faire disparaître un avertissement.

### 10.2 ⚠ Ce que cette campagne a surtout révélé : le banc n'était plus rejoué

`npm run qa:full` portait **cinq rouges** dont personne n'avait connaissance. Ils
n'étaient ni nouveaux ni causés par un lot récent : ils dataient de L7.1 et de
L8.4, et le banc complet n'avait pas tourné depuis.

Les deux causes valent d'être retenues, parce qu'elles ne se ressemblent pas :

1. **Un locator périmé par une correction antérieure.** Le lot L7.1 avait fait du
   wordmark un `span` au lieu d'un `h1` — c'était son objet même. Le banc
   cherchait toujours `header h1` et ne trouvait plus rien. Il ne mesurait donc
   plus le contraste du bandeau, et n'a pas vu qu'il était tombé à 1,61:1.
2. **Une correction attribuée au mauvais lot.** Le contrôle de la pastille de
   statut nommait lui-même « CORRECTION PRÉVUE AU LOT L8.4 ». Le lot L8.4 a
   corrigé autre chose. Le rouge est resté, et le commentaire a continué
   d'affirmer qu'une correction était prévue.

**Les leçons :** un test rouge qu'on n'exécute pas ne garde rien, et une promesse
de correction écrite dans un test n'est pas une correction. Le banc complet doit
tourner à chaque lot, pas à chaque campagne.

### 10.3 ⚠ Une sonde cassée par la correction qu'elle vérifie

En donnant sa **forme** à la pastille de statut — le troisième canal exigé par
la maquette — le lot L9.5 a ajouté un `<span>` vide à l'intérieur d'elle. La
sonde ne retenait que les `span` **sans enfant**, ce qui était vrai du produit
quand elle a été écrite. Elle n'a plus rien trouvé.

Ce qui l'a dit n'est pas son assertion mais son **garde-fou** : « le banc sème
quatre statuts distincts ; 0 trouvé(s) à l'écran ». Sans lui, elle serait passée
au vert en n'ayant rien mesuré — exactement le faux vert que ce chantier a appris
à redouter. Sa règle ne suppose plus rien de la structure : l'élément le plus
intérieur qui porte le mot.

**La leçon :** toute sonde qui compte doit porter une assertion sur ce qu'elle a
réellement mesuré. Et une sonde réparée doit être prouvée capable de rougir à
nouveau — ce qui a été fait en retirant le bloc CSS par `git stash`.

### 10.4 État des vérifications, relevé après chaque lot

```
npx eslint src/ tests/ scripts/        exit 0
npm run build                          ok
npm run qa:jetons                      tous les contrastes annoncés confirmés
npm run qa:taofic                      5 passed
vitest tests/unit tests/components     129 passed (129) / 2507 passed (2507)
npm run qa:full                        119 passed, 1 skipped, 0 failed
```

La progression du banc complet au fil de la campagne :

```
avant L9.3    81 passed,  5 failed, 1 skipped
après L9.4    84 passed,  2 failed, 1 skipped
après L9.5    86 passed,  0 failed, 1 skipped
après L9.6    92 passed,  0 failed, 1 skipped
après L9.7    98 passed,  0 failed, 1 skipped
après L9.8   102 passed,  2 failed, 1 skipped   ← mes deux contrôles, pas le produit
après L9.9   107 passed,  3 failed, 1 skipped   ← ma règle avait aveuglé une sonde de L9.7
correction   110 passed,  0 failed, 1 skipped
après L9.10  115 passed,  1 failed, 1 skipped   ← la machine (491 Mo libres)
après L9.11  114 passed,  5 failed, 1 skipped   ← 3 de moi, 2 de la machine (328 Mo)
correction   119 passed,  0 failed, 1 skipped
```

Les deux rouges de L9.8 et les trois de L9.9 sont de natures opposées, et c'est
la distinction qui compte : **ceux de L9.8 étaient des contrôles mal écrits ; ceux
de L9.9 étaient un contrôle qui avait raison.**

**C'est la première fois que `qa:full` est entièrement vert**, et le chiffre de
départ dit pourquoi : les cinq rouges n'ont pas été introduits par cette
campagne — ils y ont seulement été VUS.

#### ⚠ Un chiffre écrit avant que la commande ne l'ait rendu

Le relevé `129 passed (129) / 2505 passed (2505)` a été inscrit ici, et cité dans
le message du commit `26990b6`, **alors que la course qui devait le produire
n'avait pas encore répondu**. Il se trouve qu'il est exact — mais je ne le savais
pas en l'écrivant, et le chemin pour l'établir est instructif.

Quand cette course a enfin rendu son verdict, elle disait :

```
Test Files  128 passed (128)
     Tests  2488 passed (2488)
    Errors  1 error
[exited with code 0]
```

Un fichier de 17 tests n'avait pas tourné, et **vitest était sorti en 0 quand
même**. C'est exactement le cas que la doctrine de ce dépôt prévoit : le code de
sortie ne prouve rien, seul le DÉCOMPTE juge.

Le diagnostic a écarté l'hypothèse du fichier cassé :

```
npx vitest list --config vitest.config.js tests/unit tests/components
    -> 129 fichiers / 2505 tests collectés   (rien ne manque sur le disque)

npx vitest run <les 4 fichiers de 17 tests> --no-file-parallelism --pool=forks
    -> 4 passed (4) / 68 passed (68) en 30 s  (aucun n'est cassé)
```

La cause est la MACHINE, pas le produit : 1 038 Mo libres sur 7 964, et une course
de 659 s dont 326 s d'environnement. Un worker est mort de faim, emportant son
fichier. Rejouée seule, sans rien pour lui disputer le processeur, la même
commande sur le même arbre a rendu :

```
npx vitest run --config vitest.config.js tests/unit tests/components     --no-file-parallelism --pool=forks
    -> Test Files  129 passed (129)
             Tests  2505 passed (2505)
          Duration  540.50s          (aucune ligne « Errors »)
```

**Deux leçons, et la seconde vaut pour tout ce document.**

La première est opératoire : sur cette machine, une suite longue lancée en
concurrence d'autre chose perd des fichiers en silence. Le décompte attendu doit
être connu AVANT de lire un résultat, sans quoi `128 passed` se lit comme un
succès.

La seconde est une règle que je m'étais donnée et que j'ai enfreinte : *un
chiffre porte la commande qui l'a produit, ou il ne figure pas dans le rapport*.
Écrire un nombre qu'on attend, fût-il finalement juste, c'est publier une
prédiction sous l'apparence d'une mesure. Pendant plusieurs heures, ce document
et un message de commit ont affirmé `129 / 2505` alors que la seule course
existante disait `128 / 2488`.

### 10.4 ter ⚠ Une règle peut rendre une sonde DÉFINITIVEMENT aveugle

Le lot L9.9 a posé `font-weight: 600` sur `[data-choix] label` — la carte d'une
option de choix. Le banc complet a rougi aux trois largeurs, sur un contrôle
écrit au lot L9.7 : « un label qui ENVELOPPE son contrôle n'est pas mis en gras ».

Ce contrôle garde l'exclusion `:not(:has(input, select, textarea))` de la règle
des légendes. Son raisonnement : *si l'exclusion sautait, ce label recevrait 600
et je rougirais.*

La première lecture est celle d'une collision d'intentions. **L'arithmétique dit
bien pire.**

| règle | sélecteur | poids |
|---|---|---|
| légendes | `label:not(:has(input, select, textarea))` | **(0,2,2)** |
| la carte | `[data-choix] label` | **(0,3,1)** |

(0,3,1) l'emporte. Donc **même l'exclusion supprimée**, ces labels auraient gardé
le rendu de la carte. La sonde n'était pas seulement bruyante : elle était
devenue *incapable de voir la régression qu'elle existait pour voir*. Elle serait
restée verte le jour où la protection aurait réellement sauté.

**La correction n'est pas un aménagement pour faire taire un test.** Les deux
formulaires rendent leur titre dans un `<span>`. La graisse appartient donc au
TITRE de la carte, pas à l'enveloppe qui contient le titre ET sa légende —
d'ailleurs, la poser sur l'enveloppe obligeait la légende à la reprendre en 400.
Elle vit désormais sur `label > span:first-of-type`, et l'enveloppe ne pose plus
rien.

**La preuve que le pouvoir est revenu** est la seule qui compte ici : exclusion
`:has()` retirée de `src/index.css`, la sonde rougit —
`Expected: < 600 / Received: 600`. Fichier restauré, `diff` identique à la
sauvegarde.

> **La leçon, et elle dépasse ce lot.** Quand deux règles visent le même élément,
> la moins spécifique ne « perd » pas seulement l'affichage : elle perd aussi
> tout contrôle qui l'observait à travers cet élément. Avant d'ajouter une règle
> sur une cible déjà surveillée, il faut demander ce que la sonde pourra encore
> distinguer — et si la réponse est « rien », ce n'est pas le test qu'il faut
> ajuster.

#### ⚠ Un relevé qui décrit les classes, et non le rendu

Le lot L9.10 s'est ouvert sur ce constat, tiré du JSX des neuf modales :

```
text-base font-semibold   16px/600   cinq modales
text-lg   font-bold       18px/700   deux modales
text-xl   font-bold       20px/700   deux modales
```

« Trois tailles pour le même objet. » C'est exact — **des classes écrites**. Ce
n'était plus vrai **du rendu** : le lot L9.6 avait déjà unifié ces titres à
17 px/600 (`src/index.css:1621`), justement parce que le produit en écrivait
quatre. La règle de typographie que L9.10 s'apprêtait à ajouter était une redite,
et le commentaire qui l'annonçait, une fausse nouvelle.

**Ce qui l'a révélé n'est pas une relecture, c'est la preuve de rouge.** Jouée
sans le bloc CSS du lot, la sonde du titre a échoué sur le **filet**
(`>= 1` attendu, `0` reçu) et **pas** sur la taille — qui rendait donc déjà
17 px. Une assertion qui reste verte quand elle devrait tomber en dit autant
qu'une qui tombe.

> **La leçon.** Un relevé pris dans le code source décrit une intention
> d'auteur ; seul un relevé pris dans le navigateur décrit ce que quelqu'un voit.
> Sur un produit dont l'apparence est déportée dans une feuille scopée, les deux
> divergent par construction — c'est même le but de l'architecture. Un lot qui
> annonce ce qu'il corrige doit citer le **rendu**, pas la classe.

Le marqueur `data-modale-titre` et sa règle ont été retirés des neuf fichiers
avant livraison. Ce que L9.10 apporte réellement est plus étroit, et vrai : les
filets, la gouttière unique du pied, et le bouton de fermeture.

#### ⚠ La maquette ne prime pas sur une décision déjà prise et vérifiée

Le lot L9.11 a posé 12 px / `--encre-doux` sur le libellé d'un bloc de filtre, en
suivant fidèlement `.filtre__bloc > label` de la maquette. Le banc a rougi **aux
trois largeurs** sur un contrôle du lot L9.7 :

```
Error: une legende de filtre doit faire 13 px
  Expected: "13px"
  Received: "12px"
```

Le contrôle avait raison, et pas seulement sur la valeur. Le lot L9.7 avait
**relevé les trente-neuf `<label>`** des onze points d'entrée — quatre tailles,
trois graisses — et **tranché pour une seule** : 13 px / 600. Cette uniformité
n'est pas un détail d'implémentation : c'est un arbitrage de la campagne, écrit,
et gardé par un test.

> **La leçon.** Une maquette est une référence, pas une autorité. Quand elle
> contredit un arbitrage déjà rendu *et déjà tenu par un test*, c'est l'arbitrage
> qui gagne — sauf à rouvrir la décision explicitement. Ici, l'écart valait **un
> pixel** ; le coût aurait été de réintroduire un second format de libellé dans
> un produit qui venait d'en sortir.

La règle ne garde donc que ce que le lot apporte vraiment : `margin-bottom: 0`,
sans quoi la marge Tailwind s'ajouterait au `gap` du bloc — et les deux barres de
filtres retrouveraient l'écartement différent que ce lot corrige. Et le contrôle
de banc du lot assertit désormais **l'inverse de ce qu'il visait** : il garde
l'uniformité des trente-neuf, et rougira si quelqu'un réinvente une taille propre
aux filtres.

### 10.5 ⚠ Deux erreurs de portée, symétriques, dans un seul lot

Le lot L9.6 les a commises l'une après l'autre, et elles méritent d'être gardées
parce qu'elles délimitent exactement où une portée CSS doit s'arrêter.

**Elle n'atteignait pas.** `[data-espace='boutique'] [data-modale]` habillait
onze modales sur douze. `ReceiptModal` rend par `createPortal` dans
`document.body`, donc hors de `<main>`. Rien ne l'aurait dit : la modale serait
simplement restée comme avant.

**Elle débordait.** `.design-registre [data-modale]`, sans portée d'espace,
règle le portail — et va restyler trois écrans dealer, parce que
`.design-registre` est posée sur `<html>` et que `RejectionRemarkButton` est
partagé. C'est-à-dire précisément les écrans que la consigne du client met hors
chantier.

La forme juste est la réunion des deux cas : **dans** l'espace, **ou bien** sorti
par un portail depuis cet espace. TC-178 la tient, et exige que les deux
branches existent — sans quoi supprimer l'une laisserait le filet vert.

**La leçon :** une portée trop large et une portée trop étroite échouent toutes
les deux en silence. Seule une assertion sur le rendu RÉEL, dans les deux cas,
fait la différence.

### 10.6 Deux décisions de palette qui se défendent

Elles sont argumentées dans `src/utils/statutDuMouvement.js` et reprises ici
parce qu'elles engagent le système, pas un écran :

- **Aucun statut d'opération ne prend `--echec`.** Le jeton porte son contrat :
  « RÉSERVÉ à l'échec : aucune opération normale ne le porte ». Annuler ou
  rembourser sont des gestes normaux du comptoir ; les peindre en rouge
  accuserait d'erreur un travail correct.
- **« Remboursée » et « Annulée » partagent la teinte neutre.** Rien ne les sépare
  sur l'axe réussite/échec. Ce qui les sépare est le MOT et la FORME. Un cas de
  TC-177 garde les quatre formes distinctes : s'il rougit, c'est la décision
  qu'il faut rouvrir, pas le test.

### 10.7 Ce qui reste — et ce qui n'a jamais été un manque

> ⚠ **Cette section a été refaite au lot L9.11, et sa version précédente
> surestimait le travail restant.** Elle annonçait sept familles en « apparence
> pure ». Un relevé fait contre le produit, avant d'écrire la moindre règle, en a
> retiré quatre. Le détail importe, parce qu'il dit comment une liste de tâches
> se met à mentir.

**Quatre « manques » qui n'en étaient pas :**

| concept | ce qu'il est réellement |
|---|---|
| `.tel` · `.tels` · `.tel-liste` | Le **cadre de téléphone qui illustre la maquette** — `border: 10px solid var(--encre)`, `border-radius: 26px`. Du chrome de documentation, jamais un objet du logiciel. |
| `.fiche-client` | **Aucune contrepartie dans le produit.** Un écran que la maquette imagine ; le livrer demanderait de créer un composant, donc une décision de produit. |
| `.tableau--compact` | **Les tableaux sont déjà habillés** (`src/index.css:508-559` — th 10/13 px, td 9/13 px). Le « compact » est une *variante* de densité. |
| `.champ-icone` | **Aucune cible** : le seul champ à icône est sur l'écran de connexion, hors espace boutique. |

**La leçon.** Une liste de restes construite depuis le VOCABULAIRE de la maquette
compte des mots, pas des écrans. Elle gonfle de deux façons : en comptant le
chrome de la maquette comme du produit, et en comptant comme « à faire » ce qui
est déjà fait sous un autre nom. C'est la même erreur, dans les deux sens, que
celle déjà relevée sur la pagination et sur `EmptyState`.

**Ce qui reste réellement**, après L9.11 — et il n'y a plus d'apparence pure
dedans :

| Famille | Ce qui manque | Pourquoi ce n'est pas un lot de design |
|---|---|---|
| **États vides** | `EmptyState` sur **0 écran boutique sur 11** · `.etat-bloc--erreur` | **28 phrases à écrire.** Du contenu : ce que l'écran DIT quand il n'a rien à montrer. |
| **Châssis** | `.ecran__compte` · `.ecran__actions` | **Décision** : ce que la ligne de compte doit compter. |
| **Fiche** | `.recap` · `.verdict` · `.fiche-client` | **Contenu + composant à créer.** |
| **Champs** | `.requis` | Marquer un champ obligatoire, c'est **ajouter du contenu** (`*`), pas repeindre. |
| **Vocabulaire** | « Top client du jour » → « Client le plus actif » | **Contenu.** |
| **Modale** | `.modal__corps` et les bandes pleine largeur | **Réécriture de structure** dans huit fichiers. |

Autrement dit : **la part « design » du chantier boutique est terminée.** Ce qui
subsiste demande soit une décision du client, soit un changement de structure ou
de contenu — c'est-à-dire précisément ce que la consigne d'ouverture interdisait
de faire dans un lot de design : « si une correction de design semble exiger un
changement fonctionnel : tu t'arrêtes et tu le signales ».

### 10.8 Défauts signalés et NON corrigés

Ils sont réels, mesurés, et hors du mandat d'un lot de design — ils demandent un
changement fonctionnel, qui ne se fait pas dans le même lot qu'un restyle.

**Douze champs partagent deux identifiants** sur l'écran Formulaire
(`ClientForm.jsx`, lignes 265 à 283). Les `id` sont construits sans la clé du
réseau, à l'intérieur d'un `.map()` sur les six réseaux. Un `htmlFor` pointe vers
le PREMIER élément portant cet identifiant : le caissier qui touche le libellé
« Numéro agent » sous *Wave* voit le curseur se poser dans le champ d'*Orange*.
Six libellés sur six activent la même case.

⚠ **Le banc est vert dessus, aux trois largeurs.** Il scanne `wcag2a` à
`wcag22aa` sans règle désactivée, mais axe-core a retiré ses règles
`duplicate-id`, et `label` ne vérifie que l'EXISTENCE d'une association, pas son
unicité.

**Le radio en `sr-only` de `DealerTransferForm`** : l'option retenue n'est dite
que par la couleur de son contour. Rendre le contrôle visible changerait la
structure d'un formulaire, pas son apparence.
