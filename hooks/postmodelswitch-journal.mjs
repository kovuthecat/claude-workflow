// Hook PostModelSwitch — journalise les changements de modèle en cours de session.
//
// POURQUOI CE FICHIER EXISTE
// §2 autorise explicitement l'escalade vers Opus (« si la cause d'un bug n'est pas localisée ») et
// §3 distingue monter l'effort de monter le modèle — mais rien n'a jamais tracé qu'une escalade
// avait eu lieu. Le seul réglage du workflow sans boucle de rétroaction. Au bout de quelques
// semaines, « les sessions de type X partent en Sonnet et finissent en Opus 6 fois sur 10 » n'est
// pas un incident : c'est une ligne de la grille §2 qui est fausse, et c'est ce que
// `/analyser-incidents` a besoin de lire pour la corriger.
//
// POURQUOI Post ET PAS Pre
// `PreModelSwitch` peut refuser un changement (`permissionDecision`, qui n'accepte que `allow` et
// `deny` — il n'y a pas de `ask`). Mettre de la friction sur une action que le workflow recommande
// serait le mauvais arbitrage : on trace, on n'empêche pas. `PostModelSwitch` tourne après coup,
// en asynchrone, et ne peut rien bloquer — exactement ce qu'on veut ici.
//
// OÙ VIT LE JOURNAL
// `.claude/journal-modeles.jsonl` à la racine du dépôt. Sous `.claude/` délibérément : le hook
// `Stop` exclut ce dossier de son comptage, donc une ligne écrite ici ne peut ni déclencher un
// faux « fin de session non consignée », ni — pire — en satisfaire un à tort. Une ligne JSON par
// changement, format append-only : concaténable entre projets sans parseur.

import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { lireEntree, repertoireProjet, estUnDepot, racineDepot, riendafaire } from './lib.mjs';

const entree = await lireEntree();
const cwd = repertoireProjet(entree);

if (!estUnDepot(cwd)) riendafaire();

const de = entree.from_model;
const vers = entree.to_model;

// Champs absents (contrat non tenu, autre version) ou changement nul : rien à dire.
if (!de || !vers || de === vers) riendafaire();

try {
  const dossier = join(racineDepot(cwd), '.claude');
  mkdirSync(dossier, { recursive: true });
  appendFileSync(
    join(dossier, 'journal-modeles.jsonl'),
    JSON.stringify({
      date: new Date().toISOString(),
      de,
      vers,
      session: entree.session_id ?? null,
    }) + '\n',
    'utf8',
  );
} catch {
  // Journal best-effort : un disque plein ou un dossier en lecture seule ne doit jamais
  // transformer un changement de modèle légitime en erreur visible.
}

riendafaire();
