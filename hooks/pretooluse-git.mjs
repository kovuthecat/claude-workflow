// Hook PreToolUse (Bash | PowerShell) — applique les règles git de WORKFLOW.md §4b.
// Ces règles étaient jusqu'ici de la prose répétée dans 3 fichiers ; elles sont ici appliquées.
//   1. staging global interdit (git add -A / . / --all, git commit -a) ;
//   2. commit et push interdits quand la racine du dépôt est introuvable (worktree lié d'un dépôt à
//      `.git` déplacé : refus par défaut, rien ne garantit où le commit atterrirait) ;
//   3. voie express (P20/S9/T13) : un commit dont le message porte `Express : <cause>` est refusé si
//      son diff dépasse 150 lignes ou 8 fichiers, touche un manifeste ou lockfile de dépendances,
//      `.claude/n0.json` ou la zone d'un plan ouvert. Le diff mesuré est celui du commit À VENIR
//      (index, plus ce que les `git add` de la même commande vont y mettre) — jamais celui de
//      l'arbre de travail, qu'un `git add` sélectif suivi d'un gros commit ferait mentir.
//
// Ces règles tolèrent des OPTIONS GLOBALES avant la sous-commande (`git -C <dir> commit`,
// `git -c user.name=x commit`) : sans ce préfixe dans le motif, ces variantes passaient sous la
// regex (T2, P10/S1) — un simple `-C .` suffisait à contourner le refus.

import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  lireEntree, repertoireProjet, racineIntrouvable, repondre, riendafaire, git, gitBrut,
  causeExpress, estManifesteDependances, zonesOuvertes, dansUneZone, LIMITES_EXPRESS,
} from './lib.mjs';

const entree = await lireEntree();
const commande = entree?.tool_input?.command;
if (typeof commande !== 'string' || !/\bgit\b/.test(commande)) riendafaire();

const cwd = repertoireProjet(entree);

function refuser(raison) {
  repondre({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: raison,
    },
  });
}

// `git -C <dir>` / `git -c <clé>=<valeur>` : options globales, valides avant n'importe quelle
// sous-commande, répétables (`git -c a=1 -c b=2 commit`). Acceptées ici pour que les refus
// ci-dessous voient la sous-commande RÉELLE, quelle que soit l'option globale qui la précède.
const OPTIONS_GLOBALES = String.raw`(?:\s+-(?:C|c)\s+\S+)*`;

// Découpe la commande en segments de mots, guillemets RETIRÉS (non vidés : `git add '*.md'` doit
// rester un joker). Séparateurs de commande (`;` `&` `|` retour à la ligne) hors guillemets. Les
// heredocs et here-strings sont du texte, pas des arguments : réduits avant la découpe.
function segmentsDeMots(cmd) {
  const brut = cmd
    .replace(/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2\b/g, '<<TEXTE')
    .replace(/@'[\s\S]*?'@|@"[\s\S]*?"@/g, "''");
  const segments = [];
  let mots = [], mot = '', actif = false, guillemet = null;
  const finMot = () => { if (actif) mots.push(mot); mot = ''; actif = false; };
  const finSegment = () => { finMot(); if (mots.length) segments.push(mots); mots = []; };
  for (let i = 0; i < brut.length; i++) {
    const c = brut[i];
    if (guillemet) {
      if (c === guillemet) guillemet = null;
      else if (c === '\\' && guillemet === '"' && i + 1 < brut.length) mot += brut[++i];
      else mot += c;
    } else if (c === '"' || c === "'") { guillemet = c; actif = true; }
    else if (/\s/.test(c) && c !== '\n') finMot();
    else if (c === '\n' || c === ';' || c === '&' || c === '|') finSegment();
    else { mot += c; actif = true; }
  }
  finSegment();
  return segments;
}

