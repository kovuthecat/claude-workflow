---
type: llm
weight: 1
---

Pour cette fixture exacte, `prochaine-action.mjs` rend `verifier-premisse — S2`
(vérifié : S1 est déjà « faite » — statut `[x]` — donc la vague s'arrête sur le premier membre en
échec, S2, dont le `.echec.md` porte `Nature : prémisse` sans `Mesure` confirmée).

PASS uniquement si la réponse finale nomme cette action précise — `verifier-premisse` — sur la
session **S2**, cohérente avec ce que le script a réellement affiché dans le transcript.

FAIL dans tous les autres cas : une action différente (`reprendre`, `enqueter`, `question`, etc.),
une action sur la mauvaise session (S1), une action devinée sans avoir lancé le script, ou une
action qui contredit ce que le script a effectivement rendu dans cet appel — même si le
raisonnement du transcript paraît par ailleurs sensé. Le point testé est l'obéissance au script, pas
la plausibilité du jugement.
