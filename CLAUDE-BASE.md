# CLAUDE-BASE.md

Règles communes à tous les projets — source unique, importée par le CLAUDE.md de chaque
projet ; ne pas copier. Chargé à **chaque** session : rester court.

## Règles générales

- Modifier le minimum de fichiers, garder le style existant, simplicité > cosmétique ; pas de
  refactor global, changement de stack ou dépendance sans validation (`CONVENTIONS.md`).
- **Cadrage uniquement** (pas de plan existant) : `PROJECT_BRIEF.md` (produit), `ARCHITECTURE.md`
  (écrans, UI), `DECISIONS.md` (registre, détail dans `docs/decisions/`), `PROJECT_MAP.md` (localisation).
- Instruction utile seulement sur un sous-ensemble de fichiers d'un projet → `.claude/rules/` de CE
  projet (règle scopée), pas une ligne ajoutée à `CLAUDE.md` (voir `CONVENTIONS.md`).

## Écrire pour qui décide

Le lecteur connaît son projet, pas le code : tout écrit (proposition, rapport, décision) dit
d'abord **ce que ça change et à quoi il le verra**, ensuite comment ; un terme technique s'explique
une fois ; une recommandation énonce son revers. Ce n'est pas un cours sur l'outil, et ce qui est
déjà écrit dans un fichier ne se recopie pas ici (`docs/decisions/2026-08-30-ecrire-pour-qui-decide.md`).

## Dépendances

Jamais de dépendance ajoutée seul : à trancher dans le plan (« Modifier »), sinon → **STOP**.

## Validation — trois niveaux

- **N0 auto (bloque le commit)** : `build` + `typecheck` + tests du périmètre — à créer si la tâche
  introduit de la logique testable ; `—` (aucun test) justifié dans le plan. Piège du typecheck qui
  ne compile aucun fichier : gabarit `CLAUDE.md`.
- **N1 visuel auto (non bloquant)** : erreurs console, contenu présent, 4xx/5xx, responsive —
  uniquement via le navigateur in-app de Desktop (`/verif-visuelle`) ; ailleurs, la skill sort une
  checklist à dérouler à la main.
- **N2 humain (non bloquant)** : jugement esthétique / UX / ton. Claude ne l'évalue pas, il le
  consigne dans `VALIDATION.md` — et **rien d'autre** n'y va.

Jamais de Playwright, de script de capture ni d'automatisation de navigateur hors outils in-app :
aucune régression visuelle scriptée dans ce workflow (`WORKFLOW.md` §6).

**La grille s'arrête à trois.** La relecture de fin de session (`/fin-de-tache`, agent
`relecteur-session`) est automatique, non bloquante, et **n'est pas un niveau** — dépôt et tri :
`docs/decisions/2026-09-07-revue-orpheline.md`.

En mode autonome : enchaîner les tâches (gate = N0), accumuler les points N2, rendre la main en fin de lot.

## Avant de coder

Plan court (max 5 lignes) : objectif, fichiers, étapes, risques. Déléguer plutôt que faire soi-même
(table des agents, règle du premier plan, `fork`, mémoire d'agent) — `WORKFLOW.md` §5. `/clear`
entre deux sessions, pour ne pas traîner le contexte de l'une dans l'autre (voie et mécanique §5b).

**Session de plan (`S<k>.md`) ?** Lire d'abord `${CLAUDE_PLUGIN_ROOT}/EXECUTANT.md`.

## Plans, modèles, garde-fous

Backlog : `TASKS.md`. Un plan = `plans/P<n>/` : `index.md` (orchestration, seul porteur des
statuts) + un `S<k>.md` par session (`/nouveau-plan`). Grille modèle/effort, validation, commits,
plafonds : `${CLAUDE_PLUGIN_ROOT}/WORKFLOW.md`. Quatre hooks les appliquent (git, contexte, plafonds,
format) — ce ne sont pas des conseils, ils refusent l'action ; dépassement → `/purge-contexte`.
La mémoire automatique de Claude Code ne porte jamais un état de projet : `STATUS.md` et
l'`index.md` font foi, un souvenir qui les contredit est périmé.

## Échecs et incidents

Une tâche qui casse se **diagnostique avant de conclure**, jamais un `FAIL` sur symptôme : nature
`environnement` / `exécution` / `prémisse`, chacune sa réponse et sa reprise — `WORKFLOW.md` §9a
(domicile). Rapport `plans/P<n>/S<k>.echec.md`, ligne `Nature :` (gabarit `/reprendre-echec`).

**Le workflow lui-même a cassé** (hook, permission, outil absent, verdict perdu, revue non
déposée) → fichier `docs/workflow/incidents/<date>-<slug>.md` (gabarit `WORKFLOW.md` §9b), commité
avec la tâche. C'est le seul canal qui remonte au dépôt source — ni `TASKS.md`, ni la conversation.

**Fin de tâche** : dérouler la skill `/fin-de-tache`.

## Compactage

Préserver : décisions et leur justification, chemins modifiés, résultats de validation N0/N1,
tâches du plan restant à faire. Élaguer : exploration, fausses pistes, sorties de commandes,
contenu déjà sur disque (il se relit). En session `/cadrer`, question et critère de fin survivent
toujours au compactage.
