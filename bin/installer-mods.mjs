#!/usr/bin/env node
// Installe (ou met à jour) les mods du workflow sur ce poste, `--scope local`, puis vérifie qu'ils
// sont `enabled` à la bonne version. Rejouable : tout ce qui est déjà en place n'est pas retouché.
//
// POURQUOI CE FICHIER EXISTE
// Claude Code ne charge un mod que depuis un plugin INSTALLÉ ; le dossier vendoré `.claude/workflow/`
// n'en est pas un. Pour que « rien ne s'installe à la main » (décision 2026-10-06-apres-p15), un
// geste unique et rejouable est appelé par `/maj-workflow`, `/migrer-projet` et `publier.mjs`. Décrit
// en prose dans trois skills, ce geste aurait divergé trois fois.
//
// USAGE
//   node installer-mods.mjs [--verifier] [--projet <dir>]     (défaut : le dossier courant)
//
//   --verifier   n'écrit rien et ne lance aucune commande d'écriture : 0 si tout est en place, 3 sinon.
//   --projet     racine du projet (défaut : dossier courant) — c'est elle qui porte le scope `local`.
//
// DEUX MODES, détectés depuis la racine
//   vendoré  `.claude/workflow/manifest.json` présent → mods dans `.claude/workflow/mods/`. Le script
//            y GÉNÈRE `.claude-plugin/marketplace.json` (ignoré par git, hors manifeste : il dépend du
//            poste), sous un nom unique par poste ET par dossier — `known_marketplaces.json` est
//            global et ne garde qu'un chemin par nom.
//   source   pas de manifeste, `plugin/.claude-plugin/plugin.json` présent → mods dans `plugin/mods/`,
//            marketplace `templates` (déjà déclarée sur ce poste, cf. CLAUDE.md).
//
// BINAIRE : `CLAUDE_CODE_EXECPATH` s'il est défini, sinon `claude` (le shim `claude` peut manquer sur
// un poste Desktop : docs/workflow/incidents/2026-10-06-shim-claude-introuvable.md). Il est imprimé.
//
// Sorties : 0 tout installé et vérifié · 1 usage / racine non reconnue · 3 installation ou
// vérification en échec (la commande à relancer est donnée) · 4 aucun binaire lançable (« sans CLI » :
// les skills le traitent comme un signal, pas comme une erreur).

import { claude as claudeCli, binaire } from './claude-cli.mjs';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';

// ── Arguments ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let verifier = false;
let racine = process.cwd();
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--verifier') verifier = true;
  else if (args[i] === '--projet' && args[i + 1]) racine = resolve(args[++i]);
  else {
    console.error(`installer-mods : argument inconnu ${args[i]} — usage : node installer-mods.mjs [--verifier] [--projet <dir>]`);
    process.exit(1);
  }
}

const WIN = process.platform === 'win32';
// Chemins comparés sans séparateur final, en slashes, casse ignorée sous Windows.
const norm = (p) => {
  const s = resolve(p).replace(/\\/g, '/').replace(/\/+$/, '');
  return WIN ? s.toLowerCase() : s;
};

// ── Mode et dossier des mods ─────────────────────────────────────────────────
let mode, dossierMods, marketplace, relance;
if (existsSync(join(racine, '.claude/workflow/manifest.json'))) {
  mode = 'vendoré';
  dossierMods = join(racine, '.claude/workflow/mods');
  const slug = basename(racine).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'projet';
  const h = createHash('sha256').update(norm(racine)).digest('hex').slice(0, 6);
  marketplace = `workflow-mods-${slug}-${h}`;
  relance = 'node .claude/workflow/bin/installer-mods.mjs';
} else if (existsSync(join(racine, 'plugin/.claude-plugin/plugin.json'))) {
  mode = 'source';
  dossierMods = join(racine, 'plugin/mods');
  marketplace = 'templates';
  relance = 'node plugin/bin/installer-mods.mjs';
} else {
  console.error(`installer-mods : racine non reconnue (${racine}) — ni .claude/workflow/manifest.json (projet vendoré) ni plugin/.claude-plugin/plugin.json (dépôt source). Lancer depuis la racine d'un projet.`);
  process.exit(1);
}

