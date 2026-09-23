---
name: reprendre-echec
description: Reprendre une session de plan en échec, à partir de son rapport de passation, jusqu'à relancer N0. Déroulée automatiquement par `/orchestrer-plan` après un FAIL (mode orchestré), en lecture seule pour chercher une hypothèse neuve (mode enquête), ou à la main pour une session arrêtée sans finir sa tâche.
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
  `VERDICT: PASS|FAIL|ENQUETE|DECISION · MOTIF: <une phrase> · RAPPORT: <chemin, ou ->` — rien après.
- **Les gates ne rendent plus la main en prose**, et elles ne se valent pas toutes
  (`WORKFLOW.md` §9c, domicile) :

  | Ce qui arrête la correction | Verdict | Pourquoi |
  | --- | --- | --- |
  | hypothèse épuisée, aucune autre en une passe (Étape 3) | `ENQUETE` | c'est un **manque d'information** : un humain à qui l'on rend la main ici lancera exactement l'enquête que l'orchestrateur sait lancer (Étape 5d) |
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
humain, c'est une entrée de l'Étape 5d tant que le budget de la session le permet
(`Tentatives :` du rapport). Le comptage appartient à l'orchestrateur, pas à cette skill : rendre
le verdict juste suffit.

## Mode enquête

Quand le prompt dit **« Mode enquête »**, la même skill tourne en **lecture seule** : elle ne
corrige rien, ne committe rien, ne lance pas N0. Elle n'a qu'un objet — remplacer une hypothèse
morte par une hypothèse vivante, ou constater qu'il n'y en a pas et nommer les issues.

C'est ce qu'un humain ferait en recevant le rapport, et c'est pour cela que ça ne lui est plus
demandé. L'enquête est bornée : **une passe**, pas de tentative de correction « pour voir », pas
de N0 lancé en passant.

1. Lire le `.echec.md` et la tâche concernée du `S<k>.md` (Étape 1). Rien d'autre en direct :
   ce qui manque se délègue à `explorateur` / `resumeur-git`.
2. Traiter **Déjà écarté** comme acquis, et l'**Hypothèse en cours** comme réfutée — c'est
   précisément parce qu'elle est tombée que cette enquête tourne. Chercher ailleurs.
3. **Écrire le `.echec.md` mis à jour en premier geste**, avant de répondre : « Déjà écarté »
   enrichi de l'hypothèse morte **avec la raison**, « Hypothèse en cours » réécrite, `Tentatives :`
   incrémentée sur `enquete`. Un agent qui épuise ses tours doit laisser un fichier, jamais un
   silence (même règle que `relecteur-session`, `docs/decisions/2026-09-12-revue-deposee-d-abord-et-collecte-patiente.md`).
4. Répondre **une seule ligne**, exactement :

```
ENQUETE: PISTE|OPTIONS · MOTIF: <une phrase> · RAPPORT: <chemin>
```

- **`PISTE`** — une hypothèse neuve, testable, dans le périmètre de la tâche d'origine. Le motif
  la nomme en une phrase ; le détail est dans le rapport, l'orchestrateur ne l'ouvre pas.
- **`OPTIONS`** — aucune hypothèse ne tient dans ce périmètre : le rapport gagne une section
  `## Issues` de **2 à 4 options**, chacune écrite **déjà au format de la question**
  (`/orchestrer-plan` Étape 3) — une ligne par option, exactement :
  `N. <option> — <coût> · débloque <ce que ça rouvre>`, numérotées à partir de 1, plus une
  recommandation. Exemple : `1. Committer la migration manquante, puis rejouer N0 — 5 min ·
  débloque la tâche T3`. L'orchestrateur recopie ces lignes sans rien reformuler : c'est pour ça
  qu'elles s'écrivent déjà dans ce format, pas dans un autre qu'il faudrait ensuite retoucher.
  C'est cette section qui devient la question posée à l'utilisateur (`/orchestrer-plan` Étape 6) —
  l'écrire pour quelqu'un qui n'a rien vu de la session.
  **Et une ligne mécanique en tête du rapport**, sous `Mesure :` : `Auto : oui · option <m>` si
  l'option recommandée est un correctif localisé (`WORKFLOW.md` §9a, les quatre conditions) ou un
  geste dans l'objectif inchangé du plan, réversible et jugé par la gate de la session ;
  `Auto : non` dès qu'elle étend l'objectif, touche l'irréversible, élargit une permission, ou
  qu'un jugement N2 départage les options. L'orchestrateur applique `oui` sans te demander (5d).

Ne jamais rendre `PISTE` sur une piste déjà présente dans « Déjà écarté » : ce serait faire
repayer le chemin que cette section existe pour épargner. Si tout ce qui vient est déjà écarté,
c'est `OPTIONS`.

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

**Budget en hypothèses (C5)** : jusqu'à 3 hypothèses **distinctes** testées en contexte chaud avant
de conclure à ce rapport, chacune inscrite dans « Déjà écarté » **au fil de l'eau** — au moment où
elle tombe, pas reconstituée après coup —, arrêt sur hypothèse répétée ou contexte > 70 %. C'est ce
budget, et non une impression de blocage, qui déclenche l'écriture du rapport.

Il est écrit pour quelqu'un qui n'a rien vu de la session. Il ne raconte pas ce qui s'est passé :
il donne ce qu'il faut pour reprendre. **Plafond : 40 lignes** — au-delà, c'est un journal, et un
journal se relit intégralement à chaque tentative. Seule exception : la section `## Issues` d'une
enquête `OPTIONS` (10 lignes au plus), qui n'est pas écrite pour une tentative suivante mais pour
l'utilisateur, une fois — elle vient en fin de fichier, après « Hypothèse en cours ».

