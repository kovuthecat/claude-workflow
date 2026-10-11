# Aiguillage des protocoles de méthode

Annexe de `/cadrer` Étape 2 — à ouvrir seulement si l'aiguillage ne rend pas `NONE`.

Nommer une méthode n'améliore pas le raisonnement ; choisir de n'en nommer aucune quand la réponse est évidente économise le contexte le plus cher. Une fiche ne coûte rien tant qu'elle n'est pas ouverte ; sa valeur se mesure à la décision produite, jamais au vocabulaire employé.

## NONE — la réponse normale

`NONE` se rend dans cinq cas (routeur `cc-thinking-skills`) :
- la réponse est déjà évidente ;
- implémentation routinière, sans inconnue analytique ;
- exécution en cours d'un plan déjà convenu ;
- question hors catalogue ;
- aucune fiche n'améliore clairement le travail.

**Une fiche à la fois** ; une seconde seulement pour une question distincte. Toute fiche ouverte rend trois lignes dans la décision : `Question que seule cette méthode pose :`, `Angle mort :`, `Abandon si :`.

## Table d'aiguillage

| Fiche | Signal | Sortie vérifiable | Arrêt |
| --- | --- | --- | --- |
| Causalité | cause inconnue, plusieurs explications plausibles | hypothèses + le test qui les distingue, résultat négatif écrit d'avance | une hypothèse explique les observations, ou budget de preuve atteint |
| Carte–territoire | doc, test ou métrique contredit par l'observation | contradiction localisée, source à requalifier, observation reproductible | désaccord résolu ou circonscrit |
| Réversibilité | choix difficile à annuler | coût de retour, point d'engagement, option minimale | une option satisfait contraintes et risque accepté |
| Pré-mortem | changement qui peut échouer de plusieurs façons | 3 à 5 modes d'échec, chacun relié à une prévention ou un test | les risques déterminants sont couverts |
| Séparation des contraintes | exigences apparemment incompatibles | conditions où chacune s'applique, scénario qui valide la coexistence | solution viable ou arbitrage explicite |
| Seuil d'arrêt | recherche qui accumule les options | contraintes obligatoires et niveau « suffisant » annoncé | premier candidat suffisant, sauf risque documenté |

Forme d'une fiche : titre · **Signal** (1 ligne) · **Ne pas ouvrir si** (1 ligne) · **Méthode** (3-5 lignes) · **Sortie** (les trois lignes obligatoires + la sortie vérifiable) · **Arrêt**.

### Causalité
**Signal** : plusieurs causes plausibles expliquent l'observation, aucune ne s'impose en lecture.
**Ne pas ouvrir si** : une seule cause est déjà démontrée par une lecture du dépôt.
**Méthode** : lister les hypothèses concurrentes ; pour chacune, le fait qui la confirmerait et celui qui la réfuterait ; choisir le test qui les distingue le plus vite, résultat négatif écrit avant de le lancer.
**Sortie** : `Question que seule cette méthode pose :` / `Angle mort :` / `Abandon si :`, puis hypothèses + test discriminant, résultat négatif écrit d'avance.
**Arrêt** : une hypothèse explique les observations, ou le budget de preuve annoncé est atteint.

### Carte–territoire
**Signal** : un document, un test ou une métrique dit une chose que l'observation contredit.
**Ne pas ouvrir si** : la réponse n'existe qu'à l'exécution — c'est le protocole de preuve, `/cadrer` Étape 5.
**Méthode** : localiser précisément la contradiction (fichier, ligne, date de la source) ; requalifier la source périmée plutôt que la corriger en silence ; rendre l'observation reproductible par un tiers.
**Sortie** : les trois lignes obligatoires, puis contradiction localisée, source à requalifier, observation reproductible.
**Arrêt** : le désaccord est résolu, ou circonscrit à un périmètre nommé.

### Réversibilité
**Signal** : un choix coûte cher à annuler une fois pris (dépendance, schéma, contrat public).
**Ne pas ouvrir si** : revenir en arrière ne coûte qu'un commit — ce n'est pas un choix difficile.
**Méthode** : chiffrer le coût de retour en arrière ; situer le point d'engagement (jusqu'où c'est gratuit d'annuler) ; chercher l'option minimale qui ne ferme rien de plus que nécessaire.
**Sortie** : les trois lignes obligatoires, puis coût de retour, point d'engagement, option minimale retenue.
**Arrêt** : une option satisfait les contraintes avec un risque accepté explicitement.

### Pré-mortem
**Signal** : le changement peut échouer de plusieurs façons indépendantes, pas encore listées.
**Ne pas ouvrir si** : un seul mode d'échec est visible et déjà couvert par un test.
**Méthode** : imaginer l'échec déjà survenu ; lister 3 à 5 causes plausibles ; relier chacune à une prévention (code, garde-fou) ou un test qui l'aurait détectée.
**Sortie** : les trois lignes obligatoires, puis 3 à 5 modes d'échec, chacun relié à une prévention ou un test.
**Arrêt** : les risques déterminants sont couverts par une prévention ou un test.

### Séparation des contraintes
**Signal** : deux exigences semblent s'exclure (ex. rapidité et exhaustivité).
**Ne pas ouvrir si** : les deux exigences visent des moments ou des cas différents, déjà évident.
**Méthode** : nommer les conditions où chaque exigence s'applique réellement ; chercher si elles se recouvrent ; construire un scénario qui montre la coexistence sous ces conditions.
**Sortie** : les trois lignes obligatoires, puis conditions d'application de chacune, scénario de coexistence validé.
**Arrêt** : une solution viable existe, ou l'arbitrage entre les deux est rendu explicite.

### Seuil d'arrêt
**Signal** : la recherche d'options s'allonge sans qu'aucune décision n'arrive.
**Ne pas ouvrir si** : un candidat satisfait déjà toutes les contraintes obligatoires.
**Méthode** : lister les contraintes obligatoires (pas les préférences) ; définir ce que « suffisant » veut dire ici, avant d'examiner un candidat de plus ; arrêter au premier qui les satisfait.
**Sortie** : les trois lignes obligatoires, puis contraintes obligatoires et niveau « suffisant » annoncé par écrit.
**Arrêt** : le premier candidat suffisant est retenu, sauf risque documenté qui justifie de continuer.
