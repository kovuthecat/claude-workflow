---
name: cadrer
description: Session de réflexion avec Opus en amont d'un plan, jusqu'à un écrit tranchant les options. À dérouler quand le QUOI et le POURQUOI ne sont pas encore tranchés — y compris une idée neuve à évaluer avant de l'intégrer au projet —, avant `/nouveau-plan`.
allowed-tools: Read, Glob, Grep, Agent, WebFetch, WebSearch, Write, Edit
model: opus
---

# Cadrer un sujet

La réflexion décide **quoi** faire et **pourquoi**. `/nouveau-plan` décide ensuite **comment**,
**par qui** et **dans quel ordre**. Mélanger les deux est ce qui fait dériver une réflexion en
implémentation improvisée — et double le contexte le plus cher du workflow.

Ici Opus ne sert qu'à **arbitrer**. Jamais à chercher, lire, lancer ou vérifier (`WORKFLOW.md` §5).

> Le frontmatter **pré-autorise** les outils listés (`allowed-tools`) — pour le seul tour qui
> invoque la skill : la préautorisation se réinitialise au message suivant (doc Claude Code, Skills,
> vérifiée le 2026-09-15). Le garde-fou reste le **Plan Mode**, dès le début : il interdit
> l'écriture dans le dépôt, pas le lancement d'une **sonde jetable** (Étape 2) — c'est la seule
> exception au « ne rien lancer, ne rien vérifier » (C6).
>
> `model: opus` bascule sur Opus **pour ce même seul tour** : dès le message suivant, la session
> reprend son modèle (doc Claude Code, Skills, vérifiée le 2026-09-24). Or un cadrage se mène sur
> plusieurs tours — interview d'une idée, arbitrage — et le frontmatter ne couvre que le premier :
> l'Étape 0, et l'Étape 1 quand la question est déjà posée. **Ouvrir la session sur Opus**
> (`/model opus`) reste donc la règle. Invoquée en cours de conversation sur un autre modèle, la bascule
> repaie un préfixe de cache complet (`WORKFLOW.md` §3b) — une raison de plus de cadrer à froid.

## Étape 0 — La session est-elle seulement nécessaire ?

C'est l'économie la plus grosse : ne pas ouvrir la session. STOP si la réponse est ailleurs.

- Réponse dans la doc officielle → `lecteur-doc`.
- Réponse dans le repo → `explorateur`.
- **Décision déjà prise** → registre `DECISIONS.md`, puis `docs/decisions/` pour le détail.
  Rejuger une décision close est le gaspillage le plus fréquent, et le plus invisible.
- **Idée déjà écartée ou reportée** → registre, puis « Version 2 / idées futures » de
  `PROJECT_BRIEF.md` : une idée reportée se rouvre sur le signal écrit à côté d'elle, pas sur l'envie.
- Choix d'un mécanisme Claude Code → `/choisir-mecanisme`.
- Question pointue sur Claude Code lui-même → agent `claude-code-guide`.

## Étape 1 — Écrire la question avant de réfléchir

