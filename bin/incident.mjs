#!/usr/bin/env node
// Écrit l'en-tête d'un incident de workflow (P21/S2/T6, décision du 2026-11-25, L12).
//
// POURQUOI CE FICHIER EXISTE
// 13 incidents sur 22 de la passe du 2026-11-25 avaient un en-tête incomplet (version du workflow, plan
// manquants) : la consigne de recopier le gabarit de `WORKFLOW.md` §9b ne suffit pas, et l'analyse
// inter-projets perd alors ce qui permet de rattacher l'incident à une version. Ce script remplit l'en-tête
// par lecture ; la session n'écrit que les trois sections.
//
// USAGE
//   node plugin/bin/incident.mjs <slug> [--plan P<n>[/S<k>[/T<m>]] | --plan —] [--environnement "<texte>"]
//                                       [--etape "<texte>"] [--nature environnement|exécution|prémisse|orchestration]
//   (projet vendoré : node .claude/workflow/bin/incident.mjs). À lancer depuis le projet (racine git).
//   Écrit `docs/workflow/incidents/YYYY-MM-DD-<slug>.md`, relatif à la racine git, et affiche son chemin.
//
// CE QU'IL REMPLIT
//   date du jour · projet = nom du dossier racine · version = `.claude/workflow/manifest.json` (projet
//   vendoré), sinon `plugin/.claude-plugin/plugin.json` (dépôt source) · plan · environnement · étape · nature.
//   Un champ non fourni ou illisible s'écrit `?` — jamais omis. `--plan —` dit « aucun plan » (incident hors plan).
//
// REFUS (code 2, rien d'écrit) : slug absent ou hors `[a-z0-9-]`, plan ou nature mal formés, hors dépôt git,
// fichier déjà présent (jamais d'écrasement — deux incidents du même jour portent deux slugs).

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const NATURES = ['environnement', 'exécution', 'prémisse', 'orchestration'];
const INCONNU = '?';

function refuser(motif) {
  console.error(`incident: ${motif}`);
  process.exit(2);
}

const args = process.argv.slice(2);
const OPTIONS = ['--plan', '--environnement', '--etape', '--nature'];
const valeurs = {};
const libres = [];
for (let i = 0; i < args.length; i++) {
  if (OPTIONS.includes(args[i])) {
    const v = args[i + 1];
    if (v === undefined || (v.startsWith('--') && OPTIONS.includes(v))) refuser(`${args[i]} attend une valeur`);
    valeurs[args[i]] = v;
    i++;
  } else if (args[i].startsWith('--')) {
    refuser(`option inconnue ${args[i]}`);
  } else {
    libres.push(args[i]);
  }
}

const slug = libres[0];
if (!slug || libres.length > 1) refuser('usage : incident.mjs <slug> [--plan P<n>/S<k>[/T<m>]] [--environnement …]');
if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) refuser(`slug "${slug}" invalide (minuscules, chiffres et tirets)`);

let plan = INCONNU;
if (valeurs['--plan'] !== undefined) {
  const p = valeurs['--plan'];
  if (['—', '-', 'aucun'].includes(p)) plan = '—';
  else if (/^P\d+(\/S\d+(\/T\d+)?)?$/.test(p)) plan = p;
  else refuser(`--plan attend P<n>[/S<k>[/T<m>]] ou —, reçu "${p}"`);
}
let nature = INCONNU;
if (valeurs['--nature'] !== undefined) {
  if (!NATURES.includes(valeurs['--nature'])) refuser(`--nature attend ${NATURES.join('|')}, reçu "${valeurs['--nature']}"`);
  nature = valeurs['--nature'];
}
const champ = (v) => (v === undefined || v.trim() === '' ? INCONNU : v.replace(/\s+/g, ' ').trim());
const environnement = champ(valeurs['--environnement']);
const etape = champ(valeurs['--etape']);

let racine;
try {
  racine = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
} catch {
  refuser('pas un dépôt git (lancer depuis la racine du projet)');
}

/** Version du workflow : manifeste vendoré d'abord, sinon manifeste du plugin (dépôt source) ; `?` si aucun n'est lisible. */
function versionWorkflow() {
  for (const [rel, origine] of [['.claude/workflow/manifest.json', 'manifest.json'], ['plugin/.claude-plugin/plugin.json', 'plugin.json']]) {
    try {
      const v = JSON.parse(readFileSync(join(racine, rel), 'utf8')).version;
      if (typeof v === 'string' && v.trim()) return `v${v.trim().replace(/^v/, '')} (${origine})`;
    } catch { /* absent ou illisible : source suivante */ }
  }
  return INCONNU;
}

const d = new Date();
const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const relatif = `docs/workflow/incidents/${date}-${slug}.md`;
const chemin = join(racine, relatif);
if (existsSync(chemin)) refuser(`${relatif} existe déjà — un incident n'est jamais écrasé (autre slug, ou le compléter à la main)`);

const texte = [
  `# Incident workflow — ${date} — ${slug.replace(/-/g, ' ')}`,
  '',
  `- Projet : ${basename(racine)} · Workflow : ${versionWorkflow()} · Plan : ${plan}`,
  `- Environnement : ${environnement}`,
  `- Étape : ${etape} · Nature : ${nature}`,
  '',
  '## Symptôme',
  '',
  '## Preuve',
  '',
  '## Sur place',
  '',
].join('\n');

mkdirSync(join(racine, 'docs', 'workflow', 'incidents'), { recursive: true });
writeFileSync(chemin, texte, { flag: 'wx' });
console.log(relatif);
process.exit(0);
