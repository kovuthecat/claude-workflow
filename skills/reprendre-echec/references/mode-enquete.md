# Mode enquête

Annexe de `/reprendre-echec`, section « Mode enquête » — ouvrir quand le prompt de lancement dit
**« Mode enquête »**.

Quand le prompt dit « Mode enquête », la même skill tourne en **lecture seule** : elle ne
corrige rien, ne committe rien, ne lance pas N0. Elle n'a qu'un objet — remplacer une hypothèse
morte par une hypothèse vivante, ou constater qu'il n'y en a pas et nommer les issues.

C'est ce qu'un humain ferait en recevant le rapport, et c'est pour cela que ça ne lui est plus
demandé. L'enquête est bornée : **une passe**, pas de tentative de correction « pour voir », pas
de N0 lancé en passant.

1. Lire le `.echec.md` et la tâche concernée du `S<k>.md` (Étape 1). Rien d'autre en direct :
   ce qui manque se délègue à `explorateur` / `resumeur-git`.
2. Traiter **Déjà écarté** comme acquis, et l'**Hypothèse en cours** comme réfutée — c'est
   précisément parce qu'elle est tombée que cette enquête tourne. Chercher ailleurs.
3. **Écrire le `.echec.md` mis à jour en premier geste**, avant de répondre : « Déjà écarté »
   enrichi de l'hypothèse morte **avec la raison**, « Hypothèse en cours » réécrite, `Tentatives :`
   incrémentée sur `enquete`. Un agent qui épuise ses tours doit laisser un fichier, jamais un
   silence (même règle que `relecteur-session`, `docs/decisions/2026-09-12-revue-deposee-d-abord-et-collecte-patiente.md`).
4. Répondre **une seule ligne**, exactement :

```
ENQUETE: PISTE|OPTIONS · MOTIF: <une phrase> · RAPPORT: <chemin>
```

- **`PISTE`** — une hypothèse neuve, testable, dans le périmètre de la tâche d'origine. Le motif
  la nomme en une phrase ; le détail est dans le rapport, l'orchestrateur ne l'ouvre pas.
- **`OPTIONS`** — aucune hypothèse ne tient dans ce périmètre : le rapport gagne une section
  `## Issues` de **2 à 4 options**, chacune écrite **déjà au format de la question**
  (`/orchestrer-plan` Étape 3) — une ligne par option, exactement :
  `N. <option> — <coût> · débloque <ce que ça rouvre>`, numérotées à partir de 1, plus une
  recommandation. Exemple : `1. Committer la migration manquante, puis rejouer N0 — 5 min ·
  débloque la tâche T3`. L'orchestrateur recopie ces lignes sans rien reformuler : c'est pour ça
  qu'elles s'écrivent déjà dans ce format, pas dans un autre qu'il faudrait ensuite retoucher.
  C'est cette section qui devient la question posée à l'utilisateur (`/orchestrer-plan` Étape 3, la question) —
  l'écrire pour quelqu'un qui n'a rien vu de la session.
  **Et une ligne mécanique en tête du rapport**, sous `Mesure :` : `Auto : oui · option <m>` si
  l'option recommandée est un correctif localisé (`WORKFLOW.md` §9a, les quatre conditions) ou un
  geste dans l'objectif inchangé du plan, réversible et jugé par la gate de la session ;
  `Auto : non` dès qu'elle étend l'objectif, touche l'irréversible, élargit une permission, ou
  qu'un jugement N2 départage les options. L'orchestrateur applique `oui` sans te demander (action `enqueter`).

Ne jamais rendre `PISTE` sur une piste déjà présente dans « Déjà écarté » : ce serait faire
repayer le chemin que cette section existe pour épargner. Si tout ce qui vient est déjà écarté,
c'est `OPTIONS`.
