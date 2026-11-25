// Lecteur UNIQUE de `plans/P<n>/index.md` (P20/S4/T6, point 11 de la revue externe du 2026-10-13).
//
// POURQUOI CE FICHIER EXISTE
// Quatre lecteurs lisaient l'index chacun à sa façon (moteur, vérificateur, hooks, mod garde-fous) et
// ils divergeaient : `verifier-plan` refusait un en-tête de vague que le moteur acceptait. Le moteur
// va écrire dans l'index (S7) : une écriture correcte pour l'un doit être lue pareil par tous.
//
// QUI L'UTILISE
//   - `prochaine-action.mjs`, `verifier-plan.mjs` : `import … from './lire-index.mjs'` ;
//   - `plugin/hooks/lib.mjs` : `import … from '../bin/lire-index.mjs'` (bin/ et hooks/ sont vendorés
//     côte à côte, `sync-workflow.mjs`) ;
//   - les mods `garde-fous` et `affichage` : chaque mod est un plugin séparé, installé seul — il ne
//     peut pas importer `plugin/bin`. Ils reçoivent une COPIE GÉNÉRÉE, octet pour octet identique,
//     dans `plugin/mods/<mod>/hooks/lire-index.mjs` (garde-fous, affichage) :
//         node tests/tester-mods.mjs --regenerer-copies
//     et le même script, sans l'option, échoue si une copie diffère de cette source. Ne jamais éditer
//     une copie.
//   Ce fichier est chargé par `claude plugin validate` comme module d'un mod : il n'importe rien, n'a
//   ni `import()` dynamique, ni `import.meta`, ni `process` (mesuré le 2026-10-15 : `plugin validate`
//   refuse un `import()` dans un fichier de hooks). Toute commande va dans `tests/`, jamais ici.
//
// TOLÉRANCE
// Le lecteur accepte tout ce que le moteur acceptait avant lui — parenthèse entre `**` et `:` dans
// l'en-tête de vague, mots `gate` et `parallélisable` lus et ignorés, `validée`, accents dans les
// clés — et ne REFUSE rien : `analyserIndex` ne rend jamais d'erreur. Juger un écart, c'est le rôle
// de `verifier-plan.mjs`, à partir de ces données. Seul `lireIndexTexte` (moteur) rend
// `{ erreur }`, pour un texte sans session ni vague (le fichier absent, c'est l'affaire de l'appelant).
//
// FORME RENDUE (`analyserIndex(texte)`)
//   workflow         `Workflow : v<x>` → `<x>`, ou null
//   preuveN0         `Preuve N0 :` → 'requise' | 'non requise' | null
//   parallele        `Parallèle : oui` → true ; `non`, absente ou autre valeur → false (P21/S7/T15 : une
//                    vague d'un plan en parallèle part entière, chaque session dans sa copie isolée)
//   remediationOpus  `Remédiation Opus : <n>` → n (0 par défaut)
//   clos             `Clos : <date>` → la date, ou null (valeur absente)
//   aLigneClos       vrai dès qu'une ligne `Clos :` existe, avec ou sans valeur
//   sessions[]       { session:'S<k>', taches, titre, modele, effort (minuscule, sans emphase), env,
//                      dependDe, zone, statutBrut, statut:'a-faire'|'fait'|'fait-bloquant'|'autre',
//                      coche (statut fait|fait-bloquant), bloquantNonTrie (fait-bloquant),
//                      pastille }
//                    colonnes lues PAR POSITION (les neuf premières du squelette). `statut` 'autre' =
//                    marque hors vocabulaire (`[~]`…) : ni à faire ni faite.
//   sessionsIncompletes[]  ids des lignes de table portant un `S<k>` mais moins de neuf cellules : ni
//                    lues ni perdues en silence — c'est le vérificateur qui les signale
//   vagues[]         { numero, label, validationHumaine, repriseManuelle, cloture, validee,
//                      labelHorsGras, gateLegacy, sessions:['S<k>'…] }
//                    validationHumaine, repriseManuelle, validee : lus dans le gras ET après les deux-points
//                    (parenthèses retirées) ; labelHorsGras : un de ces mots ne vient que de la queue
//   lignesEnClair[]  { session, texte } — les lignes `- **S<k>** — <texte>` de l'Ordonnancement

