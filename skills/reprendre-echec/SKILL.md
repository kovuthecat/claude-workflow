---
name: reprendre-echec
description: Reprendre une session de plan en échec, à partir de son rapport de passation, jusqu'à relancer N0. Déroulée automatiquement par `/orchestrer-plan` après un FAIL (mode orchestré), ou à la main pour une session arrêtée sans finir sa tâche.
model: sonnet
---

# Reprendre une session en échec

Une session qui échoue rend la main sans corriger (règle de `/orchestrer-plan`). Cette skill est
ce qui vient après : elle transforme un rapport de passation en correction validée.

**Démarrage à froid, toujours.** Ne jamais reprendre la conversation de la session en échec pour
la réparer : elle traîne toutes ses fausses pistes, et c'est justement ce que le rapport de
passation existe pour éviter (`WORKFLOW.md` §5b). Le rapport est la seule entrée normale.
`claude --resume <uuid>` (identifiant dans `.claude/vague/S<k>.session`) reste un **recours**, à
n'ouvrir que si le rapport s'avère insuffisant — et à refermer sans y corriger quoi que ce soit.

Pour la même raison, **jamais de sous-agent `fork` ici** : un fork hérite de toute la conversation,
c'est-à-dire précisément des fausses pistes qu'on veut laisser derrière. Le seul contexte légitime
d'une reprise est le rapport de passation.

## Mode orchestré

Quand le prompt de lancement dit **« Mode orchestré »**, cette skill tourne dans un sous-agent
frais lancé par `/orchestrer-plan` (Étape 5c), qui attend une ligne de verdict pour enchaîner ou
arrêter le plan. Même procédure, trois différences :

- **Réponse finale en une ligne, exactement** :
  `VERDICT: PASS|FAIL|ARBITRAGE · MOTIF: <une phrase> · RAPPORT: <chemin, ou ->` — rien après.
- **Les gates rendent `ARBITRAGE`** au lieu de rendre la main en prose : annulation destructive
  (Étape 2), prémisse de plan fausse (Étape 3, aiguillage `/nouveau-plan`), hypothèse épuisée
  (Étape 3). Le motif dit laquelle ; le `.echec.md` mis à jour reste en place.
- **Le modèle vient de l'orchestrateur**, choisi d'après la ligne `Nature :` du rapport
  (`WORKFLOW.md` §9a) : même modèle pour un échec d'environnement, un cran au-dessus (plancher
  Sonnet) pour un échec d'exécution, aucune reprise pour une prémisse fausse. Le `model` de ce
  frontmatter ne s'applique qu'à l'invocation manuelle.

`FAIL` en mode orchestré = correction tentée mais N0 toujours rouge : c'est le deuxième échec
consécutif de la session, l'orchestrateur ne relance jamais — la suite est humaine. Une seule
tentative ici comme en manuel : ne pas boucler pour éviter de rendre un mauvais verdict.

---

## Gabarit — le rapport de passation

> Cette section est la référence citée par `/orchestrer-plan`. Une session qui échoue écrit
> ce fichier dans `plans/P<n>/S<k>.echec.md` **avant** de renvoyer son verdict.

**Avant d'écrire : diagnostiquer, pas seulement constater** (`WORKFLOW.md` §9a, domicile). La
session nomme la nature de l'échec, et n'écrit ce rapport que si l'échec n'est pas à sa portée :

- **environnement** à portée (arbre en retard, dossier manquant, commande mal documentée…) →
  corriger, continuer, et noter l'incident (§9b) — pas de rapport d'échec ;
- **exécution** → une correction sur l'hypothèse principale, N0 juge ; encore rouge → rapport,
  la tentative dans « Déjà écarté » ;
- **prémisse** ou **environnement** hors de portée → rapport tout de suite, sans corriger.

Il est écrit pour quelqu'un qui n'a rien vu de la session. Il ne raconte pas ce qui s'est passé :
il donne ce qu'il faut pour reprendre. **Plafond : 40 lignes** — au-delà, c'est un journal, et un
journal se relit intégralement à chaque tentative.

```md
# S<k> — échec du YYYY-MM-DD

Nature : <environnement | exécution | prémisse>

## Tâche visée
<la tâche T<n>, en une ligne — pas le S<k>.md recopié>

## Où ça a cassé
<commande ou étape exacte, message d'erreur en 3 lignes maximum>
<environnement : la remédiation nommée — quoi ajouter à `permissions.allow`, quel outil manque,
 qui doit être présent — et le chemin du fichier d'incident déposé>

## Ce qu'il faudrait pour que ça passe
<exécution : ce qui n'a pas été essayé et pourquoi c'est la piste suivante ;
 prémisse : l'hypothèse du plan qui tombe, et ce qu'un cadrage devrait trancher>

## État laissé derrière
- Fichiers modifiés non commités : <liste, ou « aucun »>
- Migration/build/artefact à demi fait : <oui, quoi — ou « non »>
- **Faut-il annuler quelque chose avant de reprendre ?** <oui/non, quoi>

## Déjà écarté
<les pistes explorées et invalidées, une ligne chacune, AVEC la raison.
 C'est la section qui a le plus de valeur : elle évite de refaire le chemin.>

## Hypothèse en cours
<la cause la plus probable au moment de l'arrêt, et ce qui la confirmerait>
```

