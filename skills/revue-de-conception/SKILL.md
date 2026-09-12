---
name: revue-de-conception
description: Revue a posteriori d'un projet ou d'une zone — constat de l'écart entre l'intention écrite et le code réel, puis interview de recalage avec l'utilisateur pour arrêter l'objectif, avant d'en tirer les écarts. À dérouler quand les correctifs et les ajouts se sont empilés, à un jalon, ou avant d'ouvrir un gros chantier sur une zone ancienne. Ne modifie pas de code.
allowed-tools: Read, Glob, Grep, Agent, WebFetch, WebSearch, Write, Edit
model: opus
---

# Revue de conception

Trois temps, dans cet ordre : **constater** ce qui est écrit et ce qui existe · **recaler
l'objectif avec l'utilisateur, en interview** · **en déduire les écarts**.

L'ordre est le contenu de la skill. Après des mois d'empilement, ce n'est pas toujours le code qui
a dérivé — c'est souvent **l'objectif qui a bougé sans que l'écrit suive**. Les deux produisent le
même symptôme et appellent des réponses opposées : aligner le code, ou mettre à jour l'écrit. **La
différence ne se déduit pas du dépôt : elle se demande.** Une revue qui saute l'interview mesure
tout contre un étalon périmé et propose de « réparer » ce qui était devenu le vrai but.

La revue **constate, demande, écrit**. Elle ne corrige pas de code, ne découpe pas de plan.

## Ce que ce n'est pas — aiguillage avant d'ouvrir

| Ce qu'on a en main | La bonne porte |
| --- | --- |
| Un défaut dans le code qui vient d'être écrit | `/code-review` (branché dans `/fin-de-tache`) |
| Une question déjà posée, il faut trancher | `/cadrer` |
| Du travail déjà identifié à découper | `/nouveau-plan` |
| Un doute sur un mécanisme Claude Code ou la config `.claude/` | `/choisir-mecanisme` |
| « Où j'en étais ? » sur un projet dormant | `/reprendre` |
| Un fichier de contexte au-dessus de son plafond | `/purge-contexte` |

**La revue trouve les questions ; `/cadrer` y répond.** L'interview d'Étape 3 ne fait exception que
sur **l'objectif lui-même** — l'étalon de la revue, qu'il faut arrêter pour que la suite ait un
sens. Tout autre arbitrage (deux conceptions possibles, une décision technique à rouvrir) sort en
`/cadrer`, à froid. Sans cette limite, la revue devient un cadrage non cadré, au tarif Opus.

## Étape 0 — Borner, et vérifier que l'utilisateur est là

Écrire deux lignes, avant toute lecture :

- **Périmètre** : `zone` (une feature, un module, un fichier, une fonction — le cas courant) ou
  `global` (le projet entier). Une revue globale coûte un cadrage Opus complet : elle se justifie à
  un jalon, ou après une phase où les correctifs se sont empilés — **jamais en routine**.
- **Déclencheur** : le symptôme observé (« le même bug revient », « toucher ça demande de tout
  relire », « trois écrans font la même chose différemment ») ou le jalon. Une revue sans
  déclencheur trouve tout, donc rien.

**L'interview exige un humain disponible.** Une revue lancée en sous-agent ou en tâche planifiée n'a
personne à qui parler : elle s'arrête après l'Étape 2, écrit le constat, et dit
en clair que **l'objectif n'a pas été recalé** — donc qu'aucun écart n'est classé. Un constat sans
étalon arrêté n'est pas une revue, c'est de la matière pour la vraie.

## Étape 1 — L'étalon provisoire : l'intention telle qu'elle est écrite

Avant de regarder le code. Le code lu en premier devient sa propre référence : on rationalise ce
qui est là, et il ne reste plus rien à mesurer.

Se lisent en direct, parce que c'est court et structurant : `PROJECT_BRIEF.md` (objectif, usage
prévu, hors périmètre, « à éviter pour l'instant »), `ARCHITECTURE.md`, le registre `DECISIONS.md`,
et les `docs/decisions/` qui portent sur le périmètre.

En sortir cinq lignes au plus : ce que le périmètre est censé faire, ce qu'il est censé **ne pas**
faire, et les contraintes déjà tranchées. **Provisoire** : c'est l'interview qui l'arrête.

Rien d'écrit (projet ancien, jamais outillé) : le reconstituer depuis le README et l'historique
(`resumeur-git`), et le signaler — l'interview d'Étape 3 sera plus longue, et c'est normal. Si le
projet n'a jamais été outillé du tout : `/migrer-projet` d'abord.

## Étape 2 — L'état réel, sans le lire soi-même

Déléguer (`${CLAUDE_PLUGIN_ROOT}/WORKFLOW.md` §5) : Opus lit des conclusions, pas des traces.

