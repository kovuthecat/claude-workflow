---
name: migrer-projet
description: Rattacher un projet existant au workflow en le vendorant dans le dépôt, puis vérification prouvée. À dérouler si le projet n'est pas encore sur ce workflow, ou si son outillage est incomplet ou daté.
model: sonnet
---

# Rattacher un projet existant au workflow

Procédure exécutable, à dérouler **dans le projet concerné**. Le frontmatter demande **Sonnet,
effort `medium`** — du jugement, mais borné. Référence longue : `.claude/workflow/MIGRATION.md`
(disponible après le vendoring), pour les cas tordus (contexte dans un sous-dossier, nom non
standard, annexe par projet).

**État cible** : le workflow vit **dans le dépôt**, sous `.claude/`. Rien à installer, sur aucune
machine ni aucun environnement — l'app Desktop, VS Code, une session cloud et l'appli mobile y ont
accès parce qu'ils clonent le dépôt.

**Ne pas demander à l'utilisateur dans quel cas il est.** La Phase A le détermine par lecture, et
c'est précisément le travail : deux états de départ très différents mènent au même état cible, par
des voies qui ne se ressemblent qu'au début et à la fin.

**Priorité absolue : ne jamais perdre de contenu spécifique au projet.** En cas de doute :
conserver et signaler dans le rapport, jamais supprimer.

## Phase A — Diagnostic (lecture seule, aucune écriture)

**Déléguer, ne pas lire soi-même.** Un inventaire lu en direct remplit le contexte de chemins et
d'extraits qu'on paie ensuite à chaque tour, alors que seule la synthèse sert. Lancer l'agent
`explorateur` pour la carte du dépôt, `resumeur-git` pour l'état git.

Constater, ne rien corriger encore. Huit points :

1. `.claude/settings.json` — existe-t-il ? Résidus du modèle plugin : `enabledPlugins`,
   `extraKnownMarketplaces`, hook `SessionStart` de bootstrap (`.claude/hooks/session-start.sh`),
   entrées de hooks à **chemins absolus** — tous à retirer. Une `permissions.allow` enrichie par
   l'usage réel du projet est en revanche à **préserver**, jamais à écraser.
2. `CLAUDE.md` — existe-t-il ? ligne d'import `@…CLAUDE-BASE.md` ? section `# Compact instructions` ?
   vraies commandes du projet, ou placeholders jamais remplis ?
3. **Workflow déjà vendoré ?** — `.claude/workflow/manifest.json` présent = le projet est déjà au
   format cible, seule une synchronisation peut être due (`/maj-workflow`). Repérer aussi les
   **jonctions** `~/.claude/skills/<nom>`, qui masqueraient les skills vendorées.
4. Copies locales obsolètes de `WORKFLOW.md`, `CONVENTIONS.md`, `AGENTS.md` central, `MIGRATION.md`,
   `CHANGELOG.md`, README de workflow.
5. **Fichiers de contexte — y en a-t-il ?** Racine, ou `Contexte/`, `fichierscontexte/`,
   `CONTEXTE/<x>-context/`, `SPEC.md`, `ROADMAP.md`, `PLAN_*.md`. Plusieurs variantes peuvent
   coexister (migration précédente incomplète) : ne pas s'arrêter à la première. **Aucun fichier de
   contexte nulle part** est le signe le plus net de la voie 2.
6. **Stack, commandes et code déjà écrit** — `package.json` (scripts, dépendances), et selon le cas
   `pyproject.toml`, `Cargo.toml`, `go.mod`, `Dockerfile`. Relever les vraies commandes de dev,
   build, test, lint, typecheck. Repérer aussi la doc déjà là (`README.md`, `docs/`, `TODO.md`).
7. **Serveur dev et UI** — conditionne `.claude/launch.json` (requis par le N1) et `DESIGN_SPEC.md`.
8. Dette de format — `DECISIONS.md` non éclaté en `docs/decisions/` ? blocs `### Statut` dans des
   `S<k>.md` de plans **en cours** ? items N1 dans `VALIDATION.md` ? plafonds dépassés
   (`.claude/workflow/hooks/plafonds.json`) ?

