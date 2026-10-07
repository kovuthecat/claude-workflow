// Contrat des valeurs que le mod `affichage` garde dans $.state.
export type Fenetre = { kind: string; percentUsed: number; resetsAt?: string }

export type Limites = { fenetres: Fenetre[]; contexte?: number }

export type Fichier = {
  chemin: string
  nom: string
  icone: '●' | '+' | '↑'
  ancien?: string
}

export type Dossier = { chemin: string; fichiers: Fichier[] }

export type EtatFichiers = {
  depot: boolean
  amont: boolean
  total: number
  tronque: number
  dossiers: Dossier[]
}

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
      limites: Limites
      fichiers: EtatFichiers
      repli: Record<string, boolean>
      plan: PlanAffiche
    }
  }
}
