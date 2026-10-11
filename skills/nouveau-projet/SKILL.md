---
name: nouveau-projet
description: "Démarrer un projet : interview de cadrage guidée puis instanciation des fichiers de contexte, settings et git. À dérouler avec Opus dans le futur repo vide, avant toute autre chose."
---

# Nouveau projet — interview de cadrage

À dérouler **avec Opus**, dans le repo du futur projet. Sortie : `PROJECT_BRIEF.md` rempli +
fichiers de contexte instanciés + premier commit. Cette skill ne cadre pas de plan
(`/nouveau-plan` s'en charge) et ne dessine pas de maquette.

## Comment cette skill est arrivée dans un repo vide

Le workflow est **vendoré** : il vit sous `.claude/` du projet, pas dans un plugin installé. Un
repo vide n'a donc rien — d'où une commande d'amorçage, à passer avant tout le reste :

```bash
git clone --depth 1 https://github.com/kovuthecat/claude-workflow "${TMPDIR:-/tmp}/wf" && node "${TMPDIR:-/tmp}/wf/bin/sync-workflow.mjs" --source "${TMPDIR:-/tmp}/wf" --projet .
```

Elle n'exige aucun état préalable — ni plugin, ni marketplace, ni CLI `claude` sur le `PATH` :
seulement `git` et `node`, que tout environnement Claude Code possède. C'est ce qui la rend
utilisable à l'identique depuis l'app Desktop, VS Code, une session cloud ou l'appli mobile.

Depuis le dossier parent des projets, `/creer-projet` (source : `plugin/lanceur/` du dépôt
Templates) fait cet amorçage et `git init`, puis bascule la session ici : la question 14 est alors
déjà tranchée, et la Phase C étape 1 n'a pas à dérouler `/maj-workflow` sur un vendoring qui vient
d'être posé.

Si vous lisez ceci depuis une session, l'amorçage a déjà eu lieu (ou le plugin optionnel est
installé) : passer à la Phase A.

## Phase A — Interview

**Une question à la fois, jamais un mur de questions.** Reformuler chaque réponse en 1 ligne avant
de passer à la suivante — l'utilisateur doit pouvoir corriger avant que ça s'accumule.

1. **Problème & objectif** — qu'est-ce qui est pénible aujourd'hui ? à quoi ressemble « réussi » ?
2. **Utilisateurs & contexte d'usage** — qui, sur quel appareil, à quelle fréquence ? (→ section
   « Usage prévu » du brief.)
3. **Usage & déploiement** — perso ou pas, usage local ou pas, déploiement prévu ou pas, d'autres
   utilisateurs que la personne qui développe ou pas (4 oui/non → section « Usage prévu » du brief).
4. **Fonctionnalités MVP** — 3 à 7, formulées en verbes ; pour chacune : indispensable au jour 1 ?
5. **Hors-périmètre explicite** — ce qu'on refuse de faire au MVP, au moins 3 items.
6. **Vision & idées futures** — au-delà du MVP, la direction générale si tout se passe bien ; idées
   de v2 notées mais jamais promises.
7. **Plateformes cibles** — desktop / mobile / PWA (conditionne les contraintes UI). (→
   `ARCHITECTURE.md`, instancié en Phase D.)
8. **Contraintes** — offline, accessibilité, ton visuel, perf. Un nombre, un seuil ou une liste
   fermée issus de la réponse s'écrivent **« provisoire, à mesurer au premier plan »**, jamais en
   invariant (12 blocages sur 51, presque tous révisés au premier contact avec le réel). Un critère
   d'aspect sans seuil mesurable (« lisible à 1 m ») est un **jugement humain** : N2
   (`VALIDATION.md`), pas une règle.
8b. **Interdits** (question ajoutée après la 8 ; suffixe, pour ne pas renuméroter les questions
    citées ailleurs) — « Y a-t-il des familles de solutions à exclure (dépendances, persistance,
    réseau, IA, interface, authentification…) ? » Pour chacune : le **motif**, et la **condition de
    levée** (« tant que… », « sauf si… ») — 24 blocages sur 51 venaient d'interdits absolus sur une
    classe de solutions, posés sans motif ni sortie. Exception : un interdit qui protège **une
    donnée ou une action précise** (données patient, secrets, NAS en lecture seule) reste
    **absolu**, motif seul — ces interdits n'ont jamais bloqué.
9. **Données** — entités principales, volumétrie, besoin multi-appareil ? (→ `ARCHITECTURE.md`,
   instancié en Phase D.)
