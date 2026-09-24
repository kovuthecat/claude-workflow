// Hook PreToolUse (Bash | PowerShell | EnterWorktree) — applique les règles git de WORKFLOW.md §4b.
// Ces règles étaient jusqu'ici de la prose répétée dans 3 fichiers ; elles sont ici appliquées.
//   1. staging global interdit (git add -A / . / --all, git commit -a) ;
//   2. commit et push interdits tant qu'une vague parallèle est en cours (.claude/wave.lock) ;
//   3. worktree interdit pendant une vague — une vague partage UN seul arbre de travail.
//
// Les trois règles tolèrent des OPTIONS GLOBALES avant la sous-commande (`git -C <dir> commit`,
// `git -c user.name=x commit`) : sans ce préfixe dans le motif, ces variantes passaient sous la
// regex (T2, P10/S1) — un simple `-C .` suffisait à contourner le refus sous verrou.

import {
  lireEntree, repertoireProjet, vagueParallele, racineIntrouvable, repondre, riendafaire,
} from './lib.mjs';

const entree = await lireEntree();
const commande = entree?.tool_input?.command;
// Le harnais a son propre outil d'isolation (EnterWorktree), qui ne passe pas par une commande :
// il doit tomber sous la même règle que `git worktree add`, d'où le matcher élargi côté settings.
const outilWorktree = entree?.tool_name === 'EnterWorktree';
if (!outilWorktree && (typeof commande !== 'string' || !/\bgit\b/.test(commande))) riendafaire();

const cwd = repertoireProjet(entree);

function refuser(raison) {
  repondre({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: raison,
    },
  });
}

// `git -C <dir>` / `git -c <clé>=<valeur>` : options globales, valides avant n'importe quelle
// sous-commande, répétables (`git -c a=1 -c b=2 commit`). Acceptées ici pour que les trois refus
// ci-dessous voient la sous-commande RÉELLE, quelle que soit l'option globale qui la précède.
const OPTIONS_GLOBALES = String.raw`(?:\s+-(?:C|c)\s+\S+)*`;

if (new RegExp(String.raw`\bgit${OPTIONS_GLOBALES}\s+add\s+(-A\b|--all\b|\.(?:\s|$))`).test(commande)) {
  refuser(
    "WORKFLOW.md §4b : staging global interdit. Stage explicitement les fichiers de la tâche " +
    '(`git add <fichier> <fichier>`) — jamais `git add -A`, `--all` ni `.`.'
  );
}

if (
  new RegExp(String.raw`\bgit${OPTIONS_GLOBALES}\s+commit\b`).test(commande) &&
  /\s-(?:a|[a-zA-Z]*a[a-zA-Z]*)\b|--all\b/.test(commande) &&
  !/--amend/.test(commande)
) {
  refuser(
    "WORKFLOW.md §4b : `git commit -a` interdit. Stage explicitement les fichiers de la tâche, " +
    'puis `git commit -m "…"`.'
  );
}

// Racine introuvable (worktree lié d'un dépôt à `.git` déplacé, plugin/hooks/lib.mjs
// `racineDepot`) : `vagueParallele` rend `true` par refus par défaut, mais le motif n'est pas une
// vague — le dire, plutôt que laisser croire à un `.claude/wave.lock` qui n'existe peut-être pas.
const introuvable = racineIntrouvable(cwd);
const MOTIF_RACINE_INTROUVABLE =
  "Racine du dépôt introuvable (worktree lié d'un dépôt à `.git` déplacé) : committe depuis " +
  "l'arbre principal.";

// Une vague suppose un arbre de travail unique : c'est là que l'orchestrateur (`/orchestrer-plan`)
// a pris sa référence et là que la consolidation committera tâche par tâche. Un diff resté
// dans un worktree n'est vu ni par l'orchestrateur ni par la consolidation — et le verrou interdit
// justement le commit qui permettrait de le rapatrier. Le refus tombe donc à la création.
if (vagueParallele(cwd) && (outilWorktree || (commande ?? '').includes('worktree add'))) {
  refuser(
    introuvable
      ? MOTIF_RACINE_INTROUVABLE
      : "Vague parallèle en cours (`.claude/wave.lock` présent) : les sessions d'une vague partagent " +
        "un seul arbre de travail. Un diff produit dans un worktree n'est vu ni par l'orchestrateur " +
        "(`/orchestrer-plan`) ni par la consolidation de fin de plan, et le verrou interdit le " +
        "commit qui permettrait de le rapatrier. Travaille dans l'arbre courant."
  );
}

if (vagueParallele(cwd) && new RegExp(String.raw`\bgit${OPTIONS_GLOBALES}\s+(commit|push)\b`).test(commande)) {
  refuser(
    introuvable
      ? MOTIF_RACINE_INTROUVABLE
      : 'Vague parallèle en cours (`.claude/wave.lock` présent) : ni commit ni push tant que toutes les ' +
        'sessions du plan ne sont pas exécutées (WORKFLOW.md §4b). La consolidation se fait en fin de plan, ' +
        'tâche par tâche. Supprime `.claude/wave.lock` pour clore la vague.'
  );
}

riendafaire();
