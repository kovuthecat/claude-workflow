# Remédiation et enquête

Annexe de `/orchestrer-plan` — un bloc par geste que le modèle doit écrire, pour les actions `verifier-premisse`, `reprendre`, `enqueter` de la table des
actions (`SKILL.md`). Budget, table nature → modèle, dépendances, vérification du commit d'une
mesure, appel d'agent prêt à recopier (`subagent_type`, `model`) : rendus par `prochaine-action.mjs`
(C2), rien de tout ça ne se recalcule ici.

## Table des natures

Cinq natures possibles sur `Nature :` (`WORKFLOW.md` §9a pour les trois premières) ; ce que
`prochaine-action.mjs` en fait quand la session est en échec — aucun budget de reprise consommé n'y
est recalculé, ce tableau ne fait que nommer l'action rendue (T5, P10/S2) :

| Nature | Action rendue |
| --- | --- |
| `environnement` | `reprendre`, même modèle |
| `exécution` | `reprendre` (escalade : voir la table d'escalade ci-dessous) ou `enqueter` |
| `prémisse` | `verifier-premisse` (ou `question` si une mesure commitée la prouve déjà) |
| `filtre` | `question` — jamais repris à l'identique |
| `interruption` | `relancer-interrompue` — hors budget, avant tout `pousser` |

## Table d'escalade (nature `exécution`)

Décision du 2026-09-24, points 4 et 6 — Opus économe en permanence (T6, P10/S2) :

| Tentative | Modèle |
| --- | --- |
| 1re reprise | le modèle de l'index, inchangé |
| 2e reprise | un cran au-dessus (Haiku→Sonnet, Sonnet→Opus) |
| Passe Opus (reprise ou enquête, session Opus comprise) | **une seule par plan** — au-delà : `question`, source `budget-opus` |

Le décompte vit dans la ligne `Remédiation Opus :` de l'index (`squelette-index.md`), incrémentée
par l'orchestrateur, jamais recalculée sur les `.echec.md` présents (ils disparaissent au PASS).

## `verifier-premisse`

Affirmation reprise depuis la section « Ce qu'il faudrait pour que ça passe » du rapport, **elle
seule**, jamais le rapport entier :

```
Agent({
  description: "P<n>/S<k> prémisse",
  subagent_type: "verificateur-premisse",
  run_in_background: false,
  prompt: "Vérifie cette affirmation contre le dépôt : « <l'affirmation, telle quelle> ».
Réponse finale en UNE ligne, exactement : PREMISSE: CONFIRMEE|REFUTEE|INDECIDABLE · PREUVE: <une phrase>"
})
```

Agent introuvable : repli `subagent_type: "workflow:verificateur-premisse"` ; encore introuvable →
`subagent_type: "general-purpose"`, `model: "haiku"`, prompt « Lis `.claude/agents/verificateur-premisse.md` et tiens ce rôle… ». Quatre issues :

- **`REFUTEE`** → ajouter au `.echec.md` la ligne `Premisse : refutee · <preuve>` (la preuve rendue
  par `verificateur-premisse`, telle quelle), committer, puis rappeler le script — qui traite
  désormais la session comme `exécution` (T5, P10/S2) — + incident (§9b, nature `prémisse`).
- **`CONFIRMEE`** → `question` (Étape 3 de `SKILL.md`), motif `etape6`.
- **`INDECIDABLE`** → `question`, motif « prémisse invérifiable par lecture : <l'affirmation> ».
- **`INDECIDABLE · comportementale`** → `question`, « à sonder » + option **exploration ouverte**
  (C6) parmi les issues, éligible `Auto : oui` au même titre qu'une issue d'enquête.

## `reprendre` — canal court d'abord

Trois conditions, domicile unique (`WORKFLOW.md` §9c) : (1) identifiant d'agent de la session, gardé à la collecte, jamais `ListAgents` ; (2) N0 vert —
`node plugin/bin/n0.mjs` (source) / `node .claude/workflow/bin/n0.mjs` (vendoré), lancé par
l'orchestrateur au premier plan, code de sortie seul (0 = vert), sortie jamais lue ; (3) aucune
fausse piste (`Blocage :` du rapport nomme un geste, pas une hypothèse). Les trois tiennent → canal
court ci-dessous ; une manque → à froid.

```
SendMessage({
  to: <identifiant d'agent de la session>,
  message: "Reprends : <le geste de `Blocage :`, tel quel>. Pas de travail de fond : tout appel Agent
que tu fais porte run_in_background: false, et N0 (n0.mjs) s'exécute au premier plan — aucune
commande détachée. Incrémente la ligne `Tentatives :` de ton rapport avant de rendre la main, sauf
si tu le supprimes ; réécris ton `.echec.md` si tu échoues de nouveau. Réponse finale en UNE ligne,
exactement : VERDICT: PASS|FAIL|ENQUETE|DECISION · MOTIF: <une phrase> · RAPPORT: <chemin, ou ->"
})
```

Consomme une reprise du budget comme à froid ; en échec, **ne se retente pas** — à froid ensuite, plus jamais un `SendMessage` sur cette session. Modèle cible Opus, remédiation Opus pas encore
consommée sur ce plan : incrémenter `Remédiation Opus :` dans l'index (la créer à 1 sous l'objectif
si elle manque), dans le même commit que l'envoi ou juste avant.

