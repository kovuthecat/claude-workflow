#!/usr/bin/env node
// Ramène dans son projet un `.git` déplacé (P21/S4/T11).
//
// POURQUOI CE FICHIER EXISTE
// Des projets ont leur `.git` déplacé hors du dossier (fichier `.git` contenant `gitdir: <chemin>`, cas de
// `C:/Users/Kovu/.gitdirs/`). L'outil `Agent` refuse d'y créer une copie isolée, et nos hooks refusent tout
// commit dans une telle copie (`racineDepot` → `null`). Un dépôt rapatrié redevient le cas classique.
//
// USAGE
//   node plugin/bin/rapatrier-git.mjs [--projets <dossier>]                  liste, ne modifie rien
//   node plugin/bin/rapatrier-git.mjs [--projets <dossier>] --appliquer <projet>   un projet (nom ou chemin)
//   node plugin/bin/rapatrier-git.mjs [--projets <dossier>] --tous           tous les projets éligibles
//   --projets : dossier parent des projets (défaut : le parent de la racine du dépôt courant).
//
// GESTE (copie puis bascule, jamais déplacement : une copie ratée ne touche rien)
//   1. copie du dossier git pointé dans `<projet>/.git.rapatrie` (fs.cpSync), contrôle de la copie
//      (même nombre de fichiers, mêmes octets) ;
//   2. fichier `.git` mis de côté (`.git.gitfile.bak`), copie renommée en `.git` ;
//   3. vérifications : même HEAD, même `git status --porcelain`, `git fsck` sans erreur, première entrée
//      de `git worktree list` = le dossier du projet.
//   Un contrôle qui échoue → retour exact à l'état d'avant (fichier `.git` remis), code 1.
//
// GARANTIES
//   - l'original (le dossier pointé) n'est JAMAIS modifié ni supprimé : il devient la sauvegarde ;
//   - un projet qui a déjà un worktree lié n'est pas rapatrié (ses chemins pointent l'ancien gitdir) ;
//   - un projet déjà classique (`.git` dossier) est ignoré.
//   Dans la copie, `core.worktree` (posé par `--separate-git-dir`) est retiré s'il désigne le projet :
//   un `.git` classique n'en a pas besoin.
//
// SORTIE : texte lisible. Codes : 0 ; 1 un rapatriement a échoué ; 2 usage ou dossier introuvable.

import { execFileSync } from 'node:child_process';
import {
  cpSync, existsSync, lstatSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';

const args = process.argv.slice(2);
const valeur = (nom) => {
  const i = args.indexOf(nom);
  if (i < 0) return null;
  const v = args[i + 1];
  if (!v || v.startsWith('--')) {
    console.error(`${nom} attend une valeur`);
    process.exit(2);
  }
  return v;
};

const git = (cwd, ...a) => execFileSync('git', a, {
  cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024,
});
const gitOuNull = (cwd, ...a) => {
  try { return git(cwd, ...a); } catch { return null; }
};

const norme = (p) => {
  let r = p;
  try { r = realpathSync.native(p); } catch { /* chemin absent : tel quel */ }
  return resolve(r).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
};

// Parcours : nombre de fichiers et octets d'un dossier (liens non suivis).
function mesurer(dossier) {
  let fichiers = 0;
  let octets = 0;
  const pile = [dossier];
  while (pile.length) {
    const d = pile.pop();
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) pile.push(p);
      else {
        fichiers++;
        try { octets += lstatSync(p).size; } catch { /* disparu */ }
      }
    }
  }
  return { fichiers, octets };
}

const taille = (o) => (o >= 1048576 ? `${(o / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.round(o / 1024))} Ko`);

