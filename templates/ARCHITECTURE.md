# ARCHITECTURE.md

Réflexion d'architecture technique du projet : découpage en features, état/persistance,
entités et flux de données côté code.
Rempli **après** `PROJECT_BRIEF.md` (le quoi). Le brief UI (écrans, navigation, maquette)
vit désormais dans `DESIGN_SPEC.md` — voir ce fichier pour tout ce qui concerne l'interface.

> À l'instanciation : supprimer les sections non pertinentes.

## Découpage technique

> Fixe la structure du code (feature-first : `CONVENTIONS.md`).

- Features : <feature-a : rôle · feature-b : rôle>
- État / persistance :
- Arbitrages structurants → consignés dans `DECISIONS.md`, pas ici.

## Entités & flux de données (code)

> Schéma succinct — la contrepartie technique de la section « Données affichées » de
> `DESIGN_SPEC.md` : modèle de données, source de vérité, flux entre features/couches.

- <Entité> : <champs, source de vérité (store/DB/API), qui la lit/écrit>
- Flux : <ex. feature-a → store → feature-b>

---

## UI, écrans, maquette

> Tout le brief UI (rappel produit, écrans & vues, navigation, données affichées à l'écran,
> contraintes UI, statut de la maquette) vit dans `DESIGN_SPEC.md`. Ne pas dupliquer ici.
