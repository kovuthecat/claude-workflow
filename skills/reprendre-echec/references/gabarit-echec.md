# Gabarit — le rapport de passation

Annexe de `/reprendre-echec`, citée par `/orchestrer-plan`. Une session qui échoue écrit
ce fichier dans `plans/P<n>/S<k>.echec.md` **avant** de renvoyer son verdict.

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

Nature : <environnement | exécution | prémisse | filtre | interruption>
Tentatives : reprise=<n> enquete=<n>
Blocage : <le geste précis qui manque, en une ligne>
Mesure : <commit> · <commande qui la reproduit>
Auto : <oui · option <m> | non — écrite par l'enquête `OPTIONS`, ou par la session en échec elle-même (mêmes critères, C5)>
Premisse : <refutee · <preuve> — écrite par l'orchestrateur seulement, après `verificateur-premisse` (§9c) ; absente sinon>

## Tâche visée
<la tâche T<n>, en une ligne — pas le S<k>.md recopié>

## Où ça a cassé
<commande ou étape exacte, message d'erreur en 3 lignes maximum>
<environnement : la remédiation nommée — quoi ajouter à `permissions.allow`, quel outil manque,
 qui doit être présent — et le chemin du fichier d'incident déposé>

## Ce qu'il faudrait pour que ça passe
<exécution : ce qui n'a pas été essayé et pourquoi c'est la piste suivante ;
 prémisse : écris l'affirmation que **tu** as constatée, écrite de façon **falsifiable** — un fait
 qu'une lecture du dépôt confirme ou réfute (« le PDF a 32 titres », « parse.ts ne renvoie jamais
 null »), **à la forme affirmative** — jamais « X lève une exception — faux », qui se vérifie à
 l'envers —, jamais un jugement (« l'approche ne marche pas »). **Polarité, même sens que
 `verificateur-premisse`** : `REFUTEE` = ton constat est faux ; `CONFIRMEE` = ton constat est vrai,
 donc le plan est faux ; et ce qu'un cadrage devrait trancher>

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

Les lignes **mécaniques**, en tête, exactement ce format — les seules que l'orchestrateur lit
(`grep -m1`), comme il ne lit que `Bloquant :` d'une revue :

- `Nature :` — l'un de cinq mots : `environnement`, `exécution`, `prémisse` (les trois de
  `WORKFLOW.md` §9a), `filtre` (filtre de contenu — jamais repris à l'identique, toujours une
  question) et `interruption` (coupure par quota, écrite par l'orchestrateur à la collecte — ne
  consomme aucune reprise du budget, T5). Absente, l'orchestrateur suppose `exécution` ; présente
  mais hors de ces cinq mots, il pose une question plutôt que de deviner (T4, P10/S2).
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
- `Premisse : refutee · <preuve>` — écrite **seulement par l'orchestrateur**, après que
  `verificateur-premisse` a rendu `REFUTEE` (`/orchestrer-plan` action `verifier-premisse`, `orchestrer-plan/references/remediation.md`),
  jamais par la session en échec elle-même. Sa présence fait suivre la session la branche
  `exécution` plutôt que `verifier-premisse`, même si `Nature : prémisse` reste écrite telle quelle
  (T5, P10/S2) : la vraie cause est ailleurs que là où la session l'a cherchée.

**La prémisse est le seul champ qu'un tiers vérifie.** Une session en échec écrit ce qu'elle croit ;
une prémisse fausse arrête un plan entier. C'est pourquoi l'orchestrateur la fait confronter au
dépôt avant d'arrêter quoi que ce soit (`verificateur-premisse`, `/orchestrer-plan` action `verifier-premisse`) — et
pourquoi elle doit être écrite falsifiable. Une prémisse trop vague pour être vérifiée n'accélère
rien : elle renvoie l'utilisateur arbitrer un problème que personne n'a constaté.
