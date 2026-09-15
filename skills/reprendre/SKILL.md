---
name: reprendre
description: Répondre à « où j'en étais ? » sur un projet laissé de côté, jusqu'à UNE prochaine action proposée. À dérouler en ouverture de session sur un projet dormant, ou si SessionStart signale un STATUS.md en retard.
model: sonnet
---

# Reprendre un projet

Le hook `SessionStart` **signale** la dérive (STATUS.md en retard de N commits, plafond dépassé) ;
il ne dit pas quoi faire ensuite. Cette skill comble ce trou, et rien d'autre : elle se termine par
une proposition d'action, pas par un état des lieux.

Le frontmatter bascule sur **Sonnet, effort `medium`** pour ce tour. Sortie : ≤ 10 lignes + 1 action.

**Coût borné, règle non négociable.** Une reprise qui relit le repo coûte plus cher que la tâche
qu'elle prépare. Donc : quatre fichiers courts lus en direct, tout le reste **délégué aux agents**
dont on ne garde que la conclusion (`WORKFLOW.md` §5). Ne jamais ouvrir le code ici.

## Étape 1 — Lire, dans cet ordre, et pas plus

1. **`STATUS.md`** — l'état de l'app tel qu'il était à la dernière écriture.
2. **`plans/P<n>/index.md`** du plan courant, s'il y en a un — l'avancement. **Le statut d'une tâche
   vit là et NULLE PART ailleurs** : ne pas aller le chercher dans les `S<k>.md` ni dans `TASKS.md`,
   ce qu'on y trouverait serait au mieux redondant, au pire faux.
3. **`TASKS.md`** — ce qui reste hors plan.
4. **`VALIDATION.md`** — **seulement s'il est non vide** : son contenu est du N2 humain en attente,
   c'est-à-dire une action pour l'utilisateur, pas pour la session.

Ne pas ouvrir : les `S<k>.md` (leur tour vient à l'exécution, pas ici), le registre `DECISIONS.md`,
`ARCHITECTURE.md`, `PROJECT_MAP.md`, le code. S'il faut savoir où vit quelque chose → `explorateur`.

## Étape 2 — Déléguer la lecture mécanique

Ce qu'il manque, c'est ce qui s'est passé **depuis** la dernière écriture de `STATUS.md`. Ça se
mesure, ça ne se devine pas :

```bash
git log -1 --format=%H -- STATUS.md     # dernier commit touchant STATUS.md
```

Passer l'intervalle `<sha>..HEAD` — plus `git status` si l'arbre de travail est sale — à
**`resumeur-git`**. Il rend une ligne par fichier changé et les signaux notables ; le diff brut ne
remonte jamais dans la conversation. Si un chemin ou une feature citée reste à localiser :
**`explorateur`**. Rien d'autre ne se délègue ici, et rien d'autre ne se lit.

## Étape 3 — Croiser, et signaler les écarts sans les gommer

Une incohérence est l'information la plus utile d'une reprise : c'est là que la mémoire du projet
a menti. On la **nomme**, on ne la répare pas en silence.

| Symptôme | Ce que ça veut dire | À proposer |
| --- | --- | --- |
| Commits depuis la dernière écriture de `STATUS.md` (résumé `resumeur-git`) | `STATUS.md` ne décrit plus l'état réel | mise à jour de `STATUS.md`, avant toute nouvelle tâche |
| Tâche `[~]`/en cours dans l'`index.md` sans commit ni diff correspondant | travail annoncé jamais fait, ou perdu | rouvrir la tâche, ou la repasser à faire |
| Diff non commité dans l'arbre de travail | session interrompue avant son commit, ou vague verrouillée en cours (`WORKFLOW.md` §4b) | `/fin-de-tache` §Fin de plan |
| `.claude/wave.lock` présent | vague parallèle jamais close | vérifier les sessions de la vague, puis clore |
| `plans/P<n>/S<k>.echec.md` présent | une session a échoué et n'a jamais été reprise | `/reprendre-echec <chemin>` — il passe avant toute nouvelle tâche |
| Plafond dépassé (signalé par le hook) | fichier de contexte relu et payé à chaque session | `/purge-contexte`, avant de reprendre |
| `VALIDATION.md` non vide | N2 en attente côté utilisateur | le lui rappeler, ne pas trancher à sa place |

## Étape 4 — Restituer en ≤ 10 lignes

Format imposé, une ligne par point, rien de plus :

- **But** : l'« Objectif d'ensemble » du plan courant **cité**, pas reformulé. Une reprise qui
  reformule le but le déplace ; c'est le premier endroit où un projet dérive sans que ça se voie.
- **État** : où en est l'app (1-2 lignes, depuis `STATUS.md` corrigé par le résumé git), **avec sa
  preuve**. La preuve qu'une tâche est livrée est un commit portant `Plan: P<n>/S<k>/T<m>` — pas un
  statut coché, pas un N0 vert, pas une phrase de bilan.
- **Plan courant** : `P<n>` — X/Y tâches faites, la prochaine session prête.
- **Écarts** : les incohérences de l'étape 3, une ligne chacune. Aucun écart → l'écrire.
- **Bloqué** : séparer ce qui attend **une personne** (N2 en attente, arbitrage, accès) de ce qui
  est bloqué **techniquement** (échec non repris, dépendance cassée). Les deux ne se débloquent pas
  par les mêmes moyens, et les confondre fait attendre l'utilisateur sur ce qui ne l'attend pas.

Pas de récapitulatif du projet, pas de rappel de ce que fait l'app : l'utilisateur le sait, il
demande où il en était.

## Étape 5 — UNE prochaine action, proposée puis validée

Une seule, la plus prioritaire, formulée en une phrase actionnable — jamais une liste d'options à
arbitrer, jamais un « on pourrait aussi ». Ordre de priorité :

1. Un écart bloquant (plafond dépassé, vague non close, diff non consolidé) → il passe d'abord.
2. `STATUS.md` faux → le remettre à jour avant d'ajouter du travail dessus.
3. La session suivante prête dans l'`index.md` → afficher la commande de son bandeau, ou poser la
   pastille (`/fin-de-tache` §Enchaînement) — **jamais l'exécuter dans cette conversation** : une
   session part toujours à froid (`WORKFLOW.md` §5b). Avec la pastille, joindre la ligne « À régler
   AVANT de lancer : modèle · effort » (`WORKFLOW.md` §3).
4. Plus de plan en cours → `/nouveau-plan`, ou `/cadrer` si le QUOI n'est pas tranché.

**Attendre le oui de l'utilisateur avant d'exécuter quoi que ce soit.** Cette skill ne code pas, ne
commite pas, et ne modifie ni `STATUS.md`, ni `TASKS.md`, ni un `index.md` : elle les lit et dit
lesquels mentent.
