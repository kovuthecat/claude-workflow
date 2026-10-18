# Cas rares de `/nouveau-plan`

Annexe de `/nouveau-plan` : lue seulement quand le cas se présente. Quatre sections — mode extension,
seuil unique, écart n°11, colonne Env. héritée.

## Mode extension — ajouter des sessions à un plan en cours

Un plan en cours peut produire un résultat qui invalide une hypothèse dont dépendent ses sessions
restantes : vérité de référence fausse, contrat à changer, mesure qui contredit l'attendu d'une
gate. La correction est du travail non prévu, mais **au service de l'objectif inchangé du plan**.
L'écrire comme un plan `P<n+1>` crée une récursion — `P20` pour finir `P19` pour finir `P16` — où
le plan bloqué ne se ferme qu'après un plan qui ne se ferme qu'après un autre.

**Critère d'aiguillage, unique** : la correction débloque-t-elle une session restante de `P<n>`,
l'« Objectif d'ensemble » de `P<n>` restant vrai tel qu'il est écrit ?

- **Oui → mode extension.** Ajouter des sessions à `plans/P<n>/` existant. Étapes 1, 2 et 4
  inchangées ; l'Étape 3 modifie l'`index.md` au lieu de le créer.
- **Non** — l'objectif lui-même bouge, ou la correction sert plusieurs plans → mode normal, plan
  neuf, et le plan bloqué note sa dépendance dans son ordonnancement.

**Plafond** : une **troisième** vague de remédiation sur le même plan n'est plus une extension,
c'est la prémisse du plan qui est fausse. S'arrêter et dérouler `/cadrer` sur cette prémisse.

**L'exploration ouverte arrive plus tôt** : dès la première prémisse comportementale non sondable
rencontrée à l'Étape 1 — pas seulement au deuxième plan tué sur la zone —, dérouler `/cadrer`, qui
sortira par un protocole de preuve, plutôt que de continuer à découper un plan sur une inconnue.

### Modifier l'index, ne pas le récrire

Trois éditions ponctuelles, rien de plus :

1. **Table des sessions** : ajouter les lignes en continuant la numérotation du plan. Jamais de
   `S5bis` — le repère `Plan: P<n>/S<k>/T<m>` des commits doit rester unique et triable.
2. **Ordonnancement** : insérer la vague **avant** celles qu'elle débloque, avec sa cause dans le
   titre — `- **Vague <w> — remédiation de S<j> (ajoutée le YYYY-MM-DD)** : S8 · S9.` (tiret
   initial, date dans le gras — la forme lue sans tolérance par `prochaine-action.mjs` : sans le tiret
   ni la date à l'intérieur des `**`, la vague entière était ignorée, incident MYO du 2026-09-22).
   Sans cette trace, un plan relu dans un mois ne distingue plus le prévu du réparé. La vague ajoutée
   porte son *Pourquoi maintenant* et ses lignes « en clair » comme les autres : une vague de
   remédiation est ce que l'utilisateur n'avait pas prévu de lire.
3. **Statuts en aval** : une session déjà `[x]` dont le résultat repose sur l'hypothèse invalidée
   redevient `[ ]`, et on le dit explicitement à l'utilisateur. Un vert faux coûte plus cher qu'un
   statut manquant.

L'« Objectif d'ensemble » ne bouge pas. S'il faut le récrire, ce n'était pas une extension. En mode
extension, `verifier-plan.mjs` prend `--extension`, et `TASKS.md` ne reçoit que les tâches ajoutées.

## Seuil unique — domicile de « encore un plan ou `/cadrer` »

C'est le seul endroit du workflow qui définit ce seuil ; tout autre texte qui l'évoque y renvoie,
sans le reformuler ni recalculer son propre compteur.

- **zone** = les chemins de la colonne « Zone modifiée » de l'index.
- **Un plan a été tué sur une prémisse** si un de ses `.echec.md` a porté `Nature : prémisse`, **y
  compris supprimé** (`/reprendre-echec` le supprime une fois l'échec résolu — un `grep` sur les
  fichiers présents sous-compte) :
  `git log --all -p --diff-filter=AD -- 'plans/*/*.echec.md' | grep -n 'Nature :.*pr[ée]misse'`.
- **Deuxième plan tué sur la même zone avec cette cause → ne pas en écrire un troisième.** La
  réponse n'existe qu'à l'exécution, et un plan de plus gèlera en « tranché » ce qui a tué le
  précédent — c'est ainsi qu'une zone finit par ne plus contenir le geste qu'un humain fait.
  Dérouler `/cadrer`, qui sortira par un protocole de preuve. `prémisse` est le mode d'échec
  dominant du workflow : une fois, c'est le système qui fonctionne ; c'est la **répétition sur une
  même zone** qui est le signal.
- La règle de la **troisième vague de remédiation** (ci-dessus) reste, inchangée : c'est un
  deuxième compteur, sur le même plan plutôt que sur la zone, et les deux s'appliquent.

## Écart n°11 — le brief et les règles non appliqués

À traiter avant de committer le plan : ligne `Brief : <section> : …` non appliquée → réécrire la
section dans un commit séparé `docs(brief): applique <décision>` portant `Brief-applique: <chemin>`,
puis relancer le script ; ligne absente → l'ajouter (`inchangé` ou section) dans ce même commit ;
ligne ambiguë (section ou changement indéduisibles) → `/cadrer`, pas de plan.

Même traitement pour une ligne `Règles : <règle> : …` non appliquée : réécrire la règle dans
`CLAUDE.md` § Règles spécifiques, commit séparé `docs(regles): applique <décision>` portant
`Regles-appliquees: <chemin>`, puis relancer le script ; ligne absente → pas d'écart (décision
d'avant la règle).

## Colonne Env. héritée

Toujours `—` (sous-agent, seule voie, `WORKFLOW.md` §5b). L'effort écrit sur une ligne est celui
auquel la session tournera : `/orchestrer-plan` la lance en passant cet effort à l'outil `Agent`
(§3). `max` n'est pas une valeur d'index : le moteur la refuse. *Plan ancien : `Desktop` se lit
comme `—` ; `headless` se lit comme `—` (sous-agent).*
