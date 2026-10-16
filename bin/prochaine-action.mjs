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
//   node plugin/bin/prochaine-action.mjs P<n> --appliquer [--json] → les gestes MÉCANIQUES, puis l'action
//        qui demande un agent ou un humain (P20/S7/T11, ci-dessous « --appliquer »)
//
// LECTURE SEULE (sauf `--appliquer`). L'état se dérive de deux sources, et d'elles seules :
//   - l'ARBRE DE TRAVAIL (commité ou non — le code lit le disque, pour de bonnes raisons : rapport
//     d'échec pas encore commité) : la table, l'ordonnancement et les statuts `[x]` de
//     `plans/P<n>/index.md`, les lignes mécaniques de `plans/P<n>/S<k>.echec.md`, les lignes
//     `Bloquant :` / `Couverture :` / `Reprises :` de `plans/P<n>/S<k>.revue.md` ;
//   - GIT : les commits de tâche (repères `Plan: P<n>/S<k>/T<m>`), les versions commitées des
//     `.echec.md` (compteurs, ligne `Premisse :`, y compris supprimés au PASS), une revue ajoutée puis
//     supprimée, l'avance/retard sur l'amont, l'historique partiel (clone `--depth`).
// Jamais un état deviné : un index illisible rend une erreur nommée ; un historique partiel qu'on ne
// peut pas compléter rend une `question` (source `historique-partiel`) sans rien conclure.
//
// SORTIE : chaque action porte un champ `texte` (P20/S5/T8) : le texte FINAL à relayer tel quel —
// annonce de vague (`lancer`), question avec ses options et « reste lançable » calculé (`question`),
// rapport tiré du disque (`fini`), une phrase pour les autres. Sa première ligne est celle d'avant
// (`<action> — …` ; `pousser`, `fini`, `cloturer` nus) : c'est ce que lisent `noter.mjs` et les mods.
// Avec --json, l'objet (champ `texte` compris) ; sans --json, le `texte`, puis — pour la skill qui
// lit encore les champs — une ligne `— données de l'action …` et les champs de l'action. Code 0
// si l'index a pu être lu (quel que soit l'état des sessions qu'il décrit), 2 si l'index est
// illisible ou si le plan est absent.
//
// Actions `lancer`, `reprendre`, `enqueter` : chaque session/appel porte `agent: { subagent_type:
// "general-purpose", model: "<sonnet|opus|haiku>", effort: "<low|medium|high|xhigh>" }`, prêt à
// recopier dans un appel `Agent(...)` (l'effort se passe à l'outil, il prime sur l'agent) —
// jamais une valeur que le modèle transforme lui-même (D2,
// docs/decisions/2026-09-22-flous-du-workflow.md). Modèle hors Sonnet|Opus|Haiku : pas de champ
// `agent`, un `avertissement` nommant la valeur.
//
// État `en-attente` (P20/S6/T9, arrêt relayé) : une session qui tombe sur un choix écrit
// `plans/P<n>/S<k>.question.md` (gabarit : `reprendre-echec/references/gabarit-question.md`), le commite,
// et rend `VERDICT: QUESTION`. Le fichier porte la question, ses options, l'identifiant d'agent et la
// réponse. Sans `Réponse :` remplie → `question` (source `attente-reponse`) ; avec réponse → `transmettre`
// (`SendMessage` à `agent`, `message` = la réponse) ; avec réponse et `Agent : introuvable` (ou `—`) →
// `reprendre` à froid, dont le `prompt` fait lire le fichier. Hors budget dans les trois cas : l'état
// passe avant `echec`, le moteur ne lit ni ne compte `Tentatives :`.
//
// Avant un `lancer` : l'arbre non commité est croisé avec la zone de chaque session de la vague (D1,
// même décision). Recoupement, zone illisible ou `git status` en échec → `question` source
// `arbre-sale`, motifs : fichiers touchés dans une zone, « zone illisible : <segment> », « arbre
// invérifiable ».
//
// `--appliquer` (P20/S7/T11, point 10b de la revue externe du 2026-10-13) : le moteur FAIT les gestes
// mécaniques que l'orchestrateur faisait à la main — et en oubliait (mesure de référence, constat C) —
// puis rend l'action qui demande un agent ou un humain. Sans `--appliquer`, rien n'est écrit : les mods
// et `noter.mjs` lisent le moteur sans le modifier.
//   Gestes : cocher `[x]` une session dont les tâches sont commitées et la preuve N0 valide ; `[x]` →
//   `[x]!` quand sa `.revue.md` porte `Bloquant : n > 0` ; committer une `.revue.md` déposée ;
//   `valider-n0` (N0 `--session`, preuve committée si vert, jamais fabriquée) ; `pousser` (conflit →
//   `rebase --abort`, question `rebase`) ; supprimer, par un commit, le `.echec.md` ou le `.question.md`
//   d'une session qui a repris et commité une tâche depuis (ou le `.echec.md` resté chez une session cochée) ;
//   incrémenter ou créer `Remédiation Opus :` à
//   la première passe Opus rendue ; clôture, points 1-3 et 5 de `fin-de-plan.md`.
//   Options : `--premisse <verdict> <preuve>` (écrit la ligne `Premisse :` du rapport en attente de
//   vérification) · `--interruption S<k> --agent <id>` (`.echec.md` de coupure par quota) ·
//   `--valider-vague <w>` (`· validée`, après le « oui » de l'utilisateur) · `--cloture-faite` (les
//   points 4 et 6 de `fin-de-plan.md`, jugement, sont faits : le moteur pose `Clos :`, pousse, rend `fini`) ·
//   `--tours-max <n>` (diagnostic : borne de l'enchaînement, par défaut sessions × 4).
//   D'ABORD, à chaque appel : les écritures laissées non commitées par un appel interrompu (`index.md`,
//   `.echec.md`, `.question.md`, `*.n0.json` du plan ; une `.revue.md` avec son message de revue) sont
//   committées — un arrêt entre écriture et commit ne laisse jamais un arbre sale à une question humaine.
//   Chaque geste est UN commit (staging explicite des seuls fichiers touchés, jamais `--no-verify`),
//   dernière ligne `Plan: P<n>[/S<k>]`. Le moteur se rappelle lui-même après chaque geste : un plan qui
//   finit rend `fini` dans le même appel. Sortie : une ligne `appliqué — <geste>` par geste (aucune
//   autre ligne n'en commence), puis l'action finale et son `texte` ; avec `--json`, l'action et
//   `appliques: [...]`. Une écriture ou un push qui échoue → `question` source `ecriture-echec` ; plus de
//   gestes que la borne → `question` source `boucle-appliquer` (jamais une boucle infinie).

import { readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifierPreuve } from './preuve-n0.mjs';
import { lireIndexTexte, normaliserSimple } from './lire-index.mjs';
import { racineDepot as racineDepotDuHook } from '../hooks/lib.mjs';

const RACINE = process.cwd();

const args = process.argv.slice(2);
const plan = args.find((a) => /^P\d+$/.test(a));
const etat = args.includes('--etat');
const json = args.includes('--json');
const appliquer = args.includes('--appliquer') && !etat;

if (!plan) {
  console.error('prochaine-action: indiquer un plan (ex. P6)');
  process.exit(2);
}

// Options de `--appliquer` : une option sans `--appliquer` est une erreur d'usage, jamais ignorée en silence.
const VERDICTS_PREMISSE = ['refutee', 'confirmee', 'indecidable'];
function erreurUsage(motif) {
  console.error(`prochaine-action: ${motif}`);
  process.exit(2);
}
function valeursOption(nom, n) {
  const i = args.indexOf(nom);
  if (i < 0) return null;
  const valeurs = args.slice(i + 1, i + 1 + n);
  if (valeurs.length < n || valeurs.some((v) => v.startsWith('--'))) erreurUsage(`${nom} attend ${n} valeur(s)`);
  return valeurs;
}
const optPremisse = valeursOption('--premisse', 2);
const optInterruption = valeursOption('--interruption', 1)?.[0] ?? null;
const optAgent = valeursOption('--agent', 1)?.[0] ?? null;
const optValiderVague = valeursOption('--valider-vague', 1)?.[0] ?? null;
const optToursMax = valeursOption('--tours-max', 1)?.[0] ?? null;
const optClotureFaite = args.includes('--cloture-faite');
if (!appliquer && (optPremisse || optInterruption || optAgent || optValiderVague || optToursMax || optClotureFaite)) {
  erreurUsage('--premisse, --interruption, --agent, --valider-vague, --tours-max et --cloture-faite demandent --appliquer');
}
if (optPremisse && !VERDICTS_PREMISSE.some((v) => normaliserSimple(optPremisse[0]).startsWith(v))) {
  erreurUsage(`--premisse : verdict "${optPremisse[0]}" inconnu (refutee, confirmee ou indecidable attendus)`);
}
if (Boolean(optInterruption) !== Boolean(optAgent)) erreurUsage('--interruption S<k> et --agent <identifiant> vont ensemble');
if (optInterruption && !/^S\d+$/.test(optInterruption)) erreurUsage(`--interruption attend S<k>, reçu "${optInterruption}"`);
if (optValiderVague !== null && !/^\d+$/.test(optValiderVague)) erreurUsage(`--valider-vague attend un numéro de vague, reçu "${optValiderVague}"`);
if (optToursMax !== null && !/^[1-9]\d*$/.test(optToursMax)) erreurUsage(`--tours-max attend un entier ≥ 1, reçu "${optToursMax}"`);

// ── git, best-effort, jamais bloquant (style maison : plugin/bin/collecter-incidents.mjs) ────────
/** Sortie brute de git, espaces de tête compris — `git status --porcelain` commence par un espace pour un
 * fichier suivi modifié (` M chemin`) : la rogner décalait le premier chemin (P20/S6, défaut mesuré). */
function gitBrut(...a) {
  try {
    return execFileSync('git', a, {
      cwd: RACINE,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
      timeout: 8000,
    });
  } catch {
    return null;
  }
}

function git(...a) {
  return gitBrut(...a)?.trim() ?? null;
}

// `racineDepot` : celle de `plugin/hooks/lib.mjs` (bin/ et hooks/ sont vendorés côte à côte,
// `sync-workflow.mjs`) — plus de copie à tenir synchronisée à la main (P20/S4/T6). `null` si la racine ne
// peut pas être établie avec certitude (worktree lié d'un dépôt à `.git` déplacé, sonde du 2026-09-24,
// plans/P10/S1.md) — jamais une racine devinée.
const racineDepot = () => racineDepotDuHook(RACINE);

/** Rebase en cours (fusion ou apply) : jamais résolu depuis un script, toujours une `question`
 * (T5, P10/S2). `--path-format=absolute` : même convention que `racineDepot`, insensible au cwd. */
function rebaseEnCours() {
  for (const nom of ['rebase-merge', 'rebase-apply']) {
    const chemin = git('rev-parse', '--path-format=absolute', '--git-path', nom);
    if (chemin && existsSync(chemin)) return true;
  }
  return false;
}

/** Fichiers **suivis** modifiés, jamais les non suivis (`--untracked-files=no`) : un arbre sale au
 * sens de `pousser` (T5, P10/S2, incident ebm-msp) — distinct de `fichiersSales()` ci-dessous, qui
 * inclut les non-suivis pour le contrôle de zone avant `lancer` (D1). `null` (git en échec) compte
 * comme sale : jamais un arbre invérifiable traité comme propre. */
