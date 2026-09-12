#!/usr/bin/env node
// Ramasse les incidents de workflow déposés par les projets (docs/workflow/incidents/*.md) et
// les présente en une table, pour être analysés depuis le dépôt source.
//
// POURQUOI CE FICHIER EXISTE
// Un incident de workflow (WORKFLOW.md §9b) est écrit là où il se produit — dans le projet, par la
// session qui l'a rencontré — parce que c'est le seul endroit où le contexte existe encore. Mais
// il ne sert que relu depuis ici, avec ceux des autres projets : un refus d'`Edit` en headless vu
// une fois est une anecdote, vu dans trois projets c'est un défaut du gabarit de settings. Les
// faire remonter à la main était laborieux, non systématique et imprécis : ce script remplace la
// main. Il ne fait que LIRE — jamais de pull, jamais d'écriture dans un projet.
//
// USAGE
//   node collecter-incidents.mjs [--projets <dossier parent>] [--depuis YYYY-MM-DD] [--fetch] [--json]
//
//   --projets   dossier dont chaque sous-dossier est un projet (défaut : le parent du dépôt source)
//   --depuis    n'affiche que les incidents datés à partir de ce jour (inclus)
//   --fetch     `git fetch` chaque projet (plafonné à 8 s) et signale ceux en retard sur leur amont :
//               un incident poussé depuis une autre machine n'est visible qu'après un pull
//   --json      sortie JSON (une entrée par incident) au lieu de la table
//
// Un incident non conforme au gabarit (en-tête manquant) est listé quand même, champs vides :
// l'analyse doit voir aussi les fichiers mal remplis — c'est un défaut du workflow à corriger.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const racineProjets = opt('--projets') ?? dirname(dirname(dirname(ICI))); // plugin/bin → plugin → Templates → parent
const depuis = opt('--depuis');
const fetch = args.includes('--fetch');
const json = args.includes('--json');

if (depuis && !/^\d{4}-\d{2}-\d{2}$/.test(depuis)) {
  console.error(`collecter-incidents: --depuis attend YYYY-MM-DD (reçu ${depuis})`);
  process.exit(2);
}
if (!existsSync(racineProjets)) {
  console.error(`collecter-incidents: dossier introuvable (${racineProjets})`);
  process.exit(2);
}

const CHAMPS = ['Projet', 'Workflow', 'Plan', 'Environnement', 'Étape', 'Nature'];

function git(cwd, ...a) {
  try {
    return execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true, timeout: 8000 }).trim();
  } catch { return null; }
}

function lireIncident(chemin, projet) {
  const txt = readFileSync(chemin, 'utf8').replace(/\r\n/g, '\n');
  const lignes = txt.split('\n');
  const titre = (lignes.find((l) => l.startsWith('# ')) ?? '').replace(/^#\s*/, '');
  const champs = {};
  for (const c of CHAMPS) {
    const l = lignes.find((x) => new RegExp(`^-\\s*${c}\\s*:`).test(x));
    champs[c] = l ? l.replace(/^-\s*[^:]+:\s*/, '').trim() : '';
  }
  const section = (nom) => {
    const i = lignes.findIndex((l) => l.trim() === `## ${nom}`);
    if (i < 0) return '';
    const fin = lignes.findIndex((l, k) => k > i && l.startsWith('## '));
    return lignes.slice(i + 1, fin < 0 ? undefined : fin).join('\n').trim();
  };
  const nom = basename(chemin);
  const date = /^(\d{4}-\d{2}-\d{2})/.exec(nom)?.[1] ?? '';
  return {
    date, projet, fichier: chemin, titre,
    workflow: champs.Workflow, plan: champs.Plan, environnement: champs.Environnement,
    etape: champs['Étape'], nature: champs.Nature,
    symptome: section('Symptôme'), preuve: section('Preuve'), surPlace: section('Sur place'),
    conforme: CHAMPS.every((c) => champs[c] !== '') && date !== '',
  };
}

const incidents = [];
const retards = [];
const projetsScrutes = [];

for (const nom of readdirSync(racineProjets)) {
  const projet = join(racineProjets, nom);
  let estDossier = false;
  try { estDossier = statSync(projet).isDirectory(); } catch { continue; }
  if (!estDossier || nom.startsWith('#') || nom === 'node_modules') continue;
  if (!existsSync(join(projet, '.git'))) continue;
  projetsScrutes.push(nom);

  if (fetch) {
    git(projet, 'fetch', '--quiet');
    const comptes = git(projet, 'rev-list', '--left-right', '--count', '@{upstream}...HEAD');
    if (comptes) {
      const [retard] = comptes.split(/\s+/).map(Number);
      if (retard > 0) retards.push({ projet: nom, retard });
    }
  }

  const dossier = join(projet, 'docs', 'workflow', 'incidents');
  if (!existsSync(dossier)) continue;
  for (const f of readdirSync(dossier)) {
    if (!f.endsWith('.md')) continue;
    const inc = lireIncident(join(dossier, f), nom);
    if (depuis && inc.date && inc.date < depuis) continue;
    incidents.push(inc);
  }
}

incidents.sort((a, b) => (a.date + a.projet).localeCompare(b.date + b.projet));

if (json) {
  process.stdout.write(JSON.stringify({ projets: projetsScrutes, retards, incidents }, null, 2) + '\n');
  process.exit(0);
}

console.log(`${projetsScrutes.length} projet(s) scruté(s) sous ${racineProjets}${depuis ? ` · depuis ${depuis}` : ''}`);
for (const r of retards) {
  console.log(`  RETARD   ${r.projet} : ${r.retard} commit(s) derrière son amont — des incidents poussés ailleurs peuvent manquer (git pull)`);
}
if (!fetch) console.log('  (sans --fetch : les projets en retard sur leur amont ne sont pas signalés)');

if (incidents.length === 0) {
  console.log('aucun incident');
  process.exit(0);
}

const compte = (cle) => {
  const m = new Map();
  for (const i of incidents) m.set(i[cle] || '(vide)', (m.get(i[cle] || '(vide)') ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ');
};

console.log(`\n${incidents.length} incident(s) — par nature : ${compte('nature')}`);
console.log(`par étape : ${compte('etape')}`);
console.log(`par version : ${compte('workflow')}\n`);

console.log('| Date | Projet | v | Nature | Étape | Titre | Fichier |');
console.log('| --- | --- | --- | --- | --- | --- | --- |');
for (const i of incidents) {
  const drapeau = i.conforme ? '' : ' ⚠ en-tête incomplet';
  console.log(`| ${i.date} | ${i.projet} | ${i.workflow} | ${i.nature} | ${i.etape} | ${i.titre}${drapeau} | ${i.fichier} |`);
}
