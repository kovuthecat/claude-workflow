---
name: orchestrer-plan
description: Déroule un plan entier, vague après vague, sans rendre la main entre elles, jusqu'à épuisement, une décision qui appartient à l'utilisateur ou une validation humaine déclarée. À dérouler quand `plans/P<n>/index.md` est prêt.
---

# Orchestrer un plan

Sonnet, jamais Haiku (`WORKFLOW.md` §3 — sonde A non concluante : pas d'agents `session-<effort>`).
Deux gestes en boucle : **lancer des sessions**, **collecter des verdicts**. L'état se calcule par un
script (C2, `prochaine-action.mjs`) depuis les fichiers commités — budget, nature → modèle,
dépendances, recoupement par les commits en sortent : l'action rendue s'exécute, ne se recalcule pas.

## La boucle

`node plugin/bin/prochaine-action.mjs P<n>` (vendoré : `node .claude/workflow/bin/prochaine-action.mjs P<n>`) → exécuter le geste de l'action rendue
(table ci-dessous) → rappeler le script. Jamais d'improvisation entre deux appels, jamais un état
deviné. Avant la toute première vague seulement : si `SessionStart` a signalé un écart de version
vendorée (C4), le régler avant de lancer.

## Interdits — la raison d'être de cette skill

- **Ne jamais ouvrir un `S<k>.md`**, sans exception — un message de commit sous verrou vient
  d'`index.md` (Étape 1). L'`index.md` et `git log` suffisent.
- **Ne jamais lire un diff ni une sortie de build.** Déléguer à `resumeur-git` / `verificateur-n0`.
- **Ne jamais corriger soi-même, ni reprendre une session en échec.** `fork` vers l'agent en échec
  interdit sans condition ; `SendMessage` seulement sous les trois conditions du canal court
  (`references/remediation.md`), sinon à froid.
- **Ne jamais rendre la main sur un manque d'information.** Le script cherche déjà (`enqueter`,
  `verifier-premisse`) ; un arrêt n'est qu'une **question** à options (`WORKFLOW.md` §9c, Étape 3).
- **Ne jamais interpréter le rapport d'une session** : verdict extrait par format contraint.

## Table des actions

| Action rendue | Geste |
| --- | --- |
| `regler-effort` | une fois, avant la première vague : « Sonde A non concluante — pas d'agents `session-<effort>` ; règle l'effort de cette conversation avant que je lance (`WORKFLOW.md` §3) », puis rappeler le script. |
| `lancer` | Étape 1. |
| `verifier-premisse` | `references/remediation.md` — bloc `verificateur-premisse` ; affirmation prise dans `<chemin>`, section « Ce qu'il faudrait pour que ça passe », jamais le rapport entier. |
| `reprendre` | `references/remediation.md` — canal court si ses trois conditions tiennent, sinon reprise à froid ; `modele`/`option` déjà décidés par le script. |
| `enqueter` | `references/remediation.md` — bloc d'enquête ; `modele` déjà décidé par le script. |
| `relire` | Étape 2, pour chaque session de `sessions`. |
| `pousser` | `git pull --rebase` puis `git push` ; conflit → rappeler le script, il rend `question`. |
| `validation-humaine` | Étape 3 : rendre la main, jugement attendu sur `vague`. |
| `question` | Étape 3, format imposé. |
| `fini` | Étape 3, rapport final. |

Action absente de cette table : correctif localisé si possible (`EXECUTANT.md`), sinon `FAIL`
prémisse — comparer à la liste que rend le script, pas à cette table.

## Étape 1 — Lancer la vague

Avant le premier lancement : lire dans `index.md` la ligne de chaque session de `sessions` (modèle,
effort, env, dépendances, zone) et, sous « ## Ordonnancement », le *Pourquoi maintenant* de `vague`
et la ligne « en clair » de chaque session — jamais un `S<k>.md`. Index sans ligne « en clair » :
annoncer sans elle, le signaler une fois, ne jamais l'inventer ni ouvrir le `S<k>.md`.

