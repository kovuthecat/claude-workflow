# Grille WCAG 2.1 AA, version courte, observable au navigateur in-app

Annexe de `/revue-d-usage`, passe **accessibilité**. Elle ne couvre que les critères qu'un parcours
dans le navigateur in-app peut **mesurer**. Ce qui demande un lecteur d'écran réel (VoiceOver, NVDA),
un zoom à 200 % ou un jugement sur le sens d'un texte ne s'y trouve pas. Ça va dans la checklist
manuelle du rapport, jamais dans un constat.

Adaptée de `design:accessibility-review` (plugin du poste, non vendoré) et de la *Quick Reference*
du W3C (WCAG 2.1). Les intitulés sont reformulés, ce ne sont pas ceux de la norme.

## Sévérité (échelle commune aux grilles de la revue)

| Sévérité | Quand | Domicile |
| --- | --- | --- |
| `bloquant` | le parcours ne s'achève pas, ou un critère de niveau **A** est violé | `TASKS.md` + rapport |
| `majeur` | le parcours s'achève au prix d'un contournement, ou un critère **AA** est violé | `TASKS.md` + rapport |
| `mineur` | gêne sans détour, ou seuil de confort dépassé (AAA, repère) | rapport seul |

C'est la sévérité qui décide du domicile, pas l'impression laissée. Un critère dont la mesure est
impossible sur l'écran (fond en image, couleur hors `rgb()`) ne reçoit pas de sévérité : il devient
une ligne de checklist manuelle, avec la raison.

## Règle de `javascript_exec`

`javascript_tool` (action `javascript_exec`) sert **à l'inspection, en lecture seule** :
`document.activeElement`, `getComputedStyle`, `getBoundingClientRect`, `document.title`,
`document.documentElement.scrollWidth`, `location.href`. **Jamais** d'écriture dans le DOM (ni
`style`, ni `setAttribute`, ni `innerHTML`), **jamais** de `click()`, `focus()` ou `submit()`
scripté, **jamais** de `fetch` ni de stockage modifié. L'outil est réservé à l'inspection : un geste
scripté fausse ce qu'un utilisateur vivrait. Les gestes passent par `computer` (clic, saisie, `key`)
et `form_input`.

**Clavier, méthode unique** : cliquer d'abord une zone neutre de la page (texte hors lien), sinon le
focus part d'un endroit indéterminé. Puis `computer` `key` `Tab`, un pas à la fois. Après chaque pas,
`javascript_exec` renvoie
`({ el: document.activeElement.outerHTML.slice(0, 120), outline: getComputedStyle(document.activeElement).outlineStyle, ombre: getComputedStyle(document.activeElement).boxShadow })`.
`read_page` n'expose pas le focus, et `zoom` n'est pas disponible dans le Browser pane.

**Contraste, mesure outillée** (lecture seule ; `prop` vaut `'color'` pour un texte,
`'borderTopColor'` pour un contour de champ) :

```js
(() => { const el = document.querySelector('<sélecteur>'), prop = 'color';
  const rgb = s => s.match(/[\d.]+/g).map(Number);
  const lum = ([r, g, b]) => { const f = c => (c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  let n = el.parentElement, fond = 'rgb(255, 255, 255)';
  for (let m = prop === 'color' ? el : n; m; m = m.parentElement) {
    const c = getComputedStyle(m).backgroundColor; if (rgb(c)[3] !== 0) { fond = c; break; } }
  const cs = getComputedStyle(el), a = lum(rgb(cs[prop])), b = lum(rgb(fond));
  return { avant: cs[prop], fond, ratio: +((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2),
    taille: cs.fontSize, graisse: cs.fontWeight }; })()
```

Limites, à écrire dans le constat quand elles jouent : un fond semi-transparent est traité comme
opaque, et un fond en image ou en dégradé n'est pas lu. Une couleur hors `rgb()` (`oklch`,
`color()`) fait échouer la mesure. Dans ces trois cas, pas de constat : une ligne de checklist
manuelle.

## Critères

**1.1.1 Contenu non textuel** (A)
- Observer : `read_page` → image, icône ou bouton-image sans nom accessible (nom vide, ou nom de fichier).
- Seuil : 0 image porteuse de sens sans nom. Une image décorative sans nom est conforme.

**1.3.1 Information et relations** (A)
- Observer : `read_page` → titres (`heading` et niveau), listes, tableaux, champ associé à son libellé.
- Seuil : tout champ a un libellé lié, et les niveaux de titre ne sautent pas (h1 → h3 sans h2).

