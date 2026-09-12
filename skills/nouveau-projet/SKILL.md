---
name: nouveau-projet
description: Démarrer un projet : interview de cadrage guidée puis instanciation des fichiers de contexte, settings et git. À dérouler avec Opus dans le futur repo vide, avant toute autre chose.
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

Si vous lisez ceci depuis une session, l'amorçage a déjà eu lieu (ou le plugin optionnel est
installé) : passer à la Phase A.

## Phase A — Interview

**Une question à la fois, jamais un mur de questions.** Reformuler chaque réponse en 1 ligne avant
de passer à la suivante — l'utilisateur doit pouvoir corriger avant que ça s'accumule.

1. **Problème & objectif** — qu'est-ce qui est pénible aujourd'hui ? à quoi ressemble « réussi » ?
2. **Utilisateurs & contexte d'usage** — qui, sur quel appareil, à quelle fréquence ?
3. **Usage & déploiement** — perso ou pas, usage local ou pas, déploiement prévu ou pas, d'autres
   utilisateurs que la personne qui développe ou pas (4 oui/non → section « Usage prévu » du brief).
4. **Fonctionnalités MVP** — 3 à 7, formulées en verbes ; pour chacune : indispensable au jour 1 ?
5. **Hors-périmètre explicite** — ce qu'on refuse de faire au MVP, au moins 3 items.
6. **Vision & idées futures** — au-delà du MVP, la direction générale si tout se passe bien ; idées
   de v2 notées mais jamais promises.
7. **Plateformes cibles** — desktop / mobile / PWA (conditionne les contraintes UI).
8. **Données** — entités principales, volumétrie, besoin multi-appareil ? Oriente le choix de
   persistance : local-first Dexie vs Supabase, selon les habitudes des projets existants de l'utilisateur.
9. **Stack** — défaut Vite+React+TS sauf raison contraire ; toute déviation justifiée en 1 ligne.
   Couvre aussi backend, base de données (cohérente avec Q8), authentification, hébergement.
10. **Contraintes** — offline, accessibilité, ton visuel, perf.
11. **Risques connus** — ce qui pourrait faire échouer ou compliquer le projet (technique, temps,
    dépendance externe), au moins 1.
12. **Stratégie de test — question OBLIGATOIRE, jamais optionnelle** — quel runner (vitest en
    devDependency par défaut), quelles logiques pures seront testées dès le MVP ; si la réponse est
    « aucun test », l'exiger justifiée et consignée dans `DECISIONS.md` du futur projet.
13. **UI ou pas** — détermine si `DESIGN_SPEC.md` est copié et si une étape maquette existe dans la
    suite.
14. **Nom du projet + emplacement du repo.**

## Phase B — Restitution (gate)

Synthèse de l'interview en **≤ 15 lignes**, à faire valider explicitement par l'utilisateur **avant
d'écrire le moindre fichier**. Pas de « je considère que c'est validé » implicite — attendre le oui.

## Phase C — Instanciation mécanique (seulement après validation de la Phase B)

1. **Vendorer le workflow**, s'il ne l'est pas déjà (`.claude/workflow/manifest.json` absent) —
   c'est la commande d'amorçage en tête de cette skill. Si le manifeste existe, le workflow est
   déjà là : ne rien refaire.

2. Copier `.claude/workflow/templates/project-settings.json` → `.claude/settings.json`.

   > Ce fichier câble les 4 hooks en `$CLAUDE_PROJECT_DIR/.claude/workflow/hooks/`. Il ne porte
   > **ni** `enabledPlugins`, **ni** `extraKnownMarketplaces` : le workflow est dans le repo, il
   > n'y a rien à rapatrier au démarrage. Les deux ensemble le chargeraient deux fois.

3. Copier depuis `.claude/workflow/templates/` : `PROJECT_BRIEF.md`, `ARCHITECTURE.md`,
   `DECISIONS.md`, `PROJECT_MAP.md`, `STATUS.md`, `TASKS.md`, `VALIDATION.md`, `CLAUDE.md`
   (squelette) — et, si la réponse à la question 13 est « oui, il y a une UI », `DESIGN_SPEC.md`.

   > Les squelettes voyagent **dans le repo** depuis le vendoring : ne jamais aller les chercher
   > dans un checkout du dépôt source (chemin qui n'existe que sur la machine du développeur).

4. Ajouter `.claude/wave.lock` au `.gitignore` (marqueur local, jamais versionné).

5. Remplir `PROJECT_BRIEF.md` avec les réponses de l'interview (chaque section a une question
   source en Phase A — aucune section ne doit rester à instancier sans réponse).
6. Supprimer les sections de template non pertinentes pour ce projet précis (une section vide est
   du bruit payé à chaque lecture — ne pas la laisser vide, la retirer).
7. `git init` (s'il n'a pas eu lieu avant l'amorçage). **Dépôt sous un dossier synchronisé ?**
   (`SynologyDrive`, `OneDrive`, `Dropbox`, `iCloud` dans le chemin) : demander à l'utilisateur
   d'exclure le dossier `.git` dans son client (gate : attendre le oui), puis
   `touch .git/info/synchro-exclue`. Puis premier commit, staging explicite,
   message exact : `chore: instanciation projet depuis Templates`. Le commit inclut `.claude/` —
   c'est ce qui rend le workflow disponible à quiconque clone, dans tous les environnements.

## Phase D — Annonce des étapes suivantes (les citer, ne PAS les exécuter ici)

1. Rédiger `ARCHITECTURE.md` (avec Opus).
2. Si UI : `DESIGN_SPEC.md` + maquette Claude Design (claude.ai), écran par écran.
3. Dérouler `/nouveau-plan` pour cadrer le premier plan (`P1`) à partir du brief, de l'architecture
   et de la maquette.
4. Remplir les commandes réelles dans `CLAUDE.md` + vérifier que le typecheck n'est pas vide sur un
   projet vide (piège scaffold Vite/TS — cf. `CLAUDE.md` § Commandes).
5. Renseigner `.claude/launch.json` si le projet a un serveur dev.
