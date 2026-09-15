# WORKFLOW.md — Modèles, effort, plans, validation, garde-fous

Source unique pour la répartition du travail, le format des plans et les niveaux de validation.
Les autres fichiers y renvoient au lieu de le paraphraser.
Modèles actuels : Fable 5 · Opus 5 · Sonnet 5 · Haiku 4.5.

**Les squelettes de plan ne sont plus ici** : ils vivent dans la skill `/nouveau-plan`, qui ne les
charge qu'au cadrage. Ce fichier reste lisible d'un bout à l'autre sans coûter un plan complet.

## 1. Principe directeur

**Opus pense, les autres font.**

- **Opus** (cher) : design, cadrage, écrit les plans.
- **Fable** : hors workflow — lancé à la main par le mainteneur pour un cadrage ou une analyse ;
  jamais dans une grille, une escalade ou une skill.
- **Sonnet** : exécute les tâches cadrées de complexité moyenne, juge le code.
- **Haiku** (rapide) : exécute les tâches cadrées et mécaniques.
- **Claude Design** (claude.ai, humain aux commandes) : maquette UI au cadrage d'un projet ou d'un
  nouvel écran — entrée = `ARCHITECTURE.md` envoyé tel quel, sortie = `design/maquettes/`. Le
  câblage se fait ensuite sur la maquette, jamais l'inverse.

Une fois le plan écrit, chaque exécutant lit **UNIQUEMENT** les fichiers listés dans sa session
(`S<k>.md`) et ne reconçoit pas — le design est fixé.

### Deux régimes, tous deux normaux

Le principe ci-dessus vaut pour le travail **spécifiable** — celui dont on peut énoncer le
résultat attendu avant de l'obtenir. Ce n'est pas tout le travail.

| Régime | Quand | Ce qui borne | Livrable |
| --- | --- | --- | --- |
| **fixé** | le résultat s'énonce avant de l'obtenir | le périmètre d'écriture fermé | des commits sous gate N0 |
| **ouvert** | la réponse n'existe qu'à l'exécution | une branche jetable, un budget, N0 à la fin | une **preuve mesurée** |

Le régime ouvert n'est pas une exception tolérée : c'est le bon régime pour un problème de
recherche, et l'employer tôt coûte moins que cinq plans fermés qui meurent chacun sur une prémisse
(décision du 2026-09-14). L'aiguillage se fait au cadrage, jamais en session — `/cadrer` sort par
un protocole de preuve, `/nouveau-plan` Étape 0 détecte la répétition qui le réclame.

### Quand solliciter un humain

**Demander quand il y a un choix, agir quand il y a une gate.**

On sollicite un humain **uniquement** pour ce qui est irréversible, et pour un jugement esthétique
ou produit (N2). Tout ce qu'une gate sait juger — N0 au premier chef — se fait **sans demander**,
et se rapporte après : le geste, pourquoi, et ce qu'il a changé.

Le critère est mécanique. Si l'agent sait nommer le remède, que le remède est réversible et que
son effet est jugé par une gate, demander n'est pas un contrôle, c'est de la latence — un plan a
payé trois arrêts et trois arbitrages pour faire valider un remède que la session avait déjà écrit
(2026-09-13). À l'inverse, un arbitrage entre deux conceptions possibles se demande toujours,
même s'il retarde.

Ce qui remplace l'autorisation préalable, c'est la **lisibilité après coup** : une décision prise
seule s'écrit, reste réversible, et se rapporte par ses conséquences — ce qui devient possible, ce
qui casse, ce qu'il faudra maintenir (décision du 2026-08-30, « écrire pour qui décide »).

## 2. Choix du modèle

| Nature de la tâche | Modèle | Exemples |
| --- | --- | --- |
| Design, bug non localisé, scope flou, transverse, arbitrage produit | **Opus** | Architecture, cadrage neuf, plan multi-tâche |
| Cadré, jugement de code, localisé, complexité moyenne | **Sonnet** | Bug isolé, refactor limité, feature moyenne, code review |
| Cadré, mécanique, peu de jugement, petit | **Haiku** | Renommage, purge de contexte, boilerplate, consolidation de fin de plan |

**Départage une fois le périmètre clair :**

- **Sonnet** si jugement de code, analyse transverse, risque à peser, ou gros volume répétitif.
- **Haiku** si mécanique/simple, petit périmètre (1-2 fichiers), résultat évident.
- **Escalade vers Opus** si la cause d'un bug n'est pas localisée, le scope est flou, ou il reste
  des choix produit.

## 3. Effort — et comment le distinguer du modèle

**Le modèle, c'est la capacité. L'effort, c'est la quantité de travail.** Les deux se diagnostiquent
sur des symptômes différents, et les confondre coûte cher dans les deux sens :

| Symptôme observé | Ce qu'il faut changer |
| --- | --- |
| Il se trompe **alors qu'il avait tout le contexte** — raisonnement faux, domaine mal maîtrisé | **Monter de modèle** |
| Il a **sauté des fichiers**, pas lancé les tests, abandonné une tâche multi-étapes en route | **Monter l'effort** |
| Il tourne en rond sur la même erreur depuis 2 relances | **Monter de modèle, pas l'effort** |
| Il produit du correct mais lentement/verbeusement sur une tâche triviale | **Baisser l'effort** |

Échelle réelle (vérifiée dans la doc Anthropic le 2026-08-22, `model-config`) :
`low · medium · high · xhigh · max` (pas de niveau `minimal`).

- `low` : mécanique, résultat quasi certain (renommage, purge, consolidation).
- `medium` : **défaut du workflow** — implémentation courante.
- `high` : raisonnement soutenu, arbitrages, bug localisé mais subtil.
- `xhigh` : code agentique complexe, bug non localisé, cadrage neuf. Réservé, pas par défaut.
- `max` : au-delà de `xhigh`, mêmes réserves d'usage — jamais par défaut ; non réglable via
  `effortLevel` du projet, seulement via `/effort max` en session (rendements décroissants documentés).

Le défaut vient de `.claude/settings.json` du projet, pas de Claude Code. Chaque session porte
**modèle + effort + environnement** dans le bandeau de son `S<k>.md` — à **régler avant de lancer
la session**, aucun routing automatique.