**Préflight** : (1) **arbre sale** — `resumeur-git` ; un fichier non commité qui intersecte une `Zone modifiée` de la vague → **gate** (`WORKFLOW.md` §9c).
(2) **verrou si `parallele`** — zones disjointes seulement, au moindre doute séquentiel ; poser
`.claude/wave.lock` juste avant le premier lancement, jamais avant. (3) **agents du plugin absents du
bac à sable** — seuls les agents génériques listés : le dire sur « À régler AVANT de lancer », revues
annoncées absentes pour la vague.

**Annoncer, puis lancer** — jamais l'inverse, jamais en ouvrant un `S<k>.md` :

```
▶ Vague <w>/<W> — <n> session(s) en <parallèle|séquentiel>
   Pourquoi cette vague maintenant : <« Pourquoi maintenant » de l'ordonnancement, tel quel>
   Si une session échoue : <je diagnostique, je reprends une fois, j'enquête si la reprise cale —
     je ne te sollicite que s'il y a un choix à faire, et sous forme de question |
     reprise manuelle — je m'arrête et je te rends la main>
   Fin de vague : <validation humaine — je m'arrête pour ton jugement : <ligne N2> | j'enchaîne sur la vague <w+1>>

   S<k> · <titre>
      En clair : <ligne « en clair » de l'index, relayée mot pour mot>
      Tâches <T<a>-T<b>> · <Modèle>/<effort>
      Fichiers touchés : `<zone modifiée>` · Dépend de : <S<j>, déjà passée | —>

   <une strophe par session de la vague, dans l'ordre de l'index>

   Pendant que ça tourne : ne pas modifier les fichiers listés — les sessions y écrivent.
   À la fin : un commit par tâche, retrouvable par son repère `Plan: P<n>/S<k>/T<m>`.
```

Vague qui s'enchaîne dans le même tour : réécrire ce bloc en entier, seul repère de l'utilisateur. **Repli pastille** (contrainte d'outillage — hors Desktop, ou
session marquée `pastille` dans sa ligne « en clair ») : une pastille `spawn_task` par session,
« Démarrer localement », jamais le worktree par défaut, puis rendre la main ; titrer `P<n> · S<k> —
<titre> · <M>/<E>` et sortir « À régler AVANT de lancer » (`WORKFLOW.md` §3).

**Sous-agent, la seule voie** (`WORKFLOW.md` §5b) sinon — un agent par session, dans l'ordre de l'index ; parallèle → tous en arrière-plan, le premier
seul puis les autres une fois qu'il produit (cache, §3b) ; séquentiel → un seul à la fois, arrêt au
premier `FAIL`. `isolation: "worktree"` et `subagent_type: "fork"` interdits ; ne jamais recopier le
`S<k>.md` dans le prompt.

```
Agent({
  description: "P<n>/S<k>",
  subagent_type: "claude",
  model: <modèle lu dans l'index>,
  run_in_background: true,
  prompt: "Lis ${CLAUDE_PLUGIN_ROOT}/EXECUTANT.md en entier avant ton premier geste : il porte les invariants de lancement.
Ouvre plans/P<n>/S<k>.md et exécute-le. Reste
dans l'arbre de travail courant : n'ouvre AUCUN worktree. Déroule /fin-de-tache en fin de session. Tu es orchestrée : si l'outil Agent
n'est pas disponible dans ton bac à sable, saute la relecture de session (je la lance moi-même).
Tout appel Agent que tu fais porte run_in_background: false — verificateur-n0 compris — et aucune
commande n'est détachée. Ta réponse finale CLÔT ton tour : ce qui finit après elle n'est lu par
personne, et « j'attends le rapport de l'agent » n'est pas un retour.
Un blocage se diagnostique avant de conclure (WORKFLOW.md §9a) : ce qui est à ta portée se
corrige et n'est pas un échec. En cas d'ÉCHEC, écris d'abord un rapport de passation dans
plans/P<n>/S<k>.echec.md, ligne `Nature :` comprise (gabarit : skill /reprendre-echec), puis
renvoie son chemin.
Réponse finale en UNE ligne, exactement : VERDICT: PASS|FAIL · MOTIF: <une phrase> · RAPPORT: <chemin, ou ->"
})
```

