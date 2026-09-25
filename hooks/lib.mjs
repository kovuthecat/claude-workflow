// Utilitaires communs aux hooks du workflow Templates.
// Aucune dépendance externe (pas de jq, pas de npm install).

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join, resolve } from 'node:path';

const ICI = dirname(fileURLToPath(import.meta.url));

export function lirePlafonds() {
  return JSON.parse(readFileSync(join(ICI, 'plafonds.json'), 'utf8'));
}

/** Lit le JSON envoyé sur stdin par Claude Code. Renvoie {} si vide/illisible. */
export async function lireEntree() {
  const morceaux = [];
  for await (const m of process.stdin) morceaux.push(m);
  try {
    return JSON.parse(Buffer.concat(morceaux).toString('utf8') || '{}');
  } catch {
    return {};
  }
}

/** Répertoire du projet : celui fourni par le hook, sinon le cwd du process. */
export function repertoireProjet(entree) {
  return entree.cwd || entree.project_dir || process.cwd();
}

/** Sortie brute de git (non trimée) — indispensable pour --porcelain, dont la 1re colonne est un espace. */
export function gitBrut(cwd, ...args) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    });
  } catch {
    return null;
  }
}

export function git(cwd, ...args) {
  const sortie = gitBrut(cwd, ...args);
  return sortie === null ? null : sortie.trim();
}

export function estUnDepot(cwd) {
  return git(cwd, 'rev-parse', '--is-inside-work-tree') === 'true';
}

/** Rafraîchit les refs de suivi, sous plafond de temps strict.
 *
 *  Sans `fetch`, `origin/main` vaut ce qu'en disait la dernière synchronisation : un clone laissé de
 *  côté se croit à jour indéfiniment. Mais le hook qui appelle ceci porte aussi l'injection de
 *  CLAUDE-BASE.md, et un remote injoignable ne doit jamais coûter les règles de la session — d'où le
 *  plafond de 6 s, tenu à l'intérieur des 15 s du hook (démarrage node + appels git locaux compris)
 *  pour n'obliger à retoucher aucun `settings.json` de projet. Échec (hors ligne, pas de remote,
 *  dépassement) : la comparaison qui suit portera sur une référence peut-être périmée, jamais sur
 *  une erreur. */
export function recupererAmont(cwd, plafondMs = 6000) {
  try {
    execFileSync('git', ['fetch', '--quiet'], {
      cwd,
      stdio: ['ignore', 'ignore', 'ignore'],
      windowsHide: true,
      timeout: plafondMs,
    });
    return true;
  } catch {
    return false;
  }
}

export function aUnRemote(cwd) {
  return Boolean(git(cwd, 'remote'));
}

/** Branche courante, ou `null` si HEAD est détachée. */
export function brancheCourante(cwd) {
  const branche = git(cwd, 'rev-parse', '--abbrev-ref', 'HEAD');
  return branche && branche !== 'HEAD' ? branche : null;
}

/** Branche d'intégration du dépôt : celle que désigne `origin/HEAD`, `main` à défaut.
 *
 *  Lue, jamais supposée : un dépôt hérité peut encore intégrer sur `master`. Le repli sur `main`
 *  ne sert que si `origin/HEAD` n'a jamais été résolu localement. */