// Cible d'un fichier `.git` « gitdir: … », ou null si ce n'est pas un tel fichier.
function cibleGitfile(projet) {
  const chemin = join(projet, '.git');
  let st;
  try { st = lstatSync(chemin); } catch { return null; }
  if (!st.isFile()) return null;
  const m = /^gitdir:\s*(.+?)\s*$/m.exec(readFileSync(chemin, 'utf8'));
  if (!m) return null;
  return isAbsolute(m[1]) ? m[1] : resolve(projet, m[1]);
}

function worktreesLies(projet) {
  const sortie = gitOuNull(projet, 'worktree', 'list', '--porcelain');
  if (sortie === null) return null;
  return sortie.split('\n').filter((l) => l.startsWith('worktree ')).length - 1;
}

function empreinte(projet) {
  return {
    head: (gitOuNull(projet, 'rev-parse', 'HEAD') ?? 'sans-commit').trim(),
    status: git(projet, 'status', '--porcelain'),
  };
}

function inventaire(dossier) {
  const projets = [];
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const chemin = join(dossier, e.name);
    const cible = cibleGitfile(chemin);
    if (!cible) continue;
    const p = { nom: e.name, chemin, cible, raison: null, taille: null };
    if (!existsSync(cible) || !statSync(cible).isDirectory()) p.raison = 'dossier git pointé introuvable';
    else {
      p.taille = mesurer(cible).octets;
      const liés = worktreesLies(chemin);
      if (liés === null) p.raison = 'git illisible sur ce projet';
      else if (liés > 0) p.raison = `${liés} worktree(s) lié(s) : leurs chemins pointent l'ancien gitdir`;
      else if (existsSync(join(chemin, '.git.rapatrie')) || existsSync(join(chemin, '.git.gitfile.bak'))) {
        p.raison = '.git.rapatrie ou .git.gitfile.bak déjà présent : reste d\'un essai à examiner';
      }
    }
    projets.push(p);
  }
  return projets;
}

