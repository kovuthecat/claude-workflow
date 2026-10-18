---
name: nouveau-plan
description: Découper un chantier en sessions et générer le dossier plans/P<n>/ (index + un fichier par session). À dérouler par Opus quand une tâche demande plusieurs sessions.
model: opus
---

# Découper un plan en sessions

`model: opus` ne vaut que pour **le tour qui invoque la skill** : au message suivant, la session reprend
son modèle (doc Claude Code, Skills, vérifiée le 2026-10-16). **Ouvrir la session sur Opus** (`/model opus`)
reste la règle ; sur un autre modèle, le dire à l'utilisateur au premier geste. Sortie = un dossier
`plans/P<n>/`. Les squelettes vivent ici, pas dans `WORKFLOW.md` : ils ne coûtent qu'au découpage.

**Le QUOI et le POURQUOI doivent déjà être tranchés.** Si le scope est flou ou l'approche non
décidée, dérouler `/cadrer` d'abord, dans une session séparée, et repartir de la décision écrite.

Ce qui est tranché, c'est la **direction structurante** — objectif, frontière, choix approuvés : elle ne
se rediscute pas ici. Les **détails techniques encore ouverts** (composant, bibliothèque, ordre de
migration) se comparent à l'Étape 1, point 4bis ; une comparaison qui contredit une décision
structurante écrit la preuve et suit `/cadrer` (seule une preuve dégèle un tranché).

## Pour qui on écrit — deux lecteurs, deux registres

- **L'`index.md` est lu par un humain qui décide**, relayé tel quel par `/orchestrer-plan` à chaque
  vague sans qu'aucun `S<k>.md` ne s'ouvre : le seul texte du plan que l'utilisateur lira, registre
  « Écrire pour qui décide » (`CLAUDE-BASE.md`), appliqué strictement.
- **Le `S<k>.md` est lu par le modèle qui exécute** : précision et exhaustivité priment. Il porte quand
  même le **pourquoi** de chaque tâche : une consigne sans intention s'exécute à la lettre et à côté.

## Étape 0 — Premier geste : version du workflow, puis plan neuf ou extension ?