Une fois écrit, le fichier est **commité et poussé** comme le reste du travail de la session
(`WORKFLOW.md` §4b, C3) — jamais un fichier local oublié sur un poste.

```md
# S<k> — échec du YYYY-MM-DD

Nature : <environnement | exécution | prémisse>
Tentatives : reprise=0 enquete=0
Blocage : <le geste précis qui manque, en une ligne>
Mesure : <commit> · <commande qui la reproduit>
Auto : <oui | non — écrite par l'enquête `OPTIONS`, ou par la session en échec elle-même (mêmes critères, C5)>

## Tâche visée
<la tâche T<n>, en une ligne — pas le S<k>.md recopié>

## Où ça a cassé
<commande ou étape exacte, message d'erreur en 3 lignes maximum>
<environnement : la remédiation nommée — quoi ajouter à `permissions.allow`, quel outil manque,
 qui doit être présent — et le chemin du fichier d'incident déposé>

## Ce qu'il faudrait pour que ça passe
<exécution : ce qui n'a pas été essayé et pourquoi c'est la piste suivante ;
 prémisse : l'hypothèse du plan qui tombe, écrite de façon **falsifiable** — un fait qu'une
 lecture du dépôt confirme ou réfute (« le PDF a 32 titres, pas 37 », « parse.ts ne renvoie
 jamais null »), **à la forme affirmative** — jamais « X lève une exception — faux », qui se
 vérifie à l'envers —, jamais un jugement (« l'approche ne marche pas ») ; et ce qu'un cadrage
 devrait trancher>

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

Trois lignes **mécaniques**, en tête, exactement ce format — les seules que l'orchestrateur lit
(`grep -m1`), comme il ne lit que `Bloquant :` d'une revue :

- `Nature :` — l'un des trois mots ; absente, l'orchestrateur suppose `exécution`.
- `Tentatives : reprise=<n> enquete=<n>` — le **budget déjà consommé** sur cette session
  (`WORKFLOW.md` §9c). La session en échec l'écrit à zéro ; ensuite, c'est la reprise ou l'enquête
  qui l'incrémente avant de rendre la main. Absente : l'orchestrateur suppose `reprise=0 enquete=0`.
  C'est cette ligne, et non un compte tenu en mémoire, qui empêche un plan de tourner en rond : une
  orchestration interrompue puis relancée retrouve le budget dans le fichier.
- `Blocage :` — un **geste** précis qui manque (un commit à prendre, un statut à poser, un fichier à
  écrire), pas une hypothèse à tester : une hypothèse va dans « Hypothèse en cours », et elle
  disqualifie le canal court. **Absente ⇒ démarrage à froid** — c'est le défaut sûr, et c'est l'une
  des trois conditions observables qui autorisent l'orchestrateur à reprendre par `SendMessage`
  plutôt qu'à froid (`WORKFLOW.md` §9c, domicile des trois conditions).
- `Mesure :` — **optionnelle**, seulement pour une `Nature : prémisse` dont la session a mesuré la
  fausseté et commité la mesure (script, fixture, résultat) : un commit **présent dans
  l'historique** et la commande qui rejoue la mesure. Absente → la prémisse est une affirmation,
  elle sera vérifiée (§9c). Présente → elle est une preuve, la vérification est sautée. Ne jamais
  l'écrire pour une mesure non commitée : l'orchestrateur ne lira pas la conversation.
- `Auto :` — écrite par l'enquête `OPTIONS` (Mode enquête, critère), **ou par la session en échec
  elle-même**, mêmes critères (C5) : `oui` fait appliquer l'option recommandée (ou le correctif
  qu'elle nomme) par une reprise, sans question ; absente vaut `non`.

**La prémisse est le seul champ qu'un tiers vérifie.** Une session en échec écrit ce qu'elle croit ;
une prémisse fausse arrête un plan entier. C'est pourquoi l'orchestrateur la fait confronter au
dépôt avant d'arrêter quoi que ce soit (`verificateur-premisse`, `/orchestrer-plan` 5c) — et
pourquoi elle doit être écrite falsifiable. Une prémisse trop vague pour être vérifiée n'accélère
rien : elle renvoie l'utilisateur arbitrer un problème que personne n'a constaté.

---

## Étape 1 — Lire le rapport, et seulement lui

Ouvrir `plans/P<n>/S<k>.echec.md`, puis le `S<k>.md` de la session **uniquement pour la tâche
concernée** (pas les autres tâches du fichier). Rien d'autre : ni l'`index.md` du plan, ni le code,
ni l'historique. Ce qui manque se délègue (`explorateur`, `resumeur-git`), on ne le lit pas ici.

Rapport absent ou vide (session tuée avant de l'écrire) → le dire, et repartir de la tâche du
`S<k>.md` comme si elle n'avait jamais été lancée, après avoir fait l'Étape 2 avec d'autant plus
de soin : c'est le cas où l'état laissé derrière est le moins connu.

**La ligne `Nature :` oriente la reprise avant tout diagnostic** (`WORKFLOW.md` §9a) :

- `prémisse` → **en mode orchestré, deux cas, jamais la ligne prise telle quelle sans regarder
  lequel** : (1) l'orchestrateur a fait vérifier l'affirmation (`verificateur-premisse`,
  `/orchestrer-plan` 5c) et n'a lancé cette reprise que parce qu'elle a été **réfutée** — le prompt
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
(Étape 5d) que l'utilisateur aurait lancée lui-même. Deux tentatives sur la même hypothèse coûtent
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