La section **Déjà écarté** est la raison d'être du rapport. Un verdict d'une ligne fait recommencer
l'enquête à zéro ; ces lignes-là sont ce qu'on a payé pour apprendre.

La ligne `Nature :` est **mécanique** : troisième ligne du fichier, exactement ce format, l'un des
trois mots. C'est la seule ligne que l'orchestrateur lit (`grep -m1 '^Nature :'`) pour choisir la
reprise — comme il ne lit que `Bloquant :` d'une revue. Absente : l'orchestrateur suppose
`exécution`.

---

## Étape 1 — Lire le rapport, et seulement lui

Ouvrir `plans/P<n>/S<k>.echec.md`, puis le `S<k>.md` de la session **uniquement pour la tâche
concernée** (pas les autres tâches du fichier). Rien d'autre : ni l'`index.md` du plan, ni le code,
ni l'historique. Ce qui manque se délègue (`explorateur`, `resumeur-git`), on ne le lit pas ici.

Rapport absent ou vide (session tuée avant de l'écrire) → le dire, et repartir de la tâche du
`S<k>.md` comme si elle n'avait jamais été lancée, après avoir fait l'Étape 2 avec d'autant plus
de soin : c'est le cas où l'état laissé derrière est le moins connu.

**La ligne `Nature :` oriente la reprise avant tout diagnostic** (`WORKFLOW.md` §9a) :

- `prémisse` → ne pas reprendre : c'est l'aiguillage de l'Étape 3 dès maintenant (mode orchestré :
  `VERDICT: ARBITRAGE`, motif « prémisse fausse → /nouveau-plan extension »). La session a déjà fait
  le diagnostic ; le refaire est ce que cette ligne existe pour éviter.
- `environnement` → vérifier que la remédiation nommée est acquise ici (permission héritée, outil
  présent, humain là) **avant** l'Étape 2 ; si elle ne l'est pas non plus, `FAIL` immédiat avec la
  même remédiation — corriger du code ne servirait à rien.
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
écrites, artefact publié), **s'arrêter et rendre la main** (mode orchestré : `VERDICT: ARBITRAGE`)
— une annulation destructive se décide, elle ne s'improvise pas dans une reprise.

## Étape 3 — Diagnostiquer sans refaire le chemin

Partir de **Hypothèse en cours**, et traiter **Déjà écarté** comme acquis : ne pas réexplorer une
piste invalidée sans une raison explicite de douter de son invalidation. Le dire si on en a une.

**Aiguillage avant de corriger.** Le diagnostic peut montrer que ce n'est pas la tâche qui a raté,
mais une hypothèse du plan qui est fausse : vérité de référence erronée, contrat à changer, mesure
qui contredit l'attendu d'une gate. Ce n'est alors pas une reprise — le périmètre de la tâche
d'origine ne suffit pas. Rendre la main vers **`/nouveau-plan`, Étape 0 (mode extension)** (mode
orchestré : `VERDICT: ARBITRAGE`, motif « prémisse fausse → /nouveau-plan extension ») : la
correction devient une ou deux sessions ajoutées au **même** plan, pas un plan suivant dont
dépendrait celui-ci. Laisser le `.echec.md` en place et à jour : c'est l'entrée du cadrage.

Si l'hypothèse tombe et qu'aucune autre ne se présente en une passe : ne pas s'entêter. Écrire un
rapport de passation **mis à jour** (même gabarit, section « Déjà écarté » enrichie de ce qui vient
d'être invalidé) et rendre la main (mode orchestré : `VERDICT: ARBITRAGE`, motif « hypothèse
épuisée »). Deux tentatives sur la même hypothèse coûtent plus qu'un cadrage (`/cadrer`).

## Étape 4 — Corriger, puis prouver

1. Corriger — périmètre de la tâche d'origine, rien de plus. Une correction qui déborde **sans
   servir le plan** est une nouvelle tâche : la noter dans `TASKS.md`, ne pas la faire ici. Si elle
   déborde **en servant le plan**, c'est l'aiguillage de l'Étape 3 : `/nouveau-plan` en extension.
2. **N0** : `build` + `typecheck` (+ tests du périmètre) via `verificateur-n0`, lancé **au premier
   plan** (`WORKFLOW.md` §5) — jamais en arrière-plan en attendant sa notification :
   c'est son verdict qui décide de committer à l'Étape 5, une reprise qui rend la main avant de le
   lire compte, pour l'orchestrateur, comme un deuxième échec silencieux. Sans N0 vert, la session
   est toujours en échec — on ne remonte pas un PASS sur une intuition.
3. La tâche touchait l'UI → `/verif-visuelle` pour le N1.

## Étape 5 — Clore l'échec

1. **Supprimer `plans/P<n>/S<k>.echec.md`** : le problème est résolu, le rapport devient faux. Git
   garde la trace (`STATUS.md` §Ce qui casse ne porte que l'actuel).
2. Passer la session à `[x]` dans l'`index.md` du plan, avec la date — statut à un seul endroit
   (`WORKFLOW.md` §4a).
3. Dérouler `/fin-de-tache` pour la suite (contexte, N2, enchaînement).

Échec **non** résolu → laisser le `.echec.md` à jour en place, la session non cochée, et dire
explicitement ce qui bloque (mode orchestré : `VERDICT: FAIL`, motif en une phrase). Un échec mal
fermé se repaie au plan suivant.