**On arrive avec une idée, pas avec une question** (« et si l'app faisait X ? ») : la question
n'existe pas encore, et l'écrire tout de suite ferait trancher « comment faire X » avant « faut-il
X ». La faire émerger d'abord par l'interview courte de `references/deplier-une-idee.md`, qui rend
précisément les deux lignes ci-dessous.

Deux lignes, en clair, avant toute délibération :

- **Question** : ce qui doit être tranché, formulé pour qu'une réponse soit reconnaissable.
- **Critère de fin** : ce qui, une fois écrit, clôt la session.

Puis remplir la **grille de préparation** (`references/preparation.md`) : cinq lignes, une `OPEN` dit qui la résout.

Une réflexion sans question écrite ne se termine pas : elle s'interrompt quand le contexte est plein.

## Étape 2 — Déléguer tout ce qui n'est pas un arbitrage

**La sonde jetable est autorisée** (C6) : un script du scratch, ou `n0.mjs`, pour lever une inconnue
que la seule lecture ne tranche pas. Rien ne s'écrit dans le dépôt — l'interdit d'écriture demeure
(Plan Mode). Ce n'est pas une délégation : c'est la seule exécution qu'Opus peut lancer lui-même ici.

Avant de déléguer, l'aiguillage de `references/protocoles.md` : `NONE` est la réponse normale ; une fiche ouverte rend ses trois lignes dans la décision.

Une option qui suppose un mécanisme neuf passe par `references/rechercher-existant.md`.

Avant d'ouvrir un fichier soi-même, se demander lequel des agents de délégation rend la conclusion voulue.
Opus lit **les conclusions**, pas les traces. Ce qu'il garde pour lui : le raisonnement, les
hypothèses racines, l'arbitrage final — le reste se délègue.

Ce qui se lit quand même en direct, parce que c'est court et structurant : le registre
`DECISIONS.md`, `PROJECT_BRIEF.md`, `ARCHITECTURE.md`.

## Étape 3 — Borner les options

Assez d'options pour trancher, pas un panorama. Pour chacune : ce qu'elle coûte, et ce qu'elle ferme.

Quand l'entrée était une idée, **« ne pas le faire » et sa version minimale sont toujours parmi les
options** : ce sont les deux qu'on oublie quand l'idée plaît.

Terminer par **une recommandation motivée**, pas un tableau neutre laissé à trancher. Une option
écartée se note en une ligne — elle sert au lecteur futur, pas à la délibération en cours.

**Une option que le lecteur ne peut pas évaluer n'est pas une option, c'est un fait accompli.**
C'est un humain qui tranche ici : chaque option se présente par ses **conséquences observables** —
ce qui devient possible, ce qui devient impossible, ce qui casse, ce qu'il faudra maintenir — avant
tout détail technique (registre : `CLAUDE-BASE.md`, « Écrire pour qui décide »). Sans ça,
l'arbitrage se réduit à faire confiance, et la session n'a tranché que pour elle-même.

## Étape 4 — Écrire au fil de l'eau

Dès qu'un point est tranché, l'écrire. Ne pas attendre la fin de la session : un compactage efface
le raisonnement, pas le fichier. C'est aussi ce qui permet de reprendre à froid sans tout relire.

## Étape 4b — Une réflexion trop longue se coupe, elle ne s'étire pas

Quand la session s'allonge (compactage déjà passé, ou question qui se ramifie), **ne pas continuer
à itérer** : chaque tour Opus renvoie tout le contexte accumulé, y compris les fausses pistes.

Couper plutôt : écrire l'état — ce qui est tranché, ce qui reste ouvert, la prochaine question —
dans le fichier de décision, puis **rouvrir une session neuve** qui repart de ce fichier. Le
contexte retombe d'un ordre de grandeur, et rien d'acquis n'est perdu.

**Pour couper une fausse piste en cours de route, préférer `/rewind` à `/compact`** : le cache du
préfixe est conservé, là où `/compact` réécrit tout. Réserver `/compact` au moment de s'arrêter
avant une pause longue (mesure C2).

Ne pas déléguer cette synthèse à un agent : rédiger une conclusion qu'Opus détient déjà lui coûte
quelques centaines de tokens, là où un agent devrait relire tout l'historique pour la reconstruire.
**La délégation empêche le contexte d'entrer, elle ne l'évacue pas** — c'est le rôle du démarrage à
froid, pas celui d'un sous-agent.

## Étape 5 — Sortir par une issue, une seule

| Issue | Quand | Où l'écrire |
| --- | --- | --- |
| **Décision structurante** | un arbitrage qui contraindra le code plus tard | `docs/decisions/<date>-<sujet>.md` + une ligne dans le registre `DECISIONS.md` |
| **Chantier à mener** | il y a du travail à découper | la décision d'abord, puis `/nouveau-plan` |
| **Rien à faire** | la question tombe, le sujet attend, ou l'idée est écartée | une ligne dans le registre, et on s'arrête — c'est ce qui empêche de la rejuger |
| **Idée reportée** | l'idée tient, mais pas maintenant | une ligne dans « Version 2 / idées futures » de `PROJECT_BRIEF.md`, avec le **signal qui la rouvrira** — pas le registre, réservé au transverse |
| **Preuve à faire** | la question ne se tranche pas en lecture : la réponse n'existe qu'à l'exécution | un **protocole de preuve** (ci-dessous) + une ligne dans le registre — pas de décision, pas de plan |

Toute issue qui écrit un `docs/decisions/` y met la ligne `Brief :` ; si elle n'est pas `inchangé`,
la section nommée de `PROJECT_BRIEF.md` est réécrite **dans le même commit** — c'est
`brief-a-jour.mjs`, lancé par `/nouveau-plan`, qui vérifiera que la propagation a bien eu lieu.

Une session de réflexion qui ne produit aucun écrit n'a pas eu lieu : elle sera refaite.

### Le protocole de preuve — quand la réponse n'existe qu'à l'exécution

**Signal d'entrée**, l'un des suivants suffit (C6) : une première prémisse comportementale non
sondable en lecture ; une enquête `OPTIONS` sans option satisfaisante ; la zone a déjà tué un plan
sur une prémisse (deuxième occurrence) ; ou le critère de succès ne s'énonce pas comme un nombre que
le code d'aujourd'hui produit déjà de façon stable — si la cible bouge quand on change la
définition, il n'y a pas de plan à écrire, il y a une mesure à établir d'abord.

Le protocole remplace la décision. Il porte au minimum :

- **la question**, et **la mesure** qui y répond ;
- **ce qui compterait comme réponse positive ET négative** — une preuve dont le résultat négatif
  n'était pas écrit d'avance ne conclut rien, elle se relit comme un échec ;
- **la branche** (jetable, jamais `main`) et **le budget** annoncé, en tours ou en temps.

Ce qui borne la preuve à la place du périmètre fermé : la branche, le budget, et **N0 à la fin sur
le résultat** — une preuve qui ne passe pas N0 n'est pas une preuve.

**Pendant une preuve, tout est contestable, y compris le juge et les décisions de la zone.** Un
écart trouvé dans l'instrument de mesure est un **résultat**, pas un échec. Et une preuve peut
**dégeler un « tranché »** — c'est la seule chose du workflow qui en ait le droit, et c'est ce qui
l'empêche de reproduire le cliquet qui a vidé une zone en cinq plans.

**Ce qui revient**, dans cet ordre : la mesure et la commande qui la reproduit ; ce qui a été réfuté
(décisions, hypothèses, ou l'instrument lui-même) — c'est la partie de plus grande valeur, et celle
qu'un plan fermé ne peut pas produire ; le **code candidat** sur sa branche. Être vert ne suffit pas
à le faire entrer : la décision qui suit tranche, après une passe `relecteur-session`.

**La preuve est orchestrable** (C6) : session de type `exploration` dans un plan (bandeau `Régime :
ouvert`, squelette-session), lancée en sous-agent, sur branche jetable poussée avec budget écrit —
l'humain lit le résultat, pas le processus. Un exécutant de plan ne bascule jamais en preuve de
lui-même : c'est `/nouveau-plan` qui écrit la session `exploration`, pas une session en cours qui s'y
improvise.

**Committer et pousser l'écrit avant de rendre la main** — staging explicite du `docs/decisions/` et
de la ligne de registre, plus `PROJECT_BRIEF.md` quand la ligne `Brief :` l'a touché ou qu'une idée
y est reportée, puis `git push`
sur `main` (`WORKFLOW.md` §4b), session cloud comprise. Une
décision qui n'existe que sur ce poste ne sera pas lue par la session de plan qui devait s'en servir,
et c'est elle qu'on refera. Le cadrage est une unité de travail : il se clôt poussé.

**La décision écrite s'ouvre par ce qu'elle change, en clair.** Sa première section doit se tenir
seule : quelqu'un qui la lit dans six mois, sans le contexte de la session, doit comprendre ce qui a
été tranché et ce que ça implique avant d'atteindre la moindre justification technique. Le détail,
les alternatives et le raisonnement viennent après — c'est ce qui rend le fichier relisable au lieu
d'être archivé sans être rouvert. Elle se ferme par l'état final de la grille : les `OPEN`
restantes, typées, avec qui les résout.

## Interdits

- **Aucune modification de code ni de fichier de contexte** — Plan Mode (Shift+Tab) dès le début.
- **Aucune exploration en direct** dès que ça dépasse un fichier : c'est le travail d'`explorateur`.
- **Aucun enchaînement de `/nouveau-plan` dans la même conversation — contrainte d'outillage**
  (`WORKFLOW.md` §9c), pas un point d'arrêt de conception : rien ne peut démarrer une session à
  froid à la place de l'humain ; ce qui la lèverait est un harnais qui le ferait. Le cadrage repart
  à froid et lit la décision écrite à l'étape 5 — c'est précisément à ça qu'elle sert. Terminer par
  le **bloc de relance** de `/fin-de-tache` (domicile : prompt `/nouveau-plan …` exact, décision à
  lire en chemin complet), pastille en plus en Desktop : le frontmatter de `/nouveau-plan` bascule
  le modèle sur Opus, jamais l'effort.