function arbreTrackedSale() {
  const sortie = git('status', '--porcelain', '--untracked-files=no');
  return sortie === null || sortie.length > 0;
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

// ── Lecture de l'index : un seul lecteur, `./lire-index.mjs` (P20/S4/T6) ──────────────────────────
// Le moteur n'a plus son propre parseur : table, ordonnancement, en-têtes (`Workflow :`, `Preuve N0 :`,
// `Remédiation Opus :`, `Clos :`) viennent du module que lisent aussi le vérificateur et les hooks.
function erreur(motif) {
  return { erreur: `index illisible : ${motif}` };
}

function lireIndex(dossierPlan) {
  const chemin = join(dossierPlan, 'index.md');
  if (!existsSync(chemin)) return erreur(`${chemin} absent`);
  let texte;
  try {
    texte = readFileSync(chemin, 'utf8');
  } catch (e) {
    return erreur(`${chemin} : ${e.message}`);
  }
  const index = lireIndexTexte(texte, chemin);
  if (index.erreur) return index;
  return { ...index, preuveN0: index.preuveN0 === 'requise' };
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

// ── Historique partiel (T3, P19/S3) ──────────────────────────────────────────────────────────────
// Une session cloud clone avec une profondeur limitée : les commits de tâche anciens deviennent
// invisibles. Le moteur tente `git fetch --unshallow` ; s'il échoue, il rend une `question` et ne
// conclut rien sur l'état du plan.
// Délai de l'appel dédié : le helper `git()` (8 s, erreur rendue `null`) tuerait un vrai fetch sur le
// réseau d'une session cloud — chaque appel rendrait alors la question. Au moins 120 s.
const DELAI_UNSHALLOW_MS = 180000;

function historiquePartiel() {
  return git('rev-parse', '--is-shallow-repository') === 'true';
}

/** `null` si le fetch a réussi, sinon le texte de l'erreur de git (stderr conservé pour le motif). */
function completerHistorique() {
  try {
    execFileSync('git', ['fetch', '--unshallow'], {
      cwd: RACINE,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: DELAI_UNSHALLOW_MS,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
    return null;
  } catch (e) {
    const brut = e.killed ? `délai de ${DELAI_UNSHALLOW_MS / 1000} s dépassé` : String(e.stderr || e.message || '').trim();
    return brut.replace(/\s+/g, ' ').slice(0, 300) || 'erreur git inconnue';
  }
}

/** `null` si l'historique est complet (ou a pu être complété) ; sinon la `question` à rendre. */
function verifierHistoriqueComplet() {
  if (!historiquePartiel()) return null;
  const erreurFetch = completerHistorique();
  if (erreurFetch === null && !historiquePartiel()) return null;
  const detail = erreurFetch ?? 'le dépôt reste superficiel après le fetch';
  return {
    action: 'question',
    motif:
      `historique git partiel (clone superficiel) : \`git fetch --unshallow\` a échoué (${detail}). ` +
      "Le moteur n'a rien conclu sur l'état du plan — lancer `git fetch --unshallow` à la main, puis relancer.",
    options: { source: 'historique-partiel', erreur: detail },
  };
}

function refsCommitees() {
  const messages = git('log', '--format=%B') || '';
  const refs = new Set();
  for (const m of messages.matchAll(/Plan:\s*(P\d+)\/(S\d+)\/(T\d+)/g)) {
    refs.add(`${m[1]}/${m[2]}/${m[3]}`);
  }
  return refs;
}

/** Un fichier **ajouté** par un commit, même s'il a été supprimé depuis (T6, P10/S2) — évite qu'une
 * revue déposée puis rangée au tri de clôture ne relance `relire` (constat 2026-09-24, même technique
 * que `plugin/hooks/lib.mjs` `revuesManquantes` : `git log --diff-filter=A`). `chemin` relatif à la
 * racine du dépôt (git tourne avec `cwd: RACINE`). */
function ajouteParUnCommit(chemin) {
  const sortie = git('log', '--diff-filter=A', '--format=%H', '--', chemin);
  return Boolean(sortie);
}

// ── `.echec.md` : les lignes mécaniques, défauts du gabarit quand une ligne manque ───────────────────
// (plugin/skills/reprendre-echec/SKILL.md, section « Gabarit »). Cinq mots de nature reconnus (T4,
// P10/S2) : `environnement`, `exécution`, `prémisse`, `filtre`, `interruption` — les deux derniers
// n'ont pas encore de traitement particulier ici (T5), mais une valeur non reconnue est déjà
// signalée plutôt que silencieusement absorbée.
const NATURES_VALIDES = ['environnement', 'exécution', 'prémisse', 'filtre', 'interruption'];
const NATURES_PAR_FORME_SIMPLE = Object.fromEntries(NATURES_VALIDES.map((n) => [normaliserSimple(n), n]));
// « premisse » et « execution » (sans accent) sont les fautes de frappe attendues.
NATURES_PAR_FORME_SIMPLE.premisse = 'prémisse';
NATURES_PAR_FORME_SIMPLE.execution = 'exécution';

/** `{ nature, inconnue }` — `nature` retombe sur `exécution` (défaut documenté) que la valeur brute
 * soit absente ou non reconnue ; `inconnue` porte la valeur brute **seulement** quand elle était
 * présente et non reconnue (jamais sur une ligne absente) — c'est ce qui distingue un défaut
 * silencieux d'une valeur à questionner (T4, P10/S2). */
function normaliserNature(brut) {
  if (!brut) return { nature: 'exécution', inconnue: null };
  const simple = normaliserSimple(brut);
  const trouvee = NATURES_PAR_FORME_SIMPLE[simple];
  if (trouvee) return { nature: trouvee, inconnue: null };
  return { nature: 'exécution', inconnue: brut };
}

/** Valeur de la première ligne `<clé> : <valeur>` du texte, clé comparée sans casse ni accents
 * (même normalisation que les valeurs, `normaliserSimple`) — `Prémisse`, `PREMISSE` et `premisse`
 * sont la même clé (T4, P19/S3 : une graphie recopiée à la main ne doit pas faire boucler le moteur).
 * `null` si la ligne manque. */
function valeurDeCle(texte, nom) {
  const cible = normaliserSimple(nom);
  for (const ligne of texte.split('\n')) {
    const i = ligne.indexOf(':');
    if (i < 0) continue;
    if (normaliserSimple(ligne.slice(0, i)) === cible) return ligne.slice(i + 1).trim();
  }
  return null;
}

/** `{ reprise, enquete }` écrits dans la ligne `Tentatives :` d'une version du rapport. Reprises et
 * enquêtes lues séparément : un séparateur inhabituel entre les deux (« · » au lieu d'un espace,
 * constat 2026-09-24 : « reprise=1 · enquete=0 » lu 0/0) ne doit plus faire perdre l'un ou l'autre. */
function lireTentatives(texte) {
  const brut = valeurDeCle(texte, 'Tentatives');
  const repriseM = brut && /reprise\s*=\s*(\d+)/i.exec(brut);
  const enqueteM = brut && /enqu[eê]te\s*=\s*(\d+)/i.exec(brut);
  return { reprise: repriseM ? Number(repriseM[1]) : 0, enquete: enqueteM ? Number(enqueteM[1]) : 0 };
}

/** Toutes les versions **commitées** d'un fichier (y compris avant sa suppression au PASS), texte
 * normalisé en `\n`. `chemin` relatif à la racine du dépôt. Une version absente au commit
 * (suppression) est ignorée. Opérations locales : le délai de `git()` suffit (T4, P19/S3). */
function versionsCommitees(chemin) {
  const hashes = (git('log', '--format=%H', '--', chemin) || '').split('\n').filter(Boolean);
  const textes = [];
  for (const h of hashes) {
    const texte = git('show', `${h}:${chemin}`);
    if (texte !== null) textes.push(texte.replace(/\r\n/g, '\n'));
  }
  return textes;
}

function maxTentatives(textes) {
  return textes.map(lireTentatives).reduce(
    (max, v) => ({ reprise: Math.max(max.reprise, v.reprise), enquete: Math.max(max.enquete, v.enquete) }),
    { reprise: 0, enquete: 0 },
  );
}

/** Un échec d'environnement qui se répète à l'identique (P20/S3/T5, constat B de la mesure) : la ligne
 * `Blocage :` de la version courante est celle de la version **commitée précédente**, et celle-ci
 * était déjà de nature `environnement`. « Précédente » = la plus récente version commitée dont le texte
 * diffère de l'arbre de travail (celle qui lui est identique EST l'état courant, pas une tentative
 * antérieure). Lit le même historique que les compteurs (`versionsCommitees`, du plus récent au plus
 * ancien) : une reprise qui oublie d'incrémenter `Tentatives :` ne fait pas boucler le moteur. */
function blocageRepeteDepuisEnvironnement(texte, blocage, anterieures) {
  if (!blocage) return false;
  const precedente = anterieures.find((v) => v.trim() !== texte.trim());
  if (!precedente) return false;
  if (normaliserNature(valeurDeCle(precedente, 'Nature')).nature !== 'environnement') return false;
  const forme = (b) => String(b ?? '').replace(/[\s`*]+/g, ' ').trim().toLowerCase();
  const blocagePrecedent = valeurDeCle(precedente, 'Blocage');
  return blocagePrecedent !== null && forme(blocagePrecedent) === forme(blocage);
}

function lireEchec(chemin, relatif) {
  const texte = readFileSync(chemin, 'utf8').replace(/\r\n/g, '\n');
  const valeur = (nom) => valeurDeCle(texte, nom);
  const anterieures = relatif ? versionsCommitees(relatif) : [];

  const { nature, inconnue: natureInconnue } = normaliserNature(valeur('Nature'));

  // Compteurs = le MAXIMUM sur l'arbre de travail et sur toutes les versions commitées du rapport
  // (T4, P19/S3) : une reprise qui remet `reprise=0`, ou qui supprime puis recrée le fichier, ne
  // remet plus le budget à zéro. Revers assumé : une reprise qui OUBLIE d'incrémenter reste non
  // comptée — le correctif complet (le moteur écrit lui-même le compteur) est le point 10b du plan 2.
  const tentatives = maxTentatives([texte, ...anterieures]);

  const blocage = valeur('Blocage'); // absente ⇒ démarrage à froid (pas de canal court)
  const blocageRepete = blocageRepeteDepuisEnvironnement(texte, blocage, anterieures);
  const mesure = valeur('Mesure'); // optionnelle : seulement une prémisse mesurée et commitée

  // Auto : oui, suivi d'un séparateur quelconque (·, -, ,, espace) puis `option <m>`. Un « oui » sans
  // numéro d'option vaut « non », avec un avertissement (T4, P10/S2) — jamais un `reprendre` sur une
  // option qui n'existe pas.
  const autoBrut = valeur('Auto');
  let auto = 'non';
  let avertissementAuto = null;
  if (autoBrut) {
    const simple = autoBrut.replace(/[`*]/g, '').trim();
    if (/^oui/i.test(simple)) {
      const m = /^oui[\s·\-,]*option\s*(\d+)/i.exec(simple);
      if (m) {
        auto = `oui · option ${m[1]}`;
      } else {
        avertissementAuto = 'Auto : oui sans option — ignoré';
      }
    }
  }

  // Une prémisse réfutée par `verificateur-premisse` (§9c) : l'orchestrateur ajoute cette ligne au
  // rapport avant de rappeler le script (T5, P10/S2) — casse et accents libres.
  const premisseBrut = valeur('Premisse');
  const premisseSimple = premisseBrut === null ? null : normaliserSimple(premisseBrut);
  const premisseStatut = premisseSimple === null
    ? null
    : (['refutee', 'confirmee', 'indecidable'].find((v) => premisseSimple.startsWith(v)) ?? 'illisible');
  const premisseRefutee = premisseStatut === 'refutee';
  // Une ligne `Premisse :` présente dans une version commitée antérieure : la vérification a déjà eu
  // lieu, même si la ligne a été retirée depuis — jamais revérifiée (T4, P19/S3).
  const premisseDejaVerifiee = anterieures.some((v) => valeurDeCle(v, 'Premisse') !== null);

  return {
    nature,
    natureInconnue,
    tentatives,
    blocage,
    blocageRepete,
    mesure,
    auto,
    avertissementAuto,
    premisseRefutee,
    premisseStatut,
    premisseBrut,
    premisseDejaVerifiee,
    demarrageAFroid: !blocage,
  };
}

function lireRevue(chemin, texte = readFileSync(chemin, 'utf8').replace(/\r\n/g, '\n')) {
  const m = /^Bloquant\s*:\s*(\d+)/m.exec(texte);
  const couverture = /^Couverture\s*:\s*(.+)$/m.exec(texte)?.[1].trim();
  const reprises = Number(/^Reprises\s*:\s*(\d+)$/m.exec(texte)?.[1] ?? 0);
  const dependances = /^Dépendances\s*:\s*(.+)$/m.exec(texte)?.[1].trim();
  return { bloquant: m ? Number(m[1]) : null,
    // Sans `Couverture :` la revue est à refaire, même avec `Bloquant :` (T5, P19/S3) : une
    // relecture écrite sur une ligne, au format de la réponse du relecteur, ne passe plus pour complète.
    couverture: m && couverture ? couverture : 'invalide',
    reprises, dependances: dependances === 'libres' ? 'libres' : 'bloquées' };
}

// ── `.question.md` : une session arrêtée sur un choix (P20/S6/T9) ───────────────────────────────────
/** Une réponse « remplie » : autre chose qu'un tiret, des points ou un gabarit `<…>` non rempli. */
const estVide = (v) => v === null || /^[\s—–\-_.…*`]*$/.test(v) || /^<[^>]*>$/.test(v.trim());

/** Lignes d'une section `## <titre>` d'un fichier (jusqu'au titre suivant), sans lignes vides. */
function sectionDe(texte, titre) {
  const lignes = [];
  let dans = false;
  for (const brute of texte.split('\n')) {
    if (/^##\s/.test(brute)) {
      dans = brute.trim().replace(/^##\s+/, '').toLowerCase() === titre.toLowerCase();
      continue;
    }
    if (dans && brute.trim() !== '') lignes.push(brute.replace(/\s+$/, ''));
  }
  return lignes;
}

/** `{ chemin, question, fichier, agent, agentIntrouvable, reponse, options, contexte }` — les lignes
 * mécaniques (`Question :`, `Fichier à relire :`, `Agent :`, `Réponse :`, clés comparées sans casse ni
 * accents comme celles d'un `.echec.md`) et les sections `## Options` / `## Contexte`. `reponse` est
 * `null` tant que la ligne est vide, en tiret ou en gabarit ; une réponse écrite sur plusieurs lignes
 * se lit jusqu'à la première ligne vide, ligne mécanique ou titre. `agent` est `null` pour `—`/absent,
 * `agentIntrouvable` vrai pour `introuvable` (posé par l'orchestrateur quand `SendMessage` échoue). */
function lireQuestion(chemin, relatif) {
  const texte = readFileSync(chemin, 'utf8').replace(/\r\n/g, '\n');
  const valeur = (nom) => valeurDeCle(texte, nom);
  const brutQuestion = valeur('Question');
  const brutFichier = valeur('Fichier à relire');
  const brutAgent = valeur('Agent');
  const sansEmphase = (v) => v.replace(/^[`*]+|[`*]+$/g, '').trim();

  let reponse = valeur('Réponse');
  if (estVide(reponse)) {
    reponse = null;
  } else {
    const lignes = texte.split('\n');
    const i = lignes.findIndex((l) => l.includes(':') && normaliserSimple(l.slice(0, l.indexOf(':'))) === 'reponse');
    const suite = [];
    for (const l of lignes.slice(i + 1)) {
      const cle = /^([A-Za-zÀ-ÿ ]+?)\s*:/.exec(l.trim());
      if (l.trim() === '' || /^##\s/.test(l) || (cle && ['question', 'fichier a relire', 'agent'].includes(normaliserSimple(cle[1])))) break;
      suite.push(l.trim());
    }
    reponse = [sansEmphase(reponse), ...suite].join('\n');
  }

  const agentIntrouvable = brutAgent !== null && normaliserSimple(brutAgent).startsWith('introuvable');
  return {
    chemin: relatif,
    question: estVide(brutQuestion) ? null : une(brutQuestion),
    fichier: estVide(brutFichier) ? null : une(sansEmphase(brutFichier)),
    agent: agentIntrouvable || estVide(brutAgent) ? null : une(sansEmphase(brutAgent)),
    agentIntrouvable,
    reponse,
    options: sectionDe(texte, 'Options'),
    contexte: sectionDe(texte, 'Contexte'),
  };
}

/** Une question dont la session a repris le travail : la réponse est écrite et committée, puis un commit de TÂCHE
 * (`Plan: P<n>/S<k>/T<m>`) suit le dernier commit qui a touché le fichier. La session n'attend plus — même si
 * le fichier est resté en place (aucun outil de suppression sous les autorisations d'un projet : pas de
 * `git rm` dans `permissions.allow`, mesure du scénario `arret-relaye`). Sans cette règle, le moteur rendrait
 * `transmettre` en boucle après le PASS. Fichier modifié non committé, ou jamais committé : l'attente continue. */
function questionConsommee(relatif, id) {
  if (git('status', '--porcelain', '--', relatif)) return false;
  const dernier = git('log', '-1', '--format=%H', '--', relatif);
  if (!dernier) return false;
  const depuis = git('log', `${dernier}..HEAD`, '--format=%B') ?? '';
  return new RegExp(String.raw`Plan:\s*${plan}/${id}/T\d+`).test(depuis);
}

// ── Moteur (S10) — table « la nature décide » de remediation.md, reprise telle quelle ────────────────
// Budget (WORKFLOW.md §9c) : 2 reprises + 1 enquête par session, 2 enquêtes par plan. Vit dans les
// lignes mécaniques d'un .echec.md (survit à une orchestration interrompue). Un .echec.md disparaît
// au PASS (reprendre-echec Étape 5) : les compteurs se lisent donc sur TOUT l'historique git du
// rapport (maximum des valeurs écrites, `lireEchec`), et le total « par plan » somme les maxima de
// tous les `S*.echec.md` ayant existé (`enquetesDuPlan`). Revers assumé : une reprise qui oublie
// d'incrémenter `Tentatives :` reste non comptée — le moteur n'écrit pas encore le compteur (10b, plan 2).

const UN_CRAN_AU_DESSUS = { Haiku: 'Sonnet', Sonnet: 'Opus' };

// Effort lançable depuis un index — `max` en est exclu à dessein : WORKFLOW.md §3 le réserve à
// `/effort max` en session, jamais à une colonne d'index (décision 2026-09-18).
const EFFORTS_LANCABLES = ['low', 'medium', 'high', 'xhigh'];

// ── D2 : appel d'agent prêt à recopier — le script rend `subagent_type`, `model` (minuscules) et
// `effort`, jamais une valeur que l'orchestrateur transforme à la main (docs/decisions/2026-09-22-…). ──
const MODELES_VALIDES = ['Sonnet', 'Opus', 'Haiku'];
const EFFORT_DU_MODELE = { Opus: 'high', Sonnet: 'medium', Haiku: 'medium' };

/** `{ subagent_type, model, effort }` prêt à recopier dans un appel `Agent(...)`, ou `null` si le
 * modèle est hors Sonnet|Opus|Haiku — jamais un `model` inventé. L'effort est passé à l'outil : il
 * prime sur le frontmatter, donc un agent générique suffit. */
function appelAgent(modele, effort) {
  if (!MODELES_VALIDES.includes(modele)) return null;
  return { subagent_type: 'general-purpose', model: modele.toLowerCase(), effort };
}

/** Effort d'une reprise ou d'une relance : celui de la ligne de l'index (il ne change pas quand le
 * modèle monte) ; repli sur la table par modèle si la ligne porte un effort non lançable. */
function effortDeReprise(session, modele) {
  return EFFORTS_LANCABLES.includes(session.effort) ? session.effort : EFFORT_DU_MODELE[modele];
}

/** `{ agent }` à étaler sur une session/action, ou `{ avertissement }` nommant la valeur si le
 * modèle est inconnu — jamais les deux, jamais un `agent` deviné. */
function champAgent(modele, effort) {
  const agent = appelAgent(modele, effort);
  if (agent) return { agent };
  return {
    avertissement: `modèle inconnu ("${modele}") : pas d'appel d'agent composé (Sonnet, Opus ou Haiku attendus)`,
  };
}

// ── D1 : arrêt sur arbre sale dans la zone d'une vague — croisement mécanique fait par le script,
// jamais délégué (docs/decisions/2026-09-22-…). ──────────────────────────────────────────────────
/** Chemins d'une zone = seuls les segments entre backticks de la cellule « Zone modifiée » ; le texte
 * hors backticks ( `(§9a, §9c)`, `(4 fichiers créés)`, `(nouveau)` ) est ignoré. Accolades développées
 * avant comparaison. Segment avec `*`/`**` ou accolades non appariées → zone illisible. */
function cheminsDeZone(cellule) {
  const segments = [...String(cellule || '').matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  const chemins = [];
  for (const seg of segments) {
    const ouvrantes = (seg.match(/\{/g) || []).length;
    const fermantes = (seg.match(/\}/g) || []).length;
    if (seg.includes('*') || ouvrantes !== fermantes) {
      return { chemins: [], illisible: seg };
    }
    if (ouvrantes === 0) {
      chemins.push(seg);
      continue;
    }
    const m = /^(.*)\{([^{}]*)\}(.*)$/.exec(seg);
    if (!m) return { chemins: [], illisible: seg };
    const [, prefixe, options, suffixe] = m;
    for (const option of options.split(',')) chemins.push(`${prefixe}${option.trim()}${suffixe}`);
  }
  return { chemins, illisible: null };
}

/** Chemins bruts depuis `git status --porcelain -z --untracked-files=all` : pas de guillemets, pas de
 * repli `?? dossier/` (chaque fichier d'un dossier non suivi compte individuellement, D1). `null` si
 * `git` échoue — jamais un arbre deviné. Renommage/copie (code X ou Y = R/C) : le chemin d'origine
 * (champ `-z` suivant) compte aussi. */
function fichiersSales(pathspec = []) {
  const sortie = gitBrut('status', '--porcelain', '-z', '--untracked-files=all', ...(pathspec.length > 0 ? ['--', ...pathspec] : []));
  if (sortie === null) return null;
  const bruts = sortie.split('\0').filter((s) => s.length > 0);
  const fichiers = [];
  for (let i = 0; i < bruts.length; i++) {
    const entree = bruts[i];
    fichiers.push(entree.slice(3));
    if (entree[0] === 'R' || entree[0] === 'C') {
      i++;
      if (i < bruts.length) fichiers.push(bruts[i]);
    }
  }
  return fichiers;
}

/** Segment terminé par `/` = dossier → préfixe ; sinon égalité de chemin (D1). */
function cheminToucheZone(chemin, zoneChemin) {
  return zoneChemin.endsWith('/') ? chemin.startsWith(zoneChemin) : chemin === zoneChemin;
}

// ── Relecture selon le risque (P20/S8/T12, revue externe point 8) ────────────────────────────────────
/** Chemins sensibles : un diff qui en touche un est relu même pour une session `low` ou un diff de pur
 * Markdown — le comportement du système y vit. Une constante, pas un texte (décision 2026-10-14, point 8).
 * `dossiers` : préfixes ; `noms` : nom de fichier, où qu'il soit ; `source` : seulement dans le dépôt
 * source (celui qui porte `plugin/`). Les réglages (`settings*.json`) sont déjà sous `.claude/` ; les
 * « fixtures qui définissent les résultats attendus » de la revue ne sont pas ajoutées (non délimitables). */
const CHEMINS_SENSIBLES = {
  dossiers: ['.claude/', '.github/workflows/'],
  noms: [/^CLAUDE\.md$/, /^package\.json$/, /^package-lock\.json$/, /^pnpm-lock\.yaml$/, /^requirements[^/]*\.txt$/, /^pyproject\.toml$/, /^Cargo\.toml$/, /^go\.mod$/],
  source: ['plugin/bin/', 'plugin/hooks/', 'plugin/agents/', 'plugin/skills/', 'plugin/templates/'],
  sourceRacineMd: /^plugin\/[^/]+\.md$/,
};
const FICHIER_N0 = '.claude/n0.json';
const MOTIF_BLOQUANT_MOTEUR = 'Bloquant moteur : n0.json modifié hors zone';

const estDepotSource = () => existsSync(join(RACINE, 'plugin', '.claude-plugin', 'plugin.json'));

function estSensible(chemin, source) {
  const c = chemin.replace(/\\/g, '/');
  if (CHEMINS_SENSIBLES.dossiers.some((d) => c.startsWith(d))) return true;
  if (CHEMINS_SENSIBLES.noms.some((re) => re.test(c.slice(c.lastIndexOf('/') + 1)))) return true;
  if (!source) return false;
  return CHEMINS_SENSIBLES.source.some((d) => c.startsWith(d)) || CHEMINS_SENSIBLES.sourceRacineMd.test(c);
}

/** Les fichiers de `fichiers` qui sont sensibles (ordre conservé, sans doublon). */
function toucheSensible(fichiers, source = estDepotSource()) {
  return [...new Set(fichiers)].filter((f) => estSensible(f, source));
}

/** Fichiers touchés par TOUS les commits `Plan: P<n>/S<k>/` d'une session (pas seulement le dernier). */
function fichiersDeSession(id) {
  const sortie = gitBrut('log', '--format=', '--name-only', '-E', `--grep=^Plan:[[:space:]]*${plan}/${id}/`);
  return sortie === null ? [] : [...new Set(sortie.split('\n').map((l) => l.trim()).filter(Boolean))];
}

/** `n0.json` modifié par un commit de la session alors que sa zone ne le contient pas. Zone `aucune` : hors
 * zone (aucun fichier n'est annoncé). Zone illisible : pas de conclusion (l'arbre sale pose déjà la question). */
function n0HorsZone(zone, fichiers) {
  if (!fichiers.includes(FICHIER_N0)) return false;
  const { chemins, illisible } = cheminsDeZone(zone);
  if (illisible) return false;
  return !chemins.some((c) => cheminToucheZone(FICHIER_N0, c));
}

/** Avant un `lancer` : croise l'arbre non commité avec la zone de chaque session à lancer. `null` si
 * rien à signaler (l'appelant rend `lancer`) ; sinon la `question` à rendre à sa place. */
function arreteSurArbreSale(aLancer, plan) {
  const sales = fichiersSales();
  if (sales === null) {
    return {
      action: 'question',
      motif: 'arbre invérifiable : `git status` a échoué',
      options: { source: 'arbre-sale', motif: 'arbre-inverifiable' },
    };
  }
  const prefixePlan = `plans/${plan}/`;
  for (const s of aLancer) {
    const { chemins, illisible } = cheminsDeZone(s.zone);
    if (illisible) {
      return {
        action: 'question',
        motif: `zone illisible : ${illisible} (${s.session})`,
        options: { source: 'arbre-sale', session: s.session, segment: illisible },
      };
    }
    if (chemins.length === 0) continue; // zone `aucune` (ou vide) : aucun contrôle pour elle
    // Fichiers du plan en cours ignorés, sauf s'ils sont nommés par cette zone (D1).
    const candidats = sales.filter((f) => !f.startsWith(prefixePlan) || chemins.includes(f));
    const touches = candidats.filter((f) => chemins.some((c) => cheminToucheZone(f, c)));
    if (touches.length > 0) {
      return {
        action: 'question',
        motif: `arbre sale dans la zone de ${s.session} : ${touches.join(', ')}`,
        options: { source: 'arbre-sale', session: s.session, fichiers: touches },
      };
    }
  }
  return null;
}

function questionBudget(session, nature = 'reprise') {
  const mot = nature === 'enquete' ? "d'enquête" : 'de reprises';
  return {
    action: 'question',
    motif: `budget ${mot} épuisé sur ${session.session}`,
    options: { source: 'budget-epuise', session: session.session },
  };
}

/** Panne d'environnement : une seule reprise (P20/S3/T5), puis une question — jamais sans options.
 * `liste` est rendue ici, dans le JSON de l'action : le rapport de passation d'un échec d'environnement
 * n'a pas obligatoirement de `## Issues` (gabarit-echec.md), l'orchestrateur n'invente rien. Source
 * `budget-epuise` conservée : c'est celle que l'orchestrateur sait déjà relayer. */
function questionEnvironnement(session, e) {
  const id = session.session;
  const geste = e.blocage ? e.blocage.replace(/\s+/g, ' ').trim() : `voir plans/${plan}/${id}.echec.md`;
  return {
    action: 'question',
    motif: e.blocageRepete
      ? `panne d'environnement identique à la tentative précédente sur ${id} : une seule reprise est permise`
      : `budget de reprises épuisé sur ${id} : une panne d'environnement n'a droit qu'à une reprise`,
    options: {
      source: 'budget-epuise',
      session: id,
      nature: 'environnement',
      blocage: e.blocage ?? null,
      liste: [
        `Régler l'environnement (${geste}), puis relancer — débloque ${id}`,
        `Reprendre la session à la main — débloque ${id}`,
        'Sortir la session du plan — débloque les autres sessions',
      ],
    },
  };
}

/** Une session à lancer porte un effort non lançable — refuser en nommant §3 plutôt que propager
 * un effort que l'outil `Agent` n'accepte pas. */
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

function questionNatureInconnue(session, valeur) {
  return {
    action: 'question',
    motif: `${session.session} : \`Nature :\` non reconnue ("${valeur}") — environnement, exécution, prémisse, filtre ou interruption attendus`,
    options: { source: 'nature-inconnue', session: session.session, valeur },
  };
}

function questionBudgetOpus(session) {
  return {
    action: 'question',
    motif: `remédiation Opus déjà consommée sur ce plan : budget épuisé pour ${session.session}`,
    options: { source: 'budget-opus', session: session.session },
  };
}

/** Décision pour UNE session en échec (table « la nature décide », remediation.md).
 * `remediationOpusDeja` : la ligne `Remédiation Opus :` de l'index (T6, P10/S2) — au plus une passe
 * Opus (reprise ou enquête, session Opus comprise) par plan. */
function remedier(session, enqueteTotalPlan, remediationOpusDeja) {
  const e = session.echec;
  const modeleIndex = session.modele;

  // Valeur de `Nature :` présente mais non reconnue → question avant tout diagnostic (T4, P10/S2).
  if (e.natureInconnue) return questionNatureInconnue(session, e.natureInconnue);

  // Filtre de contenu : nature à part, jamais reprise à l'identique (§9a) — toujours une question,
  // même devant un `Auto : oui · option <m>` déjà posé (T5, P10/S2).
  if (e.nature === 'filtre') {
    return {
      action: 'question',
      motif: `filtre de contenu sur ${session.session} : jamais repris à l'identique`,
      options: { source: 'filtre', session: session.session },
    };
  }

  // `Auto : oui · option <m>` — remède déjà connu, prioritaire sur la nature (C5, WORKFLOW.md §9c).
  const auto = e.auto && /^oui\s*·\s*option\s*(\d+)/i.exec(e.auto);
  if (auto) {
    if (e.tentatives.reprise >= 2) return questionBudget(session);
    return { action: 'reprendre', session: session.session, modele: modeleIndex, option: Number(auto[1]) };
  }

  // Une prémisse réfutée par `verificateur-premisse` (l'orchestrateur a ajouté `Premisse : refutee`
  // au rapport avant de rappeler le script, T5/P10/S2) suit désormais la branche `exécution` : la
  // vraie cause est ailleurs que là où la session l'a cherchée.
  const nature = e.nature === 'prémisse' && e.premisseRefutee ? 'exécution' : e.nature;

  if (nature === 'prémisse') {
    if (e.mesure) {
      const commit = /^(\S+)/.exec(e.mesure)?.[1];
      const existe = commit ? git('cat-file', '-e', commit) !== null : false;
      if (existe) {
        return {
          action: 'question',
          motif: `prémisse prouvée par une mesure commitée sur ${session.session} (${commit})`,
          options: { source: 'etape6', cas: 'premisse-confirmee', session: session.session },
        };
      }
      // Commit cité introuvable : la mesure ne prouve plus rien, retomber sur « sans Mesure ».
    }
    // `verifier-premisse` une fois par session (T4, P19/S3) : le résultat de la vérification est écrit
    // dans le rapport (`Premisse : confirmee|indecidable|refutee · <preuve>`) et jamais revérifié.
    // `refutee` est déjà aiguillée vers `exécution` plus haut.
    const q = (cas, motif) => ({
      action: 'question',
      motif: `${motif} sur ${session.session}`,
      options: { source: 'etape6', cas, session: session.session },
    });
    if (e.premisseStatut === 'confirmee') return q('premisse-confirmee', `prémisse confirmée par verificateur-premisse (${e.premisseBrut})`);
    if (e.premisseStatut === 'indecidable') return q('premisse-indecidable', `prémisse invérifiable par lecture (${e.premisseBrut})`);
    if (e.premisseStatut === 'illisible') return q('premisse-illisible', `ligne \`Premisse :\` non reconnue ("${e.premisseBrut}") — refutee, confirmee ou indecidable attendus`);
    if (e.premisseDejaVerifiee) return q('premisse-deja-verifiee', 'prémisse déjà vérifiée (ligne `Premisse :` présente dans une version commitée du rapport, retirée depuis)');
    // Chemin complété par l'appelant (prochaineAction), qui seul connaît le plan.
    return { action: 'verifier-premisse', session: session.session };
  }

  // Une panne d'environnement n'a droit qu'à UNE reprise (la 2e brûlait le budget sur la même permission,
  // mesure du 2026-10-15) ; un `Blocage :` identique à celui de la tentative précédente vaut une reprise
  // consommée même si le compteur n'a pas été incrémenté.
  if (nature === 'environnement') {
    if (e.tentatives.reprise >= 1 || e.blocageRepete) return questionEnvironnement(session, e);
    return { action: 'reprendre', session: session.session, modele: modeleIndex };
  }

  // `exécution`, prémisse réfutée, ou nature absente (défaut du parseur d'échec — reprendre-echec/
  // SKILL.md « Gabarit »). Décision du 2026-09-24, points 4 et 6 : la 1re reprise tourne sur le
  // modèle de l'index, la 2e un cran au-dessus ; au plus une passe Opus de remédiation par plan
  // (T6, P10/S2).
  let modeleCible;
  let typeAction;
  if (modeleIndex === 'Opus') {
    if (e.blocage) {
      if (e.tentatives.reprise >= 2) return questionBudget(session);
      modeleCible = 'Opus';
      typeAction = 'reprendre';
    } else {
      if (e.tentatives.enquete >= 1 || enqueteTotalPlan >= 2) return questionBudget(session, 'enquete');
      modeleCible = 'Opus';
      typeAction = 'enqueter';
    }
  } else {
    if (e.tentatives.reprise >= 2) return questionBudget(session);
    modeleCible = e.tentatives.reprise >= 1 ? (UN_CRAN_AU_DESSUS[modeleIndex] ?? 'Sonnet') : modeleIndex;
    typeAction = 'reprendre';
  }

  if (modeleCible === 'Opus' && remediationOpusDeja >= 1) return questionBudgetOpus(session);
  return { action: typeAction, session: session.session, modele: modeleCible };
}

/** Chemin d'`EXECUTANT.md` à donner à une session lancée à froid : celui du plugin voisin de ce
 * script (relatif à la racine du dépôt s'il y vit : `plugin/` en source, `.claude/workflow/` vendoré),
 * sinon la variable du plugin. */
function cheminExecutant() {
  const chemin = join(dirname(fileURLToPath(import.meta.url)), '..', 'EXECUTANT.md');
  if (!existsSync(chemin)) return '${CLAUDE_PLUGIN_ROOT}/EXECUTANT.md';
  const rel = relative(RACINE, chemin).replaceAll('\\', '/');
  return rel.startsWith('..') || isAbsolute(rel) ? chemin.replaceAll('\\', '/') : rel;
}

/** Le prompt d'une reprise à froid après une question (`Agent : introuvable`) : il fait lire le fichier
 * et sa réponse. Même forme que les prompts de session de l'orchestrateur. */
function promptRepriseApresQuestion(id, cheminQuestion) {
  return [
    `Lis ${cheminExecutant()} en entier avant ton premier geste : il porte les invariants de lancement.`,
    `Ouvre plans/${plan}/${id}.md et reprends-le : la session s'était arrêtée sur une question, écrite dans ${cheminQuestion}.`,
    "Lis ce fichier : la ligne `Réponse :` est la réponse de l'utilisateur. Le travail déjà fait est dans les commits",
    `\`Plan: ${plan}/${id}/T<m>\` : reprends à partir d'eux, avec cette réponse. Reste dans l'arbre de travail courant : n'ouvre AUCUN worktree.`,
    'Mode orchestré : `/fin-de-tache`, section Mode orchestré — ta dernière ligne est `VERDICT:`.',
    "Tout appel Agent que tu fais porte run_in_background: false, et N0 (n0.mjs) s'exécute au premier plan — et aucune commande n'est détachée.",
    'Ta réponse finale CLÔT ton tour : ce qui finit après elle n\'est lu par personne.',
    `Au PASS, supprime ${cheminQuestion} par un commit si ton outillage le permet (sinon laisse-le : ton commit de tâche suffit). Si tu t'arrêtes de nouveau sur un choix, réécris ce fichier (nouvelle question, \`Réponse : —\`), committe-le, puis rends \`VERDICT: QUESTION\`.`,
    'Réponse finale en UNE ligne, exactement : VERDICT: PASS|FAIL|QUESTION · MOTIF: <une phrase> · RAPPORT: <chemin, ou ->',
  ].join('\n');
}

/** Décision pour UNE session `en-attente` (P20/S6/T9) : jamais `remedier`, jamais un compteur lu ou écrit —
 * un arrêt sur un choix n'est ni une reprise ni une enquête. */
function decisionAttente(session) {
  const q = session.question;
  const id = session.session;
  if (q.reponse === null) {
    return {
      action: 'question',
      motif: `${id} s'est arrêtée sur un choix et attend ta réponse`,
      options: { source: 'attente-reponse', session: id, fichier: q.fichier, chemin: q.chemin },
    };
  }
  if (q.agent) {
    return { action: 'transmettre', session: id, agent: q.agent, message: q.reponse, question: q.chemin };
  }
  const decision = {
    action: 'reprendre',
    session: id,
    modele: session.modele,
    ...champAgent(session.modele, effortDeReprise(session, session.modele)),
    question: q.chemin,
    prompt: promptRepriseApresQuestion(id, q.chemin),
  };
  if (!q.agentIntrouvable) decision.avertissement = `${id} : \`Agent :\` sans identifiant dans ${q.chemin} — reprise à froid`;
  return decision;
}

/** Une action parmi celles de C2, dérivée de l'état déjà assemblé (`sortie`). Ordre des tests (T5,
 * P10/S2, incident ebm-msp 2026-09-24) : rebase, racine introuvable, interruption, `pousser` (arbre propre
 * seulement), le reste inchangé. */
function prochaineAction(sortie) {
  if (sortie.depot.rebase) {
    return {
      action: 'question',
      motif: 'rebase en cours : le résoudre avant de reprendre le plan',
      options: { source: 'rebase' },
    };
  }

  if (sortie.depot.racineIntrouvable) {
    return {
      action: 'question',
      motif: 'racine du dépôt introuvable (worktree lié d\'un dépôt à `.git` déplacé) : reprendre depuis l\'arbre principal',
      options: { source: 'racine-introuvable' },
    };
  }

  // Un plan clos est fini, sessions non cochées comprises : une session abandonnée, ou une preuve
  // dont les statuts vivent sur sa branche jetable, ne se relance pas (clôtures du 2026-10-08).
  if (sortie.clos) return { action: 'fini' };

  const vagues = [...sortie.vagues].sort((a, b) => a.numero - b.numero);

  // Une session interrompue par quota (nature `interruption`) se relance avant tout `pousser`, et
  // ne consomme aucune reprise du budget (décision 2026-09-24, point 7).
  for (const vague of vagues) {
    const membres = vague.sessions.map((id) => sortie.sessions.find((s) => s.session === id)).filter(Boolean);
    const interrompue = membres.find((s) => s.etat === 'echec' && s.echec?.nature === 'interruption');
    if (interrompue) {
      return {
        action: 'relancer-interrompue',
        session: interrompue.session,
        modele: interrompue.modele,
        ...champAgent(interrompue.modele, effortDeReprise(interrompue, interrompue.modele)),
      };
    }
  }

  if (sortie.depot.amont && sortie.depot.amont.avance > 0) {
    if (sortie.depot.arbreSale) {
      return {
        action: 'question',
        motif: 'arbre non commité : impossible de pousser sans perdre ou masquer ce diff',
        options: { source: 'arbre-sale' },
      };
    }
    return { action: 'pousser' };
  }

  if (sortie.preuveN0 && !sortie.clos) {
    const invalide = sortie.sessions.find(s => s.etat === 'faite' && !s.preuve?.ok);
    if (invalide) return { action: 'valider-n0', session: invalide.session,
      motif: invalide.preuve?.motif ?? 'preuve N0 absente' };
  }
  const compromises = (s, visites = new Set()) => {
    if (visites.has(s.session)) return true;
    const suivants = new Set([...visites, s.session]);
    return (s.dependDe.match(/S\d+/g) ?? []).some(id => {
      const dep = sortie.sessions.find(x => x.session === id);
      return !dep || dep.etat !== 'faite' ||
        (dep.revue?.bloquant > 0 && dep.revue.dependances !== 'libres') || compromises(dep, suivants);
    });
  };
  const bloques = [];
  // Enquêtes du plan = somme, sur tous les `S*.echec.md` ayant existé (présents ou supprimés au PASS),
  // du maximum d'`enquete` de chacun (T4, P19/S3) — calculée à l'assemblage, depuis git.
  const enqueteTotalPlan = sortie.enquetesPlan ?? 0;

  for (const vague of vagues) {
    const membres = vague.sessions
      .map((id) => sortie.sessions.find((s) => s.session === id))
      .filter(Boolean);

    // Une session arrêtée sur un choix attend, quoi qu'il reste d'un rapport d'échec antérieur (P20/S6).
    const enAttente = membres.find((s) => s.etat === 'en-attente');
    if (enAttente) return decisionAttente(enAttente);

    const enEchec = membres.find((s) => s.etat === 'echec');
    if (enEchec) {
      if (vague.repriseManuelle) {
        return {
          action: 'question',
          motif: `vague ${vague.numero} marquée reprise-manuelle : arrêt sur l'échec de ${enEchec.session}`,
          options: { source: 'reprise-manuelle', session: enEchec.session },
        };
      }
      const decision = remedier(enEchec, enqueteTotalPlan, sortie.remediationOpus ?? 0);
      if (decision.action === 'verifier-premisse') {
        decision.chemin = `plans/${sortie.plan}/${enEchec.session}.echec.md`;
      }
      if (decision.action === 'reprendre' || decision.action === 'enqueter') {
        Object.assign(decision, champAgent(decision.modele, effortDeReprise(enEchec, decision.modele)));
      }
      if (enEchec.echec.avertissementAuto) {
        decision.avertissement = decision.avertissement
          ? `${decision.avertissement} · ${enEchec.echec.avertissementAuto}`
          : enEchec.echec.avertissementAuto;
      }
      return decision;
    }

    const toutesFaites = membres.every((s) => s.etat === 'faite'); // vrai par défaut si vague sans membre (clôture)
    // Vague entièrement faite : revue (plans stampés `Workflow :` seulement — un plan antérieur à
    // C4/C3 n'a jamais produit de .revue.md, lui en exiger un serait un état deviné), puis
    // validation-humaine.
    if (sortie.workflow) {
      // Une session `low` n'est pas relue (C7) — sauf si elle touche un chemin sensible (P20/S8/T12) —
      // exclue ici, au seul endroit qui décide quoi relire (T3, P7/S2), plutôt que de compter sur
      // la prose du relecteur pour l'appliquer.
      const sansRevue = membres.filter(
        (s) =>
          s.etat === 'faite' &&
          (s.fichiersSensibles.length > 0 ||
            (s.effort !== 'low' && s.zone && s.zone.replace(/`/g, '').trim().toLowerCase() !== 'aucune')) &&
          (!s.revue || s.revue.couverture !== 'complète'),
      );
      if (sansRevue.length > 0) {
        const epuisee = sansRevue.find(s => s.revue && s.revue.reprises >= 1);
        if (epuisee) return { action: 'question', motif: `revue ${epuisee.session} interrompue après une reprise`,
          options: { source: 'revue-incomplete', session: epuisee.session } };
        return {
          action: 'relire',
          vague: vague.numero,
          sessions: sansRevue.map((s) => ({ session: s.session, effort: s.effort, reprise: s.revue ? 1 : 0, sensibles: s.fichiersSensibles })),
        };
      }
    }

    // « validée » (accents/casse libres) dans le libellé de la vague l'acquitte explicitement
    // (T5, P10/S2) — l'acquittement implicite par le démarrage de la vague suivante reste valable.
    if (vague.validationHumaine && !vague.validee &&
        (toutesFaites || (membres.some(s => s.etat === 'faite') &&
          !membres.some(s => s.etat === 'a-lancer' && !compromises(s))))) {
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
    if (!toutesFaites) {
      const candidats = membres.filter((s) => s.etat === 'a-lancer');
      bloques.push(...candidats.filter(comp => compromises(comp)).map(s => s.session));
      const aLancer = candidats.filter(s => !compromises(s));
      if (aLancer.length === 0) continue;
      const effortInvalide = aLancer.find((s) => !EFFORTS_LANCABLES.includes(s.effort));
      if (effortInvalide) return questionEffortInvalide(effortInvalide);
      const questionArbre = arreteSurArbreSale(aLancer, sortie.plan);
      if (questionArbre) return questionArbre;
      // Le mot `pastille` d'une ligne « en clair » : lu, ignoré, signalé (P20/S6) — lancée comme les autres.
      const pastilles = aLancer.filter((s) => s.pastille).map((s) => s.session);
      return {
        action: 'lancer',
        vague: vague.numero,
        sessions: aLancer.map((s) => ({
          session: s.session,
          modele: s.modele,
          effort: s.effort,
          ...champAgent(s.modele, s.effort),
        })),
        ...(pastilles.length > 0
          ? { avertissement: `${pastilles.join(', ')} : marque « pastille » héritée, ignorée — lancée en sous-agent comme les autres` }
          : {}),
      };
    }

    // Sinon : vague déjà validée (explicitement, ou implicitement par le démarrage de la suivante) —
    // continuer.
  }

  // Une session `a-lancer` qui n'appartient à aucune vague ne sera jamais lancée par la boucle
  // ci-dessus : le dire plutôt que rendre `fini` sur un plan qui a encore du travail non ordonnancé
  // (T4, P10/S2).
  const idsDansVagues = new Set(vagues.flatMap((v) => v.sessions));
  const horsVague = sortie.sessions.filter((s) => s.etat === 'a-lancer' && !idsDansVagues.has(s.session));
  if (horsVague.length > 0) {
    return {
      action: 'question',
      motif: `session(s) absente(s) de toute vague de l'Ordonnancement : ${horsVague.map((s) => s.session).join(', ')}`,
      options: { source: 'session-hors-vague', sessions: horsVague.map((s) => s.session) },
    };
  }

  if (bloques.length > 0) return { action: 'question', motif: `prérequis non validés : ${bloques.join(', ')}`,
    options: { source: 'dependance-revue', sessions: bloques } };

  // Clôture (T6, P10/S2, décision 2026-09-24 point 4) : un plan stampé `Workflow :` sans `Clos :`
  // dans l'index revient à l'orchestrateur pour `fin-de-plan.md`, qui pose le marqueur — un plan déjà
  // clos, ou antérieur à C4 (jamais stampé), rend directement `fini`.
  if (sortie.workflow && !sortie.clos) {
    return { action: 'cloturer' };
  }
  return { action: 'fini' };
}

/** Écart `Workflow : v` index ↔ version courante — un avertissement, jamais une action (Étape 4). */
function avertissementVersion(sortie) {
  if (!sortie.workflow) return null;
  try {
    const binDir = dirname(fileURLToPath(import.meta.url));
    const manifestSource = join(binDir, '..', '.claude-plugin', 'plugin.json');
    const racine = racineDepot();
    const manifestVendore = racine ? join(racine, '.claude', 'workflow', 'manifest.json') : null;
    let versionCourante = null;
    if (existsSync(manifestSource)) {
      versionCourante = JSON.parse(readFileSync(manifestSource, 'utf8')).version;
    } else if (manifestVendore && existsSync(manifestVendore)) {
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

// ── Textes finaux (P20/S5/T8, point 10a de la revue externe du 2026-10-13) ───────────────────────────
// Chaque action porte un champ `texte` : le texte FINAL à relayer tel quel (annonce de vague, question
// avec ses options, rapport final). Le moteur ne connaît que le disque et git, il ne rédige que ce
// qu'il peut lire : les `subagent_tokens` et les motifs rendus dans la conversation ne sont pas sur
// disque — le texte le dit (« à compléter par l'orchestrateur ») plutôt que d'inventer une valeur.
// La PREMIÈRE ligne reste celle d'avant (`<action> — …`) : c'est ce que lisent `noter.mjs` et les mods.
// Les gabarits sont ceux de `orchestrer-plan/SKILL.md` (Étapes 1 et 3), déplacés ici sans changement
// de forme ; S12 réduira la skill à « relaie `texte` ».

/** Espaces et retours à la ligne ramenés à un seul espace — une phrase d'index écrite sur plusieurs
 * lignes se relaie sur une seule, mot pour mot. */
const une = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

function premiereLigne(action) {
  switch (action.action) {
    case 'lancer':
      return `lancer — vague ${action.vague} : ${action.sessions.map((s) => s.session).join(', ') || '—'}`;
    case 'verifier-premisse':
      return `verifier-premisse — ${action.session}`;
    case 'reprendre':
      return `reprendre — ${action.session} (${action.modele}${action.option ? ` · option ${action.option}` : ''})`;
    case 'enqueter':
      return `enqueter — ${action.session} (${action.modele})`;
    case 'transmettre':
      return `transmettre — ${action.session}`;
    case 'relancer-interrompue':
      return `relancer-interrompue — ${action.session} (${action.modele})`;
    case 'relire':
      return `relire — vague ${action.vague} : ${action.sessions.map((s) => s.session).join(', ')}`;
    case 'valider-n0':
      return `valider-n0 — ${action.session}`;
    case 'validation-humaine':
      return `validation-humaine — vague ${action.vague}`;
    case 'question':
      return `question — ${action.motif}`;
    default: // pousser, fini, cloturer : une ligne nue, comme avant
      return action.action;
  }
}

// ── Prose de l'Ordonnancement : *Pourquoi maintenant* et lignes « en clair » COMPLÈTES ───────────────
// Le lecteur d'index (`lire-index.mjs`) ne garde que la première ligne d'une phrase « en clair » et
// ignore le *Pourquoi maintenant* ; un index réel les écrit sur plusieurs lignes (plans/P20/index.md).
// Relayer une phrase coupée serait la relayer fausse : ce balayage reprend la prose, et elle seule.
// Table, vagues et statuts restent lus par le lecteur unique.
function lireProse(texte) {
  const vagues = new Map(); // numero → { pourquoi, enClair: { S<k>: texte } }
  let dans = false;
  let vague = null;
  let cible = null; // { objet, cle } : où se prolonge une ligne de continuation
  for (const brute of String(texte ?? '').replace(/\r\n/g, '\n').split('\n')) {
    const l = brute.trim();
    if (/^##\s+Ordonnancement/.test(l)) { dans = true; continue; }
    if (dans && /^##\s+/.test(l)) break;
    if (!dans) continue;
    const v = /^(?:-\s*)?\*\*Vague\s+(\d+)/.exec(l);
    if (v) {
      vague = { pourquoi: '', enClair: {} };
      vagues.set(Number(v[1]), vague);
      cible = null;
      continue;
    }
    if (!vague) continue;
    const p = /^\*Pourquoi maintenant\*\s*:\s*(.*)$/.exec(l);
    if (p) { vague.pourquoi = p[1]; cible = { objet: vague, cle: 'pourquoi' }; continue; }
    const s = /^-\s*\*\*(S\d+)\*\*\s*[—-]\s*(.*)$/.exec(l);
    if (s) { vague.enClair[s[1]] = s[2]; cible = { objet: vague.enClair, cle: s[1] }; continue; }
    if (l === '' || l.startsWith('- ')) { cible = null; continue; }
    if (cible) cible.objet[cible.cle] += ` ${l}`;
  }
  for (const v of vagues.values()) {
    v.pourquoi = une(v.pourquoi);
    for (const k of Object.keys(v.enClair)) v.enClair[k] = une(v.enClair[k]);
  }
  return { vagues };
}

const idsDeDependance = (s) => s.dependDe.match(/S\d+/g) ?? [];
const sessionDe = (sortie, id) => sortie.sessions.find((x) => x.session === id);

// ── Annonce de vague (Étape 1 de la skill) ───────────────────────────────────────────────────────────
function texteLancer(action, sortie, prose) {
  const vagues = [...sortie.vagues].sort((a, b) => a.numero - b.numero);
  const vague = vagues.find((v) => v.numero === action.vague);
  const suivante = vagues.find((v) => v.numero === action.vague + 1);
  const proseVague = prose.vagues.get(action.vague);
  const sansClair = [];
  const out = [];
  out.push(`▶ Vague ${action.vague}/${vagues.length} — ${action.sessions.length} session(s)`);
  out.push(`   Pourquoi cette vague maintenant : ${proseVague?.pourquoi || "(non renseigné dans l'index)"}`);
  out.push(
    `   Si une session échoue : ${
      vague?.repriseManuelle
        ? "reprise manuelle — je m'arrête et je te rends la main"
        : "je diagnostique, je reprends une fois, j'enquête si la reprise cale — je ne te sollicite que s'il y a un choix à faire, et sous forme de question"
    }`,
  );
  out.push(
    `   Fin de vague : ${
      vague?.validationHumaine
        ? 'validation humaine — je m\'arrête pour ton jugement'
        : suivante
          ? `j'enchaîne sur la vague ${suivante.numero}`
          : 'je passe à la clôture du plan'
    }`,
  );
  for (const { session: id } of action.sessions) {
    const s = sessionDe(sortie, id);
    const clair = proseVague?.enClair[id];
    out.push('');
    out.push(`   ${id} · ${s?.titre ?? ''}`);
    if (clair) out.push(`      En clair : ${une(clair)}`);
    else sansClair.push(id);
    out.push(`      Tâches ${s?.taches ?? '—'} · ${s?.modele ?? '?'}/${s?.effort ?? '?'}`);
    const ids = s ? idsDeDependance(s) : [];
    const passees = ids.length > 0 && ids.every((d) => sessionDe(sortie, d)?.etat === 'faite');
    const dep = ids.length === 0 ? '—' : `${ids.join(', ')}${passees ? `, déjà passée${ids.length > 1 ? 's' : ''}` : ''}`;
    out.push(`      Fichiers touchés : ${s?.zone ?? '—'} · Dépend de : ${dep}`);
  }
  out.push('');
  out.push('   Pendant que ça tourne : ne pas modifier les fichiers listés — les sessions y écrivent.');
  out.push(`   À la fin : un commit par tâche, retrouvable par son repère \`Plan: ${sortie.plan}/S<k>/T<m>\`.`);
  if (sansClair.length > 0) {
    out.push(`   Index sans ligne « en clair » pour ${sansClair.join(', ')} : annoncé sans elle, jamais inventée.`);
  }
  return out.join('\n');
}

// ── `## Issues` d'un rapport d'échec : les options, recopiées ligne à ligne ──────────────────────────
const CLES_MECANIQUES = ['nature', 'tentatives', 'blocage', 'mesure', 'auto', 'premisse'];

/** `{ lignes, recommandation }` — `lignes` : les lignes de la section `## Issues`, sans rien changer ;
 * `recommandation` : le texte d'une ligne « Recommandation : … » si le rapport en porte une. La section
 * s'arrête au titre suivant, ou à une ligne mécanique (`Premisse :` est ajoutée EN FIN de fichier par
 * l'orchestrateur, après les issues — elle n'est pas une option). Rapport absent ou sans section :
 * `{ lignes: [], recommandation: null }`. */
function lireIssues(id) {
  const chemin = join(RACINE, 'plans', plan, `${id}.echec.md`);
  if (!existsSync(chemin)) return { lignes: [], recommandation: null };
  const lignes = [];
  let recommandation = null;
  let dans = false;
  for (const brute of readFileSync(chemin, 'utf8').replace(/\r\n/g, '\n').split('\n')) {
    if (/^##\s+Issues\s*$/i.test(brute.trim())) { dans = true; continue; }
    if (!dans) continue;
    if (/^##\s/.test(brute)) break;
    const cle = /^([A-Za-zÀ-ÿ ]+?)\s*:/.exec(brute.trim());
    if (cle && CLES_MECANIQUES.includes(normaliserSimple(cle[1]))) break;
    const reco = /^(?:ma\s+)?recommandation\s*:\s*(.*)$/i.exec(brute.trim());
    if (reco) { recommandation = reco[1].trim(); continue; }
    if (brute.trim() !== '') lignes.push(brute.replace(/\s+$/, ''));
  }
  return { lignes, recommandation };
}

// ── Questions (Étape 3 de la skill) : une entrée par `options.source` ────────────────────────────────
const REPLI_SESSION = (id) => [
  `Reprendre la session à la main — débloque ${id}`,
  'Sortir la session du plan — débloque les autres sessions',
];
const ARBRE_SALE_FICHIERS = [
  'Committer ces fichiers toi-même, puis relancer — débloque la vague',
  'Les mettre de côté (git stash), puis relancer — débloque la vague, tes changements restent récupérables',
  'Sortir la session concernée de la vague (index) — débloque les autres sessions',
];
const ARBRE_SALE_ZONE = [
  'Réécrire ce segment en chemins explicites dans l\'index, puis relancer — débloque la vague',
  'Sortir la session concernée de la vague (index) — débloque les autres sessions',
];

/** Sources dont la question vise le plan entier, pas une session : rien ne reste lançable sans
 * décider, et l'en-tête de la question ne porte pas de `S<k>`. */
const SOURCES_PLAN = ['rebase', 'racine-introuvable', 'historique-partiel', 'session-hors-vague', 'boucle-appliquer', 'ecriture-echec'];

/** `{ question, options, graines, rapport }` pour une `question` du moteur, ou `null` si la source est
 * inconnue (l'appelant rend alors l'option unique « mettre à jour le workflow »). `options` : listes
 * fixes de la skill (arbre-sale, zone illisible, revue-incomplete, dependance-revue), `liste` de S3
 * (panne d'environnement), sinon un repli dont chaque première ligne reprend le motif du moteur ; la
 * section `## Issues` du rapport, quand il y en a une, les remplace (`redigerQuestion`). */
function definirQuestion(action, sortie) {
  const o = action.options ?? {};
  const id = o.session ?? null;
  const ids = o.sessions ?? [];
  const nomsIds = ids.join(', ');
  switch (o.source) {
    case 'boucle-appliquer':
      return {
        question: `Le moteur a enchaîné ${o.tours} gestes sans atteindre une action pour un agent ou pour toi : que fait-on ?`,
        options: [
          "Relancer le moteur (`--appliquer`) : chaque appel repart de l'état du disque — débloque le plan si la cause était passagère",
          "Lire l'état (`prochaine-action.mjs P<n> --etat`) et déposer un incident du workflow (§9b, nature `orchestration`) si le moteur tourne en rond — débloque le plan une fois le défaut corrigé",
        ],
        graines: [],
      };
    case 'ecriture-echec':
      return {
        question: `Une écriture du moteur a échoué (${o.geste}) : que fait-on ?`,
        options: [
          `Régler la cause (${o.detail}), puis relancer — l'état est celui du disque, rien n'est à défaire — débloque le plan`,
        ],
        graines: [],
      };
    case 'rebase':
      if (o.abandonne) {
        return {
          question: 'Le rebase de tes commits sur ceux du dépôt distant a rencontré un conflit et a été abandonné : que fait-on ?',
          options: ['Réconcilier à la main (`git pull --rebase`, régler les conflits, `git rebase --continue`), puis relancer — débloque le plan'],
          graines: [],
        };
      }
      return {
        question: 'Un rebase est en cours : comment le résoudre avant de reprendre le plan ?',
        options: ['Résoudre le rebase à la main (`git rebase --abort`, ou `--continue` une fois les conflits réglés), puis relancer — débloque le plan'],
        graines: [],
      };
    case 'racine-introuvable':
      return {
        question: "La racine du dépôt est introuvable : depuis où reprendre le plan ?",
        options: ["Reprendre depuis l'arbre principal du dépôt (pas depuis ce worktree lié), puis relancer — débloque le plan"],
        graines: [],
      };
    case 'historique-partiel':
      return {
        question: "L'historique git du clone est partiel et n'a pas pu être complété : que fait-on ?",
        options: ['Lancer `git fetch --unshallow` à la main, puis relancer — débloque le plan'],
        graines: [],
      };
    case 'arbre-sale':
      if (o.motif === 'arbre-inverifiable') {
        return {
          question: 'Git ne répond pas dans ce dépôt : que fait-on ?',
          options: ['Vérifier git dans ce dépôt, puis relancer — débloque la vague'],
          graines: id ? [id] : [],
        };
      }
      if (o.segment) {
        return {
          question: `La zone modifiée de ${id} ne se lit pas (« ${o.segment} ») : que fait-on ?`,
          options: ARBRE_SALE_ZONE,
          graines: id ? [id] : [],
        };
      }
      if (id) {
        return {
          question: `Des fichiers non commités recoupent la zone de ${id} : que fait-on ?`,
          options: ARBRE_SALE_FICHIERS,
          graines: [id],
        };
      }
      return {
        question: 'Des fichiers non commités empêchent de pousser : que fait-on ?',
        options: [
          'Committer ces fichiers toi-même, puis relancer — débloque le push',
          'Les mettre de côté (git stash), puis relancer — débloque le push, tes changements restent récupérables',
        ],
        graines: [],
      };
    case 'budget-epuise':
      return {
        question: o.nature === 'environnement'
          ? `Une panne d'environnement bloque ${id} : que fait-on ?`
          : `Le budget de reprises ou d'enquête de ${id} est épuisé : que fait-on ?`,
        options: Array.isArray(o.liste) && o.liste.length > 0 ? o.liste : REPLI_SESSION(id),
        graines: [id],
      };
    case 'budget-opus':
      return {
        question: `La remédiation Opus du plan est déjà consommée : que fait-on pour ${id} ?`,
        options: REPLI_SESSION(id),
        graines: [id],
      };
    case 'effort-invalide':
      return {
        question: `L'effort de ${id} ("${o.effort}") ne se lance pas depuis l'index : que fait-on ?`,
        options: [
          `Corriger la colonne Effort de ${id} dans l'index (low, medium, high ou xhigh), puis relancer — débloque ${id}`,
          'Sortir la session du plan — débloque les autres sessions',
        ],
        graines: [id],
      };
    case 'nature-inconnue':
      return {
        question: `La ligne \`Nature :\` du rapport de ${id} n'est pas reconnue ("${o.valeur}") : que fait-on ?`,
        options: [
          `Corriger la ligne \`Nature :\` de plans/${plan}/${id}.echec.md (environnement, exécution, prémisse, filtre ou interruption), puis relancer — débloque ${id}`,
          ...REPLI_SESSION(id),
        ],
        graines: [id],
      };
    case 'filtre':
      return {
        question: `Un filtre de contenu a arrêté ${id} : que fait-on ?`,
        options: [
          `Reformuler la tâche qui déclenche le filtre dans plans/${plan}/${id}.md, puis relancer — débloque ${id}`,
          ...REPLI_SESSION(id),
        ],
        graines: [id],
      };
    case 'etape6': {
      const phrases = {
        'premisse-confirmee': `Le constat de ${id} est confirmé : le plan repose sur une prémisse fausse — que fait-on ?`,
        'premisse-indecidable': `La prémisse de ${id} ne se vérifie pas par lecture : que fait-on ?`,
        'premisse-illisible': `La ligne \`Premisse :\` du rapport de ${id} est illisible : que fait-on ?`,
        'premisse-deja-verifiee': `La prémisse de ${id} a déjà été vérifiée, sans issue écrite : que fait-on ?`,
      };
      const premiere = {
        'premisse-confirmee': `Réviser le plan pour tenir compte de ce constat (\`/cadrer\`, puis \`/nouveau-plan\`), puis relancer — débloque ${id}`,
        'premisse-indecidable': `Sonder la prémisse à la main (une mesure commitée), puis relancer — débloque ${id}`,
        'premisse-illisible': `Corriger la ligne \`Premisse :\` du rapport (refutee, confirmee ou indecidable), puis relancer — débloque ${id}`,
        'premisse-deja-verifiee': `Réviser le plan pour tenir compte de ce constat (\`/cadrer\`, puis \`/nouveau-plan\`), puis relancer — débloque ${id}`,
      };
      const cas = phrases[o.cas] ? o.cas : 'premisse-confirmee';
      return {
        question: phrases[cas],
        options: [premiere[cas], ...REPLI_SESSION(id)],
        graines: [id],
      };
    }
    case 'reprise-manuelle':
      return {
        question: `La vague est en reprise manuelle et ${id} a échoué : que fait-on ?`,
        options: [
          `Reprendre ${id} à la main (rapport : plans/${plan}/${id}.echec.md), puis relancer — débloque ${id}`,
          'Sortir la session du plan — débloque les autres sessions',
        ],
        graines: [id],
      };
    case 'revue-incomplete':
      return {
        question: `La revue de ${id} est restée incomplète après une reprise : que fait-on ?`,
        options: [
          `Terminer la revue de ${id} à la main (plans/${plan}/${id}.revue.md : \`Bloquant :\` et \`Couverture : complète\`), puis relancer — débloque la vague suivante`,
          `Reporter le plan — la revue de ${id} reste interrompue, sa couverture n'est pas annoncée complète`,
        ],
        graines: [id],
        rapport: `plans/${plan}/${id}.revue.md`,
      };
    case 'dependance-revue': {
      const bloquantes = new Set();
      const remonter = (s, vus = new Set()) => {
        for (const d of idsDeDependance(s)) {
          if (vus.has(d)) continue;
          vus.add(d);
          const dep = sessionDe(sortie, d);
          if (!dep) continue;
          if (dep.etat === 'faite' && dep.revue?.bloquant > 0 && dep.revue.dependances !== 'libres') bloquantes.add(d);
          remonter(dep, vus);
        }
      };
      for (const r of ids) { const s = sessionDe(sortie, r); if (s) remonter(s); }
      const sources = [...bloquantes];
      return {
        question: `Les prérequis de ${nomsIds} ont des bloquants de revue non triés : que fait-on ?`,
        options: [
          `Corriger le prérequis${sources.length > 1 ? 's' : ''} ${sources.join(', ') || '(voir sa revue)'} (bloquants de sa revue), puis relancer — débloque ${nomsIds}`,
          `Réviser explicitement la dépendance dans l'index (colonne Dépend de), preuve à l'appui — débloque ${nomsIds}`,
        ],
        graines: [], // les sessions en attente ne sont pas des graines : leurs dépendances les bloquent déjà
        rapport: sources.length > 0 ? `plans/${plan}/${sources[0]}.revue.md` : null,
        attente: ids,
      };
    }
    case 'attente-reponse': {
      // Le fichier de la session : ses lignes d'options sont recopiées, numérotées seulement si elles ne le sont pas.
      const q = sessionDe(sortie, id).question;
      const numerotees = q.options.some((l) => /^\s*\d+[.)]\s/.test(l));
      return {
        question: q.question ?? `${id} attend ta réponse`,
        options: q.options.length === 0
          ? ['Répondre par écrit — la session reprend avec ta réponse']
          : q.options.map((l) => l.trimEnd()),
        dejaNumerotees: q.options.length > 0 && numerotees,
        contexte: q.contexte,
        graines: [id],
        rapport: q.fichier ?? q.chemin,
      };
    }
    case 'session-hors-vague':
      return {
        question: `Des sessions ne sont dans aucune vague de l'Ordonnancement (${nomsIds}) : que fait-on ?`,
        options: [
          `Ajouter ${nomsIds} à une vague de l'Ordonnancement de l'index, puis relancer — débloque ${nomsIds}`,
          `Sortir ${nomsIds} du plan — débloque la fin du plan`,
        ],
        graines: [],
      };
    default:
      return null;
  }
}

/** Sessions encore lançables sans que l'utilisateur tranche : non faites, sans échec, dont AUCUNE
 * dépendance — directe ou transitive — n'est une session bloquée (`graines`), en échec, ou une
 * faite à bloquants de revue non libres. `null` si l'état des sessions est inconnu. */
function resteLancable(sortie, graines) {
  if (!sortie?.sessions?.every((s) => s.etat)) return null;
  const memo = new Map();
  const bloque = (s, pile = new Set()) => {
    if (memo.has(s.session)) return memo.get(s.session);
    if (pile.has(s.session)) return true;
    const pile2 = new Set([...pile, s.session]);
    let r = graines.includes(s.session) || s.etat === 'echec';
    if (!r) {
      r = idsDeDependance(s).some((d) => {
        const dep = sessionDe(sortie, d);
        if (!dep) return true;
        if (graines.includes(d)) return true;
        if (dep.etat === 'faite') return dep.revue?.bloquant > 0 && dep.revue.dependances !== 'libres';
        return bloque(dep, pile2);
      });
    }
    memo.set(s.session, r);
    return r;
  };
  return sortie.sessions.filter((s) => s.etat === 'a-lancer' && !bloque(s)).map((s) => s.session);
}

/** `❓ P<n>/S<k> — …` : la question au format imposé, options comprises. Source ou action inconnue :
 * option unique « mettre à jour le workflow » (le moteur la rédige lui-même, la skill n'a plus à la
 * décrire). */
function redigerQuestion(action, sortie) {
  const o = action.options ?? {};
  let def = definirQuestion(action, sortie);
  let inconnue = false;
  if (!def) {
    inconnue = true;
    def = {
      question: `Le moteur rend une source de question inconnue (${o.source ?? action.action}) : que fait-on ?`,
      options: ['Mettre à jour le workflow (`/maj-workflow`), puis relancer — débloque le plan'],
      graines: [],
    };
  }
  const id = o.session ?? (o.sessions ?? [])[0] ?? null;
  const issues = o.session && !inconnue ? lireIssues(o.session) : { lignes: [], recommandation: null };
  // Listes FIXES de la skill (arbre-sale, revue-incomplete, dependance-revue) : jamais remplacées par
  // un rapport d'échec qui n'a pas ces options en vue. Le reste : `## Issues` du rapport si elle existe.
  const attente = o.source === 'attente-reponse'; // options écrites par la session elle-même, dans son `.question.md`
  const fixes = attente || ['arbre-sale', 'revue-incomplete', 'dependance-revue'].includes(o.source);
  const delIssues = !fixes && issues.lignes.length > 0;
  const options = delIssues
    ? issues.lignes
    : def.dejaNumerotees ? def.options : def.options.map((opt, i) => `${i + 1}. ${opt}`);

  const sessionEnTete = id ? `${plan}/${id}` : plan;
  const echecChemin = o.session && !attente && existsSync(join(RACINE, 'plans', plan, `${o.session}.echec.md`))
    ? `plans/${plan}/${o.session}.echec.md`
    : null;
  const rapport = def.rapport ?? echecChemin ?? '—';

  let reste;
  if (o.session && !SOURCES_PLAN.includes(o.source) || def.attente) {
    const liste = resteLancable(sortie, def.graines);
    reste = liste === null ? "inconnu (l'état des sessions n'a pas pu être lu)" : liste.length > 0 ? liste.join(', ') : 'rien';
  } else {
    reste = 'rien';
  }

  const out = [];
  out.push(`❓ ${sessionEnTete} — ${def.question}`);
  out.push(`   Pourquoi je m'arrête ici : ${action.motif}`);
  for (const l of def.contexte ?? []) out.push(`     ${l.trim()}`);
  if (echecChemin) {
    const blocage = valeurDeCle(readFileSync(join(RACINE, echecChemin), 'utf8').replace(/\r\n/g, '\n'), 'Blocage');
    if (blocage && !action.motif.includes(blocage)) out.push(`     Blocage noté dans le rapport : ${une(blocage)}`);
  }
  out.push('');
  for (const l of options) out.push(`   ${l}`);
  // Pas de `## Issues` : options de repli du moteur — dit une fois, jamais présentées comme celles
  // d'une enquête (la skill demandait de le dire quand la section manque).
  if (echecChemin && !delIssues && !fixes && !inconnue) {
    out.push("   (le rapport n'a pas de section `## Issues` : options de repli du moteur)");
  }
  out.push('');
  if (attente) out.push(`   Réponds par le numéro d'une option ou en une phrase : ta réponse est écrite dans ${o.chemin}, puis transmise à ${id}, qui reprend avec tout ce qu'elle avait lu.`);
  if (delIssues && issues.recommandation) {
    out.push(`   Ma recommandation : ${issues.recommandation.replace(/^(?:ma\s+)?recommandation\s*:\s*/i, '')}`);
  }
  out.push(`   Rapport : ${rapport} · reste lançable sans décider : ${reste}`);
  if (inconnue) out.push("   Une action ou une source inconnue du moteur est un incident du workflow (§9b, nature `orchestration`).");
  return out.join('\n');
}

// ── Rapport final (`fini`) : tiré du disque ──────────────────────────────────────────────────────────
function incidentsDuPlan() {
  const dossier = join(RACINE, 'docs', 'workflow', 'incidents');
  if (!existsSync(dossier)) return [];
  const motif = new RegExp(`\\bPlan\\s*:\\s*${plan}\\b`);
  return readdirSync(dossier)
    .filter((f) => f.endsWith('.md'))
    .filter((f) => motif.test(readFileSync(join(dossier, f), 'utf8').split('\n').slice(0, 15).join('\n')))
    .sort()
    .map((f) => `docs/workflow/incidents/${f}`);
}

/** Les `N1 S<k> : à faire — <écran>` consignés dans le bilan de session d'un `S<k>.md`. */
function n1ALfaire(id) {
  const chemin = join(RACINE, 'plans', plan, `${id}.md`);
  if (!existsSync(chemin)) return [];
  const texte = readFileSync(chemin, 'utf8').replace(/\r\n/g, '\n');
  const debut = texte.search(/^##\s+Bilan de session/m);
  if (debut < 0) return [];
  const trouves = [];
  for (const l of texte.slice(debut).split('\n')) {
    const m = /^\W*N1(?:\s+S\d+)?\s*:\s*à faire\s*[—-]\s*(.+?)\s*$/i.exec(l);
    if (m && !m[1].startsWith('<')) trouves.push(`N1 ${id} : à faire — ${m[1]}`);
  }
  return trouves;
}

function texteFini(action, sortie) {
  const out = [];
  out.push(`Plan ${sortie.plan} — rapport final (${sortie.sessions.length} session(s))`);
  const n1 = [];
  for (const s of sortie.sessions) {
    const statut = s.etat === 'faite' ? 'PASS' : s.etat === 'echec' ? 'FAIL' : 'non faite (plan clos)';
    const chemin = `plans/${sortie.plan}/${s.session}.echec.md`;
    const textes = versionsCommitees(chemin);
    if (existsSync(join(RACINE, chemin))) textes.push(readFileSync(join(RACINE, chemin), 'utf8').replace(/\r\n/g, '\n'));
    const t = maxTentatives(textes);
    const reprises = [
      t.reprise > 0 ? `${t.reprise} reprise(s)` : null,
      t.enquete > 0 ? `${t.enquete} enquête(s)` : null,
    ].filter(Boolean);
    let revue;
    const fichierRevue = `plans/${sortie.plan}/${s.session}.revue.md`;
    if (s.revue) {
      if (s.revue.bloquant === null) revue = 'revue illisible';
      else if (s.revue.bloquant > 0) {
        revue = `revue : ${s.revue.bloquant} bloquant(s)${existsSync(join(RACINE, fichierRevue)) ? ` → ${fichierRevue}` : ' (revue rangée au tri de clôture)'}`;
      } else revue = 'revue : 0 bloquant';
    } else if (!sortie.workflow) revue = 'revue : — (plan antérieur à la revue)';
    else if (!(s.fichiersSensibles?.length > 0) && (s.effort === 'low' || !s.zone || s.zone.replace(/`/g, '').trim().toLowerCase() === 'aucune')) revue = 'revue : sautée (low ou zone aucune)';
    else revue = 'revue : absente';
    out.push(`   ${s.session} · ${statut} · ${s.titre}${reprises.length ? ` · ${reprises.join(' + ')}` : ''} · ${revue}`);
    n1.push(...n1ALfaire(s.session));
  }
  const incidents = incidentsDuPlan();
  out.push(`   Incidents du plan : ${incidents.length > 0 ? incidents.join(', ') : 'aucun'}`);
  if (n1.length > 0) for (const l of n1) out.push(`   ${l}`);
  else out.push('   N1 : rien à faire');
  out.push('   Tokens : à compléter par l\'orchestrateur (une ligne `subagent_tokens` par session — absents du disque).');
  return out.join('\n');
}

// ── Les autres actions : une ligne, et ce qu'elle demande ────────────────────────────────────────────
function texteSimple(action, sortie) {
  const nomPlan = sortie?.plan ?? plan;
  const l = [];
  switch (action.action) {
    case 'verifier-premisse':
      l.push(`   Vérifier l'affirmation de « Ce qu'il faudrait pour que ça passe » de ${action.chemin}.`);
      break;
    case 'reprendre':
      if (action.question) {
        l.push(`   ${action.session} s'était arrêtée sur une question et son agent est introuvable : reprise à froid sur ${action.modele}, hors budget (ni reprise ni enquête décomptée).`);
        l.push(`   Lancer l'agent avec le \`prompt\` ci-dessous : il fait lire ${action.question} et la réponse qu'il porte.`);
        l.push('   --- prompt ---');
        for (const ligne of action.prompt.split('\n')) l.push(`   ${ligne}`);
        l.push('   --- fin du prompt ---');
        break;
      }
      l.push(`   Reprise de ${action.session} sur ${action.modele}${action.option ? `, option ${action.option} de la section ## Issues` : ''}.`);
      break;
    case 'transmettre':
      l.push(`   ${action.session} attend sa réponse : l'envoyer à l'agent ${action.agent} par SendMessage, \`message\` tel quel (hors budget : ni reprise ni enquête décomptée) :`);
      for (const ligne of action.message.split('\n')) l.push(`   > ${ligne}`);
      l.push(`   Envoi en échec (agent introuvable, session fermée) : écrire \`Agent : introuvable\` dans ${action.question}, committer ce fichier, rappeler le moteur — il rend alors la reprise à froid.`);
      break;
    case 'enqueter':
      l.push(`   Enquête en lecture seule sur ${action.session} (${action.modele}).`);
      break;
    case 'relancer-interrompue':
      l.push(`   ${action.session} a été coupée par un quota : la relancer, hors budget de reprises.`);
      break;
    case 'relire':
      l.push(`   Relecture de ${action.sessions.map((s) => `${s.session} (effort ${s.effort}${s.reprise ? ', reprise' : ''})`).join(', ')}.`);
      for (const s of action.sessions.filter((x) => x.sensibles?.length > 0)) {
        l.push(`   ${s.session} touche des chemins sensibles : ${s.sensibles.join(', ')} — à relire même si la session est \`low\` ou si le diff est du Markdown ; le relecteur ne saute pas leur diff.`);
      }
      break;
    case 'valider-n0':
      l.push(`   La preuve N0 de ${action.session} manque ou est invalide : ${action.motif}.`);
      break;
    case 'pousser':
      l.push('   Des commits locaux ne sont pas poussés : `git pull --rebase`, puis `git push`.');
      break;
    case 'cloturer':
      l.push('   Toutes les sessions sont faites : dérouler la clôture du plan (`fin-de-tache/references/fin-de-plan.md`).');
      if (action.reste) {
        const r = action.reste;
        l.push('   Le moteur a fait les points 1, 2 et 3 (rien de non commité côté revues et incidents, marqueurs nettoyés). Reste, à toi :');
        l.push(r.revues.length > 0 || r.bloquants.length > 0
          ? `   - point 4 : verser dans TASKS.md puis supprimer, dans le même commit, ${r.revues.length > 0 ? r.revues.join(', ') : 'aucune revue'} ; \`[x]!\` à repasser à \`[x]\` : ${r.bloquants.length > 0 ? r.bloquants.join(', ') : 'aucun'}`
          : '   - point 4 : aucune revue à trier, aucun `[x]!`');
        l.push('   - point 6 : ranger le contexte (`PROJECT_BRIEF.md`, `TASKS.md`, `STATUS.md`, points N2 dans `VALIDATION.md`)');
        if (r.sales.length > 0) l.push(`   - fichiers encore non commités (à rattacher à leur session, jamais balayés dans un commit fourre-tout) : ${r.sales.join(', ')}`);
        l.push(`   Puis rappeler : \`${action.rappel}\` — le moteur pose \`Clos : <date>\` (point 5), pousse (point 7) et rend le rapport final.`);
      }
      break;
    case 'validation-humaine': {
      const v = sortie?.vagues.find((x) => x.numero === action.vague);
      const noms = (v?.sessions ?? []).map((id) => {
        const s = sessionDe(sortie, id);
        return s ? `${id} (${s.titre})` : id;
      });
      l.push(`   La vague ${action.vague} (${noms.join(', ') || '—'}) attend ton jugement : aucune mesure ne le remplace.`);
      l.push(`   Au « oui » : ajouter \`· validée\` au libellé de la vague ${action.vague} dans plans/${nomPlan}/index.md, committer, pousser, puis relancer.`);
      break;
    }
    default:
      break;
  }
  return l;
}

/** Le champ `texte` d'une action : première ligne inchangée, puis le texte final à relayer.
 * `sortie` : l'état assemblé (`null` seulement avant la lecture de l'état : historique partiel). */
function redigerTexte(action, sortie, prose) {
  const out = [premiereLigne(action)];
  switch (action.action) {
    case 'lancer':
      out.push(texteLancer(action, sortie, prose));
      break;
    case 'question':
      out.push(redigerQuestion(action, sortie));
      break;
    case 'fini':
      out.push(texteFini(action, sortie));
      break;
    default:
      out.push(...texteSimple(action, sortie));
  }
  if (action.avertissement) out.push(`Avertissement : ${action.avertissement}`);
  return out.join('\n');
}

const MARQUE_DONNEES = '— données de l\'action pour le moteur, à ne pas relayer —';

/** Sortie sans `--json` : le `texte`, puis (si l'action en porte) ses champs et ses appels d'agent —
 * ce que la skill d'orchestration lit encore tant que S12 ne l'a pas réduite à « relaie `texte` ». */
function formaterTexte(action) {
  const champs = Object.entries(action)
    .filter(([cle]) => cle !== 'action' && cle !== 'texte' && cle !== 'prompt') // `prompt` : déjà en entier dans le texte
    .map(([cle, valeur]) => `${cle}: ${typeof valeur === 'object' ? JSON.stringify(valeur) : valeur}`);
  const donnees = [...champs, ...lignesAppelAgent(action)];
  return [action.texte ?? premiereLigne(action), ...(donnees.length > 0 ? ['', MARQUE_DONNEES, ...donnees] : [])].join('\n');
}

/** Une ligne lisible par appel d'agent prêt à recopier (D2) — `S1 → subagent_type: general-purpose ·
 * model: sonnet · effort: low` — pour la sortie sans `--json` de `lancer`, `reprendre`, `enqueter`. */
function lignesAppelAgent(action) {
  const ligne = (session, agent) => `${session} → subagent_type: ${agent.subagent_type} · model: ${agent.model} · effort: ${agent.effort}`;
  if (action.action === 'lancer') {
    return action.sessions.filter((s) => s.agent).map((s) => ligne(s.session, s.agent));
  }
  if (
    (action.action === 'reprendre' || action.action === 'enqueter' || action.action === 'relancer-interrompue') &&
    action.agent
  ) {
    return [ligne(action.session, action.agent)];
  }
  return [];
}

// ── Assemblage ─────────────────────────────────────────────────────────────────────────────────────
const dossierPlan = join(RACINE, 'plans', plan);
const INDEX_REL = `plans/${plan}/index.md`;

/** Somme, sur tous les `plans/P<n>/S<k>.echec.md` ayant existé dans l'historique ou présents dans
 * l'arbre de travail, du maximum d'`enquete` de chacun (T4, P19/S3). */
function enquetesDuPlan(index) {
  const prefixe = `plans/${plan}/`;
  const motif = new RegExp(`^${prefixe}S\\d+\\.echec\\.md$`);
  const chemins = new Set(
    (git('log', '--format=', '--name-only', '--', prefixe) || '').split('\n').map((l) => l.trim()).filter((l) => motif.test(l)),
  );
  for (const s of index.sessions) {
    if (existsSync(join(dossierPlan, `${s.session}.echec.md`))) chemins.add(`${prefixe}${s.session}.echec.md`);
  }
  let total = 0;
  for (const chemin of chemins) {
    const textes = versionsCommitees(chemin);
    if (existsSync(join(RACINE, chemin))) textes.push(readFileSync(join(RACINE, chemin), 'utf8').replace(/\r\n/g, '\n'));
    total += maxTentatives(textes).enquete;
  }
  return total;
}

/** `{ erreur }` (index illisible) | `{ partiel }` (la `question` d'historique partiel) | `{ sortie, index }` :
 * l'état du plan, lu sur le disque et dans git. Une fois en lecture seule ; sous `--appliquer`, après
 * chaque geste (le moteur se rappelle lui-même). */
function assembler() {
  const index = lireIndex(dossierPlan);
  if (index.erreur) return { erreur: index.erreur };

  // Historique partiel (T3, P19/S3) : avant toute lecture de l'historique. Un clone `--depth` a perdu
  // les commits de tâche plus anciens — lu comme complet, il ferait relancer une session déjà faite.
  const partiel = verifierHistoriqueComplet();
  if (partiel) return { partiel };

  const refs = refsCommitees();
  for (const s of index.sessions) {
    const cheminEchec = join(dossierPlan, `${s.session}.echec.md`);
    const cheminRevue = join(dossierPlan, `${s.session}.revue.md`);

    const taches = parseTaches(s.taches).map((n) => `${plan}/${s.session}/T${n}`);
    const toutesCommitees = taches.length > 0 && taches.every((ref) => refs.has(ref));

    // `en-attente` (P20/S6) avant `echec` et avant « toutes les tâches commitées » : le WIP commité avant
    // la question porte un repère `Plan:` de tâche sans que la session ait fini ; un `.echec.md` plus
    // ancien (reprise arrêtée sur un choix) ne prime pas non plus. Une session cochée l'emporte.
    const cheminQuestion = join(dossierPlan, `${s.session}.question.md`);
    if (s.coche) {
      s.etat = 'faite';
    } else if (existsSync(cheminQuestion) && !questionConsommee(`plans/${plan}/${s.session}.question.md`, s.session)) {
      s.etat = 'en-attente';
    } else if (existsSync(cheminEchec)) {
      s.etat = 'echec';
    } else if (toutesCommitees) {
      s.etat = 'faite';
    } else {
      s.etat = 'a-lancer';
    }

    s.preuve = index.preuveN0 && s.etat === 'faite' ? verifierPreuve(RACINE, `${plan}/${s.session}`) : null;
    s.echec = s.etat === 'echec' ? lireEchec(cheminEchec, `plans/${plan}/${s.session}.echec.md`) : null;
    s.question = s.etat === 'en-attente' ? lireQuestion(cheminQuestion, `plans/${plan}/${s.session}.question.md`) : null;
    // Une revue toujours présente se lit normalement ; une revue **ajoutée par un commit** puis
    // supprimée depuis (tri de clôture) compte comme faite mais sans `Bloquant :` à relire — le
    // fichier n'existe plus (T6, P10/S2).
    if (existsSync(cheminRevue)) {
      s.revue = lireRevue(cheminRevue);
    } else if (ajouteParUnCommit(`plans/${plan}/${s.session}.revue.md`)) {
      const derniere = git('log', '-1', '--diff-filter=AM', '--format=%H', '--', `plans/${plan}/${s.session}.revue.md`);
      const texte = derniere ? git('show', `${derniere}:plans/${plan}/${s.session}.revue.md`) : null;
      s.revue = texte ? lireRevue(cheminRevue, texte) : null;
    } else {
      s.revue = null;
    }
    // Relecture selon le risque (P20/S8/T12) : chemins sensibles touchés, et `n0.json` hors zone — contrôle du
    // moteur sur TOUS les commits de la session. Le bloquant est compté ici (en mémoire) tant que la `.revue.md`
    // ne porte pas sa ligne `Bloquant moteur :` ; le geste `bloquant-moteur` l'y écrit.
    const fichiers = s.etat === 'faite' ? fichiersDeSession(s.session) : [];
    s.fichiersSensibles = toucheSensible(fichiers);
    s.n0HorsZone = n0HorsZone(s.zone, fichiers);
    if (s.n0HorsZone && s.revue && s.revue.couverture === 'complète' && s.revue.bloquant !== null && existsSync(cheminRevue)) {
      s.revue.moteurAEcrire = !readFileSync(cheminRevue, 'utf8').includes(MOTIF_BLOQUANT_MOTEUR);
      if (s.revue.moteurAEcrire) s.revue.bloquant += 1;
    }
  }

  // Racine introuvable (worktree lié d'un dépôt à `.git` déplacé) : le moteur ne conclut rien, il pose
  // une question (plugin/hooks/lib.mjs `racineIntrouvable`, même refus par défaut côté hook).
  const racineActuelle = racineDepot();
  const sortie = {
    plan,
    workflow: index.workflow,
    clos: index.clos,
    preuveN0: index.preuveN0,
    remediationOpus: index.remediationOpus,
    enquetesPlan: enquetesDuPlan(index),
    depot: {
      racineIntrouvable: racineActuelle === null,
      amont: etatAmont(),
      rebase: rebaseEnCours(),
      arbreSale: arbreTrackedSale(),
    },
    vagues: index.vagues,
    sessions: index.sessions,
  };
  return { sortie, index };
}

/** L'avertissement de version, puis le `texte` final — rédigé en dernier : il porte aussi l'avertissement.
 * `sortie` `null` : historique partiel, aucun état lu. */
function completerAction(action, sortie) {
  if (!sortie) {
    action.texte = redigerTexte(action, null, { vagues: new Map() });
    return action;
  }
  const avertissement = avertissementVersion(sortie);
  if (avertissement) {
    // Ne pas écraser un avertissement déjà posé (modèle inconnu, D2) : les deux comptent.
    action.avertissement = action.avertissement ? `${action.avertissement} · ${avertissement}` : avertissement;
  }
  action.texte = redigerTexte(action, sortie, lireProse(readFileSync(join(dossierPlan, 'index.md'), 'utf8')));
  return action;
}

/** Marque d'une ligne de geste appliqué : aucune autre ligne de la sortie n'en commence — `noter.mjs` lit la
 * première ligne de la DERNIÈRE action, après ces lignes. */
const MARQUE_APPLIQUE = 'appliqué — ';

function ecrireSortie(action, appliques) {
  if (json) {
    process.stdout.write(JSON.stringify(appliquer ? { ...action, appliques } : action, null, 2) + '\n');
    return;
  }
  const lignes = appliquer ? appliques.map((a) => `${MARQUE_APPLIQUE}${a.replace(/\s+/g, ' ')}`) : [];
  process.stdout.write([...lignes, formaterTexte(action)].join('\n') + '\n');
}

// ── `--appliquer` : les gestes mécaniques (P20/S7/T11) ────────────────────────────────────────────────
// Un geste = une écriture + UN commit (staging explicite des seuls fichiers touchés, dernière ligne
// `Plan:`, jamais `--no-verify` : les hooks du dépôt s'appliquent au moteur comme à tout le monde).

/** Un geste qui n'a pas pu s'écrire (commit refusé par un hook, identité absente, push rejeté…) : le moteur
 * s'arrête sur une `question` plutôt que de laisser croire que le plan avance. */
class EchecEcriture extends Error {
  constructor(geste, detail) {
    super(`${geste} : ${detail}`);
    this.geste = geste;
    this.detail = detail;
  }
}

const DELAI_GIT_MS = 60000;
const DELAI_RESEAU_MS = 180000;
const DELAI_N0_MS = 30 * 60 * 1000;

/** git qui ÉCRIT : le moindre échec lève `EchecEcriture` avec le texte de git (jamais un `null` à deviner). */
function gitStrict(a, delai = DELAI_GIT_MS) {
  try {
    return execFileSync('git', a, {
      cwd: RACINE,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: delai,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    }).trim();
  } catch (e) {
    // Le texte de git seulement (jamais `e.message` : il recopie la ligne de commande, message de commit compris).
    const brut = e.killed ? `délai de ${delai / 1000} s dépassé` : `${e.stderr ?? ''} ${e.stdout ?? ''}`;
    throw new EchecEcriture(`git ${a[0]}`, brut.replace(/\s+/g, ' ').trim().slice(0, 300) || `code de sortie ${e.status ?? '?'}`);
  }
}

/** Committe EXACTEMENT `chemins` (relatifs à la racine) : `git commit -- <chemins>` ne prend jamais ce
 * qu'un autre outil a déjà mis dans l'index. Un chemin absent du disque est une suppression (`git rm
 * --cached`, sans effet s'il est déjà retiré de l'index). Rend le hash court, ou `null` si rien n'a changé. */
function committer(chemins, sujet, repere) {
  for (const c of chemins) {
    if (existsSync(join(RACINE, c))) gitStrict(['add', '-A', '--', c]);
    else gitStrict(['rm', '-q', '--cached', '--ignore-unmatch', '--', c]);
  }
  // `git diff --cached --quiet` : code 0 = rien à committer (gitBrut rend alors une chaîne), 1 = des changements (null).
  if (gitBrut('diff', '--cached', '--quiet', '--', ...chemins) !== null) return null;
  gitStrict(['commit', '-q', '-m', `${sujet}\n\nPlan: ${repere}`, '--', ...chemins]);
  return gitStrict(['rev-parse', '--short', 'HEAD']);
}

function supprimerEtCommitter(relatif, sujet, repere) {
  gitStrict(['rm', '-q', '--', relatif]);
  return committer([relatif], sujet, repere);
}

const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Réécrit `index.md` (fins de ligne d'origine conservées) ; `false` si le transformateur n'a rien changé. */
function modifierIndex(transformer) {
  const chemin = join(dossierPlan, 'index.md');
  const brut = readFileSync(chemin, 'utf8');
  const crlf = brut.includes('\r\n');
  const texte = brut.replace(/\r\n/g, '\n');
  const nouveau = transformer(texte);
  if (nouveau === texte) return false;
  writeFileSync(chemin, crlf ? nouveau.replace(/\n/g, '\r\n') : nouveau);
  return true;
}

/** Applique `f` à la cellule « Statut » (9e colonne) de la ligne de table de `id`. */
function surStatutDeSession(texte, id, f) {
  return texte.split('\n').map((ligne) => {
    if (!ligne.trim().startsWith('|')) return ligne;
    const parts = ligne.split('|'); // '' + cellules + ''
    if (parts.length < 11) return ligne;
    const m = /\bS(\d+)\b/.exec(parts[1]);
    if (!m || `S${m[1]}` !== id) return ligne;
    parts[9] = ` ${f(parts[9].trim())} `;
    return parts.join('|');
  }).join('\n');
}

/** Pose ou remplace une ligne d'en-tête (`Remédiation Opus :`, `Clos :`) : sous la dernière ligne d'en-tête
 * existante (`Workflow :`, `Preuve N0 :`…), sinon avant la première section `##`. */
function poserLigneEnTete(texte, motif, ligne) {
  const lignes = texte.split('\n');
  const i = lignes.findIndex((l) => motif.test(l.trim()));
  if (i >= 0) {
    lignes[i] = ligne;
    return lignes.join('\n');
  }
  let dernier = -1;
  lignes.forEach((l, k) => { if (/^(Workflow|Preuve N0|Rem[ée]diation Opus|Clos)\s*:/.test(l.trim())) dernier = k; });
  if (dernier >= 0) lignes.splice(dernier + 1, 0, ligne);
  else {
    const titre = lignes.findIndex((l) => /^##\s/.test(l));
    if (titre >= 0) lignes.splice(titre, 0, ligne, '');
    else lignes.push(ligne);
  }
  return lignes.join('\n');
}

const MOTIF_OPUS = /^Rem[ée]diation\s+Opus\s*:/i;
const MOTIF_CLOS = /^Clos\s*:/;

// ── Prélude : reprendre les écritures laissées par un appel interrompu ──────────────────────────────────
const MOTIF_REVUE = new RegExp(`^plans/${plan}/(S\\d+)\\.revue\\.md$`);
const MOTIF_ECRITURES_PLAN = new RegExp(`^plans/${plan}/(index\\.md|S\\d+\\.(echec|question)\\.md|S\\d+\\.n0\\.json)$`);

/** Une preuve N0 en échec laissée sur le disque n'est jamais committée par la reprise (le geste `valider-n0`
 * ne committe qu'une preuve verte, la reprise ne doit pas faire autrement). */
function preuveEnEchec(relatif) {
  try {
    return JSON.parse(readFileSync(join(RACINE, relatif), 'utf8')).resultat !== 'PASS';
  } catch {
    return true;
  }
}

function reprendreEcrituresEnAttente(decrire) {
  const sales = fichiersSales([`plans/${plan}/`]);
  if (sales === null) throw new EchecEcriture('git status', 'arbre invérifiable');
  // Les revues d'abord, chacune avec son message : c'est ce qu'écrit `relire` (le relecteur ne committe plus la sienne).
  const autres = [];
  for (const f of sales.sort()) {
    const m = MOTIF_REVUE.exec(f);
    if (!m) {
      if (MOTIF_ECRITURES_PLAN.test(f) && existsSyncOuSuivi(f) && !(f.endsWith('.n0.json') && existsSync(join(RACINE, f)) && preuveEnEchec(f))) autres.push(f);
      continue;
    }
    if (!existsSync(join(RACINE, f))) continue; // suppression non commitée : le tri de clôture est à l'orchestrateur
    const revue = lireRevue(join(RACINE, f));
    if (revue.bloquant === null) { autres.push(f); continue; } // illisible : reprise générique, jamais un « 0 bloquant » deviné
    const hash = committer([f], `revue(${plan}): ${m[1]} relue, ${revue.bloquant} bloquant(s)`, `${plan}/${m[1]}`);
    if (hash) decrire(`revue de ${m[1]} committée (${hash}) : revue(${plan}): ${m[1]} relue, ${revue.bloquant} bloquant(s)`);
  }
  if (autres.length > 0) {
    const hash = committer(autres, `chore(${plan}): écritures du moteur reprises après interruption`, plan);
    if (hash) decrire(`écritures en attente reprises (${hash}) : ${autres.map((f) => f.slice(`plans/${plan}/`.length)).join(', ')}`);
  }
}

/** Fichier présent sur le disque, ou dans le dernier commit : une suppression non commitée compte, qu'elle soit
 * déjà dans l'index (`git rm` interrompu avant le commit) ou seulement sur le disque. */
const existsSyncOuSuivi = (relatif) => existsSync(join(RACINE, relatif)) || git('cat-file', '-e', `HEAD:${relatif}`) !== null;

// ── Gestes déduits de l'état (idempotents : une interruption se répare au tour suivant) ─────────────────
/** Le premier geste mécanique que l'état appelle : `{ cle, faire }` ou `null`. `faire` écrit, committe, et
 * rend la phrase du journal. Une seule écriture par geste, jamais deux commits dans un geste. */
function gesteEtat(sortie) {
  // 1. Un rapport ou une question dont la session a repris le travail depuis : supprimé par un commit.
  for (const s of sortie.sessions) {
    const id = s.session;
    const relQuestion = `plans/${plan}/${id}.question.md`;
    if (existsSync(join(RACINE, relQuestion)) && questionConsommee(relQuestion, id)) {
      return {
        cle: `question:${id}`,
        faire: () => {
          const hash = supprimerEtCommitter(relQuestion, `chore(${plan}): ${id} question consommée, fichier supprimé`, `${plan}/${id}`);
          return `${id} : question consommée, ${relQuestion} supprimé (${hash})`;
        },
      };
    }
    const relEchec = `plans/${plan}/${id}.echec.md`;
    // Même règle que la question : propre, committé, et un commit de TÂCHE depuis. Jamais pendant une attente
    // de réponse (le WIP commité avant la question porte aussi un repère de tâche).
    if (s.etat !== 'en-attente' && existsSync(join(RACINE, relEchec)) && questionConsommee(relEchec, id)) {
      return {
        cle: `echec:${id}`,
        faire: () => {
          const hash = supprimerEtCommitter(relEchec, `chore(${plan}): ${id} reprise réussie, rapport d'échec supprimé`, `${plan}/${id}`);
          return `${id} : reprise réussie, ${relEchec} supprimé (${hash})`;
        },
      };
    }
    // Une session COCHÉE dont le rapport d'échec est resté (acceptée par l'utilisateur malgré l'échec, ou reprise
    // à la main) : la coche vient après l'échec, le rapport est obsolète — et un `.echec.md` encore présent fait
    // refuser la clôture (`fin-de-plan.md`, point 1). Propre et committé seulement : un rapport en cours
    // d'écriture n'est jamais supprimé. L'historique garde le rapport, et les compteurs de budget avec lui.
    if (s.coche && existsSync(join(RACINE, relEchec)) && git('status', '--porcelain', '--', relEchec) === '' && git('log', '-1', '--format=%H', '--', relEchec)) {
      return {
        cle: `echec-obsolete:${id}`,
        faire: () => {
          const hash = supprimerEtCommitter(relEchec, `chore(${plan}): ${id} cochée, rapport d'échec obsolète supprimé`, `${plan}/${id}`);
          return `${id} : cochée, ${relEchec} obsolète supprimé (${hash})`;
        },
      };
    }
  }
  // 2. Cocher `[x]` : tâches commitées (état `faite`) et preuve N0 valide — jamais une preuve inconnue ou périmée.
  for (const s of sortie.sessions) {
    if (s.etat !== 'faite' || s.coche) continue;
    if (s.preuve !== null && s.preuve.ok !== true) continue;
    return {
      cle: `cocher:${s.session}`,
      faire: () => {
        const date = aujourdhui();
        if (!modifierIndex((t) => surStatutDeSession(t, s.session, (c) => (c.includes('[ ]') ? c.replace('[ ]', `[x] ${date}`) : c)))) {
          throw new EchecEcriture('cocher', `la ligne de ${s.session} n'a pas de case « [ ] » à cocher dans ${INDEX_REL}`);
        }
        const hash = committer([INDEX_REL], `plan(${plan}): ${s.session} faite`, `${plan}/${s.session}`);
        return `${s.session} cochée [x] ${date} (${hash})`;
      },
    };
  }
  // 2b. `n0.json` modifié hors zone : la ligne `Bloquant moteur :` est écrite dans la `.revue.md` (présente,
  // complète) et le compte de `Bloquant :` l'inclut ; la suite (`[x]!`, `dependance-revue`) est celle d'un
  // bloquant de relecture.
  for (const s of sortie.sessions) {
    if (!s.revue?.moteurAEcrire) continue;
    return {
      cle: `bloquant-moteur:${s.session}`,
      faire: () => {
        const rel = `plans/${plan}/${s.session}.revue.md`;
        const abs = join(RACINE, rel);
        const brut = readFileSync(abs, 'utf8');
        const crlf = brut.includes('\r\n');
        let t = brut.replace(/\r\n/g, '\n');
        t = t.replace(/^(Bloquant\s*:\s*)(\d+)/m, (_, a, n) => `${a}${Number(n) + 1}`);
        if (/^## Bloquants[ \t]*$/m.test(t)) {
          t = t.replace(/^(## Bloquants[ \t]*\n)(\s*- aucun[ \t]*\n)?/m, `$1- ${MOTIF_BLOQUANT_MOTEUR}\n`);
        } else {
          t = `${t.replace(/\s*$/, '')}\n\n## Bloquants\n- ${MOTIF_BLOQUANT_MOTEUR}\n`;
        }
        t = t.replace(/^Dépendances\s*:.*$/m, 'Dépendances : bloquées');
        writeFileSync(abs, crlf ? t.replace(/\n/g, '\r\n') : t);
        const n = s.revue.bloquant;
        const hash = committer([rel], `revue(${plan}): ${s.session} relue, ${n} bloquant(s) (n0.json hors zone)`, `${plan}/${s.session}`);
        return `${s.session} : « ${MOTIF_BLOQUANT_MOTEUR} » ajouté à ${rel} (${n} bloquant(s)) (${hash})`;
      },
    };
  }
  // 3. `[x]` → `[x]!` : une revue PRÉSENTE à `Bloquant : n > 0` (une revue rangée au tri de clôture ne
  // rouvre rien — le versement vient de repasser la session à `[x]`).
  for (const s of sortie.sessions) {
    if (!s.coche || s.bloquantNonTrie || !(s.revue?.bloquant > 0)) continue;
    if (!existsSync(join(dossierPlan, `${s.session}.revue.md`))) continue;
    return {
      cle: `bloquant:${s.session}`,
      faire: () => {
        if (!modifierIndex((t) => surStatutDeSession(t, s.session, (c) => c.replace(/\[x\](?!!)/, '[x]!')))) {
          throw new EchecEcriture('[x]!', `la ligne de ${s.session} n'a pas de « [x] » à passer à « [x]! » dans ${INDEX_REL}`);
        }
        const hash = committer([INDEX_REL], `plan(${plan}): ${s.session} passe à [x]! (revue : ${s.revue.bloquant} bloquant(s))`, `${plan}/${s.session}`);
        return `${s.session} passée à [x]! (${s.revue.bloquant} bloquant(s)) (${hash})`;
      },
    };
  }
  return null;
}

// ── Options à effet d'écriture ─────────────────────────────────────────────────────────────────────────
function ecrireInterruption(sortie, id, agent) {
  const s = sortie.sessions.find((x) => x.session === id);
  if (!s) erreurUsage(`--interruption : ${id} absente de plans/${plan}/index.md`);
  const rel = `plans/${plan}/${id}.echec.md`;
  const abs = join(RACINE, rel);
  // `Tentatives :` recopiées du fichier s'il existait déjà, sinon à zéro : une coupure par quota n'en consomme aucune.
  const { reprise, enquete } = existsSync(abs) ? lireTentatives(readFileSync(abs, 'utf8').replace(/\r\n/g, '\n')) : { reprise: 0, enquete: 0 };
  const refs = refsCommitees();
  const enCours = parseTaches(s.taches).map((n) => `T${n}`).find((t) => !refs.has(`${plan}/${id}/${t}`)) ?? null;
  writeFileSync(abs, [
    `# ${id} — interruption du ${aujourdhui()}`,
    '',
    'Nature : interruption',
    `Tentatives : reprise=${reprise} enquete=${enquete}`,
    `Blocage : coupure par quota${enCours ? ` pendant ${enCours}` : ''}`,
    `Agent : ${une(agent)}`,
    '',
  ].join('\n'));
  const hash = committer([rel], `chore(${plan}): ${id} coupée par un quota, interruption consignée`, `${plan}/${id}`);
  return `interruption de ${id} consignée dans ${rel} (${hash ?? 'inchangé'})`;
}

function validerVague(index, numero) {
  const v = index.vagues.find((x) => x.numero === Number(numero));
  if (!v) erreurUsage(`--valider-vague : la vague ${numero} n'existe pas dans plans/${plan}/index.md`);
  if (!v.validationHumaine) erreurUsage(`--valider-vague : la vague ${numero} n'est pas une validation-humaine`);
  if (v.validee) return `vague ${numero} déjà validée — rien à écrire`;
  const motif = new RegExp(`^(\\s*(?:-\\s*)?\\*\\*Vague\\s+${numero}\\b[^*]*?)(\\s*)(\\*\\*)`, 'm');
  if (!modifierIndex((t) => t.replace(motif, '$1 · validée$3'))) {
    throw new EchecEcriture('valider-vague', `l'en-tête de la vague ${numero} n'a pas pu être réécrit dans ${INDEX_REL}`);
  }
  const hash = committer([INDEX_REL], `plan(${plan}): vague ${numero} validée`, plan);
  return `vague ${numero} validée : \`· validée\` ajouté à son en-tête (${hash})`;
}

function ecrirePremisse(action, verdict, preuve) {
  const rel = action.chemin;
  const abs = join(RACINE, rel);
  const mot = VERDICTS_PREMISSE.find((v) => normaliserSimple(verdict).startsWith(v));
  const texte = readFileSync(abs, 'utf8').replace(/\r\n/g, '\n');
  writeFileSync(abs, `${texte.replace(/\n*$/, '\n')}Premisse : ${mot} · ${une(preuve)}\n`);
  const hash = committer([rel], `chore(${plan}): ${action.session} prémisse ${mot} écrite au rapport`, `${plan}/${action.session}`);
  return `${action.session} : ligne \`Premisse : ${mot}\` écrite dans ${rel} (${hash})`;
}

// ── Remédiation Opus : une passe consignée à sa première apparition, jamais deux fois pour la même ───────
/** `{ id, valeur }` quand l'index porte déjà le compteur écrit pour une passe Opus RENDUE mais pas encore
 * consommée : le rapport de la session est identique à celui du commit du compteur (l'agent n'a rien rendu).
 * Sans ce test, un appel de plus — avant le lancement, ou après une coupure — verrait le compteur à 1 et
 * rendrait `budget-opus` pour une passe qui n'a jamais eu lieu. */
function passeOpusEnAttente(sortie) {
  // Le dernier commit du moteur qui a touché le compteur (sujet reconnu ici : aucun accent passé en argument à git).
  const motif = new RegExp(`^plan\\(${plan}\\): remédiation Opus n°(\\d+) \\((S\\d+)\\)$`);
  let hash = null;
  let m = null;
  for (const ligne of (git('log', '-n', '30', '--format=%H%x09%s', '--', INDEX_REL) ?? '').split('\n')) {
    const [h, ...sujet] = ligne.split('\t');
    const trouve = motif.exec(sujet.join('\t'));
    if (trouve) { hash = h; m = trouve; break; }
  }
  if (!hash || sortie.remediationOpus !== Number(m[1])) return null;
  const s = sortie.sessions.find((x) => x.session === m[2]);
  const rel = `plans/${plan}/${m[2]}.echec.md`;
  if (!s || s.etat !== 'echec' || !existsSync(join(RACINE, rel))) return null;
  if (gitBrut('diff', '--quiet', hash, '--', rel) === null) return null; // rapport modifié depuis : la passe a eu lieu
  return { id: m[2], valeur: Number(m[1]) };
}

function consignerPasseOpus(action) {
  let valeur = 0;
  modifierIndex((t) => {
    const ligne = t.split('\n').find((l) => MOTIF_OPUS.test(l.trim()));
    valeur = ligne ? Number(/:\s*(\d+)/.exec(ligne)?.[1] ?? 0) + 1 : 1;
    return poserLigneEnTete(t, MOTIF_OPUS, `Remédiation Opus : ${valeur}`);
  });
  const hash = committer([INDEX_REL], `plan(${plan}): remédiation Opus n°${valeur} (${action.session})`, `${plan}/${action.session}`);
  return `Remédiation Opus : ${valeur} (${action.action} ${action.session} sur Opus) (${hash})`;
}

// ── N0, push, clôture ─────────────────────────────────────────────────────────────────────────────────
/** `{ vert: true, hash }` (preuve committée) ou `{ vert: false, resume }` (rien committé, aucune preuve en échec
 * laissée sur le disque) — jamais une preuve fabriquée. */
function lancerN0(id) {
  const n0 = join(dirname(fileURLToPath(import.meta.url)), 'n0.mjs');
  const rel = `plans/${plan}/${id}.n0.json`;
  const r = spawnSync(process.execPath, [n0, '--session', `${plan}/${id}`], {
    cwd: RACINE,
    encoding: 'utf8',
    timeout: DELAI_N0_MS,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 50 * 1024 * 1024,
  });
  let preuve = null;
  try { preuve = JSON.parse(readFileSync(join(RACINE, rel), 'utf8')); } catch { /* absente ou illisible : pas de preuve */ }
  if (r.status === 0 && preuve?.resultat === 'PASS' && preuve?.portee === 'complete') {
    return { vert: true, hash: committer([rel], `test(${plan}): preuve N0 de ${id}`, `${plan}/${id}`) };
  }
  if (existsSync(join(RACINE, rel))) {
    if (git('ls-files', '--', rel) === rel) gitBrut('checkout', '--', rel);
    else rmSync(join(RACINE, rel), { force: true });
  }
  const sortieN0 = `${r.stdout ?? ''}\n${r.stderr ?? ''}`.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 3).join(' · ');
  const code = r.error ? `échec de lancement : ${r.error.message}` : r.status === null ? `interrompu (${r.signal ?? 'délai'})` : `code ${r.status}`;
  return { vert: false, resume: `N0 rouge (${code})${sortieN0 ? ` — ${sortieN0}` : ''}` };
}

/** `pull --rebase` puis `push`. Rend `null` (poussé) ou la `question` à rendre : conflit → `rebase --abort`
 * (le dépôt revient à son état d'avant), question `rebase`. Tout autre échec → `EchecEcriture`. */
function pousser() {
  try {
    gitStrict(['pull', '--rebase'], DELAI_RESEAU_MS);
  } catch (e) {
    if (e instanceof EchecEcriture && rebaseEnCours()) {
      gitBrut('rebase', '--abort');
      return {
        action: 'question',
        motif: `le rebase sur l'amont a rencontré un conflit et a été abandonné (git rebase --abort) : ${e.detail}`,
        options: { source: 'rebase', abandonne: true },
      };
    }
    throw e;
  }
  gitStrict(['push'], DELAI_RESEAU_MS);
  return null;
}

/** Ce que la clôture laisse à l'orchestrateur : les revues à trier (point 4), les `[x]!` à repasser, le reste non commité. */
function resteDeCloture(sortie) {
  const revues = sortie.sessions.map((s) => `plans/${plan}/${s.session}.revue.md`).filter((p) => existsSync(join(RACINE, p)));
  const bloquants = sortie.sessions.filter((s) => s.bloquantNonTrie).map((s) => s.session);
  const brut = fichiersSales();
  const sales = brut === null ? ["arbre invérifiable (`git status` a échoué)"] : brut.filter((f) => !f.startsWith('.claude/n0/'));
  return { revues, bloquants, sales };
}

/** Points 1 et 2 de `fin-de-plan.md` (le 3 est fait par le prélude) : incidents non commités, marqueurs transitoires. */
function ranger(decrire) {
  for (const f of (fichiersSales(['docs/workflow/incidents/']) ?? []).filter((x) => x.endsWith('.md') && existsSync(join(RACINE, x))).sort()) {
    const slug = f.split('/').pop().replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '');
    const hash = committer([f], `incident(workflow): ${slug}`, plan);
    if (hash) decrire(`incident ${slug} committé (${hash})`);
  }
  const vague = join(RACINE, '.claude', 'vague');
  if (existsSync(vague)) {
    rmSync(vague, { recursive: true, force: true });
    decrire('marqueurs transitoires `.claude/vague/` nettoyés');
  }
}

/** Chemin du script, tel qu'on le relance depuis la racine du dépôt (source : `plugin/bin/…`, vendoré : `.claude/workflow/bin/…`). */
function cheminScript() {
  const rel = relative(RACINE, fileURLToPath(import.meta.url)).replaceAll('\\', '/');
  return rel.startsWith('..') || isAbsolute(rel) ? fileURLToPath(import.meta.url).replaceAll('\\', '/') : rel;
}

const questionEcriture = (e) => ({
  action: 'question',
  motif: `une écriture du moteur a échoué (${e.geste}) : ${e.detail}`,
  options: { source: 'ecriture-echec', geste: e.geste, detail: e.detail },
});

/** L'enchaînement : prélude, puis — tant que l'état appelle un geste mécanique — le geste, puis le moteur se
 * rappelle ; s'arrête sur la première action qui demande un agent ou un humain, ou sur `fini`. Rend
 * `{ action, sortie, appliques }` (ou `{ erreur }` : index illisible). */
function appliquerPlan() {
  const appliques = [];
  const decrire = (s) => appliques.push(s);
  let sortie = null;
  let tours = 0;
  let toursMax = optToursMax === null ? null : Number(optToursMax);
  let optionsFaites = false;
  let premisseEcrite = false;
  const dejaN0 = new Set();
  const rendre = (action, avertissement = null) => {
    if (avertissement) action.avertissement = action.avertissement ? `${action.avertissement} · ${avertissement}` : avertissement;
    if (optPremisse && !premisseEcrite) {
      const w = '`--premisse` ignoré : aucune vérification de prémisse en attente';
      action.avertissement = action.avertissement ? `${action.avertissement} · ${w}` : w;
    }
    return { action, sortie, appliques };
  };
  try {
    reprendreEcrituresEnAttente(decrire);
    for (;;) {
      const r = assembler();
      if (r.erreur) return { erreur: r.erreur };
      if (r.partiel) return { action: r.partiel, sortie: null, appliques };
      sortie = r.sortie;
      if (toursMax === null) toursMax = Math.max(1, r.index.sessions.length * 4);
      const borne = () => {
        if (tours < toursMax) return null;
        return {
          action: 'question',
          motif: `enchaînement interrompu : ${toursMax} gestes mécaniques sans atteindre une action pour un agent ou pour toi`,
          options: { source: 'boucle-appliquer', tours: toursMax },
        };
      };

      // Écritures demandées par l'orchestrateur, indépendantes de l'action : une fois, au premier tour.
      if (!optionsFaites) {
        optionsFaites = true;
        if (optInterruption) { decrire(ecrireInterruption(sortie, optInterruption, optAgent)); continue; }
        if (optValiderVague !== null) { decrire(validerVague(r.index, optValiderVague)); continue; }
      }

      const geste = gesteEtat(sortie);
      if (geste) {
        const q = borne();
        if (q) return rendre(q);
        decrire(geste.faire());
        tours++;
        continue;
      }

      const pendante = passeOpusEnAttente(sortie);
      if (pendante) sortie.remediationOpus = pendante.valeur - 1; // la passe déjà consignée ne compte pas contre elle-même
      const action = prochaineAction(sortie);

      switch (action.action) {
        case 'valider-n0': {
          if (dejaN0.has(action.session)) {
            return rendre(action, `N0 déjà rejoué dans cet appel et la preuve reste invalide (${action.motif ?? 'motif inconnu'})`);
          }
          const q = borne();
          if (q) return rendre(q);
          dejaN0.add(action.session);
          const n0 = lancerN0(action.session);
          if (!n0.vert) return rendre(action, n0.resume);
          decrire(`N0 de ${action.session} vert, preuve plans/${plan}/${action.session}.n0.json committée (${n0.hash})`);
          tours++;
          continue;
        }
        case 'pousser': {
          const q = borne();
          if (q) return rendre(q);
          const question = pousser();
          if (question) return rendre(question);
          decrire('poussé (pull --rebase, push)');
          tours++;
          continue;
        }
        case 'verifier-premisse': {
          if (!optPremisse || premisseEcrite) return rendre(action);
          const q = borne();
          if (q) return rendre(q);
          decrire(ecrirePremisse(action, optPremisse[0], optPremisse[1]));
          premisseEcrite = true;
          tours++;
          continue;
        }
        case 'reprendre':
        case 'enqueter': {
          // Une passe Opus : consignée ICI, avant d'être rendue (jamais par l'orchestrateur, qui l'oubliait).
          // Une reprise à froid après une question est hors budget (`question`), jamais comptée.
          if (action.modele === 'Opus' && !action.question && !(pendante && pendante.id === action.session)) {
            const q = borne();
            if (q) return rendre(q);
            decrire(consignerPasseOpus(action));
            tours++;
          }
          return rendre(action);
        }
        case 'cloturer': {
          ranger(decrire);
          const reste = resteDeCloture(sortie);
          const jugement = reste.revues.length > 0 || reste.bloquants.length > 0;
          if (optClotureFaite && !jugement) {
            const q = borne();
            if (q) return rendre(q);
            const date = aujourdhui();
            modifierIndex((t) => poserLigneEnTete(t, MOTIF_CLOS, `Clos : ${date}`));
            const hash = committer([INDEX_REL], `plan(${plan}): clos le ${date}`, plan);
            decrire(`Clos : ${date} (${hash})`);
            tours++;
            // Point 7 : un seul push, celui de la clôture (un plan clos rend `fini` avant tout `pousser`).
            const amont = etatAmont();
            if (amont && amont.avance > 0 && !arbreTrackedSale()) {
              const question = pousser();
              if (question) return rendre(question);
              decrire('poussé (pull --rebase, push)');
            }
            continue;
          }
          action.reste = reste;
          action.rappel = `node ${cheminScript()} ${plan} --appliquer --cloture-faite`;
          return rendre(action, optClotureFaite ? `\`--cloture-faite\` refusé : reste à trier (${[...reste.revues, ...reste.bloquants.map((b) => `${b} en [x]!`)].join(', ')})` : null);
        }
        default:
          // lancer, reprendre/enqueter (ci-dessus), relire, transmettre, question, validation-humaine,
          // relancer-interrompue, fini : un agent ou un humain, ou la fin.
          return rendre(action);
      }
    }
  } catch (e) {
    if (e instanceof EchecEcriture) return { action: questionEcriture(e), sortie, appliques };
    throw e;
  }
}

// ── Sortie ───────────────────────────────────────────────────────────────────────────────────────────
if (appliquer) {
  const r = appliquerPlan();
  if (r.erreur) {
    console.error(`prochaine-action: ${r.erreur}`);
    process.exit(2);
  }
  ecrireSortie(completerAction(r.action, r.sortie), r.appliques);
  process.exit(0);
}

const assemblage = assembler();
if (assemblage.erreur) {
  console.error(`prochaine-action: ${assemblage.erreur}`);
  process.exit(2);
}
if (assemblage.partiel) {
  ecrireSortie(completerAction(assemblage.partiel, null), []);
  process.exit(0);
}

if (etat) {
  process.stdout.write(JSON.stringify(assemblage.sortie, null, 2) + '\n');
  process.exit(0);
}

ecrireSortie(completerAction(prochaineAction(assemblage.sortie), assemblage.sortie), []);
process.exit(0);