// Mods = sous-dossiers de `mods/` portant `.claude-plugin/plugin.json` (liste dynamique).
const mods = [];
if (existsSync(dossierMods)) {
  for (const e of readdirSync(dossierMods).sort()) {
    const pj = join(dossierMods, e, '.claude-plugin', 'plugin.json');
    if (!statSync(join(dossierMods, e)).isDirectory() || !existsSync(pj)) continue;
    let version;
    try { version = JSON.parse(readFileSync(pj, 'utf8')).version; } catch { /* illisible : traité ci-dessous */ }
    if (!version) {
      console.error(`installer-mods : ${pj} illisible ou sans version — rien installé.`);
      process.exit(1);
    }
    mods.push({ nom: e, version });
  }
}
if (mods.length === 0) {
  console.error(`installer-mods : aucun mod trouvé sous ${dossierMods} (mode ${mode}).`);
  process.exit(1);
}

// ── Binaire ──────────────────────────────────────────────────────────────────
// Le wrapper `claude()` est partagé (`./claude-cli.mjs`, P20/S4/T7) : même résolution du binaire
// (`CLAUDE_CODE_EXECPATH`, sinon `claude`), même passage par un shell sous Windows.
const claude = (a) => claudeCli(a, { cwd: racine });
const dernier = (e) => String(e.stderr || e.stdout || e.message).trim().split('\n').pop();

console.log(`installer-mods: mode ${mode} · marketplace ${marketplace} · binaire ${binaire}`);
try { claude(['--version']); }
catch (e) {
  console.error(`installer-mods: aucun binaire lançable (${binaire}) — ${dernier(e)}`);
  console.error('  Sans CLI : les mods ne sont pas installés. Relancer depuis un poste équipé, ou définir CLAUDE_CODE_EXECPATH.');
  process.exit(4);
}

function echec(raison) {
  console.error(`installer-mods: ${raison}`);
  console.error(`  → à relancer : ${relance}`);
  process.exit(3);
}

// ── État du poste ────────────────────────────────────────────────────────────
const config = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
function lireJson(nom) {
  try { return JSON.parse(readFileSync(join(config, 'plugins', nom), 'utf8')); } catch { return {}; }
}
const marketplaceEnPlace = () => lireJson('known_marketplaces.json')[marketplace];
const installe = (mod) => {
  const liste = lireJson('installed_plugins.json').plugins?.[`${mod}@${marketplace}`];
  return (Array.isArray(liste) ? liste : []).find((x) => x.scope === 'local' && x.projectPath && norm(x.projectPath) === norm(racine));
};

// ── Marketplace ──────────────────────────────────────────────────────────────
const cheminMarketplace = join(dossierMods, '.claude-plugin', 'marketplace.json');
let aEcrire = [];   // commandes d'écriture prévues, pour --verifier
if (mode === 'vendoré') {
  const attendu = JSON.stringify({
    name: marketplace,
    owner: { name: 'workflow' },
    description: 'Mods du workflow vendorés dans ce projet (générée par installer-mods.mjs, ne pas éditer).',
    plugins: mods.map((m) => ({ name: m.nom, source: `./${m.nom}` })),
  }, null, 2) + '\n';
  let actuel = null;
  try { actuel = readFileSync(cheminMarketplace, 'utf8').replace(/\r\n/g, '\n'); } catch { /* absent */ }
  if (actuel !== attendu) {
    if (verifier) aEcrire.push(`marketplace.json à (re)générer (${cheminMarketplace})`);
    else { mkdirSync(join(dossierMods, '.claude-plugin'), { recursive: true }); writeFileSync(cheminMarketplace, attendu); }
  }
}

