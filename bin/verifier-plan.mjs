#!/usr/bin/env node
// Contrôles mécaniques seulement. Le jugement sémantique reste à verificateur-plan.
// Format canonique dans S<n>.md : - Lire : `chemin` / - Modifier : `chemin` (créer).
import { readFileSync, existsSync } from 'node:fs';
import { resolve, relative, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyserIndex } from './lire-index.mjs';

// Plafonds de taille d'une fiche de session (P20/S9/T14 ; mesure sur P16-P19 : bandeaux de 12 à 16
// lignes, fiches de 76 à 276 lignes, médiane 150). Des AVERTISSEMENTS, jamais un écart : une fiche
// longue justifiée (P19/S6) reste valide.
const BANDEAU_MAX = 6;
const FICHE_MAX = 200;

const racine = process.cwd();
const plan = process.argv.find(x => /^P\d+$/.test(x));
const json = process.argv.includes('--json');
const extension = process.argv.includes('--extension');
const erreurs = [];
const signaler = (session, controle, motif) => erreurs.push({ session, controle, motif });
// Avertissements : jamais un écart, le plan reste valide.
const avertissements = [];
try {
  if (!plan) throw new Error('indiquer P<n>');
  // Fins de ligne CRLF (plan réécrit sous Windows) ramenées à LF : sans quoi `$` ne correspond plus
  // en fin de ligne et chaque déclaration est rejetée (incident trames-consultation 2026-09-29).
  const index = readFileSync(resolve(racine, 'plans', plan, 'index.md'), 'utf8').replace(/\r\n/g, '\n');
  // Lecture de l'index : le module partagé (`lire-index.mjs`), le même que le moteur et les hooks.
  const lu = analyserIndex(index);
  const sessions = [];
  for (const id of lu.sessionsIncompletes) signaler(id, 0, 'table de session incomplète');
  for (const l of lu.sessions) {
    if (sessions.some(s => s.id === l.session)) signaler(l.session, 0, 'session dupliquée');
    sessions.push({ id: l.session, terminee: l.coche, dependances: l.dependDe.match(/S\d+/g) ?? [], fichiers: [] });
  }
  if (sessions.length === 0) throw new Error('aucune session reconnue');
  if (!/^Workflow\s*:\s*v\S+/m.test(index)) signaler(plan, 7, 'Workflow : v absent');
  // Contrôle 7 — Preuve N0 (nouveau plan seulement) : l'index déclare `requise` ou `non requise`, et
  // `.claude/n0.json` doit dire la même chose (commandes → requise ; `sansCommande` → non requise).
  let sansCommande = null; // motif de n0.json, si le projet est déclaré sans commande
  if (!extension) {
    const declaree = lu.preuveN0 ?? undefined;
    let n0 = null;
    try { n0 = JSON.parse(readFileSync(resolve(racine, '.claude', 'n0.json'), 'utf8')); } catch { /* absent ou illisible */ }
    const motif = typeof n0?.sansCommande === 'string' ? n0.sansCommande.trim() : '';
    const etat = !n0 || !Array.isArray(n0.commandes) ? 'absent'
      : n0.commandes.length === 0 && motif ? 'sansCommande'
      : n0.commandes.length > 0 && n0.sansCommande === undefined ? 'commandes' : 'absent';
    if (!declaree) signaler(plan, 7, 'Preuve N0 : requise ou Preuve N0 : non requise absent (nouveau plan)');
    else if (etat === 'absent') signaler(plan, 7, "créer `.claude/n0.json` (commandes de `CLAUDE.md` § Commandes, ou `sansCommande` avec son motif)");
    else if (declaree === 'requise' && etat === 'sansCommande') signaler(plan, 7, `projet sans commande (${motif}) : écrire \`Preuve N0 : non requise\``);
    else if (declaree === 'non requise' && etat !== 'sansCommande') signaler(plan, 7, "`non requise` exige `.claude/n0.json` avec `sansCommande`");
    else if (declaree === 'non requise') sansCommande = motif;
  }
  const vagues = [];
  for (const v of lu.vagues) {
    const ids = v.sessions;
    vagues.push({ numero: v.numero, ids });
    // « parallélisable » n'a plus de sens (les vagues s'exécutent une session après l'autre) : lu et
    // ignoré dans un plan existant (`--extension`), signalé dans un plan neuf.
    if (!extension && v.label?.includes('parallélisable')) {
      avertissements.push(`Vague ${v.numero} : « parallélisable » est ignoré — les sessions s'exécutent l'une après l'autre`);
    }
    for (const id of ids) {
      const s = sessions.find(s => s.id === id);
      if (!s) { signaler(id, 4, 'session de vague inconnue'); continue; }
      if (s.vague !== undefined) signaler(id, 4, 'session dans plusieurs vagues');
      s.vague = v.numero;
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
    const texte = readFileSync(chemin, 'utf8').replace(/\r\n/g, '\n');
    // Tailles : le bandeau est le premier bloc de lignes `>` AVANT le premier `## ` ; la fiche, ses lignes.
    const lignesFiche = texte.replace(/\n$/, '').split('\n');
    let bandeau = 0, dansBandeau = false;
    for (const l of lignesFiche) {
      if (/^## /.test(l)) break;
      if (l.startsWith('>')) { bandeau++; dansBandeau = true; } else if (dansBandeau) break;
    }
    if (bandeau > BANDEAU_MAX) avertissements.push(`${s.id} : bandeau de ${bandeau} lignes (au plus ${BANDEAU_MAX} : les écarts au défaut seulement, modèle/effort/vague viennent de l'index)`);
    if (lignesFiche.length > FICHE_MAX) avertissements.push(`${s.id} : fiche de ${lignesFiche.length} lignes (plafond ${FICHE_MAX})`);
    const taches = texte.split(/^## T\d+[^\n]*$/m).slice(1);
    for (const [i, tache] of (taches.length ? taches : [texte]).entries()) {
      if (!/^### Objectif/m.test(tache) || !/^### Validation/m.test(tache)) signaler(s.id, 3, `tâche ${i + 1} : Objectif ou Validation absent`);
      const validation = /^### Validation[^\n]*\n([\s\S]*?)(?=^#{1,3} |$(?![\s\S]))/m.exec(tache)?.[1] ?? '';
      // Relâché dans le seul cas `non requise` + n0.json sansCommande : `N0 auto : — (<motif>)`.
      const sansN0 = sansCommande !== null && /N0 auto[^\n]*?:\**\s*—\s*\(/.test(validation);
      if (!/N0 auto[^\n]*`[^`]+`/.test(validation) && !sansN0) signaler(s.id, 3, `tâche ${i + 1} : commande N0 auto absente`);
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
  for (const s of sessions) for (const f of s.fichiers) {
    if (!existsSync(f.absolu) && !(f.modifier && f.creer) && !sessions.some(d => antecedent(s, d.id) && d.fichiers.some(g => g.modifier && g.creer && g.chemin === f.chemin))) {
      signaler(s.id, 1, `chemin absent sans création préalable : ${f.chemin}`);
    }
  }
} catch (e) { signaler(plan ?? 'plan', 0, e.message); }
const resultat = { resultat: erreurs.length ? 'ECART' : 'RAS', erreurs, avertissements };
const texteAvertissements = avertissements.map(a => `avertissement — ${a}`).join('\n');
console.log(json ? JSON.stringify(resultat) : [
  erreurs.length ? erreurs.map(e => `${e.session} · ${e.controle} — ${e.motif}`).join('\n') : 'RAS — contrôles mécaniques du plan',
  texteAvertissements,
].filter(Boolean).join('\n'));
process.exit(erreurs.length ? 1 : 0);
