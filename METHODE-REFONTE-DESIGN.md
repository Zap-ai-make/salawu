# Méthode de refonte visuelle — transposable à un autre logiciel

**À qui s'adresse ce fichier.** À un agent chargé de refaire le design d'un
logiciel existant, comme il a été fait ici sur le CRM C2EGF BURKINA. Ce n'est
pas un résumé de ce qui a été fait : c'est la **méthode**, extraite du chantier
réel, avec les mesures qui prouvent chaque règle et les pièges qui ont coûté du
temps.

**Les trois conditions du chantier, avant même d'ouvrir le sommaire :**

1. **Le logiciel cible appartient à une autre entreprise.** Son identité vient
   de *son* logo. Rien des couleurs, des images ou des signatures de C2EGF ne le
   suit — voir la cloison juste en dessous.
2. **On regarde avant de coder.** Le premier livrable est une **maquette HTML**
   validée par le client (§16), pas un commit.
3. **Un espace à la fois, et l'espace boutique d'abord** (§17.1). Pas
   « le design du logiciel » : un espace, fini, montré, puis le suivant.

**Périmètre — à lire avant tout le reste.** Ce document ne parle que de
**design, UX et interface**. Aucune fonctionnalité, aucun modèle de données,
aucune règle métier, aucune architecture serveur n'est transposable d'un
logiciel à l'autre : le logiciel cible a les siens, et ils ne bougent pas. Ce
qui se transpose, c'est la **façon de regarder un écran, de décider une couleur,
et de vérifier qu'on ne s'est pas menti**.

**La règle d'or de tout le chantier :**

> Le modèle de données et le fonctionnement métier ne sont pas touchés. Aucun
> champ ajouté, renommé ou supprimé. Aucun flux de transaction modifié. Aucun
> calcul changé. Aucun rôle, aucune permission déplacés.
> **On ne change que ce qui se voit.**

---

## ⚠ Avant tout : ce qui se transpose, et ce qui ne se transpose pas

**Le logiciel cible est celui d'une AUTRE entreprise. Il a son logo, ses
couleurs, son métier, ses mots.** Rien de l'identité C2EGF ne le suit. Ce qui le
suit, c'est la manière de construire la sienne.

| Ne se transpose PAS — c'est l'identité de C2EGF | Se transpose — c'est la méthode |
|---|---|
| Le bleu `#173863` et toute sa rampe | **Le geste** : relever la couleur au pixel sur *leur* logo, en dériver une rampe à rôles nommés, écrire le contraste de chaque niveau (§3) |
| `net-orange` et les couleurs d'opérateurs télécom | **La distinction** : couleur qui décore ≠ couleur qui identifie un tiers (§4.4) |
| La photographie du bandeau, son cadrage, ses voiles | **La discipline** : imagerie choisie et non stock, poids maîtrisé, contraste mesuré sur les pixels rendus (§10.2, §14) |
| Le wordmark qui se résout du centre, le fléau des dettes | **La règle** : une seule signature, ancrée dans *leur* métier. Si rien ne vient de leur métier, **ne rien inventer** (§7) |
| `inflow` / `outflow`, « ravitaillement », « caisses », « cuves » | **La question** : quelle paire de sens opposés leur produit rend-il aujourd'hui en succès/échec par réflexe ? Quels mots emploient-ils vraiment ? (§4.1, §9) |
| Les 84 boutiques, les 187 agents du banc d'essai | **L'exigence** : garnir le banc au volume RÉEL de leur métier (§10.1) |
| Les chiffres de ce document (871 utilitaires, 12,46:1, 2 328 tests) | **L'obligation** : produire les leurs, mesurés, et les écrire (§0, Loi 3) |

> **Le test qui tranche, à se poser à chaque décision :** est-ce que je reprends
> *une valeur* de C2EGF, ou *une façon de trouver la valeur* ? La première est
> une contrefaçon d'identité, la seconde est le travail demandé. Un logiciel qui
> ressort en marine `#173863` alors que son enseigne est ailleurs, c'est
> exactement l'échec qu'on cherche à éviter : **une marque de plus, ajoutée à
> celle qui traînait déjà.**

---

## ⚠ Articulation avec les trois contrats du dépôt cible

Le dépôt cible possède déjà `AGENTS.md`, `DESIGN.md` et `ARCHITECTURE.md`.
**Ce fichier ne les remplace pas et ne les rediscute pas.**

- **`DESIGN.md` est le contrat.** Il dit *ce qui est exigé* : direction ancrée
  dans le sujet (§2), zéro esthétique générique (§1), tous les états (§10),
  accessibilité (§11), le texte comme design (§12), l'auto-critique (§14). Là où
  le présent fichier répète l'une de ses règles, c'est un rappel, jamais une
  version concurrente — **en cas d'écart, `DESIGN.md` l'emporte.**
- **`ARCHITECTURE.md` est la manière de travailler.** Son §1 (le meilleur code
  est celui qu'on n'écrit pas), son §7 (plan → validation → exécution → vérification),
  son §8 (une chose à la fois, pas de refonte opportuniste) et son §10 (les
  leçons acquises) encadrent tout le chantier. **Trois des leçons de ce fichier
  y sont déjà consignées** — le bilan qui se vérifie contre le code, le test qui
  sélectionne par une classe de style, la nécessité de regarder l'écran. Elles
  sont ici développées avec leur mesure, pas réinventées.
- **`AGENTS.md` est le point d'entrée et l'ordre de préséance.** Il place les
  non-négociables de `DESIGN.md` au-dessus de tout arbitrage de commodité, et sa
  règle 4 impose le plan avant l'exécution.

**Ce que ce fichier ajoute aux trois contrats, et lui seul :** l'ordre des
opérations sur un design déjà fait et insatisfaisant, la méthode de dérivation
d'une palette depuis un logo, la structure en quatre familles de jetons,
l'outillage de vérification, et la discipline de commit qui permet de tout
redessiner sans casser les tests.

---

## 0. Ce qu'on cherche à reproduire

Pas « faire joli ». Trois résultats mesurables, obtenus ici :

| Résultat | Chiffre atteint sur C2EGF |
|---|---|
| Une seule marque dans tout le produit | **0** couleur hors palette dans tout `src/components/`, `src/constants/`, `src/pages/store/` et `src/pages/dealer/`. Il ne reste que le back-office admin — 121 dans `src/pages/admin/`, 8 dans `AdminLayout.jsx` — qui est le dernier lot, déclaré comme tel |
| Le contraste est **mesuré**, pas supposé | 12,46:1 · 8,11:1 sur le bandeau photographique ; 16,30 · 15,44 · 8,95 · 9,73 sur le panneau d'authentification |
| Rien n'est cassé par la refonte | 2 328 tests unitaires + 297 tests de composants au vert, lint propre, build passant |

**Si le design du logiciel cible « n'est pas satisfaisant » alors qu'il a déjà
été refait**, c'est presque toujours l'un de ces trois-là qui manque — et le
plus souvent le premier : une marque qui n'a pas *remplacé* l'ancienne, mais
s'est **ajoutée** à elle. Le produit porte alors deux identités, et l'œil le
voit avant de savoir le nommer.

---

## 1. Les trois lois

Elles ne se négocient pas, et elles expliquent la forme de tout le reste.

### Loi 1 — Ne rien produire de générique

Une interface « sent l'IA » quand elle est assemblée à partir de réflexes par
défaut plutôt que de choix faits pour **ce sujet précis**.

Les trois patterns à fuir quand l'axe est libre :

1. Fond crème chaud (~`#F4F1EA`) + serif à fort contraste + accent terracotta
   (~`#D97757`). C'est le tell n° 1.
2. Fond quasi-noir + un seul accent acide (vert acid, vermillon).
3. Layout « journal » : filets fins, `border-radius` zéro, colonnes denses.

Les tics à bannir : hero « gros chiffre + petit label + 3 stats », dégradés
violet/indigo, blobs flous en arrière-plan, glassmorphism appliqué partout, tout
centré, marqueurs 01/02/03 sur du contenu qui n'est pas une séquence, copy
creuse (« Supercharge… », « Seamlessly… »), **emoji bruts en guise d'icônes**,
ombres portées molles et omniprésentes.

