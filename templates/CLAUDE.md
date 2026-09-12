# CLAUDE.md

Instructions permanentes pour Claude Code. Seul fichier chargé automatiquement :
il pointe vers le reste, sans le recopier. Plafond : **200 lignes** — au-delà, le coût est payé
à chaque session de chaque projet.

## Commandes

> Remplir avec les commandes réelles du projet. Section la plus utile : évite à Claude de deviner.
> **Avec reporter compact** (`--reporter=dot`, `--silent`, `-q`…) : un runner qui imprime 400 tests
> remplit le contexte de l'agent `verificateur-n0` (mesure A7).

```bash
# Dev / serveur local
<commande dev>

# Build
<commande build>

# Tests (toute la suite)
<commande test>

# Test unitaire ciblé
<commande test fichier/cas précis>

# Lint / format
<commande lint>

# Typecheck — VÉRIFIER À L'INSTANCIATION qu'elle compile vraiment quelque chose :
#   <commande typecheck> --listFiles | grep -v node_modules | wc -l   → doit être NON NUL.
# Piège : sur un scaffold Vite/TS, le tsconfig racine est en `files: []` + références de projet,
# et `tsc --noEmit` y compile 0 fichier — un vert vide qui ne bloque plus rien. Dans ce cas la
# commande est `tsc -b --noEmit`. (Constaté sur 3 projets, cf. Templates/DECISIONS.md 2026-08-02.)
<commande typecheck>
```

- Variables d'environnement : `<emplacement .env / .env.example>`
- Ne jamais committer de secret (`.env`, clés, tokens).
- Serveur dev déclaré dans `.claude/launch.json` (nécessaire à la validation N1 — `/verif-visuelle`).

<!-- Règles communes injectées à chaque session par le plugin `workflow` (hook SessionStart) — ne pas les recopier ici. -->

## Règles spécifiques au projet

> À remplir à l'instanciation.
