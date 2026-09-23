// Hook SessionStart — rend visible la dérive du contexte au lieu de la laisser se découvrir
// trois semaines plus tard, ET injecte les règles communes (CLAUDE-BASE.md) dans le contexte
// de session (D-P2-2 : remplace l'import `@C:\...\CLAUDE-BASE.md` du CLAUDE.md projet, qui ne
// fonctionne pas en cloud). Les vérifications de dérive n'écrivent RIEN si tout est sain ;
// l'émission de CLAUDE-BASE.md, elle, a lieu à chaque session (coût token assumé, D-P2-2).

import { readFileSync, existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  lireEntree, repertoireProjet, estUnDepot, git, depassements, vagueParallele, worktreeLie,
  repereSession, repondre, riendafaire, racineDepot,
  recupererAmont, etatAmont, aUnRemote, brancheCourante, brancheParDefaut,
  familleModele, sessionsOuvertes, derniereVersionPubliee, versionSuperieure,
} from './lib.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));

const entree = await lireEntree();
const cwd = repertoireProjet(entree);

if (!estUnDepot(cwd)) riendafaire();

// Repère HEAD au démarrage — seule chose qui permette au hook Stop de savoir ce que CETTE session
// a commité, et donc d'exiger la revue de session qui va avec (`revuesManquantes`). Écrit une seule
// fois : sur `compact` ou `resume`, le repère existe déjà et réécrire HEAD effacerait les commits
// déjà pris. Best-effort — un échec ici ne fait que désactiver le contrôle, jamais bloquer.
try {
  const { dossier, chemin } = repereSession(entree, cwd, 'head');
  if (!existsSync(chemin)) {
    const tete = git(cwd, 'rev-parse', 'HEAD');
    if (tete) {
      mkdirSync(dossier, { recursive: true });
      writeFileSync(chemin, tete);
    }
  }
} catch { /* repère indisponible : le Stop retombera en fail-open */ }

const lignes = [];

// Émission de CLAUDE-BASE.md — chemin relatif au fichier du hook (comme lib.mjs pour plafonds.json),
// jamais de chemin absolu : portable en cloud comme dans un plugin installé depuis le cache.
// Sautée sur `resume` : les règles sont déjà dans le contexte repris, les réinjecter les duplique.
// Émise en revanche sur `compact` — après compaction, le contexte a justement été élagué.
// Le champ est `session_start_reason` ; `source` est lu en repli, la doc étant ambiguë sur le nom
// et un faux négatif ici ne coûtant qu'une réinjection (le comportement d'avant cette ligne).
const reprise = (entree.session_start_reason ?? entree.source) === 'resume';
const cheminClaudeBase = join(ICI, '..', 'CLAUDE-BASE.md');
let claudeBase = '';
if (reprise) {
  claudeBase = '';
} else if (existsSync(cheminClaudeBase)) {
  try {
    const contenu = readFileSync(cheminClaudeBase, 'utf8');
    claudeBase =
      '<!-- règles communes injectées par le plugin workflow -->\n' + contenu;
  } catch {
    claudeBase = '**Avertissement** : CLAUDE-BASE.md illisible malgré sa présence.';
  }
} else {
  claudeBase =
    '**Avertissement** : CLAUDE-BASE.md introuvable à la racine du plugin (${CLAUDE_PLUGIN_ROOT}/CLAUDE-BASE.md).';
}

if (vagueParallele(cwd)) {
  lignes.push(
    '**Vague parallèle en cours** (`.claude/wave.lock`) : ne touche ni STATUS.md, ni TASKS.md, ' +
    "ni plans/P*/index.md ; ni commit ni push (ils sont bloqués par hook)."
  );
  // Le PreToolUse ne voit que ce qui passe par un outil : une pastille lancée « avec worktree »
  // crée l'arbre AVANT le premier tour, hors de sa portée. Ce contrôle-ci est le seul qui l'attrape,
  // et il tombe au premier tour — pas après une session de travail perdue d'avance.
  if (worktreeLie(cwd)) {
    lignes.push(
      "**STOP — session de vague ouverte dans un worktree.** Une vague partage un seul arbre de " +
      "travail : le diff produit ici ne sera vu ni par l'orchestrateur ni par la consolidation, et " +
      "le verrou interdit le commit qui permettrait de le rapatrier. Ne code pas : signale-le, et " +
      "redemande la session dans l'arbre principal (pastille → « Démarrer localement »)."
    );
  }
}

