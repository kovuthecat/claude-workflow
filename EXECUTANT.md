# EXECUTANT.md

Ce que lit **en plus** une session d'exécution de plan (`S<k>.md`) — le socle commun
(`CLAUDE-BASE.md`) est déjà dans son contexte, ce fichier ne le répète pas.

## Une session = un fichier

Tu exécutes **UNIQUEMENT** les tâches de ton `S<k>.md`, dans l'ordre, et tu ne lis **QUE** les
fichiers listés sous « Lire ». Le design est fixé : ne reconçois pas.

Tu t'arrêtes quand le geste suivant est un choix que tu n'as pas reçu ; tu ne t'arrêtes pas parce
que quelque chose a cassé (nature de l'échec : `WORKFLOW.md` §9a) :

| Nature | Ce que tu fais |
| --- | --- |
| `environnement`, à ta portée | tu corriges, tu continues, tu le rapportes après |
| `exécution` (N0 rouge) | tu as droit à **une** correction sur l'hypothèse principale (`WORKFLOW.md` §9a) — N0 est le juge, pas l'humain ; encore rouge → `FAIL` |
| `prémisse` fausse | tu t'arrêtes : le périmètre change, et ça, c'est un choix |

L'autonomie ci-dessus ne vaut que là où une gate juge le résultat : **pas de gate ⇒ on demande** —
une tâche dont le plan justifie un `—` (aucun test) n'a pas de N0 qui juge le fond, et y garde le
défaut ancien. Critère général et cas non couverts par la table : `WORKFLOW.md` §9c.

Si tu déclares une **prémisse** du plan fausse, écris-la **falsifiable** — un fait qu'une lecture du
dépôt confirme ou réfute, jamais un jugement : elle sera vérifiée avant d'arrêter le plan (§9c).

## Déléguer plutôt que faire soi-même

| Besoin | Agent |
| --- | --- |
| localiser qqch touchant plus d'1 fichier | `explorateur` |
| build/typecheck/tests | `verificateur-n0` — **jamais en direct** dans la conversation |
| résumer un diff/historique | `resumeur-git` |
| lire une doc externe | `lecteur-doc` |

**Premier plan ou arrière-plan : une seule condition, jamais deux règles de catégorie.**

> **Au premier plan si quelqu'un attend ce verdict dans le tour courant. En arrière-plan si ce qui
> attend est une notification, pas une réponse.**

Les quatre se lancent donc **au premier plan**, jamais `run_in_background: true` : ton appel
conditionne la suite immédiate de la même tâche (`WORKFLOW.md` §5) — c'est le premier cas connu.
Le second est la session que tu es toi-même : l'orchestrateur t'a lancée en arrière-plan parce que
ce qui l'attend est une boucle de notification, pas une réponse dans son tour — ça ne change rien à
ce que tu fais, c'est la même condition vue de l'autre côté. Toute commande détachée obéit à la
même règle : rien n'attend son achèvement dans ton tour, donc jamais dans ta session — ce qui finit
après ta réponse finale n'est lu par personne. Les trois autres agents du workflow
(`relecteur-session`, `verificateur-plan`, `verificateur-premisse`) ne sont pas à toi de lancer —
ils viennent avec `/fin-de-tache`, `/nouveau-plan` et `/orchestrer-plan`.

## Interdits

- **Jamais de dépendance ajoutée seul** : si la tâche en requiert une, elle est déjà tranchée dans
  « Modifier » du plan. Sinon → STOP.
- **Jamais de `fork`** : il rapatrierait le contexte qu'une session de plan existe pour laisser
  derrière.
- **Jamais de worktree.**

## Fin de tâche

Un commit par tâche, staging explicite, repère `Plan: P<n>/S<k>/T<m>` — **jamais de push**.
Dérouler `/fin-de-tache` en fin de session.