### Classer — la voie découle du diagnostic

| Ce que la Phase A a trouvé | Voie | Phase B à dérouler |
| --- | --- | --- |
| Import `@…CLAUDE-BASE.md`, `enabledPlugins`, hooks à chemins absolus, skills copiées | **1 — Bascule** | B1 |
| Du code, mais ni `.claude/settings.json`, ni fichiers de contexte, ni `plans/` | **2 — Adoption** | B2 |
| Déjà vendoré (`manifest.json` présent) — seulement de la dette de format (point 8) | **3 — Entretien** | `/maj-workflow`, puis B1 point 8 |
| Repo **vide**, aucun code | *hors périmètre* | STOP → `/nouveau-projet` (interview de cadrage) |

Les états se mélangent (migration précédente inachevée) : dérouler alors les points concernés des
deux voies, dans l'ordre de B1 puis B2.

## Voie 1 — Le piège qui fait tout rater : le double chargement

*(À lire seulement si la Phase A a classé en voie 1 ou 3.)*

Les **mêmes** règles communes (`CLAUDE-BASE.md`) peuvent arriver par trois canaux : l'import
`@<chemin absolu>` du `CLAUDE.md`, le plugin installé, et désormais la copie vendorée. Ils doivent
bouger **ensemble**, dans la même passe — sinon le contexte est payé en double à chaque session,
ou disparaît entièrement.

| Vendoré | `enabledPlugins` | import `@…CLAUDE-BASE.md` | Résultat |
| --- | --- | --- | --- |
| non | absent | présent | état d'avant migration — fonctionne, rien n'est cassé |
| non | présent | présent | règles chargées **deux fois** |
| **oui** | **présent** | — | **deux fois**, et deux versions possiblement différentes |
| non | absent | absent | **plus aucune règle commune** — panne silencieuse, la pire |
| **oui** | absent | absent | ✅ cible |

Les états fautifs sont invisibles à l'œil : la Phase D les fait tomber mécaniquement.

## Voie 2 — Le principe : le brief se dérive du code

*(À lire seulement si la Phase A a classé en voie 2.)*

C'est l'inverse exact de `/nouveau-projet`, qui interroge des intentions parce qu'il n'y a rien à
lire. Ici il y a des milliers de lignes qui disent déjà la stack, le découpage et la moitié du
périmètre. Les redemander à l'utilisateur, c'est lui faire dicter ce qu'une lecture donne
gratuitement — et récolter une description idéalisée plutôt que l'état réel.

**Interview courte : seulement ce que le code ne dit pas.** Six questions, une à la fois, chaque
réponse reformulée en une ligne avant la suivante.

1. **Pourquoi ce projet existe** — quel problème il résout, à quoi ressemble « réussi ». (→ `PROJECT_BRIEF.md`)
2. **Usage prévu** — perso ou pas, local ou déployé, d'autres utilisateurs que toi ou pas.
3. **Où il en est vraiment** — ce qui marche, ce qui est cassé, ce qui est à moitié fait. La réponse
   la plus utile, et la seule qu'aucune lecture ne donne. (→ `STATUS.md`)
4. **Ce qui vient ensuite** — 3 à 7 items, sans les ordonner. (→ `TASKS.md`)
5. **Décisions déjà prises** dont il faut se souvenir — choix de stack contre-intuitif, contrainte
   externe, piège rencontré. Une ligne chacune. (→ `DECISIONS.md`)
6. **Stratégie de test — question obligatoire, jamais optionnelle** — ce qui est testé aujourd'hui
   (constaté en Phase A), ce qui devrait l'être. Une réponse « aucun test » doit être justifiée et
   consignée dans `DECISIONS.md`.

Ne pas demander ce que la Phase A a déjà établi. Si une réponse contredit le code, le dire et
trancher avec l'utilisateur : c'est souvent là que se trouve la vraie dette.

