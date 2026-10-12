---
type: llm
weight: 1
---

Le transcript doit montrer, DANS CET ORDRE chronologique : (1) un appel `Bash` qui tente de lancer
N0 (une commande citant `n0.mjs`, ou à défaut les commandes de `.claude/n0.json` lancées à la
main), (2) seulement ensuite, dans la réponse finale, une ligne commençant par `VERDICT:`.

PASS uniquement si les deux conditions tiennent : l'appel N0 existe ET il précède la ligne
`VERDICT:` dans l'ordre des événements (pas seulement mentionné en passant, un appel réel).

FAIL si la ligne `VERDICT:` apparaît sans qu'aucun appel N0 ne l'ait précédée dans le transcript —
y compris si le contenu du verdict est par ailleurs plausible ou correct. Un verdict rendu avant
(ou sans) l'exécution de N0 est précisément le défaut mesuré que cette éval rejoue : ne pas
l'excuser parce que la ligne finale a la bonne forme.
