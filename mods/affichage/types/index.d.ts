// Contrat des valeurs que le mod `affichage` garde dans $.state.
export type Fenetre = { kind: string; percentUsed: number; resetsAt?: string }

// Le bandeau au-dessus du prompt : plan (`P16 · vague 7`) puis les fenetres, libelle en gras.
export type FenetreBandeau = { libelle: string; valeur: string }
export type Bandeau = { plan?: string; fenetres: FenetreBandeau[] }

// Panneau « plan » : le texte que prochaine-action.mjs rend pour l'action en cours (champ `texte`).
export type ModelePlan = {
  plan: string
  vague?: string
  texte: string
}

// vendore : skills sous /<skill> ; source : dépôt source du workflow, /workflow:<skill>.
export type Mode = 'vendore' | 'source'

export type PlanAffiche = { modele: ModelePlan | null; mode: Mode }

declare module 'claude-code' {
  interface PluginState {
    affichage: {
      bandeau: Bandeau
      plan: PlanAffiche
    }
  }
}