**Collecter** : lire `VERDICT: … · MOTIF: … · RAPPORT: …`, rien d'autre, en gardant l'identifiant d'agent (canal court, `references/remediation.md`). Sans
`VERDICT:` ni commit : `ListAgents` avant de conclure `FAIL` (un enfant qui tourne encore rend
parfois `PASS`, 2026-09-11). `partial` (tours épuisés) = **toujours** `FAIL`. Recoupement d'un `FAIL`
par les commits : fait par le script au tour suivant, plus par l'orchestrateur. Verdict perdu ou
`partial` : incident (§9b, nature `orchestration`).

**Fin de vague**, sous verrou, dans l'ordre : retirer `.claude/wave.lock` ; committer pour les sessions, tâche par tâche, message et repère `Plan: P<n>/S<k>/T<m>`
**pris dans `index.md`** (C7), jamais dans un `S<k>.md` ; committer les incidents laissés
(`incident(workflow): <slug>`) ; cocher `[x]` des sessions `PASS`. Sans verrou, rien à réécrire (déjà
commité et coché). Puis rappeler le script.

## Étape 2 — Relire (action `relire`)

Une session par appel, au premier plan, dans l'ordre rendu :

```
Agent({
  description: "P<n>/S<k> revue",
  subagent_type: "relecteur-session",
  run_in_background: false,
  prompt: "Lis ${CLAUDE_PLUGIN_ROOT}/EXECUTANT.md en entier avant ton premier geste : il porte les invariants de lancement.
Relis la session S<k> du plan P<n>, mode orchestré, commits présents (git log --grep
\"P<n>/S<k>/\"). Écris plans/P<n>/S<k>.revue.md toi-même, puis rends tes deux lignes."
})
```

`Agent type 'relecteur-session' not found` : repli `subagent_type: "general-purpose"`, `model: "sonnet"`, prompt « Lis `.claude/agents/relecteur-session.md`
et tiens ce rôle pour S<k> de P<n> … ». Repli en échec aussi → `Revue S<k> : absente` au rapport, non
bloquante, + incident (§9b).

Lire seulement les deux lignes rendues, jamais les trouvailles. `Bloquant : <n>` avec n > 0 : une
ligne au rapport (`Revue S<k> : <n> bloquant(s) → plans/P<n>/S<k>.revue.md`), et le statut de S<k>
passe de `[x]` à `[x]!` dans `index.md` (§4a) — non bloquant, la vague suivante s'enchaîne.
`Couverture :` autre que `complète` : `Revue S<k> : partielle → …`, sans fichier d'incident. Puis
rappeler le script.

## Étape 3 — Rapport final, question, validation humaine

**`validation-humaine`** : rendre la main avec ce qu'il y a à juger sur `vague` (aucune mesure ne
remplace ce jugement) et le bloc de relance de la vague suivante (`/fin-de-tache`).

**Rapport** (`fini`, ou avant une `question`) : une ligne par session (`S<k> · PASS/FAIL · motif` ; cycle remédié : `S<k> · FAIL → reprise FAIL → enquête
PISTE → reprise PASS · motif`), une ligne `subagent_tokens` par session, une par usage du canal
court, une par revue à bloquants ou absente, une par incident déposé, une `N1 S<k> : à faire —
<écran>` par motif « N1 au premier plan » relayé tel quel. Sur arrêt : dire en français ce que ça
empêche (sessions bloquées / encore lançables, colonne Dépend de). Push groupé sur `main` en dernier
geste, plan fini ou arrêté — jamais depuis une session, jamais sur une vague `EN ATTENTE`.

**`question`** — dernière position, format imposé :

```
❓ P<n>/S<k> — <la question, une phrase, en français>
   Pourquoi je m'arrête ici : <ce qui a été tenté et ce que ça a donné — deux lignes max,
     motifs relayés tels quels>

   1. <option> — <coût> · débloque <ce que ça rouvre>
   2. <option> — <coût> · débloque <ce que ça rouvre>
   3. <option> — <coût> · débloque <ce que ça rouvre>

   Ma recommandation : <n°>, parce que <une phrase>.
   Rapport : plans/P<n>/S<k>.echec.md · reste lançable sans décider : <S<j>, S<l> | rien>
```

Options jamais inventées ici : `motifs.source` de l'action (`etape6`, `budget-epuise`, `reprise-manuelle`, `wave-lock`) et la section `## Issues` d'un rapport
d'enquête (mot pour mot, `references/remediation.md`) les fournissent. Une seule question par arrêt.