10. **Stack** — candidats **au regard des contraintes de la question 8** ; la stack familière
    (Vite+React+TS, Dexie ou Supabase selon les projets existants) reste le candidat privilégié pour
    son coût de maintenance connu, **à condition de satisfaire le besoin** — dire en une ligne ce
    qu'elle couvre et ce qui manque. Couvre aussi backend, base (cohérente avec la question 9),
    authentification, hébergement. Fondations ouvertes (aucune stack imposée) → dérouler
    `${CLAUDE_PLUGIN_ROOT}/skills/cadrer/references/rechercher-existant.md` sur les briques
    décisives (persistance, hébergement, base de départ) ; stack imposée par l'utilisateur → la
    respecter, et chercher les briques utiles **dans ce cadre**.
11. **Risques connus** — ce qui pourrait faire échouer ou compliquer le projet (technique, temps,
    dépendance externe), au moins 1.
12. **Stratégie de test — question OBLIGATOIRE, jamais optionnelle** — quel runner (vitest en
    devDependency par défaut), quelles logiques pures seront testées dès le MVP ; si la réponse est
    « aucun test », l'exiger justifiée et consignée dans `DECISIONS.md` du futur projet.
13. **UI ou pas** — détermine si `DESIGN_SPEC.md` est copié et si une étape maquette existe dans la
    suite.
14. **Nom du projet + emplacement du repo.**

## Phase B — Restitution (gate)

Remplir d'abord la grille (`${CLAUDE_PLUGIN_ROOT}/skills/cadrer/references/preparation.md`) ; la
synthèse porte les dimensions `OPEN` avec qui les résout. Une `OPEN` de type `décision` est une
question de la synthèse, pas une approbation de plus.

Synthèse de l'interview en **≤ 15 lignes**, à faire valider explicitement par l'utilisateur **avant
d'écrire le moindre fichier**. Pas de « je considère que c'est validé » implicite — attendre le oui.
Jugement produit (`WORKFLOW.md` §9c) : aucune gate ne saurait évaluer une synthèse d'interview à la
place d'un humain.

## Phase B2 — Règles (gate)

Après la validation de la synthèse (Phase B), avant toute écriture. Les règles candidates sortent
de l'interview : les contraintes de la question 8, les interdits de la 8b, les contraintes de
stack de la 10, la stratégie de test de la 12. Une règle est **présentée seule**, dans sa **forme
écrite finale** (celle qui ira dans `CLAUDE.md` § Règles spécifiques au projet, format du gabarit :
règle, motif, levée ; `— absolu` pour un interdit ciblé ; `(provisoire, à mesurer au premier plan)`
pour un chiffre). L'utilisateur répond pour chacune : **garder, assouplir ou retirer**.

- Une règle à la fois, jamais un lot : l'utilisateur doit voir chaque règle avant qu'elle ne
  contraigne un plan.
- **Rien n'est écrit avant la dernière réponse.** Même statut de gate que la Phase B : attendre la
  réponse, jamais d'implicite (`WORKFLOW.md` §9c).
- Une règle assouplie est reformulée et re-présentée avant d'être retenue ; une règle retirée ne
  s'écrit nulle part.

## Phase C — Instanciation mécanique (seulement après validation des Phases B et B2)

1. **Vendorer le workflow**, s'il ne l'est pas déjà (`.claude/workflow/manifest.json` absent) —
   c'est la commande d'amorçage en tête de cette skill. Si le manifeste existe : le workflow est
   déjà là, dérouler `/maj-workflow` (contrôle de version, C4), puis continuer.

2. Copier `.claude/workflow/templates/project-settings.json` → `.claude/settings.json`.

   > Ce fichier câble les 5 hooks en `$CLAUDE_PROJECT_DIR/.claude/workflow/hooks/`. Il ne porte
   > **ni** `enabledPlugins`, **ni** `extraKnownMarketplaces` : le workflow est dans le repo, il
   > n'y a rien à rapatrier au démarrage. Les deux ensemble le chargeraient deux fois.
   >
   > **Dériver `permissions.allow` de la stack** (question 10) et du runner de tests (question 12) :
   > les commandes **réelles** de build, de typecheck, de lint et de tests remplacent les entrées
   > `npm`/`npx` de l'exemple JavaScript — jamais les laisser telles quelles sur une autre stack
   > (incident Chords, 2026-09-09). **Ne jamais retirer une entrée du socle** (les entrées du
   > gabarit hors `npm`/`npx` : lire, éditer, committer, pousser, `n0.mjs`…) : des sessions
   > headless ont été bloquées faute de `pytest`, de `git push` ou de `n0.mjs` dans l'allow.
   > La dérivation est faite **une fois** (étape 4) et sert aussi à `CLAUDE.md` et `n0.json`.

