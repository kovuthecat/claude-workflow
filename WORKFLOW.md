# WORKFLOW.md — Modèles, effort, plans, validation, garde-fous

Source unique : répartition du travail, format des plans, niveaux de validation ; les autres fichiers y renvoient. Modèles actuels : Fable 5 · Opus 5 · Sonnet 5 · Haiku 4.5. Squelettes de plan : skill `/nouveau-plan`, pas ici.

## 1. Principe directeur

**Opus pense, les autres font.** Opus (cher) : design, cadrage, écrit les plans. Fable : hors workflow, à la main, jamais dans une grille ni une skill. Sonnet : exécute le cadré moyen, juge le code. Haiku : exécute le cadré mécanique. Claude Design (claude.ai) : maquette UI au cadrage — entrée `ARCHITECTURE.md`, sortie `design/maquettes/`, le câblage suit la maquette.

Une fois le plan écrit, l'exécutant ne reconçoit pas. Sa liste « Lire » (`S<k>.md`) est un **point de départ** : lecture ouverte, seule l'écriture reste bornée à la zone du plan (C5).

| Régime | Quand | Ce qui borne | Livrable |
| --- | --- | --- | --- |
| **fixé** | résultat énonçable avant obtention | périmètre d'écriture fermé | commits sous gate N0 |
| **ouvert** | réponse qu'à l'exécution | branche jetable, budget, N0 en fin | **preuve mesurée** |

Le régime ouvert n'est pas une exception (`docs/decisions/2026-09-14-preuve-avant-plan.md`) : dès la première prémisse comportementale non sondable, il se lance comme toute session orchestrée — sous-agent, branche jetable poussée, budget écrit (C6). Aiguillage au cadrage (`/cadrer`, `/nouveau-plan` Étape 0).

**Demander quand il y a un choix, agir quand il y a une gate.** Quatre choses, liste fermée : l'irréversible ; un contrat public/schéma/dépendance à changer ; un objectif qui bouge ; un jugement esthétique ou produit (N2). Le reste — remède nommé, réversible, jugé par une gate — se fait **sans demander**, se rapporte après (`docs/decisions/2026-08-30-ecrire-pour-qui-decide.md`).

## 2. Choix du modèle

| Nature de la tâche | Modèle | Exemples |
| --- | --- | --- |
| Design, bug non localisé, scope flou, arbitrage produit | **Opus** | Architecture, cadrage, plan multi-tâche |
| Cadré, jugement de code, complexité moyenne | **Sonnet** | Bug isolé, refactor, feature, code review |
| Cadré, mécanique, petit | **Haiku** | Renommage, purge, boilerplate, consolidation |

Départage : Sonnet si jugement/risque/gros volume ; Haiku si mécanique, 1-2 fichiers, résultat évident ; escalade Opus si cause non localisée, scope flou, ou choix produit restants.

## 3. Effort — et comment le distinguer du modèle

**Modèle = capacité, effort = quantité de travail** :

| Symptôme | Changer |
| --- | --- |
| Il se trompe avec tout le contexte | **Monter de modèle** |
| Il saute des fichiers, abandonne en route | **Monter l'effort** |
| Il tourne en rond depuis 2 relances | **Monter de modèle, pas l'effort** |
| Correct mais lent sur du trivial | **Baisser l'effort** |

Échelle (`model-config`) : `low · medium · high · xhigh · max`. `low` mécanique ; `medium` **défaut** ; `high` raisonnement soutenu ; `xhigh` agentique complexe/cadrage neuf, réservé ; `max` au-delà, jamais par défaut, via `/effort max` en session seulement.

Défaut : `.claude/settings.json` du projet. Chaque `S<k>.md` porte **modèle + effort + environnement**, réglés **avant de lancer**. **L'effort suit le modèle** (table `modelSettings` du gabarit : Opus `high`, Sonnet `medium`, Haiku `low`) ; `/effort` en session déroge, à consigner au bandeau. ⚠️ `modelSettings.<modèle>.effortLevel` prime la clé racine, quel que soit le fichier — un `/effort` écrit en settings **utilisateur** battrait sinon l'`effortLevel` du projet partout, en silence.

