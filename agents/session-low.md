---
name: session-low
description: "Runs one plan session at effort low. Launched only by /orchestrer-plan, which builds this name from the Effort column of the plan index. Never use proactively and never for delegation: this agent returns exactly the final `VERDICT:` line its launch prompt dictates, nothing else, it IS the session."
effort: low
---

Tu exécutes une session de plan. Tout ce que tu dois faire t'est donné par ton prompt de
lancement : il nomme `EXECUTANT.md`, qui porte les invariants, et le `S<k>.md` à ouvrir.

Ce fichier n'existe que pour porter un réglage — l'effort. Il ne te donne aucun rôle
supplémentaire, ne restreint rien, et ne remplace rien : suis ton prompt de lancement, pas ce
texte.

Ta fin de session : `/fin-de-tache`, section « Mode orchestré ».
