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
| App Check | **désactivé aujourd'hui** (`enforceAppCheck:false`) — à activer en phase ultérieure |
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
{ "role": "agent", "clientId": "<id fiche globalClients>", "storeId": "<boutique>" }
```

- **`uid == clientId`** : l'identité de l'agent EST l'id de sa fiche `globalClients`. C'est ce
  qui autorise la lecture de sa fiche et de ses reçus (§4).
- Durée de vie de l'ID token ≈ **1 h**, rafraîchi automatiquement par le SDK tant que le compte
  reste actif (voir §6, révocation).

---

## 3. Contrat d'erreurs de `agentSignIn`

Les erreurs client Firebase exposent `err.code` (HTTP) et `err.details.code` (code métier).
Les messages sont **génériques** (anti-énumération) : l'app ne doit **pas** en déduire si
l'identifiant existe.

| `details.code` | `err.code` (HTTP) | Sens | Message app suggéré |
|---|---|---|---|
| `INVALID_LOGIN_INPUT` | `invalid-argument` | identifiant/code vide ou trop long, ou clé en trop | « Saisie invalide. » |
| `INVALID_CREDENTIALS` | `permission-denied` | identifiant inconnu, inactif, ou mauvais code | « Identifiant ou code incorrect. » |
| `ACCOUNT_LOCKED` | `resource-exhausted` | trop de tentatives | « Trop de tentatives. Réessayez dans quelques minutes. » |
| `MOBILE_APP_DISABLED` | `failed-precondition` | fonctionnalité non activée pour ce client | « Service indisponible. » |

**Anti-bruteforce** : après **5** échecs consécutifs, le compte est **verrouillé 5 minutes**
(le bon code renvoie alors `ACCOUNT_LOCKED`). Le compteur repart à zéro à la première connexion
réussie. L'app doit présenter un message neutre et, idéalement, un léger backoff visuel.

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
- **Révocation** : `active:false` sur le credential bloque les futures connexions ; pour couper
  une session vivante, révoquer les refresh tokens de l'`uid` (fenêtre ID token ≈ 1 h).
- **App Check** : à activer pour l'app mobile en phase ultérieure (endpoint actuellement ouvert,
  protégé par lockout + backoff + messages génériques).
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