**L'effort suit le modèle** (v0.31.0). Le gabarit pose une table `modelSettings` alignée sur la
grille ci-dessus — Opus `high`, Sonnet `medium`, Haiku `low` — donc choisir le modèle porte
l'effort avec lui, et il n'y a plus qu'un réglage à faire au lancement. `/effort` en session
court-circuite la table : c'est la dérogation explicite, à consigner dans le bandeau du `S<k>.md`.

⚠️ **La table n'est pas une commodité, c'est un cran d'arrêt.** Claude Code consulte
`modelSettings.<modèle>.effortLevel` **avant** la clé racine `effortLevel`, et ce quel que soit le
fichier d'où vient chacune. Un `/effort` lancé une fois écrit `modelSettings` dans les settings
**utilisateur**, qui battrait ensuite l'`effortLevel` du projet — dans tous les projets, en
silence. La table du gabarit reprend la main : `modelSettings` suit, lui, la précédence normale
(local > projet > utilisateur).

**Rappel systématique à l'humain qui lance** — *domicile de cette règle, les skills y renvoient.*
Une pastille `spawn_task`, une commande affichée ou un « lance S3 » démarre avec les **réglages
ambiants de l'application**, jamais avec ceux du plan : rien, dans le lancement, ne pose le modèle
ni l'effort à la place de l'utilisateur. Toute skill qui rend la main pour qu'un humain lance une
session écrit donc, juste avant, cette ligne — valeurs prises dans l'`index.md` :

```
À régler AVANT de lancer — S<k> : modèle <M> · effort <E>   (la pastille hérite des réglages courants)
```

Un effort élevé consomme plus de tokens sur *chaque* tour de la session : le laisser à `xhigh` en
permanence est le poste de dépense le plus silencieux du workflow.

## 3b. Coût et cache

Sources : <https://code.claude.com/docs/en/prompt-caching.md> et la doc API du prompt caching.
Un hit de cache coûte **0,1×** le prix d'entrée ; TTL 5 min par défaut, 1 h possible.

**L'invalidation a trois étages, pas un.** Un changement n'invalide que son étage et ceux du
dessous — « ✓ » = le cache survit :

| Changement | Outils | Système | Messages |
| --- | :---: | :---: | :---: |
| Modèle (`/model`), définitions d'outils, serveur MCP ajouté/retiré | ✗ | ✗ | ✗ |
| Contenu du prompt système | ✓ | ✗ | ✗ |
| Effort, `thinking` | ✓ | selon modèle | ✗ |
| Contenu des messages, images | ✓ | ✓ | ✗ |

Seuls un changement d'**outils** et un changement de **modèle** forcent une reconstruction
complète — et le modèle n'a **aucune échappatoire** : les caches sont scopés par modèle.
`/rewind` conserve le préfixe. Éditer `CLAUDE.md` en cours de session n'invalide rien et ne sert à
rien : l'édition ne s'applique qu'après `/clear`.

**Deux seuils à connaître.** Le minimum cacheable dépend du modèle et n'est pas monotone :
512 tokens sur Opus 5, 1 024 sur Sonnet 5, **4 096 sur Haiku 4.5**. En dessous, rien n'est mis en
cache — sans erreur ni signal. Et chaque point de reprise ne remonte que **20 positions** : un run
d'appels d'outils *parallèles* compte pour une seule position, un long run *séquentiel* peut
pousser l'entrée précédente hors de portée.

Conséquences pour le workflow :

- Régler modèle **et effort** avant de lancer (§3) est une règle de cache, pas d'hygiène : un
  changement en cours de session repaie tout le préfixe. Depuis la v0.31.0 ce n'est plus seulement
  écrit — le hook `SessionStart` le vérifie, et `PostModelSwitch` trace les changements (§7).
- `/rewind` pour couper une fausse piste ; `/compact` seulement avant une pause — ou **juste avant
  un changement de modèle délibéré** (fin d'exploration en Opus, exécution en Sonnet) : le cache
  est détruit par le switch de toute façon, et tant qu'il est chaud la requête de résumé relit le
  préfixe au tarif cache. Jamais avant une **escalade** en revanche : on escalade parce que le
  modèle précédent a échoué, et un résumé écrit par lui perd justement les impasses et le texte des
  erreurs qui justifiaient l'escalade. Là, c'est le bloc de passation qu'il faut (`/fin-de-tache`).
- Compacter **tôt** n'économise rien : ça déplace le coût. (À ne pas confondre avec
  `/purge-contexte`, qui range des fichiers sur disque et n'a rien à voir avec le cache.)
- Une skill avec `model:` en frontmatter invoquée en cours de conversation coûte un préfixe
  complet — acceptable pour une skill qui ouvre la session (`/orchestrer-plan`), pas pour une
  skill courte lancée en cours de route (`/purge-contexte`).
- Chaque sous-agent part à froid : il **ne lit jamais** le cache de son parent, et son préfixe
  (règles injectées, descriptions de skills, `CLAUDE.md`) est payé plein tarif **par session**,
  pas à 1/10 — d'où l'exigence d'un socle commun court. Corollaire du seuil ci-dessus : sur un
  agent Haiku multi-tours, un préfixe descendu sous 4 096 tokens ne cache plus rien du tout. L'effet
  absolu reste petit (il est borné par la taille du préfixe) : ce n'est pas un argument contre le
  raccourcissement du socle, qui profite à toutes les sessions.
- **Lancer une vague en décalé, pas d'un bloc.** Deux sessions du même dossier partagent le cache
  si le snapshot git est identique — mais une entrée n'est lisible qu'**après le début du streaming
  de la première réponse**. Des sessions démarrées ensemble écrivent chacune la leur et n'en lisent
  aucune. Lancer la première, attendre ses premiers tokens, puis lancer les suivantes : sur une
  vague de 4, la part partagée passe d'environ 5,0× à 1,55× le prix d'entrée. Et toujours : ne rien
  committer entre deux lancements de la même vague.

## 4. Plans

Le backlog vit dans `TASKS.md` (index global). Un plan est toujours précédé d'une **décision écrite** :
si le QUOI ou le POURQUOI n'est pas tranché, dérouler **`/cadrer`** dans une session séparée — sa
sortie (`docs/decisions/`) est l'entrée du plan.

En amont encore : quand la question elle-même n'est pas identifiée — les correctifs et les ajouts se
sont empilés, personne ne sait plus si le chemin pris tient — **`/revue-de-conception`** la trouve.
Elle constate l'écart entre l'intention écrite et le code réel, **recale l'objectif avec
l'utilisateur en interview** (c'est souvent le but qui a bougé, pas le code qui a dérivé), puis sort
un rapport dans `docs/revues/` et remet l'écrit à jour. Tout autre arbitrage sort en `/cadrer`, à
froid.

