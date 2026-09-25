---
name: maj-workflow
description: Mettre à jour les fichiers du workflow vendorés depuis le dépôt source, en signalant les fichiers modifiés à la main. Dérouler aux frontières de plan (C4) — `/nouveau-plan` Étape 0, `/orchestrer-plan` avant la première vague, `/nouveau-projet`, `/migrer-projet`.
model: haiku
---

# Mettre à jour le workflow vendoré

Le workflow vit **dans le repo** (`.claude/skills`, `.claude/agents`, `.claude/workflow`), pas dans
un plugin installé à l'exécution. Cette skill le resynchronise depuis la source.

**Elle est elle-même vendorée** : elle fonctionne pour quelqu'un qui a seulement cloné le repo, sans
plugin, sans marketplace, sans rien installer. C'est tout l'intérêt du modèle.

## Quand — les frontières de C4, pas « périodiquement »

`docs/decisions/2026-09-17-autonomie-par-defaut-etat-scripte-push-par-session.md` (C4) : l'appel
n'est plus au fil de l'eau, seulement à quatre frontières, chacune l'appelant elle-même —
`/nouveau-plan` Étape 0, `/orchestrer-plan` avant sa première vague, `/nouveau-projet`,
`/migrer-projet`. Un appel manuel reste légitime (projet resté longtemps dormant), mais n'est plus
le cas nominal : écrire un plan ou lancer une vague sur un workflow en retard fige dans les
squelettes ou l'orchestration ce que la source a déjà corrigé.

## La règle qui rend le vendoring viable

**Un fichier listé dans `.claude/workflow/manifest.json` est GÉRÉ : on ne le modifie jamais à la
main dans le projet.** Une amélioration remonte au dépôt source, puis redescend ici par
synchronisation.

Sans cette règle, chaque projet dériverait dans son coin et la « source unique » n'existerait plus.
Le manifeste la rend vérifiable mécaniquement : il porte un hash par fichier géré, donc une
modification locale se voit, au lieu d'être écrasée en silence à la synchronisation suivante.

## Étape 0 — Vérifier qu'aucune vague n'est en cours

`.claude/wave.lock` présent → **STOP** : une vague est en cours, synchroniser plus tard. Une
synchronisation lancée sous verrou peut écraser les commits d'une session en cours (incident
ebm-msp, 2026-09-24).

## Étape 1 — Constater avant d'écrire

```bash
node .claude/workflow/bin/sync-workflow.mjs --source <payload> --projet . --check
```

Sortie : version de la source vs version du projet, puis un décompte — à jour / à écrire /
**modifiés localement** / obsolètes. Sort en `1` si une action est due, `0` si tout est aligné.

**D'où vient `<payload>`** — trois cas, du moins cher au plus coûteux :

| Situation | `--source` |
| --- | --- |
| `workflow@templates` apparaît dans `claude plugin list` | le chemin de cache qu'il rend pour ce plugin — **jamais** `.claude/workflow` (qui est la copie à mettre à jour) |
| Absent de `claude plugin list` | `git clone --depth 1 https://github.com/kovuthecat/claude-workflow <tmp>` puis `<tmp>` |

Le second cas est le mode normal pour quelqu'un qui découvre le projet : un clone jetable, le
temps de la synchronisation, et plus rien à maintenir sur la machine.

**`correctifCritiqueDepuis`** — `plugin.json` de la source peut porter cette clé (une version) : un
projet vendoré strictement en dessous ne franchit pas une frontière de C4 sans se mettre à jour
d'abord, même entre deux vagues d'un plan en cours (`/orchestrer-plan` le constate avant sa
première vague). Un projet déjà à cette version ou au-dessus n'est pas concerné — comparer contre la
version lue dans `.claude/workflow/manifest.json` du projet.

## Étape 2 — Sans `DÉRIVE` : synchroniser directement, rapporter après

