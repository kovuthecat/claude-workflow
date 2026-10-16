# WORKFLOW.md — Modèles, effort, plans, validation, garde-fous

Source unique, les autres fichiers y renvoient. Modèles actuels : Fable 5.1 · Opus 5.5 · Sonnet 5.5 · Haiku 5.5. Raisons des règles (dépôt
source) : `docs/decisions/2026-10-15-justifications-sorties-du-workflow.md`.

## 1. Principe directeur
### Glossaire — mots à double sens
*gate* : contrôle qui refuse sans demander · *session* : un `S<k>.md` exécuté, pas une conversation · *verdict* : la ligne `VERDICT:` d'une
session orchestrée, ses commits en font foi · *bloquant* : `Bloquant : n` d'une revue de session · *vague* : groupe de sessions.

**Opus pense, les autres font** (grille : §2). Une fois le plan écrit, l'exécutant ne reconçoit pas : sa liste « Lire » est un **point de
départ**, la lecture reste ouverte (diagnostiquer n'est borné par rien), seule l'écriture est bornée à la zone du plan. Régime **fixé** :
périmètre d'écriture fermé, livrable = commits sous gate N0. Régime **ouvert** : réponse qu'à l'exécution, donc branche jetable poussée,
budget écrit, N0 en fin, livrable = **preuve mesurée** ; il se lance dès la première prémisse comportementale non sondable.

**Demander quand il y a un choix, agir quand il y a une gate.** Quatre choses, liste fermée : l'irréversible ; un contrat
public/schéma/dépendance à changer ; un objectif qui bouge ; un jugement esthétique ou produit (N2). Le reste — remède nommé, réversible,
jugé par une gate — se fait **sans demander**, se rapporte après.

## 2. Choix du modèle
**Opus** : design, bug non localisé, scope flou, arbitrage produit. **Sonnet** : cadré, jugement de code, complexité moyenne (bug isolé,
refactor, feature, revue). **Haiku** : cadré, mécanique, petit (renommage, purge). Départage : Sonnet si jugement/risque/gros volume ; Haiku
si mécanique, 1-2 fichiers, résultat évident ; escalade Opus si cause non localisée, scope flou ou choix produit.

## 3. Effort — et comment le distinguer du modèle
**Modèle = capacité, effort = quantité de travail.** Il se trompe avec tout le contexte, ou tourne en rond depuis 2 relances → **monter de
modèle** ; il saute des fichiers ou abandonne en route → **monter l'effort** ; correct mais lent sur du trivial → le baisser. Échelle : `low ·
medium · high · xhigh · max` ; `medium` défaut ; `xhigh` réservé ; `max` seulement par `/effort max` en session (refusé dans un index).

**L'effort suit le modèle** (table `modelSettings` du gabarit : Opus `high`, Sonnet `medium`, Haiku `medium`) ; la clé
`modelSettings.<modèle>.effortLevel` prime la clé racine ; `/effort` en session déroge, à consigner. Chaque session de plan porte **modèle +
effort** dans l'`index.md`, réglés **avant de lancer** ; sous orchestration le moteur les passe à l'outil `Agent` (§5b). Une session lancée
à la main hérite des réglages **ambiants** : toute skill qui rend la main pour la lancer écrit donc, juste avant :
```
À régler AVANT de lancer — S<k> : modèle <M> · effort <E>   (la pastille hérite des réglages courants)
```
L'orchestrateur tourne sur **Haiku · medium** ; retour à Sonnet au premier geste inventé, consigné en incident (§9b).

## 3b. Coût et cache
Changer de modèle, d'outils ou de MCP reconstruit tout le préfixe de cache : régler modèle **et** effort avant de lancer (§3) ; `/compact`
seulement avant un changement délibéré, jamais avant une escalade.

## 4. Plans
Un plan est précédé d'une **décision écrite** : QUOI/POURQUOI pas tranché, idée neuve comprise → `/cadrer` (sortie dans `docs/decisions/`) ;
question sur un existant qui a dérivé → `/revue-de-conception`. Puis Opus déroule `/nouveau-plan`, qui crée `plans/P<n>/` : `index.md`
(objectif, sessions, vagues — **seul endroit où vit le statut**) et un `S<k>.md` par session (décision, chemins, étapes ; bandeau réduit aux
écarts à la règle commune). Les sessions s'exécutent **une à la fois**. Une correction qui débloque un plan s'y ajoute (pas `P<n+1>`).

### 4a. Un statut, un seul endroit — *domicile, les autres fichiers renvoient ici*
Avancement d'une tâche : `plans/P<n>/index.md`, jamais `S<k>.md` ni `TASKS.md` · backlog non planifié : `TASKS.md` · état de l'app :
`STATUS.md` · décision : `DECISIONS.md` / `docs/decisions/<date>-<slug>.md` · jugement visuel en attente : `VALIDATION.md` · incident de
workflow : `docs/workflow/incidents/<date>-<slug>.md` (§9b).

Statuts : `[ ]` pas lancée ou sans verdict · `[x]` `PASS`, revue sans bloquant ou sans diff à relire · `[x]!` `PASS`, **revue à bloquant**
(défaut connu, non trié). Le verdict est **auto-déclaré** par la session ; la relecture (§5) suit. `.revue.md` est committé par le moteur en
mode orchestré, par la session à la main — jamais les deux. Le versement d'un `[x]!` dans `TASKS.md`, à la clôture, le repasse à `[x]` ; il
ne satisfait les dépendances que si la revue porte `Dépendances : libres`. Une revue interrompue est reprise une fois, puis question.

### 4b. Commits et push — *domicile, les autres fichiers renvoient ici*
**Chaque session committe son propre travail**, tâche par tâche, staging explicite (`add -A`/`.`, `commit -a` refusés par hook), repère en
dernière ligne : `Plan: P<n>/S<k>/T<m>`. Fichiers de la tâche, `S<k>.md`, `.echec.md`, `.question.md`, rien d'autre. **N0 vert d'abord**
(`n0.mjs`, §5) ; **à jour avant de commencer** (`git pull --rebase`, constaté par `SessionStart`).
- **Fin de tour = arbre propre et poussé** : un commit local n'existe pour aucune autre machine, cloud compris. `Stop` refuse sinon (§7) ;
  exemptions : pas de remote, remote injoignable (signalé), session planifiée (rappel). `git pull --rebase` avant de pousser ; conflit →
  **question**. Fin de plan : `STATUS.md`, `TASKS.md`, `VALIDATION.md` à jour, un dernier push.
- Arrêt en cours de tâche ou N0 rouge : chaînage manuel → branche `wip/P<n>-S<k>` poussée avec `.echec.md`, jamais `main` ; mode orchestré →
  `.echec.md` commité **sur la branche courante** (l'arbre est partagé).
- `main` impossible (cloud) : pousser la branche et la **nommer** en relance (`Commit : <sha> poussé sur <branche>`) ; premier geste suivant :
  `git merge-base --is-ancestor <sha> HEAD`.

### 4c. Voie express — petit changement sans plan
Le commit porte `Express : <cause en une ligne>` ; `Stop` l'accepte à la place d'un fichier de suivi, mais le hook de commit le refuse si le
diff dépasse **150 lignes ou 8 fichiers**, touche les dépendances (manifeste, *lockfile*), `.claude/n0.json` ou la zone d'un plan ouvert. N0
reste la gate, un chemin sensible est relu (§5) ; `bilan-express.mjs` suit la fiabilité (resserrer au-delà de 1 rattrapé sur 10, élargir à 0
sur 20).

## 5. Recherche directe et délégation
Chercher, lire une doc ou lancer une commande remplit le contexte : huit agents **de délégation**, chacun ne rend que sa **conclusion** :
- `explorateur` → exploration large ou plusieurs pistes (précise, sortie ≤30 lignes : en direct, même multi-fichiers).
- `analyste-flux` → lire **comment** un flux fonctionne. `resumeur-git` → résumer diff/historique. `lecteur-doc` → doc externe.
- `relecteur-session` → relire une session close ou une **vague entière**, **déposer** `.revue.md`. Une session `low` n'est relue que si
  elle touche un chemin sensible (`.claude/`, CI, manifestes, `CLAUDE.md`, `plugin/` en dépôt source ; le moteur rend alors `relire`) ;
  `n0.json` modifié hors zone = bloquant posé par le moteur.
- `verificateur-plan` → confronter un plan écrit au dépôt avant commit. `critique-plan` → confronter un plan à ses risques avant
  approbation. `verificateur-premisse` → confronter au dépôt l'affirmation d'une session en échec (§9c).

**N0 est un script, pas un agent** : `node .claude/workflow/bin/n0.mjs` (`plugin/bin/n0.mjs` dans ce dépôt), au premier plan. **Les agents
de délégation aussi** (invariant : `EXECUTANT.md`) : leur verdict conditionne la suite, et `run_in_background: false` s'écrit à chaque
appel, l'outil partant en arrière-plan sans lui. `relecteur-session` est le dernier geste. **`fork`** seulement si le contexte courant est
nécessaire **et** le bruit à tenir dehors, jamais pour une session de plan ni une reprise.

## 5b. Sessions & voies d'orchestration — *domicile, les autres fichiers renvoient ici*
**Invariant de lancement.** Tout bloc `Agent({ … })` qui lance une session, une reprise ou une enquête porte, au mot près :
```
Lis ${CLAUDE_PLUGIN_ROOT}/EXECUTANT.md en entier avant ton premier geste : il porte les invariants de lancement.
```
**Jamais deux sessions d'un même plan dans une seule conversation.** Deux voies :
- **À la main** : `/fin-de-tache` pose une pastille qui lance la suivante ; la seule voie hors Desktop.
- **Plan entier** : `/orchestrer-plan` appelle à chaque tour `prochaine-action.mjs P<n> --appliquer`. Le moteur fait lui-même les gestes
  mécaniques, un commit chacun (cocher `[x]`/`[x]!`, committer la revue, N0 de session et sa preuve, pousser, supprimer les rapports
  obsolètes, tenir `Remédiation Opus :`, clôturer), puis rend l'action qui demande un agent ou un humain. L'orchestrateur relaie son `texte`
  et l'exécute ; il ne décide rien. Seule une `validation-humaine` arrête entre deux vagues.

**Sous-agent, seule voie d'orchestration**, en arrière-plan quel que soit l'environnement : il hérite du navigateur in-app et des
permissions ; son verdict, ce sont ses commits (§4b) ; ses appels de délégation et son `n0.mjs` restent au **premier plan**. Lancement :
`subagent_type: "general-purpose"` avec le `model` et l'`effort` du champ `agent` que rend le moteur (l'`effort` de l'outil prime sur la
conversation). Commandes : relatives à la racine, sans `cd`.

**Arrêt relayé.** Une session qui tombe sur un choix (§1) écrit `plans/P<n>/S<k>.question.md` (gabarit :
`reprendre-echec/references/gabarit-question.md`), committe son travail en cours et rend `VERDICT: QUESTION`. L'orchestrateur pose la
question **par écrit** (fichier joint), puis transmet la réponse à **la même** session par `SendMessage` : elle reprend avec tout son
contexte, même après une longue attente. Agent introuvable : réponse écrite dans le fichier, reprise à froid qui le lit. Hors budget (§9c).

## 6. Validation — trois niveaux
**N0 auto**, toujours, **bloquant** : build + typecheck + tests du périmètre (`—` justifié sinon). **N1 visuel auto**, si navigateur in-app,
non bloquant : erreurs console, contenu, 4xx/5xx, responsive. **N2 humain**, non bloquant : jugement esthétique/UX/ton, **rien d'autre**. Le
N1 se joue **dans la session**, sous-agent compris (`/verif-visuelle`) ; le bandeau d'une fiche déclare `Environnement : Desktop (navigateur
requis)` quand il est structurant, `indifférent` sinon. Sans navigateur in-app : commande dev et checklist manuelle ; jamais de Playwright
ni de capture scriptée. Ce que le navigateur constate seul ne va pas dans `VALIDATION.md` ; le N2 s'y consigne et **n'arrête pas le plan**.
`/revue-d-usage` n'est pas un niveau (la grille reste à trois) ; sur passe esthétique demandée, Claude propose sur le N2, sans trancher.

## 7. Garde-fous appliqués (hooks)
Cinq hooks (`${CLAUDE_PLUGIN_ROOT}/hooks/`, câblés dans `hooks.json`) ; ce ne sont pas des conseils, ils refusent :
- `sessionstart-contexte.mjs` : injecte `CLAUDE-BASE.md` ; signale retard sur l'amont, mauvaise branche, modèle hors plan, plafonds
  dépassés, `STATUS.md`, workflow vendoré ou plugin chargé en retard.
- `pretooluse-git.mjs` : refuse `add -A`/`.`, `commit -a`, commit et push sans racine de dépôt, `Express :` hors bornes (§4c).
  `posttooluse-format.mjs` : Prettier si configuré. `postmodelswitch-journal.mjs` : journal des changements de modèle.
- `stop-contexte.mjs` : **gate** (§9c) — refuse si code modifié sans suivi touché (ou `Express :`), revue de session absente, plafond
  dépassé, commits d'avance ou fichiers suivis non commités. Exemptions : pas de remote, racine introuvable, remote injoignable, session
  planifiée, session `low` sans chemin sensible. Bloque une fois.

**Plafonds de lignes** : `${CLAUDE_PLUGIN_ROOT}/hooks/plafonds.json` (`STATUS.md`, `TASKS.md`, `VALIDATION.md`, `DECISIONS.md`,
`PROJECT_MAP.md`, `CLAUDE.md`, `S<k>.echec.md`). Un dépassement est une **gate** : il déclenche `/purge-contexte` sans demander.

## 8. Anti-patterns
Chaque anti-pattern (`FAIL` sans nature, arrêt sans question à options, incident en prose, deux sessions dans une conversation, main rendue
sans push, statut recopié) est le manquement à une règle ci-dessus ; hooks (§7) et moteur (§5b) en refusent la plupart.

## 9. Échecs et incidents — *domicile, les autres fichiers renvoient ici*
### 9a. Diagnostiquer avant de conclure
Diagnostiquer **ouvre la lecture** (seule l'écriture est bornée). Une session qui échoue nomme d'abord sa **nature**, qui décide de la suite :

| Nature | Ce que c'est | Ce que la session fait | Reprise |
| --- | --- | --- | --- |
| **environnement** | outillage : permission, outil absent, hook, humain absent | à portée → corriger, continuer ; sinon `FAIL` + incident (§9b) | **une seule** reprise, même modèle ; sinon question |
| **exécution** | environnement sain, ça n'aboutit pas | jusqu'à 3 hypothèses, **une correction chacune**, N0 juge chacune ; épuisé et rouge → `FAIL` | 1re reprise : modèle de l'index ; 2e : un cran au-dessus |
| **prémisse** | une hypothèse du plan est fausse | `FAIL` **sans corriger**, hypothèse **falsifiable** | `verificateur-premisse` : réfutée → comme exécution ; confirmée → question |

Nature `filtre` → question, jamais une reprise ; `interruption` : écrite par l'orchestrateur (coupure par quota), jamais par la session,
hors budget. Table complète : `skills/orchestrer-plan/references/remediation.md`.

**Budget en hypothèses** : 3 distinctes au plus, chacune inscrite dans « Déjà écarté » avant la suivante ; arrêt sur hypothèse répétée, ou
contexte > 70 %. **Amendement** : prémisse fausse **avec mesure commitée**, objectif inchangé, remède dans la zone, aucun critère d'arrêt
(§1) touché ⇒ écrit dans « Écarts au plan » (commit séparé, repère `Amendement :`), la session **continue**, le relecteur juge après. `Auto :
oui` (enquête, ou session en échec elle-même, mêmes critères) → reprise qui applique le remède. **Fichiers dérivés** : extension sans STOP
si (1) **forcée** par un changement déjà au périmètre, (2) **dérivée mécaniquement**, (3) en **commit séparé** signalé au bilan.
**Instrument de mesure faux** : constat avec preuve, pas un `FAIL`.

**Correctif localisé**, posé par la session qui le trouve (même hors périmètre, même si le `S<k>.md` dit « ne corrige pas ») si : (1)
**cause mesurée**, (2) **remède petit** (1-2 fichiers, ~30 lignes hors tests), (3) **réversible** (ni migration, ni dépendance, ni contrat),
(4) **jugé** par la gate et N0. Commit séparé, `Plan:` + `Correctif localisé : <fichiers>`, signalé au bilan. Condition manquante → table
ci-dessus. Seul le bandeau l'éteint (`interdit — <raison>`).

### 9b. Incident de workflow — le fichier qui remonte
Quand le workflow casse (hook à tort, permission, outil absent, verdict perdu, revue non déposée, cache périmé) :
`docs/workflow/incidents/YYYY-MM-DD-<slug>.md`, **commité et poussé** (§4b), 25 lignes, faits bruts, écrit par la session qui le rencontre
(`/fin-de-tache`, avant commit) ou par l'orchestrateur ; jamais dans `TASKS.md`/`STATUS.md`. Un `.echec.md` se supprime résolu, un incident
**reste**. Gabarit : titre `# Incident workflow — YYYY-MM-DD — <titre court>` ; lignes `Projet · Workflow (version du manifest.json) · Plan :
P<n>/S<k>[/T<m>] ou —`, `Environnement : Desktop|VSCode|cloud · sous-agent|à la main`, `Étape : <skill/étape> · Nature :
environnement|exécution|prémisse|orchestration` ; sections `## Symptôme` (tel qu'observé, 5 lignes), `## Preuve` (sortie brute, sans
interprétation), `## Sur place` (contournement, ou « rien »).

