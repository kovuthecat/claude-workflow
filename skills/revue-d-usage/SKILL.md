---
name: revue-d-usage
description: Revue d'usage d'une application en marche, à un jalon, par parcours joués dans le navigateur in-app — fonctionnel, ergonomie (Nielsen), accessibilité (WCAG 2.1 AA), esthétique sur demande — après une interview de périmètre. Revue d'ensemble d'une app, pas la vérification d'un écran après une tâche (c'est `/verif-visuelle`). Ne corrige pas de code.
allowed-tools: Read, Glob, Grep, Agent, Write, Edit, Bash(git status:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*)
model: sonnet
---

# Revue d'usage

Parcourir une app en marche dans le navigateur in-app, et rendre ce qu'un utilisateur vivrait : ce
qui casse, ce qui gêne, ce qui n'est pas accessible, et sur demande ce qui pourrait être plus beau.
Elle **ne corrige pas de code**, jamais de Playwright, aucune action irréversible. **Étape de revue
nommée, sans rang** : la grille N0 / N1 / N2 ne bouge pas (`${CLAUDE_PLUGIN_ROOT}/WORKFLOW.md` §6).
Sur le N2 : *proposer, jamais trancher, et seulement si l'interview l'a demandé*.

## Étape 0 — Environnement et garde-fous

**Outils in-app.** Même contrôle que `/verif-visuelle` Étape 0 : `preview_start`, `read_page`,
`read_console_messages` sont-ils dans la session ? Le refus de `navigate` vers `localhost`, la
vérification du serveur et la règle « un seul essai » y sont décrits : les appliquer tels quels.

- **Absents → mode B.** Ne rien parcourir soi-même. Sortir la liste des parcours (Étape 2, depuis
  `ARCHITECTURE.md` seul) et, **par parcours**, un bloc au format du mode B de `/verif-visuelle` :
  `Lancer` · `Ouvrir` · les gestes · les états à provoquer · les critères à relever. L'interview se
  réduit au périmètre (pages, parcours), sans les passes. Le bloc va dans la réponse et dans la
  « Checklist manuelle » du rapport, puis Étape 6.
- **Humain disponible, exigé** (comme `/revue-de-conception` Étape 0). En sous-agent ou en tâche
  planifiée, personne ne peut donner le go : s'arrêter après l'inventaire (Étape 2). Écrire le
  rapport avec l'en-tête, l'inventaire et les parcours proposés, et la ligne `Go reçu : aucun — pas
  d'humain disponible, aucun parcours joué`. Puis Étape 6.

**Serveur.** `.claude/launch.json` donne le `name` à passer à `preview_start`. Absent → le créer
depuis la commande dev du `CLAUDE.md` du projet, dans la forme de `/verif-visuelle` mode A.

**Backend distant.** Lire `.env.example`, puis `.env` s'il existe, et relever tout hôte hors
`localhost` / `127.0.0.1` (URL d'API, base, service d'authentification). **N'en recopier que
l'hôte**, jamais une clé ni un secret. Un hôte distant s'annonce à l'interview, et tout parcours
**qui écrit** (inscription, envoi, paiement, suppression) passe en « à dérouler à la main » tant que
le backend n'est pas local.

## Étape 1 — Lire l'intention

`PROJECT_BRIEF.md` (objectif, usage prévu, tâche principale), `ARCHITECTURE.md` (écrans et routes),
`DESIGN_SPEC.md` s'il existe (référence de la passe esthétique).

Le brief se lit **« à confirmer », jamais « vrai »**. Un écart entre ce qu'il dit et ce que l'app
fait devient une ligne du rapport, section « Écarts brief/app → `/revue-de-conception` ». La revue
d'usage ne recadre pas l'objectif : c'est le travail de `/revue-de-conception`.

## Étape 2 — Inventaire

`preview_start` avec le `name` de `launch.json`, puis, pour chaque route connue (`ARCHITECTURE.md`,
et les liens que la page d'accueil expose) : `navigate`, puis `read_page` (`filter: interactive`).
On en tire **la liste des écrans et de leurs éléments interactifs**. **Aucun geste qui écrit** à
cette étape : ni clic, ni saisie, ni soumission.

Puis dériver **5 à 8 parcours** avec `references/parcours-types.md` : écrans traversés, gestes,
attendus, et pour chacun s'il écrit (`non` · `local` · `manuel`).

## Étape 3 — Interview de périmètre

Sur le modèle de `/revue-de-conception` Étape 3 : **une question à la fois**, chacune ouverte par le
constat qui la produit, avec 2 ou 3 issues et **une recommandation motivée**. Reformuler la réponse
en une ligne avant la question suivante. **Trois questions au plus** :

1. **Pages** : toute l'app, ou certaines ? Le constat, c'est l'inventaire (n écrans, dont ceux que
   `ARCHITECTURE.md` ignore). Annoncer ici un backend distant et ce qu'il retire.
