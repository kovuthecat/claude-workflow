// Empreinte des entrées Git de N0. Les fichiers de suivi ne sont pas des entrées du build.
// Aucun cache fondé sur HEAD : le contenu, les modes et les nouveaux fichiers sont pris en compte.
import { execFileSync } from 'node:child_process';
import { readFileSync, lstatSync, readlinkSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const suivi = (p) => p.startsWith('plans/') || p.startsWith('.claude/n0/') ||
  /^(STATUS|TASKS|DECISIONS|CHANGELOG)\.md$/.test(p) || p === '.claude/wave.lock';
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 50 * 1024 * 1024 });
const sha = (s) => createHash('sha256').update(s).digest('hex');

export function empreinte(cwd, ref = null) {
  const fichiers = [];
  if (ref) {
    for (const ligne of git(cwd, 'ls-tree', '-rz', ref).split('\0').filter(Boolean)) {
      const [, mode, type, objet, chemin] = /^(\d+) (\w+) (\w+)\t([\s\S]+)$/.exec(ligne);
      if (suivi(chemin)) continue;
      if (type !== 'blob') throw new Error(`entrée Git non prise en charge : ${chemin}`);
      fichiers.push([chemin, mode, objet]);
    }
  } else {
    const chemins = [...new Set(git(cwd, 'ls-files', '-z', '--cached', '--others', '--exclude-standard').split('\0').filter(Boolean))].filter(p => !suivi(p));
    const modes = new Map(git(cwd, 'ls-files', '--stage', '-z').split('\0').filter(Boolean).map(l => {
      const [, mode, chemin] = /^(\d+) \w+ \d+\t([\s\S]+)$/.exec(l); return [chemin, mode];
    }));
    const fileMode = git(cwd, 'config', '--get', 'core.filemode').trim() !== 'false';
    const format = git(cwd, 'rev-parse', '--show-object-format').trim();
    const ordinaires = [];
    for (const chemin of chemins) {
      let stat;
      try { stat = lstatSync(join(cwd, chemin)); } catch (e) { if (e.code === 'ENOENT') continue; throw e; }
      if (!stat.isFile() && !stat.isSymbolicLink()) throw new Error(`entrée non prise en charge : ${chemin}`);
      if (stat.isSymbolicLink()) {
        const contenu = Buffer.from(readlinkSync(join(cwd, chemin)));
        fichiers.push([chemin, '120000', createHash(format).update(`blob ${contenu.length}\0`).update(contenu).digest('hex')]);
      } else ordinaires.push([chemin, !fileMode && modes.has(chemin) ? modes.get(chemin) : stat.mode & 0o111 ? '100755' : '100644']);
    }
    // Git applique lui-même attributs/clean filters/CRLF et son format d'objet (SHA-1 ou SHA-256).
    if (ordinaires.length) {
      const objets = execFileSync('git', ['hash-object', '--stdin-paths'], { cwd, encoding: 'utf8',
        input: ordinaires.map(([p]) => JSON.stringify(p)).join('\n') + '\n',
        stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 50 * 1024 * 1024 }).trim().split('\n');
      ordinaires.forEach(([p, mode], i) => fichiers.push([p, mode, objets[i]]));
    }
  }
  fichiers.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  return sha(JSON.stringify(fichiers));
}

export function verifierPreuve(cwd, session) {
  const chemin = `plans/${session}.n0.json`;
  try {
    if (!existsSync(join(cwd, chemin))) return { ok: false, motif: 'preuve N0 absente' };
    const preuve = JSON.parse(readFileSync(join(cwd, chemin), 'utf8'));
    if (preuve.schema !== 1 || preuve.session !== session || preuve.portee !== 'complete' || preuve.resultat !== 'PASS' ||
        !Array.isArray(preuve.commandes) || preuve.commandes.length === 0 || preuve.commandes.some(c => c.code !== 0)) {
      return { ok: false, motif: 'preuve N0 invalide, partielle ou en échec' };
    }
    const commit = git(cwd, 'log', '-1', '--format=%H', '--', chemin).trim();
    if (!commit || git(cwd, 'rev-parse', `${commit}:${chemin}`).trim() !== git(cwd, 'hash-object', '--', chemin).trim()) {
      return { ok: false, motif: 'preuve N0 non commitée' };
    }
    // Le dernier commit de tâche doit précéder ou contenir la preuve, jamais la suivre.
    const dernier = git(cwd, 'log', '-1', '--format=%H', '--fixed-strings', `--grep=Plan: ${session}/`).trim();
    if (!dernier) return { ok: false, motif: 'aucun commit de tâche pour cette preuve' };
    git(cwd, 'merge-base', '--is-ancestor', dernier, commit);
    if (empreinte(cwd, commit) !== preuve.empreinte) return { ok: false, motif: 'preuve N0 périmée au commit validé' };
    const config = JSON.parse(git(cwd, 'show', `${commit}:.claude/n0.json`));
    if (JSON.stringify(config.commandes.map(c => ({ nom: c.nom, cmd: c.cmd }))) !==
        JSON.stringify(preuve.commandes.map(c => ({ nom: c.nom, cmd: c.cmd })))) {
      return { ok: false, motif: 'commandes N0 incomplètes' };
    }
    return { ok: true, commit };
  } catch {
    return { ok: false, motif: 'preuve N0 illisible ou postérieurement invalidée par un commit de tâche' };
  }
}
