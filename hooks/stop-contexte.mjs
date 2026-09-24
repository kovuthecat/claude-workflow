// Hook Stop — garde-fou de fin de session.
// Quatre vérifications mécaniques (cf. WORKFLOW.md §7, C3) :
//   1. du code a été modifié mais aucun fichier de suivi ne l'a été → /fin-de-tache non déroulée ;
//   2. une session de plan a commité du code sans laisser trace de sa revue — aucun commit n'a
//      ajouté S<k>.revue.md (git seul juge, plus de repère `Revues:`) → revue jamais lancée ;
//   3. gate de push (C3) : commits d'avance sur l'amont, fichier suivi modifié non commité, ou
//      branche sans amont absente du remote → travail non poussé ;
//   4. un fichier de contexte dépasse son plafond de lignes → archivage dû.
// Ne bloque qu'UNE fois par session : si la seconde tentative d'arrêt arrive, on laisse passer
// (l'exécutant a pu avoir une raison légitime — on ne veut pas d'une boucle infinie). Les rappels
// qui suivent ne sont émis que si la liste des manquements a CHANGÉ depuis le dernier arrêt : un
// orchestrateur enchaîne des dizaines de tours, et le même rappel à chacun n'informait plus
// personne, il polluait.
//
// Sous `.claude/wave.lock`, les vérifications 1 à 3 n'ont pas d'objet : les sessions d'une vague
// parallèle laissent leur diff dans l'arbre sans committer (WORKFLOW.md §4b), et la revue ne peut
// pas précéder des commits qui n'existent pas encore ; la règle de push elle-même est suspendue
// (C3). Les signaler là était le fonctionnement normal relu comme un manquement, à chaque tour de
// l'orchestrateur. Seuls les plafonds restent.
//
// Exemptions de la gate de push (C3) : pas de remote · vague en cours · remote injoignable (hors
// ligne, signalé en avertissement non bloquant, jamais un blocage).

import { mkdirSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import {
  lireEntree, repertoireProjet, estUnDepot, fichiersModifies, fichiersSuivisModifies,
  depassements, estFichierDeSuivi, lirePlafonds, repondre, riendafaire,
  vagueParallele, repereSession, revuesManquantes,
  git, etatAmont, aUnRemote, brancheCourante,
} from './lib.mjs';

const entree = await lireEntree();
const cwd = repertoireProjet(entree);

if (!estUnDepot(cwd)) riendafaire();

const sousVerrou = vagueParallele(cwd);
const problemes = [];
// Avertissements non bloquants : jamais de blocage dessus (réseau injoignable — exemption C3),
// seulement un signal. Ne peut être peuplé que hors vague (le contrôle de push y est suspendu).
const avertissements = [];

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
      `\`Plan: ${ref}/\`, mais git ne trouve aucun commit ayant ajouté \`plans/${ref}.revue.md\`. ` +
      `Si la revue n'a pas tourné : lance l'agent \`relecteur-session\` AU PREMIER PLAN ` +
      `(/fin-de-tache, « Relecture de session ») — c'est LUI qui dépose et commite le fichier. Si ` +
      `cette session n'a pas l'outil Agent (sous-agent orchestré) : dis-le en une ligne, ` +
      `l'orchestrateur la lance après collecte (/orchestrer-plan Étape 5).`
    );
  }

  // Gate de push (C3, WORKFLOW.md §4b) : fin de tour qui rend la main ⇒ arbre propre et poussé.
  // Sans remote, le contrôle est sans objet (exemption C3) — un dépôt purement local n'a rien où
  // pousser.
  if (aUnRemote(cwd)) {
    const amont = etatAmont(cwd);
    const modifiesSuivis = fichiersSuivisModifies(cwd);

    if (amont === null) {
      // Branche sans amont configuré (`wip/…`, branche de preuve, branche cloud) : le seul contrôle
      // possible est direct sur le remote, pas sur une comparaison locale qui n'existe pas.
      const branche = brancheCourante(cwd);
      if (branche) {
        const distante = git(cwd, 'ls-remote', '--heads', 'origin', branche);
        if (distante === null) {
          avertissements.push(
            `Impossible de vérifier si la branche \`${branche}\` est poussée (remote injoignable) — ` +
            `à revérifier une fois la connexion revenue.`
          );
        } else if (distante === '') {
          problemes.push(
            `**Branche \`${branche}\` non poussée.** Aucune branche \`${branche}\` sur \`origin\` ` +
            `— \`WORKFLOW.md\` §4b : pousse-la avant de rendre la main ` +
            `(\`git push -u origin ${branche}\`).`
          );
        } else {
          // La branche EXISTE côté remote — mais sans amont configuré, rien ne dit qu'elle y est
          // encore À JOUR : un premier `git push` sans `-u`, puis un commit de plus jamais repoussé,
          // laissait ce contrôle muet pour toujours (revue de session, plans/P6/S3.revue.md).
          const shaDistant = distante.split(/\s+/)[0];
          const shaLocal = git(cwd, 'rev-parse', 'HEAD');
          if (shaLocal && shaDistant && shaLocal !== shaDistant) {
            problemes.push(
              `**Branche \`${branche}\` non à jour sur \`origin\`.** HEAD local (\`${shaLocal.slice(0, 8)}\`) ` +
              `diffère du dernier commit poussé (\`${shaDistant.slice(0, 8)}\`) — \`WORKFLOW.md\` §4b : ` +
              `pousse avant de rendre la main (\`git push origin ${branche}\`).`
            );
          }
        }
      }
    } else if (amont.avance > 0 || modifiesSuivis.length > 0) {
      // Hors ligne : un `push --dry-run` qui échoue sur le réseau ne doit jamais coûter un blocage
      // plein — il signale seulement (exemption C3).
      const dryRun = git(cwd, 'push', '--dry-run');
      if (dryRun === null) {
        avertissements.push(
          `Push impossible à vérifier (remote injoignable) — ${amont.avance} commit(s) d'avance ` +
          `sur \`${amont.amont}\` et/ou fichier(s) suivi(s) modifié(s) ; à repousser une fois la ` +
          `connexion revenue.`
        );
      } else {
        const detail = [];
        if (amont.avance > 0) detail.push(`${amont.avance} commit(s) d'avance sur \`${amont.amont}\``);
        if (modifiesSuivis.length > 0) {
          const apercu = modifiesSuivis.slice(0, 5).join(', ') +
            (modifiesSuivis.length > 5 ? `, … (${modifiesSuivis.length} au total)` : '');
          detail.push(`fichier(s) suivi(s) modifié(s) non commité(s) : ${apercu}`);
        }
        problemes.push(
          `**Travail non poussé.** ${detail.join(' ; ')} — \`WORKFLOW.md\` §4b : fin de tour qui ` +
          `rend la main ⇒ arbre propre et poussé. \`git pull --rebase\` puis \`git push\` avant de ` +
          `rendre la main.`
        );
      }
    }
  }
}