| Agent | Ce qu'on lui demande |
| --- | --- |
| `explorateur` | où vit le périmètre, quels fichiers, quelles dépendances entrantes et sortantes |
| `resumeur-git` | quels fichiers du périmètre ont été le plus retouchés, et par quels types de commits |
| `verificateur-n0` | l'état de santé (build, typecheck, tests) — **N0 rouge : ce n'est pas une revue qu'il faut, c'est une réparation**, s'arrêter là |
| `lecteur-doc` | uniquement si le « meilleur moyen » dépend d'une capacité externe à vérifier |

**Le signal le moins cher et le plus fiable est la répétition des correctifs.** Une zone qui a reçu
cinq `fix:` en trois mois n'est pas malchanceuse : sa conception ne tient pas la charge qu'on lui
met — ou elle sert un objectif que personne n'a écrit.

Ne lire en direct que les fichiers désignés par ces retours, et seulement ceux-là. À la fin de
l'étape, poser côte à côte, pour soi : **ce que l'écrit dit** · **ce que le code fait** · **ce sur
quoi le travail a réellement porté** (le churn). Les divergences de ce tableau sont la matière de
l'interview — pas encore des écarts.

## Étape 3 — Interview de recalage

**Une question à la fois, jamais un mur de questions.** Reformuler chaque réponse en une ligne
avant de passer à la suivante : l'utilisateur doit pouvoir corriger avant que ça s'accumule.

Trois règles qui distinguent une interview de revue d'un questionnaire :

1. **Aucune question dont la réponse est dans les fichiers.** Sinon c'est un interrogatoire que
   l'utilisateur paie à la place d'une lecture.
2. **Chaque question s'ouvre par le constat qui l'a produite** — « trois écrans font X, le brief
   n'en prévoit qu'un » — puis propose 2 ou 3 issues **et une recommandation motivée**. Une question
   sans constat est un sondage ; une question sans issues proposées renvoie à l'utilisateur un
   travail qui est celui de la revue.
3. **Sept questions au maximum.** Au-delà, le périmètre était trop large : le réduire et rouvrir
   une revue plus tard.

Squelette à adapter au constat — n'en garder que ce que l'Étape 2 a réellement soulevé :

1. **L'objectif tient-il encore ?** Relire l'objectif écrit tel quel, et demander s'il est encore
   vrai aujourd'hui. C'est la seule question toujours posée.
2. **Ce qui a poussé hors périmètre** — telle capacité n'était pas prévue et existe : elle fait
   maintenant partie du but (l'écrit doit suivre), ou c'est une dérive à retirer ou isoler ?
3. **Ce qui était prévu et n'existe pas** — abandonné (le retirer de l'écrit), ou en retard (il
   reste au but) ?
4. **L'usage a-t-il bougé** — qui s'en sert, sur quel appareil, à quelle fréquence ? C'est ce qui
   périme le plus vite, et ce qui change le plus d'arbitrages techniques en aval.
5. **La zone qui coûte** — « toucher ça oblige à tout relire » : problème à traiter, ou prix assumé
   d'un choix qu'on garde ?
6. **Ce qu'on refuse maintenant** — le hors-périmètre a-t-il changé ? Un refus explicite est ce qui
   protège la suite ; sans lui, la revue suivante retrouvera la même dérive.
7. **La phase du projet** — ajout, stabilisation, ou fin de vie ? **Aucune recommandation n'a de
   sens sans cette réponse** : la même dette se corrige en phase d'ajout et se garde en fin de vie.

### Gate — l'étalon arrêté

Restituer en **dix lignes au plus** : l'objectif recalé, ce qui entre dans le périmètre, ce qui en
sort, la phase du projet. **Faire valider explicitement.** Pas de « je considère que c'est
validé » : attendre le oui. C'est cet écrit-là, et pas le brief d'origine, qui mesure la suite.

## Étape 4 — Nommer les écarts, mesurés contre l'étalon arrêté

Trois types, pas un de plus — le type détermine la sortie :

| Type | Ce qui cloche | Sortie |
| --- | --- | --- |
| **Dérive** | le code fait autre chose que l'objectif arrêté | aligner le code |
| **Écrit périmé** | le code sert le bon objectif, l'écrit ne le dit pas | mettre l'écrit à jour (Étape 6) |
| **Dette de conception** | le bon objectif, par un chemin qui ne tient plus | proposer le meilleur moyen depuis ici |

L'interview a déjà tranché tout ce qui relevait de l'objectif. Un écart qui contredit une **décision
technique** écrite dans `docs/decisions/` n'est pas couvert par elle : c'est un arbitrage à rendre,
il sort en `/cadrer` en citant le fichier. Refactorer contre une décision sans la rouvrir, c'est la
reprendre à zéro six mois plus tard, sans savoir qu'elle avait été prise.

**Sept écarts au maximum.** Un rapport plus long ne se dépile pas, il s'archive.

Chaque écart porte quatre champs, dans cet ordre — le premier est éliminatoire :

- **Ce qu'on paie aujourd'hui** — observable : un bug qui revient, une modification qui oblige à
  charger tout le projet, un écran lent, deux copies qui divergent. *Pas de coût observable = ce
  n'est pas un écart mais une préférence : le retirer du rapport.*
