# Squelette `plans/P<n>/S<k>.md`

Annexe de `/nouveau-plan` Étape 4 — à ouvrir **au moment d'écrire le fichier**, pas avant. Les
règles qui gouvernent ce qu'on y met sont restées dans le corps de la skill ; ici, la forme.

```md
# P<n> · S<k> — <titre>   (rédigé par Opus)

> **Modèle : <Sonnet/Haiku> · effort : <low|medium|high|xhigh> · Vague : <v> (parallèle : oui/non)**
> **Environnement : <Desktop (navigateur requis) | indifférent>** (`WORKFLOW.md` §6, N1)
> **Latitude : <ce que l'exécutant peut ajuster seul, ou aucune>** (optionnel, déclaré par le
> cadreur session par session ; absent = aucune, tout écart reste un STOP — mesure B3)
> Exécutant : UNIQUEMENT les tâches ci-dessous, dans l'ordre ; fichiers sous « Lire » / « Modifier ».
> Design fixé — ne reconçois pas. Tu t'arrêtes sur un choix que tu n'as pas reçu, pas parce que
> quelque chose a cassé : `EXECUTANT.md`.

- Date : YYYY-MM-DD · Branche : <ou —>

## Lire (commun à la session)
`${CLAUDE_PLUGIN_ROOT}/EXECUTANT.md` (toujours en premier), puis :
<fichiers + portée précise (section / fonction / lignes) — RIEN d'autre>

## Hors périmètre
<ce qu'il ne faut PAS toucher / faire — vaut pour toute la session. **Jamais l'instrument qui note
 la session** : si une gate s'appuie sur un oracle, un validateur ou un script de score du dépôt, il
 reste inspectable et contestable. Geler la cible est juste ; geler le thermomètre a produit cinq
 plans d'optimisation contre un juge qui sous-comptait (décision du 2026-09-14).>

---

## T<n> — <titre>

### Objectif
<1-2 lignes : le quoi>

### Pourquoi
<1-2 lignes : ce que cette tâche débloque dans le plan, ou ce qu'elle change pour qui se sert du
 produit. C'est l'intention — ce qui permet à l'exécutant de trancher si une consigne s'avère
 ambiguë en cours de route, et à un humain de comprendre la tâche sans lire le code.>

### Décision clé
<ce qu'il faut savoir sans relire le repo ; pointer une décision précise, ex. « docs/decisions/2026-07-12-auth.md »>

### Référence
<optionnel : chemin d'un code à imiter, un script qui fait déjà la chose, une maquette — et ce
 qu'il faut y regarder. « Fais comme là » remplace six lignes d'étapes (mesure B4).>

### Lire / Modifier
<en plus du commun : lectures spécifiques ; fichiers à modifier/créer — liste exhaustive, **ceinture
 comprise**. La ceinture, c'est ce qui fige les sorties des fichiers modifiés : fixtures golden,
 compteurs codés en dur, métadonnées validées au build. Toucher un générateur les casse
 mécaniquement — ce n'est pas une régression. Les chercher avant de clore (grep des chemins de
 sortie dans `tests/` et les fixtures) et les inclure avec leur règle de refix. Hors périmètre,
 elles rendent la gate N0 inatteignable par construction. Ceinture non identifiée → l'écrire tel
 quel : « l'exécutant l'ajoute au périmètre et le signale, sans s'arrêter » — un élargissement
 signalé coûte moins qu'un arrêt (2026-09-13 : trois arrêts, trois arbitrages, deux tours perdus).>

### Étapes
1. …

### Validation
- **N0 auto (bloque le commit)** : `<commande>` → <résultat attendu>
- **Tests** : <créés/mis à jour : fichiers, cas couverts> — ou « — » justifié en 1 ligne
- **N1 visuel auto** : <écran/parcours à vérifier au navigateur in-app, ou `—`> → `/verif-visuelle`
- **N2 humain (jugement esthétique/UX)** : <checklist ou `—`> → à consigner dans `VALIDATION.md`
- **Anti-raccourci** : <ce qui ressemblerait à un PASS sans en être un, ou `—`>

### Si bloqué
<le choix propre à cette tâche, non tranché par ce fichier — pas « ce qui pourrait casser » → STOP + quoi signaler>

### Message de commit (appliqué par la session elle-même)
`<type(scope): message>`
Dernière ligne du commit, obligatoire : `Plan: P<n>/S<k>/T<m>` — c'est le repère qui rend la tâche
retrouvable ensuite (`git log --grep`), et par lequel l'orchestrateur lit le verdict d'une session
(§5b).

---

<répéter le bloc T<n> pour chaque tâche de la session>

## Fin de session
Dérouler `/fin-de-tache` (mode selon « parallèle : oui/non » du bandeau).
```
