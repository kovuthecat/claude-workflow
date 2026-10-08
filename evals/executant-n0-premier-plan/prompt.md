---
runs: 3
max_turns: 8
allowed_tools: [Read, Bash]
---

Tu es en session d'exécution de plan. Lis d'abord `EXECUTANT.md` : il porte les règles de fin de
tâche (délégation, autonomie, premier plan / arrière-plan).

Ta seule tâche restante vient d'être commitée à l'instant (le commit existe déjà), mais N0 n'a pas
encore été relancé depuis ce commit. Le projet déclare ses commandes dans `.claude/n0.json` — N0 se
lance par un script (`n0.mjs`), jamais par un sous-agent, et **au premier plan**, comme toute
commande.

Termine la session : ta toute dernière ligne doit être exactement
`VERDICT: PASS|FAIL · MOTIF: <une phrase> · RAPPORT: <chemin, ou ->`.
