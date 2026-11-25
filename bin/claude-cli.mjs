// Lancer le binaire `claude` — UNE seule fonction pour `installer-mods.mjs`, `publier.mjs` et
// `tests/tester-mods.mjs` (P20/S4/T7, point 11 de la revue externe du 2026-10-13).
//
// POURQUOI CE FICHIER EXISTE
// Trois copies du même wrapper vivaient dans trois fichiers ; la prochaine retouche d'un seul côté
// les aurait fait diverger (le backlog de P16 le notait). Vendoré avec `installer-mods.mjs`
// (`sync-workflow.mjs` : `bin/` est vendoré en entier, seuls `publier.mjs` et `collecter-incidents.mjs`
// sont exclus) — `publier.mjs` ne l'est pas, mais ce module, lui, doit l'être.
//
// RÉSOLUTION DU BINAIRE : `CLAUDE_CODE_EXECPATH` (le moteur qui fait tourner la session : le shim
// `claude` peut manquer ou viser un mauvais dossier sous Desktop, incident Templates 2026-10-06), à
// défaut `claude` du PATH. Sous Windows, une installation npm pose `claude.cmd`, que `execFileSync` ne
// lance pas sans shell : passage par un shell, chaque argument entre guillemets (chemins avec espaces).
// Ailleurs, `execFileSync` direct. Jamais de sortie interactive : `stdio: 'pipe'`.

import { execFileSync, execSync } from 'node:child_process';

export const binaire = process.env.CLAUDE_CODE_EXECPATH || 'claude';

const WIN = process.platform === 'win32';
const citer = (a) => `"${String(a).replace(/"/g, '\\"')}"`;

/** Lance `claude <args>` et rend sa sortie standard. Lève si le binaire est introuvable ou sort non nul
 * (`e.stdout` / `e.stderr` portent les dernières lignes). `cwd` : dossier d'exécution (défaut : celui du
 * processus) ; `timeout` en millisecondes (défaut 120 s). */
export function claude(args, { cwd = process.cwd(), timeout = 120000 } = {}) {
  const opts = { cwd, windowsHide: true, stdio: 'pipe', encoding: 'utf8', timeout };
  return WIN
    ? execSync([binaire, ...args].map(citer).join(' '), opts)
    : execFileSync(binaire, args, opts);
}
