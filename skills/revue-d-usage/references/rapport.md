# Gabarit du rapport de revue d'usage

Annexe de `/revue-d-usage`, Étape 5. Le rapport s'écrit dans `docs/revues/<date>-usage.md`
(suffixe `-2`, `-3` si le fichier existe déjà). Pas de plafond de lignes, comme `docs/decisions/` :
c'est **le seul endroit qui garde le détail**. `TASKS.md` et `VALIDATION.md` n'en reçoivent qu'une
ligne qui renvoie ici.

Le fichier se crée **à la fin de l'Étape 3, avant le premier parcours**, avec l'en-tête et
l'avancement. Chaque parcours joué y ajoute sa section **aussitôt rendu**, jamais en fin de revue.
Une interruption garde ainsi tout ce qui a été joué.

```md
# YYYY-MM-DD — Revue d'usage

**Périmètre arrêté** : <pages : toutes | liste> · <n> parcours
**Passes** : fonctionnel · ergonomie · accessibilité · esthétique (<cochées seulement>)
**Backend** : local | distant (<hôtes relevés dans .env / .env.example>) — parcours qui écrivent : <joués | manuels>
**App** : commit <sha court> · serveur `<name>` de `.claude/launch.json` · <URL locale>
**Environnement** : navigateur in-app (Desktop) | mode B, checklist seule
**Go reçu** : <date, heure> — <périmètre tel que restitué>

## Avancement

- Parcours 1/<n> : fait | à faire | interrompu à <étape>
- …

## Parcours 1 — <nom>

**Écrans** : <A> → <B> → <C> · **Écrit** : non | local | manuel · **Joué par** : parcoureur-usage | session principale
**Issue** : achevé | non achevé à <étape> (<cause mesurée>)

Gestes :
1. <outil> <cible> → <effet observé>

Constats :
- <a id="c-1-1"></a><écran> · <critère> · mesure : <valeur> · seuil : <valeur> · <sévérité>

## Matrice de couverture

| Parcours | Écran | Nominal | Limite | Erreur de saisie | Vide | Chargement / réseau |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | <A> | ✓ | ✓ | ✓ | non atteignable — <raison> | non atteignable — <raison> |

Aucune case vide : un état non joué porte sa raison (`non atteignable sans modifier l'app — …`,
`hors périmètre arrêté`, `parcours manuel`).

## Synthèse

| Sévérité | Nombre | Domicile |
| --- | --- | --- |
| bloquant | <n> | `TASKS.md` |
| majeur | <n> | `TASKS.md` |
| mineur | <n> | ce rapport |

## Écarts brief/app → `/revue-de-conception`

- <ce que le brief dit> · <ce que l'app fait> — la revue d'usage ne recadre pas, elle signale.

## Checklist manuelle

États non atteints, parcours qui écrivent vers un backend distant ou irréversibles, critères non
mesurables (contraste sur image, lecteur d'écran) :

- [ ] <écran> — <ce qu'il faut dérouler> — <pourquoi la revue ne l'a pas fait>

## Propositions N2 (passe esthétique seulement)

Reportées dans `VALIDATION.md`, une ligne `- [ ]` chacune, dans le bloc de leur écran. Jamais
appliquées.

- <écran> — <proposition, à accepter ou refuser>
```

**Ancres** : chaque constat porte une ancre `<a id="c-<parcours>-<n>"></a>`, et la ligne de
`TASKS.md` y renvoie (`docs/revues/<date>-usage.md#c-2-3`). Un constat mineur n'a pas besoin d'être
repris ailleurs : il reste ici.

**Écart brief/app** : le brief se lit « à confirmer », jamais « vrai ». Un écart constaté entre ce
qu'il dit et ce que l'app fait n'est ni un défaut de l'app, ni un défaut du brief. C'est une
question pour `/revue-de-conception`, qui seule recale l'objectif.
