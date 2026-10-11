# CONVENTIONS.md

## Architecture

### Priorités

1. Simplicité
2. Lisibilité
3. Maintenabilité
4. Testabilité
5. Extensibilité seulement si nécessaire

### Compatibilité IA

L'architecture doit favoriser :

- compréhension rapide du projet ;
- faible couplage ;
- isolation des features ;
- fichiers courts ;
- composants autonomes ;
- debug localisé ;
- modifications ciblées ;
- faible besoin de contexte global.

Une architecture légèrement moins "parfaite" mais plus facile à manipuler par les modèles est préférable.

### Organisation feature-first

Quand le projet grossit, privilégier une organisation par domaine fonctionnel :

```text
src/
  features/
    feature-a/
    feature-b/
    feature-c/
```

Chaque feature doit idéalement contenir : ses composants, ses hooks, ses types, ses utilitaires locaux, sa logique métier spécifique. Les dossiers globaux restent limités aux éléments réellement partagés.

### Règles

- Ne pas créer d'abstraction avant besoin réel.
- Préférer des fichiers courts.
- Nommer explicitement les fonctions.
- Éviter les dépendances lourdes.
- Documenter les décisions importantes.
- Distinguer clairement MVP et améliorations futures.
- Éviter les architectures nécessitant une compréhension globale permanente.
- Maintenir `PROJECT_MAP.md` quand l'organisation du projet évolue.

### Garde-fous

Avant d'ajouter une abstraction, vérifier :

1. Le besoin est-il réel maintenant ?
2. La duplication actuelle est-elle réellement problématique ?
3. L'abstraction réduit-elle la complexité ou la déplace-t-elle ?
4. Les modèles pourront-ils modifier cette zone sans charger beaucoup de contexte ?

---

## Règles scopées `.claude/rules/`

Une convention qui ne vaut que pour un sous-ensemble de fichiers d'un projet (ex. migrations
Supabase, données HE, tests d'un module précis) va dans un fichier `.claude/rules/<domaine>.md`
**du projet**, pas en ligne ajoutée à `CLAUDE.md`. Chaque fichier ne se charge que lorsque Claude
touche un fichier concerné, via un frontmatter `paths` (syntaxe vérifiée dans la doc Anthropic,
`memory`) :

```markdown
---
paths:
  - "supabase/migrations/**/*.sql"
---

Contenu de la règle…
```

Sans frontmatter `paths`, la règle se charge à chaque session, comme `CLAUDE.md`.

---

## Git

- Un commit = une intention claire ; relire `git diff` avant de committer.
- Stager explicitement les fichiers concernés, pas `git add .` à l'aveugle.
- Branches pour les expérimentations ; pousser après chaque session validée.
- Messages : verbe à l'impératif en anglais, court, une intention. Préfixe de type optionnel (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`).
  - ex. `Add recipe tag filtering` · `Fix iPad PWA standalone display` · `Refactor local storage service`.
- Avant une session risquée : partir d'un état propre (commit « stable state ») pour pouvoir revenir en arrière.
- ⚠ `git restore .` et `git reset --hard` sont destructifs et sans retour : vérifier `git status` avant, préférer un commit de sauvegarde plutôt que tout jeter.
- Claude Code ajoute automatiquement `Co-Authored-By` à ses commits — rien à faire.
