---
name: maj-workflow
description: Mettre à jour les fichiers du workflow vendorés depuis le dépôt source, en signalant les fichiers modifiés à la main. À dérouler quand un projet est en retard sur la source, ou périodiquement.
model: haiku
---

# Mettre à jour le workflow vendoré

Le workflow vit **dans le repo** (`.claude/skills`, `.claude/agents`, `.claude/workflow`), pas dans
un plugin installé à l'exécution. Cette skill le resynchronise depuis la source.

**Elle est elle-même vendorée** : elle fonctionne pour quelqu'un qui a seulement cloné le repo, sans
plugin, sans marketplace, sans rien installer. C'est tout l'intérêt du modèle.

## La règle qui rend le vendoring viable

**Un fichier listé dans `.claude/workflow/manifest.json` est GÉRÉ : on ne le modifie jamais à la
main dans le projet.** Une amélioration remonte au dépôt source, puis redescend ici par
synchronisation.

Sans cette règle, chaque projet dériverait dans son coin et la « source unique » n'existerait plus.
Le manifeste la rend vérifiable mécaniquement : il porte un hash par fichier géré, donc une
modification locale se voit, au lieu d'être écrasée en silence à la synchronisation suivante.

## Étape 1 — Constater avant d'écrire

```bash
node .claude/workflow/bin/sync-workflow.mjs --source <payload> --projet . --check
```

Sortie : version de la source vs version du projet, puis un décompte — à jour / à écrire /
**modifiés localement** / obsolètes. Sort en `1` si une action est due, `0` si tout est aligné.

**D'où vient `<payload>`** — trois cas, du moins cher au plus coûteux :

| Situation | `--source` |
| --- | --- |
| Le dépôt source est cloné sur cette machine | son dossier `plugin/` |
| Le plugin d'amorçage est installé | `${CLAUDE_PLUGIN_ROOT}` |
| Ni l'un ni l'autre | `git clone --depth 1 https://github.com/kovuthecat/claude-workflow <tmp>` puis `<tmp>` |

Le troisième cas est le mode normal pour quelqu'un qui découvre le projet : un clone jetable, le
temps de la synchronisation, et plus rien à maintenir sur la machine.

## Étape 2 — Traiter les dérives AVANT de synchroniser

Une ligne `DÉRIVE` signale un fichier géré modifié à la main. Ne jamais l'écraser sans arbitrage —
c'est peut-être une amélioration qui n'a jamais été remontée.

Pour chacune, regarder le diff (`resumeur-git` si le fichier est commité) et trancher :

- **La modification a de la valeur** → la porter dans le **dépôt source**, publier, puis
  synchroniser. STOP ici : la remontée n'est pas le travail de cette skill.
- **La modification est un accident, ou obsolète** → `--force` l'écrasera à l'étape 3.

Le moteur **préserve** les dérives par défaut : sans `--force`, un fichier modifié localement n'est
pas touché. Le défaut protège le travail, il ne l'efface pas.

## Étape 3 — Synchroniser

```bash
node .claude/workflow/bin/sync-workflow.mjs --source <payload> --projet .
```

Ajouter `--force` **uniquement** pour écraser des dérives arbitrées à l'étape 2.

Le moteur écrit les fichiers modifiés, supprime ceux qui ont quitté le payload, et réécrit le
manifeste. Un fichier propre et déjà à jour n'est pas réécrit : le diff git reste lisible.

## Étape 4 — Vérifier

1. Relancer avec `--check` → doit sortir `ÉTAT: à jour` (exit 0).
2. `node --check` sur chaque hook :
   ```bash
   for f in .claude/workflow/hooks/*.mjs; do node --check "$f" || echo "KO $f"; done
   ```
3. `.claude/settings.json` : les hooks pointent bien vers
   `$CLAUDE_PROJECT_DIR/.claude/workflow/hooks/` et il ne reste **ni** `enabledPlugins`, **ni**
   `extraKnownMarketplaces` (les deux ensemble avec les fichiers vendorés = workflow chargé deux
   fois — cf. le tableau du double chargement dans `/migrer-projet`).
4. **Nouvelle session** (la config n'est lue qu'au démarrage) : un `git add -A` de test doit être
   refusé, et les skills doivent être proposées. C'est la preuve que le câblage est actif.

## Signaler l'`AGENTS.md` racine, s'il existe

Codex est sorti du workflow (v0.29.0) : plus de fichier central `.claude/workflow/AGENTS.md`. Si le
projet a un `AGENTS.md` à la racine qui y renvoie, le signaler à l'utilisateur — fichier du projet,
jamais touché par le sync — à supprimer ou à réécrire à sa main.

## Fin

- Staging explicite (`git add -A` est refusé par hook). Commit :
  `chore(workflow): synchronisation vX.Y.Z`.
- Le commit est **la** trace de la mise à jour : visible, datée, réversible. C'est ce que le modèle
  vendoré échange contre l'absence d'installation.
- **Rapport** : version avant → après, nombre de fichiers écrits, dérives arbitrées et comment.
