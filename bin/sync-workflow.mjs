#!/usr/bin/env node
// Moteur de vendoring du workflow — copie le payload dans un projet, et le tient à jour.
//
// POURQUOI CE FICHIER EXISTE
// Le workflow a d'abord été distribué comme plugin installé à l'exécution (marketplace +
// `claude plugin install`). Ce modèle demandait, sur CHAQUE machine et CHAQUE environnement, une
// installation qui pouvait échouer de six façons différentes — CLI absent du PATH, marketplace
// jamais clonée en session distante, bit exécutable perdu, timeout de hook… Aucune de ces pannes
// ne venait du contenu du workflow ; toutes venaient de la machinerie d'installation.
//
// Les fichiers vendorés dans le repo n'ont besoin ni de CLI, ni de réseau, ni de marketplace :
// la seule chose qu'un environnement Claude Code garantisse, c'est le clone du repo. D'où ce
// moteur — et le manifeste, qui est ce qui distingue « vendoré » de « copié-collé une fois ».
//
// USAGE
//   node sync-workflow.mjs --source <payload> --projet <dir> [--check] [--force]
//
//   --check          n'écrit rien ; rapporte l'état et sort en 1 si une action est due
//   --force          réécrit même les fichiers modifiés localement (sinon ils sont préservés)
//   --ignorer-cache  passe outre un cache plugin périmé (voir controlerCachePlugin)
//
// Le manifeste (.claude/workflow/manifest.json) porte un hash par fichier géré. Il permet de
// distinguer les deux dérives, qui n'appellent pas la même réponse :
//   - fichier modifié à la main dans le projet  → la modification doit remonter à la source
//   - version de la source plus récente         → une synchronisation est due

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, relative, sep } from 'node:path';
import { homedir } from 'node:os';

// ── Plan de vendoring ────────────────────────────────────────────────────────
// Les skills et agents vont là où Claude Code les découvre nativement
// (.claude/skills, .claude/agents) ; le reste sous .claude/workflow/, qui devient
// la racine du payload — celle que les substitutions ci-dessous visent.
const PLAN = [
  { de: 'skills',           vers: '.claude/skills',            recursif: true },
  { de: 'agents',           vers: '.claude/agents',            recursif: true },
  // Les styles d'output vont eux aussi là où Claude Code les découvre (.claude/output-styles) —
  // pas sous .claude/workflow/, qui n'est scruté par rien. Le style n'est actif que si
  // settings.json le sélectionne : vendoré sans être choisi, un style ne coûte rien.
  { de: 'output-styles',    vers: '.claude/output-styles',     recursif: true },
  { de: 'hooks',            vers: '.claude/workflow/hooks',    recursif: true, sauf: ['hooks.json'] },
  { de: 'templates',        vers: '.claude/workflow/templates', recursif: true },
  { de: 'CLAUDE-BASE.md',   vers: '.claude/workflow/CLAUDE-BASE.md' },
  { de: 'EXECUTANT.md',     vers: '.claude/workflow/EXECUTANT.md' },
  { de: 'WORKFLOW.md',      vers: '.claude/workflow/WORKFLOW.md' },
  { de: 'CONVENTIONS.md',   vers: '.claude/workflow/CONVENTIONS.md' },
  { de: 'MIGRATION.md',     vers: '.claude/workflow/MIGRATION.md' },
  // publier.mjs exclu : il pousse vers LE dépôt public de distribution (URL en dur), un geste qui
  // n'a de sens que dans le dépôt source. Le vendorer laisserait un utilisateur en aval avec un
  // script qui republierait — sans les droits, et sans que rien ne l'explique — le dépôt de
  // quelqu'un d'autre.
  // collecter-incidents.mjs exclu pour la même raison : il balaie les projets voisins du dépôt
  // source pour y ramasser leurs `docs/workflow/incidents/` — un geste de mainteneur, sans objet
  // dans un projet équipé.
  { de: 'bin',              vers: '.claude/workflow/bin',      recursif: true, sauf: ['publier.mjs', 'collecter-incidents.mjs'] },
  // Les mods (mini-plugins) se vendorent TELS QUELS : `brut` = aucune substitution du marqueur de
  // plugin — leurs fichiers (`hooks/hooks.json` compris, c'est le module du mod) ne vivent pas sous
  // un plugin `workflow`, et un `.ts` ou `.json` réécrit changerait ce que le mod exécute. Pas de
  // `sauf: ['hooks.json']` non plus. `installer-mods.mjs` y génère, par poste,
  // `.claude-plugin/marketplace.json` : absent de la source donc du manifeste, jamais retiré comme
  // obsolète ; `mods/.gitignore` (vendoré avec) l'ignore par git.
  { de: 'mods',             vers: '.claude/workflow/mods',     recursif: true, brut: true },
];

