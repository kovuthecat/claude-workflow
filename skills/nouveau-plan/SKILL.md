---
name: nouveau-plan
description: Découper un chantier en sessions et générer le dossier plans/P<n>/ (index + un fichier par session). À dérouler par Opus quand une tâche demande plusieurs sessions, ou quand le scope est flou.
model: opus
---

# Découper un plan en sessions

Le frontmatter bascule sur Opus pour ce tour. **Ça ne couvre que l'investigation** (Étape 1,
avant le Plan Mode) : une fois le plan approuvé par l'utilisateur, l'écriture (Phase suivante)
reprend dans un nouveau tour, sur le modèle actif de la session — sans gravité, c'est mécanique.
Sortie = un dossier `plans/P<n>/`. Les squelettes vivent ici (et non dans `WORKFLOW.md`) : ils ne
coûtent des tokens qu'au découpage.

**Le QUOI et le POURQUOI doivent déjà être tranchés.** Si le scope est flou ou l'approche non
décidée, ce n'est pas ce plan qu'il faut écrire : dérouler `/cadrer` d'abord, dans une session
séparée, et repartir de la décision écrite qu'elle produit.

## Pour qui on écrit — deux lecteurs, deux registres

Un plan sert deux lectures, et rate sa cible s'il n'en sert qu'une :

- **L'`index.md` est lu par un humain qui décide** — et relayé tel quel par `/orchestrer-plan` au
  lancement de chaque vague, sans qu'aucun `S<k>.md` ne soit ouvert. C'est le seul texte du plan que
  l'utilisateur lira : registre « Écrire pour qui décide » (`CLAUDE-BASE.md`), appliqué strictement.
- **Le `S<k>.md` est lu par le modèle qui exécute.** Précision et exhaustivité priment sur le
  registre. Il porte quand même le **pourquoi** de chaque tâche : une consigne sans intention
  s'exécute à la lettre et à côté, et c'est l'intention qui permet de s'arrêter au bon moment.

## Étape 0 — Plan neuf, ou extension d'un plan en cours ?

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

## Étape 1 — Investiguer (jamais modifier)

Se mettre en **Plan Mode** pour toute la phase d'investigation — ce mode interdit l'écriture de
fichiers, donc la consigne « jamais modifier » devient structurelle plutôt que déclarative.

1. **Flux** : chemin complet du problème/feature, où il commence et se termine.
2. **Fichiers probables** sans tout ouvrir : `PROJECT_MAP.md`, `ARCHITECTURE.md`, registre `DECISIONS.md` d'abord.
3. **Rôle** de chaque fichier clé : pourquoi il est pertinent.
4. **Dépendances directes** utiles.
5. **1-2 hypothèses racines** (bug : ce qui peut mal tourner ; feature : choix archi critiques).
6. **Verdict** : plan rédigeable maintenant, ou ambiguïté à lever avec l'utilisateur d'abord ?

**Déléguer** dès que les points 2-3 demandent de balayer le repo ou l'historique : exploration de
fichiers → agent `explorateur` ; résumé de diff/historique git → agent `resumeur-git`. Chacun ne
rend que sa conclusion, l'exploration ne pollue pas le contexte Opus (qui est le plus cher). Garder
pour soi les points 1, 5 et 6 — c'est le raisonnement, pas la recherche.

## Étape 2 — Découper en sessions (règle de coût)

Un démarrage froid a un prix fixe (prompt système + `CLAUDE.md` + lectures) ; enchaîner dans une
même session fait re-payer le contexte accumulé à chaque tour. Le découpage arbitre entre les deux.

**Regrouper** plusieurs tâches dans une même session si TOUT est vrai :

- même modèle **et** même effort ;
- tâches courtes (`low`) **ou** lectures/fichiers largement partagés ;
- aucune validation humaine requise entre elles ;
- le lot reste raisonnable (~3-5 tâches courtes, ou 2 moyennes liées).