**Rappel systématique** — domicile : une pastille démarre avec les réglages **ambiants**, jamais ceux du plan ; toute skill qui rend la main pour lancer une session écrit donc, juste avant :

```
À régler AVANT de lancer — S<k> : modèle <M> · effort <E>   (la pastille hérite des réglages courants)
```

`xhigh` permanent est le poste de dépense le plus silencieux du workflow.

**Effort d'orchestration.** `effort` en frontmatter d'**agent nommé** est documenté et honoré — il prime l'effort de session, pas la variable d'environnement (`model-config` § *Set the effort level*, `sub-agents` § *Frontmatter reference*) ; `critique-plan` s'en sert. Une session de plan se lance désormais sur l'agent `session-<effort>` composé depuis la colonne Effort de l'index (`plugin/agents/session-low.md` … `session-xhigh.md`) : c'est son frontmatter qui porte l'effort, jamais l'outil `Agent`, qui règle toujours le modèle. Précédence : frontmatter de l'agent nommé, sinon niveau de session ; **seule** la variable d'environnement `CLAUDE_CODE_EFFORT_LEVEL` bat le frontmatter (`model-config` § *Set the effort level*) — c'est la seule façon de rendre le mécanisme inopérant sans erreur. `max` ne se règle pas depuis un index : il n'existe pas d'agent `session-max`, et le moteur refuse la valeur en renvoyant ici. L'orchestrateur tourne sur **Sonnet**, jamais Haiku ; bascule conditionnée à une éval comparée, jamais exécutée à ce jour (P6/T19 abandonnée, bac à sable absent).

## 3b. Coût et cache

<https://code.claude.com/docs/en/prompt-caching.md> : hit = **0,1×** le prix d'entrée, TTL 5 min (1 h possible). Trois étages d'invalidation (« ✓ » = survit) :

| Changement | Outils | Système | Messages |
| --- | :---: | :---: | :---: |
| Modèle, outils, MCP ajouté/retiré | ✗ | ✗ | ✗ |
| Prompt système | ✓ | ✗ | ✗ |
| Effort, `thinking` | ✓ | selon modèle | ✗ |
| Messages, images | ✓ | ✓ | ✗ |

Seuls outils et modèle forcent une reconstruction complète (aucune échappatoire). Minimum cacheable : 512 (Opus 5), 1 024 (Sonnet 5), **4 096 (Haiku 4.5)**. Une entrée ne remonte que 20 positions. Conséquences : régler modèle **et** effort avant de lancer (§3) évite de repayer le préfixe ; `/compact` juste avant un changement **délibéré**, jamais avant une escalade (le résumé perdrait les impasses qui la justifient) ; chaque sous-agent part à froid, payé plein tarif — d'où le socle court. **Lancer une vague en décalé** : le cache ne se lit qu'après le streaming de la première réponse — sur 4 sessions, la part partagée passe d'environ 5,0× à 1,55× le prix d'entrée.

## 4. Plans

Backlog : `TASKS.md`. Un plan est précédé d'une **décision écrite** : QUOI/POURQUOI pas tranché, idée neuve comprise → `/cadrer`, sortie dans `docs/decisions/`. Question non identifiée sur un existant qui a dérivé → `/revue-de-conception` (interview, rapport dans `docs/revues/`). Puis Opus déroule `/nouveau-plan`, qui crée `plans/P<n>/` :

- **`index.md`** — objectif, table des sessions, vagues. **Seul endroit où vit le statut.**
- **`S<k>.md` par session** — un lancement (modèle/effort/contexte), décision finale + chemins + étapes, jamais les alternatives (`docs/decisions/`).

Une correction qui **débloque un plan en cours** s'y ajoute (vague de remédiation), pas `P<n+1>` (`/nouveau-plan` Étape 0).

### 4a. Un statut, un seul endroit — *domicile, les autres fichiers renvoient ici*

| Information | Vit dans |
| --- | --- |
| Avancement d'une tâche | `plans/P<n>/index.md` — jamais `S<k>.md` ni `TASKS.md` |
| Backlog non planifié | `TASKS.md` |
| État actuel de l'app | `STATUS.md` |
| Décision (verdict / justification) | registre `DECISIONS.md` / `docs/decisions/<date>-<slug>.md` |
| Jugement visuel en attente | `VALIDATION.md` |
| Incident de workflow (§9b) | `docs/workflow/incidents/<date>-<slug>.md` |

