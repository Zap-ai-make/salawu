# Où vivent les identifiants agent — et comment l'app s'en sert

**Destinataire : le développeur de l'app mobile agents (ESAHAF / salawu).**
Complément de [`agent-mobile-app-contract.md`](./agent-mobile-app-contract.md), qui reste le
contrat figé (endpoint, claims, contrat d'erreurs). Ce document-ci répond à une autre question :
**où sont stockées les données, et lesquelles l'app peut lire.**

---

## 0. Pourquoi il n'y aura pas de captures Firestore

La demande était : « des captures de la console Firestore pour comprendre comment les données sont
stockées ». Elles induiraient en erreur, pour deux raisons :

1. **La collection qui porte les identifiants de connexion — `agentCredentials` — est fermée à
   tout le monde.** Pas « protégée » : fermée. La règle est `allow read, write: if false`. Un
   administrateur la voit dans la console parce que la console passe par l'Admin SDK, qui ignore
   les règles. Votre app, elle, reçoit `PERMISSION_DENIED` quel que soit le jeton. Une capture
   montrerait donc un document que l'app ne verra jamais.

2. **Et même ouverte, elle ne contient aucun code.** Le code d'accès n'y est pas stocké : seul
   son empreinte scrypt et son sel le sont. On ne peut pas remonter du hash au code.

Ce qui suit remplace les captures par les **structures champ par champ**. C'est plus précis
qu'une image, et cela dit ce qu'une image ne dit pas : **qui a le droit de lire quoi.**

---

## 1. D'où viennent les identifiants (le parcours réel)

L'agent se connecte avec **deux choses**, qui n'ont pas la même origine :

| Ce que l'agent saisit | D'où ça vient | L'agent le connaît déjà ? |
|---|---|---|
| **Numéro agent** *ou* **code agent** | Sa fiche, saisie par la boutique à son enregistrement | Oui — ce sont ses identifiants professionnels |
| **Code d'accès** | Généré par la boutique dans le logiciel web, affiché **une seule fois**, remis à l'agent | Non — il lui est communiqué |

Format du code d'accès : `ESAHAF-XXXXXXXX`. Huit caractères tirés d'un alphabet **sans caractères
ambigus** (`ABCDEFGHJKMNPQRSTUVWXYZ23456789` — ni I, ni L, ni O, ni 0, ni 1), pour qu'il se dicte
au téléphone sans erreur.

> **Rien de tout cela ne se récupère depuis Firestore.** L'agent tape ses identifiants dans votre
> app. Votre app ne va nulle part les chercher.

**Régénération.** La boutique peut régénérer le code (bouton *Régénérer*). Le nouveau code
remplace l'ancien, qui **cesse immédiatement de fonctionner**. Prévoyez donc le cas « l'agent
avait un code valide, il ne l'est plus » : c'est un `INVALID_CREDENTIALS` ordinaire, pas un
incident. Une régénération **déverrouille** aussi un compte bloqué.

---

## 2. Les trois documents

### 2.1 `globalClients/{clientId}` — la fiche de l'agent

**Lisible par l'app : oui — la sienne, et elle seule.**

L'`uid` du jeton **est** le `clientId`. `getDoc(doc(db,'globalClients', uid))` passe ; tout autre
id est refusé.

| Champ | Type | Rôle |
|---|---|---|
| `nom`, `prenom` | `string` | Identité (2 à 50 caractères) |
| `numeroIdentite` | `string` | Numéro de la pièce d'identité |
| `numeroPersonnel` | `string` | Téléphone **personnel** — *n'est pas* un identifiant de connexion |
| `registeredStoreId` | `string` | Boutique propriétaire de la fiche |
| `<reseau>` | `string` | **Code agent** sur ce réseau (clé à plat) |
| `numerosAgent.<reseau>` | `string` | **Numéro agent** sur ce réseau (map imbriquée) |

`<reseau>` ∈ `orange`, `moov`, `telecel`, `coris`, `sank`, `wave` (en minuscules).

> **Le piège à ne pas inverser.** La clé **à plat** (`client.orange`) porte le **code agent**. La
> clé **imbriquée** (`client.numerosAgent.orange`) porte le **numéro agent**. Un agent peut avoir
> l'un, l'autre, ou les deux, et sur plusieurs réseaux.
>
> Et le `numeroPersonnel` **ne sert pas à se connecter** : c'est un téléphone privé, pas un
> identifiant professionnel.

### 2.2 `agentCredentials/{clientId}` — les identifiants de connexion

**Lisible par l'app : NON. Fermé à tous les clients, sans exception.**

```
match /agentCredentials/{clientId} {
  allow read, write: if false;
}
```

Écrit uniquement par les Cloud Functions (Admin SDK). Décrit ici pour que vous sachiez **ce que le
serveur vérifie**, pas pour que l'app y accède.

| Champ | Type | Rôle |
|---|---|---|
| `clientId`, `storeId` | `string` | À qui, et dans quelle boutique |
| `loginIdentifiers` | `string[]` | **Tous** les numéros et codes agent de la fiche, normalisés (MAJUSCULES, sans espaces). C'est par ce tableau que le serveur retrouve l'agent |
| `codeHash`, `codeSalt` | `string` (hex) | Empreinte scrypt du code + sel aléatoire 16 octets. **Le code en clair n'existe nulle part** |
| `codeVersion` | `number` | Incrémenté à chaque régénération |
| `active` | `boolean` | Un credential inactif refuse la connexion |
| `failedAttempts`, `lockedUntil` | `number`, `number \| null` | Anti-force-brute : verrou après **5 échecs**, pour **5 minutes** |
| `lastLoginAt` | `timestamp \| null` | Dernière connexion réussie — préservé à la régénération |
| `generatedBy`, `generatedByEmail`, `generatedAt`, `updatedAt` | — | Traçabilité |

### 2.3 `clients/{storeId}/history/{id}` — les reçus

**Lisible par l'app : oui — les siens, et à une condition stricte (§ 3.3).**

Champs transactionnels : `clientId`, `storeId`, `type`, `montant`, `paymentMethod`,
`effectiveNetwork`, `originalAmount`, `paidAmount`, `refundedAmount`, `remainingAmount`,
`settlementStatus`, `createdAt`, `validatedAt`.

Le **solde de la boutique n'y figure pas** — il vit dans `networkBalances/current`, inaccessible à
l'agent. Ignorez les champs que vous ne connaissez pas : le schéma peut s'enrichir.

---

## 3. Ce que l'app fait — quatre appels

### 3.1 Connexion

Callable Firebase, **région `europe-west1`** (à préciser à l'initialisation, sinon vous appelez
`us-central1` et recevez un 404 qui ressemble à une erreur CORS).

```js
const functions = getFunctions(app, 'europe-west1')
const signIn = httpsCallable(functions, 'agentSignIn')

const { data } = await signIn({
  identifier: '70112233',        // numéro agent OU code agent
  code: 'ESAHAF-ABCD2345',       // le code remis par la boutique
  // storeId: 'store-x',         // optionnel : ne sert qu'à départager deux boutiques homonymes
})

await signInWithCustomToken(auth, data.customToken)
```

Casse et espaces sont tolérés à la saisie ; le **tiret du code est significatif** (le hash porte
dessus). Le jeton émis porte `uid = clientId` et les claims
`{ role:'agent', clientId, storeId, codeVersion }`.

### 3.2 Sa fiche

```js
const uid = auth.currentUser.uid          // == clientId
getDoc(doc(db, 'globalClients', uid))
```

### 3.3 Ses reçus

```js
const storeId = /* claim storeId du jeton — JAMAIS une valeur choisie par l'app */
const q = query(
  collection(db, 'clients', storeId, 'history'),
  where('clientId', '==', uid),           // OBLIGATOIRE
  orderBy('createdAt', 'desc'),
  limit(50),
)
```

> **La contrainte `where('clientId','==',uid)` n'est pas une optimisation, c'est la condition
> d'autorisation.** Une règle Firestore ne peut pas filtrer une liste : elle ne peut qu'accepter
> ou refuser la requête entière. Elle exige donc que la requête **se limite elle-même**. Sans
> cette clause, la requête est refusée — même pour vos propres reçus.

### 3.4 Vérifier que la session est toujours valable

```js
const check = httpsCallable(functions, 'agentSessionCheck')
const { data } = await check()          // → { valid: true | false }
if (!data.valid) await signOut(auth)
```

Le jeton porte désormais un claim **`codeVersion`** : la génération du code dont il provient. Le
serveur la compare à celle du credential et vérifie `active`. Une lecture de document, aucun
scrypt — appelez-la à chaque contact réseau.

⚠ **Un jeton émis avant ce claim est déclaré invalide.** Les accepter ouvrirait un contournement
permanent. Le coût est une reconnexion, une seule fois.

### La révocation, et ce qu'elle garantit vraiment

Régénérer le code **révoque aussi les jetons de rafraîchissement** de l'agent. Firebase refuse
alors de renouveler, quoi que fasse l'appareil : l'ID token en cours survit jusqu'à son expiration
— **une heure au plus** —, puis le SDK déconnecte l'utilisateur tout seul. Vous recevez le signal
via `onAuthStateChanged`, sans rien ajouter.

| Mécanisme | Force | Délai |
|---|---|---|
| Révocation des refresh tokens | **imposée** — l'appareil ne peut rien y faire | ≤ 1 h |
| `agentSessionCheck` | **consultatif** — suppose que l'app appelle et obéit | quasi immédiat |

Le premier pose le plafond, le second raccourcit le reliquat.

---

## 4. Les pièges qui coûtent une demi-journée

| Symptôme | Cause réelle |
|---|---|
| Erreur CORS « No Access-Control-Allow-Origin » + `FirebaseError: internal` | La fonction n'est pas jointe : mauvaise région, ou pas déployée. **Ce n'est pas un problème de CORS** — c'est un 404 sans en-tête |
| `PERMISSION_DENIED` sur les reçus, alors que le jeton est valide | La contrainte `clientId == uid` manque sur la requête (§ 3.3) |
| Lecture vide sur une autre boutique | `storeId` doit venir du **claim**, pas de l'app |
| `INVALID_CREDENTIALS` sur un code qui marchait | La boutique a régénéré le code |
| `ACCOUNT_LOCKED` | 5 échecs consécutifs **sur ce compte** → 5 minutes de verrou |
| `TOO_MANY_ATTEMPTS` | Trop d'appels **depuis cette IP** : 20 par 10 min, puis 15 min de blocage. N'accuse pas l'agent — un marché entier peut sortir derrière une seule adresse |
| `MOBILE_APP_DISABLED` | Fonctionnalité désactivée pour ce client (c'est le cas de TAOFIC, projet séparé) |

Les erreurs de connexion sont **volontairement génériques** : un identifiant inconnu et un
mauvais code renvoient le même `INVALID_CREDENTIALS`, en un temps comparable. C'est une mesure
anti-énumération — n'essayez pas d'en tirer un message plus précis pour l'utilisateur.

Le contrat d'erreurs complet est en section 3 de
[`agent-mobile-app-contract.md`](./agent-mobile-app-contract.md).

---

## 5. Ce que l'app ne peut pas faire

- **Écrire.** Quoi que ce soit. L'agent est en lecture seule intégrale.
- Lire `agentCredentials`, les brouillons (`clients/{storeId}/drafts`), les règlements
  (`.../settlements`), les soldes (`networkBalances`).
- Lire la fiche ou les reçus d'un **autre** agent, ou d'une **autre** boutique.
- Voir les transactions manuelles (agent non enregistré, `clientId = manual-…`) : aucun jeton n'a
  un `uid` de cette forme. C'est voulu.

---

## 6. Ce qui a remplacé App Check

`agentSignIn` est un endpoint **public** qui exécute un scrypt bloquant à chaque appel — y compris
sur un identifiant inconnu, où aucun verrou de compte ne peut s'appliquer. C'est ce coût qui
faisait d'App Check une précondition avant l'ouverture publique.

App Check étant hors d'atteinte pour un SDK JavaScript sur téléphone, une **limite de débit par
IP** le remplace, côté serveur uniquement : 20 tentatives par 10 minutes, puis 15 minutes de
blocage, avec le code `TOO_MANY_ATTEMPTS`.

**Rien à faire côté application**, sinon traiter ce code comme les autres refus — message neutre,
invitation à réessayer. App Check n'est plus prévu : vous n'avez pas à changer de SDK.