/** Minuscules, accents retirés (NFD), backticks/`*` retirés, espaces de bord retirés — la forme sur
 * laquelle on compare une valeur écrite à la main (nature entre backticks, séparateur inhabituel) à
 * un mot attendu, sans exiger l'orthographe exacte (T4, P10/S2). */
export function normaliserSimple(s) {
  return String(s || '')
    .replace(/[`*]/g, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Découpe une ligne de table markdown en cellules (bords `|` retirés, espaces de bord retirés). */
export function cellulesDeLigne(ligne) {
  return ligne.trim().split('|').slice(1, -1).map((c) => c.trim());
}

/** Un identifiant de tâche, numéro capturé : `T3`, `T-063` (tiret et zéros de tête libres). */
export const MOTIF_TACHE = String.raw`T-?(\d+)`;

/** Numéros entiers (triés, sans doublon) des tâches d'un champ « Tâches » : `T3`, `T-063`, plage `T1-T3` ou
 * `T-063-T-065`, séparés par des virgules. Un identifiant se COMPARE sous cette forme normalisée —
 * `T-063` ≡ `T63` ≡ `T063` — des deux côtés (champ de l'index, ligne `Plan: P<n>/S<k>/T…` des commits) :
 * sans quoi le défaut se déplace au lieu de disparaître (P21/S1/T2, incidents nova 2026-11-22 et
 * Journal-emotion 2026-11-07 : avec `T-063` la liste lue était vide, la session jamais `faite`). Séparateur
 * de liste : la virgule seulement — `T-063 · T-197` ne se lit pas ; `[]` signale un champ illisible. */
export function parseTaches(champ) {
  const nums = new Set();
  const motif = new RegExp(`^${MOTIF_TACHE}(?:-${MOTIF_TACHE})?$`);
  for (const morceau of String(champ || '').split(',').map((s) => s.trim()).filter(Boolean)) {
    const m = motif.exec(morceau);
    if (!m) continue;
    const debut = Number(m[1]);
    const fin = m[2] ? Number(m[2]) : debut;
    for (let i = debut; i <= fin; i++) nums.add(i);
  }
  return [...nums].sort((a, b) => a - b);
}

function statutNormalise(cellule) {
  const m = /\[( |x)\](!)?/.exec(cellule);
  if (!m) return 'autre';
  if (m[1] === ' ') return 'a-faire';
  return m[2] ? 'fait-bloquant' : 'fait';
}

/** Lit le texte d'un index. Pure, ne lève pas, ne rend pas d'erreur (cf. « TOLÉRANCE » en tête). */
export function analyserIndex(contenu) {
  const lignes = String(contenu ?? '').replace(/\r\n/g, '\n').split('\n');
  const texte = lignes.join('\n');

  const ligneWorkflow = lignes.find((l) => /^Workflow\s*:/.test(l.trim()));
  const workflow = ligneWorkflow ? (/Workflow\s*:\s*v?(\S+)/.exec(ligneWorkflow)?.[1] ?? null) : null;

  // Deux lignes facultatives, hors table (T6, P10/S2) : `Remédiation Opus :`, écrite par
  // l'orchestrateur — survit à la suppression des `.echec.md` au PASS, contrairement à un total
  // recalculé sur les rapports présents ; `Clos :`, posée par `fin-de-plan.md`.
  const ligneRemediationOpus = lignes.find((l) => /^Rem[ée]diation\s+Opus\s*:/i.test(l.trim()));
  const remediationOpus = ligneRemediationOpus
    ? Number(/:\s*(\d+)/.exec(ligneRemediationOpus)?.[1] ?? 0)
    : 0;
  const ligneClos = lignes.find((l) => /^Clos\s*:/.test(l.trim()));
  const clos = ligneClos ? (/:\s*(\S+)/.exec(ligneClos)?.[1] ?? null) : null;

  const preuveN0 = /^Preuve N0\s*:\s*(non requise|requise)\s*$/m.exec(texte)?.[1] ?? null;
  // `Parallèle : oui | non` (accent et casse libres) : seul `oui` active le parallèle — une valeur illisible
  // garde le plan en série, le comportement d'avant la ligne.
  const ligneParallele = lignes.find((l) => /^parallele\s*:/.test(normaliserSimple(l)));
  const parallele = ligneParallele ? /^oui\b/.test(normaliserSimple(ligneParallele.slice(ligneParallele.indexOf(':') + 1))) : false;

  // Table des sessions : colonnes fixées par le squelette (nouveau-plan/references/squelette-index.md).
  const sessions = [];
  const sessionsIncompletes = [];
  for (const ligneBrute of lignes) {
    const l = ligneBrute.trim();
    if (!l.startsWith('|')) continue;
    const cellules = cellulesDeLigne(l);
    const idSession = /\bS(\d+)\b/.exec(cellules[0] ?? '');
    if (!idSession) continue; // en-tête ou ligne de séparateur (---)
    if (cellules.length < 9) {
      sessionsIncompletes.push(`S${idSession[1]}`); // lue par personne, signalée par le vérificateur
      continue;
    }
    const statut = statutNormalise(cellules[8]);
    sessions.push({
      session: `S${idSession[1]}`,
      taches: cellules[1],
      titre: cellules[2],
      modele: cellules[3],
      effort: cellules[4].replace(/[`*]/g, '').trim().toLowerCase(),
      env: cellules[5],
      dependDe: cellules[6],
      zone: cellules[7],
      statutBrut: cellules[8],
      statut,
      coche: statut === 'fait' || statut === 'fait-bloquant',
      bloquantNonTrie: statut === 'fait-bloquant',
      pastille: false, // complété plus bas, depuis l'ordonnancement
    });
  }

  // Ordonnancement : vagues (numéro, label, sessions membres) + lignes en clair + marqueur `pastille`.
  const vagues = [];
  const lignesEnClair = [];
  let dansOrdonnancement = false;
  for (const ligneBrute of lignes) {
    const l = ligneBrute.trim();
    if (/^##\s+Ordonnancement/.test(l)) {
      dansOrdonnancement = true;
      continue;
    }
    if (dansOrdonnancement && /^##\s+/.test(l)) {
      dansOrdonnancement = false;
      continue;
    }
    if (!dansOrdonnancement) continue;

    // Tiret initial facultatif, parenthèse facultative entre `**` et `:` (ancien format de la ligne
    // d'extension — incident MYO du 2026-09-22 : une vague jamais lancée faute de tiret ou de
    // ponctuation au bon endroit, T4/P10/S2). Une parenthèse aussi juste après le numéro, DANS le gras
    // (`**Vague 2 (après S1)** :`, P20/S4) : lue, ignorée — le vérificateur la refusait déjà côté `**`.
    const enteteVague = /^(?:-\s*)?\*\*Vague\s+(\d+)(?:\s*\([^)]*\))?(?:\s*—\s*([^*]+?))?\*\*\s*(?:\([^)]*\)\s*)?:\s*(.+)$/.exec(l);
    if (enteteVague) {
      const labelBrut = enteteVague[2] ? enteteVague[2].trim() : null;
      const labelNormalise = (labelBrut || '').toLowerCase();
      // Toutes les parenthèses retirées avant de chercher les membres `S\d+` — sinon un membre après
      // la première parenthèse (date d'ajout, commentaire) est perdu (constat 2026-09-24).
      const membres = enteteVague[3].replace(/\([^)]*\)/g, '');
      // Les mots-clés de vague se lisent aussi APRÈS les deux-points (`**Vague 1** : S1 · S2 (…) —
      // validation-humaine.`, forme écrite par trois projets, incident EBM-MSPv2 2026-10-25 et nova
      // 2026-11-23, P21/S1/T1) : ignorés, l'arrêt humain sautait sans signal. La recherche porte sur la
      // queue SANS ses parenthèses (même `membres` que ci-dessus) : « (après la validation-humaine de S2) »
      // ne déclenche rien. `labelHorsGras` : au moins un mot ne vient QUE de la queue — le vérificateur
      // le signale (forme non canonique), le lecteur ne la refuse pas.
      const queue = normaliserSimple(membres);
      const grasNorm = normaliserSimple(labelBrut || '');
      const motsQueue = ['validation-humaine', 'reprise-manuelle', 'validee'];
      const lit = (mot) => grasNorm.includes(mot) || queue.includes(mot);
      vagues.push({
        numero: Number(enteteVague[1]),
        label: labelBrut,
        validationHumaine: lit('validation-humaine'),
        repriseManuelle: lit('reprise-manuelle'),
        cloture: labelNormalise.includes('clôture'),
        // « validée » (accents/casse libres) acquitte explicitement une validation-humaine (T5, P10/S2).
        validee: lit('validee'),
        labelHorsGras: motsQueue.some((mot) => queue.includes(mot) && !grasNorm.includes(mot)),
        gateLegacy: labelNormalise.includes('gate'), // ancien mot : signalé, jamais interprété
        sessions: [...membres.matchAll(/S\d+/g)].map((m) => m[0]),
      });
      continue;
    }

    // Ligne « en clair » d'une session : `  - **S<k>** — <texte>`. Seul le mot `pastille` y compte ici.
    const sousLigne = /^-\s*\*\*(S\d+)\*\*\s*[—-]\s*(.*)$/.exec(l);
    if (sousLigne) {
      lignesEnClair.push({ session: sousLigne[1], texte: sousLigne[2] });
      if (/\bpastille\b/.test(sousLigne[2])) {
        const s = sessions.find((x) => x.session === sousLigne[1]);
        if (s) s.pastille = true;
      }
    }
  }

  return { workflow, preuveN0, parallele, remediationOpus, clos, aLigneClos: Boolean(ligneClos), sessions, sessionsIncompletes, vagues, lignesEnClair };
}

