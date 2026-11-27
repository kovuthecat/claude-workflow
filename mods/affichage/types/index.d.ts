// Contrat des valeurs que le mod `affichage` garde dans $.state.
export type Fenetre = { kind: string; percentUsed: number; resetsAt?: string }

// Le bandeau au-dessus du prompt : plan (`P16 · vague 7`) puis les fenetres, libelle en gras.
export type FenetreBandeau = { libelle: string; valeur: string }
export type Bandeau = { plan?: string; fenetres: FenetreBandeau[] }

declare module 'claude-code' {
  interface PluginState {
    affichage: {
      bandeau: Bandeau
    }
  }
}
