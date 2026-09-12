# DESIGN_SPEC.md

Brief UI du projet : écrans, navigation, données affichées, maquette.
Rempli **après** `PROJECT_BRIEF.md` (le quoi) et **avant** de dessiner la maquette — c'est ce
fichier qu'on envoie tel quel à **Claude Design** (claude.ai) pour y dessiner la maquette.

> **Auto-suffisant** : Claude Design ne voit QUE ce fichier. Ne pas renvoyer vers d'autres
> fichiers du repo (`PROJECT_BRIEF.md`, `ARCHITECTURE.md`…) — recopier ici le strict nécessaire
> du brief plutôt que d'y renvoyer.
> À l'instanciation : **un projet sans UI ne copie pas ce fichier.**

## Rappel produit (recopié du brief)

- Objectif (2 lignes) :
- Fonctionnalités MVP :
- Plateformes cibles : <desktop / mobile / PWA / …>

## Écrans & vues

> Un bloc par écran — c'est la matière première de la maquette.

### Écran 1 — <nom>

- Rôle :
- Contenu / éléments clés :
- Actions possibles :

## Navigation & parcours

- Écran d'entrée :
- Flux principal : <écran A → écran B → …>
- Navigation secondaire : <menu, onglets, retours…>

## Données affichées

> Entités principales et champs visibles à l'UI — pas le schéma BDD complet.

- <Entité> : <champs affichés, états possibles>

## Contraintes UI

- <mobile-first ? offline ? accessibilité ? ton visuel ?>

---

## Design system — sync

> Optionnel au départ ; à remplir quand le projet a un kit de composants synchronisé sur
> claude.ai (Design Sync). Un composant absent du kit sera improvisé par Claude Design —
> synchroniser le kit AVANT de dessiner un écran qui le réutilise.

- Projet design-system claude.ai : <id>
- Dernière sync : <date>
- Composants couverts : <nom — groupe `@dsCard`>

---

## Maquette — retour

> Rempli au retour de Claude Design. La maquette devient la référence : on câble dessus,
> on ne redessine pas en codant.

- Statut : [ ] à dessiner · [ ] dessinée · [ ] câblée
- Exports : `design/maquettes/` (un fichier par écran, HTML ou PNG)
- Écarts maquette ↔ spec : <ce qui a changé en dessinant — répercuter dans les sections
  du haut si structurant>