// `hooks.json` est exclu : en mode vendoré le câblage vit dans .claude/settings.json du projet.
// Le laisser créerait deux déclarations concurrentes des mêmes hooks.

// ── Substitutions ────────────────────────────────────────────────────────────
// Le marqueur n'existe que si un plugin est installé. Vendoré, il faut des chemins relatifs à la
// racine du projet. Ordre significatif : les deux règles spécifiques d'abord, le fourre-tout après.
//
// LE MARQUEUR EST CONSTRUIT PAR CONCATÉNATION, JAMAIS ÉCRIT EN CLAIR — et ce n'est pas une
// coquetterie. Ce fichier fait partie du payload : il se vendore lui-même. Écrit en clair, le
// marqueur de la table serait substitué dans la copie vendorée, qui héritait alors d'une table
// neutralisée (`['.claude/skills/', '.claude/skills/']`) et ne substituait plus rien. Constaté en
// pilotant MYO : 12 faux écarts, et toute synchronisation lancée depuis un projet aurait produit
// des fichiers aux chemins non résolus.
const MARQUEUR = '$' + '{CLAUDE_PLUGIN_ROOT}';
const SUBSTITUTIONS = [
  [`${MARQUEUR}/skills/`, '.claude/skills/'],
  [`${MARQUEUR}/agents/`, '.claude/agents/'],
  [`${MARQUEUR}/`,        '.claude/workflow/'],
  [MARQUEUR,              '.claude/workflow'],
];

// Binaire = extension connue OU octet NUL dans les 8 premiers Ko (rattrape le reste).
const BINAIRES = /\.(png|jpg|jpeg|gif|ico|woff2?|zip|pdf|webp|avif|bmp|tiff?|ttf|otf|eot|mp3|mp4|webm|wav|ogg|gz|tar|7z|wasm)$/i;
function estBinaire(chemin, buf) {
  return BINAIRES.test(chemin) || buf.subarray(0, 8192).includes(0);
}

function normaliser(txt) {
  // CRLF → LF avant hash ET avant écriture : sans ça, le même contenu donne deux hashes selon
  // la plateforme, et toute dérive devient indétectable sous Windows.
  return txt.replace(/\r\n/g, '\n');
}

function substituer(txt) {
  let out = txt;
  for (const [de, vers] of SUBSTITUTIONS) out = out.split(de).join(vers);
  return out;
}

function hash(contenu) {
  return createHash('sha256').update(contenu).digest('hex').slice(0, 16);
}

// Hash d'un fichier du projet, comme le hash enregistré : binaire tel quel, texte normalisé.
function hashDisque(chemin, binaire) {
  return hash(binaire ? readFileSync(chemin) : Buffer.from(normaliser(readFileSync(chemin, 'utf8')), 'utf8'));
}

function fichiersDe(racine, sousChemin, sauf = []) {
  const abs = join(racine, sousChemin);
  if (!existsSync(abs)) return [];
  if (statSync(abs).isFile()) return [sousChemin];
  const out = [];
  for (const e of readdirSync(abs)) {
    if (sauf.includes(e)) continue;
    const p = join(sousChemin, e);
    if (statSync(join(racine, p)).isDirectory()) out.push(...fichiersDe(racine, p, sauf));
    else out.push(p);
  }
  return out;
}

