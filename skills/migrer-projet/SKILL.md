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
2. `CLAUDE.md` — existe-t-il ? ligne d'import `@…CLAUDE-BASE.md` ? section `# Compact instructions`
   héritée (elle a été centralisée dans `CLAUDE-BASE.md` §Compactage — à retirer, pas à compléter) ?
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
| Repo **vide**, aucun code | *hors périmètre* | gate (`WORKFLOW.md` §9c) → `/nouveau-projet` (interview de cadrage) |

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

## Question — restituer avant d'écrire

Synthèse en **≤ 15 lignes** : la voie retenue et pourquoi, l'état constaté, les fichiers qui seront
créés ou modifiés, ce qui sera supprimé, ce qui sera absorbé depuis la doc existante. Faire valider
explicitement par l'utilisateur **avant la première écriture** — une suppression de contenu projet
ne se rattrape qu'à la main. Irréversible (`WORKFLOW.md` §9c) : aucune gate ne juge une perte de
contenu à la place d'un humain.

## Phase B1 — Bascule *(voie 1, et point 8 pour la voie 3)*

Ordre imposé : le gain décroît, le risque croît. Procédure complète (8 points) : annexe
`references/voies-migration.md`, section « Phase B1 ».

## Phase B2 — Adoption *(voie 2)*

Câblage d'abord (mécanique, sans risque), contenu ensuite (du jugement). Procédure complète
(7 points) : annexe `references/voies-migration.md`, section « Phase B2 ».

## Phase D — Gate de vérification (aucun rattachement n'est fini sans elle)

Commune aux deux voies. **Ordre imposé** : D1 à D4 maintenant (mécaniques) → commit (« Fin »,
ci-dessous) → D6 à D8 maintenant, après le commit. **D5** ne se vérifie pas dans cette session : il
exige une **nouvelle session**, la configuration n'étant lue qu'au démarrage — le consigner au
rapport final comme restant à faire par l'utilisateur à sa prochaine session sur ce projet.

1. `grep -c 'CLAUDE-BASE' CLAUDE.md` → **0**. Sinon : import non retiré (voie 1), ou ajouté par
   erreur (voie 2). Les règles viennent du hook, pas d'un import.
2. **Synchronisation propre** :
   ```bash
   node .claude/workflow/bin/sync-workflow.mjs --source <clone> --projet . --check
   ```
   → `ÉTAT: à jour`, exit **0**.
3. **Aucun résidu du modèle plugin** dans `.claude/settings.json` : ni `enabledPlugins`, ni
   `extraKnownMarketplaces`, ni chemin absolu. Les 5 hooks pointent vers
   `$CLAUDE_PROJECT_DIR/.claude/workflow/hooks/`, et `.claude/hooks/session-start.sh` n'existe plus.
   ```bash
   node -e "const j=require('./.claude/settings.json');const t=JSON.stringify(j.hooks);console.log('plugin:',!!j.enabledPlugins||!!j.extraKnownMarketplaces,'| absolus:',/[A-Za-z]:[\\\\/]/.test(t),'| hooks:',Object.keys(j.hooks).length)"
   ```
   Attendu : `plugin: false | absolus: false | hooks: 5`.
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
   chemin) : demander à l'utilisateur de **déplacer le dépôt hors de l'arborescence du client** —
   une exclusion ne suffit pas, le client filtre aussi le contenu exclu (`.git` corrompu le
   2026-09-11, Vite bloqué le 2026-09-16, torrent-uploader). Action hors du dépôt, qu'aucune gate ne
   peut poser à sa place (`WORKFLOW.md` §9c) : attendre le oui. S'il choisit de rester :
   `touch .git/info/synchro-exclue` — sinon rappelé à chaque session par `sessionstart-contexte.mjs`.
8. **Coût de contexte** (mesure A1, `/choisir-mecanisme` point 8) : `/context` dans une session
   neuve pour ce projet, MCP scopés au projet, `CLAUDE.md` élagué si `/doctor` le propose.

Un point rouge = rattachement non fini. Ne jamais conclure sur « ça devrait marcher ».

## Fin

- Staging explicite, fichier par fichier (`git add -A` est refusé par hook). Commit :
  `chore(workflow): vendoring du workflow` (voie 1/3) ou `chore(workflow): adoption` (voie 2).
  Le commit **doit inclure** `.claude/skills`, `.claude/agents` et `.claude/workflow`.
  Si le dépôt n'a pas de `git init`, le signaler et demander — ne pas initialiser d'office : hors
  périmètre du projet (`WORKFLOW.md` §9c), une gate ne peut pas trancher à la place de
  l'utilisateur.
- **Rapport final** : la voie déroulée, ce qui a été supprimé, ce qui a été conservé par prudence,
  ce qui a été absorbé depuis la doc existante, les écarts non résolus. Cas particulier tranché
  ici → l'ajouter à l'annexe de `MIGRATION.md` **dans le dépôt source**, pas dans la copie
  vendorée : celle-ci est un fichier géré, que la prochaine synchronisation écraserait.
- **Voie 2 — étape suivante à citer, pas à exécuter** : `/nouveau-plan` pour cadrer le premier plan
  à partir du `TASKS.md` fraîchement rempli.