export function brancheParDefaut(cwd) {
  const ref = git(cwd, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD');
  return ref ? ref.replace(/^origin\//, '') : 'main';
}

/** Position par rapport à la branche amont : `{amont, retard, avance}`.
 *
 *  `null` dès qu'il n'y a pas d'amont — dépôt sans remote, branche non suivie, HEAD détachée. Le
 *  contrôle est alors sans objet : quatre des dépôts d'ici n'ont aucun remote, et un silence y vaut
 *  mieux qu'un rappel qu'on ne peut pas satisfaire. */
export function etatAmont(cwd) {
  const amont = git(cwd, 'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}');
  if (!amont) return null;
  // `--left-right --count` sur A...B : commits de A absents de B, puis de B absents de A.
  const comptes = git(cwd, 'rev-list', '--left-right', '--count', `${amont}...HEAD`);
  if (!comptes) return null;
  const [retard, avance] = comptes.split(/\s+/).map(Number);
  if (!Number.isFinite(retard) || !Number.isFinite(avance)) return null;
  return { amont, retard, avance };
}

/** Fichiers modifiés/ajoutés/supprimés dans l'arbre de travail (chemins relatifs, / comme séparateur). */
export function fichiersModifies(cwd) {
  const sortie = gitBrut(cwd, 'status', '--porcelain');
  if (!sortie) return [];
  return sortie
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l.length > 3)
    // Format porcelain v1 : 2 caractères de statut, un espace, puis le chemin.
    .map((l) => l.slice(2).trim())
    .map((f) => (f.includes(' -> ') ? f.split(' -> ')[1] : f))
    .map((f) => f.replace(/^"|"$/g, '').replaceAll('\\', '/'));
}

/** Fichiers SUIVIS modifiés (staged ou non, modifiés/supprimés/renommés) — exclut les entrées `??`
 *  (nouveaux fichiers jamais suivis). Un fichier tout juste créé n'a jamais existé côté remote : ce
 *  n'est pas le manquement que vise la gate de push (C3, `WORKFLOW.md` §4b), seul un fichier déjà
 *  suivi et modifié sans être commité l'est. */
export function fichiersSuivisModifies(cwd) {
  const sortie = gitBrut(cwd, 'status', '--porcelain');
  if (!sortie) return [];
  return sortie
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l.length > 3 && !l.startsWith('??'))
    .map((l) => l.slice(2).trim())
    .map((f) => (f.includes(' -> ') ? f.split(' -> ')[1] : f))
    .map((f) => f.replace(/^"|"$/g, '').replaceAll('\\', '/'));
}

export function nbLignes(chemin) {
  if (!existsSync(chemin)) return null;
  const contenu = readFileSync(chemin, 'utf8');
  if (contenu === '') return 0;
  const lignes = contenu.split('\n');
  // Un fichier bien formé se termine par \n : le dernier élément du split est alors la chaîne
  // vide APRÈS ce \n, pas une ligne. Le compter rendait le plafond effectif `plafond - 1`, et
  // /purge-contexte insatisfiable — la skill recompte avec wc -l, qui lui ne le compte pas.
  // Symptôme observé : 5 fichiers pile au plafond signalés en dépassement à chaque session.
  if (lignes[lignes.length - 1] === '') lignes.pop();
  return lignes.length;
}

/** Résout un motif de plafond à segments `<…>` (ex. `plans/P<n>/S<k>.echec.md`, un `<…>` par
 *  segment de chemin, jamais de `/` à l'intérieur) contre les fichiers RÉELS sous `cwd`. Jusqu'ici
 *  la seule clé motif de `plafonds.json` ne matchait jamais rien : `depassements()` faisait
 *  `join(cwd, fichier)` sur le motif LITTÉRAL (`_comment_echec` de `plafonds.json`, T2/P10/S1).
 *  Dossier absent ou illisible à un niveau → cette branche rend simplement aucun chemin, jamais une
 *  exception (même tolérance que le reste de ce fichier). */
function resoudreMotif(cwd, motif) {
  let chemins = [''];
  for (const segment of motif.split('/')) {
    const suivants = [];
    if (segment.includes('<')) {
      const regex = new RegExp(
        '^' + segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/<[^>]+>/g, '[^/]+') + '$'
      );
      for (const base of chemins) {
        let entrees;
        try {
          entrees = readdirSync(join(cwd, base));
        } catch {
          continue;
        }
        for (const entree of entrees) {
          if (regex.test(entree)) suivants.push(base ? `${base}/${entree}` : entree);
        }
      }
    } else {
      for (const base of chemins) suivants.push(base ? `${base}/${segment}` : segment);
    }
    chemins = suivants;
  }
  return chemins;
}

/** Fichiers de contexte dépassant leur plafond. Renvoie [{fichier, lignes, plafond}]. */
export function depassements(cwd) {
  const { plafonds } = lirePlafonds();
  const resultats = [];
  for (const [motif, plafond] of Object.entries(plafonds)) {
    const chemins = motif.includes('<') ? resoudreMotif(cwd, motif) : [motif];
    for (const chemin of chemins) {
      const n = nbLignes(join(cwd, chemin));
      if (n !== null && n > plafond) resultats.push({ fichier: chemin, lignes: n, plafond });
    }
  }
  return resultats;
}