Qui coche `index.md` : un seul juge à la fois, décidé par `.claude/wave.lock` (§4b).

| Statut | Veut dire |
| --- | --- |
| `[ ]` | pas lancée, ou sans verdict |
| `[x]` | `PASS`, revue sans bloquant ou sans diff à relire |
| `[x]!` | `PASS`, **revue à bloquant** — commité, défaut connu, non trié |

Verdict **auto-déclaré** par la session qui écrit le code ; la relecture (`relecteur-session`) arrive après et **committe** `.revue.md` (§4b). `/fin-de-tache` verse un `[x]!` dans `TASKS.md` — **ce versement le passe à `[x]`** ; un `[x]!` qui reste est un défaut non arbitré, jamais un oubli. Il ne relance rien, satisfait les dépendances comme un `[x]`.

### 4b. Commits, push et parallélisation — *domicile, les autres fichiers renvoient ici*

**Chaque session committe son propre travail**, tâche par tâche, staging explicite, repère en dernière ligne (`docs/decisions/2026-08-24-commit-par-session.md`) :

```
Plan: P<n>/S<k>/T<m>
```

- Committe : fichiers de ses tâches, son `S<k>.md`, son `.echec.md`, et — désormais — sa propre `.revue.md` une fois déposée. Rien d'autre.
- **N0 vert d'abord**, via `n0.mjs` (§5). **À jour avant de commencer** (`git pull --rebase`, `SessionStart` le constate — §7).

**Fin de tour = arbre propre et poussé (C3)** : plus de push « groupé » de fin de vague/plan — un commit local n'existe pour aucune autre machine, cloud compris.

- `Stop` refuse si commits d'avance sur l'amont ou fichiers suivis non commités (§7). Exemptions : pas de remote, `.claude/wave.lock`, remote injoignable (signalé, jamais bloquant).
- `git pull --rebase` avant de pousser ; conflit → **question**. Arrêt en cours de tâche/N0 rouge : branche `wip/P<n>-S<k>` poussée avec `.echec.md`, jamais `main`.
- `main` impossible (cloud) : pousser la branche et la **nommer** en relance (`Commit : <sha> poussé sur <branche>`) — premier geste suivant : `git merge-base --is-ancestor <sha> HEAD`.
- **`.revue.md` et `.echec.md` sont commités** ; le repère `Revues:` disparaît (git seul juge, §7) ; `[x]!` reste (§4a).

**Sous `.claude/wave.lock`** : règle suspendue, `pretooluse-git.mjs` refuse commit/push/worktree. L'orchestrateur committe et pousse en fin de vague, guidé par `Zone modifiée` de l'`index.md` — où vivent aussi les **messages de commit** d'une vague verrouillée.

**Parallélisme : option déclarée au cadrage, pas le défaut.** Séquentiel sinon — deux sessions lancées ensemble partagent un seul index git, chacune emporterait le travail de l'autre sans verrou.

`git add -A`/`.`/`commit -a` refusés par hook. Fin de plan : `STATUS.md`/`TASKS.md`/`VALIDATION.md` à jour, un dernier push.

## 5. Déléguer au lieu de faire

Chercher, lancer une commande verbeuse ou lire une doc externe remplit le contexte de traces payées à chaque tour. Huit agents **de délégation**, chacun ne rend que sa **conclusion** :

- `explorateur` → localiser (>1 fichier). `analyste-flux` → lire **comment** un flux fonctionne. `resumeur-git` → résumer diff/historique. `lecteur-doc` → lire une doc externe.
- `relecteur-session` → relire une session close — ou une **vague entière**, `low` exemptées (C7) — **déposer et committer** `.revue.md` (`/fin-de-tache`).
- `verificateur-plan` → confronter un plan écrit au dépôt avant commit (`/nouveau-plan` 4b).
- `verificateur-premisse` → confronter au dépôt l'affirmation d'une session en échec, **avant** qu'elle n'arrête le plan (`/orchestrer-plan` 5c, §9c).
- `critique-plan` → confronter un plan à ses risques **avant** approbation (`/nouveau-plan` 1bis) ; ne juge ni périmètre produit ni style.

