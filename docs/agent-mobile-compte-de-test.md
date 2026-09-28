# Fabriquer le compte agent de test — app mobile

**Pour qui :** l'équipe ESAHAF (ou la boutique), pas le développeur mobile.
**Durée :** environ cinq minutes.
**Résultat :** un agent de test dans une boutique de test, avec un code d'accès régénérable et
deux réseaux dissymétriques — exactement ce que la demande du 2026-09-24 réclame.

---

## Étape 0 — Pourquoi pas dans une boutique réelle

C'est le point le plus important de cette page.

Un client de test créé dans une boutique en activité **n'est pas neutre** :

- il entre dans le **compte de clients** de la boutique et dans la **répartition par réseau** du
  tableau de bord ;
- il apparaît dans l'**annuaire national** — les clients sont partagés entre boutiques par
  conception, donc les autres boutiques le verront dans leurs recherches ;
- et surtout, ses **reçus supposent de vraies transactions**. Elles déplaceraient le **stock
  électronique** et le **chiffre du jour** de cette boutique. Ce sont des écritures financières,
  avec piste d'audit : on ne les efface pas d'un clic.

Une boutique de test coûte trente secondes et supprime tout le problème.

---

## Étape 1 — Créer la boutique de test

Depuis la **page de connexion** du logiciel, choisir **« Créer un compte »**.

| Champ | Valeur conseillée |
|---|---|
| Nom de la boutique | `ZZ TEST — App mobile` |
| E-mail | une adresse dédiée, jamais celle d'un gérant réel |
| Mot de passe | au choix |

Le préfixe `ZZ` n'est pas décoratif : il fait tomber la boutique **en fin de liste** partout où
les boutiques sont triées, et le mot `TEST` la rend illisible autrement que pour ce qu'elle est.

L'inscription crée en un seul lot le document `stores/{storeId}` et le profil `users/{uid}` avec
le rôle `store_admin`. Vous êtes connecté à la boutique de test immédiatement.

> **Rien d'autre n'est à configurer.** Les six réseaux (Orange, Moov, Telecel, Coris, Sank, Wave)
> viennent du profil client, pas d'un réglage par boutique.

---

## Étape 2 — Créer l'agent, avec deux réseaux **dissymétriques**

Onglet **Clients** → **Ajouter un client**.

| Champ | Valeur | Pourquoi |
|---|---|---|
| Nom | `TESTEUR` | |
| Prénom | `Mobile` | |
| Numéro personnel | un numéro fictif | Ce champ **ne sert pas** à se connecter |
| **Code agent Orange** | `OR900001` | Clé **à plat** dans le document |
| *Numéro agent Orange* | **laisser vide** | |
| *Code agent Moov* | **laisser vide** | |
| **Numéro agent Moov** | `70 99 00 11` | Clé **imbriquée** `numerosAgent.moov` |

C'est cette dissymétrie qui a de la valeur. Elle permet au développeur de prouver qu'il n'a pas
inversé les deux emplacements : le code agent vit sur la clé à plat (`client.orange`), le numéro
agent dans la map imbriquée (`client.numerosAgent.moov`). Les deux sont des chaînes de caractères
— rien, dans le type, ne signalerait l'inversion.

Les deux valeurs se retrouveront dans `loginIdentifiers`, normalisées en majuscules sans espaces.
L'agent pourra donc se connecter **avec l'une puis avec l'autre**.

---

## Étape 3 — Générer le code d'accès

Dans la liste des clients, sur la ligne de l'agent : bouton **« Code d'accès »**.

Le code s'affiche **une seule fois**, sous la forme `ESAHAF-XXXXXXXX`. Notez-le tout de suite.

La même fenêtre porte le bouton **« Régénérer »** — c'est celui dont le développeur a besoin pour
ses essais. Chaque régénération produit un code neuf et **invalide immédiatement le précédent**
pour toute nouvelle connexion.

---

## Étape 4 — Les reçus (2 ou 3)

Onglet **Transactions** → **Enregistrer une transaction**, en choisissant `TESTEUR Mobile` comme
client. Répétez deux ou trois fois, avec des réseaux et des natures différents (un dépôt, un
retrait) pour que le développeur voie des cas variés.

Ils atterrissent dans `clients/{storeId}/history` et deviennent les reçus que l'app lira.

Dans la boutique de test, ces écritures ne polluent rien.

---

## Étape 5 — Ce qu'on transmet au développeur

Trois lignes suffisent :

```
Identifiant 1 (code agent Orange) : OR900001
Identifiant 2 (numéro agent Moov) : 70990011
Code d'accès                      : ESAHAF-XXXXXXXX
```

> Le `storeId` **n'est pas à transmettre** : il arrive dans le claim du jeton. S'il le demande
> pour déboguer, c'est un confort, pas un besoin — son application ne doit jamais le choisir.

Rappelez-lui qu'il se connecte avec **l'un OU l'autre** des deux identifiants, plus le code, et
que le tiret du code compte.

---

## Ce qu'il ne faut pas faire

- **Créer l'agent de test dans une boutique réelle** — voir l'étape 0.
- **Donner le compte d'un agent en activité** pour les essais. Son code est son identifiant de
  connexion ; le communiquer, c'est ouvrir son compte à quelqu'un d'autre. C'est d'ailleurs ce
  que le développeur a lui-même écarté.
- **Supprimer la boutique de test « pour faire propre »** une fois les essais finis. Elle servira
  à la prochaine version de l'app. Désactivez-la si elle gêne, ne l'effacez pas.
