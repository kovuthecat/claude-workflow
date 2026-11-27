# DESIGN_SPEC.md

Brief UI du projet : écrans, navigation, données affichées, maquette.
Rempli **après** `PROJECT_BRIEF.md` (le quoi) et **avant** de dessiner la maquette — c'est ce
fichier dont on part pour dessiner la maquette via l'outil Artifact (type Design, ou page HTML publiée).

> **Auto-suffisant** : la session qui dessine la maquette ne s'appuie QUE sur ce fichier. Ne pas renvoyer vers d'autres
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

> Interdits et seuils : `CLAUDE.md` § Règles spécifiques au projet (seule source, ne pas les
> recopier). Un critère d'aspect sans seuil mesurable (« lisible à 1 m ») est un jugement humain :
> il va en N2 (`VALIDATION.md`), pas ici.

- <mobile-first ? offline ? accessibilité ? ton visuel ?>

---

## Maquette — retour

> Rempli une fois la maquette publiée via l'outil Artifact (lien de l'Artifact à noter ci-dessous). La maquette devient la référence : on câble dessus,
> on ne redessine pas en codant.

- Statut : [ ] à dessiner · [ ] dessinée · [ ] câblée
- Artifact publié : <lien>
- Exports : `design/maquettes/` (un fichier par écran, HTML ou PNG)
- Écarts maquette ↔ spec : <ce qui a changé en dessinant — répercuter dans les sections
  du haut si structurant>
