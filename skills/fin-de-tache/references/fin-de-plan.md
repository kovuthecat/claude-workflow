# Fin de plan (toutes les sessions exécutées et validées)

Déroulée par l'orchestrateur sur l'action `cloturer` (mode orchestré), ou par la dernière session en
chaînage manuel. **Jamais par une session lancée par l'orchestrateur** — elle finit par `VERDICT:`,
pas par cette checklist (`EXECUTANT.md`, décision du 2026-09-24 point 2).

Le travail de code et les `.echec.md` sont déjà commités et poussés (C3, §4b) — chaque session a pris
et poussé le sien. Les `.revue.md` sont commitées par l'orchestrateur lui-même, à l'action `relire`
(`orchestrer-plan/SKILL.md` Étape 2) — pas par la session relue, ni en chaînage manuel où c'est la
session elle-même (`/fin-de-tache`, Relecture). Il ne reste que le rangement.

1. **Vérifier qu'il ne reste rien.** `git status` doit être propre hors fichiers de contexte. Ce qui
   traîne encore appartient à une session qui n'a pas déroulé cette checklist : la retrouver plutôt
   que de balayer le reste dans un commit fourre-tout. Un `plans/P<n>/S<k>.echec.md` encore présent
   signale un échec non résolu → ne pas clore le plan (`/reprendre-echec`). Un
   `docs/workflow/incidents/*.md` non commité se committe maintenant
   (`incident(workflow): <slug>`) — il part avec le push du point 7, jamais avant.
2. **Nettoyer les marqueurs** : `.claude/wave.lock` s'il existe, et `.claude/vague/` (sorties brutes
   et identifiants de session — transitoires).
3. **Vérifier que chaque `.revue.md` est commité** (`git ls-files plans/P<n>/*.revue.md`) ; celle qui
   ne l'est pas encore se committe maintenant (`revue(P<n>): S<k> relue, <n> bloquant(s)`, repère
   `Plan: P<n>/S<k>`) — une revue non commitée ici est un défaut de l'action `relire`, jamais un
   oubli à couvrir en silence.
4. **Trier les revues, dans cet ordre — le versement avant la suppression, jamais l'inverse**
   (incident Chords : une suppression qui avait précédé le versement a perdu un bloquant) : chaque
   `plans/P<n>/S<k>.revue.md` est **versé** dans `TASKS.md` — les **bloquants** en tête, marqués
   comme tels, le backlog à la suite, jamais dans `VALIDATION.md` — et chaque `[x]!` que ce versement
   couvre repasse à `[x]` dans `index.md` (`WORKFLOW.md` §4a : verser un bloquant est précisément ce
   qui le passe à `[x]`) ; **puis** chaque `.revue.md` est **supprimé**, dans le même commit que son
   versement : l'historique garde son dépôt et son contenu, plus besoin d'un marqueur séparé pour
   prouver qu'elle a existé. `Couverture : en cours` : verser ce qui est là quand même et noter
   « revue partielle » dans le rapport de clôture. Un `Bloquant : 0` sans backlog ne se verse pas, il
   se supprime tout aussi bien. **Une session qui a produit du code et n'a laissé aucun `.revue.md`
   n'a pas eu de revue** : le signaler dans le rapport de clôture plutôt que de le lire comme « rien
   à signaler ». **Aucun `[x]!` ne survit à la clôture** — un `[x]!` encore là après ce point est un
   défaut de ce point, pas un état normal.
5. **Poser le marqueur** : `Clos : YYYY-MM-DD` (date du jour), une ligne sous l'objectif de
   l'`index.md` du plan.
6. **Ranger le reste du contexte, même geste que pour les revues** : passer à `[x]` les items
   `### MVP` / `### Version 1` de `PROJECT_BRIEF.md` que le plan a livrés, et rien d'autre du brief ;
   lignes purgées de `TASKS.md` ; `STATUS.md` à jour ; points N2 des `S<k>.md` reversés dans
   `VALIDATION.md`, uniquement ce qui reste EN ATTENTE.
7. **Un seul push** — règle, ordre et exceptions : `WORKFLOW.md` §4b (domicile, pas dupliqué ici).
   Les commits de code des sessions sont déjà poussés (C3) : celui-ci ne pousse que le rangement de
   clôture.

## 8b — Le workflow lui-même a changé (dépôt source uniquement, sous `plugin/`)

Depuis n'importe quelle tâche, pas seulement en fin de plan : bumper `version` dans
`plugin/.claude-plugin/plugin.json` + une ligne dans `CHANGELOG.md`, **puis**
`node plugin/bin/publier.mjs` (le dépôt source n'est pas vendoré — `publier.mjs` n'existe qu'à cet
emplacement, jamais sous `.claude/workflow/bin/`). Sans bump, les projets vendorés ne voient jamais
la mise à jour ; sans publication, toute machine neuve embarque une version périmée.

**Puis, dans ce dépôt source seulement** : `claude plugin update workflow@templates --scope local`
— ce dépôt charge son propre plugin par une installation **locale** au poste
(`.claude/settings.local.json`, jamais commité), qui copie `plugin/` dans le cache. **Vérifier le
geste** : `claude plugin list` doit rendre `workflow@templates` à la version tout juste bumpée,
`✔ enabled` — sans ce contrôle, ce poste peut continuer de dérouler la version d'avant le bump
(constat du 2026-09-17, `CLAUDE.md` « Règles spécifiques »).
