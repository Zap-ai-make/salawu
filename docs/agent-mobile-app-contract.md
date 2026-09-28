# Contrat d'intégration — App mobile agents (ESAHAF / salawu)

> **Statut : FIGÉ (Lot 5).** Document de référence remis à l'équipe de l'app mobile.
> Toute évolution de ce contrat doit être versionnée ici et validée côté logiciel web avant
> déploiement. Client concerné : **salawu** (`salawu-fa726`). TAOFIC n'expose pas cette surface.

Ce document décrit **la seule surface** que l'app mobile consomme : un endpoint de connexion
et deux lectures Firestore directes, en **lecture seule**. Aucune écriture n'est autorisée à
l'agent.

---

## 1. Projet & SDK

| Élément | Valeur |
|---|---|
| Projet Firebase | `salawu-fa726` |
| Région des Cloud Functions | `europe-west1` |
| App Check | **désactivé, et non prévu** (`enforceAppCheck:false`) — remplacé par une limite de débit par IP (§3) |
| Auth | jeton personnalisé (`signInWithCustomToken`) — **pas** email/mot de passe, **pas** de SMS |

```js
const functions = getFunctions(app, 'europe-west1') // la région est obligatoire
```

---

## 2. Connexion agent — `agentSignIn` (callable, public)

L'agent se connecte avec **un identifiant professionnel** (son **numéro agent OU son code
agent**, tels qu'inscrits sur sa fiche en boutique) + le **code d'accès** généré et remis par
la boutique (préfixe `ESAHAF-`). L'app **n'invente ni ne stocke** de mot de passe.

### Requête

```js
const signIn = httpsCallable(functions, 'agentSignIn')
const { data } = await signIn({
  identifier: '70112233',      // numéro agent OU code agent (casse/espaces tolérés)
  code: 'ESAHAF-ABCD2345',     // code d'accès remis en boutique
  storeId: 'store-xyz',        // OPTIONNEL : désambiguïse un agent présent dans 2 boutiques
})
```

- `identifier` et `code` sont normalisés côté serveur (trim, MAJUSCULES, espaces retirés ; le
  tiret du code est conservé). Longueur max 64.
- `storeId` est **facultatif** : à ne fournir que si le même identifiant existe dans plusieurs
  boutiques (sinon la connexion est déjà déterministe).
- **Liste blanche stricte** : toute clé supplémentaire dans le payload → `invalid-argument`.

### Réponse (succès)

```json
{ "success": true, "customToken": "<JWT>" }
```

L'app enchaîne :

```js
await signInWithCustomToken(auth, data.customToken)
```

### Claims du jeton (posés côté serveur, non forgeables)

```json
{ "role": "agent", "clientId": "<id fiche globalClients>", "storeId": "<boutique>",
  "codeVersion": 3 }
```

- **`uid == clientId`** : l'identité de l'agent EST l'id de sa fiche `globalClients`. C'est ce
  qui autorise la lecture de sa fiche et de ses reçus (§4).
- **`codeVersion`** : la génération du code d'accès dont provient ce jeton. Elle s'incrémente à
  chaque régénération, et c'est elle que `agentSessionCheck` (§2.1) compare.
- Durée de vie de l'ID token ≈ **1 h**, rafraîchi automatiquement par le SDK — **sauf si les
  sessions ont été révoquées** (§2.2).

---

## 2.1 Vérifier la fraîcheur d'une session — `agentSessionCheck`

Callable **authentifiée** : elle exige un jeton d'agent valide. Ni identifiant ni code en entrée.

```js
const check = httpsCallable(functions, 'agentSessionCheck')
const { data } = await check()          // → { valid: true | false }
if (!data.valid) await signOut(auth)    // reconnexion complète, code d'accès compris
```

Le serveur compare le `codeVersion` du jeton à celui du credential et vérifie `active`. Une
lecture de document, aucun scrypt : appelez-la à chaque contact réseau sans crainte. Elle n'est
pas soumise à la limite de débit de `agentSignIn` — elle est authentifiée et ne coûte presque
rien.

| Réponse / erreur | Sens | Ce que l'app fait |
|---|---|---|
| `{ valid: true }` | session à jour | rien |
| `{ valid: false }` | code régénéré, credential désactivé, ou fiche disparue | déconnecter, exiger une reconnexion |
| `ROLE_FORBIDDEN` | le jeton n'est pas un jeton d'agent | déconnecter |
| `UNAUTHENTICATED` | pas de jeton | écran de connexion |
| `MOBILE_APP_DISABLED` | fonctionnalité désactivée | « Service indisponible. » |

⚠ **Un jeton sans `codeVersion` est déclaré invalide.** Ce sont ceux émis avant l'ajout du claim.
Les accepter ouvrirait un contournement permanent — il suffirait de présenter un vieux jeton pour
n'être jamais coupé. Le coût est une reconnexion, une seule fois.

---

## 2.2 Révocation — ce que « régénérer le code » coupe vraiment

Régénérer fait **deux** choses côté serveur :

1. le code change, et l'ancien cesse d'ouvrir une **nouvelle** session ;
2. les **jetons de rafraîchissement** de cet agent sont révoqués (`revokeRefreshTokens`).

