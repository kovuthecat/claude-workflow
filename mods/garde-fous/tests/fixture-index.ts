// Index de fixture : la forme de plans/P<n>/index.md que lit O1 (colonne Modele par son en-tete).
export const INDEX_FIXTURE = `# Plan P99 - fixture

## Sessions
| Session | Taches | Titre | Modèle | Effort | Env. | Depend de | Zone modifiee | Statut | Message de commit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [S1](S1.md) | T1 | Une | Sonnet | high | - | - | \`a/\` | [ ] | \`feat: un\` |
| [S2](S2.md) | T2 | Deux | Opus | high | - | - | \`b/\` | [ ] | \`feat: deux\` |
| [S10](S10.md) | T3 | Dix | Haiku | low | - | - | \`c/\` | [ ] | \`feat: dix\` |
`

export const INDEX_ILLISIBLE = 'ceci n est pas un index'