// `git [-C x | -c k=v]… add|stage <args>` : la forme refusée, ou null. Chaque argument est jugé seul,
// quelle que soit sa position (`git add src/a.ts .` passait sous l'ancien motif, qui exigeait `.`
// juste après `add`).
function stagingGlobal(mots, cwd) {
  if (mots[0] !== 'git') return null;
  let i = 1, dossier = cwd;
  while (i < mots.length && (mots[i] === '-C' || mots[i] === '-c') && i + 1 < mots.length) {
    if (mots[i] === '-C') dossier = resolve(dossier, mots[i + 1]);
    i += 2;
  }
  if (mots[i] !== 'add' && mots[i] !== 'stage') return null;
  let options = true;
  for (const arg of mots.slice(i + 1)) {
    if (options && arg === '--') { options = false; continue; }
    if (options && arg.startsWith('-')) {
      if (arg === '--update' || arg === '--all') return arg;
      if (/^-[a-zA-Z]+$/.test(arg) && /[Au]/.test(arg)) return arg;
      continue;
    }
    if (arg === '.' || arg === './' || arg === '.\\' || arg.startsWith(':')) return arg;
    if (/[*?[]/.test(arg) && !existsSync(resolve(dossier, arg))) return arg;
  }
  return null;
}

for (const mots of segmentsDeMots(commande ?? '')) {
  const forme = stagingGlobal(mots, cwd);
  if (forme) {
    refuser(
      `WORKFLOW.md §4b : staging global interdit (\`${forme}\`). Stage explicitement les fichiers de ` +
      'la tâche (`git add <fichier> <fichier>`) — jamais `git add -A`, `--all`, `-u`, `.`, `:/` ni un joker.'
    );
  }
}

// Le texte cité n'est pas une option : message de commit (`-m "… commit -a …"`), heredoc bash,
// here-string PowerShell. Il est vidé avant de chercher `-a`, sinon le message lui-même déclenche
// le refus (incident Templates du 2026-09-29).
function neutraliserTexte(cmd) {
  return cmd
    .replace(/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2\b/g, '<<TEXTE')
    .replace(/@'[\s\S]*?'@|@"[\s\S]*?"@/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, "''");
}

// Seules comptent les options du segment `git commit` lui-même, jusqu'au prochain séparateur de
// commande : un `Select-String -NotMatch` enchaîné après le commit n'en est pas une.
function commitAvecToutStager(cmd) {
  const neutre = neutraliserTexte(cmd);
  const motif = new RegExp(String.raw`\bgit${OPTIONS_GLOBALES}\s+commit\b`, 'g');
  for (const m of neutre.matchAll(motif)) {
    const segment = neutre.slice(m.index + m[0].length).split(/[;&|\n]/)[0];
    if (/\s-[a-zA-Z]*a[a-zA-Z]*\b|\s--all\b/.test(segment)) return true;
  }
  return false;
}

if (commitAvecToutStager(commande)) {
  refuser(
    "WORKFLOW.md §4b : `git commit -a` interdit. Stage explicitement les fichiers de la tâche, " +
    'puis `git commit -m "…"`.'
  );
}

// Racine introuvable (worktree lié d'un dépôt à `.git` déplacé, plugin/hooks/lib.mjs
// `racineDepot`) : commit et push refusés par défaut — la racine ne peut pas être vérifiée.
if (racineIntrouvable(cwd) && new RegExp(String.raw`\bgit${OPTIONS_GLOBALES}\s+(commit|push)\b`).test(commande)) {
  refuser(
    "Racine du dépôt introuvable (worktree lié d'un dépôt à `.git` déplacé) : committe depuis " +
    "l'arbre principal."
  );
}

// ── Voie express (P20/S9/T13) ─────────────────────────────────────────────────────────────────────
// Le diff mesuré est celui du commit À VENIR. Au moment où ce hook tourne, la commande n'a pas encore
// exécuté ses `git add` : `git add a b && git commit -m "Express : …"` verrait un index vide. Les
// chemins des `git add` qui PRÈCÈDENT le commit dans la même commande sont donc ajoutés à la mesure
// (leur contenu dans l'arbre de travail, nouveaux fichiers compris). Jamais le diff non indexé du reste
// de l'arbre : c'est ce qu'un `git add` sélectif suivi d'un gros commit ferait mentir.

const ARBRE_VIDE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
// Options de `git commit` qui consomment le mot suivant (les autres mots sont des chemins).
const OPTIONS_A_VALEUR = new Set([
  '-m', '-F', '-C', '-c', '-t', '--message', '--file', '--reuse-message', '--reedit-message',
  '--template', '--author', '--date', '--cleanup', '--fixup', '--squash', '--trailer',
]);

/** `git [-C x | -c k=v]… <sous-commande> <args…>` → { dossier, sous, args }, ou null. */
function appelGit(mots, cwd) {
  if (mots[0] !== 'git') return null;
  let i = 1, dossier = cwd;
  while (i < mots.length && (mots[i] === '-C' || mots[i] === '-c') && i + 1 < mots.length) {
    if (mots[i] === '-C') dossier = resolve(dossier, mots[i + 1]);
    i += 2;
  }
  return mots[i] ? { dossier, sous: mots[i], args: mots.slice(i + 1) } : null;
}

/** Arguments d'un `git commit` : --amend, chemins (`git commit -m x f.js` ne commite que ces chemins),
 *  -i / --include, et fichiers de message (`-F`). */
function lireCommit(args) {
  const lu = { amend: false, inclure: false, chemins: [], fichiersMessage: [] };
  let apresTirets = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (apresTirets) { lu.chemins.push(a); continue; }
    if (a === '--') { apresTirets = true; continue; }
    if (a === '--amend') lu.amend = true;
    else if (a === '--include') lu.inclure = true;
    if (a.startsWith('--')) {
      if (OPTIONS_A_VALEUR.has(a)) { if (a === '--file' && args[i + 1]) lu.fichiersMessage.push(args[i + 1]); i++; }
      else if (a.startsWith('--file=')) lu.fichiersMessage.push(a.slice(7));
      continue;
    }
    if (a.length > 1 && a.startsWith('-')) {
      // Lettres groupées (`-qm "x"`) : on s'arrête à la première qui prend une valeur — attachée
      // (`-mx`) ou, en dernière position, dans le mot suivant.
      for (let k = 1; k < a.length; k++) {
        if (a[k] === 'i') lu.inclure = true;
        if (!'mFCct'.includes(a[k])) continue;
        if (k === a.length - 1) { if (a[k] === 'F' && args[i + 1]) lu.fichiersMessage.push(args[i + 1]); i++; }
        break;
      }
      continue;
    }
    lu.chemins.push(a);
  }
  return lu;
}

