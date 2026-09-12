#!/usr/bin/env node
// Publie le payload plugin/ vers le dépôt public de distribution kovuthecat/claude-workflow.
//
// POURQUOI CE FICHIER EXISTE
// Le dépôt public est un artefact de distribution à commit unique, republié à chaque version —
// jamais modifié à la main (voir README §Distribution). La procédure documentée est restée 4
// versions sans tourner : recopier une suite de commandes à la main, dans un clone jetable, avec
// un garde-fou à ne pas oublier, est le genre de tâche qui saute quand on est pressé. Ce script
// l'automatise et rend le garde-fou de sécurité impossible à contourner.
//
// USAGE
//   node publier.mjs [--dry-run]
//
//   --dry-run   fait tout sauf le push : construit le payload temporaire, scanne, affiche ce qui
//               serait poussé, puis nettoie. Aucune écriture réseau.
//
// Idempotent : rejouable à l'identique, le dépôt public n'a pas d'historique à préserver
// (--force assumé, cf. README §Distribution — c'est un artefact, pas un historique).
//
// TEST DES HOOKS AVANT PUBLICATION (v0.30.0)
// Avant toute construction de payload — y compris en --dry-run —, `tests/tester-hooks.mjs` (racine
// du dépôt, jamais vendoré) rejoue les quatre hooks sur des dépôts git jetables. Un hook qui refuse
// à tort ou laisse passer à tort n'est visible qu'en session, dans un projet aval, longtemps après
// la publication : le test échoue → publication annulée, rien poussé.

import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync, cpSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const DEPOT_PUBLIC = 'https://github.com/kovuthecat/claude-workflow.git';

// ── Racine du payload ────────────────────────────────────────────────────────
// Résolue depuis son propre emplacement (plugin/bin/publier.mjs → plugin/), jamais depuis
// process.cwd() : le script doit se lancer identiquement peu importe le dossier courant.
const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE_PAYLOAD = dirname(ICI);

const dryRun = process.argv.includes('--dry-run');

const version = (() => {
  const p = join(RACINE_PAYLOAD, '.claude-plugin', 'plugin.json');
  return JSON.parse(readFileSync(p, 'utf8')).version;
})();

const BINAIRES = /\.(png|jpg|jpeg|gif|ico|woff2?|zip)$/i;
// Chemin utilisateur RÉEL — pas les exemples en ellipse de la doc (`C:\Users\…`). Cette regex
// exige un segment alphanumérique après le séparateur, ce que l'ellipse ne fournit pas : elle
// ne matche donc pas les exemples cités dans README §Distribution.
const CHEMIN_PERSONNEL = /[A-Za-z]:\\Users\\[A-Za-z0-9]|\/home\/[a-z0-9]+\/|\/Users\/[a-z0-9]+\//;

function fichiersDe(racine) {
  const out = [];
  const parcourir = (rel) => {
    const abs = join(racine, rel);
    for (const e of readdirSync(abs)) {
      if (e === '.git') continue;
      const relE = rel ? join(rel, e) : e;
      const absE = join(racine, relE);
      if (statSync(absE).isDirectory()) parcourir(relE);
      else out.push(relE);
    }
  };
  parcourir('');
  return out;
}

function scannerCheminsPersonnels(racine, fichiers) {
  const hits = [];
  for (const f of fichiers) {
    if (BINAIRES.test(f)) continue;
    let txt;
    try { txt = readFileSync(join(racine, f), 'utf8'); } catch { continue; } // illisible en utf8 → pas du texte
    const lignes = txt.split('\n');
    for (let i = 0; i < lignes.length; i++) {
      if (CHEMIN_PERSONNEL.test(lignes[i])) hits.push(`${f}:${i + 1}`);
    }
  }
  return hits;
}

function git(args, options = {}) {
  return execFileSync('git', args, { windowsHide: true, stdio: 'pipe', ...options });
}

// ── Test des hooks — condition d'entrée, avant tout le reste ─────────────────
// Racine du dépôt = parent de RACINE_PAYLOAD (plugin/ → racine). Le test vit hors `plugin/` : il
// n'est jamais vendoré, un projet aval n'a pas à le committer pour un outillage qu'il ne modifie pas.
function testerHooks() {
  const racineDepot = dirname(RACINE_PAYLOAD);
  const scriptTest = join(racineDepot, 'tests', 'tester-hooks.mjs');
  try {
    execFileSync('node', [scriptTest], { cwd: racineDepot, stdio: 'inherit', windowsHide: true });
  } catch {
    console.error('publier: test des hooks en échec — publication annulée, rien poussé');
    process.exit(1);
  }
}