2. **Parcours** : la liste proposée, amendable (en ajouter, en retirer, en passer en manuel).
3. **Passes**, parmi **fonctionnel · ergonomie · accessibilité · esthétique**. Recommander les trois
   premières. **L'esthétique est décochée par défaut** : c'est la seule qui juge le goût, elle ne
   s'ouvre que si l'utilisateur la coche à cette revue-ci.

### Gate — le go

Restituer le périmètre en **cinq lignes** : pages · parcours (numérotés, avec `écrit`) · passes ·
backend · ce qui part en checklist manuelle. Puis **attendre un « go » explicite**. Ce n'est pas un
conseil : sans go, rien ne se joue. Pas de « je considère que c'est validé ». Avant le go, seuls les
`read_page` d'inventaire ont eu lieu, aucun appel de navigateur qui agit (clic, saisie).

Au go, créer le rapport (`references/rapport.md`) avec l'en-tête et l'avancement, **avant** le
premier parcours.

## Étape 4 — Parcours

**Un sous-agent `parcoureur-usage` par parcours, en séquence, jamais en parallèle** : l'onglet, les
cookies et le `localStorage` sont partagés, deux parcours simultanés se marcheraient dessus. Chaque
parcours part d'un contexte neuf, sans les traces des précédents. L'agent n'a ni shell ni écriture :
il constate, la skill écrit.

```
Agent({
  description: "Parcours <i>/<n> — <nom>",
  subagent_type: "parcoureur-usage",
  run_in_background: false,
  prompt: "Lis ${CLAUDE_PLUGIN_ROOT}/EXECUTANT.md en entier avant ton premier geste : il porte les invariants de lancement.
Serveur : preview_start name=<name de .claude/launch.json> · origine <URL locale>.
Parcours <i>/<n> : <nom> — écrans <A> → <B> → <C> · écrit : <non | local>.
Gestes et attendus : <les 3 à 8 lignes dérivées à l'Étape 2>.
Passes : <celles du go, seulement>.
Grilles : ${CLAUDE_PLUGIN_ROOT}/skills/revue-d-usage/references/nielsen.md (ergonomie) · ${CLAUDE_PLUGIN_ROOT}/skills/revue-d-usage/references/wcag-aa.md (accessibilité) — ne lire que celles des passes reçues.
États par écran : nominal, limite et erreur de saisie exigés ; vide et chargement/erreur réseau notés s'ils se produisent seuls, sinon « non atteignable sans modifier l'app — <raison> ».
Gestes interdits : correction de code, écriture de fichier, action irréversible (suppression, paiement, envoi réel, compte distant), Playwright ou capture scriptée, javascript_exec qui écrit, geste sur l'environnement (serveur, données, réseau), goût hors passe esthétique, constat sans mesure ni seuil.
Backend : <local | distant : hôtes> — distant : aucun geste qui écrit.
Données de test : <valeurs fictives, limites et invalides>.
État laissé par le parcours précédent : <route, session ouverte ou non>.
Réponse : les sections de ton fichier d'agent, sans préambule ; ou la seule ligne OUTILS NAVIGATEUR ABSENTS."
})
```

**Repli**, sans jamais bloquer : `Agent type 'parcoureur-usage' not found` → `subagent_type:
"workflow:parcoureur-usage"` (plugin installé en marketplace). Toujours introuvable, ou réponse qui
commence par `OUTILS NAVIGATEUR ABSENTS` → jouer le parcours **dans la session principale**, avec
les mêmes règles : lire `.claude/agents/parcoureur-usage.md` (`plugin/agents/…` dans le dépôt
source) et tenir ce rôle.

**Après chaque parcours**, pas en fin de revue : ajouter sa section au rapport (gestes, constats,
avec leur ancre), ses lignes de matrice, et passer sa ligne d'avancement à `Parcours <i>/<n> :
fait`. Une interruption garde ainsi tout ce qui a été joué. Un constat marqué `capture à faire` se
capture ici (`computer` `screenshot`), **seulement** s'il faut le montrer à l'utilisateur.

### Les états, par écran

Cinq états : **nominal** · **limite** (texte long, liste pleine) · **erreur de saisie** · **vide** ·
**chargement / erreur réseau**. **Exigés** : nominal, limite, erreur de saisie. Les deux autres
valent `non atteignable sans modifier l'app — <raison>` quand ils ne se produisent pas d'eux-mêmes.
Ils deviennent alors une ligne de la checklist manuelle, **jamais** un geste sur l'environnement :
on ne coupe pas le serveur, on ne vide pas les données, on ne bride pas le réseau.