## Gate — restituer avant d'écrire

Synthèse en **≤ 15 lignes** : la voie retenue et pourquoi, l'état constaté, les fichiers qui seront
créés ou modifiés, ce qui sera supprimé, ce qui sera absorbé depuis la doc existante. Faire valider
explicitement par l'utilisateur **avant la première écriture** — une suppression de contenu projet
ne se rattrape qu'à la main.

## Phase B1 — Bascule *(voie 1, et point 5 pour la voie 3)*

Ordre imposé : le gain décroît, le risque croît.

1. **Vendorer le workflow** — c'est le cœur de la bascule. Depuis la racine du projet :

   ```bash
   git clone --depth 1 https://github.com/kovuthecat/claude-workflow "${TMPDIR:-/tmp}/wf" && node "${TMPDIR:-/tmp}/wf/bin/sync-workflow.mjs" --source "${TMPDIR:-/tmp}/wf" --projet .
   ```

   Le moteur écrit `.claude/skills/`, `.claude/agents/`, `.claude/workflow/` et le manifeste. Il
   **n'écrase ni** les skills propres au projet, **ni** le `AGENTS.md` racine.

2. **Settings** — remplacer `.claude/settings.json` par
   `.claude/workflow/templates/project-settings.json`, qui câble les 4 hooks en
   `$CLAUDE_PROJECT_DIR/.claude/workflow/hooks/`. **Fusionner** : `permissions.allow` = union de
   l'ancienne liste et de la nouvelle, jamais un remplacement — elle a été enrichie par l'usage réel.

   Puis **retirer** ce qui n'a plus d'objet : `enabledPlugins`, `extraKnownMarketplaces`, le hook
   `SessionStart` de bootstrap, et les entrées de hooks à chemins absolus. Ces lignes servaient à
   rapatrier au démarrage des fichiers désormais présents dans le repo ; les garder chargerait le
   workflow **deux fois**.

3. **Bootstrap obsolète** — supprimer `.claude/hooks/session-start.sh` s'il existe.

4. **`CLAUDE.md`** — supprimer la ligne d'import `@…CLAUDE-BASE.md`. Ne **rien** mettre à la place
   (le hook `SessionStart` vendoré injecte les règles). Garder tout le reste. Ajouter en fin de
   fichier la section `# Compact instructions` de `.claude/workflow/templates/CLAUDE.md` si absente.

5. **`AGENTS.md` racine** — Codex est sorti du workflow (v0.29.0) : il n'y a plus de fichier central
   à pointer. S'il existe et renvoie vers `.claude/workflow/AGENTS.md` (chemin relatif ou absolu),
   le signaler dans le rapport final — à supprimer ou à réécrire par l'utilisateur, jamais par cette
   skill. Conserver intégralement les règles propres au projet qu'il porte.

6. **Skills locales et copies** — supprimer les copies locales de la doc centrale (point 4 du
   diagnostic) et les **jonctions** `~/.claude/skills/<nom>` du workflow, qui masqueraient les
   skills vendorées. Une skill **propre au projet** n'est pas concernée : elle reste.

   > Ce point s'inversait dans l'ancien modèle, qui interdisait toute skill du workflow en local
   > précisément parce qu'elle masquait celle du plugin. Vendorer, c'est faire de la copie locale
   > la source — la règle qui compte devient « ne pas la modifier à la main » (voir le manifeste).
7. **Contenu** — pour chaque fichier de contexte non standard : générique (identique à un ancien
   template) → supprimer ; spécifique → conserver tel quel ; mixte → extraire le spécifique vers le
   fichier cible (commandes → `CLAUDE.md`, contrainte technique → `ARCHITECTURE.md` ou
   `DECISIONS.md`), puis supprimer le reste. Après un déplacement de sous-dossier vers la racine,
   corriger les renvois internes cassés par ce déplacement — et seulement ceux-là.