**Séparer** dès qu'un critère tombe, et notamment : toute tâche `high`/`xhigh` est **seule dans sa
session** · changement de modèle ou d'effort · gate humaine entre deux tâches · la séparation
**débloque une parallélisation**.

Deux sessions sont **parallélisables** ssi aucune dépendance **et** zones modifiées disjointes
(fichiers de « Modifier »). La colonne « Zone modifiée » sert à ce contrôle : y mettre les
répertoires/fichiers réellement touchés, pas des généralités.

**Une session dont la zone est « aucune » demande un soin particulier.** Vérification, mesure, audit :
son livrable est une **conclusion**, pas un diff. Écrire alors dans le `S<k>.md` ce que le bilan devra
contenir — le corpus exact, le critère, le résultat attendu — parce que c'est la seule chose qui
restera. Sans ça, la session rend « ça marche » dans une conversation qui disparaît, et le plan ne
peut plus la distinguer d'une session jamais lancée (constaté sur MYO P1/S5, 2026-08-24).

Modèle et effort : grille dans `${CLAUDE_PLUGIN_ROOT}/WORKFLOW.md` §2-3.

## Étape 3 — Écrire `plans/P<n>/index.md`

**Le statut des tâches vit ICI et nulle part ailleurs** (source unique — cf. `WORKFLOW.md` §4a).

```md
# Plan P<n> — <titre du plan>   (rédigé par Opus)

## Objectif d'ensemble
<2-3 lignes : le but global du plan, et ce qui sera vrai à la fin qui ne l'est pas aujourd'hui —
 en clair, pas en termes de code>

## Sessions
| Session | Tâches | Titre | Modèle | Effort | Env. | Dépend de | Zone modifiée | Statut |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [S1](S1.md) | T1-T3 | … | Haiku | low | — | — | `css/`, `index.html` | [ ] |
| [S2](S2.md) | T5 | … | Sonnet | high | — | S1 | `js/edit/` | [ ] |

## Ordonnancement
- **Vague 1 — parallélisable** : S1 · S3 (zones disjointes, aucune dépendance).
  *Pourquoi maintenant* : <ce que cette vague débloque pour la suite, une ligne>
  - **S1** — <en clair : ce que ça change, et à quoi on le verra. 1-2 phrases, sans jargon>
  - **S3** — <idem>
- **Vague 2** : S2 (après S1) · S4 (après S3).
  *Pourquoi maintenant* : <…>
  - **S2** — <…>
  - **S4** — <…>
- **Vague 3 — clôture** : contexte (`STATUS.md`, `TASKS.md`, `VALIDATION.md`) et push. Pas de
  commits de code à rattraper : chaque session a commité les siens.
```

**La ligne « en clair » est un contrat de lisibilité, pas une redite du titre.** Elle dit ce que la
session change et **à quoi l'utilisateur le constatera** : un écran, un comportement, un fichier
produit, une mesure obtenue. `/orchestrer-plan` la relaie **mot pour mot** au lancement de la vague
(son Étape 3) sans jamais ouvrir le `S<k>.md` — c'est donc la seule chose que l'utilisateur lira
avant de voir passer les commits. Une ligne qui paraphrase le titre (« S2 — refonte du module
d'édition ») ne lui apprend rien ; deux phrases suffisent, à condition d'être les bonnes.

Même exigence pour le *Pourquoi maintenant* d'une vague : il justifie l'**ordre**, pas le contenu —
« sans ça, S4 travaillerait sur une structure de données qui va changer » plutôt que « prérequis ».

**Trois mots-clés déclarent une exception à l'exécution normale**, deux sur la ligne d'une **vague**,
un sur la ligne « en clair » d'une **session** : `gate` (la vague arrête l'orchestrateur une fois
collectée, même si tout est `PASS`) et `reprise-manuelle` (un `FAIL` de cette vague n'a pas droit à
la reprise automatique) portent sur la vague entière ; **`pastille`**, lui, porte sur une session
précise — elle se lance par le repli pastille (premier plan, navigateur complet), **même en
Desktop** : c'est le cadreur qui le décide ici, au cadrage, quand le N1 de cette session est
structurant (nouvel écran, refonte de mise en page) et mérite un déroulé surveillé plutôt qu'un
sous-agent (`/orchestrer-plan` Étape 3, `/verif-visuelle`).