**Aucune ligne `DÉRIVE`** dans la sortie de l'Étape 1 (aucun fichier géré modifié à la main) → la
mise à jour est mécanique, réversible, et jugée par le `--check` de l'Étape 5 : dérouler l'Étape 4
**sans poser de question**, puis rapporter. C'est le cas normal, et c'est ce qui rend l'appel
automatique aux frontières de C4 tenable — un humain n'est sollicité que quand il y a un vrai choix.

## Étape 3 — Avec `DÉRIVE` : question à options, jamais un arbitrage silencieux

Une ligne `DÉRIVE` signale un fichier géré modifié à la main — peut-être une amélioration jamais
remontée, peut-être un accident. Ni l'un ni l'autre ne se tranche seul : **question** à
l'utilisateur (`WORKFLOW.md` §9c), avec le diff (`resumeur-git` si le fichier est commité) et deux
options chiffrées :

1. **Remonter** — la modification a de la valeur : la porter dans le dépôt source, publier, puis
   synchroniser. STOP ici : la remontée n'est pas le travail de cette skill.
2. **Écraser** — la modification est un accident ou obsolète : `--force` l'écrasera à l'Étape 4.

Le moteur **préserve** les dérives par défaut : sans `--force`, un fichier modifié localement n'est
pas touché. Le défaut protège le travail, il ne l'efface pas.

## Étape 4 — Synchroniser

```bash
node .claude/workflow/bin/sync-workflow.mjs --source <payload> --projet .
```

Ajouter `--force` **uniquement** pour écraser une dérive arbitrée « Écraser » à l'Étape 3.

Le moteur écrit les fichiers modifiés, supprime ceux qui ont quitté le payload, et réécrit le
manifeste. Un fichier propre et déjà à jour n'est pas réécrit : le diff git reste lisible.

## Étape 5 — Vérifier

1. Relancer avec `--check` → doit sortir `ÉTAT: à jour` (exit 0).
2. `node --check` sur chaque hook :
   ```bash
   for f in .claude/workflow/hooks/*.mjs; do node --check "$f" || echo "KO $f"; done
   ```
3. `.claude/settings.json` : les hooks pointent bien vers
   `$CLAUDE_PROJECT_DIR/.claude/workflow/hooks/` et il ne reste **ni** `enabledPlugins`, **ni**
   `extraKnownMarketplaces` (les deux ensemble avec les fichiers vendorés = workflow chargé deux
   fois — cf. le tableau du double chargement dans `/migrer-projet`).
4. **Nouvelle session** (la config n'est lue qu'au démarrage) — contrôle que l'**humain** fait dans
   cette nouvelle session, jamais la session courante : un `git add -A` doit être refusé, et les
   skills doivent être proposées. C'est la preuve que le câblage est actif.

## Signaler l'`AGENTS.md` racine, s'il existe

Codex est sorti du workflow (v0.29.0) : plus de fichier central `.claude/workflow/AGENTS.md`. Si le
projet a un `AGENTS.md` à la racine qui y renvoie, le signaler à l'utilisateur — fichier du projet,
jamais touché par le sync — à supprimer ou à réécrire à sa main.

## Fin — commit et push

- Staging explicite (`git add -A` est refusé par hook). Commit :
  `chore(workflow): synchronisation vX.Y.Z`.
- **`git push`** — comme toute fin de tour qui rend la main ou déclenche la frontière suivante
  (`WORKFLOW.md` §4b, C3) : un commit local n'existe pour aucune autre machine, cloud compris, et
  c'est justement à une frontière (`/orchestrer-plan` avant sa première vague, par exemple) que la
  suite peut tourner ailleurs.
- Le commit est **la** trace de la mise à jour : visible, datée, réversible. C'est ce que le modèle
  vendoré échange contre l'absence d'installation.
- **Rapport** : version avant → après, nombre de fichiers écrits, dérives arbitrées et comment.
