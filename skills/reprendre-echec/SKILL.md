---
name: reprendre-echec
description: Reprendre une session de plan en échec, à partir de son rapport de passation, jusqu'à relancer N0. Déroulée dans un sous-agent lancé par `/orchestrer-plan` après un FAIL (mode orchestré), jamais par l'orchestrateur lui-même — en lecture seule pour chercher une hypothèse neuve (mode enquête), ou à la main pour une session arrêtée sans finir sa tâche.
model: sonnet
---

# Reprendre une session en échec

Une session qui échoue rend la main sans corriger (règle de `/orchestrer-plan`). Cette skill est
ce qui vient après : elle transforme un rapport de passation en correction validée.

**Démarrage à froid, toujours.** Ne jamais reprendre la conversation de la session en échec pour
la réparer : elle traîne toutes ses fausses pistes, et c'est justement ce que le rapport de
passation existe pour éviter (`WORKFLOW.md` §5b). Le rapport est la seule entrée normale.

Pour la même raison, **jamais de sous-agent `fork` ici** : un fork hérite de toute la conversation,
c'est-à-dire précisément des fausses pistes qu'on veut laisser derrière. Le seul contexte légitime
d'une reprise est le rapport de passation.

## Mode orchestré

Quand le prompt de lancement dit **« Mode orchestré »**, cette skill tourne dans un sous-agent
frais lancé par `/orchestrer-plan` (action `reprendre`), qui attend une ligne de verdict pour enchaîner ou
arrêter le plan. Même procédure, trois différences :

- **Réponse finale en une ligne, exactement** :
  `VERDICT: PASS|FAIL|ENQUETE|DECISION · MOTIF: <une phrase> · RAPPORT: <chemin, ou ->` — rien après.
- **Les gates ne rendent plus la main en prose**, et elles ne se valent pas toutes
  (`WORKFLOW.md` §9c, domicile) :

  | Ce qui arrête la correction | Verdict | Pourquoi |
  | --- | --- | --- |
  | hypothèse épuisée, aucune autre en une passe (Étape 3) | `ENQUETE` | c'est un **manque d'information** : un humain à qui l'on rend la main ici lancera exactement l'enquête que l'orchestrateur sait lancer (action `enqueter`) |
  | `FAIL` après correction, N0 toujours rouge (Étape 4) | `FAIL` | l'orchestrateur décide de la suite d'après le budget de la session ; il n'y a rien à demander ici |
  | annulation destructive (Étape 2) | `DECISION` | irréversible : migration jouée, données écrites, artefact publié |
  | prémisse de plan **confirmée** fausse (Étape 3) | `DECISION` | le périmètre change — étendre, réduire ou abandonner est un arbitrage, pas un diagnostic |
  | remédiation d'environnement qui élargit les permissions ou exige un humain présent (Étape 1) | `DECISION` | ce n'est pas au workflow d'élargir ce que l'utilisateur a borné |

  Le motif dit laquelle. Le `.echec.md` mis à jour reste en place dans tous les cas sauf `PASS`.
- **Le modèle et le budget viennent de `prochaine-action.mjs` (C2)** — la table nature → modèle et
  le calcul des tentatives restantes y sont câblés, pas ici. L'orchestrateur les applique sans les
  recalculer ; le `model` de ce frontmatter ne s'applique qu'à l'invocation manuelle.

**Une tentative, ici comme en manuel** — ne pas boucler pour éviter de rendre un mauvais verdict.
Ce qui a changé le 2026-09-13, c'est ce qui suit la tentative : `FAIL` n'est plus un cul-de-sac
humain, c'est une entrée de l'action `enqueter` tant que le budget de la session le permet
(`Tentatives :` du rapport). Le comptage appartient à l'orchestrateur, pas à cette skill : rendre
le verdict juste suffit.

## Mode enquête

Quand le prompt dit **« Mode enquête »**, la même skill tourne en **lecture seule**, une passe
bornée qui remplace une hypothèse morte par une hypothèse vivante ou nomme les issues — annexe :
`references/mode-enquete.md`.

---

## Gabarit — le rapport de passation

Une session qui échoue écrit `plans/P<n>/S<k>.echec.md` **avant** de renvoyer son verdict, au
gabarit exact et aux lignes mécaniques qu'`/orchestrer-plan` lit — annexe :
`references/gabarit-echec.md`.

---

## Étape 1 — Lire le rapport, et seulement lui

