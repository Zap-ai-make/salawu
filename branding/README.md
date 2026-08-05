# Assets de marque par client (logos)

Le **nom** du produit dérive du profil (`config/clients/<id>.js` → `branding`). Les **images
de logo**, elles, ne sont pas paramétrables par code : ce sont des fichiers à noms fixes dans
`public/`. On les swappe **au déploiement** du client (geste transitoire, comme la régénération
des règles) — jamais commité sur `main`, sinon on changerait le logo du client par défaut (TAOFIC).

## Structure

```
branding/<clientId>/akayis-mark.svg     → public/akayis-mark.svg
branding/<clientId>/pwa-192x192.png     → public/pwa-192x192.png
branding/<clientId>/pwa-512x512.png     → public/pwa-512x512.png
```

`<clientId>` est l'identifiant **normalisé** (ex. `salawu`).

## Appliquer avant un build/déploiement client

```bash
node scripts/apply-branding.mjs --client salawu
VITE_CLIENT_ID=salawu npm run build
# ⚠ ne PAS committer public/ modifié ; restaurer après si besoin : git checkout -- public/
```

Client sans dossier dédié (ex. `taofic_ajagbe`) → le script ne fait rien, la marque
AKAYIS/TAOFIC de `public/` reste en place.

## Clients

| Client | Dossier | Source |
|---|---|---|
| `salawu` (ESAHAF) | `branding/salawu/` | Logo « Ets. SALAWU Hamidou et Frère / E.SA.HA.F » (fourni par le client), reconstruit en SVG puis rendu en PNG. |
