#!/usr/bin/env node
// Contrôle mécanique : le brief et les règles du projet suivent-ils les décisions ?
// (docs/decisions/2026-09-23-brief-tenu-par-les-decisions.md ;
//  docs/decisions/2026-10-08-regles-de-projet-validees.md pour la ligne `Règles :`)
//
// POURQUOI CE FICHIER EXISTE
// La décision veut une règle mécanique, sans jugement : toute décision qui annonce un changement de
// PROJECT_BRIEF.md doit l'avoir appliqué — dans le commit même de la décision, ou par un rattrapage
// explicite (`Brief-applique: <chemin>`). Une simple comparaison de dates a une faille, trouvée par
// la critique du plan : une clôture de plan qui coche la roadmap rajeunit PROJECT_BRIEF.md et
// masquerait ainsi toute décision antérieure non appliquée. Ce script compare donc la PREUVE (le
// commit qui a ajouté la décision, et l'éventuel commit de rattrapage qui porte la ligne), jamais
// seulement des dates — sauf dans le seul cas où la décision ne porte aucune ligne `Brief :` (décision
// antérieure à la règle, ou omission), où aucune preuve d'application n'est même annoncée.
// MÊME MÉCANIQUE POUR LES RÈGLES : la ligne `Règles : inchangées | <règle> : <changement>` du fichier de
// détail vise CLAUDE.md (§ Règles spécifiques), rattrapage `Regles-appliquees: <chemin>` postérieur.
// Pas de ligne `Règles :` → ignorée (décisions d'avant la règle), contrairement à `Brief :`.
// `verificateur-plan` n'a ni Bash ni git : il ne peut que reporter une sortie calculée ailleurs.
//
// USAGE
//   node .claude/workflow/bin/brief-a-jour.mjs   (projet vendoré)
//   node plugin/bin/brief-a-jour.mjs             (ce dépôt, source)
//
// SORTIE, et rien d'autre : une ligne `ÉCART <chemin> — <raison>` par décision en écart, puis une
// dernière ligne — `RAS — <n> décision(s) vérifiée(s)`, `<k> écart(s) sur <n> décision(s)`, ou
// `SANS OBJET — pas de PROJECT_BRIEF.md` (ni CLAUDE.md). Code de sortie : 0 (RAS ou sans objet), 1 (au moins un
// écart), 2 (pas un dépôt git, ou git en échec — message d'une ligne sur stderr).

import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const RACINE = process.cwd();

function erreur(motif) {
  console.error(`brief-a-jour: ${motif}`);
  process.exit(2);
}

function git(args) {
  return execFileSync('git', args, { cwd: RACINE, encoding: 'utf8' });
}

/** Ne lève jamais : une commande git qui échoue (fichier sans historique, etc.) rend juste '' ici —
 * seule l'absence de dépôt git est fatale (vérifiée une fois, au démarrage). */
function gitOuVide(args) {
  try {
    return git(args);
  } catch {
    return '';
  }
}

