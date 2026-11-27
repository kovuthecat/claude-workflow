---
name: orchestrer-plan
description: Déroule un plan entier, vague après vague, sans rendre la main entre elles, jusqu'à épuisement, une décision qui appartient à l'utilisateur ou une validation humaine déclarée. À dérouler quand `plans/P<n>/index.md` est prêt.
---

# Orchestrer un plan

L'orchestrateur tourne en **Haiku · medium** (`WORKFLOW.md` §3) ; en Opus ou en Sonnet, le dire à
l'utilisateur au premier tour (il paie un modèle plus cher pour relayer un script). Le moteur
`prochaine-action.mjs` calcule l'état depuis les fichiers commités et fait lui-même les gestes
mécaniques. Deux gestes à toi : **lancer** l'agent qu'il rend, **collecter** son verdict.

## La boucle

`node plugin/bin/prochaine-action.mjs P<n> --appliquer` (vendoré : `node .claude/workflow/bin/prochaine-action.mjs P<n> --appliquer`).

- Les lignes `appliqué — …` sont des gestes **déjà faits et commités** (coche, revue, preuve N0, push,
  rapports obsolètes, `Remédiation Opus :`) : ne jamais les refaire.
- Puis l'action rendue : son `texte` se relaie tel quel quand c'est une annonce, une question ou un
  rapport ; ce qui suit la ligne « données de l'action » est pour toi. Exécuter le geste de la table,
  puis **rappeler le moteur**. Jamais d'improvisation entre deux appels, jamais un état deviné.
- Les options (`--premisse`, `--interruption … --agent`, `--valider-vague`, `--cloture-faite`) s'ajoutent à la même commande.
- Question `dependance-revue`, l'utilisateur choisit « lever le bloquant » et donne la décision écrite (`docs/decisions/…`) : lancer la commande de l'option, `--appliquer --lever-bloquant S<k> <décision>` ; le moteur écrit la levée dans la revue et la committe. Refus (code 2) : relayer le message, ne rien éditer à la main.
- Avant la première vague : régler d'abord un écart de version vendorée signalé par `SessionStart`.

## Interdits

- **Ne jamais ouvrir un `S<k>.md`** : l'`index.md`, `git log` et le `texte` du moteur suffisent.
- **Ne jamais lire un diff ni une sortie de build** : déléguer à `resumeur-git` (attendre sa notification avant de s'en servir, `WORKFLOW.md` §5).
- **Ne jamais corriger soi-même, ni reprendre une session en échec** ; `fork` interdit sans condition.
- **Ne jamais rendre la main sur un manque d'information** : le moteur cherche (`enqueter`,
  `verifier-premisse`) ; un arrêt n'est qu'une `question` à options (`WORKFLOW.md` §9c).
- **Ne jamais interpréter le rapport d'une session** : seule la ligne `VERDICT:` se lit.

## Table des actions

