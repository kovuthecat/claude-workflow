---
name: purge-contexte
description: Ramener les fichiers de contexte sous leur plafond de lignes en archivant sans perdre d'information. À dérouler quand un hook signale un dépassement, ou avant de reprendre un projet dormant.
model: haiku
---

# Purge du contexte

**Règle absolue : on ne supprime pas, on déplace.** Un fichier de contexte est cher parce qu'il est
relu à chaque session — mais une information perdue coûte bien plus qu'un fichier long.
En cas de doute : déplacer vers `docs/`, jamais effacer.

Plafonds : source unique = `${CLAUDE_PLUGIN_ROOT}/hooks/plafonds.json` (lu aussi par les
hooks) — ne jamais recopier les valeurs ici, elles dérivent et finissent par diverger.

Le frontmatter bascule sur **Haiku, effort `low`** pour ce tour — c'est du déplacement mécanique,
sans pause pour validation humaine, donc le tour couvre toute la skill.
Traiter **un fichier à la fois**, dans l'ordre où les dépassements sont signalés.

## `DECISIONS.md` → registre + `docs/decisions/`

C'est le plus gros gain : le détail d'une décision n'a pas à être en contexte tant que la décision
n'est pas en jeu.

1. Créer `docs/decisions/` s'il n'existe pas.
2. Pour **chaque** décision du fichier : créer `docs/decisions/YYYY-MM-DD-<slug>.md` contenant le
   bloc **intégral** tel quel (contexte, alternatives, raison, conséquences).
3. Remplacer, dans `DECISIONS.md`, le bloc par **une ligne** :
   `- YYYY-MM-DD — **<titre>** — <verdict en une phrase> → [détail](docs/decisions/YYYY-MM-DD-<slug>.md)`
4. Les décisions **caduques/remplacées** vont sous `## Archives`, même format, avec
   ` — remplacée par <date/titre>`.
5. Vérifier qu'aucun renvoi existant (`DECISIONS.md §Auth`, plans, `CLAUDE.md`) ne pointe dans le
   vide : les faire pointer vers le fichier de détail.

## `STATUS.md` → photo stricte

`STATUS.md` décrit l'app **telle qu'elle est maintenant**. Il n'a pas de mémoire.

- Supprimer toute section historique (« Phase précédente », « Phase P-1 », journaux de session) :
  l'historique est dans `git log` et dans les `index.md` des plans clos.
- Ne garder que : phase actuelle · ce qui fonctionne · ce qui casse / n'est pas testé · bugs
  connus · dette technique.
- Une ligne résolue disparaît (elle est dans le commit qui l'a résolue), elle ne devient pas
  « ✅ corrigé le … ».

## `VALIDATION.md` → uniquement du N2 restant

Ce fichier ne contient que des items **N2 EN ATTENTE** (cf. `/verif-visuelle`) — plafond dans
`plafonds.json`. Tout item tranché est **supprimé**, jamais archivé : git suffit comme trace.

- Supprimer tout bloc entièrement `[x]`.
- Supprimer tout item qui relève du **N1** (erreur console, élément absent, 404, débordement) :
  ce n'est pas à l'utilisateur de le vérifier — le rebasculer en tâche `TASKS.md` si ce n'est pas fait.
- Un écran réécrit depuis **remplace** ses anciens critères, il ne s'empile pas dessous.
- Organiser **un bloc par écran/module courant**, jamais un bloc par tâche de plan.
- Projet à plusieurs gros sous-domaines : router le spécifique dans `docs/<sous-domaine>/VALIDATION.md`,
  garder la racine pour le transverse.

## `TASKS.md` → backlog vivant

- Supprimer les lignes des tâches faites dont le plan est clos.
- Une tâche entrée dans un plan ne porte plus de statut ici, juste `→ plans/P<n>/S<k>.md`
  (le statut vit dans l'`index.md`).

## `PROJECT_MAP.md`

- Supprimer les sections vides et les features disparues.
- Une feature = un bloc court (rôle, fichiers clés, points de vigilance). Si un bloc explique du
  code plutôt que de le localiser, le raccourcir : la carte sert à **trouver**, pas à comprendre.

## Fin

1. Recompter les lignes de chaque fichier traité → sous le plafond.
2. Résumer en 3 lignes : ce qui a été déplacé, où, et ce qui reste au-dessus du plafond s'il y a lieu.
3. Commit dédié : `docs: archive context files under line caps` (ne pas le mélanger à une tâche de code).