function poser(chemin) {
  mkdirSync(dirname(chemin), { recursive: true });
}

// ── Construction du plan effectif ────────────────────────────────────────────
function construirePlan(source) {
  const paires = [];
  for (const regle of PLAN) {
    const src = join(source, regle.de);
    if (!existsSync(src)) continue;
    if (statSync(src).isFile()) {
      paires.push({ src: regle.de, dst: regle.vers });
    } else {
      for (const f of fichiersDe(source, regle.de, regle.sauf ?? [])) {
        const suffixe = relative(regle.de, f).split(sep).join('/');
        paires.push({ src: f, dst: `${regle.vers}/${suffixe}`, brut: !!regle.brut });
      }
    }
  }
  return paires;
}

// ── Contrôle de dérive du bloc hooks de settings.json ───────────────────────
// settings.json n'est PAS géré par le manifeste ci-dessus (permissions et effortLevel
// appartiennent au projet, jamais réécrits) — mais son bloc `hooks` doit rester aligné sur
// templates/project-settings.json du payload. Quatre contrôles, tous informatifs :
//  1. hooks : le bloc doit rester identique à celui du gabarit ;
//  2. outputStyle : la clé doit exister si le gabarit en propose un ;
//  3. permissions.allow : doit contenir le socle du gabarit (entrées hors `Bash(npm ` / `Bash(npx `,
//     exemple de stack JavaScript) — seules les entrées manquantes sont signalées, les ajouts
//     propres au projet ne sont jamais comparés ;
//  4. modelSettings : les clés du gabarit doivent toutes exister — présence seule, jamais les valeurs.
// Une évolution des hooks a déjà demandé une édition manuelle dans 6 projets ; un oubli laisse des
// hooks silencieusement absents. Ce contrôle est purement informatif : jamais bloquant, jamais
// d'écriture.
function normaliserHooks(objet) {
  // Tri récursif des clés pour que la comparaison JSON.stringify ignore l'ordre.
  if (Array.isArray(objet)) return objet.map(normaliserHooks);
  if (objet && typeof objet === 'object') {
    const trie = {};
    for (const cle of Object.keys(objet).sort()) trie[cle] = normaliserHooks(objet[cle]);
    return trie;
  }
  return objet;
}

