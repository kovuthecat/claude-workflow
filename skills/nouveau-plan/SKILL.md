---
name: nouveau-plan
description: Découper un chantier en sessions et générer le dossier plans/P<n>/ (index + un fichier par session). À dérouler par Opus quand une tâche demande plusieurs sessions.
model: opus
---

# Découper un plan en sessions

Le frontmatter bascule sur Opus pour ce tour. **Ça ne couvre que l'investigation** (Étape 1,
avant le Plan Mode) : une fois le plan approuvé par l'utilisateur (après l'Étape 1bis si elle
s'applique), l'écriture (Phase suivante) reprend dans un nouveau tour, sur le modèle actif de la
session — sans gravité, c'est mécanique.
Sortie = un dossier `plans/P<n>/`. Les squelettes vivent ici (et non dans `WORKFLOW.md`) : ils ne
coûtent des tokens qu'au découpage.

**Le QUOI et le POURQUOI doivent déjà être tranchés.** Si le scope est flou ou l'approche non
décidée, ce n'est pas ce plan qu'il faut écrire : dérouler `/cadrer` d'abord, dans une session
séparée, et repartir de la décision écrite qu'elle produit.

Ce qui est tranché, c'est la **direction structurante** — objectif, frontière, choix approuvés par
l'utilisateur : elle ne se rediscute pas ici. Les **détails techniques encore ouverts** — quel
composant, quelle bibliothèque, quel ordre de migration — se comparent (Étape 1, point 4bis). Une
comparaison qui contredit une décision structurante n'y touche pas : elle écrit la preuve et suit
`/cadrer` (décision du 2026-09-14 : seule une preuve dégèle un tranché).

## Pour qui on écrit — deux lecteurs, deux registres

Un plan sert deux lectures, et rate sa cible s'il n'en sert qu'une :

- **L'`index.md` est lu par un humain qui décide** — et relayé tel quel par `/orchestrer-plan` au
  lancement de chaque vague, sans qu'aucun `S<k>.md` ne soit ouvert. C'est le seul texte du plan que
  l'utilisateur lira : registre « Écrire pour qui décide » (`CLAUDE-BASE.md`), appliqué strictement.
- **Le `S<k>.md` est lu par le modèle qui exécute.** Précision et exhaustivité priment sur le
  registre. Il porte quand même le **pourquoi** de chaque tâche : une consigne sans intention
  s'exécute à la lettre et à côté, et c'est l'intention qui permet de s'arrêter au bon moment.

## Étape 0 — Premier geste : contrôle de version, puis plan neuf ou extension ?

**Premier geste, avant tout le reste** : contrôle de version du workflow vendoré (C4,
`docs/decisions/2026-09-17-autonomie-par-defaut-etat-scripte-push-par-session.md`) — dérouler
`/maj-workflow`. Sans `DÉRIVE` : mise à jour sans question, rapportée ; avec `DÉRIVE` : question
avant de continuer. Écrire un plan sur un workflow en retard fige dans les squelettes ce que la
source a déjà corrigé. Dépôt source du workflow (pas de `.claude/workflow/manifest.json`, `plugin/`
présent) → `claude plugin update workflow@templates --scope local` à la place de `/maj-workflow`.

Un plan en cours peut produire un résultat qui invalide une hypothèse dont dépendent ses sessions
restantes : vérité de référence fausse, contrat à changer, mesure qui contredit l'attendu d'une
gate. La correction est du travail non prévu, mais **au service de l'objectif inchangé du plan**.
L'écrire comme un plan `P<n+1>` crée une récursion — `P20` pour finir `P19` pour finir `P16` — où
le plan bloqué ne se ferme qu'après un plan qui ne se ferme qu'après un autre.

**Critère d'aiguillage, unique** : la correction débloque-t-elle une session restante de `P<n>`,
l'« Objectif d'ensemble » de `P<n>` restant vrai tel qu'il est écrit ?

- **Oui → mode extension.** Ajouter des sessions à `plans/P<n>/` existant. Étapes 1, 2 et 4
  inchangées ; l'Étape 3 modifie l'`index.md` au lieu de le créer.
- **Non** — l'objectif lui-même bouge, ou la correction sert plusieurs plans → mode normal, plan
  neuf, et le plan bloqué note sa dépendance dans son ordonnancement.

**Plafond** : une **troisième** vague de remédiation sur le même plan n'est plus une extension,
c'est la prémisse du plan qui est fausse. S'arrêter et dérouler `/cadrer` sur cette prémisse.

