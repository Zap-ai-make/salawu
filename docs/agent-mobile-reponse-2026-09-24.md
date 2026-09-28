# Ce qui change côté serveur — réponse à l'équipe mobile

> **De :** l'équipe serveur (logiciel web ESAHAF / salawu).
> **Date :** 2026-09-24.
> **Objet :** réponse à la demande du même jour.
> **Récapitulatif :** 1 — chez vous · 2 — fait, et étendu · 3 — abandonné, remplacé · 4 — ci-dessous.
> **Déploiement : pas encore en ligne.** Code écrit et testé, non déployé (voir §5).

Vos quatre points sont traités. Le deuxième est allé plus loin que ce que vous demandiez, parce
que votre solution laissait un trou que vous ne pouviez pas voir depuis l'application. Et votre
question de fin appelle une réponse nette : **non**.

---

## 0. Votre question : non, et c'est même un peu pire

> « Est-ce que passer `active` à `false` coupe une session déjà ouverte, ou souffre-t-il du même
> angle mort que la régénération ? »

**Le même angle mort.** Vérifié dans le code, pas supposé :

- `active` n'était lu qu'à **un seul endroit** — le filtre de candidats de `agentSignIn`. C'est une
  porte d'entrée, pas un interrupteur.
- Les règles Firestore ne consultent **jamais** le credential : `isAgentToken()` ne lit que le
  claim `role`.
- `revokeRefreshTokens` n'existait **nulle part** dans le dépôt.

Un peu pire, parce qu'une régénération change au moins un secret que l'agent doit réapprendre,
alors qu'`active: false` ne faisait rien du tout à qui était déjà entré.

> **Et il n'y a de toute façon pas de désactivation.** Aucun code du produit n'écrit
> `active: false` aujourd'hui. Le seul geste de révocation est la **régénération du code**. Ne
> construisez rien qui suppose un interrupteur séparé.

---

## 1. Compte de test — il est prêt

Les identifiants vous sont transmis séparément : ils ne voyagent pas dans un document.

Il vit dans une **boutique de test**, pas dans une boutique en activité — ses reçus supposent de
vraies transactions, qui déplacent le stock électronique et le chiffre du jour. Vous pouvez donc
régénérer et transiger autant que vous voulez, vous ne polluez rien.

La dissymétrie que vous demandiez est en place : un réseau avec la seule clé à plat (code agent),
un autre avec le seul `numerosAgent.<reseau>` (numéro agent).

---

## 2. Révocation — fait, et plus loin que demandé

Vos deux demandes sont livrées : `codeVersion` rejoint les claims, et `agentSessionCheck()`
existe. Nous avons ajouté un troisième morceau, et c'est le plus important.

### Le trou que votre solution ne bouchait pas

`agentSessionCheck()` est **consultatif** : il ne vaut que si l'application l'appelle et honore la
réponse. Contre « la secrétaire part avec l'app », c'est parfaitement suffisant — elle ne va pas
repatcher l'APK. Mais rien ne l'impose, et il fallait le nommer pour que personne ne croie plus
tard à une révocation dure.

Nous avons donc ajouté la moitié qui ne dépend pas de vous : la régénération appelle désormais
`revokeRefreshTokens`. Firebase refuse alors de renouveler le jeton, **quoi que fasse
l'appareil**.

| Mécanisme | Force | Délai de coupure |
|---|---|---|
| `revokeRefreshTokens` | **imposé** — côté serveur, sans coopération de l'app | ≤ 1 h (durée de vie de l'ID token en cours) |
| `agentSessionCheck` | **consultatif** — suppose que l'app appelle et obéit | quasi immédiat |

Le premier pose le plafond dur, le second raccourcit le reliquat. La fenêtre passe d'**infinie** à
**une heure au pire**, même si votre app n'appelle jamais rien.

> **Un signal que vous recevez gratuitement.** Quand le rafraîchissement échoue, le SDK JavaScript
> **déconnecte l'utilisateur**. Votre `onAuthStateChanged` passe à `null` sans que vous ajoutiez
> quoi que ce soit.

### Votre filet de 7 jours

**Gardez-le.** Il couvre désormais un trou bien plus étroit — l'appareil qui n'a aucun contact
réseau —, mais c'est précisément le cas que ni la révocation ni le contrôle de session ne peuvent
atteindre. Vous pouvez en revanche cesser de le considérer comme votre seul recours.

### L'appel

```js
const check = httpsCallable(functions, 'agentSessionCheck')
const { data } = await check()          // → { valid: true | false }
if (!data.valid) await signOut(auth)
```

Authentifiée, sans paramètre, une lecture de document — aucun scrypt. Elle n'est pas soumise à la
limite de débit décrite au §3. Appelez-la à chaque contact réseau comme vous l'envisagiez.