Puis Opus déroule **`/nouveau-plan`**, qui crée un dossier `plans/P<n>/` :

- **`plans/P<n>/index.md`** — guide d'orchestration : objectif, table des sessions, ordonnancement
  par vagues. **C'est le seul endroit où vit le statut des tâches.**
- **un fichier par session** `S<k>.md` — une session = un lancement de Claude Code (un modèle, un
  effort, un contexte), 1 à n tâches. Contenu = décision finale + chemins + étapes ; **pas** les
  alternatives (elles sont dans `docs/decisions/`).

L'exécutant ouvre **uniquement** son `S<k>.md`. Format, règle de découpage et squelettes :
skill `/nouveau-plan`.

Une correction qui **débloque un plan en cours** s'ajoute à ce plan (sessions suivantes, vague de
remédiation) au lieu de devenir `P<n+1>` : aiguillage et plafond dans `/nouveau-plan` Étape 0.

### 4a. Un statut, un seul endroit

*Domicile de cette règle : les autres fichiers renvoient ici, ne la reformulent pas.*

Le suivi a échoué chaque fois qu'une même information a dû être écrite à plusieurs endroits. Donc :

| Information | Vit dans | Ne vit PAS dans |
| --- | --- | --- |
| Avancement d'une tâche d'un plan | `plans/P<n>/index.md` | `S<k>.md`, `TASKS.md` |
| Backlog non planifié | `TASKS.md` | ailleurs |
| État actuel de l'app | `STATUS.md` | `TASKS.md`, historique |
| Décision (verdict) | registre `DECISIONS.md` | plans, `CLAUDE.md` |
| Décision (justification) | `docs/decisions/<date>-<slug>.md` | registre |
| Jugement visuel en attente | `VALIDATION.md` | `S<k>.md` (sauf vague parallèle) |
| Incident de workflow (§9b) | `docs/workflow/incidents/<date>-<slug>.md` | `TASKS.md`, `STATUS.md`, la conversation |

**Qui a le droit de cocher `index.md`** : un seul juge à la fois, décidé par `.claude/wave.lock` —
mécanisme complet en §4b, ne pas le reformuler ici.

**Trois statuts, pas deux** — *vocabulaire, domicile ici* :

| Statut | Veut dire |
| --- | --- |
| `[ ]` | pas lancée, ou lancée sans verdict |
| `[x]` | `PASS`, revue déposée sans bloquant (`Bloquant : 0`) ou sans diff à relire |
| `[x]!` | `PASS`, **mais la revue a trouvé au moins un bloquant** — travail commité, défaut connu, non trié |

Le troisième existe parce que le verdict est **auto-déclaré** : c'est la session qui vient d'écrire
le code qui rend `PASS`. La relecture indépendante (`relecteur-session`) arrive après, et elle est
non bloquante par construction (§5b) — sans marque distincte, sa seule trace vivante est un fichier
`.revue.md` non commité, et un `[x]` plein efface la différence entre « relu, rien à signaler » et
« relu, un défaut réel trouvé ». Le plan ne se clôt pas sur un `[x]!` : le tri de clôture
(`/fin-de-tache` point 16) verse le bloquant dans `TASKS.md` et **c'est ce versement qui le passe à
`[x]`**. Un `[x]!` qui reste est un défaut connu que personne n'a arbitré — jamais un oubli
d'écriture.

`[x]!` ne relance rien, n'arrête aucune vague et ne change aucune dépendance : une session `[x]!`
satisfait les dépendances des suivantes exactement comme un `[x]`.

### 4b. Commits & parallélisation

*Domicile de cette règle : les autres fichiers renvoient ici, ne la reformulent pas.*

**Chaque session committe son propre travail**, tâche par tâche, avant de rendre la main : staging
explicite, message prévu dans le `T<n>`. La session qui vient d'écrire le code est la seule à savoir
quels fichiers sont les siens — le faire reconstituer plus tard, par un autre modèle, coûte plus cher
et se trompe.

*Renversement du 2026-08-24.* La règle précédente reportait tous les commits en fin de plan. Le prix
réel s'est vu sur MYO P1 : un arbre de travail où trois sessions avaient déposé leurs fichiers, et une
consolidation qui devenait une fouille — confiée, qui plus est, au modèle le moins cher du plan.

Chaque commit porte le repère de sa tâche en dernière ligne. C'est ce qui rend l'attribution mécanique
après coup (`git log --grep`), au lieu de la faire deviner :

```
Plan: P<n>/S<k>/T<m>
```

Un second repère, réservé au commit de tri de la clôture (`/fin-de-tache` point 16) : `Revues:
P<n>/S<k>[, …]`, les revues de session versées dans `TASKS.md` puis supprimées. Le `.revue.md` n'est
jamais commité — ce repère est la seule trace qu'il a existé, et sans lui le hook `Stop` relit sa
suppression comme une revue jamais lancée (§7).

- **Ce qu'une session committe** : les fichiers de ses tâches, son `S<k>.md`, et le fichier
  d'incident si le workflow a cassé pendant la tâche (§9). Rien d'autre.
- **N0 vert d'abord** : `build` + `typecheck` + tests du périmètre. Un commit qui ne compile pas
  transforme le point de retour en piège.
- **À jour avant de commencer.** Vérifier qu'on n'est pas en retard sur `origin/main` et rattraper
  (`git pull --rebase`) **avant la première tâche** — le hook `SessionStart` le constate et le dit
  (§7). Coder sur un arbre en retard, c'est préparer un conflit ou écraser ce qui a été poussé
  d'ailleurs.
- **Le push est groupé, et il va sur `main`.** Ni à chaque tâche ni à chaque session : à la clôture
  d'une **unité de travail** — fin d'orchestration (`/orchestrer-plan` Étape 6), fin de plan
  (`/fin-de-tache` point 17), fin de cadrage (`/cadrer` Étape 5), fin de `/nouveau-plan`. **Session
  cloud comprise** : le travail atterrit sur `main`, jamais sur une branche laissée derrière — une
  branche que personne ne rapatrie est un décalage de plus, pas une précaution.
