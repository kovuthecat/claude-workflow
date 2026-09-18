#!/usr/bin/env node
// Moteur d'actions d'un plan — contrat C2 complet
// (docs/decisions/2026-09-17-autonomie-par-defaut-etat-scripte-push-par-session.md). S2 a écrit la
// moitié « lecture » (l'état) ; S10 ajoute la moitié « décision » (quoi faire ensuite), sur les
// tables de `plugin/skills/orchestrer-plan/references/remediation.md` reprises telles quelles.
//
// POURQUOI CE FICHIER EXISTE
// Budget, table nature → modèle, dépendances et recoupement par les commits sont déterministes ;
// les faire suivre en prose par un modèle est la première source d'erreurs d'aiguillage, payées en
// sessions Opus (P6/S10). Un moteur écrit sur un parseur non éprouvé se débogue deux fois : le
// parseur d'index (ci-dessous, inchangé depuis S2) reste couvert par des fixtures copiées d'index
// réels (tests/fixtures/plans/).
//
// USAGE
//   node plugin/bin/prochaine-action.mjs P<n> [--json]        → une action (ce que fait l'orchestrateur)
//   node plugin/bin/prochaine-action.mjs P<n> --etat [--json] → seulement l'état dérivé (diagnostic)
//   node .claude/workflow/bin/prochaine-action.mjs P<n> [--json]   (projet vendoré)
//
// LECTURE SEULE. L'état se dérive des seuls fichiers commités : la table et l'ordonnancement de
// `plans/P<n>/index.md`, les lignes mécaniques de `plans/P<n>/S<k>.echec.md`, la première ligne de
// `plans/P<n>/S<k>.revue.md`, `git log` (repères `Plan: P<n>/S<k>/T<m>`), `.claude/wave.lock`,
// l'avance/retard sur l'amont. Jamais un état deviné : un index illisible rend une erreur nommée.
//
// SORTIE : sans --json, une ligne lisible puis les champs de l'action ; avec --json, l'objet. Code 0
// si l'index a pu être lu (quel que soit l'état des sessions qu'il décrit), 2 si l'index est
// illisible ou si le plan est absent.

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = process.cwd();

const args = process.argv.slice(2);
const plan = args.find((a) => /^P\d+$/.test(a));
const etat = args.includes('--etat');
const json = args.includes('--json');

if (!plan) {
  console.error('prochaine-action: indiquer un plan (ex. P6)');
  process.exit(2);
}

// ── git, best-effort, jamais bloquant (style maison : plugin/bin/collecter-incidents.mjs) ────────
function git(...a) {
  try {
    return execFileSync('git', a, {
      cwd: RACINE,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
      timeout: 8000,
    }).trim();
  } catch {
    return null;
  }
}

function racineDepot() {
  const commun = git('rev-parse', '--path-format=absolute', '--git-common-dir');
  return commun ? dirname(commun) : RACINE;
}

function etatAmont() {
  const amont = git('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}');
  if (!amont) return null;
  const comptes = git('rev-list', '--left-right', '--count', `${amont}...HEAD`);
  if (!comptes) return null;
  const [retard, avance] = comptes.split(/\s+/).map(Number);
  if (!Number.isFinite(retard) || !Number.isFinite(avance)) return null;
  return { amont, retard, avance };
}

// ── Parseur d'index (table + ordonnancement) ──────────────────────────────────────────────────────
function erreur(motif) {
  return { erreur: `index illisible : ${motif}` };
}

