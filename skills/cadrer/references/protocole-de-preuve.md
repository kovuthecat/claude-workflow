# Le protocole de preuve — quand la réponse n'existe qu'à l'exécution

Annexe de `/cadrer` (issue « Preuve à faire », Étape 5). Lue seulement quand une question ne se
tranche pas en lecture.

S'écrit sous une section `## Protocole de preuve` dans `docs/decisions/<date>-<sujet>.md` : c'est
l'emplacement que `/nouveau-plan` relit (grille de préparation), pas un
fichier à part.

**Signal d'entrée**, l'un des suivants suffit : une première prémisse comportementale non
sondable en lecture ; une enquête `OPTIONS` sans option satisfaisante ; le seuil « deuxième plan tué
sur la même zone » (domicile et définition : « Seuil unique » de `/nouveau-plan`) ; ou le
critère de succès ne s'énonce pas comme un nombre que le code d'aujourd'hui produit déjà de façon
stable — si la cible bouge quand on change la définition, il n'y a pas de plan à écrire, il y a une
mesure à établir d'abord.

Le protocole remplace la décision. Il porte au minimum :

- **la question**, et **la mesure** qui y répond ;
- **ce qui compterait comme réponse positive ET négative** — une preuve dont le résultat négatif
  n'était pas écrit d'avance ne conclut rien, elle se relit comme un échec ;
- **la branche** (jetable, jamais `main`) et **le budget** annoncé, en tours ou en temps.

Ce qui borne la preuve à la place du périmètre fermé : la branche, le budget, et **N0 à la fin sur
le résultat** — une preuve qui ne passe pas N0 n'est pas une preuve.

**Pendant une preuve, tout est contestable, y compris le juge et les décisions de la zone.** Un
écart trouvé dans l'instrument de mesure est un **résultat**, pas un échec. Et une preuve peut
**dégeler un « tranché »** — c'est la seule chose du workflow qui en ait le droit, et c'est ce qui
l'empêche de reproduire le cliquet qui a vidé une zone en cinq plans.

**Ce qui revient**, dans cet ordre : la mesure et la commande qui la reproduit ; ce qui a été réfuté
(décisions, hypothèses, ou l'instrument lui-même) — c'est la partie de plus grande valeur, et celle
qu'un plan fermé ne peut pas produire ; le **code candidat** sur sa branche. Être vert ne suffit pas
à le faire entrer : la décision qui suit tranche, après une passe `relecteur-session`.

**La preuve est orchestrable**  : session de type `exploration` dans un plan (bandeau `Régime :
ouvert`), lancée en sous-agent, sur branche jetable poussée avec budget écrit —
l'humain lit le résultat, pas le processus. Un exécutant de plan ne bascule jamais en preuve de
lui-même : c'est `/nouveau-plan` qui écrit la session `exploration`, pas une session en cours qui s'y
improvise.