**L'exploration ouverte arrive plus tôt (C6)** : dès la première prémisse comportementale non
sondable rencontrée à l'Étape 1 — pas seulement au deuxième plan tué sur la zone —, dérouler
`/cadrer`, qui sortira par un protocole de preuve, plutôt que de continuer à découper un plan sur
une inconnue.

### Seuil unique — domicile de « encore un plan ou `/cadrer` »

C'est le seul endroit du workflow qui définit ce seuil ; tout autre texte qui l'évoque y renvoie,
sans le reformuler ni recalculer son propre compteur.

- **zone** = les chemins de la colonne « Zone modifiée » (`/nouveau-plan` Étape 2).
- **Un plan a été tué sur une prémisse** si un de ses `.echec.md` a porté `Nature : prémisse`, **y
  compris supprimé** (l'Étape 5 de `/reprendre-echec` le supprime une fois l'échec résolu — un
  `grep` sur les fichiers présents sous-compte) :
  `git log --all -p --diff-filter=AD -- 'plans/*/*.echec.md' | grep -n 'Nature :.*pr[ée]misse'`.
- **Deuxième plan tué sur la même zone avec cette cause → ne pas en écrire un troisième.** La
  réponse n'existe qu'à l'exécution, et un plan de plus gèlera en « tranché » ce qui a tué le
  précédent — c'est ainsi qu'une zone finit par ne plus contenir le geste qu'un humain fait.
  Dérouler `/cadrer`, qui sortira par un protocole de preuve (décision du 2026-09-14). `prémisse`
  est le mode d'échec dominant du workflow : une fois, c'est le système qui fonctionne ; c'est la
  **répétition sur une même zone** qui est le signal.
- La règle de la **troisième vague de remédiation** (ci-dessus) reste, inchangée : c'est un
  deuxième compteur, sur le même plan plutôt que sur la zone, et les deux s'appliquent.

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
   N0), résultat écrit dans le `S<k>.md` ou la décision, **avant** d'écrire le plan ; **déclarer** — ligne `Risques du plan :` sous l'objectif d'ensemble de l'index,
   avec ce qui la réfuterait ; **isoler** — issue `isoler` du protocole d'existant, l'hypothèse
   derrière une couture nommée pour que le reste se découpe. Un plan écrit sur une comportementale
   ni sondée, ni déclarée, ni isolée est un écart au cadrage.
6. **Verdict** : plan rédigeable maintenant, ou ambiguïté à lever avec l'utilisateur d'abord ?

**Déléguer** dès que les points 2-3 demandent de balayer le repo ou l'historique : exploration de
fichiers → agent `explorateur` ; **compréhension d'un flux** (point 1) → agent `analyste-flux`, qui
sépare faits, inférences et inconnues — une inconnue qu'il nomme est une hypothèse à typer au point
5, pas un fait ; résumé de diff/historique git → agent `resumeur-git`. Chacun ne rend que sa
conclusion, l'exploration ne pollue pas le contexte Opus (qui est le plus cher). Garder pour soi les
points 1, 5 et 6 — c'est le raisonnement, pas la recherche.

## Étape 1bis — Critiquer avant de faire approuver (conditionnel)

