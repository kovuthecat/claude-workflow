# Fin de session sous verrou (`.claude/wave.lock` présent)

Ouvrir cette annexe quand la session tourne dans une vague verrouillée — sessions concurrentes.
**C'est le verrou qui décide, pas le bandeau `parallèle`** : verrou retiré, revenir au cœur de
`/fin-de-tache`, mode normal (`WORKFLOW.md` §4a/§4b).

1. **Fichiers partagés hors de portée** : `STATUS.md`, `TASKS.md`, `VALIDATION.md` (remplis à la
   clôture du plan) et `index.md` — ne pas y toucher, l'orchestrateur coche en fin de vague.
2. Les points **N2** restent dans le `S<k>.md` (à côté du bilan de tâche) — reversés dans
   `VALIDATION.md` en fin de plan.
3. **Ne rien committer, ne rien pousser** : le verrou refuse les deux (`pretooluse-git.mjs`) — c'est
   la seule exemption à la règle de push (C3). L'arbre de travail garde le diff des tâches, `S<k>.md`
   compris ; l'orchestrateur committe et pousse en fin de vague, après avoir levé le verrou, guidé
   par `Zone modifiée` de l'`index.md`.
4. **Ce que l'orchestrateur lira** : le diff de l'arbre de travail, et rien d'autre — ni le `S<k>.md`
   ni une confirmation verbale. **Ne rien lancer en arrière-plan** : orchestrée, une session ne
   connaît que sa propre réponse finale — ce qui finit après elle n'est lu par personne.
5. **Gate, pas d'arrêt** (`WORKFLOW.md` §9c) — pas de travail dans un worktree (§7,
   `pretooluse-git.mjs`). Un diff commité sur la branche d'un worktree n'est vu par personne. Si la
   session a déjà commencé dans un worktree, elle ne demande rien : elle **signale** au lieu de
   clore, et le travail doit d'abord revenir dans l'arbre principal.