// ── Garde-fou de synchronisation du dépôt SOURCE ─────────────────────────────
// Le 2026-08-28, ce dépôt local était en retard d'un commit sur origin/main : la 0.16.2 avait été
// poussée depuis un autre poste et jamais rapatriée ici. Le payload est donc parti d'un arbre
// amputé, en --force — le miroir public a perdu plugin/LICENSE, l'exclusion de publier.mjs du
// vendoring et les corrections README, jusqu'à ce que la divergence soit repérée à la main et
// réparée par un rebase + republication. Le scan de chemins personnels regarde le contenu du
// payload, jamais l'état du dépôt qui le produit : sur un chemin qui pousse en --force, être en
// retard suffit à détruire du contenu déjà publié.
//
// Retard → refus (même modèle que le scan de chemins personnels). Arbre sale ou HEAD en avance →
// avertissement seulement : publier depuis un commit local non encore poussé est légitime, mais
// mérite d'être vu passer.
function verifierSynchroSource() {
  const gitSource = (args) => git(args, { cwd: RACINE_PAYLOAD }).toString().trim();

  try {
    gitSource(['fetch', 'origin']);
  } catch {
    // Réseau coupé, ou remote absent chez qui aurait forké ce workflow. Non bloquant : le push qui
    // suit échouerait de lui-même, et --dry-run doit rester utilisable hors ligne. Mais la
    // comparaison ci-dessous porte alors sur un origin/main peut-être périmé — donc le dire.
    console.warn('publier: AVERTISSEMENT — `git fetch origin` a échoué ; la vérification ci-dessous');
    console.warn('  porte sur une référence origin/main possiblement périmée.');
  }

  let comptes;
  try {
    comptes = gitSource(['rev-list', '--left-right', '--count', 'origin/main...HEAD']);
  } catch {
    console.warn('publier: AVERTISSEMENT — origin/main introuvable : synchronisation non vérifiée.');
    return;
  }
  // `--left-right --count` sur A...B : « commits de A absents de B » puis « de B absents de A »,
  // soit ici retard puis avance.
  const [retard, avance] = comptes.split(/\s+/).map(Number);

  if (retard > 0) {
    console.error(`publier: dépôt source en retard de ${retard} commit(s) sur origin/main — publication annulée, rien poussé`);
    console.error('  Le push est un --force : publier depuis un arbre en retard écrase le miroir');
    console.error('  public avec un contenu amputé (constaté le 2026-08-28, v0.16.2 perdue).');
    console.error('  → git pull --rebase, puis relancer.');
    process.exit(1);
  }

  const sale = gitSource(['status', '--porcelain']);
  if (sale) {
    console.warn(`publier: AVERTISSEMENT — arbre de travail non propre (${sale.split('\n').length} entrée(s)) :`);
    console.warn('  le payload part tel quel, modifications non committées comprises.');
  }
  if (avance > 0) {
    console.warn(`publier: AVERTISSEMENT — HEAD est en avance de ${avance} commit(s) non poussé(s) :`);
    console.warn("  le miroir public sortira d'un état absent de origin/main.");
  }
  if (!sale && avance === 0) console.log('publier: dépôt source synchronisé avec origin/main');
}

let tmp;
try {
  // Avant tout le reste, --dry-run compris : les hooks doivent tenir avant qu'on publie quoi que
  // ce soit qui les embarque.
  testerHooks();

  // Avant toute construction : le dépôt qui produit le payload doit être à jour (le push est --force).
  verifierSynchroSource();

  // ── Construction du payload dans un dossier jetable ──────────────────────
  // Tout plugin/ part tel quel : c'est déjà le périmètre exact du dépôt public, rien à exclure.
  tmp = mkdtempSync(join(tmpdir(), 'claude-workflow-publier-'));
  cpSync(RACINE_PAYLOAD, tmp, { recursive: true });

  const fichiers = fichiersDe(tmp);

  // ── Garde-fou bloquant : aucun chemin personnel réel ne doit sortir ──────
  const hits = scannerCheminsPersonnels(tmp, fichiers);
  if (hits.length > 0) {
    console.error('publier: chemin(s) personnel(s) détecté(s) dans le payload — publication annulée, rien poussé');
    for (const h of hits) console.error(`  ${h}`);
    process.exit(1);
  }

  console.log(`publier: payload propre — ${fichiers.length} fichiers, version ${version}`);

  if (dryRun) {
    console.log(`publier: --dry-run — payload construit dans ${tmp}`);
    console.log(`publier: aurait poussé vers ${DEPOT_PUBLIC} (HEAD:main, --force) avec le message :`);
    console.log(`  Plugin workflow — marketplace templates (v${version})`);
    process.exit(0);
  }

  // ── git init + commit unique ──────────────────────────────────────────────
  git(['init', '-q'], { cwd: tmp });
  git(['add', '-A'], { cwd: tmp });
  git(
    ['-c', 'user.email=publier@local', '-c', 'user.name=publier', 'commit', '-q', '-m',
      `Plugin workflow — marketplace templates (v${version})`],
    { cwd: tmp },
  );
  const sha = git(['rev-parse', 'HEAD'], { cwd: tmp }).toString().trim();

  // ── Publication ────────────────────────────────────────────────────────────
  execFileSync('git', ['push', '--force', DEPOT_PUBLIC, 'HEAD:main'], { cwd: tmp, windowsHide: true, stdio: 'inherit' });

  // ── Vérification post-push ──────────────────────────────────────────────────
  const distant = git(['ls-remote', DEPOT_PUBLIC, 'main']).toString().trim();
  const shaDistant = distant.split(/\s+/)[0];

  if (shaDistant !== sha) {
    console.error(`publier: SHA distant (${shaDistant || '(vide)'}) ≠ SHA poussé (${sha}) — vérifier manuellement`);
    process.exit(1);
  }

  console.log(`publier: OK — v${version} · ${fichiers.length} fichiers · ${sha} confirmé sur ${DEPOT_PUBLIC}`);
} finally {
  // Nettoyage systématique, y compris en cas d'échec du push ou du garde-fou.
  if (tmp) rmSync(tmp, { recursive: true, force: true });
}