/** true si le fichier appartient au contexte/suivi (par opposition au code applicatif). */
export function estFichierDeSuivi(chemin, fichiersDeSuivi) {
  const base = chemin.split('/').pop();
  return fichiersDeSuivi.includes(base) || chemin.startsWith('plans/');
}

/** Vrai si le cwd est un worktree LIÉ, et non l'arbre principal du dépôt. */
export function worktreeLie(cwd) {
  const propre = git(cwd, 'rev-parse', '--path-format=absolute', '--git-dir');
  const commun = git(cwd, 'rev-parse', '--path-format=absolute', '--git-common-dir');
  return Boolean(propre && commun && resolve(propre) !== resolve(commun));
}

/** Racine de l'arbre de travail principal du dépôt — même appelé depuis un worktree lié, même
 *  quand `.git` y est un FICHIER (gitdir déplacé, cas de ~20 projets depuis le 2026-09-15,
 *  `docs/decisions/2026-09-24-revue-finale-et-regime-pro.md` point 1). `null` si elle ne peut pas
 *  être établie avec certitude — jamais une racine devinée : c'est `vagueParallele` qui traduit
 *  ce `null` en refus par défaut, pas cette fonction.
 *
 *  - Hors worktree lié (arbre principal, `.git` dossier OU fichier) : `--show-toplevel` suffit,
 *    et résout correctement le cas du gitdir déplacé (contrairement à `dirname(--git-common-dir)`,
 *    qui rendait `C:/Users/Kovu/.gitdirs` — la cause des 6 incidents « commit sous verrou »).
 *  - Worktree lié d'un dépôt classique (`--git-common-dir` se termine par `.git`, un dossier) :
 *    `dirname(commun)` reste juste, inchangé.
 *  - Worktree lié d'un dépôt à `.git` déplacé : sondé le 2026-09-24 (plans/P10/S1.md) — les
 *    gitdirs n'ont pas de `core.worktree`, et `git worktree list --porcelain` y rend en première
 *    entrée le gitdir lui-même, jamais l'arbre principal. Aucune détection fiable : `null`.
 *  - Pas un dépôt du tout : comportement historique inchangé (rend `cwd`) — un `cwd` qui n'est pas
 *    sous git n'est pas le cas ambigu que cette fonction refuse par défaut, seul un dépôt existant
 *    dont la racine ne peut pas être établie l'est. */
export function racineDepot(cwd) {
  if (!estUnDepot(cwd)) return cwd;
  if (!worktreeLie(cwd)) {
    return git(cwd, 'rev-parse', '--path-format=absolute', '--show-toplevel');
  }
  const commun = git(cwd, 'rev-parse', '--path-format=absolute', '--git-common-dir');
  if (!commun) return null;
  if (basename(commun) === '.git') return dirname(commun);
  return null;
}

/** Vrai si `racineDepot` ne peut pas établir la racine (worktree lié d'un dépôt à `.git`
 *  déplacé) — utilisé par `pretooluse-git.mjs` pour distinguer ce cas, dans son message de refus,
 *  d'une vague parallèle ordinaire. */
export function racineIntrouvable(cwd) {
  return racineDepot(cwd) === null;
}

/** `true` aussi bien sous `.claude/wave.lock` que lorsque la racine du dépôt est introuvable : une
 *  racine inconnue ne peut pas être vérifiée pour un verrou, donc refus par défaut — comme si le
 *  verrou était posé (décision du 2026-09-24, point 1). */
export function vagueParallele(cwd) {
  const racine = racineDepot(cwd);
  if (racine === null) return true;
  return existsSync(join(racine, '.claude', 'wave.lock'));
}

/** Marqueur temporaire propre à une session (garde anti-boucle du Stop, repère HEAD du
 *  SessionStart). Même clé pour les deux hooks : c'est ce qui les relie d'un bout à l'autre. */
export function repereSession(entree, cwd, suffixe) {
  const dossier = join(tmpdir(), 'claude-hooks-templates');
  const cle = (entree.session_id || cwd).replace(/[^\w-]/g, '_');
  return { dossier, chemin: join(dossier, `${cle}.${suffixe}`) };
}

