# Déplier une idée jusqu'à sa question

Annexe de `/cadrer` Étape 1 — à ouvrir seulement quand on arrive avec une idée (« et si l'app
faisait X ? »), pas avec une question déjà posée.

Une idée brute porte une solution, rarement son besoin ni ce qui la rendrait réussie. Écrire la
question tout de suite ferait porter le cadrage sur la solution imaginée : on tranche « comment
faire X » sans avoir tranché « faut-il X ». Cette annexe fait émerger le besoin, puis la question.
Elle ne génère pas d'idées : un inventaire d'idées pour la roadmap n'est pas une idée à évaluer.

## Avant de demander quoi que ce soit

Lire en direct, parce que c'est court : dans `PROJECT_BRIEF.md` s'il existe, l'objectif, « Hors périmètre v1 »,
« Critères avant ajout de feature » et « Version 2 / idées futures » ; le registre `DECISIONS.md`.

- Idée déjà écartée au registre → Étape 0 : on ne la rouvre que si ce qui l'a fait écarter a changé.
- Idée déjà dans « idées futures » → repartir de sa ligne et du signal écrit à côté.
- Fait sur le code (ce qui existe, où, comment) → `explorateur` ou `analyste-flux`, jamais l'utilisateur.

## L'interview — cinq questions au plus

Règles de `/revue-de-conception` Étape 3, reprises : **une question à la fois**, réponse reformulée
en une ligne avant la suivante ; **aucune question dont la réponse est dans les fichiers** ; quand
le dépôt ou le brief en suggèrent, proposer 2 ou 3 réponses plausibles plutôt qu'une question nue.
Sauter toute question à laquelle l'idée répond déjà.

1. **Le déclencheur** — quelle situation concrète a fait naître l'idée : un usage, une gêne, un
   manque constaté ? → dimension « problème concret » de la grille.
2. **Pour qui, quand** — qui s'en servirait, dans quelle situation, à quelle fréquence ?
3. **À quoi on verra que c'est réussi** — un comportement observable, pas « la fonctionnalité
   existe » → « résultat visé » et « vérification ».
4. **Sa place dans le projet** — poser l'idée contre le brief : sert-elle l'objectif, touche-t-elle
   un hors-périmètre, passe-t-elle les critères d'ajout ? Un conflit n'est pas un refus, c'est une
   question : l'objectif bouge-t-il ? Si l'idée est retenue, la ligne `Brief :` de la décision ne
   sera pas `inchangé`.
5. **Ce qui la rendrait inutile** — une version plus petite qui rendrait l'essentiel du service,
   ou un existant (dépôt, stack, outil) qui le fait déjà. Un mécanisme neuf passe par « rechercher
   l'existant » (Étape 2).

## Ce qui revient à l'Étape 1

```
Idée : <une phrase, telle que l'utilisateur la reformulerait>
Besoin : <la situation qui la motive> | aucun nommé
Variantes à examiner : ne pas le faire · version minimale · <forme proposée> [· <autre forme>]
Question : <faut-il …, et sous quelle forme ?>
Critère de fin : <ce qui, une fois écrit, clôt la session>
```

La grille de préparation se remplit ensuite, déjà amorcée : les réponses 1 à 5 en sont les preuves,
ce qui manque y devient une `OPEN` typée. Les variantes nourrissent l'Étape 3.

## Arrêt

- **Aucun besoin nommé après les questions 1 et 2** → issue « Idée reportée » ou « Rien à faire »
  (Étape 5), sans aller plus loin : une idée sans besoin se range, elle ne se cadre pas.
- **L'idée se ramifie en plusieurs** → une seule par session ; les autres vont dans « idées futures ».
- **Seul un essai dira si l'idée tient** (ressenti, performance, faisabilité) → protocole de preuve
  (Étape 5), pas une sixième question.
- **La question était en fait déjà posée** → écrire les deux lignes de l'Étape 1 directement.
