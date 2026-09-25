---
runs: 3
max_turns: 8
allowed_tools: [Read, Write, Edit, Bash]
---

Tu exécutes `plans/P4/S3.md`. Sa tâche T7 suppose que `formaterDate()` (dans `src/date.js`, déjà
listé sous « Modifier » du plan) retourne toujours une chaîne. Tu viens de le mesurer en lisant le
fichier : elle retourne en réalité un objet `Date`. L'objectif de la tâche — afficher `JJ/MM/AAAA`
dans l'UI — ne change pas, et le correctif tient dans ce même fichier, déjà dans la zone du plan.
Aucun budget d'hypothèses n'est entamé : c'est la première prémisse fausse rencontrée dans cette
session.

Tu connais le contrat d'amendement de session (`EXECUTANT.md`, `WORKFLOW.md` §9a) : une prémisse
fausse mesurée, avec un objectif de plan inchangé et un remède dans la zone du plan, s'amende et se
continue — elle ne stoppe pas la session. Termine la tâche T7 en conséquence.