Une seconde famille cohabite dans `plugin/agents/` sans en faire partie : les quatre agents
`session-<effort>` ne rendent aucune conclusion à un parent, ils *sont* la session — rôle et
mécanisme en §3, pas ici.

Une troisième cohabite de même : `parcoureur-usage` ne rend pas de conclusion à une session de plan,
il joue un parcours et rend ses constats à la skill `/revue-d-usage` qui l'a lancé — jamais lancé
proactivement, jamais par une session de plan.

**N0 n'est plus un agent, c'est un script (C1)** : `node .claude/workflow/bin/n0.mjs` (`plugin/bin/n0.mjs` dans ce dépôt) — **au premier plan, comme toute commande**, sans sous-agent ni frontière de tour.

**Les quatre derniers** : personne ne relit son propre travail (découpe fausse, faille de plan, PASS vide, prémisse fausse). Les huit agents de délégation se lancent **au premier plan** (invariant : `EXECUTANT.md`, domicile §5b) — leur verdict conditionne la suite. `relecteur-session` : dernier geste, jamais en arrière-plan (la revue ne serait jamais déposée).

**`fork`** : contexte courant nécessaire **et** bruit à retenir dehors — jamais pour une session de plan ni une reprise (`docs/decisions/2026-08-30-contexte-des-sous-agents.md`). Pas de `memory:` sur les huit : légitime seulement sans source de dépôt déjà existante.

## 5b. Sessions & voies d'orchestration — *domicile, les autres fichiers renvoient ici*

**Invariant de lancement.** Tout bloc `Agent({ … })` de `plugin/**` porte, au mot près :

```
Lis ${CLAUDE_PLUGIN_ROOT}/EXECUTANT.md en entier avant ton premier geste : il porte les invariants de lancement.
```

Une paraphrase dérivera. `publier.mjs` vérifie sa présence, jamais son sens.

**Jamais deux sessions d'un même plan dans une seule conversation.**

- **À la main** : `/fin-de-tache` pose une pastille qui lance la suivante.
- **Vague entière** : `/orchestrer-plan` n'improvise plus (C2) — chaque tour appelle `prochaine-action.mjs P<n>` et exécute l'action rendue (lancer, reprendre, vérifier une prémisse, relire, pousser, question, ou `fini`), dérivée des fichiers commités. Il exécute, ne décide plus.

**Voie normale : sous-agent**, en arrière-plan, quel que soit l'environnement — hérite navigateur in-app et environnement complet de l'orchestration (permissions, MCP), verdict = ses commits (§4b) ; la session d'orchestration reste ouverte. **Cet arrière-plan est celui de la session entière, pas de ses délégations internes** : une fois lancée, ses appels aux trois agents de délégation et son `n0.mjs` restent au **premier plan** (`docs/decisions/2026-09-04-delegation-au-premier-plan.md`).

