# Bilan — refonte du design, espace boutique ESAHAF

> Point 11 de `METHODE-REFONTE-DESIGN.md` §17.2. **Point d'arrêt dur** : rien n'est
> entrepris au-delà sans nouvelle instruction.
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
  42 commits

git diff --shortstat $(git merge-base main refonte-design-esahaf)..HEAD
  206 files changed, 14100 insertions(+), 991 deletions(-)

git diff --name-only --diff-filter=A <base>..HEAD | grep -c '^tests/'
  31 fichiers de test ajoutés
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

Trois sujets attendent une décision avant tout travail supplémentaire : les
phrases de vide (§6), la convention de signe (§6), et la capture différentielle
de TAOFIC (§4).
