# Fin de plan (toutes les sessions exécutées et validées)

Le travail de code, les `.revue.md` et les `.echec.md` sont déjà commités et poussés (C3, §4b) —
chaque session a pris et poussé le sien. Il ne reste que le rangement.

1. **Vérifier qu'il ne reste rien.** `git status` doit être propre hors fichiers de contexte. Ce qui
   traîne encore appartient à une session qui n'a pas déroulé cette checklist : la retrouver plutôt
   que de balayer le reste dans un commit fourre-tout. Un `plans/P<n>/S<k>.echec.md` encore présent
   signale un échec non résolu → ne pas clore le plan (`/reprendre-echec`). Les `S<k>.revue.md`
   encore là sont normaux : ils attendent le tri du point 3. Un `docs/workflow/incidents/*.md` non
   commité se committe maintenant (`incident(workflow): <slug>`) — il part avec le push du point 4,
   jamais avant.
2. **Nettoyer les marqueurs** : `.claude/wave.lock` s'il existe, et `.claude/vague/` (sorties brutes
   et identifiants de session — transitoires).
3. **Ranger le contexte** : passer à `[x]` les items `### MVP` / `### Version 1` de
   `PROJECT_BRIEF.md` que le plan a livrés, et rien d'autre du brief. Statuts complets dans
   l'`index.md` — et **aucun `[x]!` ne survit à la clôture** : verser son bloquant dans `TASKS.md`
   est précisément ce qui le repasse à `[x]`
   (`WORKFLOW.md` §4a). Un `[x]!` encore là en fin de plan veut dire qu'une revue n'a pas été
   triée. Puis : lignes purgées de `TASKS.md`, `STATUS.md` à jour, points N2 des `S<k>.md` reversés
   dans `VALIDATION.md`. **Trier les revues** : chaque `plans/P<n>/S<k>.revue.md` — déjà commité —
   est versé dans `TASKS.md` : les **bloquants** en tête, marqués comme tels, le backlog à la suite,
   jamais dans `VALIDATION.md` — puis **supprimé dans le même commit** : l'historique garde son
   dépôt et son contenu, plus besoin d'un marqueur séparé pour prouver qu'elle a existé.
   `Couverture : en cours` : verser ce qui est là quand même et noter « revue partielle » dans le
   rapport de clôture. Un `Bloquant : 0` sans backlog ne se verse pas, il se supprime tout aussi
   bien. **Une session qui a produit du code et n'a laissé aucun `.revue.md` n'a pas eu de revue** :
   le signaler dans le rapport de clôture plutôt que de le lire comme « rien à signaler ».
4. **Un seul push**, sur `main`, pour l'ensemble du rangement — session cloud comprise, jamais sur
   une branche laissée derrière (`WORKFLOW.md` §4b). Les commits de code des sessions sont déjà
   poussés (C3) : celui-ci ne pousse que le rangement de clôture.

## 8b — Le workflow lui-même a changé (dépôt source uniquement, sous `plugin/`)

Depuis n'importe quelle tâche, pas seulement en fin de plan : bumper `version` dans
`plugin/.claude-plugin/plugin.json` + une ligne dans `CHANGELOG.md`, **puis**
`node plugin/bin/publier.mjs` (le dépôt source n'est pas vendoré — `publier.mjs` n'existe qu'à cet
emplacement, jamais sous `.claude/workflow/bin/`). Sans bump, les projets vendorés ne voient jamais
la mise à jour ; sans publication, toute machine neuve embarque une version périmée.

**Puis, dans ce dépôt source seulement** : `claude plugin update workflow@templates --scope local` — ce dépôt
charge son propre plugin par une installation **locale** au poste (`.claude/settings.local.json`,
jamais commité), qui copie `plugin/` dans le cache. Sans ce geste, ce poste continue de dérouler la
version d'avant le bump (constat du 2026-09-17, `CLAUDE.md` « Règles spécifiques »).