function controlerDeriveSettings(source, projet) {
  const cheminProjet = join(projet, '.claude/settings.json');
  const cheminSource = join(source, 'templates/project-settings.json');

  if (!existsSync(cheminProjet)) {
    return '  SETTINGS  .claude/settings.json absent — copier depuis .claude/workflow/templates/project-settings.json';
  }
  if (!existsSync(cheminSource)) return null; // rien à comparer côté source

  let settingsProjet, settingsSource;
  try { settingsProjet = JSON.parse(readFileSync(cheminProjet, 'utf8')); }
  catch { return '  SETTINGS  .claude/settings.json illisible (JSON invalide) — vérifier le fichier'; }
  try { settingsSource = JSON.parse(readFileSync(cheminSource, 'utf8')); }
  catch { return '  SETTINGS  templates/project-settings.json illisible (JSON invalide) côté source — vérifier le payload'; }

  const lignes = [];

  const a = JSON.stringify(normaliserHooks(settingsProjet.hooks ?? {}));
  const b = JSON.stringify(normaliserHooks(settingsSource.hooks ?? {}));
  if (a !== b) {
    lignes.push('  SETTINGS  bloc hooks divergent du template — comparer .claude/settings.json à .claude/workflow/templates/project-settings.json');
  }

  // `outputStyle` : le template en propose un, dont le fichier est vendoré sous
  // .claude/output-styles/. Sans la clé, le style vendoré est présent mais jamais sélectionné —
  // une panne silencieuse de plus, du même genre que les hooks absents. Un projet qui a choisi
  // un AUTRE style n'est pas signalé : c'est un choix, pas une dérive.
  const styleSource = settingsSource.outputStyle;
  if (styleSource && !settingsProjet.outputStyle) {
    lignes.push(`  SETTINGS  outputStyle absent — le template propose "${styleSource}" (fichier vendoré dans .claude/output-styles/) ; ajouter la clé, ou s'en passer sciemment`);
  }

  // `permissions.allow` en retard : socle = allow du gabarit lu, hors exemple JavaScript. Une
  // entrée ajoutée plus tard au gabarit est donc contrôlée sans toucher à ce script.
  const socle = (settingsSource.permissions?.allow ?? [])
    .filter((e) => !e.startsWith('Bash(npm ') && !e.startsWith('Bash(npx '));
  const allowProjet = Array.isArray(settingsProjet.permissions?.allow) ? settingsProjet.permissions.allow : [];
  const manquants = socle.filter((e) => !allowProjet.includes(e));
  if (manquants.length > 0) {
    lignes.push(`  SETTINGS  allow en retard sur le gabarit — manque : ${manquants.join(', ')}`);
  }

  // `modelSettings` : sans la clé d'un modèle, ce modèle tourne à l'`effortLevel` racine (Opus compris).
  // Présence des clés seule : un projet qui règle un modèle autrement, exprès, n'est pas signalé.
  const clesModele = Object.keys(settingsSource.modelSettings ?? {});
  const modelesProjet = settingsProjet.modelSettings && typeof settingsProjet.modelSettings === 'object'
    ? settingsProjet.modelSettings : {};
  const clesManquantes = clesModele.filter((k) => !(k in modelesProjet));
  if (clesManquantes.length > 0) {
    lignes.push(`  SETTINGS  modelSettings en retard sur le gabarit — manque : ${clesManquantes.join(', ')}`);
  }

  return lignes.length > 0 ? lignes.join('\n') : null;
}

// ── Contrôle du cache plugin ────────────────────────────────────────────────
// Un cache de plugin périmé est INVISIBLE et pourtant prioritaire : Claude Code charge les skills
// qu'il y trouve, sans que rien ne le signale — `installed_plugins.json` peut être vide, le cache
// est servi quand même. Une session lit alors un texte de skill vieux de plusieurs versions tout
// en travaillant sur un payload à jour, et suit des consignes qui n'ont plus cours.
//
// Constaté le 2026-08-28 : une instanciation pilotée par `/nouveau-projet` en 0.10.0 (cache) sur un
// payload 0.17.1 — la skill lue dictait de copier le `AGENTS.md` du plugin à la racine et ignorait
// l'étape de vendoring. Le projet a été sauvé par le jugement de la session, pas par le workflow.
//
// Ce moteur est le seul programme qui tourne à CHAQUE instanciation et à chaque mise à jour : c'est
// donc ici que l'écart doit se voir. Bloquant (sortie 3), parce qu'un simple avertissement dans un
// flot de sortie est exactement ce qui n'a pas été lu la première fois ; `--ignorer-cache` laisse
// la porte ouverte au cas légitime (payload plus récent que le cache, qu'on ne veut pas toucher).
//
// Seule la version la PLUS RÉCENTE de chaque marketplace compte : `claude plugin update` pose la
// nouvelle version à côté des anciennes sans les retirer, et ces restes ne sont plus servis.
// Les compter bloquait tout vendoring sur le poste du dépôt source dès la deuxième mise à jour
// (docs/workflow/incidents/2026-09-29-cache-plugin-anciennes-versions.md). Le cas du 2026-08-28
// reste bloqué : là, c'est la version la plus récente elle-même qui était en retard.
function comparerVersions(a, b) {
  const pa = String(a).split(/[.-]/);
  const pb = String(b).split(/[.-]/);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? '0';
    const y = pb[i] ?? '0';
    // Numérique quand les deux le sont (0.10.0 > 0.9.0, que l'ordre alphabétique inverserait).
    const d = /^\d+$/.test(x) && /^\d+$/.test(y) ? Number(x) - Number(y) : x.localeCompare(y);
    if (d !== 0) return d;
  }
  return 0;
}

