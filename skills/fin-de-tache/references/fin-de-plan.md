# Fin de plan (toutes les sessions exécutées et validées)

Déroulée sur l'action `cloturer` (mode orchestré), ou par la dernière session en chaînage manuel.
**Jamais par une session lancée par l'orchestrateur** : elle finit par `VERDICT:` (`EXECUTANT.md`).

Le code et les `.echec.md` sont déjà commités et poussés par chaque session (`WORKFLOW.md` §4b).
**Sous orchestration, le moteur fait les gestes mécaniques** (`prochaine-action.mjs P<n> --appliquer`) :
incidents non commités committés, `.claude/vague/` nettoyé, `.revue.md` committées, `Clos : <date>` posé,
un seul push. `cloturer` rend alors les deux points de jugement ci-dessous (4 et 6) avec ce qui reste
(revues à verser, `[x]!` à repasser, fichiers non commités) ; ils faits, relancer la commande `rappel`
de l'action (`--cloture-faite`) : le moteur pose `Clos :`, pousse et rend `fini`. Refusé tant qu'une
`.revue.md` ou un `[x]!` reste.

**En chaînage manuel**, ces gestes sont à la main, dans l'ordre :

1. `git status` propre hors fichiers de contexte ; ce qui traîne appartient à une session qui n'a pas
   fini, la retrouver plutôt que de tout balayer dans un commit. Un `plans/P<n>/S<k>.echec.md` encore
   présent : ne pas clore (`/reprendre-echec`). Un incident non commité se committe
   (`incident(workflow): <slug>`), il part avec le push final.
2. Supprimer `.claude/vague/` (marqueurs transitoires).
3. Chaque `.revue.md` est commité (`revue(P<n>): S<k> relue, <n> bloquant(s)`, repère `Plan: P<n>/S<k>`).
5. Poser `Clos : YYYY-MM-DD` sous l'objectif de l'`index.md`.
7. Un seul push (`WORKFLOW.md` §4b) : il ne pousse que le rangement de clôture.

**4. Trier les revues** (jugement ; le versement avant la suppression, jamais l'inverse — incident
Chords : une suppression qui avait précédé le versement a perdu un bloquant). Chaque
`plans/P<n>/S<k>.revue.md` est **versé** dans `TASKS.md` — bloquants en tête, marqués comme tels, backlog
à la suite, jamais dans `VALIDATION.md` — et chaque `[x]!` couvert repasse à `[x]` dans `index.md`
(`WORKFLOW.md` §4a) ; **puis** la `.revue.md` est **supprimée**, dans le même commit que son versement.
**Écrire la suppression ainsi** (sous les autorisations d'un projet, `git rm` est refusé — mesure P20/S13) :
`rm plans/P<n>/S<k>.revue.md` seul, une commande par fichier, sans `cd` ni `&&` ; puis
`git add TASKS.md plans/P<n>/S<k>.revue.md` (la suppression se stage par son chemin) et `git commit`, chacun
en son appel.
`Couverture : en cours` : ne pas clore ; terminer la revue ou poser une question. Aucun versement ne
vaut validation d'un prérequis bloqué. Un `Bloquant : 0` sans backlog ne se verse pas, il se supprime.
Une session qui a produit du code sans laisser de `.revue.md` n'a pas eu de revue : le dire dans le
rapport de clôture, jamais le lire comme « rien à signaler ». **Aucun `[x]!` ne survit à la clôture.**

**6. Ranger le reste du contexte** : passer à `[x]` les items `### MVP` / `### Version 1` de
`PROJECT_BRIEF.md` que le plan a livrés, et rien d'autre du brief ; lignes purgées de `TASKS.md` ;
`STATUS.md` à jour ; points N2 des `S<k>.md` reversés dans `VALIDATION.md`, uniquement ce qui reste
EN ATTENTE.

## 8b — Le workflow lui-même a changé (dépôt source uniquement, sous `plugin/`)

Depuis n'importe quelle tâche, pas seulement en fin de plan : bumper `version` dans
`plugin/.claude-plugin/plugin.json` — et sur le `plugin.json` de chaque mod modifié sous
`plugin/mods/` (N0 `tester-mods` le refuse sinon) — + une ligne dans `CHANGELOG.md`, **puis**
`node plugin/bin/publier.mjs` (le dépôt source n'est pas vendoré — `publier.mjs` n'existe qu'à cet
emplacement, jamais sous `.claude/workflow/bin/`). Sans bump, les projets vendorés ne voient jamais
la mise à jour ; sans publication, toute machine neuve embarque une version périmée.

**Le plugin local suit tout seul** : ce dépôt charge son propre plugin par une installation
**locale** au poste (`.claude/settings.local.json`, jamais commité), qui copie `plugin/` dans le
cache. Après une publication réussie, `publier.mjs` lance lui-même
`claude plugin update workflow@templates --scope local` puis vérifie que `claude plugin list` rend
`workflow@templates` à la version bumpée, `enabled` (oubli constaté les 2026-09-17 et 2026-09-29).
**Sortie 3** = publié, mais plugin local NON à jour : lancer la commande affichée à la main, sinon
ce poste continue de dérouler la version d'avant le bump. `publier.mjs` installe aussi les mods du
poste (`installer-mods.mjs`). Dans tous les cas, redémarrer les
sessions ouvertes pour charger la nouvelle version.
