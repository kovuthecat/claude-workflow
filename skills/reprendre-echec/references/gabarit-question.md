# Gabarit — la question d'une session arrêtée sur un choix

Annexe de `EXECUTANT.md` et de `/orchestrer-plan` (action `transmettre`). Une session qui tombe sur
un **choix** qu'elle n'a pas reçu (les quatre critères d'arrêt de `EXECUTANT.md`) l'écrit dans
`plans/P<n>/S<k>.question.md`, le **committe**, puis rend `VERDICT: QUESTION`. Ce n'est pas un échec :
aucun `.echec.md`, aucune reprise ni enquête décomptée.

**Avant d'écrire, committer le travail en cours** (WIP de la tâche, repère `Plan: P<n>/S<k>/T<m>`) :
un arbre sale bloquerait tout le plan pendant l'attente. Le fichier lui-même est committé avec le
dernier WIP ou à part — jamais laissé non suivi.

Les lignes **mécaniques**, en tête, exactement ce format — les seules que le moteur lit
(`prochaine-action.mjs`), comme il lit celles d'un `.echec.md` :

```md
# S<k> — question du YYYY-MM-DD

Question : <une phrase, en français, qui se comprend sans avoir rien vu de la session>
Fichier à relire : <chemin du fichier que l'utilisateur doit lire pour répondre, ou —>
Agent : <ton identifiant d'agent, ou — si tu ne le connais pas>
Réponse : —

## Options
1. <option> — <coût> · débloque <ce que ça rouvre>
2. <option> — <coût> · débloque <ce que ça rouvre>

## Contexte
<deux lignes au plus : ce qui est fait, ce que la réponse décide>
```

- `Question :` — une phrase. Le moteur la rend telle quelle à l'utilisateur.
- `Fichier à relire :` — le fichier à lire avant de répondre (un pivot, une liste, un écran) ; `—` s'il
  n'y en a pas. Le moteur le rend avec la question.
- `Agent :` — **deux voies**. La session écrit son identifiant d'agent si elle le connaît. Elle ne le
  connaît pas toujours : elle écrit alors `Agent : —`, et l'**orchestrateur le complète à la collecte**
  du `VERDICT: QUESTION` (il le tient de l'appel `Agent` qui a lancé la session). Quand `SendMessage`
  échoue (agent introuvable, session fermée), l'orchestrateur remplace la valeur par
  `Agent : introuvable` et committe : le moteur rend alors une reprise à froid.
- `Réponse :` — `—` à l'écriture. **Remplie par l'orchestrateur** avec la réponse de l'utilisateur, puis
  committée : c'est ce qui fait passer le moteur de `question` à `transmettre`. Une réponse peut tenir
  sur plusieurs lignes (jusqu'à la première ligne vide).
- `## Options` — les lignes sont **recopiées** dans la question posée à l'utilisateur, une par option,
  numérotées. Vide : le moteur propose de répondre par écrit.
- `## Contexte` — deux lignes au plus, relayées sous le motif de l'arrêt.

**Après la réponse.** Reprise par message (`SendMessage`) : continuer avec la réponse, dans le même
contexte. Reprise à froid : lire ce fichier et sa `Réponse :`, reprendre depuis les commits déjà
faits. Dans les deux cas, **au `PASS` — et au `FAIL`, où un `.echec.md` prend le relais —, supprimer
`S<k>.question.md` par un commit** (comme un `.echec.md` résolu) ; une nouvelle question réécrit le
fichier (`Réponse : —`).

**Si l'outillage ne permet pas de supprimer** (aucun `git rm` dans les `permissions.allow` d'un projet : mesure
du scénario `arret-relaye`, 2026-10-15), le fichier reste en place sans rien casser : le moteur tient la question
pour consommée dès qu'un commit de tâche (`Plan: P<n>/S<k>/T<m>`) suit le commit de la réponse.

**Mesure de H1 (2026-10-15)** : la reprise par `SendMessage` après 30 min d'attente, depuis une conversation
reprise (`claude -p --resume`), **fonctionne** — la même session restitue ce qu'elle avait lu avant l'arrêt. Le
repli « reprise à froid qui lit la réponse » (`Agent : introuvable`) reste le seul recours quand l'envoi échoue.
