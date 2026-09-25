# Voies de migration — Phase B1 (Bascule) et Phase B2 (Adoption)

Annexe de `/migrer-projet` — ouvrir la section qui correspond à la voie retenue par la Phase A
(« Classer — la voie découle du diagnostic »), au moment d'écrire.

## Phase B1 — Bascule *(voie 1, et point 8 pour la voie 3)*

Ordre imposé : le gain décroît, le risque croît.

1. **Vendorer le workflow** — c'est le cœur de la bascule. Depuis la racine du projet :

   ```bash
   git clone --depth 1 https://github.com/kovuthecat/claude-workflow "${TMPDIR:-/tmp}/wf" && node "${TMPDIR:-/tmp}/wf/bin/sync-workflow.mjs" --source "${TMPDIR:-/tmp}/wf" --projet .
   ```

   Le moteur écrit `.claude/skills/`, `.claude/agents/`, `.claude/workflow/` et le manifeste. Il
   **n'écrase ni** les skills propres au projet, **ni** le `AGENTS.md` racine.

2. **Settings** — remplacer `.claude/settings.json` par
   `.claude/workflow/templates/project-settings.json`, qui câble les 5 hooks en
   `$CLAUDE_PROJECT_DIR/.claude/workflow/hooks/`. **Fusionner** : `permissions.allow` = union de
   l'ancienne liste et de la nouvelle, jamais un remplacement — elle a été enrichie par l'usage réel.

   Puis **retirer** ce qui n'a plus d'objet : `enabledPlugins`, `extraKnownMarketplaces`, le hook
   `SessionStart` de bootstrap, et les entrées de hooks à chemins absolus. Ces lignes servaient à
   rapatrier au démarrage des fichiers désormais présents dans le repo ; les garder chargerait le
   workflow **deux fois**.

3. **Bootstrap obsolète** — supprimer `.claude/hooks/session-start.sh` s'il existe.

4. **`CLAUDE.md`** — supprimer la ligne d'import `@…CLAUDE-BASE.md`. Ne **rien** mettre à la place
   (le hook `SessionStart` vendoré injecte les règles). Garder tout le reste. Supprimer aussi une
   section `# Compact instructions` héritée : elle vit désormais dans `CLAUDE-BASE.md` §Compactage,
   injecté à chaque session — la garder ici la fige à la version du jour de la migration.

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
   `.claude/launch.json` s'il y a un serveur dev ; ajouter `.claude/wave.lock` et `.claude/n0/` au
   `.gitignore` (jamais `*.revue.md` ni `*.echec.md` : commités, C3) ; créer `.claude/n0.json` à
   partir des commandes relevées au point 6 de la Phase A (`{ "commandes": [{ "nom": "build", "cmd":
   "…" }, …], "testCible": "…" }`, cf. `n0.mjs`), committé.

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

3. **`.gitignore`** — y ajouter `.claude/wave.lock` et `.claude/n0/` s'ils manquent (marqueurs/
   journal locaux, jamais versionnés) — jamais `*.revue.md` ni `*.echec.md` : commités (C3).

4. **`CLAUDE.md`** — partir de `.claude/workflow/templates/CLAUDE.md` et le remplir avec les
   **vraies commandes relevées en Phase A**, pas des placeholders. Si un `CLAUDE.md` existe déjà,
   garder son contenu spécifique et n'ajouter que ce qui manque. Ne **jamais** y écrire de ligne
   d'import `@…CLAUDE-BASE.md` : les règles communes sont injectées par le hook `SessionStart`.

   > **Piège typecheck à vérifier ici, pas plus tard** : sur un scaffold Vite/TS, le tsconfig racine
   > est en `files: []` + références de projet, et `tsc --noEmit` y compile 0 fichier — un vert vide
   > qui ne bloque plus rien. Contrôle :
   > `<commande typecheck> --listFiles | grep -v node_modules | wc -l` doit être **non nul** ; sinon
   > la commande est `tsc -b --noEmit`.

   Créer ensuite `.claude/n0.json` à partir de ces mêmes commandes (`{ "commandes": [{ "nom":
   "build", "cmd": "…" }, …], "testCible": "…" }`, cf. `n0.mjs`) — jamais deviné.

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