function cachesPlugin() {
  const base = join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'plugins', 'cache');
  if (!existsSync(base)) return [];
  const out = [];
  for (const marketplace of readdirSync(base)) {
    const dossier = join(base, marketplace, 'workflow');
    if (!existsSync(dossier) || !statSync(dossier).isDirectory()) continue;
    let plusRecent = null;
    for (const v of readdirSync(dossier)) {
      const chemin = join(dossier, v);
      if (!statSync(chemin).isDirectory()) continue;
      // La version fait foi dans plugin.json, pas dans le nom du dossier : un cache renommé à la
      // main mentirait sinon sur ce qui est réellement chargé.
      let version = v;
      try { version = JSON.parse(readFileSync(join(chemin, '.claude-plugin', 'plugin.json'), 'utf8')).version ?? v; }
      catch { /* dossier incomplet : le nom reste la meilleure information disponible */ }
      if (!plusRecent || comparerVersions(version, plusRecent.version) > 0) plusRecent = { chemin, version };
    }
    if (plusRecent) out.push(plusRecent);
  }
  return out;
}

// ── Programme ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const source = opt('--source');
const projet = opt('--projet') ?? process.cwd();
const check = args.includes('--check');
const force = args.includes('--force');
const ignorerCache = args.includes('--ignorer-cache');

if (!source || !existsSync(source)) {
  console.error(`sync-workflow: --source manquant ou introuvable (${source})`);
  process.exit(2);
}

const versionSource = (() => {
  const p = join(source, '.claude-plugin', 'plugin.json');
  try { return JSON.parse(readFileSync(p, 'utf8')).version; } catch { return 'inconnue'; }
})();

const cheminManifeste = join(projet, '.claude/workflow/manifest.json');
let ancien = { version: null, fichiers: {} };
if (existsSync(cheminManifeste)) {
  try { ancien = JSON.parse(readFileSync(cheminManifeste, 'utf8')); }
  catch (e) {
    // Jamais traité comme un manifeste vide : toute dérive locale serait alors écrasée en silence.
    console.error(`sync-workflow: ${cheminManifeste} illisible (${e.message}) — rien écrit. Le restaurer depuis git, ou relancer avec --force en sachant que toute dérive locale sera écrasée.`);
    if (!force) process.exit(2);
    ancien = { version: null, fichiers: {} };
  }
}

const paires = construirePlan(source);
const nouveauxHashes = {};
const aEcrire = [];
const derives = [];
let inchanges = 0;

for (const { src, dst, brut: sansSubstitution } of paires) {
  const brut = readFileSync(join(source, src));
  const binaire = estBinaire(src, brut);
  const contenu = binaire ? brut
    : Buffer.from(sansSubstitution ? normaliser(brut.toString('utf8')) : substituer(normaliser(brut.toString('utf8'))), 'utf8');
  const h = hash(contenu);
  nouveauxHashes[dst] = h;

  const cible = join(projet, dst);
  const existe = existsSync(cible);
  const hActuel = existe ? hashDisque(cible, binaire) : null;

  if (hActuel === h) { inchanges++; continue; }

  // Le fichier diffère. Est-ce une dérive locale (il ne correspond plus au hash qu'on lui
  // connaissait) ou simplement une source plus récente ?
  const hConnu = ancien.fichiers?.[dst] ?? null;
  const modifieLocalement = existe && hConnu !== null && hActuel !== hConnu;
  if (modifieLocalement && !force) { derives.push(dst); nouveauxHashes[dst] = hConnu; continue; }

  aEcrire.push({ cible, contenu, dst, nouveau: !existe });
}