- **L'`index.md` suit le verrou, pas le mot « vague »** : `.claude/wave.lock` présent → la session
  n'y touche pas, l'orchestrateur coche en fin de vague ; verrou absent → la session coche **sa
  propre ligne** dans le commit de ses tâches. Un statut, une seule main (§4a) — mais la main est
  celle de la session dès qu'il n'y a pas de concurrence, sans quoi la session suivante ne voit
  jamais sa dépendance satisfaite.
- `git add -A`, `git add .` et `git commit -a` restent refusés par hook : sans staging explicite,
  une session emporte les fichiers de ses voisines.

*Précision du 2026-09-09.* Le push était dit « groupé, en fin de vague ou de plan » — mais `/cadrer`
et `/nouveau-plan` n'en parlaient nulle part : leurs écrits (une décision, un dossier de plan)
pouvaient rester locaux indéfiniment, et l'entrée dans un plan ne vérifiait rien. Le prix s'est vu le
2026-09-09 : un clone du dépôt de distribution resté deux semaines sur une version périmée, et — déjà
le 2026-08-28 — un dépôt source publié en `--force` depuis un arbre en retard, qui avait amputé le
miroir public (d'où le garde-fou de `bin/publier.mjs`). Un commit qui dort en local n'existe pour
aucune autre machine : ni le poste voisin, ni une session cloud, ni le mobile.

**Parallélisme réel — l'unique exception.** Deux sessions lancées en même temps partagent un
seul index git — sous-agents concurrents (§5b) : `git commit` prend l'état du dépôt, pas celui de la
session, donc chacune emporterait
le travail en cours de l'autre. Pour ces vagues-là **seulement**, poser `.claude/wave.lock` (à mettre
en `.gitignore` — marqueur local, pas du contenu de projet) : une **gate** (§9c) refuse alors commit
et push (§7) — elle ne demande rien, elle se contente de refuser —, les sessions laissent leur diff
dans l'arbre, et **l'orchestrateur committe pour elles en fin
de vague**, tâche par tâche, guidé par les colonnes `Zone modifiée`. Une vague dont les sessions se
suivent, quelle que soit la voie, n'a pas besoin du verrou.

Le filet de sécurité intra-plan est désormais git lui-même : chaque session laisse un point de retour
nommé. `/rewind` reste utile **dans** une session ; il n'a jamais rien pu pour ce qui se passe entre
deux conversations parallèles.

- **Fin de plan** : plus de consolidation de commits à faire. Restent `STATUS.md`, `TASKS.md`,
  `VALIDATION.md` à mettre à jour, et **un seul push**.

## 5. Déléguer au lieu de faire

Chercher, lancer une commande verbeuse ou lire une doc externe remplit le contexte de traces
(chemins, sorties, fausses pistes) qu'on paie ensuite à chaque tour — et c'est justement en cadrage
Opus, le contexte le plus cher, qu'on en accumule le plus.

Neuf agents du plugin, chacun ne rend que sa **conclusion** — jamais les traces brutes :

- `explorateur` → localiser quelque chose qui touche plus d'1 fichier.
- `analyste-flux` → lire **comment** un flux fonctionne, quand localiser ne suffit pas.
- `verificateur-n0` → lancer build/typecheck/tests (jamais ces commandes en direct dans la
  conversation principale).
- `resumeur-git` → résumer un diff ou un historique.
- `lecteur-doc` → lire une doc externe.
- `relecteur-session` → relire le diff d'une session close et **déposer** son `.revue.md`
  (`/fin-de-tache`).
- `verificateur-plan` → confronter un plan fraîchement écrit au dépôt, avant son commit
  (`/nouveau-plan` Étape 4b).
- `verificateur-premisse` → confronter au dépôt l'affirmation par laquelle une session en échec
  déclare le plan faux, **avant** qu'elle n'arrête le plan (`/orchestrer-plan` 5c, §9c).
- `critique-plan` → confronter un plan à ses risques de conception **avant** son approbation
  (`/nouveau-plan` Étape 1bis) ; ne juge ni le périmètre produit ni le style.

**Les quatre derniers ont la même raison d'être : personne ne relit son propre travail.** Le
cadreur ne voit pas sa découpe fausse, ni la faille de conception dans le plan qu'il vient
d'écrire, l'exécutant ne voit pas son PASS vide, la session en échec ne voit pas que sa prémisse
est fausse — dans les quatre cas le contrôle vaut par le fait qu'il vient d'ailleurs, pas par sa
finesse.

Les neuf se lancent **au premier plan** — condition posée dans `EXECUTANT.md`, domicile unique de
l'invariant de lancement (§5b) : leur verdict conditionne la suite de la même tâche — une session ne rend la main qu'après l'avoir lu. Le
`relecteur-session` est le dernier geste de la session : lancé en arrière-plan, son retour
n'atteindrait aucun tour et la revue ne serait jamais déposée.

**`fork`** : légitime quand la tâche a besoin du contexte courant **et** produit du bruit à
retenir dehors (outils, itérations) — il hérite la conversation et réutilise le cache, seul son
résultat revient. Jamais pour une session de plan ni une reprise d'échec (il rapatrierait le
contexte qu'elles existent pour laisser derrière), ni pour une restitution pure sans appel d'outil
(écrire soi-même coûte moins). Détail : `docs/decisions/2026-08-30-contexte-des-sous-agents.md`.

**Pas de `memory:` sur les neuf agents** : une mémoire d'agent n'est légitime que pour une
information dont aucun fichier du dépôt n'est déjà la source — commandes (`CLAUDE.md`),
localisation (`PROJECT_MAP.md`) et état git n'en sont pas.

## 5b. Sessions & voies d'orchestration

*Domicile de cette règle : les autres fichiers renvoient ici, ne la reformulent pas.*

**Domicile de l'invariant de lancement.** Tout bloc `Agent({ … })` de `plugin/**` porte, dans son
`prompt:`, cette ligne au mot près :

```
Lis ${CLAUDE_PLUGIN_ROOT}/EXECUTANT.md en entier avant ton premier geste : il porte les invariants de lancement.
```

Une paraphrase est une copie qui dérivera — pas de reformulation, même fidèle. Le contrôle de
publication (`plugin/bin/publier.mjs`) vérifie sa présence dans chaque bloc, jamais son sens : il ne
sait jamais dire qu'un renvoi est faux, seulement qu'il est absent.