Ouvrir `plans/P<n>/S<k>.echec.md`, puis le `S<k>.md` de la session **uniquement pour la tâche
concernée** (pas les autres tâches du fichier). Point de départ, pas un plafond : la lecture reste
ouverte pour diagnostiquer (`EXECUTANT.md`) — ni l'`index.md` du plan ni le code ne sont interdits
en soi, seule l'écriture reste bornée à la zone de la tâche. Ce qui demande de balayer plusieurs
fichiers ou l'historique se délègue (`explorateur`, `resumeur-git`) plutôt que de se lire en direct.

Rapport absent ou vide (session tuée avant de l'écrire) → le dire, et repartir de la tâche du
`S<k>.md` comme si elle n'avait jamais été lancée, après avoir fait l'Étape 2 avec d'autant plus
de soin : c'est le cas où l'état laissé derrière est le moins connu.

**La ligne `Nature :` oriente la reprise avant tout diagnostic** (`WORKFLOW.md` §9a) :

- `prémisse` → **en mode orchestré, deux cas, jamais la ligne prise telle quelle sans regarder
  lequel** : (1) l'orchestrateur a fait vérifier l'affirmation (`verificateur-premisse`,
  `/orchestrer-plan` action `verifier-premisse`) et n'a lancé cette reprise que parce qu'elle a été **réfutée** — le prompt
  de lancement porte alors la preuve. Traiter la session comme une nature `exécution`, en partant de
  cette preuve : la vraie cause est ailleurs que là où la session l'a cherchée. (2) le prompt de
  lancement porte `Nature : prémisse` + `Auto : oui · option <m>` : la prémisse **n'a pas été
  vérifiée** — `remedier()` a fait passer l'option avant la nature (C5). Appliquer l'option <m> de
  la section `## Issues` du rapport, ne jamais la présumer réfutée. En invocation **manuelle**, à
  l'inverse, la prémisse n'a été vérifiée par personne : la confronter au dépôt (déléguer à
  `explorateur`) avant de conclure quoi que ce soit, et n'aiguiller vers `/nouveau-plan` Étape 0 que
  si elle tient. `Mesure :` présente → partir de la mesure, pas de l'hypothèse.
- `environnement` → vérifier que la remédiation nommée est acquise ici (permission héritée, outil
  présent, humain là) **avant** l'Étape 2. Si elle ne l'est pas :
  - **à portée dans l'arbre du projet** — dossier manquant, dépendance non installée, arbre en
    retard, artefact à regénérer : l'appliquer et continuer. C'est exactement ce que la règle
    « à portée → corriger et continuer » (§9a) dit à une session ; une reprise n'a pas moins de
    droits qu'elle, et l'héritage d'environnement est la raison même pour laquelle elle tourne ici.
  - **hors de portée** — une permission à élargir dans `.claude/settings.json`, un outil absent du
    bac à sable, un humain requis : `VERDICT: DECISION`, motif = la remédiation nommée, telle
    quelle. Ce n'est pas au workflow d'élargir ce que l'utilisateur a borné, et corriger du code ne
    servirait à rien. **Plus de `FAIL` ici** : un `FAIL` laisse croire à un problème de code et
    déclenche une enquête qui ne trouvera rien.
- `exécution` (ou ligne absente) → Étapes 2 à 5, comme ci-dessous.

## Étape 2 — Vérifier l'état réel avant de toucher à quoi que ce soit

Le rapport dit ce que la session **croyait** avoir laissé. Le constater :

- `git status` — l'arbre correspond-il à la section « État laissé derrière » ?
- Un écart entre les deux est en soi un signal : la session s'est arrêtée plus tôt ou plus tard
  qu'elle ne le pense.
- Si le rapport signale quelque chose à annuler, le faire **maintenant**, avant tout diagnostic.
- `.claude/wave.lock` présent → la vague n'est pas close ; ne pas la clore ici, c'est le rôle de
  `/fin-de-tache`.

**Gate** : si l'état à annuler dépasse un `git checkout` d'un fichier (migration jouée, données
écrites, artefact publié), **s'arrêter et rendre la main** (mode orchestré : `VERDICT: DECISION`,
motif = quoi annuler, et ce que ça détruit) — une annulation destructive se décide, elle ne
s'improvise pas dans une reprise. C'est la gate la moins discutable des trois : elle est
irréversible, et aucune enquête ne la rendra réversible.

## Étape 3 — Diagnostiquer sans refaire le chemin

Partir de **Hypothèse en cours**, et traiter **Déjà écarté** comme acquis : ne pas réexplorer une
piste invalidée sans une raison explicite de douter de son invalidation. Le dire si on en a une.