Le point 2 est ce qui coupe un appareil déjà connecté — **sans que l'application ait à
coopérer**. Firebase refuse alors de renouveler le jeton. L'ID token en cours reste valide
jusqu'à son expiration : **une heure au plus**.

| Mécanisme | Force | Délai |
|---|---|---|
| `revokeRefreshTokens` (serveur) | **imposé** — l'appareil ne peut rien y faire | ≤ 1 h |
| `agentSessionCheck` (§2.1) | **consultatif** — suppose que l'app appelle et obéit | quasi immédiat |

Les deux se complètent : le premier pose le plafond, le second raccourcit le reliquat. Le SDK
JavaScript, quand le rafraîchissement échoue, **déconnecte l'utilisateur** — votre app reçoit
donc le signal via `onAuthStateChanged` sans rien ajouter.

⚠ **Il n'existe aujourd'hui aucune désactivation** d'un credential : `active` n'est jamais mis à
`false` par le produit. Le seul geste de révocation est la régénération du code.

---

## 3. Contrat d'erreurs de `agentSignIn`

Les erreurs client Firebase exposent `err.code` (HTTP) et `err.details.code` (code métier).
Les messages sont **génériques** (anti-énumération) : l'app ne doit **pas** en déduire si
l'identifiant existe.

| `details.code` | `err.code` (HTTP) | Sens | Message app suggéré |
|---|---|---|---|
| `INVALID_LOGIN_INPUT` | `invalid-argument` | identifiant/code vide ou trop long, ou clé en trop | « Saisie invalide. » |
| `INVALID_CREDENTIALS` | `permission-denied` | identifiant inconnu, inactif, ou mauvais code | « Identifiant ou code incorrect. » |
| `ACCOUNT_LOCKED` | `resource-exhausted` | trop de tentatives **sur ce compte** | « Trop de tentatives. Réessayez dans quelques minutes. » |
| `TOO_MANY_ATTEMPTS` | `resource-exhausted` | trop d'appels **depuis ce réseau** | « Trop de tentatives. Réessayez dans quelques minutes. » |
| `MOBILE_APP_DISABLED` | `failed-precondition` | fonctionnalité non activée pour ce client | « Service indisponible. » |

**`TOO_MANY_ATTEMPTS` — limite de débit par IP (remplace App Check).** L'endpoint est public et
non authentifié ; chaque appel coûte un `scryptSync` bloquant, y compris sur un identifiant
inconnu, où aucun verrou de compte ne peut s'appliquer. Une limite par adresse IP ferme ce
vecteur : **20 tentatives par 10 minutes**, puis **15 minutes de blocage**.

⚠ **Ce code n'accuse pas l'agent.** Un marché entier peut sortir derrière une seule adresse (NAT) :
l'agent qui le reçoit n'a peut-être rien fait de particulier. Le message doit donc rester neutre et
inviter à réessayer — surtout pas suggérer que le code saisi est faux. À distinguer
d'`ACCOUNT_LOCKED`, qui vise **un compte** ; celui-ci vise **une provenance**.

⚠ **Il tombe avant la validation d'entrée.** Une requête bloquée ne renvoie donc jamais
`INVALID_LOGIN_INPUT`, même si le payload est malformé.

**Anti-bruteforce** : après **5** échecs consécutifs, le compte est **verrouillé 5 minutes**
(le bon code renvoie alors `ACCOUNT_LOCKED`). Le compteur repart à zéro à la première connexion
réussie. L'app doit présenter un message neutre et, idéalement, un léger backoff visuel.

**Identifiant partagé entre boutiques (F2)** : si le même numéro/code agent existe dans deux
boutiques, un mauvais code incrémente le compteur d'échecs des **deux** credentials. Fournir
`storeId` dès qu'il est connu **cloisonne** le verrou à la bonne boutique. Compromis accepté
(inhérent au lockout) ; l'app est invitée à toujours transmettre `storeId` en cas d'ambiguïté.

---

## 4. Lecture des données (Firestore direct, lecture seule)

Une fois connecté, l'agent lit **directement** Firestore avec les règles de sécurité. L'`uid`
du jeton (= `clientId`) et le claim `storeId` sont **les seules sources d'autorité**.

### 4.1 Sa fiche

```js
const uid = auth.currentUser.uid           // == clientId
getDoc(doc(db, 'globalClients', uid))      // autorisé : clientId == uid
```

Lire la fiche d'un **autre** id → refusé.

### 4.2 Ses reçus

