# Grille des 10 heuristiques de Nielsen, observable au navigateur in-app

Annexe de `/revue-d-usage`, passe **ergonomie**. Chaque heuristique est ramenée à des **signes
observables dans un parcours**. Un signe est quelque chose que `read_page`, `read_network_requests`,
`read_console_messages` ou `javascript_exec` (lecture seule) rend, après un geste joué avec `computer`
ou `form_input`. Une heuristique qu'on ne peut relever qu'à l'avis, sans mesure, n'est pas notée ici.

Adaptée de `design:design-critique` (plugin du poste, non vendoré) et des *10 usability heuristics*
de Jakob Nielsen (nngroup.com). Les formulations sont reprises à neuf.

## Sévérité (échelle commune aux grilles de la revue)

| Sévérité | Quand | Domicile |
| --- | --- | --- |
| `bloquant` | le parcours ne s'achève pas, ou un critère WCAG de niveau **A** est violé | `TASKS.md` + rapport |
| `majeur` | le parcours s'achève au prix d'un contournement, ou un critère WCAG **AA** est violé | `TASKS.md` + rapport |
| `mineur` | gêne sans détour | rapport seul |

C'est la sévérité qui décide du domicile, pas l'impression laissée. Ici, la question est toujours
la même : **le parcours s'achève-t-il, et à quel prix ?**

## Règle de `javascript_exec`

Lecture seule : `document.activeElement`, `getComputedStyle`, `getBoundingClientRect`,
`document.title`, `location.href`. Jamais d'écriture dans le DOM, jamais de `click()` ni de
`submit()` scripté, jamais de `fetch`, parce que l'outil est réservé à l'inspection. Les gestes
passent par `computer` et `form_input`.

**Mesurer un délai** : relire avec `read_page` juste après le geste, puis après `computer` `wait` de
1 s, puis de 10 s. Les repères de temps de réponse de Nielsen sont 0,1 s (ressenti immédiat), 1 s
(le fil de pensée tient) et 10 s (l'attention décroche).

## Heuristiques

**H1 · Visibilité de l'état du système**
- Après un envoi ou un clic qui déclenche une requête (`read_network_requests`), `read_page` ne
  montre aucun changement (texte, indicateur, bouton désactivé) ni à 1 s, ni avant la réponse.
- Au-delà de 10 s d'attente, aucune indication de progression.
- Constat : `mesure : aucun retour à 1 s · seuil : retour visible < 1 s`.

**H2 · Correspondance avec le monde réel**
- Un texte visible dans `read_page` expose du jargon machine : `null`, `undefined`, `NaN`,
  `[object Object]`, un code d'erreur brut, un nom de champ interne (`user_id`).
- Une date au format ISO brut ou un nombre sans séparateur, là où l'utilisateur lit.
- Constat : `mesure : texte « <extrait> » · seuil : 0 occurrence`.

**H3 · Contrôle et liberté de l'utilisateur**
- Une modale ou un panneau sans bouton de fermeture, et `computer` `key` `Escape` n'y change rien
  (`read_page` avant et après).
- Un formulaire en plusieurs étapes sans retour arrière, ou `navigate` `back` perd la saisie.
- Une action destructrice sans confirmation ni annulation : **ne jamais la jouer**. Le signe devient
  une ligne de checklist manuelle (« vérifier qu'une confirmation précède <action> »).
- Constat : `mesure : Escape sans effet, aucun bouton fermer · seuil : une sortie au moins`.

**H4 · Cohérence et standards**
- La même action porte deux libellés sur deux écrans (« Enregistrer » ici, « Valider » là), relevés
  dans `read_page`.
- Un élément réagit au clic sans apparaître dans `read_page` (`filter: interactive`) : `div`
  cliquable sans rôle.
- Constat : `mesure : 2 libellés pour 1 action (<écran A>, <écran B>) · seuil : 1 libellé`.

**H5 · Prévention des erreurs**
- Un champ à format contraint (date, e-mail, téléphone) est un `textbox` libre, sans format
  annoncé dans son nom ni dans sa description (`read_page`).
- La soumission part (`read_network_requests`) alors qu'un champ requis est vide.
- Constat : `mesure : POST envoyé avec <champ> vide · seuil : 0 envoi invalide`.

**H6 · Reconnaître plutôt que se souvenir**
- Une information nécessaire à une étape n'est affichée qu'à l'étape précédente (un code à
  recopier, un choix fait plus tôt et qui n'est pas rappelé).
- Les critères de recherche ou de filtre sont perdus après un aller-retour (`navigate` `back`).
- Constat : `mesure : filtre vidé après retour · seuil : critères conservés`.

**H7 · Flexibilité et efficacité**
- `computer` `key` `Return` dans le dernier champ d'un formulaire ne soumet rien : aucune requête,
  aucun changement dans `read_page`.
- Une liste de plus de 20 éléments sans recherche, filtre ni tri.
- Constat : `mesure : 48 éléments, ni filtre ni tri · seuil : un moyen de réduire au-delà de 20`.

**H8 · Esthétique et design minimaliste**
- **Ne se note que dans la passe esthétique**, et seulement si l'interview l'a choisie. Son signe
  demande un avis (poids visuel, encombrement, hiérarchie), pas une mesure.
- Il ne reçoit donc **aucune sévérité** et ne va jamais dans `TASKS.md`. Il devient une proposition
  de `VALIDATION.md`, une ligne `- [ ]` formulée pour être acceptée ou refusée.
- Hors passe esthétique : ne rien noter sous H8, même une impression forte.

**H9 · Aider à reconnaître, diagnostiquer et réparer les erreurs**
- Un message d'erreur sans cause ni issue : « Erreur », « Une erreur est survenue », ou un statut
  HTTP brut.
- L'erreur de saisie est annoncée loin du champ, sans lien : aucune description du champ dans
  `read_page`.
- La saisie est perdue après l'erreur : les champs sont vides quand on les relit.
- Constat : `mesure : message « Erreur » · seuil : cause + issue nommées`.

**H10 · Aide et documentation**
- Un état vide (liste sans élément) sans explication ni action suivante.
- Un champ au format non évident sans aide contextuelle : pas de description dans `read_page`.
- Constat : `mesure : liste vide, 0 texte ni action · seuil : une explication et une action`.

## Forme d'un constat

Une ligne, toujours :

`<écran> · <critère> · mesure : <valeur> · seuil : <valeur> · <sévérité>`

Exemple : `Recherche · H1 visibilité de l'état · mesure : aucun retour 3 s après « Rechercher » · seuil : retour < 1 s · majeur`

**Refusé**, parce que c'est un adjectif sans mesure :
`Recherche · H1 · le bouton manque de réactivité · majeur`
