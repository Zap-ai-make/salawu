# Assets de marque par client (logos)

Le **nom** du produit dérive du profil (`config/clients/<id>.js` → `branding`). Les **images
de logo**, elles, ne sont pas paramétrables par code : ce sont des fichiers à **noms fixes et
neutres** dans `public/`. Le nom du fichier ne porte donc jamais celui d'un client — c'est le
dossier `branding/<clientId>/` qui porte l'identité, et `index.html` étant statique, il ne peut
référencer qu'un seul nom pour tous les clients. On swappe les images **au déploiement**
(geste transitoire, comme la régénération des règles).

## Structure

```
branding/<clientId>/brand-mark.svg    → public/brand-mark.svg
branding/<clientId>/pwa-192x192.png   → public/pwa-192x192.png
branding/<clientId>/pwa-512x512.png   → public/pwa-512x512.png
```

`<clientId>` est l'identifiant **normalisé** (ex. `salawu`).

## Appliquer avant un build/déploiement client

```bash
node scripts/apply-branding.mjs --client salawu
VITE_CLIENT_ID=salawu npm run build
# ⚠ ne PAS committer public/ modifié ; restaurer après si besoin : git checkout -- public/
```

Client sans dossier dédié (ex. `taofic_ajagbe`) → le script ne fait rien, la marque déjà
présente dans `public/` reste en place.

Depuis le commit `1de88c2`, la marque commitée dans `public/` est **celle d'ESAHAF** : ce dépôt
est dédié à ce client et sert son logo par défaut. Appliquer `branding/salawu/` est donc un
non-événement ici ; le script garde son intérêt pour tout autre client.

## Clients

| Client | Dossier | Source |
|---|---|---|
| `salawu` (ESAHAF) | `branding/salawu/` | Logo « Ets. SALAWU Hamidou et Frère / E.SA.HA.F » (fourni par le client), reconstruit en SVG puis rendu en PNG. |