**1.4.3 Contraste du texte** (AA)
- Observer : mesure outillée ci-dessus, `prop = 'color'`, sur le texte courant et sur chaque bouton.
- Seuil : 4.5:1. Grand texte (≥ 24 px, ou ≥ 18.66 px avec une graisse ≥ 700) : 3:1.

**1.4.10 Redistribution (reflow)** (AA)
- Observer : `resize_window` 320 × 800, puis `javascript_exec` `document.documentElement.scrollWidth - document.documentElement.clientWidth`. Remettre `preset: desktop` après.
- Seuil : 0 px de défilement horizontal, hors tableaux de données et cartes.

**1.4.11 Contraste des éléments d'interface** (AA)
- Observer : mesure outillée, `prop = 'borderTopColor'`, sur le contour des champs et des cases.
- Seuil : 3:1 contre le fond adjacent (sauf si le fond du composant porte déjà le contraste).

**2.1.1 Clavier** (A)
- Observer : méthode clavier, en parcourant toute la page. Chaque élément que `read_page` (`filter: interactive`) liste doit être atteint, puis activé par `key` `Return` ou `space`.
- Seuil : 0 élément interactif hors d'atteinte. Un `div` cliquable que `Tab` saute est un constat.

**2.1.2 Pas de piège au clavier** (A)
- Observer : méthode clavier. Le focus revient sur le même élément plusieurs `Tab` de suite, et ni `shift+Tab` ni `Escape` ne l'en sortent.
- Seuil : 0 piège. Une modale qui garde le focus en son sein mais se ferme à `Escape` est conforme.

**2.4.2 Titre de page** (A)
- Observer : `javascript_exec` `document.title`, sur chaque écran du parcours.
- Seuil : titre non vide, qui nomme l'écran et diffère d'un écran à l'autre.

**2.4.3 Ordre du focus** (A)
- Observer : méthode clavier. Noter la suite des `outerHTML` et la comparer à l'ordre de lecture visible (`read_page`).
- Seuil : aucune inversion qui fait sauter une étape du formulaire ou de la tâche.

**2.4.7 Focus visible** (AA)
- Observer : méthode clavier. Relever `outline` et `ombre` de chaque élément focalisé.
- Seuil : l'un des deux ≠ `none` (un focus invisible rend `outlineStyle: none` et `boxShadow: none`).

**2.5.5 / 2.5.8 Taille de cible** (2.5.8 : AA en WCAG 2.2 ; 2.5.5 : AAA, repère)
- Observer : `javascript_exec` sur `a[href], button, input, select, textarea, [role=button]`, avec `getBoundingClientRect()` → largeur et hauteur arrondies.
- Seuil : < 24 px → `majeur` (2.5.8). De 24 à 44 px → `mineur` (2.5.5). Un lien dans une phrase est exempté.

**3.2.1 Au focus** (A)
- Observer : pendant la méthode clavier, `javascript_exec` `location.href` et `read_page` après chaque `Tab`.
- Seuil : recevoir le focus ne change ni l'URL, ni l'écran, ni n'ouvre de fenêtre.

**3.3.1 Identification des erreurs** (A)
- Observer : état « erreur de saisie ». Saisir une valeur invalide (`form_input`), soumettre, puis `read_page`.
- Seuil : un texte nomme le champ fautif et l'erreur. Une bordure rouge seule ne suffit pas.

**3.3.2 Étiquettes ou instructions** (A)
- Observer : `read_page` → chaque champ a un nom accessible. Un format contraint (date, téléphone) est annoncé avant la saisie.
- Seuil : 0 champ nommé par son seul `placeholder`, qui disparaît à la saisie.

**4.1.2 Nom, rôle et valeur** (A)
- Observer : `read_page` (`filter: interactive`) → chaque contrôle a un rôle (`button`, `checkbox`, `combobox`…), un nom, et son état (coché, déplié) change après le geste.
- Seuil : 0 contrôle sans nom ou sans rôle, 0 état figé après interaction.

## Forme d'un constat

Une ligne, toujours :

`<écran> · <critère> · mesure : <valeur> · seuil : <valeur> · <sévérité>`

Exemple : `Connexion · 2.5.8 taille de cible · mesure : bouton « Afficher » 20 × 20 px · seuil : 24 px · majeur`

**Refusé**, parce que c'est un adjectif sans mesure :
`Connexion · accessibilité · le bouton est trop petit · majeur`
