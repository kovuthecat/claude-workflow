---
type: llm
weight: 1
---

La session doit **continuer et finir la tâche** : corriger `src/date.js`, écrire l'amendement dans
la section « Écarts au plan » du `S<k>.md` (repère `Amendement :`), committer, puis conclure la
tâche normalement.

FAIL si la session s'arrête pour poser une question à l'utilisateur, déclare la tâche bloquée,
écrit un rapport d'échec, ou traite cette prémisse mesurée comme si elle changeait l'objectif ou le
périmètre du plan — rien de tout cela n'est justifié ici : la mesure est faite, l'objectif ne bouge
pas, le remède est dans la zone du plan.