## `reprendre` — à froid

`agent`/`option` déjà décidés par l'action rendue :

```
Agent({
  description: "P<n>/S<k> reprise",
  subagent_type: <agent.subagent_type de l'action>,
  model: <agent.model de l'action>,
  run_in_background: true,
  prompt: "Lis ${CLAUDE_PLUGIN_ROOT}/EXECUTANT.md en entier avant ton premier geste : il porte les invariants de lancement.
Déroule la skill /reprendre-echec pour plans/P<n>/S<k>.echec.md (session S<k> du plan
P<n>). Mode orchestré. Reste dans l'arbre de travail courant : n'ouvre AUCUN worktree.
<si prémisse réfutée : « La prémisse du rapport a été vérifiée et RÉFUTÉE : <preuve, telle quelle>.
Traite la session comme une nature exécution et cherche la cause ailleurs. »>
<si `option` : « Applique l'option <option> de la section ## Issues du rapport, puis rejoue la tâche. »>
Tout appel Agent que tu fais porte run_in_background: false, et N0 (n0.mjs) s'exécute au premier
plan — et aucune commande n'est détachée. Ta réponse finale CLÔT ton tour : ce qui finit après elle
n'est lu par personne, et « j'attends une tâche de fond » n'est pas un retour.
Incrémente la ligne `Tentatives :` du rapport avant de rendre la main, sauf si tu le supprimes.
Réponse finale en UNE ligne, exactement : VERDICT: PASS|FAIL|ENQUETE|DECISION · MOTIF: <une phrase> · RAPPORT: <chemin, ou ->"
})
```

Repli à trois crans si `subagent_type` ne résout pas — même forme et même annonce au cran 3 qu'à
l'Étape 1 de `SKILL.md` (T5) : `session-<effort>` → `workflow:session-<effort>` → `claude` (annoncé).

Avant de lancer, `modele` Opus : incrémenter `Remédiation Opus :` dans l'index (la créer à 1 sous
l'objectif si elle manque), dans le même commit que le lancement ou juste avant (`prochaine-action.mjs`
a déjà refusé de rendre cette action si une passe Opus était déjà consommée sur ce plan — ce geste ne
fait qu'enregistrer celle-ci).

`fork` interdit sans condition. Ne jamais recopier le `.echec.md`/`.revue.md` au-delà de la ligne citée. Collecte : mêmes règles que l'Étape 1 de `SKILL.md`
(`partial` = `FAIL`, recoupement par les commits). `PASS` → rappeler le script ; `ENQUETE`/`FAIL` →
`enqueter` si le budget le permet (le script tranche) ; `DECISION` → `question`, motif relayé tel quel.

## `enqueter`