function lireIndex(dossierPlan) {
  const chemin = join(dossierPlan, 'index.md');
  if (!existsSync(chemin)) return erreur(`${chemin} absent`);

  let texte;
  try {
    texte = readFileSync(chemin, 'utf8').replace(/\r\n/g, '\n');
  } catch (e) {
    return erreur(`${chemin} : ${e.message}`);
  }
  const lignes = texte.split('\n');

  const ligneWorkflow = lignes.find((l) => /^Workflow\s*:/.test(l.trim()));
  const workflow = ligneWorkflow ? (/Workflow\s*:\s*v?(\S+)/.exec(ligneWorkflow)?.[1] ?? null) : null;

  // Table des sessions : colonnes fixées par le squelette (nouveau-plan/references/squelette-index.md).
  const sessions = [];
  for (const ligneBrute of lignes) {
    const l = ligneBrute.trim();
    if (!l.startsWith('|')) continue;
    const cellules = l.split('|').slice(1, -1).map((c) => c.trim());
    if (cellules.length < 9) continue;
    const idSession = /\bS(\d+)\b/.exec(cellules[0]);
    if (!idSession) continue; // en-tête ou ligne de séparateur (---)
    const statut = /\[( |x)\](!)?/.exec(cellules[8]);
    sessions.push({
      session: `S${idSession[1]}`,
      taches: cellules[1],
      titre: cellules[2],
      modele: cellules[3],
      effort: cellules[4].replace(/[`*]/g, '').trim().toLowerCase(),
      env: cellules[5],
      dependDe: cellules[6],
      zone: cellules[7],
      statutBrut: cellules[8],
      coche: statut ? statut[1] === 'x' : false,
      bloquantNonTrie: statut ? Boolean(statut[2]) : false,
      pastille: false, // complété plus bas, depuis l'ordonnancement
    });
  }
  if (sessions.length === 0) return erreur(`aucune session reconnue dans la table (${chemin})`);

  // Ordonnancement : vagues (numéro, label, sessions membres) + marqueur `pastille` par session.
  const vagues = [];
  let dansOrdonnancement = false;
  for (const ligneBrute of lignes) {
    const l = ligneBrute.trim();
    if (/^##\s+Ordonnancement/.test(l)) {
      dansOrdonnancement = true;
      continue;
    }
    if (dansOrdonnancement && /^##\s+/.test(l)) {
      dansOrdonnancement = false;
      continue;
    }
    if (!dansOrdonnancement) continue;

    const enteteVague = /^-\s*\*\*Vague\s+(\d+)(?:\s*—\s*([^*]+?))?\*\*\s*:\s*(.+)$/.exec(l);
    if (enteteVague) {
      const labelBrut = enteteVague[2] ? enteteVague[2].trim() : null;
      const labelNormalise = (labelBrut || '').toLowerCase();
      const membres = enteteVague[3].split('(')[0];
      vagues.push({
        numero: Number(enteteVague[1]),
        label: labelBrut,
        parallelisable: labelNormalise.includes('parallélisable'),
        validationHumaine: labelNormalise.includes('validation-humaine'),
        repriseManuelle: labelNormalise.includes('reprise-manuelle'),
        cloture: labelNormalise.includes('clôture'),
        gateLegacy: labelNormalise.includes('gate'), // ancien mot : signalé, jamais interprété
        sessions: [...membres.matchAll(/S\d+/g)].map((m) => m[0]),
      });
      continue;
    }

    // Ligne « en clair » d'une session : `  - **S<k>** — <texte>`. Seul le mot `pastille` y compte ici.
    const sousLigne = /^-\s*\*\*(S\d+)\*\*\s*[—-]\s*(.*)$/.exec(l);
    if (sousLigne && /\bpastille\b/.test(sousLigne[2])) {
      const s = sessions.find((x) => x.session === sousLigne[1]);
      if (s) s.pastille = true;
    }
  }
  if (vagues.length === 0) return erreur(`aucune vague reconnue sous « ## Ordonnancement » (${chemin})`);

  return { workflow, sessions, vagues };
}

// ── Tâches d'une session, commitées ou non ────────────────────────────────────────────────────────
function parseTaches(champ) {
  const nums = new Set();
  for (const morceau of String(champ || '').split(',').map((s) => s.trim()).filter(Boolean)) {
    const m = /^T(\d+)(?:-T(\d+))?$/.exec(morceau);
    if (!m) continue;
    const debut = Number(m[1]);
    const fin = m[2] ? Number(m[2]) : debut;
    for (let i = debut; i <= fin; i++) nums.add(i);
  }
  return [...nums].sort((a, b) => a - b);
}

function refsCommitees() {
  const messages = git('log', '--format=%B') || '';
  const refs = new Set();
  for (const m of messages.matchAll(/Plan:\s*(P\d+)\/(S\d+)\/(T\d+)/g)) {
    refs.add(`${m[1]}/${m[2]}/${m[3]}`);
  }
  return refs;
}

// ── `.echec.md` : les cinq lignes mécaniques, défauts du gabarit quand une ligne manque ─────────────
// (plugin/skills/reprendre-echec/SKILL.md, section « Gabarit »).
function lireEchec(chemin) {
  const texte = readFileSync(chemin, 'utf8');
  const valeur = (nom) => {
    const m = new RegExp(`^${nom}\\s*:\\s*(.*)$`, 'mi').exec(texte);
    return m ? m[1].trim() : null;
  };

  const nature = valeur('Nature') || 'exécution'; // absente ⇒ l'orchestrateur suppose « exécution »

  const tentativesBrut = valeur('Tentatives');
  const tm = tentativesBrut && /reprise\s*=\s*(\d+)\s*enquete\s*=\s*(\d+)/i.exec(tentativesBrut);
  const tentatives = tm
    ? { reprise: Number(tm[1]), enquete: Number(tm[2]) }
    : { reprise: 0, enquete: 0 }; // absente ⇒ budget non consommé

  const blocage = valeur('Blocage'); // absente ⇒ démarrage à froid (pas de canal court)
  const mesure = valeur('Mesure'); // optionnelle : seulement une prémisse mesurée et commitée

  const autoBrut = valeur('Auto');
  const auto = autoBrut && /^oui/i.test(autoBrut) ? autoBrut : 'non'; // absente ⇒ non

  return { nature, tentatives, blocage, mesure, auto, demarrageAFroid: !blocage };
}

function lireRevue(chemin) {
  const texte = readFileSync(chemin, 'utf8');
  const m = /^Bloquant\s*:\s*(\d+)/m.exec(texte);
  return { bloquant: m ? Number(m[1]) : null };
}

// ── Moteur (S10) — table « la nature décide » de remediation.md, reprise telle quelle ────────────────
// Budget (WORKFLOW.md §9c) : 2 reprises + 1 enquête par session, 2 enquêtes par plan. Vit dans les
// lignes mécaniques d'un .echec.md (survit à une orchestration interrompue) ; le total « par plan »
// se dérive en sommant les sessions actuellement en échec de ce plan — un .echec.md disparaît au
// PASS (reprendre-echec Étape 5), donc c'est tout ce que les fichiers commités peuvent encore dire.

const UN_CRAN_AU_DESSUS = { Haiku: 'Sonnet', Sonnet: 'Opus' };

// Effort lançable depuis un index (T2, P7/S2) — `max` en est exclu à dessein : WORKFLOW.md §3 le
// réserve à `/effort max` en session, jamais à une colonne d'index (décision 2026-09-18).
const EFFORTS_LANCABLES = ['low', 'medium', 'high', 'xhigh'];

function questionBudget(session, nature = 'reprise') {
  const mot = nature === 'enquete' ? "d'enquête" : 'de reprises';
  return {
    action: 'question',
    motif: `budget ${mot} épuisé sur ${session.session}`,
    options: { source: 'budget-epuise', session: session.session },
  };
}

/** Une session à lancer porte un effort non lançable — refuser en nommant §3 plutôt que propager
 * un `subagent_type` inexistant (T2, P7/S2). */
function questionEffortInvalide(session) {
  if (session.effort === 'max') {
    return {
      action: 'question',
      motif:
        `${session.session} porte l'effort "max" : non réglable depuis un index ` +
        `(WORKFLOW.md §3, \`/effort max\` en session seulement)`,
      options: { source: 'effort-invalide', session: session.session, effort: session.effort },
    };
  }
  return {
    action: 'question',
    motif: `${session.session} porte un effort inconnu ("${session.effort}") — valeurs acceptées : ${EFFORTS_LANCABLES.join(', ')}`,
    options: { source: 'effort-invalide', session: session.session, effort: session.effort },
  };
}

/** Décision pour UNE session en échec (table « la nature décide », remediation.md). */
function remedier(session, enqueteTotalPlan) {
  const e = session.echec;
  const modeleIndex = session.modele;

  // `Auto : oui · option <m>` — remède déjà connu, prioritaire sur la nature (C5, WORKFLOW.md §9c).
  const auto = e.auto && /^oui\s*·\s*option\s*(\d+)/i.exec(e.auto);
  if (auto) {
    if (e.tentatives.reprise >= 2) return questionBudget(session);
    return { action: 'reprendre', session: session.session, modele: modeleIndex, option: Number(auto[1]) };
  }

  if (e.nature === 'prémisse') {
    if (e.mesure) {
      const commit = /^(\S+)/.exec(e.mesure)?.[1];
      const existe = commit ? git('cat-file', '-e', commit) !== null : false;
      if (existe) {
        return {
          action: 'question',
          motif: `prémisse prouvée par une mesure commitée sur ${session.session} (${commit})`,
          options: { source: 'etape6', cas: 'premisse-confirmee' },
        };
      }
      // Commit cité introuvable : la mesure ne prouve plus rien, retomber sur « sans Mesure ».
    }
    // Chemin complété par l'appelant (prochaineAction), qui seul connaît le plan.
    return { action: 'verifier-premisse', session: session.session };
  }

  if (e.nature === 'environnement') {
    if (e.tentatives.reprise >= 2) return questionBudget(session);
    return { action: 'reprendre', session: session.session, modele: modeleIndex };
  }

  // `exécution`, ou nature absente (défaut du parseur d'échec — reprendre-echec/SKILL.md « Gabarit »).
  if (modeleIndex === 'Opus') {
    if (e.blocage) {
      if (e.tentatives.reprise >= 2) return questionBudget(session);
      return { action: 'reprendre', session: session.session, modele: 'Opus' };
    }
    if (e.tentatives.enquete >= 1 || enqueteTotalPlan >= 2) return questionBudget(session, 'enquete');
    return { action: 'enqueter', session: session.session, modele: 'Opus' };
  }
  if (e.tentatives.reprise >= 2) return questionBudget(session);
  return { action: 'reprendre', session: session.session, modele: UN_CRAN_AU_DESSUS[modeleIndex] ?? 'Sonnet' };
}

/** Une action parmi celles de C2, dérivée de l'état déjà assemblé (`sortie`). */
function prochaineAction(sortie) {
  if (sortie.depot.waveLock) {
    return {
      action: 'question',
      motif: 'vague interrompue sous verrou : diff non commité dans l\'arbre',
      options: { source: 'wave-lock' },
    };
  }

  if (sortie.depot.amont && sortie.depot.amont.avance > 0) {
    return { action: 'pousser' };
  }

  const enqueteTotalPlan = sortie.sessions
    .filter((s) => s.etat === 'echec')
    .reduce((acc, s) => acc + (s.echec?.tentatives.enquete ?? 0), 0);

  const vagues = [...sortie.vagues].sort((a, b) => a.numero - b.numero);
  for (const vague of vagues) {
    const membres = vague.sessions
      .map((id) => sortie.sessions.find((s) => s.session === id))
      .filter(Boolean);

    const enEchec = membres.find((s) => s.etat === 'echec');
    if (enEchec) {
      if (vague.repriseManuelle) {
        return {
          action: 'question',
          motif: `vague ${vague.numero} marquée reprise-manuelle : arrêt sur l'échec de ${enEchec.session}`,
          options: { source: 'reprise-manuelle', session: enEchec.session },
        };
      }
      const decision = remedier(enEchec, enqueteTotalPlan);
      if (decision.action === 'verifier-premisse') {
        decision.chemin = `plans/${sortie.plan}/${enEchec.session}.echec.md`;
      }
      return decision;
    }

    const toutesFaites = membres.every((s) => s.etat === 'faite'); // vrai par défaut si vague sans membre (clôture)
    if (!toutesFaites) {
      const aLancer = membres.filter((s) => s.etat === 'a-lancer');
      const effortInvalide = aLancer.find((s) => !EFFORTS_LANCABLES.includes(s.effort));
      if (effortInvalide) return questionEffortInvalide(effortInvalide);
      return {
        action: 'lancer',
        vague: vague.numero,
        parallele: vague.parallelisable,
        sessions: aLancer.map((s) => ({ session: s.session, modele: s.modele, effort: s.effort })),
      };
    }

    // Vague entièrement faite : revue (plans stampés `Workflow :` seulement — un plan antérieur à
    // C4/C3 n'a jamais produit de .revue.md, lui en exiger un serait un état deviné), puis
    // validation-humaine.
    if (sortie.workflow) {
      // Une session `low` n'est jamais relue (C7, relecteur-session.md « Sessions à sauter ») —
      // exclue ici, au seul endroit qui décide quoi relire (T3, P7/S2), plutôt que de compter sur
      // la prose du relecteur pour l'appliquer.
      const sansRevue = membres.filter(
        (s) =>
          s.effort !== 'low' &&
          s.zone &&
          s.zone.replace(/`/g, '').trim().toLowerCase() !== 'aucune' &&
          !s.revue,
      );
      if (sansRevue.length > 0) {
        return {
          action: 'relire',
          vague: vague.numero,
          sessions: sansRevue.map((s) => ({ session: s.session, effort: s.effort })),
        };
      }
    }

    if (vague.validationHumaine) {
      const suivante = vagues.find((v) => v.numero === vague.numero + 1);
      const suivanteDemarree = suivante
        ? suivante.sessions.some((id) => {
            const s = sortie.sessions.find((x) => x.session === id);
            return s && s.etat !== 'a-lancer';
          })
        : false;
      if (!suivanteDemarree) {
        return { action: 'validation-humaine', vague: vague.numero };
      }
    }
    // Sinon : vague déjà validée (implicitement, par le démarrage de la suivante) — continuer.
  }

  return { action: 'fini' };
}

/** Écart `Workflow : v` index ↔ version courante — un avertissement, jamais une action (Étape 4). */
function avertissementVersion(sortie) {
  if (!sortie.workflow) return null;
  try {
    const binDir = dirname(fileURLToPath(import.meta.url));
    const manifestSource = join(binDir, '..', '.claude-plugin', 'plugin.json');
    const manifestVendore = join(racineDepot(), '.claude', 'workflow', 'manifest.json');
    let versionCourante = null;
    if (existsSync(manifestSource)) {
      versionCourante = JSON.parse(readFileSync(manifestSource, 'utf8')).version;
    } else if (existsSync(manifestVendore)) {
      versionCourante = JSON.parse(readFileSync(manifestVendore, 'utf8')).version;
    }
    if (versionCourante && sortie.workflow.replace(/^v/, '') !== String(versionCourante).replace(/^v/, '')) {
      return `index déclare Workflow : v${sortie.workflow}, plugin en v${versionCourante}`;
    }
  } catch {
    /* best-effort, jamais bloquant */
  }
  return null;
}

function formaterTexte(action) {
  const champs = Object.entries(action)
    .filter(([cle]) => cle !== 'action')
    .map(([cle, valeur]) => `${cle}: ${typeof valeur === 'object' ? JSON.stringify(valeur) : valeur}`);
  let ligne;
  switch (action.action) {
    case 'lancer':
      ligne = `lancer — vague ${action.vague} (${action.parallele ? 'parallèle' : 'séquentiel'}) : ${
        action.sessions.map((s) => s.session).join(', ') || '—'
      }`;
      break;
    case 'verifier-premisse':
      ligne = `verifier-premisse — ${action.session}`;
      break;
    case 'reprendre':
      ligne = `reprendre — ${action.session} (${action.modele}${action.option ? ` · option ${action.option}` : ''})`;
      break;
    case 'enqueter':
      ligne = `enqueter — ${action.session} (${action.modele})`;
      break;
    case 'relire':
      ligne = `relire — vague ${action.vague} : ${action.sessions.map((s) => s.session).join(', ')}`;
      break;
    case 'pousser':
      ligne = 'pousser';
      break;
    case 'validation-humaine':
      ligne = `validation-humaine — vague ${action.vague}`;
      break;
    case 'question':
      ligne = `question — ${action.motif}`;
      break;
    case 'fini':
      ligne = 'fini';
      break;
    default:
      ligne = action.action;
  }
  return [ligne, ...champs].join('\n');
}

// ── Assemblage ─────────────────────────────────────────────────────────────────────────────────────
const dossierPlan = join(RACINE, 'plans', plan);
const index = lireIndex(dossierPlan);
if (index.erreur) {
  console.error(`prochaine-action: ${index.erreur}`);
  process.exit(2);
}

const refs = refsCommitees();
for (const s of index.sessions) {
  const cheminEchec = join(dossierPlan, `${s.session}.echec.md`);
  const cheminRevue = join(dossierPlan, `${s.session}.revue.md`);

  const taches = parseTaches(s.taches).map((n) => `${plan}/${s.session}/T${n}`);
  const toutesCommitees = taches.length > 0 && taches.every((ref) => refs.has(ref));

  if (s.coche) {
    s.etat = 'faite';
  } else if (existsSync(cheminEchec)) {
    s.etat = 'echec';
  } else if (toutesCommitees) {
    s.etat = 'faite';
  } else {
    s.etat = 'a-lancer';
  }

  s.echec = s.etat === 'echec' ? lireEchec(cheminEchec) : null;
  s.revue = existsSync(cheminRevue) ? lireRevue(cheminRevue) : null;
}

const sortie = {
  plan,
  workflow: index.workflow,
  depot: {
    waveLock: existsSync(join(racineDepot(), '.claude', 'wave.lock')),
    amont: etatAmont(),
  },
  vagues: index.vagues,
  sessions: index.sessions,
};

if (etat) {
  process.stdout.write(JSON.stringify(sortie, null, 2) + '\n');
  process.exit(0);
}

const action = prochaineAction(sortie);
const avertissement = avertissementVersion(sortie);
if (avertissement) action.avertissement = avertissement;

process.stdout.write((json ? JSON.stringify(action, null, 2) : formaterTexte(action)) + '\n');
process.exit(0);
