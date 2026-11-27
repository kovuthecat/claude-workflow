#!/usr/bin/env node
// Bilan de fiabilité de la voie express (P20/S9/T13, décision du 2026-10-14 § Voie express).
//
// POURQUOI CE FICHIER EXISTE
// La voie express n'est bornée par aucune discipline du modèle : les seuils sont refusés au commit
// (`plugin/hooks/pretooluse-git.mjs`), et ce script dit, sur l'historique, si ces seuils sont les bons.
// Trop de commits express rattrapés après coup → la voie est trop large ; aucun sur vingt → trop étroite.
//
// USAGE
//   node plugin/bin/bilan-express.mjs [--json] [--fenetre <n>]
//   (projet vendoré : node .claude/workflow/bin/bilan-express.mjs)
//   Lecture seule : ne modifie ni l'arbre ni l'historique. À lancer à la racine du dépôt.
//
// CE QU'EST UN COMMIT EXPRESS
// Un commit dont le message porte une ligne `Express : <cause en une ligne>`.
//
// CE QU'EST UN COMMIT « RATTRAPÉ »
// Un commit express suivi (commit postérieur) d'un signal qui le CITE — son sha, 7 caractères ou plus :
//   - `bloquant`    un bloquant de relecture : un commit dont le message porte `N bloquant(s)` ou
//                   `Bloquant : N` (N ≥ 1), ou un `plans/P<n>/S<k>.revue.md` présent dans l'arbre qui
//                   cite le sha avec `Bloquant : N` (N ≥ 1) ;
//   - `n0-rouge`    un N0 rouge : un commit dont le message porte `N0 rouge` / `N0 : FAIL` ;
//   - `correction`  tout autre commit postérieur qui le cite (« corrige abc1234 »).
// Un commit qui ne cite pas le sha n'est jamais compté : le script ne devine pas de lien.
//
// VERDICT (sur les `--fenetre` derniers commits express, 20 par défaut)
//   resserrer       au moins 10 commits express et plus de 1 sur 10 rattrapé
//   élargir         20 commits express et aucun rattrapé
//   maintenir       entre les deux
//   insuffisant     moins de 10 commits express : trop peu pour conclure (le taux est affiché quand même)
//
// SORTIE : texte lisible, ou JSON avec --json. Code 0 ; 2 hors dépôt git.

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SEUILS = { minimum: 10, fenetre: 20, tauxResserrer: 0.1 };

const args = process.argv.slice(2);
const json = args.includes('--json');
const iFenetre = args.indexOf('--fenetre');
const fenetre = iFenetre >= 0 ? Number(args[iFenetre + 1]) : SEUILS.fenetre;
if (!Number.isInteger(fenetre) || fenetre < 1) {
  console.error('--fenetre attend un entier ≥ 1');
  process.exit(2);
}

const git = (...a) => execFileSync('git', a, {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024,
});

let racine;
try {
  racine = git('rev-parse', '--show-toplevel').trim();
} catch {
  console.error('bilan-express : pas un dépôt git');
  process.exit(2);
}

// Historique, du plus ancien au plus récent. Dépôt sans commit : liste vide.
let commits = [];
try {
  commits = git('log', '--reverse', '--format=%H%x1f%B%x1e').split('\x1e')
    .map((bloc) => bloc.replace(/^\n+/, ''))
    .filter(Boolean)
    .map((bloc) => {
      const [sha, ...corps] = bloc.split('\x1f');
      const message = corps.join('\x1f').trim();
      return { sha, sujet: message.split('\n')[0], message };
    });
} catch { /* aucun commit */ }

const RE_EXPRESS = /^[ \t]*Express[ \t]*:[ \t]*(\S.*)$/m;
const cite = (texte, sha) => (texte.match(/\b[0-9a-f]{7,40}\b/gi) ?? []).some((m) => sha.startsWith(m.toLowerCase()));