Lecture seule (ne corrige rien, ne committe rien, ne lance pas N0), `agent` déjà décidé :

```
Agent({
  description: "P<n>/S<k> enquête",
  subagent_type: <agent.subagent_type de l'action>,
  model: <agent.model de l'action>,
  run_in_background: true,
  prompt: "Lis ${CLAUDE_PLUGIN_ROOT}/EXECUTANT.md en entier avant ton premier geste : il porte les invariants de lancement.
Déroule la skill /reprendre-echec pour plans/P<n>/S<k>.echec.md (session S<k> du plan
P<n>). Mode enquête : LECTURE SEULE — ne corrige rien, ne committe rien, ne lance pas N0.
Reste dans l'arbre de travail courant : n'ouvre AUCUN worktree. Une passe.
Tout appel Agent que tu fais porte run_in_background: false, aucune commande détachée : ta réponse
finale CLÔT ton tour, ce qui finit après elle n'est lu par personne.
Écris le rapport mis à jour avant de répondre, `Tentatives :` et `Auto :` comprises.
Réponse finale en UNE ligne, exactement : ENQUETE: PISTE|OPTIONS · MOTIF: <une phrase> · RAPPORT: <chemin>"
})
```

Repli à trois crans si `subagent_type` ne résout pas — identique à celui de `reprendre — à froid`
ci-dessus (lui-même celui de l'Étape 1 de `SKILL.md`, T5) : `session-<effort>` →
`workflow:session-<effort>` → `claude` (annoncé).

Avant de lancer, `modele` Opus : incrémenter `Remédiation Opus :` dans l'index (la créer à 1 sous
l'objectif si elle manque), dans le même commit que le lancement ou juste avant.

- **`PISTE`** → rappeler le script : il rend `reprendre` si le budget le permet, sinon `question`.
- **`OPTIONS`** → le script lit déjà `Auto :` pour décider `reprendre`/`question` ; s'il rend `question`, les options viennent de la section `## Issues` du
  rapport (ci-dessous) — l'**exploration ouverte** (C6) en fait partie quand aucune autre n'est
  satisfaisante, éligible `Auto : oui` comme une recommandation réversible jugée par une gate.

**Issues d'une enquête** — seule lecture de fichier de cette annexe au-delà des lignes mécaniques :

```
sed -n '/^## Issues/,/^## /p' plans/P<n>/S<k>.echec.md
```

Les lignes de `## Issues` **sont** les options de l'Étape 3 de `SKILL.md` : recopiées sans rien
changer, ni la forme ni l'ordre ; un ancien rapport d'une autre forme se recopie tel quel aussi.
Absente ou vide → relayer le motif seul et le dire.

## `relancer-interrompue`

Coupure par quota (nature `interruption`, écrite par l'orchestrateur à la collecte, `SKILL.md`
Étape 1) — **hors budget** : ni reprise ni enquête décomptée, dans aucun des deux cas ci-dessous.

1. Attendre la réinitialisation du quota. Le dire à l'utilisateur en une ligne, avec l'heure si le
   message de coupure la donne.
2. `SendMessage` à l'identifiant de la ligne `Agent :` du rapport — **exception écrite** aux trois
   conditions du canal court (`WORKFLOW.md` §9c) : N0 peut être rouge en pleine édition, ce n'est
   pas ce qu'on vérifie ici.

```
SendMessage({
  to: <identifiant de la ligne `Agent :` du rapport>,
  message: "Quota revenu. Reprends où tu t'es arrêtée ; l'arbre contient ton travail partiel. Fin :
`/fin-de-tache` Mode orchestré, dernière ligne `VERDICT:`."
})
```

3. `SendMessage` en échec (agent introuvable, ne répond plus) → reprise **à froid** sur le même
   modèle, par le prompt de `reprendre — à froid` ci-dessus, avec le `.echec.md` en entrée.
4. Dans les deux cas, **aucune reprise du budget n'est consommée** — hors budget signifie aussi hors
   décompte.
5. Au `PASS` qui suit, supprimer le `.echec.md` par un commit (comme toute reprise résolue).
