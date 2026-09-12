---
name: cadrer
description: Session de réflexion avec Opus en amont d'un plan, jusqu'à un écrit tranchant les options. À dérouler quand le QUOI et le POURQUOI ne sont pas encore tranchés, avant `/nouveau-plan`.
allowed-tools: Read, Glob, Grep, Agent, WebFetch, WebSearch, Write, Edit
---

# Cadrer un sujet

La réflexion décide **quoi** faire et **pourquoi**. `/nouveau-plan` décide ensuite **comment**,
**par qui** et **dans quel ordre**. Mélanger les deux est ce qui fait dériver une réflexion en
implémentation improvisée — et double le contexte le plus cher du workflow.

Ici Opus ne sert qu'à **arbitrer**. Jamais à chercher, lire, lancer ou vérifier (`WORKFLOW.md` §5).

> Le frontmatter retire `Bash` de la session : « lancer » et « vérifier » ne sont plus une promesse
> mais une impossibilité. Écrire reste possible — la skill doit produire son propre écrit — donc
> « ne modifie jamais de code » reste une règle tenue à la main, pas un garde-fou.

## Étape 0 — La session est-elle seulement nécessaire ?

C'est l'économie la plus grosse : ne pas ouvrir la session. STOP si la réponse est ailleurs.

- Réponse dans la doc officielle → `lecteur-doc`.
- Réponse dans le repo → `explorateur`.
- **Décision déjà prise** → registre `DECISIONS.md`, puis `docs/decisions/` pour le détail.
  Rejuger une décision close est le gaspillage le plus fréquent, et le plus invisible.
- Choix d'un mécanisme Claude Code → `/choisir-mecanisme`.
- Question pointue sur Claude Code lui-même → agent `claude-code-guide`.

## Étape 1 — Écrire la question avant de réfléchir

Deux lignes, en clair, avant toute autre chose :

- **Question** : ce qui doit être tranché, formulé pour qu'une réponse soit reconnaissable.
- **Critère de fin** : ce qui, une fois écrit, clôt la session.

Une réflexion sans question écrite ne se termine pas : elle s'interrompt quand le contexte est plein.

## Étape 2 — Déléguer tout ce qui n'est pas un arbitrage

Avant d'ouvrir un fichier soi-même, se demander lequel des agents de délégation rend la conclusion voulue.
Opus lit **les conclusions**, pas les traces. Ce qu'il garde pour lui : le raisonnement, les
hypothèses racines, l'arbitrage final — le reste se délègue.

Ce qui se lit quand même en direct, parce que c'est court et structurant : le registre
`DECISIONS.md`, `PROJECT_BRIEF.md`, `ARCHITECTURE.md`.

## Étape 3 — Borner les options

Deux ou trois options, jamais un panorama. Pour chacune : ce qu'elle coûte, et ce qu'elle ferme.

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
| **Rien à faire** | la question tombe, ou le sujet attend | une ligne dans le registre, et on s'arrête |

Une session de réflexion qui ne produit aucun écrit n'a pas eu lieu : elle sera refaite.

**Committer et pousser l'écrit avant de rendre la main** — staging explicite du `docs/decisions/` et
de la ligne de registre, puis `git push` sur `main` (`WORKFLOW.md` §4b), session cloud comprise. Une
décision qui n'existe que sur ce poste ne sera pas lue par la session de plan qui devait s'en servir,
et c'est elle qu'on refera. Le cadrage est une unité de travail : il se clôt poussé.

**La décision écrite s'ouvre par ce qu'elle change, en clair.** Sa première section doit se tenir
seule : quelqu'un qui la lit dans six mois, sans le contexte de la session, doit comprendre ce qui a
été tranché et ce que ça implique avant d'atteindre la moindre justification technique. Le détail,
les alternatives et le raisonnement viennent après — c'est ce qui rend le fichier relisable au lieu
d'être archivé sans être rouvert.

## Interdits

- **Aucune modification de code ni de fichier de contexte** — Plan Mode (Shift+Tab) dès le début.
- **Aucune exploration en direct** dès que ça dépasse un fichier : c'est le travail d'`explorateur`.
- **Aucun enchaînement de `/nouveau-plan` dans la même conversation.** Le cadrage repart à froid et
  lit la décision écrite à l'étape 5 — c'est précisément à ça qu'elle sert. Poser une pastille ou
  afficher la commande, comme `/fin-de-tache` (`WORKFLOW.md` §5b), avec la ligne « À régler AVANT de
  lancer » (§3) : le frontmatter de `/nouveau-plan` bascule le modèle sur Opus, jamais l'effort.
