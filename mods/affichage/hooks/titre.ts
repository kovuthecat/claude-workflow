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

// Origines (`prompt.submit`, `e.origin.kind`) d'un message qui n'est pas de la personne. `unclassified`
// n'y est pas : la personne peut arriver par un canal que le moteur ne sait pas attester.
const ORIGINES_MACHINE = new Set([
  'peer',
  'peer-send-message',
  'task-notification',
  'scheduled-trigger',
  'coordinator',
  'observer',
  'observer-activity',
  'projects-relay',
  'channel',
  'auto-continuation',
])

// Un prompt dont le texte peut nommer la session : celui de la personne, pas un message injecté
// (compte rendu d'un sous-agent, notification de tâche) qui cite plans/P<n>/S<k>.md et renommait
// l'orchestrateur « P<n> - S<k> ». `source` seul ne suffit pas : absent du hook dans Desktop pour un
// compte rendu de sous-agent (reproduit le 2026-11-01, 0.67.1) ; l'origine du `prompt.submit` tranche.
export function promptDeLaPersonne(source: string | undefined, origine?: string): boolean {
  return source !== 'system' && source !== 'poll_event' && !(origine !== undefined && ORIGINES_MACHINE.has(origine))
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
