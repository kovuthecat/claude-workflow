// Hook Stop — garde-fou de fin de session.
// Trois vérifications mécaniques (cf. WORKFLOW.md §7) :
//   1. du code a été modifié mais aucun fichier de suivi ne l'a été → /fin-de-tache non déroulée ;
//   2. une session de plan a commité du code sans laisser trace de sa revue — ni S<k>.revue.md sur
//      disque, ni repère `Revues:` de tri de clôture → revue jamais lancée ;
//   3. un fichier de contexte dépasse son plafond de lignes → archivage dû.
// Ne bloque qu'UNE fois par session : si la seconde tentative d'arrêt arrive, on laisse passer
// (l'exécutant a pu avoir une raison légitime — on ne veut pas d'une boucle infinie). Les rappels
// qui suivent ne sont émis que si la liste des manquements a CHANGÉ depuis le dernier arrêt : un
// orchestrateur enchaîne des dizaines de tours, et le même rappel à chacun n'informait plus
// personne, il polluait.
//
// Sous `.claude/wave.lock`, les vérifications 1 et 2 n'ont pas d'objet : les sessions d'une vague
// parallèle laissent leur diff dans l'arbre sans committer (WORKFLOW.md §4b), et la revue ne peut
// pas précéder des commits qui n'existent pas encore. Les signaler là était le fonctionnement
// normal relu comme un manquement, à chaque tour de l'orchestrateur. Seuls les plafonds restent.

import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
  lireEntree, repertoireProjet, estUnDepot, fichiersModifies,
  depassements, estFichierDeSuivi, lirePlafonds, repondre, riendafaire,
  vagueParallele, repereSession, revuesManquantes,
} from './lib.mjs';

const entree = await lireEntree();
const cwd = repertoireProjet(entree);

if (!estUnDepot(cwd)) riendafaire();

const sousVerrou = vagueParallele(cwd);
const problemes = [];

if (!sousVerrou) {
  const { fichiersDeSuivi } = lirePlafonds();
  // `.claude/` n'est ni du code ni du suivi (wave.lock, settings, launch.json) : hors comptage.
  const modifies = fichiersModifies(cwd).filter((f) => !f.startsWith('.claude/'));
  const code = modifies.filter((f) => !estFichierDeSuivi(f, fichiersDeSuivi));
  const suivi = modifies.filter((f) => estFichierDeSuivi(f, fichiersDeSuivi));

  if (code.length > 0 && suivi.length === 0) {
    const apercu = code.slice(0, 5).join(', ') + (code.length > 5 ? `, … (${code.length} au total)` : '');
    problemes.push(
      `**Fin de session non consignée.** ${code.length} fichier(s) modifié(s) (${apercu}) ` +
      `sans qu'aucun fichier de suivi (statut dans plans/, STATUS.md, VALIDATION.md) ne soit touché. ` +
      `Déroule la skill /fin-de-tache avant de rendre la main.`
    );
  }

  // Revue de session : le dépôt du `.revue.md` est inconditionnel (`Bloquant : 0` quand il n'y a rien
  // à dire), donc un fichier absent que rien ne justifie ne veut dire qu'une chose — la revue n'a pas
  // tourné. Le mode d'échec est silencieux par construction : la revue lancée en arrière-plan en
  // dernier geste tourne vraiment, mais son retour arrive dans un tour que plus personne ne lit
  // (docs/decisions/2026-09-07-revue-orpheline.md). Sans ce contrôle, un plan entier se clôt sans
  // qu'aucune relecture n'ait été déposée. La seule absence légitime est celle du tri de clôture, qui
  // verse la revue dans TASKS.md puis la supprime — elle se déclare par un repère `Revues:`.
  let repereHead = null;
  try {
    const { chemin } = repereSession(entree, cwd, 'head');
    if (existsSync(chemin)) repereHead = readFileSync(chemin, 'utf8').trim();
  } catch { /* repère illisible : contrôle désactivé, jamais de faux positif */ }

  for (const ref of revuesManquantes(cwd, repereHead)) {
    problemes.push(
      `**Revue de session absente — ${ref}.** Des commits de cette session portent du code sous ` +
      `\`Plan: ${ref}/\`, mais \`plans/${ref}.revue.md\` n'existe pas et aucun commit ne déclare ` +
      `l'avoir triée. Si la revue n'a pas tourné : lance l'agent \`relecteur-session\` AU PREMIER ` +
      `PLAN (/fin-de-tache, « Relecture de session ») — c'est LUI qui dépose le fichier. Si cette ` +
      `session n'a pas l'outil Agent (sous-agent orchestré) : dis-le en une ligne, l'orchestrateur ` +
      `la lance après collecte (/orchestrer-plan Étape 5). Si tu viens au contraire de la verser ` +
      `dans \`TASKS.md\` au tri de clôture : c'est le repère \`Revues: ${ref}\` qui manque au commit ` +
      `du tri (/fin-de-tache point 16) — le \`.revue.md\` n'étant jamais commité, ce repère est la ` +
      `seule trace qu'il a existé.`
    );
  }
}

for (const d of depassements(cwd)) {
  problemes.push(
    `**${d.fichier} : ${d.lignes} lignes (plafond ${d.plafond}).** ` +
    `Déroule /purge-contexte sur ce fichier — un fichier de contexte trop long est relu à chaque session.`
  );
}

if (problemes.length === 0) riendafaire();

// Marqueur de session : sa présence dit « déjà bloqué une fois », son contenu dit sur quoi. Même
// liste qu'au dernier arrêt → silence ; liste différente → un rappel, et le marqueur suit.
const { dossier: marqueurs, chemin: marqueur } = repereSession(entree, cwd, 'stop');
const empreinte = problemes.join('\n');
let dejaSignale = null;
try {
  if (existsSync(marqueur)) dejaSignale = readFileSync(marqueur, 'utf8');
} catch { /* marqueur illisible : on le réécrit ci-dessous */ }
const memoriser = () => {
  try {
    mkdirSync(marqueurs, { recursive: true });
    writeFileSync(marqueur, empreinte);
  } catch { /* best-effort : sans marqueur, on bloquera au plus une fois de plus */ }
};

// Vague parallèle en cours : seuls les plafonds parviennent ici, et ils appartiennent à la fin de
// plan (/fin-de-tache puis /purge-contexte), pas à la session courante — rappel non bloquant, une
// fois. La condition est mécanique : ne pas la laisser à la charge du modèle, qui devrait sinon
// plaider « c'est volontaire » en prose contre ce hook.
if (sousVerrou) {
  if (dejaSignale === empreinte) riendafaire();
  memoriser();
  repondre({
    systemMessage:
      `⚠ Vague parallèle en cours (\`.claude/wave.lock\`) — rappel NON bloquant :\n- ${problemes.join('\n- ')}\n` +
      `À traiter en fin de plan, via /fin-de-tache puis /purge-contexte.`,
  });
}

// Garde anti-boucle : un seul blocage par session, puis un rappel seulement quand ça change.
if (dejaSignale !== null) {
  if (dejaSignale === empreinte) riendafaire();
  memoriser();
  repondre({
    systemMessage: `⚠ Contexte encore non conforme (rappel non bloquant) :\n- ${problemes.join('\n- ')}`,
  });
}
memoriser();

repondre({
  decision: 'block',
  reason:
    `Avant de rendre la main :\n- ${problemes.join('\n- ')}\n\n` +
    `Si c'est volontaire (session d'exploration, vague parallèle en cours), dis-le explicitement ` +
    `et arrête-toi — ce garde-fou ne se redéclenchera pas.`,
});
