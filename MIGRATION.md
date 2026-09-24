# MIGRATION.md — remplacé par la skill `/migrer-projet`

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

Une mise à jour ordinaire pour tout projet vendoré : les quatre agents `session-<effort>` arrivent
par `sync-workflow.mjs`, et chaque session tourne désormais à son effort écrit. **Réserve** : un
projet qui exporte `CLAUDE_CODE_EFFORT_LEVEL` dans son environnement gardera la variable
prioritaire sur le frontmatter des agents — le mécanisme y restera sans effet, sans erreur.

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
