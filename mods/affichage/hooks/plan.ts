import type { Mode, ModelePlan } from '../types'

// Logique pure du panneau « plan » : la sortie de `prochaine-action.mjs P<n> --json` devient un modele
// d'affichage — le champ `texte` du moteur, tel quel (P20/S10) ; chaque bouton de relance a son texte selon
// le mode du projet. Aucun `$` ici : les tests rejouent des sorties REELLES du moteur, regenerees a chaque
// passage de tests/tester-mods.mjs.

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

const lire = (sortie: string | undefined): any => {
  try {
    const j = JSON.parse(String(sortie ?? ''))
    return j && typeof j === 'object' ? j : undefined
  } catch {
    return undefined
  }
}

// `action` : sortie de `P<n> --json`. Le texte est celui que le moteur rend (champ `texte`, S5), jamais refait ici :
// une action inconnue s'affiche donc comme les autres ; sans `texte` (moteur plus ancien), le nom de l'action.
// Sortie illisible ou sans `action` : undefined -> pas de panneau.
export function modelePlan(plan: string, action: string | undefined): ModelePlan | undefined {
  const a = lire(action)
  if (!a || typeof a.action !== 'string') return undefined
  const texte = typeof a.texte === 'string' && a.texte.trim() !== '' ? a.texte.replace(/\r\n/g, '\n').trimEnd() : a.action
  const vague = a.vague ?? undefined
  return { plan, ...(vague !== undefined && vague !== null ? { vague: String(vague) } : {}), texte }
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
