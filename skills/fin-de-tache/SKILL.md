---
name: fin-de-tache
description: Checklist de fin de tâche et de fin de session — statuts, fichiers de contexte, rapport, commit. À dérouler quand une tâche T<n> d'une session S<k> est terminée et validée (N0 OK).
---

# Fin de tâche

Lire le bandeau du `S<k>.md` en cours : **parallèle : oui/non** détermine le mode.

Qui committe, quand, et l'exception `.claude/wave.lock` : `WORKFLOW.md` §4b (domicile), ne pas le
reformuler ici. Où vit le statut d'une tâche : `WORKFLOW.md` §4a (domicile) — jamais recopié dans
un `S<k>.md` ni dans `TASKS.md`.

## Après CHAQUE tâche (les deux modes)

1. **N0** : `build` + `typecheck` (+ tests unitaires si logique pure) passent. Sinon la tâche n'est
   pas finie. **Juste après** : toute skill du projet nommée `verif-<chose>` (`.claude/skills/`,
   propre au projet, jamais du workflow vendoré) se déroule ici, avant le N1 — c'est le point
   d'entrée d'un contrôle mécanique propre au projet (mesure A6).
2. **N1** : si la tâche touchait l'UI, dérouler `/verif-visuelle`. Un défaut N1 se corrige
   maintenant, il ne se reporte pas.
3. **Bilan dans le `S<k>.md`** — section « Bilan de session », complétée au fil des tâches :
   fichiers modifiés · résumé · N0 lancé · N1 constaté · N2 à faire · prochaine action. **Toujours**,
   y compris quand la tâche n'a produit aucun fichier durable (session de vérification, de mesure,
   d'audit) : c'est alors le livrable lui-même, la conversation qui l'a produit disparaît. **Écarts
   au plan** : rubrique en plus, **uniquement si le bandeau du `S<k>.md` a déclaré une `Latitude`** —
   sinon la ligne est absente et tout écart reste un STOP (mesure B3).
4. **Commit de la tâche** — sauf si `.claude/wave.lock` est présent (§4b). Staging explicite des
   fichiers de la tâche **et du `S<k>.md`**, message prévu dans le `T<n>`, repère de tâche en
   dernière ligne :

   ```bash
   git status                       # relire ce qu'on s'apprête à prendre
   git add <fichiers de la tâche>    # jamais -A, jamais -a : les voisines seraient emportées
   git commit -m "<type(scope): message du T<n>>" -m "Plan: P<n>/S<k>/T<m>"
   ```

   Jamais `git push`. **Une tâche sans fichier de code committe quand même son `S<k>.md`** : zéro
   commit est, pour l'orchestrateur, indistinguable d'une session jamais lancée.
5. **Rapport court** dans la conversation : le même contenu que le bilan, en trois lignes.
6. **Skill projet ?** : une procédure spécifique au projet a été déroulée ≥ 2 fois ou dictée en
   prompt ? → la proposer comme `.claude/skills/<nom>/` du projet (critères : `/choisir-mecanisme`).
   On PROPOSE, on ne crée JAMAIS silencieusement ; nom **distinct** de ceux du workflow vendoré.
   **Un contrôle manuel revenu ≥ 2 fois** (relecture d'un écran, vérification d'un export, contrôle
   qu'aucune régression n'a eu lieu sur une zone sensible) → proposer explicitement une skill nommée
   `verif-<chose>` : c'est ce nom précis que le point 1 reconnaît et déroule après le N0.
7. **Un fichier géré a-t-il été modifié ?** Si la tâche a touché un fichier listé dans
   `.claude/workflow/manifest.json`, **c'est une erreur à réparer, pas à committer** : porter la
   modification dans le dépôt source, publier, puis `/maj-workflow` ici.
