/**
 * rechauffage.mjs — payer la compilation a froid AVANT le premier test.
 * ─────────────────────────────────────────────────────────────────────────────
 * LE PROBLEME QU'IL CORRIGE
 *
 * `webServer.url` n'attend que la reponse du serveur Vite. Vite sert `index.html`
 * immediatement et ne transforme les modules qu'a la PREMIERE demande. Le premier
 * test d'une boucle payait donc, seul, la compilation de tout le graphe de
 * l'application — puis rougissait sur un depassement de delai qui ne designait
 * aucun defaut de l'ecran qu'il mesurait.
 *
 * Mesure du 2026-09-17, boucle `-g tableau`, deux executions consecutives :
 *
 *   mobile-375   (premier)  ECHEC  — `nav` absent au bout de 60 000 ms
 *   tablette-768 (deuxieme) 17,8 s
 *   bureau-1440  (troisieme) 17,6 s
 *
 * Trois fois et demie l'ecart, sur le meme ecran et le meme code. Ce n'est pas la
 * largeur qui echoue, c'est le RANG : le premier projet paie pour les autres.
 *
 * POURQUOI PAS SIMPLEMENT RELEVER LE PLAFOND
 *
 * Le plafond est passe de 30 s a 60 s pour cette raison exacte, et le defaut est
 * revenu des que le graphe a grossi. Le relever encore le rendrait muet : a
 * 120 s, plus aucun test ne peut signaler un rendu devenu reellement lent, ce
 * pour quoi le plafond existe. On deplace la depense la ou elle appartient — au
 * RUN — au lieu de l'imputer a un test.
 *
 * POURQUOI UNE CONNEXION COMPLETE, ET PAS UN SIMPLE `goto`
 *
 * L'ecran de connexion n'est qu'une petite part du graphe. Ce qui coute, c'est ce
 * qui vient APRES : le chassis, la barre de navigation, la bande des reserves,
 * les routes `lazy` et recharts. L'echec observe le montre — le champ e-mail
 * etait la, c'est `nav` qui manquait. Rechauffer sans se connecter ne
 * rechaufferait rien d'utile.
 *
 * ⚠ IL NE DOIT JAMAIS FAIRE ECHOUER LA BOUCLE.
 *
 * Un rechauffage est une optimisation, pas un controle. S'il echoue, on le dit et
 * on laisse tourner : les tests paieront la compilation comme avant. Le faire
 * bloquer transformerait une commodite en point de rupture supplementaire, et
 * masquerait le vrai message d'echec derriere celui du `globalSetup`.
 *
 * ⚠ IL NE RECOPIE PAS LES GESTES DE CONNEXION, IL APPELLE `seConnecter`.
 *
 * Premiere version de ce fichier : les gestes etaient recopies, avec `fill` au
 * lieu du `click` + `pressSequentially` + `blur` de `parcours.mjs`. La connexion
 * n'aboutissait pas, le rechauffage attendait `nav` pendant 120 s puis se
 * declarait incomplet — 131,2 s perdues a chaque boucle. L'en-tete de
 * `parcours.mjs` met en garde contre exactement cela : « Les recopier, c'est
 * accepter qu'une correction n'atteigne qu'un fichier sur trois. » La boucle
 * passait quand meme, ce qui est pire : un rechauffage casse et silencieux.
 *
 * ⚠ IL N'AFFIRME RIEN. `seConnecter` contient des `expect`, mais ils ne servent
 * ici qu'a attendre : leur echec est rattrape plus bas et ne caracterise rien.
 * Ce qui est vrai de l'application est dit par les specs, pas par ce fichier.
 */

import { chromium } from '@playwright/test'
import { ETATS } from '../../../scripts/qa/etats-du-banc.mjs'
import { seConnecter } from './parcours.mjs'

const COMPTE = ETATS.dense.compte

export default async function rechauffer(config) {
  const base = config.projects[0]?.use?.baseURL
    || config.webServer?.url
    || 'http://localhost:5174'

  const depart = Date.now()
  let navigateur

  try {
    navigateur = await chromium.launch()
    // `baseURL` sur le contexte : `seConnecter` fait `page.goto('/')`, comme
    // dans les tests. Sans lui, ce chemin relatif n'aurait aucune origine.
    const contexte = await navigateur.newContext({ baseURL: base })
    const page = await contexte.newPage()

    await seConnecter(page, COMPTE)

    console.log(`  rechauffage : graphe compile en ${((Date.now() - depart) / 1000).toFixed(1)} s`)
  } catch (erreur) {
    // Dit, jamais tu. Un rechauffage rate laisse la boucle tourner — et laisse
    // surtout la trace de la raison, sans quoi un premier test lent redeviendrait
    // inexplicable.
    console.log(`  rechauffage INCOMPLET apres ${((Date.now() - depart) / 1000).toFixed(1)} s `
      + `— les tests paieront la compilation : ${erreur.message.split('\n')[0]}`)
  } finally {
    await navigateur?.close().catch(() => {})
  }
}
