# Synchronisation des reçus/fiche vers l'app mobile agents

> Statut : **Lots 1→5 faits** (feature complète côté web). Contrat figé : [`agent-mobile-app-contract.md`](agent-mobile-app-contract.md).
> Client : **salawu** uniquement (opt-in). TAOFIC non concerné (projet Firebase séparé + `mobileApp.enabled = false`).

## Besoin

Une app mobile **déjà existante** (projet séparé), destinée aux **agents** (= les « clients »
de la boutique dans ce logiciel), doit afficher pour chaque agent **sa fiche** et **ses reçus**
(chaque transaction). Connexion agent = **téléphone + code/PIN remis par la boutique** (pas de SMS).
Le logiciel web doit **exposer** ces données de façon sûre, en **lecture seule**, sans impacter
la piste d'audit financière ni TAOFIC.

## Décision d'architecture centrale : `uid == clientId`

L'identité agent passera par un **jeton personnalisé Firebase** (`createCustomToken`) émis par une
Cloud Function après vérification téléphone+PIN. **L'uid du jeton = l'id du doc `globalClients`**
(clientId), avec claims `{ role:'agent', clientId, storeId }`.

Conséquences (pourquoi ce choix) :

- **Zéro dénormalisation sur les reçus.** Chaque doc `clients/{storeId}/history/{id}` porte déjà un
  `clientId` obligatoire. La règle « mes reçus » devient `resource.data.clientId == request.auth.uid`
  — **sans nouveau champ, sans migration de l'historique, sans toucher au chemin d'écriture financier
  audité** (`draftService.validateTransaction`, callables settlements). Respecte « ne pas refactoriser
  et changer le comportement dans le même lot ».
- **Piège LIST neutralisé par construction.** Une règle qui teste `resource.data.<x>` casse toute
  requête LIST non contrainte sur ce champ. Ici l'app interroge toujours
  `history where storeId==S and clientId==uid` → la contrainte `clientId==uid` rend la LIST évaluable
  (même patron que les dealers, `firestore.rules` `dealerRequests`). Une LIST non contrainte échoue =
  fail-safe.
- **Liaison autoritative.** L'uid est fixé côté serveur par `createCustomToken` (non forgeable) ; les
  claims sont lus dans les règles via `request.auth.token.*` (aucun `get()` Firestore).

**Alternative rejetée** — dénormaliser un `agentUid` explicite sur chaque reçu : imposerait un backfill
de tout l'historique, une modification de `validTransaction` et du chemin d'écriture audité. Trop
invasif, aucun bénéfice ici. À ne reconsidérer que si un reçu devait un jour être partagé entre
plusieurs identités (non requis).

## Angles morts documentés

- **Transactions manuelles** (agent non enregistré) : `clientId = manual-<reseau>-<code>`, sans doc
  `globalClients` réel → aucun jeton `uid=manual-…` ne sera émis → ces reçus restent **invisibles** de
  toute app agent. Comportement voulu.
- **Agent multi-boutiques** : un même téléphone peut exister dans 2 boutiques (2 docs `globalClients`,
  2 clientId). Le login exigera un `storeId` (sélecteur côté app) → identité déterministe.
- **Namespace Auth partagé** (uid agent = clientId, à côté des uid boutique/dealer générés par Firebase) :
  collision négligeable et non forgeable (uids serveur-contrôlés). Risque résiduel accepté.

## Sécurité (lots ultérieurs)

- **PIN** : jamais en clair, jamais dans `globalClients`, jamais journalisé. Stocké haché (scrypt + sel,
  `node:crypto`) dans `agentCredentials/{clientId}` — collection **Admin SDK only** (`read, write: if false`).
- **Login** : anti-bruteforce (lockout + backoff), comparaison timing-safe, erreurs génériques. App Check
  désactivé aujourd'hui → à activer pour l'app mobile en lot ultérieur.
- **Reçus = lecture seule** : aucun risque pour la piste d'audit (garde-fous sur les chemins d'écriture
  Admin-SDK). Avant d'activer la lecture (Lot 4), **auditer le schéma `history`** pour confirmer l'absence
  de champ sensible (solde boutique) ; sinon exposer via une Cloud Function de projection à champs
  whitelistés plutôt que la lecture directe.

## Opt-in & isolement TAOFIC

Axe profil `mobileApp: { enabled, shareReceipts }` (défaut `false` dans `_pilot.js`, `true` dans
`salawu.js`). Le générateur `scripts/lib/generateRulesBlock.mjs` émet `function mobileAppEnabled()` dans
le bloc PROFIL-GÉNÉRÉ, qui gardera (Lot 4) les clauses de lecture agent. Double isolement TAOFIC :
projet Firebase séparé **et** `mobileAppEnabled() = false`.

## Découpage en lots

- **Lot 1 (fait)** : axe `mobileApp` (profils) ; générateur émet `mobileAppEnabled()` ; `firestore.rules`
  régénéré (TAOFIC baseline = `false`) ; bloc `agentCredentials` réservé (`if false`) ; tests de
  caractérisation (tc-083b, tc-084c, `agentCredentials.rules.test.js`). **Aucune exposition activée.**
- **Lot 2** : Cloud Function `enrollAgentPin` (gérant) + UI boutique (bouton PIN sur la fiche).
- **Lot 3 (fait)** : Cloud Function `agentSignIn({ identifier, code, storeId? })` — `identifier`
  = un **numéro OU code agent** de la fiche (résolu via `loginIdentifiers array-contains`), `code`
  = le code d'accès (vérifié par hash scrypt timing-safe). Anti-bruteforce : verrouillage après
  `MAX_FAILED_ATTEMPTS` échecs (`LOCK_DURATION_MS`), erreurs **génériques** (anti-énumération).
  Succès → `createCustomToken(clientId, { role:'agent', clientId, storeId })`. `createCustomToken`
  injecté (test sans émulateur Auth). Endpoint public (`enforceAppCheck:false`), gardé par
  `MOBILE_APP.enabled`. **Aucune lecture encore autorisée.**
- **Lot 4 (fait)** : clauses de lecture agent activées, gardées par `mobileAppEnabled()` :
  `globalClients` GET `clientId == request.auth.uid` ; `history` read `isAgentToken() &&
  request.auth.token.storeId == storeId && resource.data.clientId == request.auth.uid` (LIST
  contrainte par clientId → fail-safe). Drafts/settlements/agentCredentials NON exposés. Helper
  `isAgentToken()` (claims du jeton, jamais `resource.data`). Index composite
  `history (clientId ASC, createdAt DESC)`. Tests tc-150 (2 profils, 2 boutiques) + tc-114.
  **Déploiement : index D'ABORD (`firebase deploy --only firestore:indexes`, attendre Enabled)
  PUIS règles (`firebase deploy --only firestore:rules`), sur config salawu régénérée ; restaurer
  baseline TAOFIC après.**
- **Lot 5 (fait)** : contrat d'intégration **figé** dans
  [`docs/agent-mobile-app-contract.md`](agent-mobile-app-contract.md) (endpoint `agentSignIn`,
  claims `uid==clientId`, forme des lectures `globalClients`/`history`, contrat d'erreurs,
  invariants). Vérif **bout-en-bout** tc-151 : `generateAgentAccessCode` → `agentSignIn` →
  les **claims réellement émis** sont rejoués dans les **vraies règles salawu**
  (`mobileAppEnabled=true` chargé en test), l'agent lit sa fiche + ses reçus et **rien d'autre**
  (couture handlers ↔ règles, sans déployer salawu ni muter l'arbre). **Aucun déploiement requis**
  (doc + test seuls).