/** Sessions de plan ayant commité du CODE dans `depuis..HEAD` sans laisser trace de leur revue.
 *
 *  Le dépôt de la revue est inconditionnel (`Bloquant : 0` quand il n'y a rien à dire) : tant que le
 *  plan est ouvert, un `plans/P<n>/S<k>.revue.md` absent ne peut signifier qu'une chose — la revue
 *  n'a pas tourné. C'est le mode d'échec qui a emporté toutes les revues d'un plan entier
 *  (`docs/decisions/2026-09-07-revue-orpheline.md`), sans que rien ne le rende visible.
 *
 *  Mais le fichier est transitoire : le tri de clôture le verse dans `TASKS.md` puis le supprime
 *  (`/fin-de-tache`, Relecture). Une session qui clôt un plan voyait donc ses propres revues — faites,
 *  puis rangées dans les règles — signalées comme manquantes : sur disque, « consommée au tri » et
 *  « jamais lancée » sont le même vide. Désormais `.revue.md` est COMMITÉ (C3) : la preuve qu'une
 *  revue a existé n'est plus un repère `Revues:` déclaré à la main au tri, mais git lui-même —
 *  `git log --diff-filter=A -- plans/P<n>/S<k>.revue.md` retrouve le commit qui l'a ajoutée, que le
 *  fichier soit encore présent ou déjà supprimé par le tri. `--diff-filter=A` ne matche que la
 *  création : une suppression ultérieure ne referait jamais apparaître le faux positif que le
 *  repère `Revues:` existait pour éviter.
 *
 *  Fail-open partout : repère illisible, `git` en échec, aucun repère `Plan:` → tableau vide. Ce
 *  contrôle signale un manque, il n'invente jamais une session. */