Le chemin dépend de la boutique = **claim `storeId`** (jamais une valeur choisie par l'app) :

```js
const storeId = /* claim storeId du jeton */
const q = query(
  collection(db, 'clients', storeId, 'history'),
  where('clientId', '==', uid),            // OBLIGATOIRE : contrainte d'auto-filtrage
  orderBy('createdAt', 'desc'),
  limit(50),                               // pagination conseillée
)
getDocs(q)
```

> ⚠️ **La contrainte `where('clientId','==', uid)` est obligatoire.** Une requête `history`
> **non contrainte** est **refusée** par les règles (fail-safe). C'est voulu : la règle ne peut
> pas « filtrer » une liste, donc elle exige que la requête se limite elle-même à `clientId == uid`.

- Index composite requis (déjà déployé) : `history (clientId ASC, createdAt DESC)`.
- Lire les reçus d'une **autre** boutique (path `storeId` ≠ claim) → refusé.

### 4.3 Champs disponibles

Les règles n'appliquent **pas** de filtrage par champ : l'app reçoit le document entier. Les
reçus (`history`) portent des données **transactionnelles** (montant, type, réseau, statut de
règlement, horodatages…). **Le solde de la boutique n'y figure pas** — il vit dans un document
séparé (`networkBalances/current`) qui reste **inaccessible** à l'agent. Champs typiques d'un
reçu : `clientId`, `storeId`, `type`, `montant`, `paymentMethod`, `effectiveNetwork`,
`originalAmount`, `paidAmount`, `refundedAmount`, `remainingAmount`, `settlementStatus`,
`createdAt`, `validatedAt`. L'app affiche ce dont elle a besoin et **ignore** les champs inconnus
(le schéma peut s'enrichir sans casser l'app).

---

## 5. Ce qui n'est **pas** exposé (invariants de sécurité)

- **Écritures** : aucune. L'agent est en lecture seule intégrale.
- **Brouillons** (`clients/{storeId}/drafts`), **règlements** (`.../settlements`),
  **credentials** (`agentCredentials`) : refusés.
- **Autres agents / autres boutiques** : refusés (fiche et reçus).
- **Transactions manuelles** (agent non enregistré, `clientId = manual-…`) : **invisibles** —
  aucun jeton n'a un `uid = manual-…`. Comportement voulu.
- **TAOFIC** : double isolement — projet Firebase distinct **et** `mobileAppEnabled()=false`
  (toute lecture agent y est refusée, `agentSignIn` y renvoie `MOBILE_APP_DISABLED`).

---

## 6. Sécurité opérationnelle

- **Code d'accès** : généré côté serveur (préfixe marque + 8 caractères d'un alphabet non
  ambigu), **haché** (scrypt + sel) dans `agentCredentials/{clientId}` — collection Admin-SDK
  only. Le clair n'est renvoyé qu'une fois, au gérant, à la génération. **Régénérer** invalide
  l'ancien code.
- **Révocation** : la régénération du code révoque désormais les refresh tokens de l'`uid`
  (fenêtre ID token ≈ 1 h), et `agentSessionCheck` raccourcit ce reliquat. Détail en §2.1 et §2.2.
  ⚠ `active:false` n'est écrit par aucun code du produit aujourd'hui : le seul geste de révocation
  est la régénération.
- **App Check : abandonné, et remplacé.** C'était la condition de mise en service à l'échelle (M1) :
  `agentSignIn` est public et exécute un scrypt coûteux par tentative, y compris sur un identifiant
  inconnu où le verrou par compte n'a rien à verrouiller. Mais l'app mobile utilise le **SDK
  JavaScript**, dont les fournisseurs App Check reposent sur reCAPTCHA — sans objet sur un
  téléphone. L'exiger imposerait un passage au SDK natif, donc un nouveau binaire et une
  réinstallation chez chaque agent. **Une limite de débit par IP (§3, `TOO_MANY_ATTEMPTS`) ferme le
  même vecteur, côté serveur seul, sans rien demander à l'application.** Le leurre anti-timing
  (scrypt factice sur identifiant inconnu) reste en place contre l'énumération.
- **Opt-in** : toute la surface est gardée par `mobileAppEnabled()` (règles) et `MOBILE_APP.enabled`
  (functions), générés depuis le profil client. Désactivés → surface inerte.

---

## 7. Statut de vérification

| Couche | Test | Portée |
|---|---|---|
| Connexion (functions) | **tc-149** | numéro/code agent, mauvais code, verrouillage, storeId, app off |
| Génération du code | **tc-147** | hash+sel, identifiants, audit, rotation, gardes |
| Règles de lecture | **tc-150** | 2 profils / 2 boutiques : lit le sien, refuse autrui / LIST non contrainte / autre boutique / drafts / credentials |
| Bout-en-bout | **tc-151** | generate → signIn → **claims réels rejoués dans les règles salawu** : lit sa fiche + ses reçus, refuse le reste |
| Index | **tc-114** | `history (clientId, createdAt)` présent |
| Isolement profil | **tc-083 / tc-084** | `mobileApp` par client ; bloc généré `mobileAppEnabled()` |

Tous exécutés sur l'émulateur `demo-akayis-test` uniquement.

---

## 8. Résumé pour l'app (aide-mémoire)

1. `getFunctions(app, 'europe-west1')`.
2. `agentSignIn({ identifier, code, storeId? })` → `customToken` → `signInWithCustomToken`.
3. `uid = currentUser.uid`, `storeId = claim`.
4. Fiche : `getDoc(globalClients/{uid})`.
5. Reçus : `history where clientId == uid, orderBy createdAt desc, limit n` (contrainte
   obligatoire).
6. Erreurs : lire `err.details.code`, afficher un message neutre, respecter le verrouillage.