### 9c. Ce qui remonte à un humain — et sous quelle forme — *domicile ; `/orchestrer-plan` et `/reprendre-echec` l'appliquent*
**On ne s'arrête que sur un choix** dont la réponse change ce qu'il faut faire et que seul l'utilisateur peut trancher ; le reste se
cherche. **Gate** = refuse, ne demande pas. **Question** = choix soumis, 2-4 options chiffrées, une recommandation, conséquences
observables, ce qui reste lançable — jamais un renvoi qui fait refaire le diagnostic. **Contrainte d'outillage** = geste que seul l'humain
peut poser (régler modèle/effort, lancer hors Desktop).

| Ce qui arrive | Ce qui suit |
| --- | --- |
| N0 rouge après correction / aucune piste en une passe | **enquête** (lecture seule) ; options dans `## Issues` du `.echec.md` |
| « prémisse fausse » non vérifiée | `verificateur-premisse` → reprise si réfutée ; question si confirmée, `INDECIDABLE·comportementale`, ou prouvée par une **mesure commitée** |
| prémisse non sondable, options d'enquête insatisfaisantes | **exploration ouverte** (régime ouvert, §1) |
| session arrêtée sur un choix (`S<k>.question.md`) | **question**, réponse transmise à la même session (§5b) |
| coupure par quota (`interruption`) | **`relancer-interrompue`** (`SendMessage`, sinon à froid), hors budget |
| remédiation d'environnement à portée, correctif localisé, amendement | la session agit et continue (§9a) |
| migration à annuler, permission à élargir, budget épuisé | **question** |

**Canal de reprise** : `SendMessage` **si et seulement si** (1) **agent reprenable** (identifiant de l'appel `Agent`, jamais `ListAgents` ;
un `SendMessage` en échec = démarrage à froid, sans retenter) ; (2) **N0 vert**, constaté par un `n0.mjs` lancé par l'**orchestrateur** ;
(3) **aucune fausse piste** (`Tentatives : reprise=0`, `Blocage :` nomme un geste). Sinon démarrage à froid (toujours : agent à bout de
tours, hypothèse fausse, retour `partial`). Une coupure par quota fait exception : canal court même si N0 est rouge (agent coupé en
édition).

**Budget** : 2 reprises et 1 enquête par session, 2 enquêtes par plan (panne d'environnement : 1 reprise) — ligne `Tentatives : reprise=<n>
enquete=<n>` (gabarit `/reprendre-echec`), qui survit à une relance. Épuisé → question. `SendMessage` consomme une reprise ;
`relancer-interrompue` et l'arrêt relayé sont hors budget. Une seule **passe Opus par plan** (`Remédiation Opus :`) : au-delà, `question`
source `budget-opus`.
