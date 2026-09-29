# TASKS.md

Index du **backlog** : ce qu'il reste à faire. Une ligne par tâche.
Plafond : **60 lignes** (appliqué par hook). Le dossier `plans/P<n>/` n'est créé qu'au **démarrage**
du plan, pas en amont.

> **Frontières** — TASKS : le *quoi* qui reste · `plans/P<n>/index.md` : l'*avancement* des tâches
> planifiées · `STATUS.md` : l'état actuel (ce qui marche/casse) · `S<k>.md` : le *comment* d'une
> session · `VALIDATION.md` : jugement visuel humain en attente.

## Convention de ligne

**Tâche non planifiée** (pas encore dans un plan) :
`- [ ] T-ID — titre · modèle: X, effort: Y`

**Tâche entrée dans un plan** — elle ne porte **plus de statut ici** (il vit dans l'`index.md`) :
`- T-ID — titre · → plans/P<n>/S<k>.md`

- **modèle** : Opus · Sonnet · Haiku — grille : `WORKFLOW.md` §2
- **effort** : `low · medium · high · xhigh · max` (défaut `medium`) —
  suggestion à **vérifier à la main avant de lancer la session**. Repère : `WORKFLOW.md` §3

## Archivage

Supprimer la ligne d'une tâche dès que son plan est clos — l'historique est dans git.
Ce fichier ne décrit que le futur.

## Tâches

- [ ] T-001 — <titre> · modèle: Sonnet, effort: medium
- [ ] T-002 — <titre> · modèle: Haiku, effort: low