> **Vécu ici.** Deux blobs flous et une pastille décorative — un cadenas dans un
> cercle blanc — ont été retirés de l'écran de connexion. La pastille, posée en
> `absolute bottom-8` sur un panneau au contenu centré verticalement, passait
> **par-dessus le bouton d'appel à l'action** aux hauteurs réelles. Une
> décoration générique ne fait pas que ne rien apporter : elle finit par nuire.
> Et le cadenas ne manque à personne — une icône de sécurité sur un écran de
> connexion rassure sans rien prouver.

### Loi 2 — La couleur ne porte jamais seule une information

Contraste WCAG AA minimum (4,5:1 texte normal ; 3:1 grand texte et composants
d'interface). Toute information portée par une teinte est **doublée** d'un mot,
d'une icône ou d'une forme.

C'est cette loi qui a produit les deux seuls motifs CSS sur-mesure du projet :

- **La hachure** (`.fleau-compensable`) — la part compensable d'une dette est
  hachurée, et non d'une troisième couleur. La hachure survit au daltonisme, au
  contraste réduit et à l'impression en noir et blanc ; une troisième teinte,
  non. Le libellé de la légende la double en toutes lettres.
- **Le cran** (`.piste-cran`) — une barre qui dépasse le plafond de l'échelle
  porte une **dentelure** au bord droit. C'est une forme, pas une teinte ; la
  barre garde sa couleur de ressource, et le montant exact reste écrit à côté.

### Loi 3 — Terminé = vérifié, et vérifié = mesuré

« Ça compile » n'est pas « ça marche ». Pour de l'interface : on **regarde le
rendu**, et on mesure tout ce qui se mesure.

> **Vécu ici, deux fois.** L'estimation de contraste faite à la main était
> fausse **de plusieurs points**. Le fond est une photographie sous deux voiles
> dégradés : le contraste dépend du pixel, pas d'une couleur qu'on pourrait
> poser dans une formule. Une sonde masque désormais le texte, capture le fond,
> et cherche le pixel le plus clair sous l'emprise de chaque ligne — le seul cas
> qui compte pour WCAG.
>
> Et le corollaire, appris à ses dépens : **une mesure fausse qui annonce la
> réussite est pire que pas de mesure du tout.** Étendue au panneau
> d'authentification, la sonde échantillonnait des zones **hors de la capture**
> — et du vide se lit `rgb(0,0,0)`, soit un parfait 21:1 sur les quatre lignes.
> Elle a depuis un garde-fou qui **crie** quand une zone sort du cadre.

---

## 2. Phase A — Avant de toucher au dessin

### A.1 — Poser le filet (tests de caractérisation)

On fige le comportement **avant** de le déplacer. Sur ce chantier : 7 fichiers
de caractérisation posés avant le premier pixel, puis 24 tests supplémentaires
pour les quatre écrans qu'aucun test ne couvrait — dont l'écran d'accueil.

**La règle qui rend ces tests utiles : jamais d'assertion sur une classe CSS.**
Un test qui vérifie `border-green-300` interdit précisément le travail qu'on
vient faire. On asserte sur le **texte visible**, les **rôles ARIA**, les **noms
accessibles**, les **montants rendus** — jamais sur le dessin.

**Figer aussi les défauts trouvés en chemin.** Trois défauts ont été figés *tels
quels*, avec un test qui les nomme, pour pouvoir prouver plus tard qu'ils ont
été corrigés et non déplacés. Quand le lot correcteur arrive, le test est
retourné : il **exige** la correction et nomme le défaut qu'il remplace.

### A.2 — Relever l'état réel, zone par zone

Un simple comptage, par dossier, de ce qui sort de la marque : les familles de
couleurs Tailwind brutes (`green`, `red`, `blue`, `orange`, `teal`, `amber`,
`purple`, `indigo`, `yellow`, `emerald`, `pink`), les valeurs hex en dur, et les
emoji bruts dans le JSX.

Le relevé de ce chantier, pour donner l'échelle :

| Zone | Au relevé | Aujourd'hui |
|---|---|---|
| `src/pages/store/` (3 écrans) | 96 | **0** |
| `src/pages/dealer/` + `components/dealer/` | 144 | **0** |
| `src/components/auth/` + `authStyles.js` | — | **0** |
| `src/components/` (tout le reste) | ~140 | **0** |
| `src/pages/admin/` (11 écrans) | 121 | 121 — *dernier lot, non entamé* |
| `src/layouts/` | 18 | 8 — *tous dans `AdminLayout.jsx`* |
| `constants/networkConfig.js` | 42 | 42 — **et elles restent** (voir §4.4) |

Ce tableau devient le tableau de bord du chantier. Chaque lot le fait descendre,
et la colonne se termine par des zéros. **Une zone non traitée y reste inscrite
avec son chiffre** : c'est ce qui distingue un chantier en cours d'un chantier
qui se croit fini.

### A.3 — ⚠ Le piège du relevé incomplet

Le premier relevé de ce chantier n'a compté que les fichiers `src/pages/*.jsx`
et a annoncé « Clients 0 · Formulaire 0 · Historique 1 ». Le compte réel était
d'environ **140** : les écrans sont faits par des **composants**, pas par les
fichiers de page. `TransactionForm` en portait 21, `TransactionTable` 16,
`HistoriqueTable` 11, `TableRow` 10 — dont un bouton d'import **violet** et un
export **bleu** sur un écran annoncé à zéro.

**Compter les pages ET les composants qui les font.** Sinon le bilan est faux,
et tout ce qui s'appuie dessus l'est aussi.

---

## 3. Phase B — La palette, tirée du logo

C'est le cœur de la demande, et c'est ce qui fait qu'un produit *appartient* à
un client. Cinq gestes.

### B.1 — Relever la couleur sur le logo, pas l'approximer

Le bleu `#173863` a été **relevé sur `logo.jpeg`**. Pas choisi « dans les tons
du logo » : prélevé au pixel, sur l'aplat le plus large et le plus saturé de la
marque.

Une méthode sans outil graphique, avec le chromium déjà installé pour la QA :
charger le logo dans un `<canvas>`, lire `getImageData`, et construire un
histogramme des teintes en **ignorant les pixels quasi-blancs et quasi-noirs**
— un logo est souvent majoritairement blanc, et la moyenne des pixels ne donne
jamais la couleur de marque.

Ce qu'on cherche : la teinte que **le client reconnaît comme la sienne** quand
il voit son enseigne.

### B.2 — Une seule valeur, un seul endroit

`#173863` est aussi le `theme_color` du manifeste PWA. La consigne est écrite en
haut du fichier de jetons :

> « C'est la MÊME valeur que le `theme_color` du manifeste PWA
> (`vite.config.js`) : les deux ne doivent jamais diverger. »

Tout endroit qui a besoin de la couleur de marque la **dérive**. Si une valeur
hex apparaît deux fois dans le dépôt, l'une des deux finira par mentir.

### B.3 — Dériver une rampe, pas une couleur

Six niveaux suffisent, et chacun a un **rôle nommé**, pas un numéro décoratif :

```css
--color-brand-50:  #f2f5fa;  /* fond d'application */
--color-brand-100: #dde5f0;  /* surface teintée, en-tête de tableau */
--color-brand-200: #c3d0e4;  /* filets, bordures */
--color-brand-400: #2760a5;  /* éclairci — lien, anneau de focus, état actif */
--color-brand-500: #173863;  /* base — navigation, bouton primaire */
--color-brand-600: #0f2745;  /* assombri — survol, état pressé */
```

**Chaque niveau est vérifié au contraste, et le chiffre est écrit dans le
fichier** : `brand-500` 11,78:1 · `brand-400` 6,36:1 · `brand-600` 15,04:1. Un
niveau qui ne passe pas AA ne sert pas au texte, et le commentaire dit pourquoi.

### B.4 — Retinter les neutres vers la teinte de marque

Le geste qui fait le plus de différence visuelle pour le moins de travail, et
qui est presque toujours oublié.

Les gris par défaut de Tailwind tirent vers le vert-de-gris. À côté d'un marine,
ils jurent. On **redéfinit la rampe `gray` existante** au lieu d'ajouter une
rampe de plus :

```css
@theme {
  --color-gray-50:  #f7f9fc;   /* décalés vers la teinte du bleu de marque (214°) */
  --color-gray-100: #eff2f7;   /* saturation très basse : ce sont des neutres,    */
  --color-gray-200: #e1e6ef;   /* pas une seconde couleur                         */
  /* … */
  --color-gray-900: #0f1725;
}
```

**Résultat : 871 utilitaires gris répartis dans 84 fichiers sont retintés par 11
déclarations CSS. Zéro fichier `.jsx` touché.**

La contrainte à tenir, et à vérifier : **aucun niveau ne perd en contraste** par
rapport au défaut Tailwind. Ici, `gray-500` passe de 4,84:1 à 5,03:1 (117
usages, c'est le niveau des textes secondaires), `gray-600` de 7,56 à 7,81,
`gray-700` de 10,30 à 10,64. Le niveau 400 reste sous AA (2,65:1) comme dans
Tailwind : il ne sert qu'aux états désactivés, que WCAG exempte.

**Ce qu'on ne fait PAS avec ce coup-là.** Retinter la rampe `green` d'un trait
toucherait aussi les badges de succès, qui deviendraient marine. **Ce serait
détruire le sens pour gagner du temps.** Le vert se traite à la main, fichier
par fichier.

> **La règle générale à retenir : le coup de rampe ne s'applique qu'aux couleurs
> qui ne portent aucun sens — les neutres, et eux seuls.**

### B.5 — Un seul thème embarqué

Ce produit portait **sept** thèmes. Aucun sélecteur de thème n'existait dans
l'application : ils n'étaient atteignables **qu'en éditant `localStorage` à la
main**. Ils portaient du vert, du violet et du bleu hors marque — invisibles
pour l'utilisateur, mais comptés par tout audit de couleur, et prêts à réapparaître.

Les six sont partis. Il en reste un, et l'axe de variation client **reste
ouvert** : un futur client ajoute SON entrée dans `THEMES` et la nomme dans son
profil, sans éditer un seul composant.

> **Le même piège en plus grand, dans l'authentification.** `authStyles.js`
> portait `THEME_VARIANTS` : **deux thèmes complets**, un `primary` marine et un
> `secondary` violet, consommé cinq fois par le seul formulaire d'inscription.
> Repeindre le violet en bleu aurait laissé en place un axe de variation sans
> raison d'être dans un produit à une seule marque — et qui serait revenu au
> premier composant distrait. `THEME_VARIANTS` est parti **en entier** ; ses
> quatre consommateurs pointent désormais sur des styles nommés par leur
> **rôle**.
>
> **La leçon, et elle est centrale : quand une couleur hors marque revient,
> chercher la *structure* qui la produit avant de repeindre l'occurrence. On ne
> repeint pas un symptôme.**

---

## 4. Phase C — Les jetons : quatre familles qui ne se mélangent pas

C'est la pièce maîtresse. Tout le reste du chantier en découle.

```
brand-*                                  le CHROME
                                         navigation, bouton primaire, lien, focus

canvas / surface / line / ink /          la STRUCTURE et le texte
ink-muted

inflow / outflow / warn / danger /       le SENS sémantique, et uniquement lui
pending / success

net-*                                    l'IDENTITÉ d'un tiers,
                                         RÉSERVÉE AUX DONNÉES
```

Un jeton d'une famille ne sert jamais au travail d'une autre. C'est cette
séparation qui fait qu'une palette tient dans le temps.

### 4.1 — `inflow` / `outflow` ne veut pas dire « bien / mal »

La distinction la plus importante du chantier, et celle que l'application
d'origine confondait.

> `TRANSACTION_STYLES` disait : dépôt **vert**, retrait **bleu**, crédit
> **rouge**. Le rouge accusait d'erreur une opération parfaitement normale.

Un retrait n'est pas une erreur : c'est un mouvement d'argent dans l'autre sens.
D'où deux jetons distincts, et le commentaire qui l'explique dans le fichier :

```css
/* Dépôt : l'agent apporte des espèces, la liquidité entre. */
--color-inflow:       #0f7a52;
--color-inflow-soft:  #e6f4ee;
/* Retrait : l'agent repart avec des espèces, la liquidité sort. */
--color-outflow:      #8a3324;   /* terre brûlée — distinct du rouge d'échec */
--color-outflow-soft: #fbecea;

--color-danger:       #a01b1b;   /* échec, rejet, suppression */
```

**Transposition :** dans le logiciel cible, identifier l'équivalent. Tout produit
a une paire de sens opposés que le design d'origine a rendus en succès/échec par
réflexe — entrée/sortie, envoi/réception, ouvert/fermé, ajout/retrait. Les
séparer du couple succès/échec est souvent le geste qui rend l'écran lisible.

### 4.2 — Deux sens distincts méritent deux noms, même à couleur égale

```css
/* `success` partage aujourd'hui la teinte de `inflow`, et ce n'est pas un
   doublon : une opération réussie n'est pas une entrée d'argent. Deux sens
   distincts méritent deux noms, quitte à ce qu'ils rendent la même couleur —
   c'est ce qui leur permettra de diverger sans réécrire les appelants. */
--color-success:      #0f7a52;
```

### 4.3 — Un jeton sémantique n'est pas neutre au fond qui le porte

> **Vécu ici.** L'anneau d'alerte d'une cuve basse était `ring-warn` (`#8a5a00`)
> — une teinte pour fond **clair** : invisible sur le marine de la barre
> latérale. La paire `warn` / `warn-soft` existe précisément pour ça.

Et le cas extrême, quand le repère traverse **trois** fonds différents :

```
ink-muted sur la piste vide (#dde5f0)   4,84:1   lisible
ink-muted sur le stock (#ff6b35)        2,17:1   faible
ink-muted sur la liquidité (#2760a5)    1,03:1   INVISIBLE
```

« Invisible sur la liquidité » voulait dire invisible sur la moitié des lignes —
et justement celles qu'on voulait pouvoir écarter d'un coup d'œil. **Un filet
qui disparaît là où il compte n'est pas un filet.**

La solution : un filet de 3 px qui **porte son propre contraste** — un cœur
sombre entre deux liserés de surface. Quel que soit le fond, le contraste
cœur/liseré reste de 17:1 ; le repère ne dépend plus de ce qu'il traverse.

### 4.4 — Les couleurs d'identité d'un tiers sont des DONNÉES, pas du chrome

`net-orange` (`#FF6B35`) est la couleur de l'opérateur Orange. Elle **ne sert
jamais** de couleur de chrome ni de couleur de texte. Raison **mesurée**, pas
préférence :

> `#FF6B35` sur blanc plafonne à **2,84:1** — sous le 4,5:1 exigé pour du texte,
> et même sous le 3:1 des composants d'interface. Elle n'a droit qu'aux
> pastilles et aux séries de graphique, **toujours doublées du nom de
> l'opérateur en toutes lettres**.

> **Vécu ici.** `OfflineBanner` utilisait l'orange plein de l'opérateur en fond
> — une teinte réservée aux données, employée comme chrome. Corrigé.

De même, les 42 couleurs de `networkConfig.js` (six opérateurs en arc-en-ciel)
**restent** : ce sont des données d'identité, pas du chrome. Leur sort se décide
avec le sujet « multi-réseau », pas dans un lot de restyle.

**Transposition :** dans le logiciel cible, faire le tri entre les couleurs qui
*décorent* (à remplacer) et celles qui *identifient un tiers* — un fournisseur,
une marque partenaire, un statut réglementaire. Les secondes sortent du
périmètre du restyle et le document le dit explicitement.

### 4.5 — ⚠ Le piège Tailwind v4 : les jetons lus depuis JavaScript

Tailwind v4 n'émet que les variables réellement **utilisées** dans du texte
scanné. Un jeton lu depuis JS (attribut `fill` d'un graphique, par exemple)
n'apparaît dans aucun utilitaire et se fait **élaguer du CSS produit** :

```css
@theme static {          /* `static` force l'émission */
  --color-net-orange: #ff6b35;
}
```

Et le corollaire, qui est un vrai piège de documentation :

> Tailwind v4 balaie le texte brut du projet — **les fichiers `.md` compris**.
> Tant qu'une classe morte restait écrite dans le journal de refonte, la règle
> continuait d'être émise dans le CSS livré : **le document était, à lui seul,
> la dernière raison de vivre d'une couleur morte, hors palette et sous le seuil
> de contraste.**

---

## 5. Phase D — Le châssis : une structure, pas cinq

Avant de redessiner les écrans, on unifie ce qui les porte. C'est peu de code et
beaucoup d'effet.

### 5.1 — Un seul châssis de page

> **Vécu ici.** Deux écrans ouvraient chacun un second châssis
> (`min-h-screen bg-gray-100` + `max-w-7xl mx-auto px-4 py-6`) **à l'intérieur**
> du `<main>` du Layout : fond gris par-dessus le canvas, gouttière doublée,
> bord gauche qui ne tombait pas au même endroit d'un onglet à l'autre.

**La largeur et la gouttière appartiennent au Layout.** Un écran ne les
redéclare jamais.

### 5.2 — Un seul `h1`, un seul dessin de titre

Cinq écrans portaient **quatre traitements différents** : `text-3xl` souligné
`border-b-2 border-green-500` pour deux d'entre eux, `text-2xl` souligné
`border-current` pour un autre, un bloc fait main pour le dernier. Tous passent
par un composant `PageHeader` **qui existait déjà** et servait onze écrans.

Le filet sous le titre est parti avec eux : *il ne disait rien que l'espace ne
dise déjà, et un filet sous chaque titre est précisément le tic « journal »*.

### 5.3 — Les tableaux

> **Vécu ici.** Chaque cellule de chaque tableau portait `border border-green-300`
> — un **quadrillage complet** hérité du produit d'origine.

Ce qui l'a remplacé : filets **horizontaux** seulement, en-tête teinté de la
couleur de marque, et montants en `tabular-nums` alignés à droite, **en-têtes
compris**.

### 5.4 — La hiérarchie des actions

> **Vécu ici.** Trois actions de ligne en orange, bleu et vert — *trois couleurs
> pour trois actions de même rang*.

Elles partagent désormais un dessin secondaire, et **une seule** action est
primaire par écran. Une couleur d'action dit le **rang**, jamais la nature.

### 5.5 — Les espaces se distinguent par leur STRUCTURE, pas par leur couleur

Le produit avait un bleu pour l'administration et un vert pour le dealer :
**deux identités dans un même produit, pour une information déjà donnée par le
texte**. Les trois espaces se distinguent maintenant par leur agencement — rail
latéral ici, navigation haute là — et par leur libellé écrit en toutes lettres.

---

## 6. Phase E — Les états, tous dessinés

**Non négociable.** Un écran n'est pas terminé tant que tous ses états ne sont
pas conçus, pas seulement le cas idéal :

```
vide · chargement · clairsemé · dense · erreur · erreur PARTIELLE ·
permission refusée · désactivé · optimiste · périmé · destructif ·
variantes responsives
```

Les règles qui ont fait la différence ici :

**Le squelette a la FORME du contenu qui arrive.** Un squelette de trois cartes
devant un tableau fait *sauter* la page à l'arrivée des données. Un squelette de
tableau ne saute pas.

**Il y a deux vides, pas un.** « Rien » invite à enregistrer un premier élément.
« Rien qui corresponde » propose d'effacer les filtres. Ce ne sont pas le même
écran, et confondre les deux laisse l'utilisateur sans issue.

**L'état vide est une invitation à agir, pas un trou.** Sur ce chantier, le
composant `EmptyState` avait une prop `action` **qu'aucun appelant ne lui
passait** : il savait proposer une issue, personne ne lui en donnait. Et son
message secondaire était en `text-gray-400` — 2,65:1, sous le seuil : *l'explication
du vide était la ligne la moins lisible de l'écran*.

**L'erreur partielle est un état à part entière.** « 3 caisses sur 84 illisibles » :
les 81 autres restent affichées, et **la somme refuse de se rapprocher tant
qu'elle est incomplète**. Un total faux qui s'annonce juste est pire que pas de
total.

**Le dense se vérifie en dense.** Un écran vérifié à trois lignes ne prouve rien
à quatre-vingt-quatre.

---

## 7. Phase F — La signature : toute la hardiesse à un seul endroit

C'est ce qui fait qu'un design est mémorable au lieu d'être seulement correct.
Et c'est aussi ce qui fait qu'il reste calme : **on dépense sa hardiesse à un
seul endroit, et tout le reste est discipliné.**

Deux signatures ont été créées ici, et elles sont toutes deux **ancrées dans le
métier** — jamais décoratives.

### 7.1 — Le fléau (l'écran des dettes)

Une ligne de zéro verticale, partagée par toutes les lignes de la liste. Ce que
je dois pousse à gauche, ce qu'on me doit pousse à droite, et chaque partenaire
est une poutre qui penche. **La compensation est très exactement le geste de
ramener la poutre au zéro : la mécanique du produit EST le dessin**, au lieu
d'être expliquée à côté.

Le raisonnement qui l'a fait préférer au réflexe :

> « Gros chiffre + petit label » est le tic à fuir, et surtout il ne répond pas
> à la question posée : deux totaux disent **combien**, jamais **avec qui**. Or
> un règlement se fait avec une boutique, pas avec un total. Les totaux restent
> — en tête, petits — parce qu'ils servent de repère, pas de réponse.

Et l'accessibilité qui va avec : les poutres sont masquées de l'arbre
d'accessibilité (elles redisent en dessin un montant déjà écrit), mais le nom
accessible de chaque ligne porte le sens **complet** — « Gounghin : je dois
135 000 FCFA de plus qu'on ne me doit » — parce qu'« un moins cent trente-cinq
mille » ne dit pas de quel côté penche la poutre.

### 7.2 — L'arrivée du bandeau

Le nom ne paraît pas, il se **résout** : du centre vers les bords, chaque lettre
montant derrière son propre masque.

Pourquoi du centre : l'entreprise est un distributeur, le flux descend de
l'opérateur vers la centrale puis vers les succursales. La marque est exactement
au-dessus du centre du nom, et la propagation part de là. **Le décalage se
calcule donc sur la distance au centre, jamais sur la position** — un décalage
par position produirait une vague de gauche à droite, c'est-à-dire *un effet*,
là où l'on veut *un énoncé*.

**Transposition :** chercher dans le métier du logiciel cible le geste, le
mouvement ou la relation que l'interface peut *montrer* au lieu d'expliquer.
Une balance qui penche, un flux qui descend, une file qui se vide. Si rien ne
vient, **ne rien inventer** : une signature plaquée est pire qu'aucune.

---

## 8. Phase G — Le mouvement est une couche, jamais une condition

Quatre règles, toutes apprises par un défaut.

**1. Tout en CSS, si c'est possible.**

> Une première version passait par GSAP et son greffon SplitText : **31,9 Ko
> gzip** transférés à chaque visiteur, plus un banc de rendu et quatre paquets
> de développement, pour ce que trois `@keyframes` font sans un octet. Le
> retrait n'a rien enlevé au rendu — **il a enlevé des défauts**.

**2. Le découpage est déclaratif, pas une mutation du DOM.**

> SplitText remplaçait le contenu du wordmark **après** le rendu. Il fallait
> défaire cette mutation au démontage, et cette mécanique de restauration a
> causé le seul défaut visible du chantier : **le bandeau s'est affiché sans son
> logo, définitivement**, parce qu'un `kill()` n'avait pas rendu un style en
> ligne. React montant deux fois en développement, la seconde séquence lisait
> l'état de départ (`opacity: 0`) comme son état d'arrivée.

En rendant les lettres depuis le composant, il n'y a rien à défaire, rien à
nettoyer, aucun remontage à craindre.

**3. L'état d'arrivée EST l'état statique.** `animation-fill-mode: backwards`
n'est pas décoratif : sans lui, l'élément s'affiche dans son état final pendant
tout le délai, **puis saute** à son état de départ pour s'animer. C'est ce mode
qui tient la promesse : le mouvement est une couche, et ce qu'on obtient à la
fin est exactement ce qu'obtient quelqu'un qui a demandé moins de mouvement.

**4. `prefers-reduced-motion` est traité dans le CSS, pas en JavaScript.** Une
animation déclarative n'a besoin d'aucune décision JS pour se taire.

**Et l'accessibilité du découpage :** le conteneur porte le nom entier en
`aria-label`, l'empilement de lettres est masqué de l'arbre d'accessibilité. Un
lecteur d'écran annonce « C2EGF BURKINA », **jamais « C 2 E G F »**. L'espace
entre les mots doit être **insécable** : dans une suite de blocs en ligne, une
espace ordinaire se réduit à rien et le nom se lit « C2EGFBURKINA ».

---

## 9. Le texte fait partie du design

Souvent la moitié du gain ressenti, pour presque aucun code.

- **Écrire du point de vue de l'utilisateur.** On nomme ce que la personne
  contrôle et reconnaît, jamais la plomberie technique.
- **Voix active, sentence case, zéro remplissage.** Un bouton dit exactement ce
  qui se passe.
- **Un mot d'action garde le même nom dans tout le flux.** Ici :
  « Confirmer le ravitaillement » → « Ravitaillement confirmé : … ». Le bouton
  disait « Vérifier » et le message de retour disait autre chose ; désormais les
  deux emploient le même mot.
- **Un verbe sans objet est tout ce qu'entend un lecteur d'écran** qui parcourt
  les boutons d'un formulaire. « Vérifier » seul ne dit rien.
- **Les capitales tombent.** « SE CONNECTER » et « S'INSCRIRE » sont devenus des
  phrases.
- **Les erreurs ne s'excusent pas et ne sont jamais vagues.**
- **Les règles s'annoncent avant la saisie**, pas après l'échec. La contrainte
  des 8 caractères est affichée sous le champ, pas en message d'erreur.
- **Les champs ont de vraies étiquettes**, pas seulement un placeholder — qui
  disparaît à la première frappe et n'a jamais rien dit à la saisie automatique.
- **Une phrase bascule en entier, verbe compris.** « 3 caisses n'**aont** pas pu
  être lues » : une pluralisation assemblée par morceaux, sur un avertissement
  qui parle d'argent manquant. Deux occurrences corrigées.
- **Les libellés vivent dans un fichier de constantes**, jamais éparpillés. Un
  libellé qui change se change à un seul endroit.
- **Changer un mot n'est pas un restyle** : c'est un changement déclaré, qui
  touche des chaînes visibles et donc des tests. Il ne se mélange à aucun commit
  de dessin.

**⚠ Le piège du dictionnaire partagé.** Un dictionnaire de libellés partagé
entre plusieurs espaces ne peut pas porter deux genres grammaticaux. Le scinder
pour préserver l'accord dans un espace hors chantier créerait exactement la
duplication qu'on veut supprimer. La solution employée : **citer le libellé
entre guillemets**, ce qui l'isole de l'accord — « Aucun ravitaillement avec le
statut « Rejetée » ».

---

## 10. La boucle de vérification : quatre sondes

C'est l'outillage qui a rendu ce chantier vérifiable. **Chacune de ces sondes a
trouvé au moins un défaut qu'aucun test, aucun lint et aucune relecture ne
voyaient.** Elles sont versionnées, donc rejouables.

### 10.1 — Le banc d'essai visuel

Un serveur de développement éphémère monte un banc garni de **données
plausibles** — ici 187 agents, ~3 600 opérations sur 30 jours à la cadence
réelle, et 84 boutiques.

Trois propriétés le rendent utile :

1. **Il monte l'écran RÉEL, pas une maquette.** Une maquette dérive du produit ;
   le banc ne peut pas.
2. **Il sait substituer l'accès aux données.** Certains écrans lisent la base au
   montage ; sans doublure, on ne peut pas les regarder — et ce sont justement
   ceux qu'on aurait le plus besoin de voir.
3. **Une adresse suffit à servir une variante** : `?demandes=vide`,
   `?caisses=erreur-partielle`, `?espace=dealer&cuves=basses`. **Parce que l'état
   vide est celui qu'on dessine le plus soigneusement et qu'on regarde le
   moins.**

⚠ **Deux précautions.** Le banc doit être **absent du build**, vérifié à chaque
fois. Et l'alias des doublures vit dans le script du banc, **jamais dans la
config du projet** : un alias de configuration s'appliquerait à toute la
construction, y compris celle qui part en production.

### 10.2 — La sonde de contraste (sur les pixels réellement rendus)

Pour tout texte posé sur une **photographie** ou un dégradé, le contraste ne se
calcule pas. Méthode : monter le banc, relever l'emprise réelle de chaque ligne
de texte, **masquer ce texte** (sinon les bords anticrénelés des lettres
polluent l'échantillon), capturer, et chercher le **maximum de luminance** dans
chaque rectangle — le pire cas est le seul qui compte.

⚠ **Trois précautions apprises :**
- **Coordonnées de page, pas de fenêtre**, avec capture pleine hauteur — sinon
  on échantillonne du vide, et du vide se lit 21:1.
- **Un garde-fou qui échoue bruyamment** quand une zone sort du cadre.
- **Mouvement réduit forcé**, sinon la mesure dépend de l'instant où elle tombe :
  la séquence d'arrivée décale une ligne de 8 px, et huit pixels plus haut sur
  une photographie, ce ne sont pas les mêmes pixels (8,11:1 ou 7,99:1 selon la
  course du navigateur).

### 10.3 — La sonde de débordement horizontal

Un débordement ne se voit **pas** sur une capture pleine page : celle-ci
s'élargit pour tout contenir, et l'image paraît normale. Il faut le mesurer.

**Méthode : l'extinction dichotomique.** On éteint un sous-arbre, on relit
`document.documentElement.scrollWidth` : ce qui la fait retomber est le
coupable. On répète en descendant jusqu'à la feuille fautive.

> **Pourquoi pas un raisonnement.** Une première version raisonnait *par
> ascendance* — « un élément large dont un ancêtre défile est contenu, donc
> innocent ». Le raisonnement est **faux** pour les éléments absolus, et il a
> laissé passer le cas réel : un `<span className="sr-only">` dans un `<th>`
> **élargissait la page de 645 px**. `sr-only` place son contenu en
> `position: absolute` ; **sans ancêtre positionné, son bloc conteneur est la
> page** — le span échappait au cadre défilant du tableau et allait se poser à
> la largeur réelle de celui-ci. Un texte invisible d'un pixel. Corrigé par
> `relative` sur le `th`.
>
> **Elle ne raisonne plus, elle mesure.**

Et l'autre débordement, trouvé au même endroit : **un enfant de grille garde
`min-width: auto`** — il s'élargit jusqu'à tenir son contenu, et un
`overflow-x-auto` placé *à l'intérieur* ne se déclenche jamais. Correctif :
`min-w-0` sur le jeton de carte.

### 10.4 — La sonde de mouvement

Elle mesure **une seule chose, et elle est exigeante** :

> L'état **après** la séquence doit être **rigoureusement** celui qu'obtient une
> personne ayant demandé le mouvement réduit.

Deux captures comparées **au hash près** : un pixel d'écart, et la couche a fui.
C'est elle qui a mesuré, sur une version antérieure, que des montants devenaient
**plus flous après la séquence qu'avant** — un `transform` résiduel promeut le
nœud en couche composée et change l'anticrénelage du texte. Invisible à l'œil,
parfaitement mesurable.

Elle vérifie de surcroît que le nom reste **annonçable** par un lecteur d'écran.

---

## 11. La discipline de commit — la règle qui protège les tests

**C'est la règle qui a permis de refaire tout le design sans casser 2 328
tests.** Elle est courte :

> Chaque commit est **soit** un restyle pur, **soit** un changement déclaré —
> jamais les deux.
>
> Dans un commit de restyle, **la seule chose autorisée à changer est la valeur
> d'une chaîne `className`**.
>
> Après les tests, on lit le diff : toute ligne modifiée qui n'est pas un
> `className` sort du commit, ou le commit change de nature et le dit.

Un changement déclaré (un mot qui change, une colonne qui disparaît, un
composant supprimé) touche des chaînes visibles et donc des tests. Il est annoncé
dans le message de commit, et les tests mis à jour sont **nommés**, avec le
pourquoi.

**Méthode de modification, à chaque fois :** explorer ; citer fichiers et lignes ;
décrire le comportement actuel ; évaluer le risque ; écrire un test reproductible
**avant** la correction ; appliquer une correction minimale ; lancer lint, tests
et build ; **examiner le diff**.

---

## 12. Le journal — et comment il ment

Un fichier de bilan tenu au fil du chantier (`REFONTE.md` ici) : ce qui est
fait, ce qui reste, ce qui attend une décision, ce qui est hors de mon contrôle.

**La règle apprise à ses dépens, et elle est la plus importante du fichier :**

> **Un bilan se vérifie contre le code, jamais contre ses propres messages de
> commit.**

Le bilan de ce chantier a affirmé trois choses fausses, dont celle-ci :

| Ce qui était écrit | Ce qui était vrai |
|---|---|
| « `THEMES` : 7 entrées → 1 » | Il en restait **6**. Le message du commit le disait lui-même : « les six autres thèmes sont CONSERVÉS ». **Le bilan contredisait son propre commit.** |
| « Ce qui reste n'est pas de la couleur » | Le comptage ne portait que sur les pages, pas sur les composants. Compte réel : ~140. |
| « `OptimisticToast.jsx` — corrigé » | Ce fichier **n'avait jamais été modifié**. Le défaut était intact. |

Et un cas de figure voisin, sur les tests :

> Le premier relevé de baseline annonçait 1 858 tests. Cette exécution s'était
> terminée sur « 7 errors — Timeout waiting for worker to respond », écartés
> comme un incident : c'était une exécution **dégradée**, qui sous-comptait huit
> fichiers. **Une mesure qui s'accompagne d'erreurs n'est pas une mesure, même
> quand la ligne de résumé affiche « passed ».**

---

## 13. Fin de campagne — la règle qui empêche l'arc-en-ciel de revenir

Une fois les couleurs hors palette à zéro, une règle de lint (`no-restricted-syntax`
ou équivalent) refuse les familles de couleurs brutes dans `src/`.

Trois conditions pour qu'elle tienne :

1. **Le message d'erreur nomme le jeton à employer à la place.** Une règle qui
   dit seulement « interdit » se contourne ; une règle qui dit « utilise
   `inflow` » **enseigne**.
2. **Elle excepte les fichiers de couleurs d'identité de tiers** (§4.4) — ce sont
   des données, pas du chrome.
3. **Elle se pose APRÈS le dernier lot de restyle, jamais avant.** Sinon elle
   bloque le travail qu'elle doit protéger. *Une règle partielle qui tient vaut
   mieux qu'une règle totale désactivée* : si un espace n'est pas encore repris,
   restreindre la règle aux dossiers déjà nettoyés et l'élargir ensuite.

---

## 14. Les défauts que seule la capture pouvait montrer

Réunis ici parce qu'ils sont la meilleure justification de la boucle visuelle.
**Aucun n'apparaissait dans un test, un lint ou une relecture.**

| Défaut | Leçon |
|---|---|
| Une teinte de ligne introduite puis **retirée dans le même lot** : à quarante lignes, l'historique devenait un aplat rose et vert où la couleur ne distinguait plus rien. | Une idée juste à trois lignes peut être fausse à quarante. **Regarder en dense.** |
| Un statut « annulé » s'affichait en **vert**, comme un validé — pastille `bg-success-soft` écrite en dur. | La couleur affirmait le contraire du mot qu'elle entourait. |
| Le filet du seuil **dérivait de 4,7 px** sur 84 lignes : la colonne des montants était dimensionnée à son contenu. | Un repère partagé n'existe que si la sonde le mesure. Largeur fixe → amplitude **0,00 px**. |
| À 390 px, le résumé tronquait « FCFA » **puis le mot « bas »** — le seul signal d'alerte, sur l'écran où il compte le plus. | **Ce qui rétrécit doit être le nombre, jamais l'alerte** (`shrink-0`). |
| Le squelette de chargement montrait trois **cartes** quand le contenu qui arrive est un **tableau** : la page sautait. | Le squelette a la forme du contenu. |
| Une image de fond de **1 805 921 o** livrée telle quelle. | Ré-encodée en JPEG 1920 × 560 : **90 930 o, −95,0 %**. Et exclue du précache : *une décoration de bureau n'a pas à être téléchargée à l'installation.* |
| Le **cadrage** d'un bandeau de 220 px : centré, il tombait sur la zone sombre de la photo. | Un bandeau ne montre qu'une tranche — **le choix de la tranche fait toute la différence** entre l'image d'origine et une bande noire. |
| Un bouton laissé dans la rangée de navigation décalait les liens d'une demi-largeur. | **Centrer dans l'espace qui reste n'est pas centrer.** Il sort du flux. |
| Un voile **latéral** sous une composition devenue **centrée**. | Le voile suppose une composition ; si la composition change, le voile change. |
| Deux systèmes de squelette en double emploi ; un spinner plein écran dupliqué mot pour mot dans deux fichiers. | Un composant fait une chose. Le double emploi se supprime, il ne se maintient pas. |

### Et deux défauts de `.gitignore`, invisibles et en production

Même mécanisme, deux fois : **un motif écrit pour des fichiers de travail qui
efface un fichier de produit.**

| Fichier | Motif fautif | Conséquence |
|---|---|---|
| L'image de fond du bandeau | `*.jpg` | **Jamais versionnée**, alors que le CSS la référençait. Sur la machine de développement le bandeau s'affichait ; sur un clone, une CI ou un déploiement, l'URL ne résolvait pas et le bandeau retombait silencieusement sur ses dégradés. |
| Un script de QA versionné | `Capture*`, **non ancré**, + `core.ignorecase` sous Windows | L'outil disparaissait de chaque commit sans un mot. |

La règle : un motif destiné à la racine **s'ancre** (`/Capture*`), et le dossier
public contient des **actifs de produit**, pas des captures. **Vérifié par un
`git clone` dans un dossier neuf.**

---

## 15. Les checklists

### Avant de MONTRER la maquette (§16)

- [ ] Le bloc de direction de `DESIGN.md` §2 est écrit en haut de la page ?
- [ ] La palette vient du logo **du client cible**, relevée au pixel ?
- [ ] Chaque couleur porte son nom de jeton, son rôle et **son contraste mesuré** ?
- [ ] La direction n'est aucun des trois patterns génériques de `DESIGN.md` §1 ?
- [ ] Le contenu est réel — vrais libellés, vrais montants, vrais formats ?
- [ ] Le **volume** est réel, et le **nom le plus long** est dedans ?
- [ ] Les états sont **montrés** : plein, vide « rien », vide « rien qui
      corresponde », chargement à la bonne forme, erreur ?
- [ ] La vue à 390 px est sur la page ?
- [ ] Zéro emoji ; le fichier s'ouvre au double-clic, sans réseau ni build ?
- [ ] Je sais dire en trois lignes ce que j'ai écarté et pourquoi ?
- [ ] Une chose à retirer ? Retire-la.

### Avant de considérer un ÉCRAN fini

- [ ] La direction est spécifique au sujet (aucun des trois patterns du §1) ?
- [ ] Zéro emoji brut ; icônes SVG d'un jeu cohérent, en imports nommés ?
- [ ] Zéro couleur hors palette, zéro hex en dur ?
- [ ] Tous les états dessinés — vide (les **deux**), chargement à la bonne forme,
      erreur, erreur partielle, clairsemé, dense ?
- [ ] Focus visible, contraste AA **mesuré**, noms accessibles complets ?
- [ ] Un seul `h1`, par le composant de titre partagé ?
- [ ] Aucun débordement horizontal à 390 px, **vérifié par la sonde** ?
- [ ] Montants en `tabular-nums`, en-têtes compris ?
- [ ] Composants réutilisés, pas de CSS réécrit inutilement ?
- [ ] Le texte aide à naviguer — voix active, même mot dans tout le flux ?
- [ ] Une chose à retirer ? Retire-la.

### Avant de considérer un LOT fini

- [ ] Lint propre, tests au vert, build passant — chiffres **relevés**, pas supposés ?
- [ ] Le banc d'essai est absent du build ?
- [ ] Les quatre sondes rejouées ?
- [ ] Le diff relu : dans un commit de restyle, **seules des chaînes `className`** ?
- [ ] Le journal mis à jour **contre le code**, pas contre les messages de commit ?
- [ ] Le tableau des couleurs hors palette a baissé, et le nouveau chiffre est écrit ?

---

## 16. La maquette HTML — on regarde avant de coder

**Rien n'est codé dans l'application avant qu'une maquette ait été vue et
validée.** C'est le premier livrable du chantier, et c'est un point d'arrêt dur.

C'est aussi ce que `DESIGN.md` §2 exige déjà — « on ne code jamais une UI au fil
de l'eau » — porté jusqu'à sa conséquence : une direction ne se valide pas sur
un paragraphe, elle se valide **en la regardant**.

### 16.1 — Ce qu'est la maquette

**Un seul fichier HTML statique, autonome, ouvrable au double-clic.** Pas de
build, pas de `npm install`, pas de framework, pas de dépendance réseau — CSS et
SVG en ligne dans le fichier. Le seul actif externe toléré est le logo du client.

Elle couvre **l'espace boutique, et lui seul** (§17.1).

### 16.2 — Ce qu'elle contient, dans cet ordre

1. **Le bloc de direction de `DESIGN.md` §2**, écrit en haut de la page :
   `SUJET` · `PALETTE` · `TYPO` · `LAYOUT` · `SIGNATURE`. C'est ce qu'on valide
   en réalité ; les écrans ne font que le démontrer.
2. **La palette** : chaque valeur avec son nom de jeton, son hex, **son rôle** et
   **son contraste mesuré** sur la surface où elle sert. Une pastille de couleur
   sans son chiffre ne prouve rien.
3. **Les écrans de l'espace boutique**, dans l'ordre où l'utilisateur les
   rencontre.
4. **Les états** (§6) : pour l'écran principal au minimum — le plein, le vide
   « rien », le vide « rien qui corresponde », le chargement, l'erreur. Côte à
   côte, sur la même page.
5. **La vue à 390 px**, montrée, pas promise.

### 16.3 — Les cinq règles qui font qu'une maquette ne ment pas

Une maquette qui ment coûte plus cher que pas de maquette : on valide une
illusion, et le vrai écran déçoit trois semaines plus tard.

| Règle | Pourquoi |
|---|---|
| **Le contenu est réel, pas du lorem.** Les vrais libellés du logiciel cible, les vrais montants, les vrais formats de date et de devise. | Une mise en page tient toujours avec du contenu inventé à la bonne longueur. |
| **Le volume est réel.** Si le métier a 84 lignes, la maquette en montre 84 — pas 5. | *Un écran vérifié à trois lignes ne prouve rien à quatre-vingt-quatre.* C'est à quarante lignes qu'une teinte de ligne est devenue un aplat où la couleur ne distinguait plus rien (§14). |
| **Le nom le plus long est dedans.** Le libellé qui déborde, le montant à sept chiffres, la boutique au nom à rallonge. | C'est ce qui tronque « FCFA » puis le mot « bas » à 390 px (§14). |
| **Les états sont montrés, pas décrits.** | L'état vide est celui qu'on dessine le plus soigneusement et qu'on regarde le moins. |
| **Ce qui est mesuré est écrit sur la maquette.** Contraste, largeur à 390 px. | Loi 3. Une maquette qui affirme « AA » sans chiffre demande une confiance qu'elle n'a pas gagnée. |

### 16.4 — Une direction aboutie, pas trois variantes tièdes

`DESIGN.md` §2 est explicite : *« Fais ce travail dans ta réflexion ; ne montre
au client que quand tu as confiance que ça va lui plaire. »*

L'agent explore plusieurs pistes **dans son raisonnement**, les confronte au
brief, écarte celles qui ressembleraient à ce qu'il produirait pour n'importe
quel projet du même type — et présente **une** direction, assumée, avec ses
écrans et ses états. Trois propositions moyennes déplacent la décision sur le
client ; c'est précisément le travail qu'on lui demande d'éviter.

Ce qui **est** attendu en revanche, c'est que l'agent dise **ce qu'il a écarté et
pourquoi** : deux ou trois lignes suffisent, et elles permettent de discuter la
direction au lieu de la subir.

### 16.5 — Ce que la maquette n'est PAS

- **Pas un livrable.** Elle sert à décider, puis elle est archivée. Le code réel
  ne la copie pas : il applique la direction qu'elle a fait valider, **en
  réutilisant les composants existants** (`DESIGN.md` §7, `ARCHITECTURE.md` §1).
  Une maquette recopiée en composants, c'est du CSS réécrit à zéro par-dessus un
  socle qui existait déjà.
- **Pas un contrat de pixel.** Si le composant partagé du projet cible rend le
  titre autrement que la maquette, c'est le composant partagé qui gagne — un
  seul dessin de titre pour tous les écrans (§5.2) vaut mieux qu'une fidélité
  à l'image.
- **Pas de logique.** Aucun appel réseau, aucun état applicatif, aucune
  navigation réelle exigée. Des ancres entre les écrans suffisent.
- **Pas la fin du travail visuel.** Le banc d'essai (§10.1) prend le relais dès
  que le code existe, parce que lui monte l'écran **réel** — une maquette, elle,
  dérive dès le premier commit.

### 16.6 — Le point d'arrêt

L'agent présente la maquette et **s'arrête**. Il ne touche pas au code de
l'application, ne crée pas de jetons, ne pose pas de tests tant qu'il n'a pas de
retour. Un aller-retour ou deux sur la maquette coûtent une heure ; le même
aller-retour après trois lots d'écran coûte le chantier.

---

## 17. L'ordre d'exécution sur le logiciel cible

Le design du logiciel cible est **déjà refait et insatisfaisant**. C'est un cas
de reprise, pas un démarrage à blanc — donc on commence par le diagnostic, et on
ne repeint rien avant de l'avoir écrit.

### 17.1 — Deux règles de cadence, avant la liste

**1. Un espace à la fois, et on commence par l'espace BOUTIQUE.**

Pas « le design du logiciel ». L'espace boutique : ses écrans, tous ses états,
jusqu'au bout — puis on s'arrête et on montre. Les autres espaces gardent leur
apparence actuelle pendant ce temps, **et c'est assumé, visible, et écrit dans
le journal**.

C'est exactement l'ordre suivi ici, et il n'est pas arbitraire : la boutique est
l'espace que le plus de gens ouvrent, tous les jours ; c'est là que la marque se
voit et que le gain se ressent. Sur C2EGF, la boutique a été traitée en premier
(lots 1 à 9), puis l'authentification, puis l'espace dealer — et le back-office
admin attend toujours son tour, inscrit au tableau avec ses 121 couleurs.

**Un demi-produit entièrement refait bat un produit entier à moitié refait.** Le
second est exactement l'état dans lequel se trouve le logiciel cible
aujourd'hui.

**2. Rien n'est codé avant qu'une maquette ait été validée** (§16).

### 17.2 — La liste

```
 1. DIAGNOSTIC (§2) — sur l'espace boutique
    Relever, pages ET composants : couleurs hors palette · hex en dur ·
    emoji bruts · thèmes morts · écrans sans état vide · squelettes de la
    mauvaise forme · h1 multiples · châssis dupliqués.
    Écrire le tableau. Il ne bouge plus qu'en baissant.

 2. LA DIRECTION ET LA PALETTE (§3 + DESIGN.md §2)
    Relever la couleur sur LEUR logo. Dériver la rampe. Vérifier chaque
    niveau. Poser la teinte des neutres. Nommer la signature — ou constater
    qu'aucune ne s'impose, et le dire.

 3. LA MAQUETTE HTML (§16)
    Un fichier, l'espace boutique, ses états, le contenu et le volume réels.
    ══> POINT D'ARRÊT. On montre, on attend. Aucun code applicatif.

 4. LE FILET (§2, A.1)
    Tests de caractérisation sur les écrans boutique non couverts.
    Zéro assertion sur une classe CSS. Figer les défauts trouvés.

 5. LES JETONS (§4)
    Quatre familles qui ne se mélangent pas. Chaque jeton dit, en commentaire,
    ce qu'il veut dire et ce qu'il n'a PAS le droit de faire.
    Supprimer les thèmes morts ET la structure qui les porte (§3, B.5).

 6. L'OUTILLAGE (§10)
    Le banc d'essai avec ses doublures et ses variantes d'adresse, puis les
    trois sondes. AVANT les lots d'écran — c'est ce qui les vérifie.

 7. LE CHÂSSIS (§5)
    Un layout, un titre, un tableau, une hiérarchie d'actions.
    Peu de code, beaucoup d'effet.

 8. LES LOTS D'ÉCRAN (§5, §6) — espace boutique uniquement
    Écran par écran. Un commit par lot. Le tableau du point 1 baisse.
    Chaque lot se termine par : les quatre sondes + le journal.

 9. LA SIGNATURE (§7)
    Une seule, ancrée dans LEUR métier. Si rien ne vient, ne rien inventer.

10. LE VOCABULAIRE (§9)
    En lot déclaré séparé. Jamais mélangé à du dessin.

11. BILAN DE L'ESPACE BOUTIQUE (§12)
    Vérifié contre le code. Chiffres relevés, pas supposés.
    ══> POINT D'ARRÊT. On montre le résultat avant d'ouvrir l'espace suivant.

  ⟳ Espace suivant : on reprend au point 1. La palette, les jetons et
    l'outillage sont déjà là — les points 2, 5 et 6 ne se refont pas.

 ∞  LA RÈGLE DE LINT (§13) — quand le dernier espace est fait, jamais avant.
```

### 17.3 — Les points d'arrêt sont réels

Trois arrêts durs : **après le diagnostic**, **après la maquette**, **après le
bilan de l'espace**. À chacun, l'agent présente et attend un feu vert.

Entre deux arrêts, il enchaîne seul — `ARCHITECTURE.md` §7 : une validation vaut
pour le périmètre qu'elle a explicitement couvert, et le travail à l'intérieur
de ce périmètre n'en redemande pas. Il revient demander dans trois cas
seulement : un écart de périmètre, une décision structurante non prévue, ou une
opération sensible (`AGENTS.md` règle 6).

---

## 18. Le brief à donner à l'agent qui reprend

À coller tel quel, en remplaçant ce qui est entre crochets :

> Tu reprends le design de **[nom du logiciel]**, qui appartient à
> **[nom de l'entreprise]**.
>
> **Lis d'abord, dans cet ordre :** `AGENTS.md`, `DESIGN.md`,
> `ARCHITECTURE.md`, puis `METHODE-REFONTE-DESIGN.md`. Les trois premiers sont
> les contrats du dépôt et ils priment. Le quatrième est la méthode de terrain :
> il dit dans quel ordre faire les choses et quels pièges ont déjà coûté cher.
>
> **Périmètre : design, UX et interface uniquement.** Tu ne touches ni au modèle
> de données, ni aux règles métier, ni aux flux, ni aux permissions. Si une
> correction de design semble exiger un changement fonctionnel, tu t'arrêtes et
> tu le signales — tu ne le fais pas.
>
> **L'identité est celle de [nom de l'entreprise], pas celle d'un autre
> client.** Leur logo est **[chemin du fichier]** : toute la palette en dérive,
> par relevé au pixel, pas par approximation. Aucune valeur de couleur, aucune
> imagerie, aucune signature d'un autre produit ne se recopie ici — seule la
> méthode se transpose.
>
> **Tu ne fais pas tout d'un coup. Tu commences par l'espace boutique, et lui
> seul.** Les autres espaces gardent leur apparence actuelle ; tu l'écris dans
> le bilan au lieu de le masquer.
>
> **Tu ne codes rien avant que je voie une maquette.** Suis le §17.2 :
>
> 1. le **diagnostic** de l'espace boutique — pages **et** composants ;
> 2. la **direction et la palette**, tirées de leur logo ;
> 3. une **maquette HTML statique**, un seul fichier ouvrable au double-clic,
>    montrant les écrans de l'espace boutique **avec leurs états** (plein, les
>    deux vides, chargement, erreur), avec le **contenu et le volume réels** du
>    métier, et la vue à 390 px.
>
> Puis tu **t'arrêtes** et tu me la montres. Pas de jetons, pas de tests, pas de
> composant touché avant mon retour.
>
> Présente **une** direction aboutie, pas trois variantes tièdes — mais dis-moi
> en deux ou trois lignes ce que tu as écarté et pourquoi.
>
> Quatre choses sur lesquelles tu ne cèdes pas :
> 1. Aucune couleur ne porte seule une information.
> 2. Le contraste se **mesure** sur les pixels rendus, il ne se calcule pas.
> 3. Tous les états sont dessinés, pas seulement le cas idéal.
> 4. Un commit est soit un restyle pur, soit un changement déclaré — jamais les
>    deux.
>
> Et une règle de bilan : **tu vérifies tes affirmations contre le code, jamais
> contre tes propres messages de commit.**

---

## 19. Ce qui, dans ce dépôt, sert de modèle

Les fichiers à lire, dans cet ordre, pour voir la méthode appliquée :

| Fichier | Ce qu'il montre |
|---|---|
| `DESIGN.md` | Le contrat d'interface — les principes et les non-négociables, indépendants du client |
| `src/index.css` | **Le modèle le plus utile.** Les jetons, et surtout les commentaires : chaque valeur y dit sa raison d'être, son contraste mesuré, et ce qu'elle n'a pas le droit de faire |
| `src/constants/themes.js` · `workspaceTheme.js` · `dashboardTheme.js` | Comment une palette remplace un arc-en-ciel sans réécrire les appelants |
| `src/components/ui/PageHeader.jsx` · `EmptyState.jsx` | Un composant dont le commentaire explique ce qu'il a remplacé et pourquoi |
| `src/components/BandeauMarque.jsx` · `debts/Fleau.jsx` | Les deux signatures, avec leur justification métier |
| `scripts/contraste.mjs` · `deborde.mjs` · `qa-mouvement.mjs` · `qa-visuelle.mjs` | Les quatre sondes, avec l'historique du défaut qui a fait écrire chacune |
| `scripts/lib/banc.mjs` · `preview.html` · `src/preview-doubles/` | Le banc d'essai et ses doublures |
| `REFONTE.md` | Le journal — dont son §0, qui corrige ses propres mensonges |
| `specs/ROADMAP.md` · `specs/S1..S7` | Le découpage en specs, et ce qu'une spec terminée consigne (y compris les critères devenus sans objet) |

---

**Le dernier mot, et c'est le conseil de Chanel appliqué au logiciel :** avant de
sortir, regarde-toi dans le miroir et retire un accessoire. Un élément en moins,
presque toujours. Un design minimal exécuté avec précision bat un design chargé
— et ne pas prendre de risque est aussi un risque : la direction générique
« safe » est exactement ce qu'on cherche à éviter.