// Retard sur l'amont, et branche d'atterrissage — les deux se constatent au démarrage, quand la
// correction est encore gratuite. Un arbre en retard produit un conflit ou, sur un chemin qui pousse
// en `--force`, écrase du travail déjà publié ; une branche autre que celle d'intégration produit du
// travail que personne ne voit venir. Muet pendant une vague : ni pull ni push n'y sont permis.
if (!vagueParallele(cwd) && aUnRemote(cwd)) {
  recupererAmont(cwd);
  const amont = etatAmont(cwd);
  if (amont && amont.retard > 0) {
    lignes.push(
      `**Dépôt en retard de ${amont.retard} commit(s) sur \`${amont.amont}\`** — rattraper ` +
      `(\`git pull --rebase\`) AVANT de commencer (\`WORKFLOW.md\` §4b). Travailler sur un arbre en ` +
      `retard, c'est préparer un conflit ou écraser ce qui a été poussé d'ailleurs.`
    );
  }
  const courante = brancheCourante(cwd);
  const integration = brancheParDefaut(cwd);
  if (courante && courante !== integration) {
    lignes.push(
      `**Branche \`${courante}\`, alors que l'intégration se fait sur \`${integration}\`** — le ` +
      `travail de ce workflow vit et se pousse sur \`${integration}\`, **session cloud comprise** ` +
      `(\`WORKFLOW.md\` §4b). Ne pas finir le plan ici sans l'avoir dit.`
    );
  }
}

// Modèle courant contre celui que le plan demande. La ligne « À régler AVANT de lancer » (§3) ne
// fait que **rappeler** : jusqu'ici rien ne vérifiait, et une session partie au hasard des réglages
// de la veille ne se découvrait qu'au résultat. Le hook reçoit `model` — si aucune session restant
// à faire ne demande cette famille, le dire maintenant, quand la correction est encore gratuite.
// Muet pendant une vague (les sous-agents héritent du modèle de l'orchestrateur, pas du plan) et
// dès qu'aucun plan ouvert ne déclare de modèle.
if (!vagueParallele(cwd)) {
  const familleCourante = familleModele(entree.model);
  if (familleCourante) {
    const ouvertes = sessionsOuvertes(cwd).filter((s) => familleModele(s.modele));
    const attendues = new Set(ouvertes.map((s) => familleModele(s.modele)));
    if (attendues.size > 0 && !attendues.has(familleCourante)) {
      const detail = ouvertes.map((s) => `${s.plan}/${s.session} ${s.modele}/${s.effort}`).join(' · ');
      lignes.push(
        `**Session lancée en ${familleCourante}, qu'aucune session restant à faire ne demande** ` +
        `(${detail}). Régler modèle **et** effort avant de commencer (\`WORKFLOW.md\` §3) : en ` +
        `changer en cours de route repaie tout le préfixe (§3b).`
      );
    }
  }
}

// `git log -- STATUS.md` retrouve le dernier commit ayant touché le fichier même si celui-ci a
// depuis été SUPPRIMÉ : sans ce test d'existence, un projet qui retire son STATUS.md hérite d'un
// « retard » qui grandit à chaque commit et que rien ne peut résorber. Un avertissement permanent
// et inactionnable apprend à ignorer la sortie des hooks — il coûte donc aussi les signaux justes.
const dernierStatus = existsSync(join(cwd, 'STATUS.md'))
  ? git(cwd, 'log', '-1', '--format=%H', '--', 'STATUS.md')
  : null;