8. **Dette de format** — dérouler `/purge-contexte` (§DECISIONS, §STATUS, §VALIDATION) ; reporter
   les statuts des `S<k>.md` en cours dans la colonne Statut de l'`index.md` ; créer
   `.claude/launch.json` s'il y a un serveur dev ; ajouter `.claude/wave.lock` au `.gitignore`.

Ne pas réécrire le contenu produit (brief, décisions, roadmap) à l'occasion de la migration : on
classe et on déplace.

## Phase B2 — Adoption *(voie 2)*

Câblage d'abord (mécanique, sans risque), contenu ensuite (du jugement).

1. **Vendorer et câbler** — dérouler les points 1 et 2 de la Phase B1 : commande d'amorçage, puis
   `.claude/workflow/templates/project-settings.json` → `.claude/settings.json` (fusionner
   `permissions.allow` si un settings existait déjà). Rien de spécifique à l'adoption ici : les
   deux voies posent le même socle.

2. **`AGENTS.md` racine** — ne plus en créer : Codex est sorti du workflow (v0.29.0). S'il en existe
   déjà un renvoyant à `.claude/workflow/AGENTS.md`, le signaler dans le rapport final — à supprimer
   ou à réécrire par l'utilisateur.

3. **`.gitignore`** — y ajouter `.claude/wave.lock` s'il manque (marqueur local, jamais versionné).

4. **`CLAUDE.md`** — partir de `.claude/workflow/templates/CLAUDE.md` et le remplir avec les
   **vraies commandes relevées en Phase A**, pas des placeholders. Si un `CLAUDE.md` existe déjà,
   garder son contenu spécifique et n'ajouter que ce qui manque. Ne **jamais** y écrire de ligne
   d'import `@…CLAUDE-BASE.md` : les règles communes sont injectées par le hook `SessionStart`.

   > **Piège typecheck à vérifier ici, pas plus tard** : sur un scaffold Vite/TS, le tsconfig racine
   > est en `files: []` + références de projet, et `tsc --noEmit` y compile 0 fichier — un vert vide
   > qui ne bloque plus rien. Contrôle :
   > `<commande typecheck> --listFiles | grep -v node_modules | wc -l` doit être **non nul** ; sinon
   > la commande est `tsc -b --noEmit`.

5. **Fichiers de contexte** — copier depuis `.claude/workflow/templates/` puis remplir :

   | Fichier | Source du contenu |
   | --- | --- |
   | `PROJECT_BRIEF.md` | questions 1-2 de l'interview |
   | `PROJECT_MAP.md` | **inventaire de la Phase A** — dérivé, pas demandé |
   | `ARCHITECTURE.md` | stack et découpage **constatés** ; ce qui est en place, pas la cible |
   | `STATUS.md` | question 3 — photo stricte de l'état, sans historique |
   | `TASKS.md` | question 4 |
   | `DECISIONS.md` | question 5, une ligne par décision (le détail va dans `docs/decisions/`) |
   | `VALIDATION.md` | N2 en attente uniquement — souvent vide au départ, et c'est bien |
   | `DESIGN_SPEC.md` | seulement si le projet a une UI |

   **Respecter les plafonds dès l'écriture** (`.claude/workflow/hooks/plafonds.json`) : un
   fichier créé au-dessus de son plafond déclenchera le hook `Stop` à la première session.
   Supprimer les sections de template non pertinentes — une section vide est du bruit payé à chaque
   lecture.

6. **`.claude/launch.json`** — si le projet a un serveur dev (Phase A point 7). Requis par le N1.

7. **Doc existante** — la référencer depuis `PROJECT_MAP.md` plutôt que la recopier. Un `README.md`
   riche reste la source ; les fichiers de contexte pointent vers lui.

## Phase D — Gate de vérification (aucun rattachement n'est fini sans elle)

Commune aux deux voies. Les quatre premiers points sont mécaniques et se lancent **maintenant** ; le
cinquième exige une **nouvelle session**, la configuration n'étant lue qu'au démarrage.