**Vagues orchestrées (optionnel)** — toute vague s'exécute via `/orchestrer-plan`, qui déroule les
sessions les unes après les autres jusqu'à épuisement, un échec non repris, ou une gate humaine.
Un `FAIL` déclenche par défaut **une** reprise automatique à froid (`/orchestrer-plan` Étape 5c) ;
le mot **`reprise-manuelle`** sur la ligne d'ordonnancement d'une vague la désactive — à déclarer
au cadrage quand un échec dans cette vague doit passer par un humain d'emblée (état coûteux à
annuler, zone sensible). Voies et
colonne `Env.` : domicile `WORKFLOW.md` §5b, ne pas le reformuler ici. Résumé pour le découpage :

Colonne **Env.** : toujours `—` (sous-agent — seule voie depuis v0.30.0, §5b) ; une session dont
l'effort dépasse `medium` reste couverte, le sous-agent héritant de l'effort **ambiant** de la
conversation d'orchestration (une orchestration lancée en `high` couvre `high`) — écrire alors dans
l'index l'effort d'orchestration attendu, pour que le rappel « À régler AVANT de lancer » de
`/orchestrer-plan` porte la bonne valeur. *Legacy : dans un plan antérieur à P3, `Desktop` se lit
comme `—` ; dans un plan antérieur à v0.30.0, `headless` se lit comme `—` (sous-agent).*

L'index ne contient **rien d'autre** : aucun détail d'exécution (étapes, commandes, fichiers à la
ligne près) — il pointe vers les sessions. Les lignes « en clair » et les *Pourquoi maintenant* sont
la seule prose autorisée, et elles décrivent toujours un **résultat**, jamais un moyen.

### En mode extension — modifier l'index, ne pas le récrire

Trois éditions ponctuelles, rien de plus :

1. **Table des sessions** : ajouter les lignes en continuant la numérotation du plan. Jamais de
   `S5bis` — le repère `Plan: P<n>/S<k>/T<m>` des commits doit rester unique et triable.
2. **Ordonnancement** : insérer la vague **avant** celles qu'elle débloque, avec sa cause dans le
   titre — `**Vague <w> — remédiation de S<j>** (ajoutée le YYYY-MM-DD) : S8 · S9.` Sans cette
   trace, un plan relu dans un mois ne distingue plus le prévu du réparé. La vague ajoutée porte
   son *Pourquoi maintenant* et ses lignes « en clair » comme les autres — c'est même là qu'elles
   comptent le plus : une vague de remédiation est ce que l'utilisateur n'avait pas prévu de lire.
3. **Statuts en aval** : une session déjà `[x]` dont le résultat repose sur l'hypothèse invalidée
   redevient `[ ]`, et on le dit explicitement à l'utilisateur. Un vert faux coûte plus cher qu'un
   statut manquant.

L'« Objectif d'ensemble » ne bouge pas. S'il faut le récrire, ce n'était pas une extension (Étape 0).

## Étape 4 — Écrire un `plans/P<n>/S<k>.md` par session

