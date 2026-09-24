#!/usr/bin/env node
// N0 (build/typecheck/tests) exécuté par script, pas par sous-agent — contrat C1
// (docs/decisions/2026-09-17-autonomie-par-defaut-etat-scripte-push-par-session.md).
//
// POURQUOI CE FICHIER EXISTE
// Un sous-agent chargé de N0 ferait un travail entièrement déterministe : lancer des commandes
// documentées, filtrer leur sortie à quelques lignes. Il y ajouterait un démarrage à froid et une
// frontière de tour où un verdict peut se perdre — la classe d'incidents que ce script retire (plus
// aucun agent dédié à N0 depuis ce contrat). Il ne devine jamais une commande : sans
// `.claude/n0.json`, il s'arrête et dit quoi écrire.
//
// USAGE
//   node .claude/workflow/bin/n0.mjs [--seulement <nom>] [--cible <fichier>]   (projet vendoré)
//   node plugin/bin/n0.mjs [--seulement <nom>] [--cible <fichier>]             (ce dépôt, source)
//
//   --seulement <nom>   n'exécute que la commande de ce nom dans .claude/n0.json
//   --cible <fichier>   exécute uniquement `testCible`, avec {fichier} remplacé par ce chemin
//
// ENTRÉE — `.claude/n0.json` du projet courant (jamais deviné) :
//   { "commandes": [{ "nom": "build", "cmd": "…", "delaiMs": <optionnel> }, …],
//     "testCible": "<commande avec {fichier}>", "delaiMs": <optionnel, défaut de toutes> }
//
// SORTIE, et rien d'autre : une ligne `nom → PASS|FAIL (durée)` par commande ; si FAIL, au plus
// 5 lignes `fichier:ligne — message` (ou le texte extrait, au mieux) ; chemin du log complet
// (`.claude/n0/dernier.log`, ignoré par git — toutes les commandes y sont journalisées, vertes
// comprises, dans l'ordre). Code 0 si tout est vert, 1 si au moins une commande est rouge, 2 en cas
// de configuration absente ou invalide.
//
// Exécution SÉQUENTIELLE et NON anticipée : toutes les commandes tournent même si l'une échoue —
// un rapport d'un seul appel doit être complet, jamais partiel parce que la deuxième commande n'a
// jamais tourné.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const RACINE = process.cwd();
const MESSAGE_CONFIG_ABSENTE =
  'déclarer les commandes dans .claude/n0.json (les reprendre de CLAUDE.md § Commandes)';
const DELAI_DEFAUT_MS = 10 * 60 * 1000;

const args = process.argv.slice(2);
const opt = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : null;
};
const seulement = opt('--seulement');
const cible = opt('--cible');

function erreurConfig(motif = MESSAGE_CONFIG_ABSENTE) {
  console.error(`n0: ${motif}`);
  process.exit(2);
}

const cheminConfig = join(RACINE, '.claude', 'n0.json');
if (!existsSync(cheminConfig)) erreurConfig();

let config;
try {
  config = JSON.parse(readFileSync(cheminConfig, 'utf8'));
} catch {
  erreurConfig();
}
if (!config || !Array.isArray(config.commandes) || config.commandes.length === 0) {
  erreurConfig();
}
for (const c of config.commandes) {
  if (!c || typeof c.nom !== 'string' || typeof c.cmd !== 'string') erreurConfig();
}

let aLancer;
if (cible !== null) {
  if (typeof config.testCible !== 'string') {
    erreurConfig('--cible demande "testCible" dans .claude/n0.json');
  }
  aLancer = [{ nom: 'testCible', cmd: config.testCible.replaceAll('{fichier}', cible) }];
} else if (seulement !== null) {
  aLancer = config.commandes.filter((c) => c.nom === seulement);
  if (aLancer.length === 0) {
    erreurConfig(`commande inconnue « ${seulement} » (voir .claude/n0.json)`);
  }
} else {
  aLancer = config.commandes;
}

const delaiParDefaut = Number.isFinite(config.delaiMs) ? config.delaiMs : DELAI_DEFAUT_MS;

// Motifs d'extraction, essayés dans cet ordre ; le premier qui trouve quelque chose gagne — pas de
// fusion entre motifs, pour ne jamais mélanger une ligne `tsc` avec une ligne `FAIL` sans rapport.
const MOTIFS = [
  /^.+\(\d+,\d+\):\s*error.*$/gm, // tsc : fichier(l,c): error …
  /^\s*\S[^\n]*?:\d+:\d+\b.*$/gm, // fichier:l:c … (générique)
  /^.*(?:FAIL|✗).*$/gm, // vitest/jest
  /^\s*\d+:\d+\s+(?:error|warning)\s+.*$/gm, // ESLint (stylish, sans le nom de fichier)
];

function extraireErreurs(texte) {
  for (const motif of MOTIFS) {
    motif.lastIndex = 0;
    const trouvees = texte.match(motif);
    if (trouvees && trouvees.length > 0) {
      return trouvees.slice(0, 5).map((l) => l.trim());
    }
  }
  // Repli : les 5 dernières lignes non vides — aucun motif connu n'a mordu.
  const nonVides = texte
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  return nonVides.slice(-5);
}

function executer(cmd, delaiMs) {
  const debut = Date.now();
  try {
    const sortie = execSync(`${cmd} 2>&1`, {
      cwd: RACINE,
      encoding: 'utf8',
      timeout: delaiMs,
      windowsHide: true,
      maxBuffer: 50 * 1024 * 1024,
    });
    return { ok: true, sortie: sortie ?? '', timeout: false, duree: Date.now() - debut };
  } catch (e) {
    const sortie = (e.stdout ?? '') + (e.stderr ?? '');
    // `execSync` sous délai dépassé : le process est tué (signal posé), jamais de code de sortie.
    const timeout = e.status === null && Boolean(e.signal);
    return { ok: false, sortie, timeout, duree: Date.now() - debut };
  }
}

const dossierLog = join(RACINE, '.claude', 'n0');
mkdirSync(dossierLog, { recursive: true });
const cheminLog = join(dossierLog, 'dernier.log');

const resultats = [];
let logComplet = '';
for (const c of aLancer) {
  const delaiMs = Number.isFinite(c.delaiMs) ? c.delaiMs : delaiParDefaut;
  const r = executer(c.cmd, delaiMs);
  resultats.push({ nom: c.nom, ...r });
  logComplet += `### ${c.nom} — ${c.cmd}\n${r.sortie}\n\n`;
}
writeFileSync(cheminLog, logComplet, 'utf8');

let codeFinal = 0;
let texte = '';
for (const r of resultats) {
  const duree = `${(r.duree / 1000).toFixed(1)}s`;
  if (r.ok) {
    texte += `${r.nom} → PASS (${duree})\n`;
    continue;
  }
  codeFinal = 1;
  texte += `${r.nom} → FAIL${r.timeout ? ' (délai)' : ''} (${duree})\n`;
  if (!r.timeout) {
    for (const ligne of extraireErreurs(r.sortie)) texte += `  ${ligne}\n`;
  }
  texte += `  log : ${cheminLog}\n`;
}

process.stdout.write(texte);
process.exit(codeFinal);
