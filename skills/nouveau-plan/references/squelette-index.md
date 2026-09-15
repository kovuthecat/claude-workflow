# Squelette `plans/P<n>/index.md`

Annexe de `/nouveau-plan` Étape 3 — à ouvrir **au moment d'écrire l'index**. Le statut des tâches
vit ici et nulle part ailleurs (`WORKFLOW.md` §4a).

```md
# Plan P<n> — <titre du plan>   (rédigé par Opus)

## Objectif d'ensemble
<2-3 lignes : le but global du plan, et ce qui sera vrai à la fin qui ne l'est pas aujourd'hui —
 en clair, pas en termes de code>

**Risques du plan** : <hypothèses comportementales non sondées — chacune avec ce qui la réfuterait — ou `—`>

## Sessions
| Session | Tâches | Titre | Modèle | Effort | Env. | Dépend de | Zone modifiée | Statut |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [S1](S1.md) | T1-T3 | … | Haiku | low | — | — | `<fichiers réellement modifiés>` | [ ] |
| [S2](S2.md) | T5 | … | Sonnet | high | — | S1 | `<répertoire ou fichiers, jamais une généralité>` | [ ] |

<!-- Statut : [ ] à faire · [x] fait, revue sans bloquant · [x]! fait, revue à bloquant non trié -->
<!-- Vocabulaire complet : WORKFLOW.md §4a — ne pas inventer d'autre marque ici. -->


## Ordonnancement
- **Vague 1 — parallélisable** : S1 · S3 (zones disjointes, aucune dépendance).
  *Pourquoi maintenant* : <ce que cette vague débloque pour la suite, une ligne>
  - **S1** — <en clair : ce que ça change, et à quoi on le verra. 1-2 phrases, sans jargon>
  - **S3** — <idem>
- **Vague 2** : S2 (après S1) · S4 (après S3).
  *Pourquoi maintenant* : <…>
  - **S2** — <…>
  - **S4** — <…>
- **Vague 3 — clôture** : contexte (`STATUS.md`, `TASKS.md`, `VALIDATION.md`) et push. Pas de
  commits de code à rattraper : chaque session a commité les siens.
```
