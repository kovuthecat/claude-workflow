// Titre de session selon la convention du workflow :
//   « Projet - P<n> - S<k> »          session de plan (prompt qui cite plans/P<n>/S<k>.md)
//   « Projet - P<n> - orchestrateur » /orchestrer-plan P<n>
//   « Projet - <Libellé> »            hors plan : un skill du workflow (/cadrer, /nouveau-plan, ...)
// Fonctions pures : le module ne fait que les appeler et rendre `sessionTitle`.

export type Contexte = { cle: string; titre: string }

// Skills qui nomment une session hors plan. Absents exprès : fin-de-tache, verif-visuelle et les
// autres gestes qu'on fait au milieu d'un travail déjà nommé.
export const LIBELLES: Record<string, string> = {
  'cadrer': 'Cadrer',
  'nouveau-plan': 'Nouveau plan',
  'nouveau-projet': 'Nouveau projet',
  'migrer-projet': 'Migration',
  'maj-workflow': 'Mise à jour du workflow',
  'orchestrer-plan': 'Orchestrateur',
  'reprendre': 'Reprise',
  'reprendre-echec': "Reprise d'échec",
  'revue-d-usage': "Revue d'usage",
  'revue-de-conception': 'Revue de conception',
  'code-review': 'Revue de code',
  'analyser-incidents': 'Incidents',
  'purge-contexte': 'Purge du contexte',
  'choisir-mecanisme': 'Mécanismes',
}

const RE_ORCHESTRER = /^\s*\/(?:[\w-]+:)?orchestrer-plan\s+(P\d+)\b/
const RE_SESSION = /plans[\\/](P\d+)[\\/](S\d+)(?:\.echec)?\.md/
const RE_SLASH = /^\s*\/(?:[\w-]+:)?([\w-]+)/

// Dernier segment de la racine du dépôt (ou du dossier de travail).
export function nomProjet(racine: string | undefined): string | undefined {
  const morceaux = String(racine ?? '').split(/[\\/]+/).filter(Boolean)
  return morceaux.at(-1)
}

const plan = (projet: string, p: string, s: string): Contexte => ({ cle: `${p}/${s}`, titre: `${projet} - ${p} - ${s}` })
const orchestrateur = (projet: string, p: string): Contexte => ({ cle: `${p}/orchestrateur`, titre: `${projet} - ${p} - orchestrateur` })

// Un skill par son nom (`cadrer`, `workflow:cadrer`), ses arguments éventuels précisant le plan.
export function contexteDepuisSkill(projet: string, skill: string, args = ''): Contexte | undefined {
  const nom = skill.replace(/^[\w-]+:/, '')
  if (nom === 'orchestrer-plan') {
    const p = /\b(P\d+)\b/.exec(args)
    if (p) return orchestrateur(projet, p[1])
  }
  const session = RE_SESSION.exec(args)
  if (nom === 'reprendre-echec' && session) return plan(projet, session[1], session[2])
  const libelle = LIBELLES[nom]
  return libelle ? { cle: `skill:${nom}`, titre: `${projet} - ${libelle}` } : undefined
}

// Le contexte qu'un prompt établit, ou `undefined` s'il n'en dit rien (la session garde son titre).
export function contexteDepuisPrompt(projet: string, prompt: string): Contexte | undefined {
  const orch = RE_ORCHESTRER.exec(prompt)
  if (orch) return orchestrateur(projet, orch[1])
  const session = RE_SESSION.exec(prompt)
  if (session) return plan(projet, session[1], session[2])
  const slash = RE_SLASH.exec(prompt)
  if (slash) return contexteDepuisSkill(projet, slash[1], prompt.slice(slash[0].length))
  return undefined
}