> ⚠ **Vos sessions de test actuelles seront invalidées.** Un jeton **sans** claim `codeVersion`
> est déclaré invalide — ce sont ceux émis avant ce lot. Les accepter ouvrirait un contournement
> permanent : il suffirait de présenter un vieux jeton pour n'être jamais coupé. Concrètement, au
> déploiement, toute session ouverte demandera **une** reconnexion complète, code d'accès compris.

---

## 3. App Check — abandonné, et remplacé

**Nous ne l'activerons pas**, ni en blocage ni en surveillance. Mieux : il ne figure plus au plan.
Vous n'avez pas à changer de SDK.

Votre Face 2 était la bonne inquiétude, et elle nous concernait plus que vous : App Check était
notre *précondition* avant d'ouvrir `agentSignIn` au public. Nous ne pouvions donc pas nous
contenter d'y renoncer — il fallait la remplacer.

### Ce qu'App Check devait fermer

`agentSignIn` est public et non authentifié, et chaque appel exécute un scrypt bloquant — **y
compris sur un identifiant inconnu**, où le verrou par compte n'a rien à verrouiller et où rien ne
comptait ces appels. Un attaquant obtenait un scrypt par paquet, indéfiniment.

### Ce qui le remplace

Une **limite de débit par adresse IP**, appliquée avant toute dépense : **20 tentatives par
10 minutes**, puis **15 minutes de blocage**. Côté serveur uniquement. Rien à faire de votre côté,
sauf traiter un nouveau code d'erreur.

| Code | Ce que ça vise |
|---|---|
| `ACCOUNT_LOCKED` | **un compte** — cinq mauvais codes d'affilée |
| `TOO_MANY_ATTEMPTS` | **une provenance** — trop d'appels depuis un réseau |

> ⚠ **Ce code n'accuse pas l'agent.** Un marché entier peut sortir derrière une seule adresse.
> L'agent qui le reçoit n'a peut-être rien fait de particulier : le message doit rester neutre et
> inviter à réessayer, **surtout pas suggérer que le code saisi est faux**.
>
> Il tombe **avant** la validation d'entrée : une requête bloquée ne renverra donc jamais
> `INVALID_LOGIN_INPUT`, même avec un payload malformé.

Une précision d'honnêteté : votre affirmation sur les fournisseurs App Check du SDK JavaScript,
nous ne l'avons **pas vérifiée** — c'est votre terrain. Notre décision ne s'appuie pas dessus : la
limite de débit atteint le même but de coût, et elle était de toute façon le chemin le moins
coûteux pour les deux équipes.

---

## 4. Le contrat figé

`agent-mobile-app-contract.md` est à jour de tout ce qui précède — `codeVersion` dans les claims,
`agentSessionCheck`, la révocation, et le contrat d'erreurs complet avec `TOO_MANY_ATTEMPTS`.

Le document de stockage que vous aviez déjà a été mis à jour en parallèle : il décrit maintenant
quatre appels au lieu de trois.

---

## 5. Ce qui n'est pas encore en ligne

Tout ce qui précède est **écrit et testé, pas déployé**. Nous ne voulions pas vous annoncer un
endpoint qui n'existe pas encore : `agentSessionCheck` renverra une erreur tant que le déploiement
n'a pas eu lieu.

Trois fonctions à déployer (`generateAgentAccessCode`, `agentSignIn`, `agentSessionCheck`). Ni les
règles ni les index ne changent — rien de ce que vous lisez aujourd'hui ne bougera.

**Nous vous préviendrons quand ce sera fait.** Vous pouvez coder contre ce contrat dès maintenant.

---

## 6. Ce que vous devez changer

1. **Traiter `TOO_MANY_ATTEMPTS`** comme un refus temporaire, avec un message neutre. Ne
   l'interprétez pas comme un code erroné.
2. **Appeler `agentSessionCheck()`** à chaque contact réseau, et déconnecter sur
   `{ valid: false }`.
3. **Prévoir une reconnexion unique** au déploiement, pour les sessions de test déjà ouvertes.

Rien d'autre. Vos engagements — aucune écriture, aucune lecture de `agentCredentials`, aucune
hypothèse sur le préfixe — restent exactement ce qu'il faut. Sur le préfixe en particulier : il
est dérivé de la marque du client, donc votre choix de le transmettre tel que l'agent le tape est
le bon pour une app en marque blanche.

---

*Vérifications avant envoi : suite Cloud Functions sur émulateur Firestore — 20 fichiers, 279 cas ;
suite applicative — 131 fichiers, 2 556 cas ; analyse statique propre ; compilation vérifiée pour
les deux clients du dépôt. Les comportements décrits ici sont couverts par les jeux d'essai
TC-149, TC-151, TC-152 et TC-153.*
