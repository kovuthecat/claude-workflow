---
name: creer-projet
description: "Créer un nouveau projet depuis le dossier parent des projets : dossier, git init, vendoring du workflow, puis bascule de la session dans le nouveau dossier, où `/nouveau-projet` prend le relais. À dérouler depuis le dossier qui contient tous les projets, jamais depuis un projet."
---

# Créer un projet — lanceur du dossier parent

Plomberie seulement : cette skill ne mène **aucune** interview. Elle prépare un dossier vide équipé
du workflow, puis passe la main à `/nouveau-projet`, qui y est vendoré à sa dernière version publiée.

Elle vit dans `<dossier parent>/.claude/skills/creer-projet/`. Ce dossier parent n'est pas un dépôt
git et chaque projet en est un : la découverte des skills s'arrête à la racine du dépôt, cette
skill n'apparaît donc dans aucun projet. Sa source est `plugin/lanceur/` du dépôt Templates, hors
du plan de `sync-workflow` (jamais vendorée dans un projet), publiée avec le reste.

## 1. Vérifier l'emplacement

`git rev-parse --show-toplevel` **doit échouer** dans le dossier courant. S'il répond, la session
est dans un projet : s'arrêter, et orienter vers `/nouveau-projet` (dépôt vide) ou
`/migrer-projet` (dépôt existant).

## 2. Nom du dossier

Une seule question : le nom du dossier du projet (sans espace de préférence — il finit dans des
commandes). Le chemin cible est `<dossier courant>/<nom>`, en absolu.

- Le dossier existe et n'est pas vide → s'arrêter ; `/migrer-projet` depuis ce dossier.
- Le chemin contient `SynologyDrive`, `OneDrive`, `Dropbox` ou `iCloud` → le dire avant de créer
  quoi que ce soit (même règle que `/nouveau-projet` Phase C étape 7 : un dépôt sous un client de
  synchro se corrompt) ; attendre le choix.

## 3. Créer, vendorer, se mettre à jour — une seule commande

Au premier plan, en Bash, `P` remplacé par le chemin absolu (barres obliques) :

```bash
P="<chemin absolu>" && mkdir -p "$P" && git -C "$P" init && WF="$(mktemp -d)/wf" && git clone --depth 1 https://github.com/kovuthecat/claude-workflow "$WF" && L="$WF/lanceur/creer-projet/SKILL.md" && if [ -f "$L" ] && ! cmp -s <(tr -d '\r' < "$L") <(tr -d '\r' < "${CLAUDE_SKILL_DIR}/SKILL.md"); then cp "$L" "${CLAUDE_SKILL_DIR}/SKILL.md" && echo "LANCEUR MIS A JOUR"; fi && echo "WF=$WF" && node "$WF/bin/sync-workflow.mjs" --source "$WF" --projet "$P"
```

- Le clone va dans un dossier temporaire neuf (`mktemp -d`) : un `git clone` dans un dossier déjà
  rempli échoue, et un clone d'une création précédente serait périmé.
- Le bloc du milieu compare ce lanceur à celui du clone et le remplace s'il diffère, **avant** le
  vendoring, pour qu'un vendoring refusé n'empêche pas la mise à jour : c'est ainsi qu'il reste à
  jour sans geste manuel. `LANCEUR MIS A JOUR` → le signaler ; la version modifiée sert dès l'appel
  suivant, la création en cours continue avec celle-ci.
- `SETTINGS  .claude/settings.json absent` dans la sortie est attendu : `/nouveau-projet` le pose
  en Phase C étape 2.
- **Sortie 3 avec des lignes `CACHE`** : `sync-workflow` a trouvé d'anciennes versions du plugin
  dans `~/.claude/plugins/cache/` et n'a rien écrit. Sur le poste du dépôt source, ce sont les
  restes des `claude plugin update` successifs : le plugin n'y est actif que dans Templates, pas
  dans le nouveau projet. Montrer les lignes `CACHE` et poser la question : supprimer ces dossiers,
  ou relancer seulement le vendoring avec `--ignorer-cache` (`WF` affiché par la commande).
  Ailleurs, un cache actif et périmé est un vrai risque : ne pas passer outre sans cette réponse.
- Échec de `git clone` (réseau) → rien n'est à défaire hors du dossier vide créé : le dire, et
  proposer de relancer.

## 4. Basculer dans le nouveau dossier

- **App Desktop** : outil `change_directory` (serveur `ccd_directory`, différé — le charger par
  ToolSearch), avec le chemin absolu. La bascule prend effet **à la fin du tour** : terminer le
  tour sur « Tape `/nouveau-projet` ».
- **Terminal `claude`** : Claude ne peut pas taper une commande slash. Demander à l'utilisateur
  `/cd <chemin>` puis `/nouveau-projet`, ou d'ouvrir une nouvelle session dans le dossier.

Après la bascule, `/nouveau-projet` trouve le workflow déjà vendoré, à jour, et le nom et
l'emplacement du dépôt (sa question 14) déjà fixés.