Le verdict de l'Étape 1 classe le plan : **borné** — un changement bien délimité sur du code
existant (un flag, un endpoint, un correctif d'un fichier) — ou **architectural** — nouveau
sous-système, ou changement qui restructure l'assemblage ou modifie une interface dont d'autres
dépendent. Une complexité découverte en route **monte** le classement, rien ne le redescend ; dans
le doute, architectural.

Le critique tourne sur tout plan **architectural**, et sur un plan **borné** seulement s'il touche
un déclencheur : contrat partagé modifié · migration ou schéma de données · concurrence ·
autorisation · performance annoncée · mode extension après un échec `prémisse` · demande explicite.
Sinon, passer à l'approbation — `verificateur-plan` (4b) suffit.

```
Agent({
  description: "P<n> critique",
  subagent_type: "critique-plan",
  run_in_background: false,
  prompt: "Lis ${CLAUDE_PLUGIN_ROOT}/EXECUTANT.md en entier avant ton premier geste : il porte les invariants de lancement.
Décision applicable : <chemin docs/decisions/…>.
Synthèse du cadrage (Étape 1) : <flux · hypothèses typées · découpage envisagé · critères de réussite — recopiés, 40 lignes au plus>.
Réponse : CRITIQUE: PASS | CRITIQUE: <n> constat(s) numérotés, puis « Choix non résolus : »."
})
```

`Agent type 'critique-plan' not found` : repli `subagent_type: "workflow:critique-plan"` (plugin
installé en marketplace) ; encore introuvable → repli `subagent_type: "general-purpose"`,
`model: "opus"`, prompt « Lis `.claude/agents/critique-plan.md` (ou `plugin/agents/…` en dépôt
source) et tiens ce rôle : <reprendre le prompt ci-dessus> ». Trois crans, jamais un blocage. Même
repli pour `verificateur-plan` (Étape 4b) : nom nu → `workflow:verificateur-plan` →
`general-purpose` tenant le rôle décrit dans `.claude/agents/verificateur-plan.md` (ou
`plugin/agents/…` en dépôt source).

Routage, par le cadreur : `PASS` → approbation. `DÉFAUT` corrigeable sans toucher une décision →
corriger la synthèse, **revérifier la seule correction** (relancer avec le constat et la
correction, rien d'autre). `À VÉRIFIER` ou fait manquant → recherche (`analyste-flux`,
`lecteur-doc`), sonde, ou protocole de preuve — jamais une question à l'utilisateur pour un fait
accessible. « Choix non résolus » non vide → **question** (`WORKFLOW.md` §9c), avec cette liste
comme options. Une passe ; pas de relance sur un reformulage — seulement si buts ou périmètre
changent (Ideation).

## Étape 2 — Découper en sessions (règle de coût)

Un démarrage froid a un prix fixe (prompt système + `CLAUDE.md` + lectures) ; enchaîner dans une
même session fait re-payer le contexte accumulé à chaque tour. Le découpage arbitre entre les deux.

**Regrouper par lectures partagées, d'abord** : plusieurs tâches qui lisent les mêmes fichiers
paient un seul démarrage à froid pour toutes — c'est le critère premier, pas un parmi d'autres.
Regrouper plusieurs tâches dans une même session si TOUT est vrai :

- lectures/fichiers largement partagés **ou** tâches courtes (`low`) ;
- aucune validation humaine requise entre elles ;
- le lot reste raisonnable (~3-5 tâches courtes, ou 2 moyennes liées).

**Séparer** dès qu'un de ces critères tombe, ou qu'une validation humaine (N2) s'intercale entre
deux tâches, ou que la séparation **débloque une parallélisation**. Un changement de modèle ou
d'effort, ou une tâche `high`/`xhigh`, ne sont plus des règles absolues de séparation : ce sont des
**indices** qui pèsent dans le même arbitrage — le coût d'un redémarrage à froid peut l'emporter sur
eux quand les lectures sont vraiment partagées.

**Séquentiel par défaut.** Deux sessions sont **parallélisables** ssi aucune dépendance **et** zones
modifiées disjointes (fichiers de « Modifier »), mais le parallèle reste une **option déclarée au
cadrage**, pas le régime normal (`WORKFLOW.md` §4b) : une vague marquée « parallélisable » se
justifie en une ligne dans son *Pourquoi maintenant* — le **gain d'horloge attendu**, pas « c'est
possible ». La colonne « Zone modifiée » sert au contrôle de disjonction : y mettre les
répertoires/fichiers réellement touchés, pas des généralités.

**Une session dont la zone est « aucune » demande un soin particulier.** Vérification, mesure, audit :
son livrable est une **conclusion**, pas un diff. Écrire alors dans le `S<k>.md` ce que le bilan devra
contenir — le corpus exact, le critère, le résultat attendu — parce que c'est la seule chose qui
restera. Sans ça, la session rend « ça marche » dans une conversation qui disparaît, et le plan ne
peut plus la distinguer d'une session jamais lancée (constaté sur MYO P1/S5, 2026-08-24).

**Session de type `exploration` (C6)** : quand l'Étape 0 ou l'Étape 1 a déclenché l'exploration
ouverte (première prémisse comportementale non sondable, enquête `OPTIONS` sans option
satisfaisante, deuxième plan tué sur la zone), la découpe ajoute une session de ce type plutôt
qu'une tâche écrite sur une inconnue. Son bandeau porte `Régime : ouvert` (squelette-session) :
branche jetable **nommée et poussée** (jamais `main`), budget écrit (tours ou temps), N0 en fin de
session ; son livrable est une **mesure + ce qui a été réfuté + le code candidat**, pas un diff sous
gate N0 classique.

Modèle et effort : grille dans `${CLAUDE_PLUGIN_ROOT}/WORKFLOW.md` §2-3.

## Étape 3 — Écrire `plans/P<n>/index.md`

**Le statut des tâches vit ICI et nulle part ailleurs** (source unique — cf. `WORKFLOW.md` §4a).

Le squelette de l'index est en annexe : **ouvrir `references/squelette-index.md`** (à côté de cette
skill) au moment de l'écrire. Les règles de rédaction — ligne « en clair », ordonnancement,
colonnes — sont ci-dessous.

