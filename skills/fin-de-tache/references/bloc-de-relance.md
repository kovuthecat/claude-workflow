# Bloc de relance — toute fin qui renvoie vers une session neuve

*Domicile de la règle : les autres skills y renvoient, ne la reformulent pas.*

**Sans exception** : dès qu'une session se termine en demandant à l'humain d'ouvrir une
conversation neuve — session suivante d'un plan, collecte de vague, `/orchestrer-plan` sur un index
prêt, `/nouveau-plan` après `/cadrer` ou une revue, `/reprendre-echec` à la main, escalade de
modèle, analyse ou exploration à poursuivre — elle **termine par ce bloc, copiable sans retouche,
et rien après lui**. « Lance `/nouveau-plan` », « S3 est prête » ou une pastille seule ne sont pas
une relance : l'humain devrait reconstituer le prompt et deviner quoi faire lire.

````
```
Session suivante — modèle <M> · effort <E>

<prompt exact, à coller tel quel — table ci-dessous>

Lis, dans cet ordre, et rien d'autre :
- <chemin> — <pourquoi ce fichier>
- <chemin> — <pourquoi ce fichier>

État : <où en est le travail, 2-3 lignes>
Déjà tenté et écarté : <ce qui a échoué, et pourquoi — ou « aucune »>
À faire : <objectif de la session suivante, et son critère de fin>
Commit : <sha>
Branche : <nom, ou « main »>
```
````

| Cas | Prompt exact | « Lis » contient au moins |
| --- | --- | --- |
| Session suivante d'un plan | `Ouvre plans/P<n>/S<k>.md et exécute-le.` | `plans/P<n>/S<k>.md` — sa propre section « Lire » fait le reste |
| Vague à collecter / plan prêt | `/orchestrer-plan P<n> — vague <w> : collecte et vague suivante.` | `plans/P<n>/index.md` |
| Plan à rédiger ou étendre | `/nouveau-plan <objectif en une phrase>` (`en extension de P<n>` le cas échéant) | le `docs/decisions/<fichier>.md` ou le rapport qui le motive |
| Échec à reprendre à la main | `/reprendre-echec plans/P<n>/S<k>.echec.md` | ce `.echec.md` |
| Cadrage, analyse, escalade | l'objectif, en une phrase impérative | les fichiers produits par cette session |

Le prompt nomme toujours ses chemins en entier, jamais « le plan » ou « la décision d'hier ». Cas
planifié : le `S<k>.md` est la passation, `État` / `Déjà tenté` / `À faire` tiennent en une ligne
chacune. Pastille possible (Desktop) : elle vient **en plus**, même prompt, avec la ligne « À régler
AVANT de lancer » (`WORKFLOW.md` §3).

Quatre règles pour qu'il serve à quelque chose :

- **« Déjà tenté et écarté » n'est pas optionnel.** C'est la ligne que ni un résumé ni une
  compaction ne conservent, et c'est exactement ce dont une session d'escalade a besoin — on
  escalade parce que le modèle précédent a échoué ; lui transmettre le positif sans le négatif le
  condamne à repayer les mêmes impasses. Même logique que « Écartés — ne pas reproposer » de
  `/revue-de-conception`. Rien à écarter → écrire `aucune`, jamais supprimer la ligne.
- **« et rien d'autre »** applique au cas non planifié la règle que le socle impose au cas planifié :
  un exécutant ne lit que les fichiers listés. Sans elle, la session neuve relit le contexte par
  défaut et repaie un préfixe entier (`WORKFLOW.md` §3b).
- **Bloc de code clos, dans la conversation** — pas seulement une pastille : le bloc doit être
  copiable en Desktop, VS Code, cloud et mobile. Quand une pastille est possible, elle vient **en
  plus**, avec la ligne « À régler AVANT de lancer » (`WORKFLOW.md` §3).
- **`Commit :` / `Branche :` ne sont pas optionnelles** (C3) : elles remplacent le push groupé de
  fin de vague/plan — chaque fin de tour pousse le sien, et la relance doit dire lequel. **Premier
  geste de la session suivante** : `git merge-base --is-ancestor <sha> HEAD` — confirme qu'elle est
  à jour sur ce commit avant de lire quoi que ce soit d'autre. `main` impossible à pousser (cloud) :
  `Branche :` nomme la branche réellement poussée, jamais `main` par défaut.
