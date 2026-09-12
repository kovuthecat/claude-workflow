---
name: verif-visuelle
description: Vérification visuelle d'un écran — navigateur in-app si disponible, sinon checklist manuelle. À utiliser après une tâche qui change l'UI, avant de consigner dans VALIDATION.md.
---

# Vérification visuelle

Trois niveaux (cf. `${CLAUDE_PLUGIN_ROOT}/WORKFLOW.md` §6) :

| Niveau | Qui | Bloquant | Contenu |
| --- | --- | --- | --- |
| **N0** | Claude, toujours | oui | `build` + `typecheck` (+ tests unitaires si logique pure) |
| **N1** | Claude si navigateur dispo | non | erreurs console, contenu présent, requêtes 4xx/5xx, responsive |
| **N2** | l'utilisateur | non | jugement esthétique / UX / ton — rien d'autre |

Cette skill couvre **N1**. Elle ne fait jamais de N2 : Claude n'évalue pas si c'est beau.

## Étape 0 — Déterminer l'environnement

Regarde si les outils `preview_start` / `read_page` / `read_console_messages` sont disponibles
dans ta session.

- **Disponibles → Claude Code Desktop** : dérouler le mode A.
- **Absents → tout le reste** (VSCode, terminal, session cloud `claude.ai/code`, appli mobile) :
  dérouler le mode B. Ne pas tenter de contourner (pas de
  Playwright, pas de capture par script) — le navigateur in-app est le seul outil visuel autorisé
  à Claude.

Si le bandeau de la session indique `Environnement : Desktop` et que les outils sont absents, la
session a été lancée au mauvais endroit → **STOP**, signale-le, rends la main.

**En sous-agent orchestré, `navigate` vers `localhost` peut être refusé** (« navigation to … was
denied or failed » — constaté deux fois le 2026-09-10/11, cause non documentée) alors que
`preview_start` ouvre l'onglet sans problème. **Un seul essai** : refusé → basculer en mode B et
écrire dans le bilan de session (`/fin-de-tache` point 3) la ligne « N1 à dérouler au premier plan :
<écran> ». Une session orchestrée qui conclut `PASS` avec cette ligne l'ajoute aussi à son `MOTIF`
final (« N1 à dérouler au premier plan : <écran> ») — c'est ce que `/orchestrer-plan` Étape 6 relaie.

## Mode A — Navigateur in-app (Desktop)

1. **Ouvrir la preview** : `preview_start` avec le `name` de `.claude/launch.json`. Si le fichier
   n'existe pas, le créer à partir de la commande dev du `CLAUDE.md` du projet :

   ```json
   {
     "version": "0.0.1",
     "configurations": [
       { "name": "dev", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev"], "port": 5173 }
     ]
   }
   ```

2. **Naviguer** vers l'écran concerné par la tâche (`navigate`).
3. **Relever** — dans cet ordre, en s'arrêtant au premier échec bloquant :
   - `read_console_messages` (`onlyErrors: true`) → **aucune erreur**.
   - `read_page` → les textes/éléments attendus de la tâche sont **présents** (c'est ce qui attrape
     les écrans blancs et les composants qui ne montent pas).
   - `read_network_requests` → **aucun 4xx/5xx** sur les appels de l'écran.
   - `resize_window` mobile (375×812) puis desktop → **pas de débordement horizontal**,
     à ne faire que si la tâche touchait la mise en page.
4. **Interagir** seulement si la tâche portait sur une interaction : `computer` (clic/saisie) ou
   `form_input`, puis `read_page` pour confirmer l'effet.
5. **Capture** (`computer` `screenshot`) **uniquement** si un constat visuel doit être montré à
   l'utilisateur — une capture coûte cher en tokens, elle n'est pas le mode de vérification par défaut.

**Si un défaut N1 est trouvé** : lire le code, corriger, relancer l'étape 3. Un défaut N1 se
corrige dans la session, il ne se consigne **pas** dans `VALIDATION.md`.

**Si tout passe** : le noter dans le rapport de fin de tâche (« N1 OK : <écran>, console propre,
<élément> présent »). Ne rien écrire dans `VALIDATION.md`.

**Point N2 à faire trancher** : plutôt que de décrire l'élément en mots, dire à l'utilisateur qu'il
peut le **désigner** — `Ctrl/Cmd+Shift+B` ouvre le panneau Browser, `Ctrl/Cmd+Shift+S` arme la
sélection, il clique l'élément et dit quoi changer. Ça ne déplace pas la frontière : le jugement
reste le sien, seule la désignation devient exacte.

## Mode B — Pas de navigateur (VSCode, terminal, cloud, mobile)

Ne rien vérifier soi-même. Produire, dans la réponse, un bloc prêt à dérouler :

```
### Vérification visuelle à faire (N1 + N2) — <écran concerné>
Lancer : <commande dev exacte du CLAUDE.md du projet>
Ouvrir : <URL locale + route>

N1 (ce qui doit être vrai) :
- [ ] aucune erreur dans la console
- [ ] <élément/texte attendu de la tâche> visible
- [ ] <appel réseau clé> répond 200
N2 (jugement) :
- [ ] <ce qui relève du goût / de l'UX>
```

Puis **consigner uniquement la partie N2 dans `VALIDATION.md`** (bloc par écran, cf. l'en-tête du
fichier). La partie N1 reste dans la réponse : soit l'utilisateur la déroule tout de suite, soit la
session est rejouée depuis Desktop.

> Une session dont la validation N1 est structurante (nouvel écran, refonte de mise en page) gagne
> à être lancée depuis Desktop. C'est ce que déclare la colonne **Env.** de l'`index.md` du plan.