**La ligne « en clair » est un contrat de lisibilité, pas une redite du titre.** Elle dit ce que la
session change et **à quoi l'utilisateur le constatera** : un écran, un comportement, un fichier
produit, une mesure obtenue. `/orchestrer-plan` la relaie **mot pour mot** au lancement de la vague
(son Étape 1) sans jamais ouvrir le `S<k>.md` — c'est donc la seule chose que l'utilisateur lira
avant de voir passer les commits. Une ligne qui paraphrase le titre (« S2 — refonte du module
d'édition ») ne lui apprend rien ; deux phrases suffisent, à condition d'être les bonnes.

Même exigence pour le *Pourquoi maintenant* d'une vague : il justifie l'**ordre**, pas le contenu —
« sans ça, S4 travaillerait sur une structure de données qui va changer » plutôt que « prérequis ».

**Trois mots-clés déclarent une exception à l'exécution normale**, deux sur la ligne d'une **vague**,
un sur la ligne « en clair » d'une **session** : `validation-humaine` (la vague arrête
l'orchestrateur une fois collectée, même si tout est `PASS`) et `reprise-manuelle` (un `FAIL` de cette
vague n'a droit ni à la reprise ni à l'enquête automatiques) portent sur la vague entière ; **`pastille`**, lui, porte sur une session
précise — elle se lance par le repli pastille (premier plan, navigateur complet), **même en
Desktop** : c'est le cadreur qui le décide ici, au cadrage, quand le N1 de cette session est
structurant (nouvel écran, refonte de mise en page) et mérite un déroulé surveillé plutôt qu'un
sous-agent (`/orchestrer-plan` Étape 1, `/verif-visuelle`).

**`validation-humaine` a un seul critère : le `PASS` lui-même demande ton jugement** — une ligne
`N2 humain` non vide dans une session de la vague, dont la réponse décide s'il faut lancer la
suivante. Ce ne sont **pas** des raisons : une mesure au critère mécanique (son `FAIL` arrête déjà
le plan), une vague « qui protège la suivante » (idem), une ressource rare déjà budgétée au plan, un
geste humain préalable (il se vérifie en premier geste de la session, `references/squelette-session.md`
« Si bloqué »). Un arrêt sur `PASS` sans jugement à rendre ne t'apporte rien que la relance ; il coûte
une interruption (décision du 2026-09-17). L'ancien mot `gate` sur une ligne de vague ne s'écrit
plus : `/orchestrer-plan` l'ignore.

**Vagues orchestrées (optionnel)** — toute vague s'exécute via `/orchestrer-plan`, qui déroule les
sessions les unes après les autres jusqu'à épuisement, une `validation-humaine`, ou une **question** à l'utilisateur.
Un `FAIL` déclenche par défaut le cycle de remédiation à froid (`/orchestrer-plan` actions `reprendre`
et `enqueter`, budget : 2 reprises et 1 enquête par session, `WORKFLOW.md` §9c) ; le mot **`reprise-manuelle`** sur
la ligne d'ordonnancement d'une vague le désactive — à déclarer au cadrage quand un échec dans
cette vague doit passer par un humain d'emblée (état coûteux à annuler, zone sensible). Voies et
colonne `Env.` : domicile `WORKFLOW.md` §5b, ne pas le reformuler ici. Résumé pour le découpage :