**Jamais deux sessions d'un même plan dans une seule conversation** — chacune démarre à froid, pour
ne pas traîner le contexte de l'une dans l'autre.

- **Session par session, à la main** : la skill `/fin-de-tache` pose une pastille qui lance la
  suivante.
- **Vague entière, sans intervention** : dérouler `/orchestrer-plan`.

**Voie normale : sous-agent.** Toute session orchestrée se lance avec l'outil `Agent`, en
arrière-plan — c'est le défaut, quel que soit l'environnement, `Env. = —` dans l'index. Le
sous-agent hérite du navigateur in-app de la session d'orchestration (donc son N1) et de tout son
environnement (permissions, MCP) : zéro préflight, zéro clic. Le verdict est celui de ses commits
(§4b). La session d'orchestration doit rester ouverte pendant ce temps : les sous-agents vivent en
elle.

**Cet arrière-plan-là est celui de la session entière — pas celui de ses délégations internes.**
Une fois lancée, la session exécutante reste soumise à §5 : ses propres appels à `verificateur-n0`
et aux trois autres agents restent au premier plan, qu'elle ait été lancée à la main ou par
l'orchestrateur. Confondre les deux a déjà coûté plusieurs échecs — une session qui lance son N0 en
arrière-plan avant de committer se referme, elle aussi, sans rien avoir committé
(`docs/decisions/2026-09-04-delegation-au-premier-plan.md`).

**L'effort d'un sous-agent est celui de la conversation qui le lance.** L'outil `Agent` règle le
modèle, pas l'effort : le sous-agent hérite de l'effort **ambiant** de la session d'orchestration.
`/tasks` pendant qu'une vague tourne affiche le modèle réel de chaque sous-agent — vérifier plutôt
que supposer. Les neuf agents du workflow portent leur `model:` en frontmatter ; les agents
intégrés lancés au fil de l'eau (`Explore`, `general-purpose`, `Plan`), eux, suivent
`CLAUDE_CODE_SUBAGENT_MODEL` du gabarit de settings, faute de quoi ils hériteraient du modèle de la
conversation — donc d'Opus dans un cadrage.
Régler cette conversation à l'effort le plus haut de la vague **avant** de dérouler
`/orchestrer-plan` (le rappel « À régler AVANT de lancer » de §3 vaut pour l'orchestrateur
lui-même) couvre donc `high` sans sortir de la voie normale — l'orchestrateur tourne sur Haiku et
ne fait que lancer et collecter, l'effort élevé lui coûte peu.