// Fichiers gérés autrefois, disparus du payload : à retirer du projet.
// Un obsolète modifié localement est gardé et signalé DÉRIVE (sauf --force), avec son hash connu.
const obsoletes = [];
for (const f of Object.keys(ancien.fichiers ?? {})) {
  if (f in nouveauxHashes) continue;
  const p = join(projet, f);
  if (!force && existsSync(p) && hashDisque(p, estBinaire(f, readFileSync(p))) !== ancien.fichiers[f]) {
    derives.push(f);
    nouveauxHashes[f] = ancien.fichiers[f];
  } else obsoletes.push(f);
}

// ── Rapport ──────────────────────────────────────────────────────────────────
const enRetard = ancien.version !== versionSource;
console.log(`source ${versionSource}  ·  projet ${ancien.version ?? '(non vendoré)'}`);
console.log(`${paires.length} fichiers gérés · ${inchanges} à jour · ${aEcrire.length} à écrire · ${derives.length} modifiés localement · ${obsoletes.length} obsolètes`);
for (const d of derives) console.log(`  DÉRIVE   ${d}  (modifié à la main — --force pour écraser)`);
for (const o of obsoletes) console.log(`  OBSOLÈTE ${o}`);
// Dire CE QUI va être écrit, pas seulement combien : un décompte seul rend toute anomalie
// (idempotence rompue, substitution instable) impossible à diagnostiquer sans réinstrumenter.
for (const e of aEcrire) console.log(`  ${e.nouveau ? 'NOUVEAU ' : 'MAJ     '} ${e.dst}`);

const deriveSettings = controlerDeriveSettings(source, projet);
if (deriveSettings) console.log(deriveSettings);

const cachesPerimes = cachesPlugin().filter((c) => c.version !== versionSource);
for (const c of cachesPerimes) {
  console.log(`  CACHE    plugin workflow ${c.version} en cache alors que la source est en ${versionSource}`);
  console.log(`           ${c.chemin}`);
  console.log('           Claude Code sert les skills de ce cache : la session en cours peut suivre un texte périmé.');
  console.log(`           Supprimer ce dossier, ou le remplacer par une copie de la source en ${versionSource}, puis relancer.`);
}

if (check) {
  // Le cache plugin ne compte PAS dans `action` : `--check` répond « ce projet vendoré est-il à
  // jour ? », une question qui ne dépend pas de ce qui traîne sur le poste. La ligne CACHE
  // ci-dessus suffit à le signaler.
  const action = aEcrire.length > 0 || obsoletes.length > 0 || derives.length > 0 || enRetard;
  console.log(action ? 'ÉTAT: action due' : 'ÉTAT: à jour');
  process.exit(action ? 1 : 0);
}

if (cachesPerimes.length > 0 && !ignorerCache) {
  console.error('sync-workflow: cache plugin périmé (voir CACHE ci-dessus) — rien écrit. --ignorer-cache pour passer outre.');
  process.exit(3);
}

// ── Écriture ─────────────────────────────────────────────────────────────────
for (const { cible, contenu } of aEcrire) { poser(cible); writeFileSync(cible, contenu); }
for (const o of obsoletes) { const p = join(projet, o); if (existsSync(p)) rmSync(p); }

// Les dérives gardent leur hash CONNU (posé plus haut), pas celui du disque : /maj-workflow
// n'offre que Remonter ou Écraser, donc la dérive doit revenir à chaque passage tant qu'elle n'est
// pas tranchée. Enregistrer le hash du disque la ferait passer pour saine au passage suivant.

poser(cheminManifeste);
writeFileSync(cheminManifeste, JSON.stringify({
  _comment: 'Généré par .claude/workflow/bin/sync-workflow.mjs — ne pas éditer à la main. Un fichier listé ici est GÉRÉ : toute amélioration remonte au repo source, puis redescend par /maj-workflow.',
  version: versionSource,
  source: 'kovuthecat/claude-workflow',
  fichiers: nouveauxHashes,
}, null, 2) + '\n');

console.log(`écrit: ${aEcrire.length} · supprimé: ${obsoletes.length} · manifeste v${versionSource}`);