/** Chemins d'une zone = seuls les segments entre backticks de la cellule « Zone modifiée » ; le texte
 * hors backticks ( `(§9a, §9c)`, `(4 fichiers créés)`, `(nouveau)` ) est ignoré. Accolades développées
 * avant comparaison. Segment avec `*`/`**` ou accolades non appariées → `{ chemins: [], illisible: <segment> }`.
 * Partagé par le moteur (arbre sale avant `lancer`, recoupement d'une vague parallèle) et le vérificateur. */
export function cheminsDeZone(cellule) {
  const segments = [...String(cellule || '').matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  const chemins = [];
  for (const seg of segments) {
    const ouvrantes = (seg.match(/\{/g) || []).length;
    const fermantes = (seg.match(/\}/g) || []).length;
    if (seg.includes('*') || ouvrantes !== fermantes) {
      return { chemins: [], illisible: seg };
    }
    if (ouvrantes === 0) {
      chemins.push(seg);
      continue;
    }
    const m = /^(.*)\{([^{}]*)\}(.*)$/.exec(seg);
    if (!m) return { chemins: [], illisible: seg };
    const [, prefixe, options, suffixe] = m;
    for (const option of options.split(',')) chemins.push(`${prefixe}${option.trim()}${suffixe}`);
  }
  return { chemins, illisible: null };
}

/** Deux chemins de zone se recoupent : égaux, ou l'un est un dossier qui contient l'autre (préfixe de chemin
 * commun, au séparateur près : `src/a` ne recoupe pas `src/ab.mjs`). */
export function cheminsSeRecoupent(a, b) {
  const dossier = (c) => `${c.replace(/\/+$/, '')}/`;
  return a === b || b.startsWith(dossier(a)) || a.startsWith(dossier(b));
}

/** Recoupements de zones entre les sessions données (objets `{ session, zone }` de `analyserIndex`) :
 * `[{ a, b, cheminA, cheminB }]`, un par paire de sessions (premier chemin commun trouvé). Une zone
 * illisible ou `aucune` ne recoupe rien (l'illisible est l'affaire du contrôle d'arbre sale). P21/S7/T15. */
export function recoupementsDeZones(sessions) {
  const zones = sessions.map((s) => ({ session: s.session, chemins: cheminsDeZone(s.zone).chemins }));
  const trouves = [];
  for (let i = 0; i < zones.length; i++) {
    for (let j = i + 1; j < zones.length; j++) {
      let paire = null;
      for (const ca of zones[i].chemins) {
        const cb = zones[j].chemins.find((c) => cheminsSeRecoupent(ca, c));
        if (cb !== undefined) { paire = { cheminA: ca, cheminB: cb }; break; }
      }
      if (paire) trouves.push({ a: zones[i].session, b: zones[j].session, ...paire });
    }
  }
  return trouves;
}

/** Pour le moteur : `analyserIndex`, ou `{ erreur }` quand l'index n'a ni session ni vague — il ne
 * conclut rien d'un index qu'il ne comprend pas. `etiquette` : le chemin, repris dans le message. */
export function lireIndexTexte(contenu, etiquette = 'index.md') {
  const index = analyserIndex(contenu);
  if (index.sessions.length === 0) return { erreur: `index illisible : aucune session reconnue dans la table (${etiquette})` };
  if (index.vagues.length === 0) return { erreur: `index illisible : aucune vague reconnue sous « ## Ordonnancement » (${etiquette})` };
  return index;
}