**Voie headless retirée (v0.30.0).** L'orchestrateur tournait en Sonnet `high` de toute façon (les
sous-agents héritent de l'effort ambiant, §3b) : la voie `claude -p` ne servait plus qu'à survivre à
une fenêtre fermée, et elle a produit une classe entière d'incidents propres à son outillage
(allowlist incomplète, trust dialog, refus d'`Edit`, classificateur de sortie) — le sous-agent, seule
voie désormais, hérite de tout l'environnement de la conversation et n'a besoin d'aucun de ces
garde-fous. Réintroduire une voie headless : `docs/decisions/2026-09-12-une-seule-voie-d-orchestration-et-hooks-testes.md`.

**Repli — hors Claude Code Desktop** (VSCode, terminal, session cloud), quand aucune pastille ni
navigateur in-app n'est disponible : revenir au chaînage manuel du premier point, une pastille
`spawn_task` (ou la commande du bandeau) par session terminée. La vague ne se termine alors plus
dans le même tour — c'est un repli, pas le fonctionnement normal.

## 6. Validation — trois niveaux

| Niveau | Qui | Bloquant | Contenu |
| --- | --- | --- | --- |
| **N0 — auto** | Claude, toujours | **oui** | `build` + `typecheck` + tests du périmètre touché (`—` justifié sinon) |
| **N1 — visuel auto** | Claude, si navigateur in-app | non | erreurs console, contenu présent, requêtes 4xx/5xx, responsive |
| **N2 — humain** | l'utilisateur | non | jugement esthétique / UX / ton — **rien d'autre** |

**N1 est nouveau et change la règle précédente** : Claude Code Desktop dispose d'un navigateur
in-app (`preview_start`, `read_page`, `read_console_messages`…). Ce qu'un navigateur peut constater
seul n'a plus à être délégué à un humain — et ne doit donc plus atterrir dans `VALIDATION.md`, qui
gonflait de checklists jamais dépilées.

**L'environnement conditionne N1** : le navigateur in-app n'existe **que** dans Claude Code Desktop —
ni VSCode, ni terminal, ni session cloud (`claude.ai/code`, appli mobile). D'où :

- le bandeau de chaque `S<k>.md` porte `Environnement : Desktop (navigateur requis) | indifférent`,
  et l'`index.md` a une colonne **Env.** ;
- une session dont le N1 est structurant (nouvel écran, refonte de mise en page) se lance depuis
  Desktop ;
- lancée ailleurs, la skill `/verif-visuelle` bascule en mode B : elle **sort la commande dev et la
  checklist** au lieu de vérifier, et rend la main.

Hors navigateur in-app, Claude ne valide **jamais** l'UI autrement : pas de Playwright, pas de
capture par script.

Protocole complet : skill **`/verif-visuelle`**.

## 7. Garde-fous appliqués (hooks)

Les règles ci-dessus qui comptent vraiment ne sont pas seulement écrites : elles sont **appliquées**
par cinq hooks (`${CLAUDE_PLUGIN_ROOT}/hooks/`). Le câblage réel vit désormais dans `hooks.json` du
plugin (chemins `${CLAUDE_PLUGIN_ROOT}`) — le `settings.json` d'un projet n'en porte plus la
définition. Une instruction ne contraint rien ; un hook si.

| Hook | Événement | Ce qu'il fait |
| --- | --- | --- |
| `sessionstart-contexte.mjs` | SessionStart | Signale : retard sur `origin/main` (après un `git fetch` plafonné à 6 s) et branche autre que celle d'intégration (§4b), vague en cours, **session lancée dans un modèle qu'aucune session `[ ]` des plans ouverts ne demande** (lu dans `plans/P*/index.md`, seul porteur des statuts — §4a ; muet pendant une vague, où les sous-agents héritent du modèle de l'orchestrateur), `STATUS.md` en retard de ≥3 commits, plafonds dépassés, dépôt sous un dossier synchronisé (`SynologyDrive`/`OneDrive`/`Dropbox`/`iCloud`) sans témoin `.git/info/synchro-exclue`. Silencieux si tout est sain, et sans objet sur un dépôt sans remote. Mémorise `HEAD` au démarrage — c'est ce repère qui permet au hook `Stop` de savoir ce que la session a commité. |
| `pretooluse-git.mjs` | PreToolUse (Bash/PowerShell/EnterWorktree) | Refuse `git add -A`/`.`/`--all` et `git commit -a` ; refuse commit, push et ouverture de worktree tant que `.claude/wave.lock` existe. |
| `posttooluse-format.mjs` | PostToolUse (Edit/Write) | Formate via prettier si configuré dans le projet, silencieux sinon. |
| `postmodelswitch-journal.mjs` | PostModelSwitch | Écrit une ligne JSONL par changement de modèle dans `.claude/journal-modeles.jsonl` (date, `de`, `vers`, session). **Ne bloque jamais** : `PreModelSwitch` pourrait refuser un switch, mais mettre de la friction sur une escalade que §2 recommande serait le mauvais arbitrage — on trace, on n'empêche pas. Le journal est le seul retour d'expérience sur la grille §2 : un modèle systématiquement escaladé n'est pas un incident, c'est une ligne de grille fausse (entrée de `/analyser-incidents`). Sous `.claude/`, donc invisible au hook `Stop` — il ne peut ni déclencher un faux « fin de session non consignée », ni en satisfaire un à tort. |
| `stop-contexte.mjs` | Stop | **Gate** (§9c) : refuse de rendre la main si du code a été modifié sans qu'aucun fichier de suivi ne le soit, si une session de plan a commité du code sans laisser trace de sa revue (ni `.revue.md` sur disque, ni repère `Revues:` de tri de clôture — §4b), ou si un plafond est dépassé — elle refuse, elle ne demande rien. Ne bloque qu'une fois par session, et ne rappelle ensuite que si la liste des manquements a changé. **Sous `.claude/wave.lock`, seuls les plafonds sont signalés** : un diff non commité et une revue absente y sont le fonctionnement normal (§4b), pas un manquement — les signaler à chaque tour ne faisait que polluer l'orchestrateur. |

### Plafonds de lignes

Source unique : `${CLAUDE_PLUGIN_ROOT}/hooks/plafonds.json`.

| Fichier | Plafond |
| --- | --- |
| `STATUS.md` | 80 |
| `TASKS.md` | 60 |
| `VALIDATION.md` | 60 |
| `DECISIONS.md` (registre) | 150 |
| `PROJECT_MAP.md` | 200 |
| `CLAUDE.md` | 200 |

Un dépassement n'est pas une suggestion, c'est une **gate** (§9c) : elle déclenche `/purge-contexte`
avant de continuer, sans rien demander. Ces fichiers sont relus à chaque session — leur longueur
est un coût récurrent, pas un détail.

## 8. Anti-patterns

- Lancer Opus sur une tâche déjà cadrée.
- Reprendre un échec d'environnement ou de prémisse avec un modèle au-dessus (§9a).
- Conclure `FAIL` sans avoir nommé la nature de l'échec, ou s'entêter au-delà d'une correction sur
  la même hypothèse (§9a).
- **Arrêter un plan sur une prémisse que personne n'a confrontée au dépôt** (§9c).
- **Rendre la main à un humain sur un manque d'information** — il lancera l'enquête qu'on savait
  lancer, et la latence est le coût dominant d'une orchestration (§9c).
- Poser un arrêt comme un rapport à lire plutôt que comme une question à options (§9c).
- À l'inverse : trancher à la place de l'utilisateur — étendre un plan, annuler une migration,
  élargir une permission — ou relancer hors budget (2 reprises, 1 enquête par session, §9c).
- Signaler un incident de workflow en prose dans une conversation, ou dans `TASKS.md` (§9b).
- **Relancer une 3ᵉ fois la même session en montant l'effort** alors que le modèle est le problème (§3).
- Laisser `xhigh` comme effort permanent « au cas où ».
- Envoyer à Sonnet/Haiku un scope flou ou trop large → dérive.
- Empiler dans une session des tâches qui ne remplissent pas les critères de regroupement — ou, à
  l'inverse, payer un démarrage froid pour une tâche `low` qui aurait dû s'adosser à un lot.
- Explorer le repo dans le contexte Opus au lieu de déléguer à un subagent (§5).
- Faire soi-même ce qu'un agent mécanique rendrait en 10 lignes (sortie de build verbeuse,
  exploration de fichiers, lecture de doc externe).
- Improviser des tâches hors du `S<k>.md` en cours ; mélanger deux sessions dans un même lancement.
- Enchaîner deux sessions d'un même plan dans une seule et même conversation (§5b).
- Reporter ses commits à plus tard (§4b) — une session committe le sien, et lui seul.
- Ouvrir une session sans vérifier qu'on est à jour, ou clore une unité de travail sans pousser sur `main` (§4b).
- Écrire dans `VALIDATION.md` ce qu'un navigateur constate seul (§6).
- Recopier un statut à deux endroits (§4a).
- Recopier du texte au lieu de pointer vers la source (`WORKFLOW.md`, `docs/decisions/`…).
- Laisser grossir un fichier de contexte au-delà de son plafond « juste pour cette fois ».

## 9. Échecs et incidents

*Domicile de cette règle : les autres fichiers renvoient ici, ne la reformulent pas.*

### 9a. Diagnostiquer avant de conclure

Une session qui échoue ne rend pas `FAIL` sur un symptôme : elle nomme d'abord la **nature** de
l'échec, parce que c'est elle — pas le modèle en place — qui décide de ce qui doit suivre.

| Nature | Ce que c'est | Ce que la session fait | Reprise (`/orchestrer-plan` 5c) |
| --- | --- | --- | --- |
| **environnement** | l'outillage a empêché la tâche, pas la tâche elle-même : permission refusée, outil absent (`Agent`, navigateur), hook qui refuse, verrou, worktree, dépendance non installée, humain requis absent | à portée → **corriger et continuer**, ce n'est pas un échec ; hors de portée → `FAIL` avec la remédiation nommée, **et un fichier d'incident** (§9b) | **même modèle**, en sous-agent (hérite de l'environnement) |
| **exécution** | tentée dans un environnement sain, elle n'aboutit pas : N0 rouge, résultat faux, bug non localisé | **une** correction sur l'hypothèse principale, N0 juge ; encore rouge → `FAIL`, la tentative va dans « Déjà écarté » | **un cran au-dessus** (règle de 2026-08-30) |
| **prémisse** | le diagnostic montre qu'une hypothèse du plan est fausse : attendu contredit par la mesure, contrat à changer, tâche irréalisable dans son périmètre | `FAIL` **sans corriger** — on ne corrige pas un plan dans une session ; l'hypothèse qui tombe s'écrit **falsifiable**, un fait qu'une lecture confirme ou réfute | **vérification d'abord** (`verificateur-premisse`) : réfutée → reprise comme une `exécution` ; confirmée → question à l'utilisateur (§9c) |

