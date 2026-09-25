# Grille de préparation

Annexe de `/cadrer` Étape 1, partagée avec `/nouveau-projet` Phase B et `/nouveau-plan` Étape 1 — à ouvrir au moment de remplir la grille.

Rend visible ce qui est acquis et ce qui manque — et surtout **qui résout ce qui manque** : un agent, une sonde, l'humain, ou un geste hors dépôt. Empêche de poser à l'utilisateur une question dont la réponse est dans le dépôt.

## Forme (une ligne par dimension, à recopier telle quelle)

```
Dimension : <problème concret | résultat visé | vérification | périmètre | cohérence>
État : READY | OPEN
Preuve : <une phrase — artefact consultable (chemin, décision, demande explicite), ou le manque nommé>
Si OPEN — résolution : recherche (agent) | expérience (sonde, protocole de preuve) | décision (question §9c) | tâche (geste humain hors dépôt)
Validité : <fichiers / version / hypothèses dont dépend la preuve>
```

## Règles

- Jamais de score : `READY` ou `OPEN`, rien entre les deux.
- Un critère jugé par un humain est admis s'il **le dit** dans sa Preuve.
- Une dimension acquise en amont se cite par référence, ne se rouvre que si sa `Validité` a changé.
- Une `OPEN` de type `décision` interdit d'écrire le plan (règle de sortie).

## Où s'écrit l'état final

| Skill | Domicile |
| --- | --- |
| `/cadrer` | la décision écrite (Étape 5) |
| `/nouveau-projet` | la synthèse de Phase B |
| `/nouveau-plan` | le verdict d'Étape 1 |

## Exemple (cas neutre : migration d'un script CLI)

| Dimension | État | Preuve |
| --- | --- | --- |
| problème concret | READY | `docs/decisions/2026-08-01-cli-legacy.md` décrit la panne observée |
| résultat visé | READY | « même exit code, sans la dépendance X » — demande explicite |
| vérification | OPEN | aucun test sur le comportement actuel → tâche : test de caractérisation |
| périmètre | READY | un seul fichier concerné, cité par le demandeur |
| cohérence | OPEN | dépendance X peut-être utilisée ailleurs → recherche (`explorateur`) |