export function revuesManquantes(cwd, depuis) {
  if (!depuis) return [];
  const { fichiersDeSuivi } = lirePlafonds();

  const changes = (git(cwd, 'diff', '--name-only', `${depuis}..HEAD`) || '')
    .split('\n')
    .map((f) => f.trim().replaceAll('\\', '/'))
    .filter(Boolean);
  // Une session dont les commits ne portent que du suivi (bilan, statuts) n'a pas produit de code :
  // rien à relire, pas de revue attendue.
  const code = changes.filter((f) => !estFichierDeSuivi(f, fichiersDeSuivi) && !f.startsWith('.claude/'));
  if (code.length === 0) return [];

  // Racine introuvable (worktree lié d'un dépôt à `.git` déplacé) : rien à signaler, jamais une
  // exception — ce contrôle appartient à l'arbre principal, pas à un worktree qui ne devrait de
  // toute façon pas exister sous une vague (`racineIntrouvable` fait déjà refuser commit/push).
  const racine = racineDepot(cwd);
  if (racine === null) return [];

  const messages = git(cwd, 'log', '--format=%B', `${depuis}..HEAD`) || '';
  const refs = new Set();
  for (const m of messages.matchAll(/Plan:\s*(P\d+)\/(S[A-Za-z0-9_-]+)\//g)) refs.add(`${m[1]}/${m[2]}`);

  const toutes = toutesLesSessions(cwd);
  const manquantes = [];
  for (const ref of refs) {
    const [plan, session] = ref.split('/');
    const dossier = join(racine, 'plans', plan);
    // Un `.echec.md` dispense de revue : la session n'a pas livré, elle a passé la main.
    if (existsSync(join(dossier, `${session}.echec.md`))) continue;
    // Une session `low` n'est jamais relue (C7, relecteur-session.md « Sessions à sauter ») —
    // exemptée ici, au seul endroit qui décide quoi relire pour ce hook (T2, P10/S1), plutôt que
    // de réclamer une revue que personne ne relira.
    const entree = toutes.find((s) => s.plan === plan && s.session === session);
    if (entree && entree.effort === 'low') continue;
    const cheminRevue = `plans/${plan}/${session}.revue.md`;
    const ajoutee = git(cwd, 'log', '--diff-filter=A', '--format=%H', '--', cheminRevue);
    if (ajoutee) {
      const dernier = git(cwd, 'log', '-1', '--diff-filter=AM', '--format=%H', '--', cheminRevue);
      const contenu = dernier ? git(cwd, 'show', `${dernier}:${cheminRevue}`) : null;
      const couverture = /^Couverture\s*:\s*(.+)$/m.exec(contenu ?? '')?.[1].trim();
      if (/^Bloquant\s*:\s*\d+/m.test(contenu ?? '') && (!couverture || couverture === 'complète')) continue;
    }
    manquantes.push(ref);
  }
  return manquantes;
}

/** Famille de modèle (`opus`, `sonnet`, `haiku`, `fable`) depuis un identifiant ou un libellé.
 *
 *  Le hook reçoit un identifiant complet (`claude-sonnet-5`), le plan écrit un libellé (`Sonnet`) :
 *  seule la famille est comparable, et c'est la seule chose que la grille §2 distingue. `null` sur
 *  tout ce qui n'est reconnu — un modèle inconnu ne doit jamais produire de faux signal. */
export function familleModele(valeur) {
  const s = String(valeur || '').toLowerCase();
  return ['opus', 'sonnet', 'haiku', 'fable'].find((f) => s.includes(f)) ?? null;
}

/** Table BRUTE de toutes les sessions déclarées dans `plans/P<n>/index.md`, cochées ou non :
 *  `[{plan, session, modele, effort, statutBrut}]`. Partagée par `sessionsOuvertes` (qui filtre
 *  sur `[ ]`) et `revuesManquantes` (qui a besoin de l'Effort d'une session quel que soit son
 *  statut — une session `low` reste exemptée de revue même une fois cochée, T2/P10/S1) : une seule
 *  lecture de la table, jamais deux parseurs à tenir synchronisés.
 *
 *  Colonnes attendues : Session, Tâches, Titre, Modèle, Effort, Env., Dépend de, Zone, Statut ;
 *  une ligne qui n'a pas cette forme est ignorée. `effort` normalisé comme dans
 *  `plugin/bin/prochaine-action.mjs` (emphase markdown retirée, minuscules) — les deux scripts
 *  doivent lire le même effort pour la même cellule.
 *
 *  Tolérant de bout en bout : racine introuvable, dossier absent, table mal formée, fichier
 *  illisible → tableau vide. Ce qui s'appuie dessus signale un écart, il n'invente jamais une
 *  session. */
function toutesLesSessions(cwd) {
  const racine = racineDepot(cwd);
  if (racine === null) return []; // racine introuvable : rien à signaler, jamais une exception
  const dossierPlans = join(racine, 'plans');
  if (!existsSync(dossierPlans)) return [];
  let entrees;
  try {
    entrees = readdirSync(dossierPlans);
  } catch {
    return [];
  }
  const out = [];
  for (const plan of entrees) {
    if (!/^P\d+$/.test(plan)) continue;
    const index = join(dossierPlans, plan, 'index.md');
    if (!existsSync(index)) continue;
    let contenu;
    try {
      contenu = readFileSync(index, 'utf8');
    } catch {
      continue;
    }
    for (const ligne of contenu.split('\n')) {
      if (!ligne.trim().startsWith('|')) continue;
      const cellules = ligne.split('|').slice(1, -1).map((c) => c.trim());
      if (cellules.length < 9) continue;
      const session = /\b(S\d+)\b/.exec(cellules[0]);
      if (!session) continue;
      out.push({
        plan,
        session: session[1],
        modele: cellules[3],
        effort: cellules[4].replace(/[`*]/g, '').trim().toLowerCase(),
        statutBrut: cellules[8],
      });
    }
  }
  return out;
}

/** Sessions restant à faire dans les plans ouverts : `[{plan, session, modele, effort}]`.
 *
 *  Lues dans `plans/P<n>/index.md`, **seul porteur des statuts** (§4a) — jamais dans les `S<k>.md`,
 *  qui les dupliqueraient.
 *
 *  Tolérant de bout en bout : dossier absent, table mal formée, fichier illisible → tableau vide.
 *  Ce qui s'appuie dessus signale un écart, il n'invente jamais une session. */
export function sessionsOuvertes(cwd) {
  return toutesLesSessions(cwd)
    // `[ ]` = reste à faire. `[x]`, `[x]!` (revue à bloquant, §4a), `[~]`, l'en-tête et le
    // séparateur sont hors sujet.
    .filter((s) => /\[\s\]/.test(s.statutBrut))
    .map(({ plan, session, modele, effort }) => ({ plan, session, modele, effort }));
}

export function repondre(objet) {
  process.stdout.write(JSON.stringify(objet));
  process.exit(0);
}

export function riendafaire() {
  process.exit(0);
}

/** Compare deux versions `x.y.z` NUMÉRIQUEMENT — `true` si `a` est strictement postérieure à `b`.
 *
 *  Jamais une comparaison lexicale (`"0.9.0" > "0.38.1"` en ordre de chaînes, puisque `'9' > '3'`) :
 *  c'est exactement le piège qui ferait manquer un retard réel sur un projet resté en 0.9.x pendant
 *  qu'une 0.38.x est publiée. Segments manquants traités comme `0` (`1.2` face à `1.2.0`). */
export function versionSuperieure(a, b) {
  const pa = String(a ?? '').split('.').map(Number);
  const pb = String(b ?? '').split('.').map(Number);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const na = Number.isFinite(pa[i]) ? pa[i] : 0;
    const nb = Number.isFinite(pb[i]) ? pb[i] : 0;
    if (na !== nb) return na > nb;
  }
  return false;
}

/** Dernière version taguée du dépôt public source du workflow (C4), lue depuis le manifeste
 *  vendoré du projet (`.claude/workflow/manifest.json`, champ `source` : un slug
 *  `propriétaire/dépôt`, l'URL interrogée étant `https://github.com/<slug>`).
 *
 *  Cache 24 h sous le VRAI gitdir (`{ version, lu }`, via `--git-path`, jamais
 *  `join(racine, '.git', …)` : quand `.git` est un FICHIER — gitdir déplacé, ~20 projets depuis le
 *  2026-09-15 — ce chemin littéral n'existe pas, le cache ne s'écrivait ni ne se relisait jamais, et
 *  `git ls-remote` retentait le réseau à CHAQUE SessionStart, T2/P10/S1) : un `git ls-remote` sur un
 *  dépôt public coûte un aller-retour réseau à chaque fois sans ce cache. Plafond de 3 s sur
 *  l'appel réseau — un réseau lent ou injoignable ne doit jamais coûter le hook au-delà de ce délai.
 *  Échec (hors ligne, dépôt introuvable, délai dépassé, pas de manifeste) → `null`, cache JAMAIS
 *  écrit : un état transitoire ne doit pas geler `null` pendant 24 h la prochaine fois que le
 *  réseau revient. */
export function derniereVersionPubliee(cwd) {
  const racine = racineDepot(cwd);
  if (racine === null) return null; // racine introuvable : jamais de réseau, jamais une exception
  const cheminCache = git(racine, 'rev-parse', '--path-format=absolute', '--git-path', 'workflow-version.json');
  if (!cheminCache) return null; // `git` en échec (pas un dépôt) : jamais de cache, jamais une exception
  const maintenant = Date.now();
  const TTL_MS = 24 * 60 * 60 * 1000;

  if (existsSync(cheminCache)) {
    try {
      const { version, lu } = JSON.parse(readFileSync(cheminCache, 'utf8'));
      if (typeof lu === 'number' && maintenant - lu < TTL_MS) return version ?? null;
    } catch { /* cache illisible : on retente le réseau ci-dessous, jamais d'exception */ }
  }

  const cheminManifeste = join(racine, '.claude', 'workflow', 'manifest.json');
  if (!existsSync(cheminManifeste)) return null;
  let source;
  try {
    source = JSON.parse(readFileSync(cheminManifeste, 'utf8')).source;
  } catch {
    return null;
  }
  if (!source) return null;

  let sortie;
  try {
    sortie = execFileSync(
      'git', ['ls-remote', '--tags', '--sort=-v:refname', `https://github.com/${source}`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true, timeout: 3000 },
    );
  } catch {
    return null; // hors ligne, dépôt introuvable, délai dépassé : jamais écrire le cache sur un échec
  }

  const premiere = (sortie || '').split('\n').find((l) => l.trim());
  const ref = premiere ? (premiere.split('\t')[1] || '') : '';
  const version = /refs\/tags\/v?([\d.]+)/.exec(ref)?.[1] ?? null;
  if (!version) return null;

  try {
    mkdirSync(dirname(cheminCache), { recursive: true });
    writeFileSync(cheminCache, JSON.stringify({ version, lu: maintenant }));
  } catch { /* écriture cache best-effort : un échec n'empêche pas de rendre la version déjà lue */ }

  return version;
}
