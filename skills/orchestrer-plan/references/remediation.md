# Remédiation et enquête

Annexe de `/orchestrer-plan` — un bloc par geste que le modèle doit écrire, pour les actions `verifier-premisse`, `reprendre`, `enqueter` de la table des
actions (`SKILL.md`). Budget, table nature → modèle, dépendances, vérification du commit d'une
mesure : rendus par `prochaine-action.mjs` (C2), rien de tout ça ne se recalcule ici.

## `verifier-premisse`

Affirmation reprise depuis la section « Ce qu'il faudrait pour que ça passe » du rapport, **elle
seule**, jamais le rapport entier :

```
Agent({
  description: "P<n>/S<k> prémisse",
  subagent_type: "verificateur-premisse",
  run_in_background: false,
  prompt: "Lis ${CLAUDE_PLUGIN_ROOT}/EXECUTANT.md en entier avant ton premier geste : il porte les invariants de lancement.
Vérifie cette affirmation contre le dépôt : « <l'affirmation, telle quelle> ».
Réponse finale en UNE ligne, exactement : PREMISSE: CONFIRMEE|REFUTEE|INDECIDABLE · PREUVE: <une phrase>"
})
```

Agent introuvable : repli `subagent_type: "general-purpose"`, `model: "haiku"`, prompt « Lis `.claude/agents/verificateur-premisse.md` et tiens ce rôle… ». Quatre issues :

- **`REFUTEE`** → rappeler le script (traite la session comme `exécution`) + incident (§9b, nature `prémisse`).
- **`CONFIRMEE`** → `question` (Étape 3 de `SKILL.md`), motif `etape6`.
- **`INDECIDABLE`** → `question`, motif « prémisse invérifiable par lecture : <l'affirmation> ».
- **`INDECIDABLE · comportementale`** → `question`, « à sonder » + option **exploration ouverte**
  (C6) parmi les issues, éligible `Auto : oui` au même titre qu'une issue d'enquête.

## `reprendre` — canal court d'abord

Trois conditions, domicile unique (`WORKFLOW.md` §9c) : (1) identifiant d'agent de la session, gardé à la collecte, jamais `ListAgents` ; (2) `verificateur-n0`
lancé par l'orchestrateur lui-même, vert ; (3) aucune fausse piste (`Blocage :` du rapport nomme un
geste, pas une hypothèse). Les trois tiennent → canal court ci-dessous ; une manque → à froid.

```
SendMessage({
  to: <identifiant d'agent de la session>,
  message: "Reprends : <le geste de `Blocage :`, tel quel>. Réponse finale en UNE ligne, exactement :
VERDICT: PASS|FAIL|ENQUETE|DECISION · MOTIF: <une phrase> · RAPPORT: <chemin, ou ->"
})
```

Consomme une reprise du budget comme à froid ; en échec, **ne se retente pas** — à froid ensuite, plus jamais un `SendMessage` sur cette session.

## `reprendre` — à froid

`modele`/`option` déjà décidés par l'action rendue :

```
Agent({
  description: "P<n>/S<k> reprise",
  subagent_type: "claude",
  model: <modele de l'action>,
  run_in_background: true,
  prompt: "Lis ${CLAUDE_PLUGIN_ROOT}/EXECUTANT.md en entier avant ton premier geste : il porte les invariants de lancement.
Déroule la skill /reprendre-echec pour plans/P<n>/S<k>.echec.md (session S<k> du plan
P<n>). Mode orchestré. Reste dans l'arbre de travail courant : n'ouvre AUCUN worktree.
<si prémisse réfutée : « La prémisse du rapport a été vérifiée et RÉFUTÉE : <preuve, telle quelle>.
Traite la session comme une nature exécution et cherche la cause ailleurs. »>
<si `option` : « Applique l'option <option> de la section ## Issues du rapport, puis rejoue la tâche. »>
<si bloquant de revue corrigeable (C5, quatre conditions du correctif localisé) : « Ce bloquant de revue (§9a) tient les quatre conditions : <bloquant, tel
quel, depuis plans/P<n>/S<k>.revue.md>. Applique le correctif, commit séparé, rejoue la gate. »>
Tout appel Agent que tu fais porte run_in_background: false — verificateur-n0 compris — et aucune
commande n'est détachée. Ta réponse finale CLÔT ton tour : ce qui finit après elle n'est lu par
personne, et « j'attends une tâche de fond » n'est pas un retour.
Incrémente la ligne `Tentatives :` du rapport avant de rendre la main, sauf si tu le supprimes.
Réponse finale en UNE ligne, exactement : VERDICT: PASS|FAIL|ENQUETE|DECISION · MOTIF: <une phrase> · RAPPORT: <chemin, ou ->"
})
```

`fork` interdit sans condition. Ne jamais recopier le `.echec.md`/`.revue.md` au-delà de la ligne citée. Collecte : mêmes règles que l'Étape 1 de `SKILL.md`
(`partial` = `FAIL`, recoupement par les commits). `PASS` → rappeler le script ; `ENQUETE`/`FAIL` →
`enqueter` si le budget le permet (le script tranche) ; `DECISION` → `question`, motif relayé tel quel.

## `enqueter`

Lecture seule (ne corrige rien, ne committe rien, ne lance pas N0), `modele` déjà décidé :

```
Agent({
  description: "P<n>/S<k> enquête",
  subagent_type: "claude",
  model: <modele de l'action>,
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

- **`PISTE`** → rappeler le script : il rend `reprendre` si le budget le permet, sinon `question`.
- **`OPTIONS`** → le script lit déjà `Auto :` pour décider `reprendre`/`question` ; s'il rend `question`, les options viennent de la section `## Issues` du
  rapport (ci-dessous) — l'**exploration ouverte** (C6) en fait partie quand aucune autre n'est
  satisfaisante, éligible `Auto : oui` comme une recommandation réversible jugée par une gate.

**Issues d'une enquête** — seule lecture de fichier de cette annexe au-delà des lignes mécaniques :

```
sed -n '/^## Issues/,/^## /p' plans/P<n>/S<k>.echec.md
```

Relayée **mot pour mot** à l'Étape 3 de `SKILL.md`, jamais résumée ni réordonnée ; absente ou vide → relayer le motif seul et le dire.
