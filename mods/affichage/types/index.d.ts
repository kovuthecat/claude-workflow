// Contrat des valeurs que le mod `affichage` garde dans $.state.
export type Fenetre = { kind: string; percentUsed: number; resetsAt?: string }

// Le bandeau au-dessus du prompt : plan (`P16 · vague 7`) puis les fenetres, libelle en gras.
export type FenetreBandeau = { libelle: string; valeur: string }
export type Bandeau = { plan?: string; fenetres: FenetreBandeau[] }

export type SessionPlan = { session: string; titre: string; etat: string; courante: boolean }

export type ModelePlan = {
  plan: string
  vague?: string
  action: string
  avertissement?: string
  clos: boolean
  sessions: SessionPlan[]
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
