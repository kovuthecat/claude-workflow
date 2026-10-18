# Remédiation et enquête

Annexe de `/orchestrer-plan`, pour les actions `reprendre`, `enqueter` et `relancer-interrompue`. Le
moteur décide seul nature, budget, modèle, agent et ligne `Remédiation Opus :` (`WORKFLOW.md` §9a et
§9c) : ici, seulement les appels que le modèle écrit. Ce qu'il rend par nature : `environnement` →
`reprendre` (même modèle) · `exécution` → `reprendre` (la 2e un cran au-dessus) ou `enqueter` · `prémisse`
→ `verifier-premisse` · `filtre` → `question` · `interruption` → `relancer-interrompue`.

## `reprendre` — canal court d'abord

Trois conditions, domicile unique `WORKFLOW.md` §9c : (1) identifiant d'agent de la session, gardé à la
collecte, jamais `ListAgents` ; (2) N0 vert — `node plugin/bin/n0.mjs` (vendoré :
`node .claude/workflow/bin/n0.mjs`), lancé par l'orchestrateur au premier plan, code de sortie seul,
sortie jamais lue ; (3) aucune fausse piste (`Tentatives : reprise=0` au rapport et `Blocage :` qui nomme
un geste, pas une hypothèse). Les trois tiennent → `SendMessage` ; une manque → à froid.

```
SendMessage({
  to: <identifiant d'agent de la session>,
  message: "Reprends : <le geste de `Blocage :`, tel quel>. Pas de travail de fond : tout appel Agent que
tu fais porte run_in_background: false, et N0 (n0.mjs) s'exécute au premier plan — aucune commande
détachée. Incrémente la ligne `Tentatives :` de ton rapport avant de rendre la main, sauf si tu le
supprimes ; réécris ton `.echec.md` si tu échoues de nouveau. Réponse finale en UNE ligne, exactement :
VERDICT: PASS|FAIL|ENQUETE|DECISION · MOTIF: <une phrase> · RAPPORT: <chemin, ou ->"
})
```

Le canal court consomme une reprise du budget comme à froid ; **en échec, il ne se retente pas** : à
froid ensuite, plus jamais un `SendMessage` sur cette session.

## `reprendre` — à froid

`agent` et `option` viennent de l'action rendue :

```
Agent({
  description: "P<n>/S<k> reprise",
  subagent_type: <agent.subagent_type de l'action>,
  model: <agent.model de l'action>,
  effort: <agent.effort de l'action>,
  run_in_background: true,
  prompt: "Lis ${CLAUDE_PLUGIN_ROOT}/EXECUTANT.md en entier avant ton premier geste : il porte les invariants de lancement.
Déroule la skill /reprendre-echec pour plans/P<n>/S<k>.echec.md (session S<k> du plan P<n>). Mode
orchestré. Reste dans l'arbre de travail courant : n'ouvre AUCUN worktree.
<si l'action porte `option` : « Applique l'option <option> de la section ## Issues du rapport, puis rejoue la tâche. »>
<si une prémisse a été réfutée : « La prémisse du rapport a été vérifiée et RÉFUTÉE : <preuve>. Traite la
session comme une nature exécution et cherche la cause ailleurs. »>
Tout appel Agent que tu fais porte run_in_background: false, et N0 (n0.mjs) s'exécute au premier plan —
aucune commande n'est détachée. Ta réponse finale CLÔT ton tour : ce qui finit après elle n'est lu par
personne. Incrémente la ligne `Tentatives :` du rapport avant de rendre la main, sauf si tu le supprimes.
Réponse finale en UNE ligne, exactement : VERDICT: PASS|FAIL|ENQUETE|DECISION · MOTIF: <une phrase> · RAPPORT: <chemin, ou ->"
})
```

Si l'action porte un `prompt` (reprise après une question), le lancer tel quel. Quel que soit le
verdict, rappeler le moteur : il tranche (`enqueter`, nouvelle reprise ou `question`).

## `enqueter` — lecture seule

```
Agent({
  description: "P<n>/S<k> enquête",
  subagent_type: <agent.subagent_type de l'action>,
  model: <agent.model de l'action>,
  effort: <agent.effort de l'action>,
  run_in_background: true,
  prompt: "Lis ${CLAUDE_PLUGIN_ROOT}/EXECUTANT.md en entier avant ton premier geste : il porte les invariants de lancement.
Déroule la skill /reprendre-echec pour plans/P<n>/S<k>.echec.md (session S<k> du plan P<n>). Mode
enquête : LECTURE SEULE — ne corrige rien, ne committe rien, ne lance pas N0. Reste dans l'arbre de
travail courant : n'ouvre AUCUN worktree. Une passe. Tout appel Agent que tu fais porte
run_in_background: false, aucune commande détachée : ta réponse finale CLÔT ton tour.
Écris le rapport mis à jour avant de répondre, `Tentatives :` et `Auto :` comprises.
Réponse finale en UNE ligne, exactement : ENQUETE: PISTE|OPTIONS · MOTIF: <une phrase> · RAPPORT: <chemin>"
})
```

`PISTE` ou `OPTIONS` : rappeler le moteur (il lit `Auto :`, et sa `question` porte les lignes de `## Issues`).

## `relancer-interrompue`

Coupure par quota : **hors budget**, ni reprise ni enquête décomptée, dans les deux cas ci-dessous.

1. Attendre la réinitialisation du quota ; le dire en une ligne, avec l'heure si le message la donne.
2. `SendMessage` à l'agent de la ligne `Agent :` du rapport — exception aux trois conditions du canal
   court : N0 peut être rouge en pleine édition.

```
SendMessage({
  to: <identifiant de la ligne `Agent :` du rapport>,
  message: "Quota revenu. Reprends où tu t'es arrêtée ; l'arbre contient ton travail partiel. Fin :
`/fin-de-tache` Mode orchestré, dernière ligne `VERDICT:`."
})
```

3. `SendMessage` en échec : reprise **à froid**, même modèle, par l'appel « à froid » ci-dessus.