Un échec par **filtre de contenu** (sortie bloquée par la politique du modèle) est une nature à
part, ni environnement ni exécution : il ne se reprend jamais à mécanique d'écriture identique.
Table complète : annexe `references/remediation.md` de `/orchestrer-plan` (Étape 5c). **Ce qui suit un `FAIL` — reprise, enquête ou question à
l'utilisateur — est en §9c** ; la nature ne décide pas que du premier geste, elle décide aussi du
**canal** de la reprise — les trois conditions qui autorisent le canal court sont en §9c, pas ici.

**Deux cas ressemblent à un blocage de périmètre et n'en sont pas.**

**La ceinture de fichiers dérivés.** Un exécutant étend son périmètre d'écriture sans STOP ni
`Latitude` déclarée si les trois conditions tiennent : (1) la modification est **forcée** par un
changement déjà au périmètre — le fichier passe au rouge à cause de lui, pas d'un choix ; (2) le
nouveau contenu se **dérive mécaniquement** en relançant le code (refix, régénération), pas d'un
jugement sur le comportement attendu ; (3) elle part dans un **commit séparé**, signalée en une
ligne du bilan. Le test qui tranche : *savoir quoi écrire dedans demande-t-il de savoir quel est le
bon comportement ?* Oui → c'est le design qui déborde, STOP. Non → c'est de la comptabilité, écris
et signale. Le commit séparé est le garde-fou : il rend un élargissement abusif visible en revue au
lieu de le diluer. Fixtures golden, compteurs codés en dur, métadonnées validées au build sont la
forme habituelle ; les laisser hors périmètre rend la gate N0 inatteignable par construction
(constat du 2026-09-13 : trois arrêts et trois arbitrages pour une écriture que personne n'avait à
décider).

**Un écart trouvé dans l'instrument de mesure est un résultat, pas un `FAIL`.** Quand une gate
s'appuie sur du code du dépôt (oracle, validateur, script de score), cet instrument n'est jamais
intouchable : une session qui montre qu'il compte faux rend ce constat **avec sa preuve**, et n'a
pas échoué. Cinq plans ont optimisé contre un juge qui sous-comptait sans que personne ait le droit
d'aller le vérifier (décision du 2026-09-14).

Le plafond d'une correction n'est pas négociable : au-delà, c'est l'anti-pattern de §3 (tourner en
rond sur la même erreur), et c'est précisément ce qu'un modèle au-dessus règle mieux qu'une
troisième tentative. Le rapport `plans/P<n>/S<k>.echec.md` porte la nature en ligne mécanique
(`Nature : …`, gabarit dans `/reprendre-echec`) : l'orchestrateur ne lit que cette ligne, comme il
ne lit que `Bloquant :` d'une revue.

*Pourquoi.* Sur neuf rapports d'échec relus le 2026-09-09 dans quatre projets, la majorité étaient
des prémisses fausses ou des blocages d'environnement (permission `Edit` absente en headless,
humain requis absent) — et chacun avait déclenché une reprise un cran au-dessus, parfois Fable sur
Opus, qui n'a fait que refaire le diagnostic avant de rendre un arbitrage. Le modèle n'était jamais
la cause. Ces mêmes neuf rapports ont servi une seconde fois le 2026-09-13 : les prémisses y étaient
non seulement chères à reprendre, mais **fausses** — d'où la vérification, et §9c. Une session qui corrige elle-même ce qui est à sa portée économise en plus le démarrage à
froid de la reprise.

### 9b. Incident de workflow — le fichier qui remonte

**Quand le workflow lui-même casse** — hook qui refuse à tort, permission manquante, outil absent
du bac à sable, verdict perdu en route, revue non déposée, cache périmé, préflight rouge — le
signaler en prose ne sert à rien : la conversation disparaît, et le dépôt source ne le saura
jamais. Le mainteneur du workflow ne maîtrise pas le contexte de chaque projet ; c'est le fichier,
précis et versionné, qui rend l'analyse possible depuis le dépôt source (`bin/collecter-incidents.mjs`).

Un incident = un fichier `docs/workflow/incidents/YYYY-MM-DD-<slug>.md`, **commité et poussé avec
le projet** (§4b : il entre dans ce qu'une session committe ; sous verrou, l'orchestrateur le
committe en fin de vague ; c'est le push de fin d'unité de travail qui le fait sortir). Plafond
25 lignes, en-tête mécanique, faits bruts, aucune interprétation :

```md
# Incident workflow — YYYY-MM-DD — <titre court>

- Projet : <nom du dépôt>
- Workflow : v<version, lue dans .claude/workflow/manifest.json>
- Plan : P<n>/S<k>[/T<m>] ou —
- Environnement : <Desktop | VSCode | cloud> · <sous-agent | à la main>
- Étape : <skill et étape — /orchestrer-plan Étape 4, /fin-de-tache relecture, hook Stop…>
- Nature : <environnement | exécution | prémisse | orchestration>

## Symptôme
<ce qui a été observé, tel quel : message d'erreur, refus de hook, verdict — 5 lignes max>

## Preuve
<commande, chemin ou sortie brute courte qui permet de le vérifier — pas d'interprétation>

## Sur place
<contournement appliqué, ou « rien »>
```

Qui écrit : la session qui rencontre l'incident (`/fin-de-tache`, avant son commit) ; la session en
échec d'environnement, à côté de son `.echec.md` ; l'orchestrateur pour ce que lui seul voit
(verdict perdu, `partial`, revue qu'il n'a pas pu lancer, préflight rouge).
Ni `TASKS.md` ni `STATUS.md` : un incident n'est pas une tâche du projet, c'est une donnée pour le
dépôt source. Un `.echec.md` se supprime quand l'échec est résolu ; un incident **reste** — c'est
sa raison d'être.