// Rapatrie un projet. Rend null si tout est vert, sinon le message d'échec (état d'avant restauré).
function rapatrier(p) {
  const copie = join(p.chemin, '.git.rapatrie');
  const gitfile = join(p.chemin, '.git');
  const bak = join(p.chemin, '.git.gitfile.bak');
  let avant;
  try { avant = empreinte(p.chemin); } catch (e) { return `état initial illisible (git status) : ${e.message.split('\n')[0]}`; }

  let basculee = false;
  const restaurer = () => {
    if (basculee) {
      rmSync(gitfile, { recursive: true, force: true });
      renameSync(bak, gitfile);
    }
    rmSync(copie, { recursive: true, force: true });
  };

  try {
    cpSync(p.cible, copie, { recursive: true, errorOnExist: true, force: false });
    const a = mesurer(p.cible);
    const c = mesurer(copie);
    if (a.fichiers !== c.fichiers || a.octets !== c.octets) {
      throw new Error(`copie incomplète (${c.fichiers}/${a.fichiers} fichiers, ${c.octets}/${a.octets} octets)`);
    }
    // `core.worktree` posé par --separate-git-dir : inutile (et trompeur) dans un `.git` classique.
    const cw = gitOuNull(p.chemin, 'config', '--file', join(copie, 'config'), '--get', 'core.worktree');
    if (cw && norme(resolve(copie, cw.trim())) === norme(p.chemin)) {
      git(p.chemin, 'config', '--file', join(copie, 'config'), '--unset', 'core.worktree');
    }
    renameSync(gitfile, bak);
    renameSync(copie, gitfile);
    basculee = true;

    const apres = empreinte(p.chemin);
    if (apres.head !== avant.head) throw new Error(`HEAD différent (${avant.head} → ${apres.head})`);
    // Le fichier de sauvegarde posé par ce script apparaît lui-même comme non suivi : écarté de la comparaison.
    const sansBak = apres.status.split('\n').filter((l) => l.slice(3).replace(/"/g, '') !== '.git.gitfile.bak').join('\n');
    if (sansBak.trim() !== avant.status.trim()) throw new Error('git status --porcelain différent');
    try { git(p.chemin, 'fsck', '--no-progress'); } catch (e) {
      throw new Error(`git fsck en erreur : ${(e.stderr || e.message).toString().trim().split('\n')[0]}`);
    }
    const premiere = (gitOuNull(p.chemin, 'worktree', 'list', '--porcelain') ?? '').split('\n')[0].replace(/^worktree /, '');
    if (norme(premiere) !== norme(p.chemin)) throw new Error(`première entrée de worktree list : ${premiere}`);
    return null;
  } catch (e) {
    try { restaurer(); } catch (e2) { return `${e.message} — ET restauration incomplète (${e2.message}) : vérifier ${p.chemin}`; }
    return `${e.message} — état d'avant restauré`;
  }
}

// ── Programme ──────────────────────────────────────────────────────────────
const appliquer = valeur('--appliquer');
const tous = args.includes('--tous');
if (appliquer && tous) {
  console.error('--appliquer <projet> et --tous s\'excluent');
  process.exit(2);
}

let dossier = valeur('--projets');
if (!dossier) {
  const racine = gitOuNull(process.cwd(), 'rev-parse', '--show-toplevel');
  if (!racine) {
    console.error('rapatrier-git : pas un dépôt git, passer --projets <dossier>');
    process.exit(2);
  }
  dossier = dirname(racine.trim());
}
dossier = resolve(dossier);
if (!existsSync(dossier) || !statSync(dossier).isDirectory()) {
  console.error(`rapatrier-git : dossier introuvable : ${dossier}`);
  process.exit(2);
}

const projets = inventaire(dossier);
const eligibles = projets.filter((p) => !p.raison);
const ecartes = projets.filter((p) => p.raison);

if (!appliquer && !tous) {
  const l = [`Projets à .git déplacé dans ${dossier} : ${projets.length}`];
  l.push(`Rapatriables : ${eligibles.length}`);
  for (const p of eligibles) l.push(`  ${p.nom} ← ${p.cible} (${taille(p.taille)})`);
  l.push(`Non rapatriables : ${ecartes.length}`);
  for (const p of ecartes) l.push(`  ${p.nom} : ${p.raison}`);
  l.push('Rien n\'a été modifié. Appliquer : --appliquer <projet> ou --tous.');
  console.log(l.join('\n'));
  process.exit(0);
}

let aTraiter;
if (tous) aTraiter = eligibles;
else {
  const voulu = isAbsolute(appliquer) ? norme(appliquer) : null;
  const trouve = projets.find((p) => (voulu ? norme(p.chemin) === voulu : p.nom === basename(appliquer)));
  if (!trouve) {
    const classique = existsSync(join(dossier, basename(appliquer), '.git'));
    console.log(classique
      ? `${appliquer} : déjà classique (.git est un dossier) ou sans gitdir déplacé — ignoré`
      : `${appliquer} : introuvable dans ${dossier}`);
    process.exit(classique ? 0 : 2);
  }
  if (trouve.raison) {
    console.log(`${trouve.nom} : refusé — ${trouve.raison}`);
    process.exit(1);
  }
  aTraiter = [trouve];
}

let echecs = 0;
const sauvegardes = [];
for (const p of aTraiter) {
  const erreur = rapatrier(p);
  if (erreur) {
    echecs++;
    console.log(`${p.nom} : ÉCHEC — ${erreur}`);
  } else {
    sauvegardes.push(p.cible);
    console.log(`${p.nom} : rapatrié (HEAD, status, fsck, worktree list identiques)`);
  }
}
for (const p of ecartes) console.log(`${p.nom} : non rapatrié — ${p.raison}`);
if (sauvegardes.length) {
  console.log('Ces dossiers ne servent plus : ce sont désormais des sauvegardes (rien n\'a été supprimé) :');
  for (const s of sauvegardes) console.log(`  ${s}`);
}
process.exit(echecs ? 1 : 0);