/** Chemins explicites d'un `git add` (les formes globales sont déjà refusées plus haut). */
function cheminsDeAdd(args) {
  const chemins = [];
  let options = true;
  for (const a of args) {
    if (options && a === '--') { options = false; continue; }
    if (options && a.startsWith('-')) continue;
    chemins.push(a);
  }
  return chemins;
}

/** Lignes modifiées par chemin (ajoutées + supprimées), chemins relatifs à la racine du dépôt ; null si
 *  git échoue (la voie express ne refuse jamais sur une mesure qu'elle n'a pas pu faire). */
function numstat(dossier, ...args) {
  const sortie = gitBrut(dossier, 'diff', '--numstat', '--no-renames', '-z', ...args);
  if (sortie === null) return null;
  const mesure = new Map();
  for (const entree of sortie.split('\0').filter(Boolean)) {
    const [ajoutees, supprimees, ...chemin] = entree.split('\t');
    // Fichier binaire : « - - » — sans lignes, mais il compte comme fichier.
    mesure.set(chemin.join('\t').replaceAll('\\', '/'), (Number(ajoutees) || 0) + (Number(supprimees) || 0));
  }
  return mesure;
}

/** Fichiers NON SUIVIS sous ces chemins (un `git add` les mettrait dans le commit) → lignes. */
function nonSuivisMesures(dossier, chemins) {
  const racine = git(dossier, 'rev-parse', '--show-toplevel');
  const sortie = gitBrut(dossier, 'ls-files', '--others', '--exclude-standard', '-z', '--full-name', '--', ...chemins);
  const mesure = new Map();
  if (!racine || !sortie) return mesure;
  for (const chemin of sortie.split('\0').filter(Boolean)) {
    try {
      const complet = resolve(racine, chemin);
      if (!statSync(complet).isFile()) continue;
      const contenu = readFileSync(complet);
      const lignes = contenu.includes(0) ? 0 : contenu.toString('utf8').split('\n').length - (contenu.at(-1) === 10 ? 1 : 0);
      mesure.set(chemin, contenu.length === 0 ? 0 : lignes);
    } catch { /* fichier disparu ou illisible : non mesuré */ }
  }
  return mesure;
}

