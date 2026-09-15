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

## Le seul invariant à connaître hors skill

Un fichier listé dans `.claude/workflow/manifest.json` est **géré** : jamais modifié à la main dans
un projet. Une amélioration remonte au dépôt source (`Templates/plugin/`), est versionnée
(`plugin.json` + `CHANGELOG.md`), puis redescend par `/maj-workflow`.
