# MIGRATION.md — remplacé par la skill `/migrer-projet`

## Vers 0.67.0

Synchroniser via `/maj-workflow`, puis lire ce qui suit. Rien d'autre à faire côté projet.

- **Plus de parallèle** : un plan qui porte « parallélisable » s'exécute en séquentiel, une session
  après l'autre. Le verrou de vague (`wave.lock`) n'existe plus.
- **Plus d'agents `session-<effort>`** : supprimés au prochain `/maj-workflow`. Le moteur porte
  l'effort directement dans l'appel d'agent.
- **`pastille` ignoré avec avertissement** : le mot n'arrête plus rien. Un plan ouvert qui le porte
  continue ; l'avertissement le signale. **ebm-msp-v2/P14** est le seul plan ouvert concerné (sessions
  S3 à S13, lignes « en clair » et bandeaux « conversation principale ») : ses arrêts passent désormais
  par l'arrêt relayé. Le plan n'a pas à être réécrit.
- **Commandes sans `cd`, gabarit de permissions élargi aux lectures seules** : vérifier
  `.claude/settings.json` au `/maj-workflow` ; il est signalé DÉRIVE s'il a été modifié localement.
- **Voie express** : un petit changement (moins de 150 lignes et 8 fichiers, hors dépendances,
  `n0.json` et zone d'un plan ouvert) se committe sans plan, avec la mention `Express :` dans le
  message ; un script en tient le bilan.

## Vers 0.48.0

Synchroniser le workflow via `/maj-workflow`. Les nouvelles sessions utilisent des listes
`- Lire : `chemin`` et `- Modifier : `chemin` (créer)` pour le vérificateur mécanique.
Les nouveaux index portent `Preuve N0 : requise` ; les anciens restent compatibles et ne
l'adoptent que sur décision explicite. En extension d'un ancien plan, lancer `verifier-plan.mjs`
avec `--extension` (les contrôles mécaniques restent actifs).
N0 final : `node .claude/workflow/bin/n0.mjs --session P<n>/S<k>` ; committer la preuve
`plans/P<n>/S<k>.n0.json` avec les fichiers validés. Tests ciblés : diagnostic seulement.
Revues : `Reprises : 0|1` et `Dépendances : bloquées|libres` ; champ de dépendances absent
avec bloquants = blocage conservateur. Les anciennes revues sans champ Couverture restent
lisibles ; `Couverture : en cours` ne vaut jamais revue terminée.


**Ce document est un renvoi, plus une procédure.** L'historique des migrations successives
(centralisation 2026-07-07 → plugin 2026-08-22 → vendoring 2026-08-24) vivait ici et décrivait, à la
fin, l'inverse du modèle courant : suivre l'ancienne Étape 5 recréait `enabledPlugins` et le double
chargement des skills que la bascule vendorée a précisément éliminés. Il a été retiré le 2026-08-25.

## Ce qu'il faut faire, selon le cas

| Situation | Faire |
| --- | --- |
| Projet neuf (repo vide) | `/nouveau-projet` — interview de cadrage puis instanciation complète |
| Projet existant, jamais outillé ou sous un ancien modèle (plugin, jonction, imports `@…`) | `/migrer-projet` — détecte le modèle en place, nettoie, vendorise |
| Projet déjà vendoré, en retard sur la source | `/maj-workflow` — synchronisation par manifeste |

Les trois skills sont vendorées dans `.claude/skills/` : elles fonctionnent depuis un simple clone,
sans rien installer.

## Vers 0.45.0

Rien à faire côté projet hors `/maj-workflow` : les changements sont l'orchestrateur, `WORKFLOW.md`
et le hook de racine, qui arrivent par la synchronisation. Un point à savoir : un **plan en cours**
dont l'index n'a pas de ligne `Clos :` recevra l'action `cloturer` (déroulement de `fin-de-plan.md`
par l'orchestrateur) à sa toute prochaine fin de plan — jamais retranché, jamais réécrit avant.

## Vers 0.41.0

Rien à faire côté projet hors `/maj-workflow` : les changements sont des textes de skills et deux
comportements de `prochaine-action.mjs`, qui arrivent par la synchronisation. Trois points à savoir :

- Un **plan en cours** dont l'orchestration s'appuyait sur l'ancien préflight délégué à
  `resumeur-git` se termine tel quel — le nouveau préflight (arbre sale rendu par le script) ne
  casse rien en route, il rend `question` au lieu de `lancer` si un fichier non commité intersecte
  la zone de la vague suivante.
- Les **rapports `.echec.md` existants** gardent leurs `## Issues` : l'orchestrateur les relaie
  telles quelles, sans les reformater.
- Un projet qui a déjà ses cinq hooks n'a rien à reprendre ; `/migrer-projet` les exigeait encore
  au nombre de quatre et pouvait déclarer complet un projet qui ne l'était pas — c'est le contrôle
  qui change, pas les hooks.

## Vers 0.40.0

Une mise à jour ordinaire pour tout projet vendoré : chaque session tourne désormais à son effort
écrit. *Remplacé ensuite (P20/S2) : les agents `session-<effort>` sont retirés, le champ `agent` du
moteur porte `{ subagent_type: "general-purpose", model, effort }` et l'effort se passe à l'outil
`Agent` — plus de réserve sur le frontmatter.*

## Vers 0.39.0

**À dire en tête, avant tout le reste** : un projet vendoré en ≤ 0.38.1 exécute encore l'ancien
hook `SessionStart`, sans contrôle de version (C4) — il ne se signalera pas de lui-même en retard.
La première `/maj-workflow` reste donc **manuelle** ; c'est elle, une fois passée, qui arme le
contrôle automatique pour les publications suivantes.

Une fois `/maj-workflow` déroulée sur un projet déjà vendoré :

1. Créer `.claude/n0.json` s'il n'existe pas (commandes reprises de `CLAUDE.md` § Commandes —
   jamais devinées, cf. `n0.mjs`) ; l'ajouter au commit.
2. Committer les `.revue.md` en attente : ils n'étaient jamais versionnés avant 0.39.0, le sont
   depuis (C3) — un `git status` après la synchronisation doit ne rien laisser hors du commit.
3. Pousser (`git pull --rebase` d'abord) : la règle « fin de tour = arbre propre et poussé » (C3)
   s'applique dès cette synchronisation.
4. Un plan déjà en cours (`plans/P<n>/index.md` non fini) reste sur la version de workflow qu'il a
   commencée — le finir tel quel, sauf correctif critique (`correctifCritiqueDepuis` du
   `plugin.json`) : ne pas rebasculer son outillage en cours de route.

## Le seul invariant à connaître hors skill

Un fichier listé dans `.claude/workflow/manifest.json` est **géré** : jamais modifié à la main dans
un projet. Une amélioration remonte au dépôt source (`Templates/plugin/`), est versionnée
(`plugin.json` + `CHANGELOG.md`), puis redescend par `/maj-workflow`.