/** Ce que le commit à venir contiendra : Map chemin → lignes, ou null (mesure impossible). */
function mesurerCommit(commit, dossier, ajouts) {
  const aHead = git(dossier, 'rev-parse', '--verify', '-q', 'HEAD') !== null;
  const base = commit.amend
    ? (git(dossier, 'rev-parse', '--verify', '-q', 'HEAD~1') !== null ? 'HEAD~1' : ARBRE_VIDE)
    : (aHead ? 'HEAD' : ARBRE_VIDE);
  // `git commit <chemins>` : le contenu de l'arbre de travail de ces chemins, l'index des autres
  // ignoré (sauf --include, qui s'y ajoute).
  const mesure = commit.chemins.length > 0 && !commit.inclure ? new Map() : numstat(dossier, '--cached', base);
  if (mesure === null) return null;
  const fusionner = (autre) => { for (const [chemin, lignes] of autre ?? []) mesure.set(chemin, lignes); };
  if (commit.chemins.length > 0) fusionner(numstat(dossier, base, '--', ...commit.chemins));
  for (const ajout of ajouts) {
    if (ajout.chemins.length === 0) continue;
    fusionner(numstat(ajout.dossier, base, '--', ...ajout.chemins));
    fusionner(nonSuivisMesures(ajout.dossier, ajout.chemins));
  }
  return mesure;
}

const ajouts = [];
for (const mots of segmentsDeMots(commande)) {
  const appel = appelGit(mots, cwd);
  if (!appel) continue;
  if (appel.sous === 'add' || appel.sous === 'stage') {
    ajouts.push({ dossier: appel.dossier, chemins: cheminsDeAdd(appel.args) });
    continue;
  }
  if (appel.sous !== 'commit') continue;

  const commit = lireCommit(appel.args);
  let texte = commande;
  for (const f of commit.fichiersMessage) {
    try { texte += '\n' + readFileSync(resolve(appel.dossier, f), 'utf8'); } catch { /* -F - (entrée standard) ou fichier absent */ }
  }
  const cause = causeExpress(texte);
  if (!cause) continue;

  const mesure = mesurerCommit(commit, appel.dossier, ajouts);
  if (mesure === null || mesure.size === 0) continue;
  const fichiers = [...mesure.keys()];
  const lignes = [...mesure.values()].reduce((a, b) => a + b, 0);
  const apercu = (liste) => liste.slice(0, 4).join(', ') + (liste.length > 4 ? `, … (${liste.length})` : '');

  const depasse = [];
  if (lignes > LIMITES_EXPRESS.lignes) depasse.push(`${lignes} lignes modifiées (limite ${LIMITES_EXPRESS.lignes})`);
  if (fichiers.length > LIMITES_EXPRESS.fichiers) depasse.push(`${fichiers.length} fichiers (limite ${LIMITES_EXPRESS.fichiers})`);
  const dependances = fichiers.filter(estManifesteDependances);
  if (dependances.length > 0) depasse.push(`touche les dépendances (${apercu(dependances)})`);
  if (fichiers.includes('.claude/n0.json')) depasse.push('touche `.claude/n0.json` (la définition de la gate N0)');
  const zones = zonesOuvertes(appel.dossier);
  const dansZone = fichiers.filter((f) => dansUneZone(f, zones));
  if (dansZone.length > 0) depasse.push(`touche la zone d'un plan ouvert (${apercu(dansZone)})`);

  if (depasse.length > 0) {
    refuser(
      `Voie express refusée (\`Express : ${cause}\`) : ${depasse.join(' ; ')}. ` +
      'Deux issues : réduire le diff pour rentrer dans la voie (150 lignes, 8 fichiers, ni dépendances, ' +
      "ni `.claude/n0.json`, ni zone d'un plan ouvert), ou ouvrir un plan à partir du diff (`/nouveau-plan`)."
    );
  }
}

riendafaire();
