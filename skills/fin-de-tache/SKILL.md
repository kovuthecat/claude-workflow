---
name: fin-de-tache
description: Checklist de fin de tâche et de fin de session — statuts, fichiers de contexte, rapport, commit, push. À dérouler quand une tâche T<n> d'une session S<k> est terminée et validée (N0 OK).
---

# Fin de tâche

Lire le bandeau du `S<k>.md` : **parallèle : oui/non** détermine le mode. Qui committe/pousse,
quand, et l'exception `.claude/wave.lock` : `WORKFLOW.md` §4b (domicile). Où vit le statut d'une
tâche : §4a (domicile) — jamais recopié dans un `S<k>.md` ni dans `TASKS.md`.

## Après chaque tâche

1. **N0** : `node .claude/workflow/bin/n0.mjs` (ce dépôt : `plugin/bin/n0.mjs`) — sinon la tâche
   n'est pas finie. **Juste après, avant le N1** : toute skill projet `verif-<chose>`
   (`.claude/skills/`, jamais du workflow vendoré).
2. **N1** si la tâche touchait l'UI : `/verif-visuelle`. Avec navigateur in-app, un défaut N1 se
   corrige maintenant, il ne se reporte pas. Sans (mode checklist de `/verif-visuelle`), il se
   consigne `N1 S<k> : à faire — <écran>` au bilan et au verdict final, et ne bloque pas la tâche.
3. **Bilan** : un seul bloc `## Bilan de session` en fin de `S<k>.md`, créé à la première tâche,
   **réécrit** (pas empilé) aux suivantes — fichiers modifiés · résumé · N0 · N1 · N2 à faire ·
   prochaine action — **toujours**, même sans fichier durable. **Écarts au plan** seulement si le
   bandeau a déclaré une `Latitude`. **Correctif localisé** posé (`WORKFLOW.md` §9a) : en tête du
   bilan.
4. **Commit de la tâche** — sauf `.claude/wave.lock` (§4b). Staging explicite (jamais `-A`, `-a`,
   `commit -a`), `S<k>.md` inclus, repère `Plan: P<n>/S<k>/T<m>` en dernière ligne. Une tâche sans
   fichier de code committe quand même son `S<k>.md`.
5. **Rapport court** dans la conversation : le même contenu que le bilan, en trois lignes.
6. **Skill projet ?** Une procédure dictée ou déroulée ≥2 fois → proposer `.claude/skills/<nom>/`
   (jamais silencieusement). Un contrôle manuel revenu ≥2 fois → proposer `verif-<chose>` (point 1).
7. **Fichier géré modifié** (`.claude/workflow/manifest.json`) ? → réparer dans le dépôt source,
   publier, `/maj-workflow` ici — pas un commit local.
8. **Le workflow a cassé pendant la tâche** ? → `docs/workflow/incidents/<date>-<slug>.md` (gabarit
   et règle : `WORKFLOW.md` §9b), stagé avec le commit de la tâche.

Tâche qui touche `plugin/**` dans ce dépôt source (pas vendoré) → ouvrir `references/fin-de-plan.md`
section « 8b », avant de committer.

## Fin de session

`.claude/wave.lock` présent → ouvrir `references/vague-parallele.md` : c'est le verrou qui décide,
pas le bandeau `parallèle`.

Sinon :

9. **Statut** : `index.md` du plan → `[x]` (ou `[x]!`, revue à bloquant non trié), avec la date,
   dans le commit du point 10 — cocher **sa propre ligne**, et elle seule, si d'autres sessions de
   la vague restent à exécuter.
10. **Contexte** : `STATUS.md` à jour ; les autres fichiers **seulement si leur contenu change**.
11. **N2** : `VALIDATION.md`, uniquement le jugement humain encore EN ATTENTE — supprimer ce qui
    est déjà tranché.
12. **Plafonds** dépassés (hook) → `/purge-contexte` maintenant, pas plus tard.
13. **Push (C3)** : `git pull --rebase` puis `git push` — arbre propre et poussé avant de rendre la
    main. N0 rouge à l'interruption, ou arrêt en cours de tâche → branche `wip/P<n>-S<k>` poussée
    avec le `.echec.md`, jamais `main`. `main` impossible à pousser (cloud) → pousser la branche
    courante et la **nommer** dans la relance. Exemptions : pas de remote, remote injoignable
    (signalé, non bloquant), `wave.lock` (couvert ci-dessus).

Session suivante du plan prête, ou vague/plan à collecter → **bloc de relance obligatoire**, sans
exception : ouvrir `references/bloc-de-relance.md`.

Toutes les sessions du plan exécutées et validées → ouvrir `references/fin-de-plan.md`.
