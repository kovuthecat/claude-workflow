# Remédiation et enquête — Étapes 5c et 5d

Annexe de `/orchestrer-plan` — à ouvrir **quand une session a rendu `FAIL`**, pas avant. Tant que
toutes les sessions passent, ce fichier ne se lit pas.

## Étape 5c — Remédiation automatique (à froid, sous budget)

Activée par défaut ; opt-out par le mot `reprise-manuelle` sur la ligne d'ordonnancement de la
vague. Elle ne change rien aux invariants : l'orchestrateur lance et collecte, le jugement vit dans
la session lancée — qui ne connaît que le rapport de passation, jamais cette conversation.

**Quand** : après la clôture de la vague (Étape 5 — verrou retiré, arbre propre), avant la vague
suivante. Une session à la fois, dans l'ordre de l'index, **jamais en parallèle** — l'arbre est
partagé et la vague est déjà close. Rapport `S<k>.echec.md` absent (session tuée avant de
l'écrire) : lancer quand même, `/reprendre-echec` couvre ce cas.

**Quatre greps, rien d'autre** (`WORKFLOW.md` §9a et §9c, domiciles) :

```
grep -m1 '^Nature :'     plans/P<n>/S<k>.echec.md    # absent → exécution
grep -m1 '^Tentatives :' plans/P<n>/S<k>.echec.md    # absent → reprise=0 enquete=0
grep -m1 '^Blocage :'    plans/P<n>/S<k>.echec.md    # absent → démarrage à froid
grep -m1 '^Mesure :'     plans/P<n>/S<k>.echec.md    # présent → prémisse déjà prouvée, pas de vérification
```

**Budget** (§9c) : par session **2 reprises et 1 enquête** ; par plan **2 enquêtes** au total,
comptées dans cette conversation. Épuisé → `DECISION`, sans rien relancer.

### La nature décide, et une prémisse se vérifie avant d'arrêter le plan

| `Nature :` | Ce que l'orchestrateur lance | Modèle |
| --- | --- | --- |
| `prémisse` sans `Mesure :` | **`verificateur-premisse` d'abord** — l'affirmation n'a été vérifiée par personne, et elle arrête un plan entier | Haiku, lecture seule |
| `prémisse` **avec** `Mesure :` | rien à vérifier : la mesure est la preuve. Vérifier seulement que le commit cité existe (`git cat-file -e <commit>`) ; oui → même suite qu'une prémisse `REFUTEE` ; non → traiter comme sans `Mesure :` | — |
| `environnement` | reprise en sous-agent : c'est l'héritage de l'environnement de cette conversation (permissions, outils) qui débloque | **même modèle** que l'index |
| `exécution` (ou absente) | reprise | **un cran au-dessus**, plancher Sonnet (Haiku→Sonnet, Sonnet→Opus) ; **session Opus → pas de reprise, l'enquête directement** (Étape 5d) |
| réponse finale qui **annonce une attente** (« en attente de… », « waiting on… ») sans ligne `VERDICT:`, enfants tous `completed` | reprise en sous-agent | **même modèle** : c'est la frontière de tour qui a coupé, pas le modèle — monter d'un cran paie de l'Opus pour recommiter du travail déjà vert (2026-09-13, deux fois) |
| session **tuée par le filtre de contenu** (`Output blocked by content filtering`, HTTP 400, visible dans la notification du harnais — la session n'a pas pu écrire de `.echec.md`) | rien | `DECISION`, motif « sortie filtrée : changer la mécanique d'écriture, pas le modèle » |

Monter de modèle sur un échec d'environnement ou de prémisse a coûté plusieurs reprises Opus et
Fable pour rien (constat du 2026-09-09) : le modèle n'était pas la cause, et la reprise ne faisait
que refaire le diagnostic. Même constat pour le filtre de contenu : quatre relances identiques
payées le 2026-09-10 pour un verdict identique.

**Vérification de prémisse** — l'affirmation est recopiée depuis la section « Ce qu'il faudrait
pour que ça passe » du rapport, **elle seule**, jamais le rapport entier :

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

Agent introuvable dans le bac à sable → même repli que pour la revue : `general-purpose`,
`model: "haiku"`, prompt commençant par « Lis `.claude/agents/verificateur-premisse.md` et tiens ce
rôle… ». Trois issues :

- **`REFUTEE`** → la session s'est trompée de diagnostic : reprise comme une nature `exécution`
  (un cran au-dessus), **la preuve recopiée dans le prompt de lancement** — elle dit où la cause
  n'est pas. Et **déposer un fichier d'incident** (`WORKFLOW.md` §9b, nature `prémisse`) : une
  prémisse fausse est une donnée pour le dépôt source, c'est sur ce comptage qu'on saura si la
  vérification vaut son coût.
- **`CONFIRMEE`** → `DECISION` : le périmètre du plan change, c'est un arbitrage. Options à poser
  (Étape 6) déjà connues.
- **`INDECIDABLE`** → `DECISION`, motif « prémisse invérifiable par lecture : <l'affirmation> » —
  ni enquête ni reprise, c'est exactement ce qu'un humain tranche.
- **`INDECIDABLE · comportementale`** → question, avec la mention « à sonder » dans les options.

### Le test des trois conditions (canal court)

Avant de lancer quoi que ce soit, tester si le canal court s'applique — les trois conditions sont
un domicile unique, `WORKFLOW.md` §9c, appliquées ici sans être recopiées :

1. **`ListAgents`** — la session en échec y apparaît (reprenable).
2. **Lancer un `verificateur-n0`**, au premier plan, sur le périmètre de la session — vert.
3. **Les deux greps déjà faits** : `Tentatives : reprise=0`, et `Blocage :` nomme un geste (pas une
   hypothèse — une hypothèse va dans « Hypothèse en cours » du rapport et disqualifie le canal
   court).

Les trois tiennent → **canal court**, bloc `SendMessage` ci-dessous. Une seule manque → **démarrage
à froid**, bloc `Agent({` plus loin, inchangé.

### Lancer par `SendMessage` (canal court)

```
SendMessage({
  to: <l'agent de la session S<k>, depuis ListAgents>,
  message: "Reprends : <le geste de `Blocage :`, tel quel>. Réponse finale en UNE ligne, exactement :
VERDICT: PASS|FAIL|ENQUETE|DECISION · MOTIF: <une phrase> · RAPPORT: <chemin, ou ->"
})
```

Une ligne, adressée à l'agent, qui nomme le geste — la collecte ne change pas (mêmes quatre issues
que la reprise à froid, ci-dessous). Ce qui borne : `SendMessage` consomme une `reprise` du budget
comme n'importe quelle reprise ; un `SendMessage` qui échoue **ne se retente pas** — la reprise
suivante est un démarrage à froid, et plus jamais un `SendMessage` sur cette session.

### Lancer la reprise (démarrage à froid)

```
Agent({
  description: "P<n>/S<k> reprise",
  subagent_type: "claude",
  model: <selon la table ci-dessus>,
  run_in_background: true,
  prompt: "Lis ${CLAUDE_PLUGIN_ROOT}/EXECUTANT.md en entier avant ton premier geste : il porte les invariants de lancement.
Déroule la skill /reprendre-echec pour plans/P<n>/S<k>.echec.md (session S<k> du plan
P<n>). Mode orchestré. Reste dans l'arbre de travail courant : n'ouvre AUCUN worktree.
<si prémisse réfutée : « La prémisse du rapport a été vérifiée et RÉFUTÉE : <preuve, telle quelle>.
Traite la session comme une nature exécution et cherche la cause ailleurs. »>
Incrémente la ligne `Tentatives :` du rapport avant de rendre la main, sauf si tu le supprimes.
Réponse finale en UNE ligne, exactement : VERDICT: PASS|FAIL|ENQUETE|DECISION · MOTIF: <une phrase> · RAPPORT: <chemin, ou ->"
})
```

`fork` reste interdit sans condition. `SendMessage` vers l'agent en échec n'est permis que sous les
trois conditions ci-dessus (canal court) ; hors de ces conditions, il reste interdit — le démarrage
à froid est le point de cette reprise. Ne jamais recopier le contenu du `.echec.md` dans le prompt,
ne jamais l'ouvrir ici.

**Collecte** : mêmes règles que l'Étape 4 — ligne de verdict seule, `partial` = `FAIL`, recoupement
par les commits avant de conclure `FAIL`. Quatre issues :

| Verdict | Ce que fait l'orchestrateur |
| --- | --- |
| **`PASS`** | la reprise a commité, supprimé le `.echec.md` et coché `[x]` : vérifier la coche, lancer la revue de session si son `.revue.md` manque (Étape 5 — une reprise est un sous-agent, elle n'a souvent pas pu la lancer), puis reprendre le plan où il s'était arrêté : les sessions **jamais lancées** de la même vague d'abord (vague séquentielle arrêtée au `FAIL`, retour Étape 3), sinon la vague suivante (Étape 5, cas « Sinon » — la gate d'une vague `gate` s'applique toujours) |
| **`ENQUETE`** | l'hypothèse est épuisée : **Étape 5d**, si le budget le permet ; sinon `DECISION` |
| **`FAIL`** | correction tentée, N0 toujours rouge : **Étape 5d**, si le budget le permet ; sinon `DECISION` |
| **`DECISION`** | arrêt du plan, motif relayé tel quel, sans l'interpréter — question posée à l'Étape 6 |

`FAIL` n'est plus un arrêt : un humain qui le recevait n'avait aucune information de plus que
l'orchestrateur, il lançait une enquête (§9c). Elle se lance ici.

Plusieurs `FAIL` dans la même vague : une session à la fois, cycle complet (5c puis 5d) avant de
passer à la suivante ; la première qui rend `DECISION` arrête le plan, les sessions restantes ne
sont pas remédiées (elles restent `FAIL` au rapport, leur `.echec.md` intact).

## Étape 5d — Enquête (lecture seule, une par session)

**Quand** : une reprise a rendu `ENQUETE` ou `FAIL`, et le budget le permet (`enquete=0` sur cette
session, moins de 2 enquêtes sur ce plan). Sinon : `DECISION`, motif = celui de la reprise.

Elle ne corrige rien, ne committe rien, ne lance pas N0 : elle cherche une hypothèse neuve, ou
constate qu'il n'y en a pas et nomme les issues (procédure : `/reprendre-echec`, « Mode enquête »).

```
Agent({
  description: "P<n>/S<k> enquête",
  subagent_type: "claude",
  model: <modèle de l'index, plancher Sonnet — jamais un cran au-dessus : le levier est
          l'information, pas le modèle>,
  run_in_background: true,
  prompt: "Lis ${CLAUDE_PLUGIN_ROOT}/EXECUTANT.md en entier avant ton premier geste : il porte les invariants de lancement.
Déroule la skill /reprendre-echec pour plans/P<n>/S<k>.echec.md (session S<k> du plan
P<n>). Mode enquête : LECTURE SEULE — ne corrige rien, ne committe rien, ne lance pas N0.
Reste dans l'arbre de travail courant : n'ouvre AUCUN worktree. Une passe.
Écris le rapport mis à jour avant de répondre, `Tentatives :` comprise.
Réponse finale en UNE ligne, exactement : ENQUETE: PISTE|OPTIONS · MOTIF: <une phrase> · RAPPORT: <chemin>"
})
```

- **`PISTE`** → **une** reprise de plus (Étape 5c, `reprise=2`), même modèle que la reprise
  précédente — l'enquête a fourni ce qui manquait, pas un problème de modèle. Son verdict est
  terminal : `PASS` → le plan reprend ; autre chose → `DECISION`, le budget est épuisé.
- **`OPTIONS`** → `DECISION`. La question est déjà écrite : la section `## Issues` du rapport.

**La seule lecture de fichier autorisée à cette skill**, et elle est bornée :

```
sed -n '/^## Issues/,/^## /p' plans/P<n>/S<k>.echec.md
```

Relayée **mot pour mot** à l'Étape 6, jamais résumée, jamais réordonnée, jamais complétée. Ce n'est
pas ouvrir un rapport pour enquêter (interdit en tête de skill) : c'est recopier une section écrite
pour l'utilisateur, comme la ligne « en clair » de l'index l'est à l'Étape 3. Section absente ou
vide → relayer le motif seul et le dire.