- **Le meilleur moyen depuis ici** — la conception qu'on prendrait en repartant d'aujourd'hui, avec
  l'objectif arrêté. Pas « ce qu'on aurait dû faire » : personne ne peut agir sur le passé.
- **Coût de bascule et ce qui casse** — combien de sessions, quels fichiers, quelles régressions.
- **Si on ne fait rien** — la réponse honnête. « Rien de grave » est valide, et classe l'écart en C
  ou D.

## Étape 5 — Classer, puis n'en retenir qu'un

Même grammaire que l'audit de `/choisir-mecanisme`, **pondérée par la phase** donnée en interview :

| Classe | Critère | Ce qu'on en fait |
| --- | --- | --- |
| **A** | gain fort, coût faible | à faire, maintenant |
| **B** | gain net, coût modéré | `TASKS.md`, avec le coût écrit |
| **C** | gain marginal | reste dans le rapport, non fait |
| **D** | sur-ingénierie | rejeté explicitement, avec le motif |

Les C et D **s'écrivent quand même** : c'est la trace qui empêche la revue suivante de reproposer
la même idée et de la réévaluer au prix fort.

Terminer par **une seule prochaine action**, nommée, avec sa porte de sortie — pas un menu.

## Étape 6 — Sortir : le rapport, puis l'écrit remis à jour

Le rapport s'écrit dans **tous** les cas, dans `docs/revues/<date>-<perimetre>.md` (pas de plafond,
comme `docs/decisions/`). Jamais dans `VALIDATION.md`, jamais dans `STATUS.md`.

**Puis, si et seulement si l'interview a déplacé l'objectif** — et après la gate — mettre l'écrit à
jour dans la foulée : les sections **Objectif** et **Hors périmètre** de `PROJECT_BRIEF.md`, plus
une ligne au registre `DECISIONS.md` et un `docs/decisions/<date>-<slug>.md` si le déplacement
contraint le code. C'est la **seule** écriture que la skill s'autorise hors du rapport, et elle est
le point : un étalon périmé est la cause racine de la dérive, le laisser périmé garantit que la
prochaine revue retrouvera exactement la même chose.

| Issue | Quand | Suite |
| --- | --- | --- |
| **Rapport seul** | tout est en C/D — le projet tient | on s'arrête, la revue a répondu |
| **Correction directe** | un ou deux écarts A, petits et localisés | une ligne dans `TASKS.md` |
| **Arbitrage à rendre** | décision technique à rouvrir, deux conceptions possibles | `/cadrer`, entrée = ce rapport |
| **Chantier** | plusieurs écarts liés, plusieurs sessions | la décision d'abord, puis `/nouveau-plan` |

```md
# YYYY-MM-DD — Revue de conception : <périmètre>

**Déclencheur** : <symptôme observé, ou jalon>
**Étalon d'origine** : <l'intention écrite, 3 lignes> — sources : <fichiers lus>
**Étalon arrêté en interview** : <objectif recalé, périmètre, hors périmètre, phase du projet>
**Ce qui a bougé** : <en une ligne : l'objectif, l'usage, le périmètre — ou « rien »>

## Écarts retenus

### 1. <titre> — <dérive | écrit périmé | dette de conception> — classe <A|B|C|D>

- Ce qu'on paie aujourd'hui :
- Meilleur moyen depuis ici :
- Coût de bascule / ce qui casse :
- Si on ne fait rien :

## Écartés — ne pas reproposer

- <idée> — <motif>

## Écrit mis à jour

- <fichier + section>, ou « aucun — l'objectif n'a pas bougé »

## Prochaine action

<une seule> → <TASKS.md | /cadrer | /nouveau-plan>
```

## Interdits

- **Aucune modification de code** — Plan Mode (Shift+Tab) dès le début. Le frontmatter retire
  `Bash` : « lancer » et « corriger » ne sont pas une promesse mais une impossibilité.
- **Aucune écriture avant la gate d'Étape 3**, et rien hors du rapport, de `PROJECT_BRIEF.md`
  (Objectif / Hors périmètre) et d'une décision écrite. Aucun autre fichier de contexte.
- **Aucun écart classé sans étalon arrêté** : sans interview, la revue s'arrête au constat.
- **Aucune question dont la réponse est dans les fichiers**, aucune question sans le constat qui
  l'a produite.
- **Ne pas lire le code avant l'étalon provisoire** (Étape 1).
- **Aucune exploration en direct** dès que ça dépasse un fichier : c'est le travail d'`explorateur`.
- **Aucun écart sans coût observable** — sinon c'est du goût, et le goût ne se met pas au backlog.
- **Aucun enchaînement de `/cadrer` ou `/nouveau-plan` dans la même conversation** : la suite repart
  à froid depuis le rapport, c'est à ça qu'il sert. Poser une pastille ou afficher la commande,
  précédée de la ligne « À régler AVANT de lancer » (`${CLAUDE_PLUGIN_ROOT}/WORKFLOW.md` §3).