```md
# P<n> · S<k> — <titre>   (rédigé par Opus)

> **Modèle : <Sonnet/Haiku> · effort : <low|medium|high|xhigh> · Vague : <v> (parallèle : oui/non)**
> **Environnement : <Desktop (navigateur requis) | indifférent>** (`WORKFLOW.md` §6, N1)
> **Latitude : <ce que l'exécutant peut ajuster seul, ou aucune>** (optionnel, déclaré par le
> cadreur session par session ; absent = aucune, tout écart reste un STOP — mesure B3)
> Exécutant : UNIQUEMENT les tâches ci-dessous, dans l'ordre ; fichiers sous « Lire » / « Modifier ».
> Design fixé — ne reconçois pas. Doute ou blocage → nomme sa nature (`WORKFLOW.md` §9a) ; ce qui
> est à ta portée se corrige, le reste → STOP, rapport, rends la main.

- Date : YYYY-MM-DD · Branche : <ou —>

## Lire (commun à la session)
`.claude/workflow/EXECUTANT.md` (toujours en premier), puis :
<fichiers + portée précise (section / fonction / lignes) — RIEN d'autre>

## Hors périmètre
<ce qu'il ne faut PAS toucher / faire — vaut pour toute la session>

---

## T<n> — <titre>

### Objectif
<1-2 lignes : le quoi>

### Pourquoi
<1-2 lignes : ce que cette tâche débloque dans le plan, ou ce qu'elle change pour qui se sert du
 produit. C'est l'intention — ce qui permet à l'exécutant de trancher si une consigne s'avère
 ambiguë en cours de route, et à un humain de comprendre la tâche sans lire le code.>

### Décision clé
<ce qu'il faut savoir sans relire le repo ; pointer une décision précise, ex. « docs/decisions/2026-07-12-auth.md »>

### Référence
<optionnel : chemin d'un code à imiter, un script qui fait déjà la chose, une maquette — et ce
 qu'il faut y regarder. « Fais comme là » remplace six lignes d'étapes (mesure B4).>

### Lire / Modifier
<en plus du commun : lectures spécifiques ; fichiers à modifier/créer — liste exhaustive>

### Étapes
1. …

### Validation
- **N0 auto (bloque le commit)** : `<commande>` → <résultat attendu>
- **Tests** : <créés/mis à jour : fichiers, cas couverts> — ou « — » justifié en 1 ligne
- **N1 visuel auto** : <écran/parcours à vérifier au navigateur in-app, ou `—`> → `/verif-visuelle`
- **N2 humain (jugement esthétique/UX)** : <checklist ou `—`> → à consigner dans `VALIDATION.md`

### Si bloqué
<condition d'arrêt SPÉCIFIQUE → STOP + quoi signaler>

### Message de commit (appliqué par la session elle-même)
`<type(scope): message>`
Dernière ligne du commit, obligatoire : `Plan: P<n>/S<k>/T<m>` — c'est le repère qui rend la tâche
retrouvable ensuite (`git log --grep`), et par lequel l'orchestrateur lit le verdict d'une session
(§5b).

---

<répéter le bloc T<n> pour chaque tâche de la session>

## Fin de session
Dérouler `/fin-de-tache` (mode selon « parallèle : oui/non » du bandeau).
```

**Pas de bloc « Statut » dans le `S<k>.md`** : il vit dans l'`index.md`. Une information de suivi
écrite à deux endroits finit toujours par diverger.

Principes :

- **Le bandeau est auto-suffisant** : modèle, effort, environnement, mode parallèle — jamais besoin
  de retourner à l'index pour lancer la session.
- **« Lire » est restrictif et porté** : que ces fichiers, à la section/fonction près.
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
- **Toute décision de `docs/decisions/` en jeu s'écrit sous sa forme opérationnelle** : la
  mécanique à employer (« passe par le script X »), jamais seulement l'interdit de contenu
  (« n'écris jamais de paroles ») — un exécutant reconnaît une mécanique, pas une interdiction
  abstraite écrite la veille (constat du 2026-09-10).
- **N1 ≠ N2** : ce qu'un navigateur peut constater (erreur console, texte absent, 404, débordement)
  est N1 et ne va **jamais** dans `VALIDATION.md`. N2 = uniquement le jugement humain.

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