**Version du workflow vendoré**, avant tout le reste : un plan écrit sur un workflow en retard fige dans
les squelettes ce que la source a déjà corrigé. Lancer le script directement, sans dérouler `/maj-workflow`
(son `model: haiku` ne tient qu'un tour) : `node .claude/workflow/bin/sync-workflow.mjs --source <payload>
--projet . --check` (`<payload>` : le chemin de cache de `workflow@templates` que rend `claude plugin
list`, sinon un clone jetable — `/maj-workflow` Étape 1). Sortie 0 : rien à faire. Sans ligne `DÉRIVE` :
relancer sans `--check`, rapporter. Avec `DÉRIVE` : question à l'utilisateur (options : `/maj-workflow`
Étape 3). Dépôt source du workflow (pas de `.claude/workflow/manifest.json`, `plugin/` présent) :
`"$CLAUDE_CODE_EXECPATH" plugin update workflow@templates --scope local` (le shim `claude` peut manquer
sous Desktop), puis `node plugin/bin/installer-mods.mjs`.

**Plan neuf ou extension ?** La correction débloque-t-elle une session restante de `P<n>`, son
« Objectif d'ensemble » restant vrai tel qu'il est écrit ? Oui → **mode extension** : lire
`references/cas-rares.md` (critère, plafond de trois vagues de remédiation, modification de l'index). Non →
plan neuf. Dans les deux cas, un plan dont deux prédécesseurs ont été tués sur une prémisse dans la même
zone ne s'écrit pas : « Seuil unique » du même fichier, puis `/cadrer`.

## Étape 1 — Investiguer (jamais modifier)

Se mettre en **Plan Mode** pour toute la phase d'investigation — ce mode interdit l'écriture de
fichiers, donc la consigne « jamais modifier » devient structurelle plutôt que déclarative.

**D'abord relire la grille de la décision d'entrée**
(`${CLAUDE_PLUGIN_ROOT}/skills/cadrer/references/preparation.md`) : ce qui est `READY` avec une
preuve encore valide **ne se réinvestigue pas** ; seules les `OPEN` et les preuves périmées sont à
reprendre ici. Une `OPEN` de type `décision` → question à l'utilisateur, pas de plan.

1. **Flux** : chemin complet du problème/feature, où il commence et se termine.
2. **Fichiers probables** sans tout ouvrir : `PROJECT_MAP.md`, `ARCHITECTURE.md`, registre `DECISIONS.md` d'abord.
3. **Rôle** de chaque fichier clé : pourquoi il est pertinent.
4. **Dépendances directes** utiles.
   - **4bis — Existant** : pour toute inconnue technique restante (mécanisme non trivial,
     dépendance envisagée, sous-système custom proposé), dérouler
     `${CLAUDE_PLUGIN_ROOT}/skills/cadrer/references/rechercher-existant.md`. Sa conclusion
     (réutiliser, configurer, adapter, développer, isoler) est ce que les tâches implémentent ; un
     « développer » sans ce passage est un écart.
5. **1-2 hypothèses racines**, chacune **typée** : `lisible` (une lecture du dépôt la confirme ou la
   réfute — c'est ce que `verificateur-premisse` sait faire) ou `comportementale` (seule une
   exécution tranche : « le juge compte juste », « ce traitement tient en < 1 s »). Une
   comportementale ne se gèle jamais en « tranché ». Trois sorties : **sonder** — une commande ou un
   script jetable exécuté au premier plan (`n0.mjs --seulement <nom>` s'il s'agit d'une commande
   N0), résultat écrit dans le `S<k>.md` ou la décision, **avant** d'écrire le plan ; **déclarer** —
   ligne `Risques du plan :` sous l'objectif d'ensemble de l'index, avec ce qui la réfuterait ;
   **isoler** — issue `isoler` du protocole d'existant, l'hypothèse derrière une couture nommée.
   Un plan écrit sur une comportementale ni sondée, ni déclarée, ni isolée est un écart au cadrage ;
   dès la première non sondable, dérouler `/cadrer` plutôt que de continuer à découper.
6. **Verdict** : plan rédigeable maintenant, ou ambiguïté à lever avec l'utilisateur d'abord ?

**Déléguer** dès que les points 2-3 demandent de balayer le repo ou l'historique : `explorateur` pour
l'exploration ; `analyste-flux` pour comprendre un flux (point 1) — une inconnue qu'il nomme est une
hypothèse à typer au point 5 ; `resumeur-git` pour un diff ou un historique. Garder pour soi les
points 1, 5 et 6, le raisonnement. Tout appel `Agent` porte `run_in_background: false` (`WORKFLOW.md` §5).

## Étape 1bis — Critiquer avant de faire approuver (conditionnel)

Le verdict de l'Étape 1 classe le plan : **borné** — un changement bien délimité sur du code
existant — ou **architectural** — nouveau sous-système, ou changement qui restructure l'assemblage
ou modifie une interface dont d'autres dépendent. Une complexité découverte en route **monte** le
classement, rien ne le redescend ; dans le doute, architectural.

Le critique tourne sur tout plan **architectural**, et sur un plan **borné** seulement s'il touche
un déclencheur : contrat partagé modifié · migration ou schéma de données · concurrence ·
autorisation · performance annoncée · mode extension après un échec `prémisse` · demande explicite.
Sinon, passer à l'approbation — `verificateur-plan` (Étape 4b) suffit.

```
Agent({
  description: "P<n> critique",
  subagent_type: "critique-plan",
  run_in_background: false,
  prompt: "Décision applicable : <chemin docs/decisions/…>.
Synthèse du cadrage (Étape 1) : <flux · hypothèses typées · découpage envisagé · critères de réussite — recopiés, 40 lignes au plus>.
Réponse : CRITIQUE: PASS | CRITIQUE: <n> constat(s) numérotés, puis « Choix non résolus : »."
})
```

Agent introuvable : repli `workflow:critique-plan`, puis `general-purpose` (`model: "opus"`) avec le prompt
« Lis `.claude/agents/critique-plan.md` (ou `plugin/agents/…`) et tiens ce rôle : <le prompt ci-dessus> » ;
même repli pour `verificateur-plan`. Routage : `PASS` → approbation. `DÉFAUT` corrigeable sans toucher une
décision → corriger la synthèse, **revérifier la seule correction**. `À VÉRIFIER` ou fait manquant →
recherche, sonde ou protocole de preuve — jamais une question pour un fait accessible. « Choix non
résolus » non vide → **question** (`WORKFLOW.md` §9c), cette liste pour options. Une passe.

## Étape 2 — Découper en sessions (règle de coût)

Un démarrage froid a un prix fixe (prompt système + `CLAUDE.md` + lectures) ; enchaîner dans une
même session fait re-payer le contexte accumulé à chaque tour. Le découpage arbitre entre les deux.

**Regrouper par lectures partagées, d'abord** : plusieurs tâches qui lisent les mêmes fichiers
paient un seul démarrage à froid pour toutes — c'est le critère premier. Regrouper plusieurs tâches
dans une même session si TOUT est vrai :

- lectures/fichiers largement partagés **ou** tâches courtes (`low`) ;
- aucune validation humaine requise entre elles ;
- le lot reste raisonnable (~3-5 tâches courtes, ou 2 moyennes liées).

**Séparer** dès qu'un de ces critères tombe, ou qu'une validation humaine (N2) s'intercale. Changement
de modèle ou d'effort, tâche `high`/`xhigh` : des **indices**, pas des règles absolues.

La colonne « Zone modifiée » : y mettre les répertoires/fichiers réellement touchés, pas des
généralités. **Une session dont la zone est « aucune »** (vérification, mesure, audit) livre une
**conclusion**, pas un diff : écrire dans le `S<k>.md` ce que le bilan devra contenir — le corpus
exact, le critère, le résultat attendu —, sans quoi la session rend « ça marche » dans une
conversation qui disparaît et le plan ne la distingue plus d'une session jamais lancée.

**Session de type `exploration`** (exploration ouverte déclenchée : première prémisse comportementale non
sondable, enquête `OPTIONS` sans option satisfaisante, deuxième plan tué sur la zone) : la découpe l'ajoute
plutôt qu'une tâche écrite sur une inconnue. Bandeau `Régime : ouvert` : branche jetable **nommée et
poussée** (jamais `main`), budget écrit, N0 en fin ; livrable = **mesure + ce qui a été réfuté + code
candidat**, pas un diff sous gate N0 classique.

Modèle et effort : grille dans `${CLAUDE_PLUGIN_ROOT}/WORKFLOW.md` §2-3.

## Étape 3 — Écrire `plans/P<n>/index.md`

**Le statut des tâches vit ICI et nulle part ailleurs** (`WORKFLOW.md` §4a). Le squelette est en
annexe : **ouvrir `references/squelette-index.md`** au moment de l'écrire. Règles de rédaction :

**Preuve N0.** Écrire `Preuve N0 : requise`, sauf si `.claude/n0.json` porte `sansCommande` (projet
sans build ni test, motif obligatoire) : alors, et alors seulement, `Preuve N0 : non requise`, et
`N0 auto : — (non requise : <motif>)` dans les tâches. `verifier-plan.mjs` contrôle les deux sens ;
`n0.mjs` ne rend jamais de vert sur une liste vide.

**La ligne « en clair » est un contrat de lisibilité, pas une redite du titre.** Elle dit ce que la
session change et **à quoi l'utilisateur le constatera** : un écran, un comportement, un fichier
produit, une mesure obtenue. `/orchestrer-plan` la relaie **mot pour mot** au lancement de la vague
(annonce de l'action `lancer`) sans jamais ouvrir le `S<k>.md` : c'est la seule chose que
l'utilisateur lira avant de voir passer les commits. Une ligne qui paraphrase le titre (« S2 —
refonte du module d'édition ») ne lui apprend rien ; deux phrases suffisent, à condition d'être les
bonnes. Même exigence pour le *Pourquoi maintenant* d'une vague : il justifie l'**ordre**, pas le
contenu — « sans ça, S4 travaillerait sur une structure de données qui va changer » plutôt que
« prérequis ».

**Deux mots-clés sur la ligne d'une vague déclarent une exception à l'exécution normale** :
`validation-humaine` (la vague arrête l'orchestrateur une fois collectée, même si tout est `PASS`) et
`reprise-manuelle` (un `FAIL` de cette vague n'a droit ni à la reprise ni à l'enquête automatiques :
à déclarer quand un échec doit passer par un humain d'emblée, état coûteux à annuler, zone sensible).
Le N1 d'écran se joue dans la session (sous-agent compris) ; aucune session ne demande un clic pour
se lancer.

**`validation-humaine` a un seul critère : le `PASS` lui-même demande ton jugement** — une ligne
`N2 humain` non vide dans une session de la vague, dont la réponse décide s'il faut lancer la
suivante. Ce ne sont **pas** des raisons : une mesure au critère mécanique (son `FAIL` arrête déjà
le plan), une vague « qui protège la suivante », une ressource rare déjà budgétée, un geste humain
préalable (il se vérifie en premier geste de la session, `references/squelette-session.md` « Si
bloqué »). Un arrêt sur `PASS` sans jugement à rendre ne coûte qu'une interruption. L'ancien mot
`gate` sur une ligne de vague ne s'écrit plus : `/orchestrer-plan` l'ignore.

**Vagues orchestrées** : toute vague s'exécute via `/orchestrer-plan`. Un `FAIL` déclenche par défaut
la remédiation (budget `WORKFLOW.md` §9c). Colonne **Env.** : toujours `—` (plans anciens :
`references/cas-rares.md`). L'effort écrit sur une ligne est celui auquel la session tournera :
`/orchestrer-plan` le passe à l'outil `Agent`.

L'index ne contient **rien d'autre** : aucun détail d'exécution (étapes, commandes, fichiers à la
ligne près) — il pointe vers les sessions. Les lignes « en clair » et les *Pourquoi maintenant* sont
la seule prose autorisée, et elles décrivent toujours un **résultat**, jamais un moyen.

## Étape 4 — Écrire un `plans/P<n>/S<k>.md` par session

Le squelette est en annexe : **ouvrir `references/squelette-session.md`** au moment d'écrire le
premier `S<k>.md`, et le suivre champ par champ. Les règles qui décident de ce qu'on y met :

**Pas de bloc « Statut » dans le `S<k>.md`** : il vit dans l'`index.md`. Une information de suivi
écrite à deux endroits finit toujours par diverger.

- **Le bandeau est auto-suffisant** : modèle, effort, environnement — jamais besoin de retourner à
  l'index pour lancer la session.
- **« Lire » est un point de départ, pas un plafond** : la lecture reste ouverte, seule
  l'**écriture** est bornée (à la zone du plan) — `EXECUTANT.md`.
- **« Étapes » = le comment**, ordonné. Plus le modèle est faible, plus elles sont fines ; si une
  tâche demande trop de jugement pour le modèle visé → la **découper**. Une étape dont l'intention
  n'est pas évidente porte sa raison en fin de ligne, après un tiret. Une étape qui réclame trois
  lignes de justification est une décision qui manque : elle remonte en « Décision clé », ou dans un
  `docs/decisions/` via `/cadrer`.
- **« Pourquoi » n'est pas « Objectif » redit autrement** : l'objectif dit *quoi faire*, le pourquoi
  *ce que ça sert*. S'ils se paraphrasent, remonter vers l'objectif d'ensemble du plan.
- **« Validation » = critères vérifiables** (commande + résultat, ou écran + attendu), jamais « ça marche ».
- **« Anti-raccourci » nomme le faux-vert de CETTE tâche**, celui qu'un exécutant pressé ou un
  outillage muet produirait sans mentir : `typecheck` qui ne compile aucun fichier, test skippé ou
  marqué `todo`, assertion adaptée au résultat observé, fixture figée à la place de l'appel réel,
  build qui ne recompile pas le fichier touché. Il sert au relecteur, qui vérifie que le PASS est
  vrai. Le cadreur est le seul à savoir où est le raccourci — s'il ne le voit pas, `—`, jamais une
  formule générique.
- **Toute décision de `docs/decisions/` en jeu s'écrit sous sa forme opérationnelle** : la mécanique à
  employer (« passe par le script X »), jamais seulement l'interdit de contenu.
- **N1 ≠ N2** : ce qu'un navigateur peut constater (erreur console, texte absent, 404, débordement)
  est N1 et ne va **jamais** dans `VALIDATION.md`. N2 = uniquement le jugement humain.

## Étape 4b — Faire vérifier la découpe (jamais par soi-même)

Le plan est écrit, rien n'est encore commité. Lancer d'abord
`node ${CLAUDE_PLUGIN_ROOT}/bin/verifier-plan.mjs P<n>` (vendoré :
`node .claude/workflow/bin/verifier-plan.mjs P<n>` ; `--extension` en mode extension). Corriger tout
écart mécanique ou format non reconnu jusqu'à `RAS` ; le script ne juge pas le design. Puis lancer
`brief-a-jour.mjs` **au premier plan** (`node .claude/workflow/bin/brief-a-jour.mjs`, `plugin/bin/` dans
ce dépôt source), puis l'agent **`verificateur-plan`**, **au premier plan** (`run_in_background: false`),
en lui donnant `P<n>`, en mode extension les sessions ajoutées, et la sortie du script :

> Vérifie `plans/P<n>/` — contrôles sémantiques restants. Sortie de verifier-plan : RAS. Sortie de brief-a-jour : <sortie>

Le script a vérifié chemins, collisions et dépendances ; l'agent juge la pertinence des validations,
les justifications d'exception et les arrêts humains. Une seule passe, par un autre que le cadreur :
une découpe fausse ne se voit pas de l'intérieur.

Chaque écart rendu se corrige **ici**, avant l'Étape 6, ou se justifie en une ligne dans le
`S<k>.md` concerné s'il est volontaire. `RAS` → continuer sans rien écrire : c'est le plan corrigé
qui est la trace. **Un écart n°11** (ligne `Brief :` ou `Règles :` non appliquée) se traite avant
l'Étape 6 : `references/cas-rares.md`.

## Étape 5 — Reporter dans `TASKS.md`

Une ligne par tâche, statut remplacé par le renvoi : `- T-012 — <titre> · → plans/P2/S1.md` (en mode
extension, les seules tâches ajoutées). L'avancement se lit dans l'`index.md`.

## Étape 6 — Committer et pousser le plan

Staging explicite du dossier `plans/P<n>/` et de `TASKS.md`, un commit
(`plan(P<n>): <objectif en une ligne>`), puis **`git push` sur `main`**, cloud compris (`WORKFLOW.md`
§4b) : chaque session part d'une conversation neuve, souvent d'une autre machine — un `index.md` resté
local n'y existe pas.