8. **Le workflow a cassé pendant la tâche ?** Hook qui refuse à tort, permission manquante, outil
   absent du bac à sable, verdict ou revue perdus, cache périmé — tout ce qui vient de l'outillage
   et pas du projet → un fichier `docs/workflow/incidents/<date>-<slug>.md` (gabarit et règle :
   `WORKFLOW.md` §9b), stagé **avec le commit de la tâche** (point 4 ; sous verrou, l'orchestrateur
   le committe en fin de vague). Ni `TASKS.md` ni la conversation : seul ce fichier remonte au
   dépôt source, où les incidents de tous les projets sont analysés ensemble.
8b. **Le workflow lui-même a changé ?** (tâche menée dans le dépôt source, sous `plugin/`) → bumper
   `version` dans `plugin/.claude-plugin/plugin.json` + une ligne dans `CHANGELOG.md`, **puis**
   `node plugin/bin/publier.mjs` (le dépôt source n'est pas vendoré — `publier.mjs` n'existe qu'à
   cet emplacement, jamais sous `.claude/workflow/bin/`). Sans bump, les projets vendorés ne voient
   jamais la mise à jour ; sans publication, toute machine neuve embarque une version périmée.

## Fin de session — mode SOLO (parallèle : non)

9. **Statut** : passer les tâches à `[x]` dans l'`index.md` du plan (colonne Statut), avec la date —
   hors vague, la session est seule sur ce fichier, donc elle l'écrit et l'inclut dans son commit.
10. **Contexte** : mettre à jour `STATUS.md` ; les autres fichiers **seulement si leur contenu
    change** — un fichier de contexte faux est pire qu'absent.
11. **N2** : consigner dans `VALIDATION.md` **uniquement** ce qui relève du jugement humain
    (esthétique, UX, ton), et supprimer les items déjà tranchés — git est l'archive, le fichier ne
    contient que ce qui est encore EN ATTENTE.
12. **Plafonds** : si le hook signale un dépassement, dérouler `/purge-contexte` — pas plus tard.
13. **Ne pas pusher** si d'autres sessions du plan restent à exécuter : le push est groupé, en fin
    de vague ou de plan.

## Fin de session — mode VAGUE PARALLÈLE (parallèle : oui)

9. **Fichiers partagés : c'est le verrou qui décide, pas le mot « vague ».** `STATUS.md`, `TASKS.md`
   et `VALIDATION.md` restent hors de portée dans les deux cas (ils se remplissent à la clôture).
   Pour l'`index.md` (§4a/§4b) :

   | `.claude/wave.lock` | `index.md` |
   | --- | --- |
   | **présent** (sessions concurrentes) | ne pas y toucher — l'orchestrateur coche en fin de vague |
   | **absent** (voie séquentielle) | cocher **sa propre ligne**, et elle seule, dans le commit du point 12 |
10. Les points **N2** restent dans le `S<k>.md` (à côté du bilan du point 3) — reversés dans
    `VALIDATION.md` en fin de plan.
11. **Ce que l'orchestrateur lira** : les commits du point 12, et rien d'autre. Ni le `S<k>.md`, ni
    une confirmation verbale. **Ne rien lancer en arrière-plan** : orchestrée, une session ne
    connaît que sa propre réponse finale — ce qui finit après elle n'est lu par personne.
12. **Commit ou pas, selon le verrou.** Absent → committer ses tâches comme au point 4, `S<k>.md`
    compris, sans toucher aux fichiers partagés. Présent → ne rien committer : l'orchestrateur le
    fera en fin de vague. Dans les deux cas, **jamais de push**.
13. **Ne pas travailler dans un worktree** (§7, appliqué par `pretooluse-git.mjs`). Un diff commité
    sur la branche d'un worktree n'est vu par personne. Si la session a déjà commencé dans un
    worktree, le **signaler** au lieu de clore : le travail doit d'abord revenir dans l'arbre
    principal.

## Relecture de session — dernier geste, dans les deux modes