### 9c. Ce qui remonte à un humain — et sous quelle forme

*Domicile de cette règle. `/orchestrer-plan` (5c, 5d, Étape 6) et `/reprendre-echec` l'appliquent,
ne la reformulent pas.*

**On ne s'arrête que sur un choix — un plan comme la session qui l'exécute.** Pas sur un échec, pas
sur un manque d'information, pas sur une hypothèse qui tombe : sur une question dont la réponse
change ce qu'il faut faire, et que seul l'utilisateur peut trancher. Tout le reste se cherche — et
se cherche automatiquement. C'est le domicile du critère ; `EXECUTANT.md` en porte l'**application**
aux trois natures d'échec d'une session (§9a), sans le reformuler.

**Un mot par chose.** Le workflow a longtemps écrit `STOP` pour trois règles de polarités
différentes — c'est ce qui laisse croire que s'arrêter est le défaut :

- **Gate** — une condition qu'une machine juge (hook, N0, contrôle de publication). Elle **refuse**,
  elle ne demande pas ; ce qui la franchit se rapporte après, jamais avant.
- **Question** — un choix soumis à un humain : options chiffrées, conséquences observables (forme
  détaillée plus bas).
- **Contrainte d'outillage** — l'humain n'est sollicité que parce que rien ne peut poser le geste à
  sa place (régler modèle et effort, lancer une session hors Desktop — §3, §5b). Ce n'est **pas** un
  point d'arrêt de conception : le nommer ainsi évite de le « corriger » en élargissant l'autonomie,
  et il disparaît de lui-même si le harnais gagne la capacité.

**Ce que le contrôle de publication ne couvre pas.** `plugin/bin/publier.mjs` (§5b) vérifie qu'un
bloc de lancement porte le renvoi vers `EXECUTANT.md`, au mot près — il ne sait pas dire qu'un point
d'arrêt écrit en prose est du bon côté de ce critère. Cette relecture-là reste humaine, faite une
fois par point (inventaire du 2026-09-14).

| Ce qui arrive | Ce que ça est vraiment | Ce qui suit |
| --- | --- | --- |
| N0 rouge après une correction | une hypothèse fausse | **enquête** (lecture seule, une passe) |
| « aucune autre piste en une passe » | un manque d'information | **enquête** |
| « une hypothèse du plan est fausse » | une **affirmation non vérifiée**, écrite par la session qui vient d'échouer | **vérification** (`verificateur-premisse`) — puis reprise si elle est réfutée, question si elle tient ; `INDECIDABLE · comportementale` → question, option « sonder » (`/nouveau-plan` Étape 1, point 5) |
| « une hypothèse du plan est fausse » **et une mesure commitée le prouve** (`Mesure :`) | une **preuve** — de niveau supérieur à la lecture | pas de vérification : **question** ou extension, comme une prémisse réfutée |
| remédiation d'environnement à portée dans l'arbre | rien du tout | **appliquer et continuer** (§9a) |
| une migration jouée à annuler, une permission à élargir, une prémisse confirmée, un budget épuisé | un choix | **question** |

*Pourquoi.* La latence humaine est le coût dominant d'une orchestration ; et un humain qui reçoit
« la session a échoué, voici le rapport » n'a **aucune information de plus** que l'orchestrateur —
il lance l'enquête que l'orchestrateur savait lancer. Lui transférer ce travail, c'est lui facturer
une attente pour un geste déterministe. À l'inverse, un orchestrateur qui *décide* à la place de
l'utilisateur — étendre un plan, annuler une migration, élargir une permission — dépasse son rôle :
il lance et collecte, il n'arbitre pas.

**Le canal de reprise, sous trois conditions observables.** Le discriminant n'est pas « l'agent se
déclare bloqué » — une session remplit ses champs sur ce qu'elle *croit*, c'est pour ça que
`prémisse` est déjà le seul champ qu'un tiers vérifie. L'orchestrateur reprend par `SendMessage`
**si et seulement si** les trois conditions suivantes tiennent, **toutes observables de
l'extérieur, sans ouvrir le contexte de l'agent** :

1. **L'agent est reprenable** — il apparaît dans `ListAgents`. Absent, le reprendre *est* un
   démarrage à froid, sans le bénéfice.
2. **N0 est vert sur son périmètre** — constaté par un `verificateur-n0` que l'**orchestrateur**
   lance lui-même, jamais par la déclaration de la session. C'est la gate qui autorise le canal
   court.
3. **Aucune fausse piste accumulée** — `Tentatives : reprise=0`, et `Blocage :` nomme un **geste**
   (un commit à prendre, un statut à poser, un fichier à écrire), pas une hypothèse à tester.

Une seule condition qui manque → démarrage à froid ; il n'y a pas de cas limite à juger. Ce qui
reste vrai là où c'était vrai : un agent à bout de tours, une hypothèse fausse, un retour `partial`
→ démarrage à froid, motif inchangé — continuer l'agent rapatrierait ses fausses pistes.

**Le budget est ce qui rend l'autonomie sûre.** Par session : 2 reprises, 1 enquête. Par plan :
2 enquêtes. Il vit dans une ligne mécanique du rapport d'échec — `Tentatives : reprise=<n>
enquete=<n>`, gabarit dans `/reprendre-echec` —, donc il survit à une orchestration interrompue
puis relancée, ce qu'un compte tenu en contexte ne ferait pas. Budget épuisé → question, sans rien
relancer. Sans ce plafond, « chercher au lieu de demander » devient l'anti-pattern de §3.
`SendMessage` consomme une `reprise` du budget comme n'importe quelle reprise ; un `SendMessage`
qui échoue **ne se retente pas** — la reprise suivante est un démarrage à froid, et plus jamais un
`SendMessage` sur cette session.

**La forme n'est pas cosmétique.** Un arrêt se pose en **question** : une phrase, 2 à 4 options
avec leur coût et ce que chacune débloque, une recommandation, et ce qui reste lançable sans
décider. Un arrêt qui renvoie vers un fichier à lire fait refaire à l'utilisateur le diagnostic
déjà payé ; et une question sans option ne se répond pas, elle se re-cadre. Les options ne
s'inventent pas au moment du rapport : elles viennent de l'enquête (section `## Issues` du
`.echec.md`, recopiée mot pour mot) ou de la table de `/orchestrer-plan` Étape 6.