const RE_BLOQUANT = /\b[1-9]\d*\s+bloquants?\b|\bBloquant\s*:\s*[1-9]\d*/i;
const RE_N0_ROUGE = /\bN0\s*(?:[:=]\s*)?(?:rouge|FAIL|KO)\b/i;

// Revues déposées dans l'arbre (`plans/P<n>/S<k>.revue.md`) : le relecteur peut citer un commit express.
const revues = [];
try {
  const dossierPlans = join(racine, 'plans');
  if (existsSync(dossierPlans)) {
    for (const plan of readdirSync(dossierPlans)) {
      if (!/^P\d+$/.test(plan)) continue;
      for (const f of readdirSync(join(dossierPlans, plan))) {
        if (!/^S\d+\.revue\.md$/.test(f)) continue;
        const texte = readFileSync(join(dossierPlans, plan, f), 'utf8');
        if (/^Bloquant\s*:\s*[1-9]\d*/m.test(texte)) revues.push({ nom: `plans/${plan}/${f}`, texte });
      }
    }
  }
} catch { /* plans illisibles : aucune revue comptée */ }

const express = [];
commits.forEach((c, i) => {
  const m = RE_EXPRESS.exec(c.message);
  if (!m) return;
  const signaux = [];
  for (const apres of commits.slice(i + 1)) {
    if (!cite(apres.message, c.sha)) continue;
    const type = RE_BLOQUANT.test(apres.message) ? 'bloquant' : RE_N0_ROUGE.test(apres.message) ? 'n0-rouge' : 'correction';
    signaux.push({ type, commit: apres.sha.slice(0, 7), sujet: apres.sujet });
  }
  for (const r of revues) {
    if (cite(r.texte, c.sha)) signaux.push({ type: 'bloquant', commit: null, sujet: r.nom });
  }
  express.push({
    sha: c.sha.slice(0, 7), sujet: c.sujet, cause: m[1].trim(), rattrape: signaux.length > 0, signaux,
  });
});

const retenus = express.slice(-fenetre);
const n = retenus.length;
const rattrapes = retenus.filter((e) => e.rattrape).length;
const taux = n === 0 ? 0 : rattrapes / n;

let verdict, explication;
if (n < SEUILS.minimum) {
  verdict = 'insuffisant';
  explication = `${n} commit(s) express sur ${SEUILS.minimum} au moins nécessaires : trop peu pour conclure` +
    (n > 0 && taux > SEUILS.tauxResserrer ? ` (le taux est déjà au-dessus du seuil de ${SEUILS.tauxResserrer * 100} % : à surveiller)` : '');
} else if (taux > SEUILS.tauxResserrer) {
  verdict = 'resserrer';
  explication = `${rattrapes} express rattrapé(s) sur ${n} : plus de 1 sur 10 — la voie est trop large, resserrer les seuils`;
} else if (n >= SEUILS.fenetre && rattrapes === 0) {
  verdict = 'élargir';
  explication = `aucun express rattrapé sur ${n} : la voie est sûre, ses seuils peuvent être élargis`;
} else {
  verdict = 'maintenir';
  explication = `${rattrapes} express rattrapé(s) sur ${n} : entre « plus de 1 sur 10 » et « 0 sur ${SEUILS.fenetre} », rien à changer`;
}

const resultat = { express: n, rattrapes, taux, fenetre, verdict, explication, commits: retenus };

if (json) {
  console.log(JSON.stringify(resultat));
} else {
  const lignes = [
    'Voie express — bilan de fiabilité',
    `Commits express : ${n} (fenêtre : les ${fenetre} derniers)`,
    `Rattrapés : ${rattrapes} (${Math.round(taux * 100)} %)`,
  ];
  for (const e of retenus.filter((x) => x.rattrape)) {
    lignes.push(`  ${e.sha} ${e.sujet}`);
    for (const s of e.signaux) lignes.push(`    ← ${s.type} : ${s.commit ? `${s.commit} ` : ''}${s.sujet}`);
  }
  lignes.push(`Verdict : ${verdict} — ${explication}`);
  console.log(lignes.join('\n'));
}
process.exit(0);
