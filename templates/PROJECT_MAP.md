# PROJECT_MAP.md

Carte synthétique du projet.

Objectif : permettre aux modèles d’identifier rapidement les zones pertinentes sans explorer tout le repo.
Plafond : **200 lignes** (appliqué par hook).

> **La carte sert à trouver, pas à comprendre.** Si un bloc explique du code au lieu de le
> localiser, le raccourcir : c'est le code qui documente le code.
> À l’instanciation : **supprimer les sections non pertinentes** plutôt que de les laisser vides.
> Dupliquer le bloc « Feature » autant de fois que nécessaire.

À mettre à jour quand :
- une feature importante est ajoutée ;
- une responsabilité de fichier change ;
- une zone devient difficile à maintenir ;
- un nouveau module structurant apparaît.

---

## Vue d’ensemble

Décrire en quelques lignes :
- le type d’application ;
- les grandes zones fonctionnelles ;
- le flux principal utilisateur ;
- les dépendances ou contraintes structurantes.

---

## Arborescence utile

```text
src/
  features/
  components/
  hooks/
  lib/
  types/
```

Adapter cette section au repo réel.

---

## Features principales

### Feature 1 — Nom de la feature

Rôle :
-

Fichiers clés :
-

Flux principal :
-

Dépendances internes :
-

Points de vigilance :
-

---

## Fichiers transversaux importants

### Configuration

-

### Routing / navigation

-

### État global / stores

-

### API / persistance

-

### UI partagée

-

---

## Zones à risque ou coûteuses en contexte IA

Lister ici les zones qui nécessitent souvent beaucoup de contexte pour être modifiées.

-

---

## Règles locales importantes

Ajouter ici les conventions propres au projet.

-