**L'effort d'un sous-agent vient de son frontmatter, sinon de la conversation qui le lance** (l'outil `Agent` règle le modèle, pas l'effort). Une session de plan se lance en `subagent_type: "session-<effort lu dans l'index>"` : c'est le frontmatter de cet agent nommé qui pose l'effort, en trois temps — frontmatter de l'agent de session, sinon niveau de conversation ; et si l'agent ne résout pas (valeur d'index absente de la famille `session-<effort>`), le repli est annoncé par `/orchestrer-plan`, pas recopié ici. Voie headless retirée : une seule voie, le sous-agent (`docs/decisions/2026-09-12-une-seule-voie-d-orchestration-et-hooks-testes.md`).

**Repli hors Desktop** (VSCode, terminal, cloud) : chaînage manuel, une pastille `spawn_task` par session terminée — la vague ne finit plus dans le même tour, un repli, pas le fonctionnement normal.

## 6. Validation — trois niveaux

| Niveau | Qui | Bloquant | Contenu |
| --- | --- | --- | --- |
| **N0 auto** | Claude, toujours | **oui** | build + typecheck + tests du périmètre (`—` justifié sinon) |
| **N1 visuel auto** | si navigateur in-app | non | erreurs console, contenu, 4xx/5xx, responsive |
| **N2 humain** | l'utilisateur | non | jugement esthétique/UX/ton — **rien d'autre** |

Desktop a un navigateur in-app : ce qu'il constate seul n'atterrit plus dans `VALIDATION.md`. **N1 dépend de l'environnement** : bandeau `Environnement : Desktop (navigateur requis) | indifférent`, colonne **Env.** de l'`index.md` ; N1 structurant → Desktop ; ailleurs `/verif-visuelle` sort la commande dev et une checklist manuelle. Hors navigateur in-app : jamais de Playwright ni de capture scriptée. Protocole : skill `/verif-visuelle`.

`/revue-d-usage` est une **étape de revue nommée, sans rang** (même statut que `/code-review`,
décision du 2026-08-30) : la grille ci-dessus reste à trois, pas de N3. **Exception à N2** : par
défaut il reste humain, mais quand l'interview de `/revue-d-usage` a demandé la passe esthétique,
Claude propose sur le N2 — proposer, jamais trancher, une ligne `VALIDATION.md` par proposition.

## 7. Garde-fous appliqués (hooks)

Cinq hooks (`${CLAUDE_PLUGIN_ROOT}/hooks/`, câblés dans `hooks.json`) appliquent ce qui compte :

| Hook | Événement | Ce qu'il fait |
| --- | --- | --- |
| `sessionstart-contexte.mjs` | SessionStart | Injecte `CLAUDE-BASE.md` (sauf reprise) ; signale retard sur `origin/main`, mauvaise branche, vague en cours, modèle hors plan, `STATUS.md` ≥3 commits de retard, plafonds dépassés, dossier synchronisé sans témoin, et — **C4** — workflow vendoré en retard sur le dernier tag (`ls-remote --tags`, cache 24 h/3 s, muet hors ligne/à jour/sans manifeste). Mémorise `HEAD` pour `Stop`. |
| `pretooluse-git.mjs` | PreToolUse (Bash/PowerShell/EnterWorktree) | Refuse `add -A`/`.`/`--all`, `commit -a` ; refuse commit/push/worktree sous `.claude/wave.lock`. |
| `posttooluse-format.mjs` | PostToolUse (Edit/Write) | Prettier si configuré, silencieux sinon. |
| `postmodelswitch-journal.mjs` | PostModelSwitch | Journalise chaque changement (`.claude/journal-modeles.jsonl`), jamais bloquant. |
| `stop-contexte.mjs` | Stop | **Gate** (§9c) : refuse si code modifié sans suivi touché, session commitée sans `.revue.md` ajouté par un commit (repère `Revues:` disparu — §4a), plafond dépassé, ou — **C3** — commits d'avance/fichiers suivis non commités. Exemptions : pas de remote, `wave.lock`, remote injoignable (avertissement). Bloque une fois, rappelle si la liste change ; sous `wave.lock`, seuls les plafonds comptent. |

### Plafonds de lignes

Source : `${CLAUDE_PLUGIN_ROOT}/hooks/plafonds.json` — `STATUS.md` 80 · `TASKS.md` 60 · `VALIDATION.md` 60 · `DECISIONS.md` 150 · `PROJECT_MAP.md` 200 · `CLAUDE.md` 200 · `plans/P<n>/S<k>.echec.md` 40 (posé comme donnée — `depassements()` ne compare qu'un chemin fixe, pas un motif variable : à câbler dans `lib.mjs`). Un dépassement est une **gate** (§9c) : déclenche `/purge-contexte` sans rien demander.

## 8. Anti-patterns

- Lancer Opus sur du déjà cadré ; envoyer à Sonnet/Haiku un scope flou → dérive.
- Reprendre un échec d'environnement/prémisse avec un modèle au-dessus (§9a) ; conclure `FAIL` sans nommer la nature, ou s'entêter au-delà d'une correction (§9a).
- Arrêter un plan sur une prémisse jamais confrontée au dépôt (§9c).
- Rendre la main sur un manque d'information au lieu de chercher, ou à l'inverse trancher à la place de l'utilisateur, ou relancer hors budget (§9c) ; poser un arrêt en rapport plutôt qu'en question.
- Signaler un incident de workflow en prose ou dans `TASKS.md` (§9b).
- Relancer une 3ᵉ fois en montant l'effort quand le modèle est le problème (§3) ; laisser `xhigh` en permanence.
- Empiler des tâches hors critères de regroupement, ou démarrer à froid pour une tâche `low`.
- Explorer le repo en contexte Opus, ou faire soi-même ce qu'un agent mécanique ferait (§5) — lancer `n0.mjs` en direct n'en fait pas partie (C1).
- Improviser hors du `S<k>.md`, mélanger deux sessions, ou en enchaîner deux d'un plan dans une conversation (§5b).
- Rendre la main sans pousser, ou démarrer sans être à jour (§4b, C3).
- Écrire dans `VALIDATION.md` ce qu'un navigateur constate seul (§6).
- Recopier un statut à deux endroits (§4a), ou du texte au lieu de pointer vers la source.
- Laisser grossir un fichier de contexte au-delà de son plafond « juste pour cette fois ».

## 9. Échecs et incidents — *domicile, les autres fichiers renvoient ici*

### 9a. Diagnostiquer avant de conclure

Diagnostiquer **ouvre la lecture** (C5) : pas bornée à la liste « Lire », seule l'écriture l'est. Une session qui échoue nomme d'abord la **nature** — elle décide de ce qui suit :

| Nature | Ce que c'est | Ce que la session fait | Reprise |
| --- | --- | --- | --- |
| **environnement** | outillage en cause : permission, outil absent, hook, verrou, dépendance, humain requis absent | à portée → corriger et continuer ; sinon `FAIL` nommé + incident (§9b) | même modèle, sous-agent |
| **exécution** | environnement sain, ça n'aboutit pas | **une** correction, N0 juge ; encore rouge → `FAIL` | un cran au-dessus |
| **prémisse** | une hypothèse du plan est fausse | `FAIL` **sans corriger**, hypothèse **falsifiable** | `verificateur-premisse` : réfutée → exécution ; confirmée → question (§9c) |

Filtre de contenu : nature à part, jamais reprise à l'identique. Table complète : `references/remediation.md`. La nature décide aussi du canal de reprise (§9c).

**Budget en hypothèses (C5)** : 3 distinctes max, chacune dans « Déjà écarté » avant la suivante ; arrêt sur répétition, ou contexte > 70 %.

**Amendement (C5)** : prémisse fausse **avec mesure commitée**, objectif inchangé, remède dans la zone, aucun critère d'arrêt (§1) touché ⇒ écrit dans « Écarts au plan » (commit séparé, repère `Amendement :`), la session **continue** — le relecteur juge après (§9c). `Auto : oui` peut être écrit par la session en échec elle-même, mêmes critères que l'enquête.

**Ceinture de fichiers dérivés** : extension sans STOP si (1) **forcée** par un changement déjà au périmètre, (2) contenu **dérivé mécaniquement**, (3) **commit séparé** signalé au bilan — sinon STOP. **Instrument de mesure faux** : constat avec preuve, pas un `FAIL`.

**Correctif localisé, posé par la session qui le trouve** (même hors périmètre, même si le `S<k>.md` dit « ne corrige pas ») si : (1) **cause mesurée**, (2) **remède petit** (1-2 fichiers, ~30 lignes hors tests), (3) **réversible** (pas de migration/dépendance/contrat), (4) **jugé** par la gate et N0. Commit séparé, `Plan:` + `Correctif localisé : <fichiers>`, signalé au bilan ; condition manquante → table ci-dessus. Seul le bandeau peut l'éteindre (`interdit — <raison>`). Bloquant de revue qui tient les quatre conditions ⇒ **reprise automatique**, pas un `[x]!` en attente.

*Pourquoi* : `docs/decisions/2026-09-09-nature-de-l-echec-et-incidents.md`, `docs/decisions/2026-09-17-gates-sans-arret-et-correctif-localise.md`.

### 9b. Incident de workflow — le fichier qui remonte

**Quand le workflow casse** (hook à tort, permission, outil absent, verdict perdu, revue non déposée, cache périmé) : le signaler en prose ne sert à rien, la conversation disparaît. Un fichier `docs/workflow/incidents/YYYY-MM-DD-<slug>.md`, **commité et poussé** (§4b), 25 lignes, faits bruts :

```md
# Incident workflow — YYYY-MM-DD — <titre court>

- Projet : <dépôt> · Workflow : v<version, manifest.json> · Plan : P<n>/S<k>[/T<m>] ou —
- Environnement : <Desktop|VSCode|cloud> · <sous-agent|à la main>
- Étape : <skill/étape> · Nature : <environnement|exécution|prémisse|orchestration>

## Symptôme
<observé tel quel — 5 lignes max>

## Preuve
<commande/chemin/sortie brute — pas d'interprétation>

## Sur place
<contournement, ou « rien »>
```

Qui écrit : la session qui le rencontre (`/fin-de-tache`, avant commit) ; la session en échec d'environnement ; l'orchestrateur pour ce que lui seul voit. Jamais `TASKS.md`/`STATUS.md`. Un `.echec.md` se supprime résolu ; un incident **reste**.

### 9c. Ce qui remonte à un humain — et sous quelle forme — *domicile ; `/orchestrer-plan` et `/reprendre-echec` l'appliquent, ne la reformulent pas*

**On ne s'arrête que sur un choix** dont la réponse change ce qu'il faut faire et que seul l'utilisateur peut trancher. Le reste se cherche, automatiquement (`EXECUTANT.md` applique ce critère aux trois natures, §9a). **Gate** = refuse, ne demande pas, se rapporte après. **Question** = choix soumis, options chiffrées, conséquences observables. **Contrainte d'outillage** = l'humain pose un geste que rien d'autre ne peut poser (régler modèle/effort, lancer hors Desktop — §3, §5b), pas un point d'arrêt de conception.

| Ce qui arrive | Ce que c'est | Ce qui suit |
| --- | --- | --- |
| N0 rouge après correction / aucune piste en une passe | hypothèse fausse / manque d'info | **enquête** |
| « prémisse fausse » (affirmation non vérifiée) | à vérifier | `verificateur-premisse` → reprise si réfutée, question si confirmée ; `INDECIDABLE·comportementale` → question |
| … et une **mesure commitée** le prouve | une preuve | **question** ou extension, comme réfutée |
| remédiation d'environnement à portée | rien | **appliquer et continuer** (§9a) |
| cause mesurée, remède petit et réversible, hors périmètre | rien | **correctif localisé** (§9a) |
| prémisse fausse + mesure commitée + remède en zone + objectif intact | un **amendement** | la session écrit et continue (§9a) |
| prémisse non sondable / options d'enquête insatisfaisantes | réponse qu'à l'exécution | **exploration ouverte** (C6) |
| bloquant de revue aux quatre conditions du correctif localisé | remède déjà connu | **reprise automatique**, pas un `[x]!` en attente |
| enquête `OPTIONS` recommandant `Auto : oui` | remède connu | **reprise** qui l'applique |
| vague collectée, tout `PASS` | rien | **vague suivante** — seule `validation-humaine` arrête |
| migration à annuler, permission à élargir, prémisse confirmée, budget épuisé | un choix | **question** |

*Pourquoi* : un humain qui reçoit « ça a échoué » n'a aucune information de plus que l'orchestrateur ; décider à sa place dépasse le rôle de l'orchestrateur.

**Canal de reprise, trois conditions observables** — `SendMessage` **si et seulement si** : (1) **agent reprenable** (identifiant de l'appel `Agent`, jamais `ListAgents` ; un `SendMessage` en échec = démarrage à froid, sans retenter) ; (2) **N0 vert**, constaté par un `n0.mjs` lancé par l'**orchestrateur** lui-même ; (3) **aucune fausse piste** (`Tentatives : reprise=0`, `Blocage :` nomme un geste). Une condition manque → démarrage à froid, toujours pour un agent à bout de tours, une hypothèse fausse ou un retour `partial`.

**Budget** : 2 reprises et 1 enquête par session, 2 enquêtes par plan — ligne mécanique (`Tentatives : reprise=<n> enquete=<n>`, gabarit `/reprendre-echec`), survit à une orchestration relancée. Épuisé → question, rien ne relance. `SendMessage` consomme une reprise, ne se retente pas en échec.

**La forme n'est pas cosmétique** : un arrêt = **question** (phrase, 2-4 options chiffrées, une recommandation, ce qui reste lançable) — jamais un renvoi qui fait refaire le diagnostic payé. Les options viennent de l'enquête (`## Issues` du `.echec.md`) ou de `/orchestrer-plan` Étape 6.