### Les passes

- **Fonctionnel** : le parcours s'achève-t-il ? Console (`onlyErrors`) et requêtes 4xx/5xx à chaque
  écran. Constat : `<écran> · fonctionnel · mesure : POST /api/x → 500 · seuil : 2xx · bloquant`.
- **Ergonomie** : `references/nielsen.md`. **Accessibilité** : `references/wcag-aa.md`. Chaque
  grille donne la méthode d'observation, le seuil, l'échelle de sévérité et la forme du constat.
- **Esthétique** (si cochée) : première impression, hiérarchie visuelle, cohérence (espacements,
  typographie, couleurs), densité (H8 de Nielsen), contre `DESIGN_SPEC.md` s'il existe. Elle ne
  produit que des **propositions**, sans sévérité.

## Étape 5 — Sorties, trois domiciles

**Matrice de couverture** d'abord, dans le rapport : parcours × écrans × états. **Aucune case vide
sans sa raison.**

| Sortie | Domicile | Règle |
| --- | --- | --- |
| constats `bloquant` et `majeur` | `TASKS.md` | une ligne par écran et par sévérité, qui renvoie aux ancres du rapport |
| propositions esthétiques | `VALIDATION.md` | seulement si la passe esthétique a été cochée |
| tout, avec le détail | `docs/revues/<date>-usage.md` | gabarit `references/rapport.md` ; `-2`, `-3` s'il existe déjà |

- **`TASKS.md`** : format du gabarit, tâche non planifiée,
  `- [ ] T-<id> — <écran> : <n> constat(s) <sévérité> (<critères>) → docs/revues/<date>-usage.md#c-<i>-<n> · modèle: X, effort: Y`
  (grille `WORKFLOW.md` §2-§3 ; Sonnet · medium par défaut). **Avant d'ajouter**, chercher une ligne
  existante pour le même écran et le même critère : on la complète, on n'en crée pas une seconde.
  Si l'ajout ferait dépasser **60 lignes**, regrouper par écran (une ligne par écran, toutes
  sévérités) et le dire dans la réponse. Les `mineur` restent dans le rapport.
- **`VALIDATION.md`** : une proposition par ligne `- [ ]`, formulée pour être **acceptée ou
  refusée**, dans le bloc de son écran (en créer un s'il n'existe pas). **Jamais appliquée.**
- **Rapport** : compléter la synthèse, les écarts brief/app, la checklist manuelle (états non
  atteints, parcours manuels, critères non mesurables) et les propositions N2.

## Étape 6 — Committer et pousser

Staging **explicite** des fichiers touchés, jamais `git add -A` :
`git add docs/revues/<date>-usage.md TASKS.md VALIDATION.md` (ceux qui ont changé), puis
`git commit -m "docs(revue): revue d'usage <date>"` et `git push`. Même règle que `/cadrer` Étape 5 :
la revue est une unité de travail, elle se clôt poussée. Sinon le hook de fin de tour refuse la main
sur des fichiers de contexte modifiés et non poussés.

Terminer par trois lignes : le chemin du rapport, le compte bloquant / majeur / mineur, et la
prochaine action (la ligne `TASKS.md` la plus sévère, ou `/revue-de-conception` si les écarts
brief/app dominent).

## Interdits

- **Aucune correction de code**, même évidente : la revue constate et écrit, une tâche corrige.
- **Aucune action irréversible** : suppression, paiement, envoi réel, compte sur un service distant.
- **Jamais de Playwright** ni de capture scriptée (`WORKFLOW.md` §6) : le navigateur in-app est le
  seul outil visuel.
- **`javascript_exec` en lecture seule** : ni écriture dans le DOM, ni `click()` scripté, ni `fetch`.
- **Capture d'écran seulement pour montrer un constat**, jamais comme mode de vérification.
- **Aucun jugement de goût hors de la passe esthétique**, et jamais de sévérité sur le goût.
- **Aucun constat sans mesure ni seuil** : un adjectif sans mesure part en checklist manuelle.
- **Aucun parcours avant le go**, et aucun geste sur l'environnement pour atteindre un état.
- **Aucun parcours en parallèle.**
