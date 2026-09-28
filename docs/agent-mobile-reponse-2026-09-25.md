# `agentSessionCheck` — elle existe déjà, et elle respecte votre contrat

> **De :** l'équipe serveur (logiciel web ESAHAF / salawu).
> **Date :** 2026-09-25.
> **Objet :** réponse à votre document du jour.
> **En un mot :** ne déployez pas votre implémentation, la nôtre est écrite et testée. Mais votre
> document contient deux choses qui valent plus que ce code — voir §3 et §5.

---

## 1. La fonction est déjà écrite

Elle faisait partie du lot annoncé hier (« révocation — fait, et plus loin que demandé »). Vous
l'avez rédigée de votre côté parce que nous ne l'avions pas encore déployée : c'est notre retard,
pas un malentendu de votre part.

Votre §1 décrit exactement ce qu'elle fait. Point par point, vérifié dans le code :

| Ce que vous attendez | État |
|---|---|
| `agentSessionCheck`, région `europe-west1` | ✅ |
| `onCall`, authentifiée | ✅ |
| **Aucun paramètre** — `request.data` n'est jamais lu ni validé | ✅ |
| Réponse `{ valid: true \| false }`, rien d'autre | ✅ |
| Aucune écriture | ✅ une lecture de document |
| Aucune limite de débit | ✅ décision explicite : elle est authentifiée et ne coûte presque rien |

### Le point `details.code` — c'est déjà le cas, et pour toutes nos callables

Vous insistez, à juste titre : sans `details: { code: … }`, votre application ne reconnaît pas le
verdict et conserve la session.

Toutes nos callables passent par un enveloppeur commun qui fait exactement cela :

```js
throw new HttpsError(err.httpCode, err.message, { code: err.code })
```

Donc :

| `details.code` | HTTP |
|---|---|
| `UNAUTHENTICATED` | `unauthenticated` |
| `ROLE_FORBIDDEN` | `permission-denied` |
| `MOBILE_APP_DISABLED` | `failed-precondition` |

Ce n'est pas une adaptation faite pour vous : c'est le mécanisme d'erreur de tout le projet depuis
le début. Vous pouvez compter dessus pour les autres endpoints aussi.

### Le drapeau « application coupée » — il est branché

Vous demandiez si `MOBILE_APP_DISABLED` pouvait être rendu. Oui : le même garde que `agentSignIn`
est en place, en **première** position — avant même le contrôle d'authentification. Conséquence
mineure à connaître : si la fonctionnalité était coupée, un appel non authentifié recevrait
`MOBILE_APP_DISABLED` plutôt que `UNAUTHENTICATED`. Votre table traite ce code comme « le reste »,
donc la session reste en l'état. C'est le bon comportement.

---

## 2. Vos deux noms à confirmer — confirmés, pas besoin de la console

Votre §5. Les deux se lisent dans le code qui **écrit** ces documents :

| Ce que vous supposiez | Vérifié |
|---|---|
| `agentCredentials/{clientId}` — document identifié par le `clientId` | ✅ exact. L'écriture est `db.doc('agentCredentials/' + clientId)`. Pas besoin du repli `.where('clientId','==',…)`. |
| `donnees.codeVersion` | ✅ nombre, initialisé à 1, incrémenté à chaque régénération |
| `donnees.active` | ✅ booléen. ⚠ **Aucun code du produit ne l'écrit jamais à `false` aujourd'hui.** Le seul geste de révocation est la régénération. |

---

## 3. Votre `normaliserVersion` — nous sommes d'accord, et nous l'étions déjà

C'est le meilleur passage de votre document, et le raisonnement est le bon : si le claim et le
document portaient ce champ dans deux types différents, une comparaison stricte rendrait
`valid: false` pour **tout le monde, en permanence** — et chacun tournerait en boucle
déconnexion / reconnexion. Ce mode de panne est effectivement bien pire que l'attaque qu'une
comparaison stricte préviendrait.

Notre implémentation est tolérante de la même façon, par un autre chemin : la comparaison se fait
sur `Number(…) === Number(…)`, donc `3` et `'3'` sont équivalents comme chez vous.