const enPlace = marketplaceEnPlace();
const bonEmplacement = enPlace && norm(enPlace.installLocation ?? '') === norm(dossierMods);
if (mode === 'source') {
  if (!enPlace) echec('marketplace `templates` absente de ce poste — la déclarer : `claude plugin marketplace add ./plugin --scope local` puis `claude plugin install workflow@templates --scope local` (voir CLAUDE.md)');
} else if (!bonEmplacement) {
  if (verifier) aEcrire.push(enPlace ? `marketplace ${marketplace} pointe ailleurs (${enPlace.installLocation})` : `marketplace ${marketplace} absente`);
  else {
    try {
      if (enPlace) claude(['plugin', 'marketplace', 'remove', marketplace]);
      claude(['plugin', 'marketplace', 'add', dossierMods, '--scope', 'local']);
    } catch (e) { echec(`déclaration de la marketplace ${marketplace} en échec — ${dernier(e)}`); }
  }
}

// ── Plugins ──────────────────────────────────────────────────────────────────
// Relu APRÈS la marketplace : retirer une marketplace désinstalle ses plugins.
for (const m of mods) {
  const id = `${m.nom}@${marketplace}`;
  const x = installe(m.nom);
  if (x && x.version === m.version) continue;
  if (verifier) { aEcrire.push(x ? `${id} en ${x.version}, attendu ${m.version}` : `${id} non installé`); continue; }
  try { claude(['plugin', x ? 'update' : 'install', id, '--scope', 'local']); }
  catch (e) { echec(`\`plugin ${x ? 'update' : 'install'} ${id}\` en échec — ${dernier(e)}`); }
}
if (aEcrire.length > 0) echec(`--verifier : ${aEcrire.join(' ; ')}`);

// ── Vérification par `plugin list` ───────────────────────────────────────────
// Sortie MACHINE d'abord (P20/S10, point 22 de la revue externe) : `claude plugin list --json` (vérifié sur
// le binaire du poste, 2.1.296 — `claude plugin list --help` : « --json  Output as JSON ») rend un tableau
// d'objets `{ id, version, scope, enabled, projectPath }`. Un binaire plus ancien, sans cette option, rend du
// texte (ou échoue) : la lecture de la sortie HUMAINE ci-dessous reste le repli — format non garanti, d'où
// le JSON en premier.
function listeJson() {
  try {
    const j = JSON.parse(claude(['plugin', 'list', '--json']));
    return Array.isArray(j) ? j : null;
  } catch { return null; }
}
function etatDepuisJson(liste, id) {
  const x = liste.find((e) => e.id === id && (e.scope !== 'local' || (e.projectPath && norm(e.projectPath) === norm(racine))));
  return x ? { present: true, version: x.version, enabled: x.enabled === true } : { present: false };
}
function etatDepuisTexte(lignes, id) {
  const debut = lignes.findIndex((l) => l.includes(id));
  if (debut < 0) return { present: false };
  const fin = lignes.findIndex((l, i) => i > debut && l.includes('❯'));
  const bloc = lignes.slice(debut, fin < 0 ? undefined : fin).join('\n');
  return { present: true, version: bloc.match(/Version:\s*(\S+)/)?.[1], enabled: /\benabled\b/.test(bloc) };
}
let etatDe;
const json = listeJson();
if (json) etatDe = (id) => etatDepuisJson(json, id);
else {
  let liste;
  try { liste = claude(['plugin', 'list']); }
  catch (e) { echec(`\`plugin list\` en échec — ${dernier(e)}`); }
  const lignes = liste.split(/\r?\n/);
  etatDe = (id) => etatDepuisTexte(lignes, id);
}
for (const m of mods) {
  const id = `${m.nom}@${marketplace}`;
  const x = etatDe(id);
  if (!x.present) echec(`\`plugin list\` ne cite pas ${id}`);
  if (x.version !== m.version) echec(`\`plugin list\` rend ${id} en ${x.version ?? '(aucune version)'}, attendu ${m.version}`);
  if (!x.enabled) echec(`${id} n'est pas \`enabled\` dans \`plugin list\``);
  console.log(`installer-mods: ${id} ${m.version}, enabled${verifier ? ' (vérifié)' : ''} — redémarrer les sessions ouvertes pour le charger`);
}
process.exit(0);