| Action rendue | Geste |
| --- | --- |
| `lancer` | Relayer `texte`. Puis un agent par session de `sessions`, dans l'ordre, **un seul à la fois**, arrêt au premier `FAIL` : appel « Session » ci-dessous ; collecter. Si `parallele: true` : « Vague parallèle » ci-dessous. |
| `attendre` | Plan `Parallèle : oui`, vague en vol : relayer `texte`, ne relancer aucune session de `sessions` ; à la notification de chaque agent, rappeler `--appliquer --collecter S<k>` (quel que soit le verdict). |
| `relire` | Un appel « Relecteur » par session de `sessions`, dans l'ordre rendu, chacun attendu (notification reçue) avant le suivant. |
| `verifier-premisse` | Appel « Vérificateur », puis rappeler avec `--premisse <CONFIRMEE\|REFUTEE\|INDECIDABLE> "<preuve>"` : le moteur écrit la ligne `Premisse :`. `REFUTEE` : déposer aussi un incident (`WORKFLOW.md` §9b, nature `prémisse`). `INDECIDABLE · comportementale` : même appel, preuve commençant par « comportementale ». |
| `reprendre` | `references/remediation.md` : canal court si ses trois conditions tiennent, sinon reprise à froid (`modele`, `option` déjà décidés). |
| `enqueter` | `references/remediation.md`, appel « Enquête ». |
| `relancer-interrompue` | `references/remediation.md`, bloc de relance après quota. |
| `transmettre` | `SendMessage` à `agent`, `message` tel quel. Échec : écrire `Agent : introuvable` dans le `.question.md` rendu, le committer, rappeler (le moteur rend alors `reprendre` avec un `prompt` : lancer l'agent à froid avec ce prompt). |
| `valider-n0` | Rendue seulement quand le moteur a lancé N0 et qu'il est rouge (résumé dans `texte`) : écrire `plans/P<n>/S<k>.echec.md` (`Nature : exécution`, `Tentatives : reprise=0 enquete=0`, `Blocage : N0 rouge — <résumé>`), le committer, rappeler. Jamais une preuve fabriquée. |
| `validation-humaine` | Relayer `texte`, rendre la main. Au « oui » : `--appliquer --valider-vague <w>`, qui écrit `· validée` et committe. |
| `question` | Relayer `texte` tel quel (options et recommandation comprises), rendre la main : **une seule question par arrêt**. Source `attente-reponse` : la réponse de l'utilisateur s'écrit dans la ligne `Réponse :` du `.question.md`, committer, rappeler (`transmettre`). |
| `cloturer` | Points 4 et 6 de `fin-de-tache/references/fin-de-plan.md` (jugement : verser le backlog des revues dans `TASKS.md`, ranger le contexte), les committer, puis relancer la commande `rappel` de l'action. |
| `fini` | Relayer `texte`, plus une ligne `subagent_tokens` par session et une par usage du canal court : le disque ne les porte pas. |

`pousser` n'est jamais rendue sous `--appliquer` : le moteur pousse, et abandonne lui-même un rebase en
conflit avant de rendre `question`. Action inconnue : `question` à option unique (« mettre à jour le
workflow ») et un incident (`WORKFLOW.md` §9b, nature `orchestration`).

## Appels d'agent

Sessions, reprises et enquêtes : sous-agent, **seule voie** (`WORKFLOW.md` §5b) ; `subagent_type: "fork"`
interdit ; jamais le `S<k>.md` recopié dans le prompt. **`isolation: "worktree"` interdit, sauf** sur un
`lancer` qui rend `parallele: true` (plan `Parallèle : oui`) : voir « Vague parallèle » ci-dessous. L'outil `Agent` n'a
pas de paramètre d'arrière-plan : tout agent part en arrière-plan et notifie à sa fin. **Après chaque
appel, attendre la notification de fin avant tout geste qui en dépend**, sans finir son tour tant qu'un
agent attendu tourne (`WORKFLOW.md` §5).

```
Agent({
  description: "P<n>/S<k>",
  subagent_type: <agent.subagent_type de la session>,
  model: <agent.model de la session>,
  effort: <agent.effort de la session>,
  prompt: "Lis ${CLAUDE_PLUGIN_ROOT}/EXECUTANT.md en entier avant ton premier geste : il porte les invariants de lancement.
Ouvre plans/P<n>/S<k>.md et exécute-le. Reste dans l'arbre de travail courant : n'ouvre AUCUN worktree.
Mode orchestré : `/fin-de-tache`, section Mode orchestré — ta dernière ligne est `VERDICT:`. Tu es
orchestrée : si l'outil Agent n'est pas disponible dans ton bac à sable, saute la relecture de session
(je la lance moi-même). Tout agent que tu lances part en arrière-plan et te notifie à sa fin : attends
cette notification avant tout geste qui en dépend, et ne finis pas ton tour tant qu'un agent attendu
tourne ; N0 (n0.mjs) s'exécute au premier plan, comme toute commande — aucune commande n'est détachée.
Aucune commande qui déclenche une demande d'autorisation (personne n'y répond en arrière-plan) : pas
de `rm`, pas de `cd … &&` (chemins relatifs à la racine), fichiers temporaires dans le dossier
scratchpad ou écrasés. Ta réponse finale CLÔT ton tour : ce qui
finit après elle n'est lu par personne, et « j'attends le rapport de l'agent » n'est pas un retour.
Un blocage se diagnostique avant de conclure (WORKFLOW.md §9a) : ce qui est à ta portée se corrige et
n'est pas un échec. En cas d'ÉCHEC, écris d'abord un rapport de passation dans plans/P<n>/S<k>.echec.md,
ligne `Nature :` comprise (gabarit : skill /reprendre-echec), puis renvoie son chemin.
Réponse finale en UNE ligne, exactement : VERDICT: PASS|FAIL|QUESTION · MOTIF: <une phrase> · RAPPORT: <chemin, ou ->"
})
```

```
Agent({
  description: "P<n>/S<k> revue",
  subagent_type: "relecteur-session",
  prompt: "Relis la session S<k> du plan P<n>, effort <effort rendu par `relire`>, mode orchestré, commits
présents (git log --grep \"P<n>/S<k>/\"). Fichiers sensibles touchés : <ceux que `texte` liste pour S<k>, ou aucun>.
Écris plans/P<n>/S<k>.revue.md toi-même, avec Reprises : <0 ou 1, rendu par `relire`>, puis rends tes deux lignes."
})
```

```
Agent({
  description: "P<n>/S<k> prémisse",
  subagent_type: "verificateur-premisse",
  prompt: "Vérifie cette affirmation contre le dépôt : « <l'affirmation, prise dans la section « Ce qu'il
faudrait pour que ça passe » du rapport, elle seule, telle quelle> ».
Réponse finale en UNE ligne, exactement : PREMISSE: CONFIRMEE|REFUTEE|INDECIDABLE · PREUVE: <une phrase>"
})
```

Agent introuvable (`Agent type '…' not found`) : repli `workflow:<nom>`, puis `general-purpose` (`model:
"sonnet"` pour le relecteur, `"haiku"` pour le vérificateur) avec le prompt « Lis `.claude/agents/<nom>.md`
et tiens ce rôle… » ; repli en échec aussi : incident.

**Relecteur** : lire les deux lignes rendues, jamais les trouvailles ; le moteur committe la revue, pose
`[x]!` et rend `question` si elle est incomplète. Aucun fichier déposé : écrire une `.revue.md` à
`Bloquant : 0`, `Couverture : en cours`, `Reprises : <reprise rendue>` — elle trace l'interruption sans
prétendre avoir relu.

## Vague parallèle (`lancer` avec `parallele: true`, plan `Parallèle : oui`)

L'interdit « jamais de worktree » ne vaut que pour `Parallèle : non` (`WORKFLOW.md` §5b). Un `lancer` qui
rend `parallele: false` et un `motifSerie` est une vague repassée en série : relayer le motif, geste ordinaire.

- **Un seul message** porte tous les appels `Agent` de `sessions`, chacun avec `isolation: "worktree"` et
  le `prompt` que le moteur rend pour elle, tel quel (pas le prompt de session ci-dessus).
- **Après chaque lancement** : `--appliquer --lancee S<k> --agent <identifiant>` (inscrit la session ; sans
  inscription, la collecte ne la retrouve pas).
- **À chaque notification de fin**, quel que soit le verdict : `--appliquer --collecter S<k>` (le moteur
  fusionne la copie dans `main`). Tant qu'une copie tourne, l'action rendue est `attendre`.
- **Conflit de fusion** : le moteur rend une `question`, relayée telle quelle ; l'orchestrateur ne résout jamais.
- **Coupure** (quota, watchdog) d'une session ou de toute la vague : `--appliquer --interruption S<k> --agent
  <identifiant>` pour **chacune** des sessions coupées.

## Collecter un verdict

Lire `VERDICT: … · MOTIF: … · RAPPORT: …` et rien d'autre, en gardant l'identifiant d'agent de
l'appel (canal court, `references/remediation.md`). Quel que soit le verdict, rappeler le moteur : il
recoupe par les commits, un `PASS` n'est jamais cru sur parole. `partial` (tours épuisés) = `FAIL`.

- **`QUESTION`** : la session s'est arrêtée sur un choix et a écrit `plans/P<n>/S<k>.question.md`
  (gabarit : `reprendre-echec/references/gabarit-question.md`). S'il porte `Agent : —`, y écrire
  l'identifiant gardé et committer, puis rappeler. Un arrêt n'est ni un échec ni une reprise : hors budget.
- **Sans `VERDICT:` ni commit** : `ListAgents` avant de conclure `FAIL` (un enfant qui tourne encore rend
  parfois `PASS`). Si le retour correspond à `/session limit|rate.?limit|\b429\b|terminated early|stalled|watchdog/i`,
  c'est une **coupure** (quota, ou sous-agent figé coupé par le watchdog), pas un `FAIL` : rappeler avec `--interruption S<k> --agent <identifiant>`
  (le moteur écrit et committe le rapport, puis rend `relancer-interrompue`).
- Verdict perdu ou `partial` hors quota : incident (`WORKFLOW.md` §9b, nature `orchestration`).
