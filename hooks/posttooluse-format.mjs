// Hook PostToolUse (matcher Edit|Write) — formatage de confort, jamais une gate.
// Si le projet édité a prettier configuré (.prettierrc* ou clé "prettier" dans package.json)
// ET que l'extension du fichier édité est couverte : `npx prettier --write <fichier>`.
// Sinon, ou en cas d'erreur quelconque : exit 0 sans rien écrire. Ne bloque JAMAIS.

import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, isAbsolute, extname } from 'node:path';
import { lireEntree, repertoireProjet, riendafaire } from './lib.mjs';

const FICHIERS_CONFIG_PRETTIER = [
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.json5',
  '.prettierrc.yaml',
  '.prettierrc.yml',
  '.prettierrc.js',
  '.prettierrc.cjs',
  '.prettierrc.mjs',
  '.prettierrc.toml',
  'prettier.config.js',
  'prettier.config.cjs',
  'prettier.config.mjs',
];

const EXTENSIONS_COUVERTES = new Set([
  '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts',
  '.json', '.jsonc', '.css', '.scss', '.less', '.md', '.mdx',
  '.html', '.vue', '.yaml', '.yml', '.graphql',
]);

/** Racine projet : remonte depuis le fichier édité jusqu'au dossier contenant .git. */
function racineProjet(depuis, secours) {
  let dir = depuis;
  for (;;) {
    if (existsSync(join(dir, '.git'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return secours;
    dir = parent;
  }
}

function prettierConfigure(racine) {
  if (FICHIERS_CONFIG_PRETTIER.some((f) => existsSync(join(racine, f)))) return true;
  const pkg = join(racine, 'package.json');
  if (existsSync(pkg)) {
    try {
      const contenu = JSON.parse(readFileSync(pkg, 'utf8'));
      if (contenu.prettier !== undefined) return true;
    } catch {
      // package.json illisible/invalide : on ignore, pas une raison de planter.
    }
  }
  return false;
}

try {
  const entree = await lireEntree();
  const cheminBrut = entree.tool_input?.file_path;
  if (!cheminBrut) riendafaire();

  const cwd = repertoireProjet(entree);
  const chemin = isAbsolute(cheminBrut) ? cheminBrut : join(cwd, cheminBrut);

  if (!existsSync(chemin)) riendafaire();
  if (!EXTENSIONS_COUVERTES.has(extname(chemin))) riendafaire();

  const racine = racineProjet(dirname(chemin), cwd);
  if (!prettierConfigure(racine)) riendafaire();

  try {
    execFileSync('npx', ['prettier', '--write', chemin], {
      cwd: racine,
      stdio: 'ignore',
      windowsHide: true,
      timeout: 10000,
    });
  } catch {
    // Le formatage est un confort, jamais une gate — toute erreur prettier est avalée.
  }
} catch {
  // Garde-fou ultime : quoi qu'il arrive, ce hook ne bloque jamais la session.
}

process.exit(0);
