# Rechercher l'existant avant de développer sur mesure

Annexe de `/cadrer` Étape 2, partagée avec `/nouveau-projet` Phase A et `/nouveau-plan` Étape 1 — à ouvrir avant de proposer un mécanisme neuf.

Rien n'organise la recherche d'une solution existante avant de prévoir un mécanisme custom (D8). Déclencheurs : mécanisme non trivial envisagé, dépendance à ajouter, problème courant, sous-système custom proposé.

## Sept pas

1. Capacité et contraintes réelles du besoin (pas la solution déjà imaginée).
2. Ce qui existe déjà dans le dépôt.
3. Ce qu'offre la stack en place (bibliothèque standard, outil déjà présent).
4. Candidats externes, bornés — 2 à 3, sans chercher à remplir le quota.
5. Qualification des preuves de chaque candidat : documenté, testé en amont (par qui, où), ou testé ici (à faire).
6. Coût total (intégration, maintenance, dette), pas seulement le coût d'ajout.
7. Conclusion — une des cinq issues ci-dessous.

## Cinq issues

**Réutiliser · configurer · adapter · développer · isoler** — la cinquième place l'inconnue derrière une couture nommée, pour que le reste du travail se découpe sans attendre qu'elle soit résolue.

## Format de sortie

```
Besoin et contraintes : …
Déjà disponible (dépôt / stack) : …
Candidats examinés : source · version/date · adéquation · limite déterminante
Preuves : documenté | testé en amont | testé ici — préciser le cas
Choix : réutiliser | configurer | adapter | développer | isoler
Écarté, et pourquoi : …
Inconnue ou essai nécessaire : …
Conséquence pour la décision / le plan : …
```

## Critère d'arrêt

Un candidat satisfait les contraintes obligatoires avec des preuves à la hauteur du risque, ou le budget annoncé est atteint → conclure « aucun candidat adapté dans ce périmètre », jamais « aucune solution n'existe ».

## Délégation

`explorateur` pour le dépôt (pas 2) ; `lecteur-doc` pour les candidats externes (pas 3-4) ; le parent (Opus dans `/cadrer`, sinon la skill appelante) compare et tranche l'issue.