Colonne **Env.** : toujours `—` (sous-agent — seule voie depuis v0.30.0, §5b). L'effort écrit sur une
ligne est celui auquel la session tournera : `/orchestrer-plan` la lance sur l'agent `session-<effort
de la ligne>`, qui porte son propre frontmatter (§3) — plus de couverture par l'effort ambiant de la
conversation d'orchestration, plus d'effort d'orchestration à écrire dans l'index. `max` n'est pas une
valeur d'index (§3) : il n'existe pas d'agent `session-max`. *Legacy : dans un plan antérieur à P3,
`Desktop` se lit comme `—` ; dans un plan antérieur à v0.30.0, `headless` se lit comme `—`
(sous-agent).*

L'index ne contient **rien d'autre** : aucun détail d'exécution (étapes, commandes, fichiers à la
ligne près) — il pointe vers les sessions. Les lignes « en clair » et les *Pourquoi maintenant* sont
la seule prose autorisée, et elles décrivent toujours un **résultat**, jamais un moyen.

### En mode extension — modifier l'index, ne pas le récrire

Trois éditions ponctuelles, rien de plus :

1. **Table des sessions** : ajouter les lignes en continuant la numérotation du plan. Jamais de
   `S5bis` — le repère `Plan: P<n>/S<k>/T<m>` des commits doit rester unique et triable.
2. **Ordonnancement** : insérer la vague **avant** celles qu'elle débloque, avec sa cause dans le
   titre — `- **Vague <w> — remédiation de S<j> (ajoutée le YYYY-MM-DD)** : S8 · S9.` (tiret
   initial, date dans le gras — la forme lue sans tolérance par `prochaine-action.mjs`, T4/P10/S2 :
   sans le tiret ni la date à l'intérieur des `**`, la vague entière était ignorée, incident MYO du
   2026-09-22). Sans cette trace, un plan relu dans un mois ne distingue plus le prévu du réparé. La vague ajoutée porte
   son *Pourquoi maintenant* et ses lignes « en clair » comme les autres — c'est même là qu'elles
   comptent le plus : une vague de remédiation est ce que l'utilisateur n'avait pas prévu de lire.
3. **Statuts en aval** : une session déjà `[x]` dont le résultat repose sur l'hypothèse invalidée
   redevient `[ ]`, et on le dit explicitement à l'utilisateur. Un vert faux coûte plus cher qu'un
   statut manquant.

L'« Objectif d'ensemble » ne bouge pas. S'il faut le récrire, ce n'était pas une extension (Étape 0).

**La colonne « Message de commit » se remplit après l'Étape 4, pas ici** : son contenu (un message
par tâche) n'existe qu'une fois chaque `S<k>.md` écrit. Une fois l'Étape 4 terminée, revenir sur
l'index et reporter, pour chaque session d'une vague parallèle, le « Message de commit » de chacune
de ses tâches tel qu'écrit dans son `S<k>.md` — `references/squelette-index.md` (colonne « Message
de commit ») précise la forme.

## Étape 4 — Écrire un `plans/P<n>/S<k>.md` par session

Le squelette du fichier est en annexe : **ouvrir `references/squelette-session.md`** (à côté de
cette skill) au moment d'écrire le premier `S<k>.md`, et le suivre champ par champ. Les règles qui
décident de ce qu'on y met sont ci-dessous ; l'annexe ne porte que la forme.

**Pas de bloc « Statut » dans le `S<k>.md`** : il vit dans l'`index.md`. Une information de suivi
écrite à deux endroits finit toujours par diverger.

Principes :

- **Le bandeau est auto-suffisant** : modèle, effort, environnement, mode parallèle — jamais besoin
  de retourner à l'index pour lancer la session.
- **« Lire » est un point de départ, pas un plafond** : la lecture reste ouverte, seule
  l'**écriture** est bornée (à la zone du plan) — `EXECUTANT.md`.
- **« Étapes » = le comment**, ordonné. Plus le modèle est faible, plus elles sont fines ; si une
  tâche demande trop de jugement pour le modèle visé → la **découper**. Une étape dont l'intention
  n'est pas évidente porte sa raison en fin de ligne, après un tiret : c'est ce qui permet de
  s'écarter **juste** plutôt que d'appliquer à la lettre. Une étape qui réclame trois lignes de
  justification n'est pas une étape, c'est une décision qui manque — elle remonte en « Décision
  clé », ou dans un `docs/decisions/` via `/cadrer`.
- **« Pourquoi » n'est pas « Objectif » redit autrement.** L'objectif dit *quoi faire*, le pourquoi
  dit *ce que ça sert*. Si les deux se paraphrasent, c'est le pourquoi qui manque : remonter d'un
  cran vers l'objectif d'ensemble du plan jusqu'à trouver ce que cette tâche-là rend possible.
- **« Validation » = critères vérifiables** (commande + résultat, ou écran + attendu), jamais « ça marche ».
- **« Anti-raccourci » nomme le faux-vert de CETTE tâche**, celui qu'un exécutant pressé ou un
  outillage muet produirait sans mentir : `typecheck` qui ne compile aucun fichier, test skippé ou
  marqué `todo`, assertion adaptée au résultat observé, fixture figée à la place de l'appel réel,
  build qui ne recompile pas le fichier touché. C'est le seul champ de la Validation que l'exécutant
  ne peut pas satisfaire en le lisant : il sert au relecteur, qui vérifie que le PASS est vrai. Le
  cadreur est le seul à savoir où est le raccourci — s'il ne voit pas lequel, `—`, jamais une
  formule générique.
- **Toute décision de `docs/decisions/` en jeu s'écrit sous sa forme opérationnelle** : la
  mécanique à employer (« passe par le script X »), jamais seulement l'interdit de contenu
  (« n'écris jamais de paroles ») — un exécutant reconnaît une mécanique, pas une interdiction
  abstraite écrite la veille (constat du 2026-09-10).
- **N1 ≠ N2** : ce qu'un navigateur peut constater (erreur console, texte absent, 404, débordement)
  est N1 et ne va **jamais** dans `VALIDATION.md`. N2 = uniquement le jugement humain.

## Étape 4b — Faire vérifier la découpe (jamais par soi-même)

Le plan est écrit, rien n'est encore commité. Lancer d'abord
`node ${CLAUDE_PLUGIN_ROOT}/bin/verifier-plan.mjs P<n>` (vendoré :
`node .claude/workflow/bin/verifier-plan.mjs P<n>`). En mode extension, ajouter `--extension` (ne force pas la preuve N0 sur les anciennes sessions). Corriger tout écart mécanique ou format non
reconnu jusqu'à `RAS` ; le script ne juge pas le design. Puis lancer `brief-a-jour.mjs` **au premier plan**
(`node .claude/workflow/bin/brief-a-jour.mjs`, `plugin/bin/` dans ce dépôt source), puis l'agent
**`verificateur-plan`**, **au premier plan** (§5), en lui donnant `P<n>`, en mode extension les
sessions ajoutées, et la sortie du script :

> Vérifie `plans/P<n>/` — contrôles sémantiques restants. Sortie de verifier-plan : RAS. Sortie de brief-a-jour : <sortie>

Le script a vérifié chemins, collisions et dépendances. L'agent ne les refait pas : il juge la
pertinence des validations, les justifications d'exception et les arrêts humains. Une seule passe.


**Pourquoi un autre que le cadreur** : l'Étape 1 finit par « plan rédigeable maintenant ? », et
c'est le rédacteur qui répond. Une découpe fausse ne se voit pas de l'intérieur — elle se voit à
la troisième vague de remédiation (Étape 0), quand elle a déjà coûté deux plans.

Chaque écart rendu se corrige **ici**, avant l'Étape 6, ou se justifie en une ligne dans le
`S<k>.md` concerné s'il est volontaire (un fichier créé par une session d'une
vague antérieure, par exemple). `RAS` → continuer sans rien écrire : la vérification ne laisse pas de trace,
c'est le plan corrigé qui en est la trace.

**Un écart n°11 se traite avant l'Étape 6** : ligne `Brief : <section> : …` non appliquée →
réécrire la section dans un commit séparé `docs(brief): applique <décision>` portant
`Brief-applique: <chemin>`, puis relancer le script ; ligne absente → l'ajouter (`inchangé` ou
section) dans ce même commit ; ligne ambiguë (section ou changement indéduisibles) → `/cadrer`, pas
de plan.

## Étape 5 — Reporter dans `TASKS.md`

Une ligne par tâche du plan, statut remplacé par le renvoi : `- T-012 — <titre> · → plans/P2/S1.md`.
Le suivi d'avancement se lit dans l'`index.md`.

En mode extension, mêmes lignes pour les seules tâches ajoutées ; les tâches déjà reportées ne
bougent pas.

## Étape 6 — Committer et pousser le plan

Staging explicite du dossier `plans/P<n>/` et de `TASKS.md`, un commit
(`plan(P<n>): <objectif en une ligne>`), puis **`git push` sur `main`** — session cloud comprise
(`WORKFLOW.md` §4b).

Le cadrage est fini, l'exécution ne l'est pas : c'est justement pourquoi le plan doit être poussé
maintenant. Chaque session part d'une **conversation neuve** (§5b), souvent d'une autre machine ou
d'une session cloud — un `index.md` resté local n'y existe pas, et la première session du plan
démarre alors sur un dossier qu'elle ne trouve pas.
