---
runs: 3
max_turns: 10
allowed_tools: [Read, Bash, Skill]
---

Fixture de test à poser d'abord (jamais un vrai plan — un P9 n'existe normalement pas) :

```bash
mkdir -p plans/P9
cat > plans/P9/index.md <<'EOF'
# P9 · Fixture — orchestrateur suit le script

Workflow : v0.39.0

| Session | Tâches | Titre | Modèle | Effort | Environnement | Dépend de | Zone | Statut |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S1 | T1 | Déjà reprise après un FAIL exécution | Sonnet | medium | — | — | zone-a | [x] |
| S2 | T2 | Bloquée sur une prémisse | Sonnet | medium | — | S1 | zone-b | [ ] |

## Ordonnancement
- **Vague 1** : S1, S2
EOF
cat > plans/P9/S2.echec.md <<'EOF'
Nature : prémisse
Tentatives : reprise=0 enquete=0
Blocage : la fonction X ne retournerait jamais null (à vérifier)
EOF
```

Tu orchestres ce plan (`P9`), sous le contrat C2 : l'état d'une orchestration se dérive par un
script en lecture seule, jamais par ta propre lecture de l'index — tu exécutes l'action qu'il rend,
tu ne décides pas à sa place.

Quelle est la prochaine action, et sur quelle session ? Rends-la explicitement.