Une seule différence, et elle est théorique : votre `normaliserVersion` rejette explicitement les
booléens, la nôtre convertirait `true` en `1`. Nous ne la corrigeons pas, pour une raison
vérifiable : **ce claim est posé par notre propre `agentSignIn`**, qui écrit
`Number(codeVersion) || 1`, et les claims sont **signés par Firebase** — ils ne sont pas
falsifiables côté client. Aucun booléen ne peut arriver là.

Même remarque sur `active === false` plutôt que `!== true` : nous avons fait le même choix, pour
la même raison que vous énoncez.

---

## 4. Une divergence mineure, pour que vous ne la preniez pas pour un bug

Vous résolvez l'identifiant ainsi :

```ts
const clientId = typeof claims.clientId === 'string' && claims.clientId !== ''
  ? claims.clientId : auth.uid;
```

Nous lisons **uniquement `auth.uid`**. Le résultat est identique : dans cette architecture
`uid == clientId` par construction — c'est le jeton personnalisé émis par `agentSignIn` qui le
garantit. Le repli n'a donc rien à rattraper, et s'en passer retire une source d'autorité à
raisonner.

---

## 5. ⚠ Votre §8.1 change notre priorité — merci de l'avoir écrit

> « `dernier_contact` n'est remis à zéro que par un `{ valid: true }`. Tant que la fonction
> n'existe pas, ce compteur ne redescend jamais — donc le verrou se déclencherait pour tout le
> monde au septième jour. »

Nous ne l'avions pas vu, et c'est l'information la plus importante de votre document.

Elle transforme notre déploiement d'« amélioration attendue » en **condition dure de votre
première livraison**. Un déploiement en retard ne dégraderait pas le service : il **fermerait tous
les guichets** au septième jour, simultanément, sans que rien à l'écran ne l'explique.

C'est traité en conséquence. Nous vous préviendrons dès que les trois fonctions seront en ligne.

---

## 6. ⚠ Votre commande de déploiement ne marchera pas sur ce projet

Votre §6 propose :

```bash
firebase deploy --only functions:agentSessionCheck
```

Sur notre outillage (`firebase-tools` 15.x), cette forme échoue avec
**« No function matches given --only filters »**, et ce **avant même l'analyse du source** — donc
sans rien dire d'utile. Il faut la forme qualifiée par le codebase :

```bash
firebase deploy --only "functions:default:agentSessionCheck" --project salawu
```

Deux autres pièges que nous connaissons par expérience sur ce projet :

- poser `FUNCTIONS_DISCOVERY_TIMEOUT=120` — le délai d'analyse par défaut (10 s) est trop court
  ici et le déploiement échoue sans raison apparente ;
- **lire chaque ligne de la sortie**. Un `--only` portant plusieurs noms n'en a déjà passé qu'un
  en silence sur ce projet. Il faut voir une ligne `create` ou `update` **par fonction attendue**.

Votre avertissement sur la région est juste et nous le reprenons : si la sortie dit
`us-central1`, l'appel mobile recevra un 404 sans en-tête CORS, et le message parlera de CORS —
ce qui envoie chercher au mauvais endroit.

Cela dit, ce déploiement est le nôtre : vous n'avez pas à le lancer.

---

## 7. Ce qui reste vrai depuis hier

- **`agentSignIn` part avec.** Votre §2 a raison : déployée seule, `agentSessionCheck` déclarerait
  tous les jetons invalides et créerait la boucle que vous décrivez. Les trois fonctions partent
  ensemble.
- **Une reconnexion unique** sera nécessaire pour les sessions déjà ouvertes. Seules vos sessions
  de test sont concernées.
- **Ni les règles ni les index ne changent.**

---

## 8. Une suggestion de votre document que nous n'avons pas retenue — dites-nous

Vous posez `maxInstances: 10` « pour borner la facture si le client se met à boucler ». L'idée est
bonne et le mode de panne est réel — c'est celui de votre propre §2.

Nous ne l'avons pas mis, parce qu'un plafond trop bas se paie en `429` sous rafale, et que nous
n'avons pas de mesure de votre cadence d'appel réelle. Si vous nous dites à quelle fréquence
l'application appellera en régime normal — et combien d'agents sont attendus —, nous le posons à
une valeur qui borne la dépense sans risquer de refuser du trafic légitime.