**Seulement si la session a produit du code.** Une session dont la « Zone modifiée » est `aucune`
(mesure, audit, vérification) n'a pas de diff à relire — clore sans revue.

**L'ordre est impératif : clôture d'abord, revue ensuite.** Dérouler toutes les étapes de fin de
session du mode (statuts, commits, rapport) AVANT de lancer la revue : le travail est alors commité
et le verdict acquis — plus rien n'attend la revue, elle ne peut plus coûter la session. Une session
qui attend sa revue avant de committer compte, pour l'orchestrateur, comme jamais lancée.

**Lancer l'agent `relecteur-session`, AU PREMIER PLAN** (jamais `run_in_background: true`, jamais
`/code-review` en `high`+ : à ces niveaux il part dans un agent d'arrière-plan). Lui passer `P<n>`,
`S<k>`, le mode, et — sous `.claude/wave.lock` uniquement — les chemins de la « Zone modifiée ».

**Pas d'outil `Agent` dans cette session ?** C'est le cas courant d'une session lancée en
sous-agent par `/orchestrer-plan` (bac à sable sans outil de sous-agent, ou profondeur épuisée).
Ne pas relire soi-même à la place du relecteur — la revue vaut par le fait qu'un autre que la
session la fait. Le dire en une ligne dans le rapport et clore : **orchestrée**, l'orchestrateur
lance la revue lui-même après avoir collecté la vague (`/orchestrer-plan` Étape 5) ; **à la
main**, la relancer depuis une session qui a l'outil, et déposer un fichier d'incident (point 8)
si l'outil manquait là où il aurait dû être.

**Le relecteur dépose le fichier en premier geste, avant même de lire le diff** : une `Couverture :
en cours` dans le fichier signifie tours épuisés, revue partielle — non bloquant, à relayer tel
quel.

**C'est l'agent qui écrit `plans/P<n>/S<k>.revue.md`, pas toi.** La session ne fait que lire les
deux lignes qu'il rend et les recopier dans son rapport. Une revue lancée en arrière-plan comme
dernier geste ne dépose jamais rien : la session rend la main, le harnais la clôt, et le retour
arrive dans un tour que plus personne ne lit — c'est le mécanisme de
`docs/decisions/2026-09-04-delegation-au-premier-plan.md`, et il a coûté la totalité des revues d'un
plan entier avant d'être vu (`2026-09-07-revue-orpheline.md`).

**Le fichier est déposé même sans trouvaille** (`Bloquant : 0`). L'absence de `.revue.md` ne veut
donc plus dire qu'une chose — **la revue n'a pas tourné** — et c'est à ce titre que le hook `Stop`
et l'orchestrateur la signalent. Si l'agent rend la main sans avoir pu écrire (périmètre
indéterminable, diff vide), clore quand même en le signalant d'une ligne : la revue est **non
bloquante**, sans rang dans la grille N0/N1/N2.

Contenu du fichier (format, seuil bloquant/backlog) : c'est l'affaire de l'agent, ne pas le
reformuler ici — `${CLAUDE_PLUGIN_ROOT}/agents/relecteur-session.md`.

Le fichier reste **non commité** : il est consommé au tri de clôture du plan (point 16). La session
ne corrige rien — elle est close. Exception en mode solo, humain présent : un **bloquant** peut se
corriger sur-le-champ (commit correctif + N0 rejoué), et sort alors du `.revue.md`. Un défaut qui
invalide une hypothèse du plan reste une extension (`/nouveau-plan` Étape 0), jamais une correction
locale.

## Fin de plan (toutes les sessions exécutées et validées)

Le travail de code est déjà commité — chaque session a pris le sien. Il ne reste que le rangement.

