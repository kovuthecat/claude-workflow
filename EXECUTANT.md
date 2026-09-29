# EXECUTANT.md

Ce que lit **en plus** une session d'exécution de plan (`S<k>.md`). Lancée en sous-agent, tu n'as
**pas** `CLAUDE-BASE.md` (le hook qui l'injecte ne touche pas les sous-agents) : lis
`CLAUDE-BASE.md`, voisin de ce fichier, juste après celui-ci.

## Une session = un fichier

Tu exécutes **UNIQUEMENT** les tâches de ton `S<k>.md`, dans l'ordre. Sa liste « Lire » est un
**point de départ**, pas un plafond : la lecture est ouverte (diagnostiquer une cause n'est borné
par rien), seule l'**écriture** reste bornée à la zone du plan. Le design est fixé : ne reconçois pas.

Tu t'arrêtes quand le geste suivant est un choix que tu n'as pas reçu ; tu ne t'arrêtes pas parce
que quelque chose a cassé (nature de l'échec : `WORKFLOW.md` §9a) :

| Nature | Ce que tu fais |
| --- | --- |
| `environnement`, à ta portée | tu corriges, tu continues, tu le rapportes après |
| `exécution` (N0 rouge) | tu as droit à **une** correction sur l'hypothèse principale (`WORKFLOW.md` §9a) — N0 est le juge, pas l'humain ; encore rouge → `FAIL` |
| défaut **mesuré** hors de ton périmètre (code, instrument de mesure), remède petit et réversible | **correctif localisé** (`WORKFLOW.md` §9a, quatre conditions) : tu corriges, commit séparé — dernière ligne `Correctif localisé : <fichiers> — <défaut mesuré>`, sous `Plan:` — tu rejoues ta gate, tu le signales en tête du bilan — même si ton `S<k>.md` dit « ne corrige pas », sauf `Correctif localisé : interdit` au bandeau |
| `prémisse` fausse, **mais mesure commitée + remède dans ta zone + objectif intact + aucun critère d'arrêt touché** | **amendement** (`WORKFLOW.md` §9a) : tu l'écris dans « Écarts au plan » de ton `S<k>.md` (commit séparé, repère `Amendement :`), tu continues |
| `prémisse` fausse, hors des deux cas ci-dessus | tu t'arrêtes : l'objectif ou le périmètre du plan change, et ça, c'est un choix |

**Budget en hypothèses** : jusqu'à 3 hypothèses **distinctes**, chacune inscrite dans « Déjà écarté »
avant la suivante ; arrêt sur hypothèse répétée, ou contexte > 70 %. Tu peux écrire `Auto : oui`
toi-même sur ton propre `.echec.md`, aux mêmes critères qu'une enquête : `Auto : oui · option <m>`
seulement si le rapport porte une `## Issues` numérotée contenant `<m>` ; sinon `Auto : non`.

Si tu déclares une **prémisse** du plan fausse (hors amendement), écris-la **falsifiable** — un fait
qu'une lecture du dépôt confirme ou réfute, jamais un jugement : elle sera vérifiée avant d'arrêter
le plan (`WORKFLOW.md` §9c). Critère général et cas non couverts par la table : `WORKFLOW.md` §9c.

## Chercher directement ou déléguer

**Tout appel `Agent` : `run_in_background: false`. Aucune commande détachée. Sans exception.**

| Besoin | Agent |
| --- | --- |
| recherche précise, chemins connus, sortie courte (≤ 30 lignes) | `Grep` / `Glob` / `Read` directement ; élargissement nécessaire → `explorateur` |
| exploration large, plusieurs pistes ou traces volumineuses | `explorateur` |
| résumer un diff/historique | `resumeur-git` |
| lire une doc externe | `lecteur-doc` |
| comprendre un flux existant (lecture seule) | `analyste-flux` |
| build/typecheck/tests | script `n0.mjs`, **jamais un agent** : `node .claude/workflow/bin/n0.mjs` (`node plugin/bin/n0.mjs` dans ce dépôt) |

Pourquoi : ton appel conditionne la suite immédiate de la même tâche (`WORKFLOW.md` §5) — c'est le
premier cas de la règle « premier plan si quelqu'un attend ce verdict dans le tour courant, arrière-
plan si ce qui attend est une notification ». Le second cas, c'est la session que tu es toi-même :
l'orchestrateur t'a lancée en arrière-plan parce que ce qui l'attend est une boucle de notification,
pas une réponse dans son tour — ce qui finit après ta réponse finale n'est lu par personne. Les
quatre autres agents du workflow (`relecteur-session`, `verificateur-plan`, `verificateur-premisse`,
`critique-plan`) ne sont pas à toi de lancer — ils viennent avec `/fin-de-tache`, `/nouveau-plan` et
`/orchestrer-plan`.

## Interdits

- **Jamais de dépendance ajoutée seul** : si la tâche en requiert une, elle est déjà tranchée dans
  « Modifier » du plan. Sinon → STOP.
- **Jamais de `fork`** : il rapatrierait le contexte qu'une session de plan existe pour laisser
  derrière.
- **Jamais de worktree.**

## Fin de tâche

Index avec `Preuve N0 : requise` : avant le dernier commit de tâche, lancer N0 **complet** avec
`--session P<n>/S<k>` et committer `plans/P<n>/S<k>.n0.json` avec les fichiers validés.
Un test ciblé sert au diagnostic, jamais de preuve complète. Si des entrées changent après N0,
le relancer ; les fichiers de suivi `plans/`, STATUS/TASKS/DECISIONS/CHANGELOG sont exclus.
Sous verrou : produire la preuve après stabilisation des écritures ; l'orchestrateur la committe.
La preuve vérifie les fichiers Git non ignorés (liens et modes compris) ; pas les services externes.

Teste, dans l'ordre, **avant** d'agir :

1. `.claude/wave.lock` existe ? → **ni commit ni push** : tes fichiers restent dans l'arbre,
   l'orchestrateur committe en fin de vague (`WORKFLOW.md` §4b).
2. Ton prompt exige une ligne `VERDICT:` ? → mode orchestré : `/fin-de-tache`, section « Mode
   orchestré ».
3. Sinon : un commit par tâche, staging explicite, repère `Plan: P<n>/S<k>/T<m>` — commite aussi ta
   propre `.revue.md` une fois déposée (`WORKFLOW.md` §4b). **Push en fin de session** — arbre
   propre et poussé avant de rendre la main, **y compris lancée en sous-agent par l'orchestrateur**
   (la voie normale, `WORKFLOW.md` §5b : ton verdict, ce sont tes commits). Dérouler `/fin-de-tache`
   en fin de session.