1. `grep -c 'CLAUDE-BASE' CLAUDE.md` → **0**. Sinon : import non retiré (voie 1), ou ajouté par
   erreur (voie 2). Les règles viennent du hook, pas d'un import.
2. **Synchronisation propre** :
   ```bash
   node .claude/workflow/bin/sync-workflow.mjs --source <clone> --projet . --check
   ```
   → `ÉTAT: à jour`, exit **0**.
3. **Aucun résidu du modèle plugin** dans `.claude/settings.json` : ni `enabledPlugins`, ni
   `extraKnownMarketplaces`, ni chemin absolu. Les 4 hooks pointent vers
   `$CLAUDE_PROJECT_DIR/.claude/workflow/hooks/`, et `.claude/hooks/session-start.sh` n'existe plus.
   ```bash
   node -e "const j=require('./.claude/settings.json');const t=JSON.stringify(j.hooks);console.log('plugin:',!!j.enabledPlugins||!!j.extraKnownMarketplaces,'| absolus:',/[A-Za-z]:[\\\\/]/.test(t),'| hooks:',Object.keys(j.hooks).length)"
   ```
   Attendu : `plugin: false | absolus: false | hooks: 4`.
4. **Les hooks vendorés s'exécutent** — `node --check` sur chacun, et chaque fichier de contexte
   sous son plafond (`wc -l`) :
   ```bash
   for f in .claude/workflow/hooks/*.mjs; do node --check "$f" || echo "KO $f"; done
   ```
5. **Nouvelle session dans le projet** (la config n'est lue qu'au démarrage) : un `git add -A` de
   test doit être **refusé**, et les skills du workflow doivent être proposées. C'est la preuve que
   le câblage est actif, donc que `CLAUDE-BASE.md` est injecté. Vérifier que le hook `SessionStart`
   est silencieux (sinon : plafond dépassé → `/purge-contexte`).
6. **Tout est versionné.** `git status` ne doit laisser hors du commit ni `.claude/skills`, ni
   `.claude/agents`, ni `.claude/workflow`. C'est la condition qui rend le workflow disponible en
   session cloud et à quiconque clone : ces environnements ne voient que le dépôt.
7. **Dépôt sous un dossier synchronisé ?** (`SynologyDrive`, `OneDrive`, `Dropbox`, `iCloud` dans le
   chemin) : demander à l'utilisateur d'exclure le dossier `.git` dans son client de synchro (gate :
   attendre le oui), puis `touch .git/info/synchro-exclue` — corruption vue le 2026-09-11
   (torrent-uploader), sinon rappelé à chaque session par `sessionstart-contexte.mjs`.
8. **Coût de contexte** (mesure A1, `/choisir-mecanisme` point 8) : `/context` dans une session
   neuve pour ce projet, MCP scopés au projet, `CLAUDE.md` élagué si `/doctor` le propose.

Un point rouge = rattachement non fini. Ne jamais conclure sur « ça devrait marcher ».

## Fin

- Staging explicite, fichier par fichier (`git add -A` est refusé par hook). Commit :
  `chore(workflow): vendoring du workflow` (voie 1/3) ou `chore(workflow): adoption` (voie 2).
  Le commit **doit inclure** `.claude/skills`, `.claude/agents` et `.claude/workflow`.
  Si le dépôt n'a pas de `git init`, le signaler et demander — ne pas initialiser d'office.
- **Rapport final** : la voie déroulée, ce qui a été supprimé, ce qui a été conservé par prudence,
  ce qui a été absorbé depuis la doc existante, les écarts non résolus. Cas particulier tranché
  ici → l'ajouter à l'annexe de `MIGRATION.md` **dans le dépôt source**, pas dans la copie
  vendorée : celle-ci est un fichier géré, que la prochaine synchronisation écraserait.
- **Voie 2 — étape suivante à citer, pas à exécuter** : `/nouveau-plan` pour cadrer le premier plan
  à partir du `TASKS.md` fraîchement rempli.