function lignes(sortie) {
  return sortie
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

try {
  git(['rev-parse', '--is-inside-work-tree']);
} catch {
  erreur('pas un dépôt git');
}

const aBrief = existsSync(join(RACINE, 'PROJECT_BRIEF.md'));
const aRegles = existsSync(join(RACINE, 'CLAUDE.md'));
if (!aBrief && !aRegles) {
  console.log('SANS OBJET — pas de PROJECT_BRIEF.md');
  process.exit(0);
}

const decisions = lignes(gitOuVide(['ls-files', '--', 'docs/decisions/*.md']));

function normaliser(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function dateCourte(iso) {
  return iso ? iso.slice(0, 10) : '?';
}

/** Commit qui a ajouté `chemin` — le plus ancien si plusieurs (fichier recréé). */
function commitAjout(chemin) {
  const l = lignes(gitOuVide(['log', '--diff-filter=A', '--format=%H', '--', chemin]));
  return l.length ? l[l.length - 1] : null;
}

function dateCommitAjout(chemin) {
  const l = lignes(gitOuVide(['log', '--diff-filter=A', '--format=%cI', '--', chemin]));
  return l.length ? l[l.length - 1] : null;
}

function dateDernierCommit(chemin) {
  const s = gitOuVide(['log', '-1', '--format=%cI', '--', chemin]).trim();
  return s || null;
}

function fichiersCommit(sha) {
  return lignes(gitOuVide(['show', '--name-only', '--format=', sha]));
}

/** Vrai si un commit plus récent (postérieur) que `apres` porte `<marqueur>: <chemin>` dans son
 * message (`Brief-applique` ou `Regles-appliquees`) — jamais un commit plus ancien, sinon la ligne
 * pourrait précéder la décision qu'elle dit appliquer. */
function aRattrapage(marqueur, chemin, apres) {
  const shas = lignes(gitOuVide(['log', '--format=%H'])); // du plus récent au plus ancien
  const idx = shas.indexOf(apres);
  const plusRecents = idx === -1 ? [] : shas.slice(0, idx);
  const cible = `${marqueur}: ${chemin}`;
  for (const sha of plusRecents) {
    const msg = gitOuVide(['log', '-1', '--format=%B', sha]);
    if (msg.split('\n').some((l) => l.trim() === cible)) return true;
  }
  return false;
}

const ecarts = [];

/** Vérifie une ligne annonçant un changement : le fichier cible est dans le commit d'ajout de la
 * décision, ou un commit postérieur porte le marqueur de rattrapage. Rend l'écart, ou null. */
function verifierLigne(chemin, ligne, cfg) {
  const valeur = ligne.replace(cfg.motif, '').trim();
  if (normaliser(valeur).startsWith('inchange')) return null;
  const idx = valeur.indexOf(':');
  const sujet = idx === -1 ? valeur : valeur.slice(0, idx).trim();
  const sha = commitAjout(chemin);
  if (sha && fichiersCommit(sha).includes(cfg.cible)) return null;
  if (sha && aRattrapage(cfg.marqueur, chemin, sha)) return null;
  const shaAffiche = sha ? sha.slice(0, 7) : 'inconnu';
  return `ÉCART ${chemin} — ${cfg.etiquette} : ${sujet} annoncé, ${cfg.cible} absent du commit ${shaAffiche} et aucun ${cfg.marqueur}`;
}

const BRIEF = { motif: /^Brief\s*:\s*/, cible: 'PROJECT_BRIEF.md', marqueur: 'Brief-applique', etiquette: 'Brief' };
const REGLES = { motif: /^R[èe]gles\s*:\s*/, cible: 'CLAUDE.md', marqueur: 'Regles-appliquees', etiquette: 'Règles' };

for (const chemin of decisions) {
  const contenu = readFileSync(join(RACINE, chemin), 'utf8');
  const lignesFichier = contenu.split('\n');

  if (aBrief) {
    const ligneBrief = lignesFichier.find((l) => /^Brief\s*:/.test(l));
    if (!ligneBrief) {
      const dAjout = dateCommitAjout(chemin);
      const dBrief = dateDernierCommit('PROJECT_BRIEF.md');
      if (dAjout && dBrief && dAjout > dBrief) {
        ecarts.push(
          `ÉCART ${chemin} — pas de ligne Brief :, décision postérieure au dernier commit du brief (${dateCourte(dBrief)})`,
        );
      }
    } else {
      const e = verifierLigne(chemin, ligneBrief, BRIEF);
      if (e) ecarts.push(e);
    }
  }

  if (aRegles) {
    const ligneRegles = lignesFichier.find((l) => /^R[èe]gles\s*:/.test(l));
    if (ligneRegles) {
      const e = verifierLigne(chemin, ligneRegles, REGLES);
      if (e) ecarts.push(e);
    }
  }
}

for (const l of ecarts) console.log(l);

if (ecarts.length === 0) {
  console.log(`RAS — ${decisions.length} décision(s) vérifiée(s)`);
  process.exit(0);
}
console.log(`${ecarts.length} écart(s) sur ${decisions.length} décision(s)`);
process.exit(1);