for (const d of depassements(cwd)) {
  problemes.push(
    `**${d.fichier} : ${d.lignes} lignes (plafond ${d.plafond}).** ` +
    `Déroule /purge-contexte sur ce fichier — un fichier de contexte trop long est relu à chaque session.`
  );
}

if (problemes.length === 0 && avertissements.length === 0) riendafaire();

// Suffixe commun : les avertissements (ex. push injoignable hors ligne, exemption C3) ne bloquent
// jamais — ils s'ajoutent au message, quel qu'il soit, sans jamais entrer dans l'empreinte du
// marqueur anti-boucle (une connexion qui va et vient ne doit pas produire un rappel à chaque tour).
const suffixeAvertissements = avertissements.length > 0
  ? `\n\nAvertissement(s) non bloquant(s) :\n- ${avertissements.join('\n- ')}`
  : '';

if (problemes.length === 0) {
  // Seuls des avertissements non bloquants : jamais de marqueur, jamais de blocage.
  repondre({ systemMessage: `⚠ ${avertissements.join('\n⚠ ')}` });
}

// Marqueur de session : sa présence dit « déjà bloqué une fois », son contenu dit sur quoi. Même
// liste qu'au dernier arrêt → silence ; liste différente → un rappel, et le marqueur suit.
const { dossier: marqueurs, chemin: marqueur } = repereSession(entree, cwd, 'stop');
const empreinte = problemes.join('\n');
let dejaSignale = null;
try {
  if (existsSync(marqueur)) dejaSignale = readFileSync(marqueur, 'utf8');
} catch { /* marqueur illisible : on le réécrit ci-dessous */ }
// Écrit le marqueur ; renvoie si ça a réussi. Un répertoire orphelin au même chemin (crash, conflit)
// ferait échouer `writeFileSync` À CHAQUE appel si on ne l'efface pas : `dejaSignale` resterait
// `null` pour toujours et le hook bloquerait la même session à l'identique, indéfiniment
// (cf. plans/P5/S3.echec.md) — on efface l'obstacle et on retente une fois avant d'abandonner.
const memoriser = () => {
  try {
    mkdirSync(marqueurs, { recursive: true });
    writeFileSync(marqueur, empreinte);
    return true;
  } catch {
    try {
      rmSync(marqueur, { recursive: true, force: true });
      writeFileSync(marqueur, empreinte);
      return true;
    } catch {
      return false; // toujours inscriptible : voir le garde-fou juste avant le blocage plein, plus bas
    }
  }
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
      `À traiter en fin de plan, via /fin-de-tache puis /purge-contexte.${suffixeAvertissements}`,
  });
}

// Garde anti-boucle : un seul blocage par session, puis un rappel seulement quand ça change.
if (dejaSignale !== null) {
  if (dejaSignale === empreinte) riendafaire();
  memoriser();
  repondre({
    systemMessage: `⚠ Contexte encore non conforme (rappel non bloquant) :\n- ${problemes.join('\n- ')}${suffixeAvertissements}`,
  });
}
// Marqueur toujours inscriptible malgré la réparation ci-dessus (droits, disque en lecture seule…) :
// aucun état ne peut être persisté, donc rien ne bornerait un blocage plein qui se répéterait à
// l'identique. On dégrade alors CET appel en rappel non bloquant plutôt que de retenter le blocage
// plein — seul un marqueur qui s'écrit avec succès autorise le blocage plein ci-dessous.
if (!memoriser()) {
  repondre({
    systemMessage:
      `⚠ Contexte non conforme (marqueur de session non inscriptible — rappel non bloquant) :\n- ${problemes.join('\n- ')}${suffixeAvertissements}`,
  });
}

repondre({
  decision: 'block',
  reason:
    `Avant de rendre la main :\n- ${problemes.join('\n- ')}\n\n` +
    `Si c'est volontaire (session d'exploration, vague parallèle en cours), dis-le explicitement ` +
    `et arrête-toi — ce garde-fou ne se redéclenchera pas.${suffixeAvertissements}`,
});