**Aiguillage avant de corriger.** Le diagnostic peut montrer que ce n'est pas la tâche qui a raté,
mais une hypothèse du plan qui est fausse : vérité de référence erronée, contrat à changer, mesure
qui contredit l'attendu d'une gate. Un défaut mesuré qu'un correctif localisé lève (`WORKFLOW.md`
§9a) **n'en est pas un** : corriger à l'Étape 4, sans extension.

**Amendement avant extension (C5).** Avant de rendre la main vers `/nouveau-plan`, vérifier si la
prémisse tombée qualifie pour un amendement plutôt qu'une extension : **mesure commitée** de sa
fausseté, objectif du plan **inchangé**, remède **dans la zone** de la tâche d'origine, aucun
critère d'arrêt de C5 déjà touché (budget d'hypothèses non épuisé, pas de répétition). Les quatre
tenues ⇒ ce n'est ni une reprise à l'identique ni une extension : écrire l'amendement dans « Écarts
au plan » du `S<k>.md` (commit séparé, repère `Amendement :`), puis continuer directement à
l'Étape 4 — le relecteur juge après, `VERDICT: PASS` normal en sortie.

**Une des quatre conditions manque** : ce n'est alors pas une reprise — le périmètre de la tâche
d'origine ne suffit pas. Rendre la main vers **`/nouveau-plan`, Étape 0 (mode extension)** (mode
orchestré : `VERDICT: DECISION`, motif « prémisse fausse → /nouveau-plan extension ») : la
correction devient une ou deux sessions ajoutées au **même** plan, pas un plan suivant dont
dépendrait celui-ci. Laisser le `.echec.md` en place et à jour : c'est l'entrée du cadrage.
**Écrire la prémisse falsifiable** dans le rapport avant de rendre ce verdict : c'est elle que
l'utilisateur arbitrera, et c'est elle que la prochaine vérification confrontera au dépôt.

Si l'hypothèse tombe et qu'aucune autre ne se présente en une passe : ne pas s'entêter. Écrire un
rapport de passation **mis à jour** (même gabarit, section « Déjà écarté » enrichie de ce qui vient
d'être invalidé, `Tentatives :` incrémentée sur `reprise`) et rendre la main — mode orchestré :
`VERDICT: ENQUETE`, motif « hypothèse épuisée : <ce qui vient de tomber> ». **Ce n'est pas une
demande d'arbitrage** : c'est un manque d'information, et l'orchestrateur lancera l'enquête
(action `enqueter`) que l'utilisateur aurait lancée lui-même. Deux tentatives sur la même hypothèse coûtent
plus qu'une enquête en lecture seule.

## Étape 4 — Corriger, puis prouver

1. Corriger — périmètre de la tâche d'origine, **plus le correctif localisé** (`WORKFLOW.md` §9a :
   cause mesurée, remède petit, réversible, jugé ; commit séparé) et l'option `Auto : oui` quand le
   prompt de lancement la nomme. Une correction qui déborde **sans
   servir le plan** est une nouvelle tâche : la noter dans `TASKS.md`, ne pas la faire ici. Si elle
   déborde **en servant le plan**, c'est l'aiguillage de l'Étape 3 : `/nouveau-plan` en extension.
2. **N0** : `node .claude/workflow/bin/n0.mjs` (`build` + `typecheck` + tests du périmètre) — un
   script, pas un agent (C1), lancé **au premier plan** comme toute commande : c'est son verdict qui
   décide de committer à l'Étape 5, et une reprise qui rend la main avant de le lire consomme son
   budget (`Tentatives :`) pour rien. Sans N0 vert, la session est toujours en échec — on ne remonte
   pas un PASS sur une intuition.
3. La tâche touchait l'UI → `/verif-visuelle` pour le N1.

## Étape 5 — Clore l'échec

1. **Supprimer `plans/P<n>/S<k>.echec.md`** : le problème est résolu, le rapport devient faux. Git
   garde la trace (`STATUS.md` §Ce qui casse ne porte que l'actuel).
2. Passer la session à `[x]` dans l'`index.md` du plan, avec la date — statut à un seul endroit
   (`WORKFLOW.md` §4a).
3. Dérouler `/fin-de-tache` pour la suite (contexte, N2, enchaînement).

Échec **non** résolu → laisser le `.echec.md` à jour en place — `Tentatives :` incrémentée sur
`reprise`, « Déjà écarté » enrichie de la correction qui vient d'être tentée **et de sa raison
d'échouer** —, la session non cochée, et dire explicitement ce qui bloque (mode orchestré :
`VERDICT: FAIL`, motif en une phrase). Un échec mal fermé se repaie au plan suivant ; et en mode
orchestré, « Déjà écarté » est ce que l'enquête suivante traitera comme acquis — la bâcler, c'est
faire repayer le chemin.
