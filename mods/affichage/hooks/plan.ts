import type { Mode, ModelePlan, SessionPlan } from '../types'

// Logique pure du panneau « plan » : la sortie de `prochaine-action.mjs P<n> --json` (et `--etat --json`)
// devient un modele d'affichage ; chaque bouton de relance a son texte selon le mode du projet.
// Aucun `$` ici : les tests rejouent des sorties REELLES du script, recopiees en fixture.

// Mode : `vendore` (`.claude/workflow/manifest.json` present, skills sous `/<skill>`) ou `source` (depot
// source du workflow, skills sous `/workflow:<skill>`) — meme detection que installer-mods.mjs.
export type { Mode }

export type BoutonId = 'go' | 'reprends' | 'orchestrer' | 'commit'

export const BOUTONS: readonly { id: BoutonId; label: string }[] = [
  { id: 'go', label: 'Go' },
  { id: 'reprends', label: 'Reprends' },
  { id: 'orchestrer', label: "Enchaîne l'orchestration" },
  { id: 'commit', label: 'Commit+push' },
]

export function nomSkill(skill: string, mode: Mode): string {
  return mode === 'source' ? `/workflow:${skill}` : `/${skill}`
}

// Texte soumis par un bouton ; `plan` (ex. `P16`) n'intervient que dans « Enchaîne l'orchestration ».
export function texteBouton(id: BoutonId, mode: Mode, plan: string): string {
  switch (id) {
    case 'go':
      return 'Go'
    case 'reprends':
      return nomSkill('reprendre', mode)
    case 'orchestrer':
      return `${nomSkill('orchestrer-plan', mode)} ${plan}`
    case 'commit':
      return `Committe et pousse le travail en attente, selon ${nomSkill('fin-de-tache', mode)}.`
  }
}

const noms = (liste: unknown): string[] =>
  Array.isArray(liste) ? liste.map((x: any) => (typeof x === 'string' ? x : x?.session)).filter(Boolean).map(String) : []

// Premiere ligne de `formaterTexte` de prochaine-action.mjs, refaite depuis l'objet `--json`.
export function texteAction(a: any): string {
  const cle = String(a?.action ?? '')
  const sessions = noms(a?.sessions)
  switch (cle) {
    case 'lancer':
      return `lancer — vague ${a.vague} (${a.parallele ? 'parallèle' : 'séquentiel'}) : ${sessions.join(', ') || '—'}`
    case 'verifier-premisse':
      return `verifier-premisse — ${a.session}`
    case 'reprendre':
      return `reprendre — ${a.session} (${a.modele}${a.option ? ` · option ${a.option}` : ''})`
    case 'enqueter':
      return `enqueter — ${a.session} (${a.modele})`
    case 'relancer-interrompue':
      return `relancer-interrompue — ${a.session} (${a.modele})`
    case 'relire':
      return `relire — vague ${a.vague} : ${sessions.join(', ')}`
    case 'validation-humaine':
      return `validation-humaine — vague ${a.vague}`
    case 'question':
      return `question — ${a.motif}`
    default:
      return cle
  }
}

const ICONES: Record<string, string> = { faite: '✓', echec: '✗' }
const LIBELLE_MAX = 60

const tronquer = (t: string) => (t.length > LIBELLE_MAX ? `${t.slice(0, LIBELLE_MAX - 1)}…` : t)

// Ligne d'une session : `✓ S1  titre`, `→` devant celles de la vague en cours.
export function ligneSession(s: SessionPlan): string {
  const icone = s.courante ? '→' : (ICONES[s.etat] ?? '○')
  return `${icone} ${s.session}  ${tronquer(s.titre)}`
}

const lire = (sortie: string | undefined): any => {
  try {
    const j = JSON.parse(String(sortie ?? ''))
    return j && typeof j === 'object' ? j : undefined
  } catch {
    return undefined
  }
}

// `action` : sortie de `P<n> --json` ; `etat` : sortie de `P<n> --etat --json` (facultative : sans elle, pas
// de liste de sessions). Sortie illisible ou sans `action` : undefined -> pas de panneau.
export function modelePlan(plan: string, action: string | undefined, etat?: string): ModelePlan | undefined {
  const a = lire(action)
  if (!a || typeof a.action !== 'string') return undefined
  const e = lire(etat)
  const courantes = new Set([...noms(a.sessions), ...(a.session ? [String(a.session)] : [])])
  const sessions: SessionPlan[] = Array.isArray(e?.sessions)
    ? e.sessions
        .filter((s: any) => s && typeof s.session === 'string')
        .map((s: any) => ({
          session: s.session,
          titre: String(s.titre ?? ''),
          etat: String(s.etat ?? ''),
          courante: courantes.has(s.session) && s.etat !== 'faite',
        }))
    : []
  const vague = a.vague ?? undefined
  return {
    plan,
    ...(vague !== undefined ? { vague: String(vague) } : {}),
    action: texteAction(a),
    ...(typeof a.avertissement === 'string' && a.avertissement !== '' ? { avertissement: a.avertissement } : {}),
    clos: typeof e?.clos === 'string' && e.clos !== '',
    sessions,
  }
}

// Ce que fait un appui. `$.prompt.submit` refuse un texte qui commence par `/` (le moteur le tient pour une
// commande lancee a la place de la personne) : un bouton « slash » passe par `$.command.run`, les autres
// par `$.prompt.submit`.
export type Relance = { via: 'prompt'; text: string } | { via: 'commande'; command: string; args: string }

export function relance(id: BoutonId, mode: Mode, plan: string): Relance {
  const texte = texteBouton(id, mode, plan)
  if (!texte.startsWith('/')) return { via: 'prompt', text: texte }
  const espace = texte.indexOf(' ')
  return espace < 0
    ? { via: 'commande', command: texte.slice(1), args: '' }
    : { via: 'commande', command: texte.slice(1, espace), args: texte.slice(espace + 1) }
}