if (dernierStatus) {
  const retard = git(cwd, 'rev-list', '--count', `${dernierStatus}..HEAD`);
  if (retard && Number(retard) >= 3) {
    lignes.push(`**STATUS.md a ${retard} commits de retard** — vérifie qu'il décrit encore l'état réel.`);
  }
}

for (const d of depassements(cwd)) {
  lignes.push(`**${d.fichier} : ${d.lignes}/${d.plafond} lignes** — archivage dû (/purge-contexte).`);
}

// Version du workflow vendoré, contre le dernier tag du dépôt public (C4). Jamais dans un
// sous-agent : fait déjà vérifié, `SessionStart` ne s'y déclenche pas. Dépôt non vendoré (pas de
// manifeste, comme CE dépôt source) → muet ; le réseau et le cache 24 h sont entièrement portés
// par `derniereVersionPubliee`, qui rend `null` sans jamais bloquer sur un échec.
try {
  const cheminManifeste = join(racineDepot(cwd), '.claude', 'workflow', 'manifest.json');
  if (existsSync(cheminManifeste)) {
    const manifeste = JSON.parse(readFileSync(cheminManifeste, 'utf8'));
    const versionVendoree = manifeste.version;
    const versionPubliee = derniereVersionPubliee(cwd);
    if (versionVendoree && versionPubliee && versionSuperieure(versionPubliee, versionVendoree)) {
      const urgent = manifeste.correctifCritiqueDepuis
        && versionSuperieure(manifeste.correctifCritiqueDepuis, versionVendoree);
      lignes.push(
        `**Workflow vendoré v${versionVendoree}, source v${versionPubliee}** — /maj-workflow ` +
        (urgent ? '**avant la prochaine vague**.' : 'à la prochaine frontière de plan.')
      );
    }
  }
} catch { /* manifeste illisible ou JSON invalide : contrôle désactivé, jamais de faux positif */ }

// Dépôt sous un dossier synchronisé (Synology Drive, OneDrive, Dropbox, iCloud) : le client ne
// synchronise qu'au fichier près, jamais `.git` en bloc — une reprise en cours d'écriture git
// corrompt l'objet (torrent-uploader, 2026-09-11). Et une exclusion ne suffit pas : Synology Drive
// (comme OneDrive à la demande) filtre tout accès sous son arborescence, contenu exclu compris —
// Vite n'y démarre jamais (torrent-uploader, 2026-09-16/17). Le remède est de déplacer le dépôt ;
// le témoin dit qu'on a choisi de rester en connaissance de cause. Sans lui, rappel à chaque session.
try {
  const racine = racineDepot(cwd);
  if (/SynologyDrive|OneDrive|Dropbox|iCloud/i.test(racine)) {
    const cheminGit = join(racine, '.git');
    const gitEstUnDossier = existsSync(cheminGit) && statSync(cheminGit).isDirectory();
    if (gitEstUnDossier && !existsSync(join(cheminGit, 'info', 'synchro-exclue'))) {
      lignes.push(
        '**Dépôt sous un dossier synchronisé** : le déplacer hors de l\'arborescence du client ' +
        "(une exclusion ne retire pas le filtre du client : `.git` corrompu le 2026-09-11, Vite " +
        'bloqué le 2026-09-16, torrent-uploader). Rester là en connaissance de cause → poser le ' +
        'témoin `.git/info/synchro-exclue`.'
      );
    }
  }
} catch { /* détection best-effort : jamais bloquante */ }

const blocs = [];
if (claudeBase) blocs.push(claudeBase);
if (lignes.length > 0) {
  blocs.push(`État du contexte projet (hook workflow) :\n- ${lignes.join('\n- ')}`);
}

// Reprise sans dérive à signaler : rien à dire, on n'écrit pas.
if (blocs.length === 0) riendafaire();

repondre({
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: blocs.join('\n\n'),
  },
});
