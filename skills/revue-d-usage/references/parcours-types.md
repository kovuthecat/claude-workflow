# Parcours types — les dériver des écrans avant de parcourir

Annexe de `/revue-d-usage`, Étape 2. On ne découvre pas les parcours en cliquant au hasard : on les
**dérive** de ce que l'app déclare (`ARCHITECTURE.md`, écrans) et de ce que l'inventaire
`read_page` a trouvé, puis on les propose à l'interview. L'idée vient de `gotalab/uxaudit` : dériver
du code avant de parcourir.

Retenir **5 à 8 parcours**. Un parcours type qui ne correspond à aucun écran de l'app ne se retient
pas. Un parcours qui **écrit** se joue seulement si le backend est local, et jamais s'il est
irréversible.

| # | Parcours type | Le dériver de | Écrit ? |
| --- | --- | --- | --- |
| 1 | **Premier contact / inscription** | écran d'accueil + formulaire d'inscription ou de première configuration (`ARCHITECTURE.md` : route publique, champ `password` ou `email` dans l'inventaire) | oui : compte local seulement, backend distant → manuel |
| 2 | **Chemin de valeur** | la tâche principale du brief (`PROJECT_BRIEF.md`, objectif) : la suite d'écrans qui la réalise, du point d'entrée au résultat visible | selon la tâche |
| 3 | **Récupération d'erreur** | le formulaire principal du chemin de valeur, joué avec une saisie invalide puis corrigée | non, si l'erreur est levée côté client |
| 4 | **Retour d'un utilisateur connu** | écran de connexion, puis l'écran d'arrivée d'un utilisateur qui a déjà des données | non |
| 5 | **Recherche / filtre** | tout écran de liste avec un champ de recherche, un filtre ou un tri dans l'inventaire | non |
| 6 | **Réglages** | écran de profil, de préférences ou de paramètres | oui : modification locale, rétablie à la fin du parcours |
| 7 | **Sortie / suppression** | déconnexion, suppression de compte ou de données | **toujours manuel** |
| 8 | **Navigation transverse** | le menu principal : chaque entrée ouvre-t-elle son écran, et le retour ramène-t-il où on était ? | non |

## Comment écrire un parcours dérivé

Une ligne de proposition pour l'interview, puis 3 à 8 gestes :

```
<n>. <nom> — écrans : <A> → <B> → <C> · écrit : non | local | manuel
   1. navigate <route A>
   2. form_input <champ> ← <valeur nominale>
   3. computer clic « <libellé> » → attendu : <écran B, élément visible>
```

- **Écrans** : les nommer comme `ARCHITECTURE.md`, pour que la matrice du rapport se lise contre
  lui. Un écran de l'inventaire que `ARCHITECTURE.md` ignore se nomme par sa route, et c'est un
  écart brief/app à signaler.
- **Écrit** : `non` · `local` (le backend est local, la donnée créée reste sur le poste) · `manuel`
  (backend distant, ou action irréversible).
- **Attendu** : ce que l'écran suivant doit montrer, tiré du brief ou de `ARCHITECTURE.md`. Un
  attendu qu'aucun fichier ne donne se demande à l'interview, il ne s'invente pas.

## Données de test

Des valeurs **visiblement fictives**, jamais une donnée réelle de l'utilisateur :
`revue.usage+<date>@example.test`, `Test Revue`, `0600000000`. Une valeur **limite** par champ texte :
une chaîne de 200 caractères, sans espace, et une autre avec accents et emoji. Une valeur
**invalide** par champ contraint : e-mail sans `@`, date au 31 février, nombre négatif.
