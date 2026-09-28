# `MOBILE_APP_DISABLED` — c'est notre déploiement, pas un réglage manquant

> **De :** l'équipe serveur (logiciel web ESAHAF / salawu).
> **Date :** 2026-09-25.
> **Objet :** « Où s'active l'app mobile agents pour un client, et pouvez-vous l'ouvrir sur la
> boutique de test ? »

---

## La réponse courte

**Il n'y a rien à ouvrir sur la boutique de test.** Aucun réglage par boutique n'existe, et le
nôtre est déjà à `true`. Ce que vous rencontrez est une **erreur de notre déploiement** : les
fonctions en ligne portent la configuration d'un autre client.

Nous la corrigeons. Vous n'avez rien à faire, et rien à changer dans l'application.

---

## Où s'active la fonctionnalité, puisque vous demandez

Pas dans Firestore, pas dans la console, pas par boutique. Dans le **profil du client**, un fichier
du dépôt :

```js
// config/clients/salawu.js
mobileApp: { enabled: true, shareReceipts: true }
```

Ce profil est **compilé dans l'artefact déployé** au moment du déploiement — il devient une
constante des Cloud Functions et une fonction des règles Firestore. Ce n'est donc pas un
interrupteur qu'on actionne à chaud : c'est une propriété de ce qui est en ligne.

C'est tout ou rien pour l'installation entière. Il n'existe aucun moyen de l'activer pour une
boutique et pas une autre, et le message que voyait le gérant — « pas activée pour **cette
boutique** » — était trompeur sur ce point. Nous l'avons corrigé : il dit maintenant « sur cette
installation ».

---

## Ce qui s'est passé

Le dépôt garde, par sécurité, la configuration d'un **autre client** comme valeur committée : ce
client-là est en production et n'a pas l'app mobile. Déployer suppose donc de régénérer la
configuration pour salawu **avant**, puis de la restaurer après.

Ce dernier déploiement est parti sans cette régénération. Les fonctions en ligne portent donc
`enabled: false`, et refusent immédiatement — d'où le `MOBILE_APP_DISABLED` que vous recevez sur
les deux endpoints.

Le symptôme est propre et cohérent, ce qui le rend trompeur : rien ne ressemble à une panne, tout
ressemble à un réglage manquant. Vous avez eu raison de demander où il se trouvait.

---

## ⚠ Un second effet que vous rencontrerez sinon — à connaître comme diagnostic

Le même drapeau existe **deux fois** : dans les fonctions, et dans les règles Firestore
(`mobileAppEnabled()`). Les deux sont actuellement à `false` en ligne.

Si seules les fonctions repartaient, vous obtiendriez une panne bien plus difficile à lire :

| Ce que vous verriez | Ce que ce serait |
|---|---|
| `agentSignIn` réussit, jeton valide, mais **toutes les lectures refusées** | les règles n'ont pas suivi les fonctions |

Retenez-le comme signature : **connexion qui marche + lectures vides = règles en retard**, jamais
un problème de jeton. Les deux partent ensemble de notre côté, vous ne devriez pas le voir.

---

## Ce que ça ne change pas

- Le contrat reste exactement celui du document que vous avez.
- `agentSessionCheck` est bien déployée — c'est d'ailleurs ce que prouve le fait qu'elle vous
  réponde `MOBILE_APP_DISABLED` plutôt qu'un 404.
- Votre banc d'essai passera de **DIFFÉRÉ** à `valid:true` sans que vous touchiez à l'application.

Nous vous prévenons dès que c'est en ligne.
