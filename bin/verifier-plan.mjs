#!/usr/bin/env node
// Contrôles mécaniques seulement. Le jugement sémantique reste à verificateur-plan.
// Format canonique dans S<n>.md : - Lire : `chemin` / - Modifier : `chemin` (créer).
import { readFileSync, existsSync } from 'node:fs';
import { resolve, relative, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = process.cwd();
const plan = process.argv.find(x => /^P\d+$/.test(x));
const json = process.argv.includes('--json');
const extension = process.argv.includes('--extension');
const erreurs = [];
const signaler = (session, controle, motif) => erreurs.push({ session, controle, motif });
try {
  if (!plan) throw new Error('indiquer P<n>');
  const index = readFileSync(resolve(racine, 'plans', plan, 'index.md'), 'utf8');
  const sessions = [];
  for (const ligne of index.split('\n')) {
    if (!ligne.trim().startsWith('|')) continue;
    const c = ligne.split('|').slice(1, -1).map(x => x.trim());
    const id = /\bS\d+\b/.exec(c[0] ?? '')?.[0];
    if (!id) continue;
    if (c.length < 9) { signaler(id, 0, 'table de session incomplète'); continue; }
    if (sessions.some(s => s.id === id)) signaler(id, 0, 'session dupliquée');
    sessions.push({ id, terminee: /\[x\]/.test(c[8]), dependances: c[6].match(/S\d+/g) ?? [], fichiers: [] });
  }
  if (sessions.length === 0) throw new Error('aucune session reconnue');
  if (!/^Workflow\s*:\s*v\S+/m.test(index)) signaler(plan, 7, 'Workflow : v absent');
  if (!extension && !/^Preuve N0\s*:\s*requise\s*$/m.test(index)) signaler(plan, 7, 'Preuve N0 : requise absent (nouveau plan)');
  const ordonnancement = /^## Ordonnancement\s*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m.exec(index)?.[1] ?? '';
  const vagues = [];
  for (const ligne of ordonnancement.split('\n')) {
    const m = /^(?:-\s*)?\*\*Vague\s+(\d+)(?:\s*—\s*([^*]+))?\*\*\s*:\s*(.+)/.exec(ligne.trim());
    if (!m) continue;
    const ids = m[3].replace(/\([^)]*\)/g, '').match(/S\d+/g) ?? [];
    vagues.push({ numero: Number(m[1]), parallele: m[2]?.includes('parallélisable'), ids });
    for (const id of ids) {
      const s = sessions.find(s => s.id === id);
      if (!s) { signaler(id, 4, 'session de vague inconnue'); continue; }
      if (s.vague !== undefined) signaler(id, 4, 'session dans plusieurs vagues');
      s.vague = Number(m[1]);
    }
  }
  if (!vagues.length) signaler(plan, 4, 'ordonnancement absent ou non reconnu');
  for (const s of sessions) {
    if (s.vague === undefined) signaler(s.id, 4, 'session sans vague');
    for (const id of s.dependances) {
      const dep = sessions.find(d => d.id === id);
      if (!dep || !(dep.vague < s.vague)) signaler(s.id, 4, `dépendance ${id} absente ou non antérieure`);
    }
    if (extension && s.terminee) continue; // ancien travail livré : pas de réécriture du plan
    const chemin = resolve(racine, 'plans', plan, `${s.id}.md`);
    if (!existsSync(chemin)) { signaler(s.id, 1, 'fichier de session absent'); continue; }
    const texte = readFileSync(chemin, 'utf8');
    const taches = texte.split(/^## T\d+[^\n]*$/m).slice(1);
    for (const [i, tache] of (taches.length ? taches : [texte]).entries()) {
      if (!/^### Objectif/m.test(tache) || !/^### Validation/m.test(tache)) signaler(s.id, 3, `tâche ${i + 1} : Objectif ou Validation absent`);
      const validation = /^### Validation[^\n]*\n([\s\S]*?)(?=^#{1,3} |$(?![\s\S]))/m.exec(tache)?.[1] ?? '';
      if (!/N0 auto[^\n]*`[^`]+`/.test(validation)) signaler(s.id, 3, `tâche ${i + 1} : commande N0 auto absente`);
    }
    let sectionChemins = false;
    for (const ligne of texte.split('\n')) {
      if (/^#{1,3} /.test(ligne)) sectionChemins = /^#{2,3} (?:Lire|Modifier)(?:\s|$)/.test(ligne);
      const m = /^\s*-\s*(Lire|Modifier)\s*:\s*(.+)$/.exec(ligne);
      if (!m) {
        if ((sectionChemins && ligne.includes('`')) || /^\s*-?\s*\**(?:Lire|Modifier)\**\s*:/.test(ligne))
          signaler(s.id, 1, 'déclaration de chemin non canonique : utiliser - Lire : ou - Modifier :');
        continue;
      }
      const chemins = [...m[2].matchAll(/`([^`]+)`/g)].map(x => x[1]);
      if (!chemins.length) signaler(s.id, 1, 'liste de chemins vide ou ambiguë');
      for (const chemin of chemins) {
        const pluginRoot = dirname(dirname(fileURLToPath(import.meta.url)));
        const developpe = chemin.replace('${CLAUDE_PLUGIN_ROOT}', pluginRoot);
        const absolu = resolve(racine, developpe);
        const rel = relative(racine, absolu).replaceAll('\\', '/');
        const externePlugin = chemin.startsWith('${CLAUDE_PLUGIN_ROOT}/') && m[1] === 'Lire';
        if (/[{}*<>]/.test(developpe) || (!externePlugin && (rel.startsWith('../') || isAbsolute(rel)))) {
          signaler(s.id, 1, `chemin ambigu ou hors dépôt : ${chemin}`); continue;
        }
        if (m[1] === 'Modifier' && /^\.claude\/settings(?:\.local)?\.json$/.test(rel)) signaler(s.id, 12, 'settings Claude à sortir de la session orchestrée');
        s.fichiers.push({ chemin: rel, absolu, modifier: m[1] === 'Modifier', creer: /\b(créer|nouveau)\b/i.test(m[2]) });
      }
    }
    if (!s.fichiers.length) signaler(s.id, 1, 'format à préciser : listes - Lire : / - Modifier : avec chemins entre backticks');
  }
  const antecedent = (s, id, vus = new Set()) => {
    if (vus.has(s.id)) return false;
    vus.add(s.id);
    return s.dependances.some(d => d === id || (sessions.find(x => x.id === d) && antecedent(sessions.find(x => x.id === d), id, new Set(vus))));
  };
  const recoupe = (a, b) => a === b || a.startsWith(b.replace(/\/$/, '') + '/') || b.startsWith(a.replace(/\/$/, '') + '/');
  for (const s of sessions) for (const f of s.fichiers) {
    if (!existsSync(f.absolu) && !(f.modifier && f.creer) && !sessions.some(d => antecedent(s, d.id) && d.fichiers.some(g => g.modifier && g.creer && g.chemin === f.chemin))) {
      signaler(s.id, 1, `chemin absent sans création préalable : ${f.chemin}`);
    }
  }
  for (const v of vagues.filter(v => v.parallele)) {
    const membres = sessions.filter(s => v.ids.includes(s.id));
    for (let i = 0; i < membres.length; i++) for (let j = i + 1; j < membres.length; j++) {
      for (const a of membres[i].fichiers.filter(f => f.modifier)) for (const b of membres[j].fichiers.filter(f => f.modifier)) {
        if (recoupe(a.chemin, b.chemin)) signaler(`${membres[i].id}/${membres[j].id}`, 2, `écritures communes : ${a.chemin} / ${b.chemin}`);
      }
    }
  }
} catch (e) { signaler(plan ?? 'plan', 0, e.message); }
const resultat = { resultat: erreurs.length ? 'ECART' : 'RAS', erreurs };
console.log(json ? JSON.stringify(resultat) : erreurs.length ? erreurs.map(e => `${e.session} · ${e.controle} — ${e.motif}`).join('\n') : 'RAS — contrôles mécaniques du plan');
process.exit(erreurs.length ? 1 : 0);