14. **Vérifier qu'il ne reste rien.** `git status` doit être propre hors fichiers de contexte. Ce qui
    traîne encore appartient à une session qui n'a pas déroulé cette checklist : la retrouver plutôt
    que de balayer le reste dans un commit fourre-tout. Un `plans/P<n>/S<k>.echec.md` encore présent
    signale un échec non résolu → ne pas clore le plan (`/reprendre-echec`). Les `S<k>.revue.md`
    encore là sont normaux : ils attendent le tri du point 16. Un `docs/workflow/incidents/*.md`
    non commité se committe maintenant (`incident(workflow): <slug>`) — il part avec le push du
    point 17, jamais avant.
15. **Nettoyer les marqueurs** : `.claude/wave.lock` s'il existe, et `.claude/vague/` (sorties brutes
    et identifiants de session — transitoires).
16. **Ranger le contexte** : statuts `[x]` complets dans l'`index.md`, lignes purgées de `TASKS.md`,
    `STATUS.md` à jour, points N2 des `S<k>.md` reversés dans `VALIDATION.md`. **Trier les revues** :
    chaque `plans/P<n>/S<k>.revue.md` est versé dans `TASKS.md` — les **bloquants** en tête, marqués
    comme tels, le backlog à la suite, jamais dans `VALIDATION.md`. `Couverture : en cours` : verser
    ce qui est là quand même et noter « revue partielle » dans le rapport de clôture — puis supprimé (transitoire,
    comme `.claude/vague/`). Un `Bloquant : 0` sans backlog ne se verse pas, il se supprime. **Une
    session qui a produit du code et n'a laissé aucun `.revue.md` n'a pas eu de revue** : le
    signaler dans le rapport de clôture plutôt que de le lire comme « rien à signaler ». Un commit
    dédié, portant en dernière ligne le repère des revues **réellement trouvées et triées** :
    `Revues: P<n>/S<k>, P<n>/S<k>`. Le `.revue.md` n'est jamais commité : ce repère est la seule
    trace qu'il a existé, et sans lui le hook `Stop` relit la suppression que tu viens de faire
    comme une revue jamais lancée. Une session sans `.revue.md` n'entre pas dans le repère — elle
    part dans le rapport de clôture, à sa place.
17. **Un seul push**, sur `main`, pour l'ensemble du plan — session cloud comprise, jamais sur une
    branche laissée derrière (`WORKFLOW.md` §4b).

## Enchaînement — session suivante du plan

**D'abord : suis-je orchestrée ?** Si cette session a été lancée par `/orchestrer-plan` (sous-agent,
§5b) l'enchaînement ne la regarde pas : l'orchestrateur collecte les verdicts et ouvre la vague
suivante lui-même. Rendre la main, point.

Le reste ne vaut que pour une session **lancée à la main**, ou par une pastille de repli (§5b, repli
hors Desktop) :

- S'il reste des sessions prêtes dans l'`index.md` (dépendances satisfaites, vague en cours ou
  suivante) : poser une pastille via `spawn_task` — titre `P<n> · S<k> — <titre> · <M>/<E>`, prompt
  « Ouvre plans/P<n>/S<k>.md et exécute-le. » — ou, hors Desktop, afficher la commande de lancement
  du bandeau du `S<k>.md` suivant. Jamais dans la même conversation : démarrage froid systématique
  (§5b).
- **Avec la pastille, la ligne « À régler AVANT de lancer »** (`WORKFLOW.md` §3, domicile) : modèle
  et effort de la session suivante, lus dans l'`index.md`. Une pastille démarre sur les réglages
  courants de l'application — sans ce rappel, une session `Sonnet`/`high` part au hasard de ce qui
  était réglé la veille, et personne ne s'en aperçoit avant le résultat.
- **Si cette session était la dernière `[ ]` de sa vague**, poser en plus une pastille de collecte —
  titre `P<n> — collecter la vague <w>`, prompt « Déroule /orchestrer-plan sur la vague <w> du plan
  P<n> : collecte et vague suivante. »

**Ne pas essayer de prévenir l'orchestrateur par message** (`SendMessage` ne résout pas
l'auto-identification d'une session, et un message reste éphémère). La pastille, elle, attend.