3. Copier depuis `.claude/workflow/templates/` : `PROJECT_BRIEF.md`, `ARCHITECTURE.md`,
   `DECISIONS.md`, `PROJECT_MAP.md`, `STATUS.md`, `TASKS.md`, `VALIDATION.md`, `CLAUDE.md`
   (squelette) — et, si la réponse à la question 13 est « oui, il y a une UI », `DESIGN_SPEC.md`.

   > Les squelettes voyagent **dans le repo** depuis le vendoring : ne jamais aller les chercher
   > dans un checkout du dépôt source (chemin qui n'existe que sur la machine du développeur).

4. **Commandes et `.claude/n0.json`, écrits ensemble** — une seule étape, à partir de la **même
   dérivation** de la stack (question 10) et du runner (question 12) que l'allow de l'étape 2 :
   `CLAUDE.md` § Commandes reçoit les commandes réelles (build, typecheck, tests, test ciblé, lint,
   dev) et `.claude/n0.json` (`{ "commandes": [{ "nom": "build", "cmd": "…" }, …], "testCible": "…" }`,
   cf. `n0.mjs`) les reprend à l'identique. Les deux sont écrits **même si le scaffold n'existe pas
   encore** : le premier plan les fera passer au vert (Phase D). Ils ne peuvent pas diverger parce
   qu'ils sortent de la même dérivation ; `n0.json` entre dans le premier commit.
   **Projet sans build ni test** (réponse 12 « aucun test » **et** pas de build) : `n0.json` est
   `{ "commandes": [], "sansCommande": "<motif>" }` (une liste vide sans motif ne vaut pas
   déclaration), et § Commandes le dit en une ligne ; `/nouveau-plan` écrira alors
   `Preuve N0 : non requise`.

5. **Règles validées** : celles que la Phase B2 a gardées ou assouplies vont dans `CLAUDE.md` §
   Règles spécifiques au projet, **au format du gabarit** (`<règle> — motif : … — levée : …` ;
   `— absolu` pour un interdit ciblé ; `(provisoire, à mesurer au premier plan)` pour un chiffre).
   C'est la **seule** source des règles : `PROJECT_BRIEF.md`, `ARCHITECTURE.md` et
   `DESIGN_SPEC.md` y renvoient sans les recopier. Aucune règle retirée en B2 n'est écrite.

6. Ajouter `.claude/wave.lock` et `.claude/n0/` au `.gitignore` (marqueurs/journal locaux, jamais
   versionnés) — **jamais** `*.revue.md` ni `*.echec.md` : ces deux-là sont commités (C3).

7. Remplir `PROJECT_BRIEF.md` avec les réponses de l'interview (chaque section a une question
   source en Phase A — aucune section ne doit rester à instancier sans réponse).
8. Supprimer les sections de template non pertinentes pour ce projet précis (une section vide est
   du bruit payé à chaque lecture — ne pas la laisser vide, la retirer).
9. `git init` (s'il n'a pas eu lieu avant l'amorçage). **Dépôt sous un dossier synchronisé ?**
   (`SynologyDrive`, `OneDrive`, `Dropbox`, `iCloud` dans le chemin) : demander à l'utilisateur
   de **déplacer le dépôt hors de l'arborescence du client** — une exclusion de synchro ne suffit
   pas, le client filtre aussi le contenu exclu (`.git` corrompu, Vite qui ne démarre jamais :
   torrent-uploader, 2026-09-11 et 09-16). Action hors du dépôt, qu'aucune gate ne peut poser à sa
   place (`WORKFLOW.md` §9c) : attendre le oui, reprendre au nouvel emplacement. S'il choisit de
   rester : `touch .git/info/synchro-exclue`. Puis premier commit, staging explicite,
   message exact : `chore: instanciation projet depuis Templates`. Le commit inclut `.claude/`
   (workflow vendoré, `settings.json`, **`n0.json`**) et les fichiers de contexte, `CLAUDE.md`
   compris — c'est ce qui rend le workflow disponible à quiconque clone, dans tous les
   environnements.

## Phase D — Étapes suivantes

1. Rédiger `ARCHITECTURE.md` (avec Opus) — annoncer, ne pas exécuter ici.
2. Si UI : `DESIGN_SPEC.md` + maquette Claude Design (claude.ai), écran par écran — annoncer, ne pas
   exécuter ici.
3. Dérouler `/nouveau-plan` pour cadrer le premier plan (`P1`) à partir du brief, de l'architecture
   et de la maquette — annoncer, ne pas exécuter ici.
4. Consigne pour le premier plan : la session de scaffold de P1 porte en Validation le
   typecheck `--listFiles` non nul (piège scaffold Vite/TS — cf. `CLAUDE.md` § Commandes) et un
   `.claude/n0.json` aligné sur `CLAUDE.md` § Commandes — annoncer, ne pas exécuter ici.
5. Renseigner `.claude/launch.json` si le projet a un serveur dev — annoncer, ne pas exécuter ici.
