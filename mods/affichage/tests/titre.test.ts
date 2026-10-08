import { describe, expect, test } from 'claude-code/testing'
import { contexteDepuisPrompt, contexteDepuisSkill, nomProjet } from '../hooks/titre'

describe('titre : fonctions pures', () => {
  test('nom du projet : dernier segment, Windows ou POSIX', () => {
    expect(nomProjet('D:\\Projets\\EBM-MSPv2')).toBe('EBM-MSPv2')
    expect(nomProjet('/srv/Projets/S&C/')).toBe('S&C')
    expect(nomProjet(undefined)).toBe(undefined)
  })

  test('session de plan : prompt du bloc de relance, chemin Windows, reprise d’échec', () => {
    expect(contexteDepuisPrompt('Chords', 'Ouvre plans/P62/S6.md et exécute-le.')?.titre).toBe('Chords - P62 - S6')
    expect(contexteDepuisPrompt('Chords', 'lis plans\\P7\\S3.md')?.titre).toBe('Chords - P7 - S3')
    expect(contexteDepuisPrompt('Chords', '/reprendre-echec plans/P7/S3.echec.md')?.titre).toBe('Chords - P7 - S3')
  })

  test('orchestrateur : /orchestrer-plan P<n>, préfixé ou non', () => {
    expect(contexteDepuisPrompt('MYO', '/orchestrer-plan P38 — vague 2 : collecte')?.titre).toBe('MYO - P38 - orchestrateur')
    expect(contexteDepuisPrompt('MYO', '/workflow:orchestrer-plan P38')?.titre).toBe('MYO - P38 - orchestrateur')
  })

  test('hors plan : skill du workflow → libellé ; skill hors liste → rien', () => {
    expect(contexteDepuisPrompt('Templates', '/cadrer une idée')?.titre).toBe('Templates - Cadrer')
    expect(contexteDepuisPrompt('Templates', '/workflow:nouveau-plan objectif')?.titre).toBe('Templates - Nouveau plan')
    expect(contexteDepuisPrompt('Templates', '/fin-de-tache')).toBe(undefined)
    expect(contexteDepuisPrompt('Templates', 'corrige ce bug')).toBe(undefined)
  })

  test('skill appelé par le modèle : nom préfixé, arguments du plan', () => {
    expect(contexteDepuisSkill('Templates', 'analyser-incidents')?.titre).toBe('Templates - Incidents')
    expect(contexteDepuisSkill('X', 'workflow:orchestrer-plan', 'P3')?.titre).toBe('X - P3 - orchestrateur')
    expect(contexteDepuisSkill('X', 'workflow:verif-visuelle')).toBe(undefined)
  })
})

function monde(on: any, racine = 'D:\\Projets\\EBM-MSPv2') {
  on('session.repo', () => ({ value: { root: racine, remote: null, internal: false } }))
  on('session.root', () => ({ value: racine }))
  on('tool.call', { tool: 'Skill' }, () => ({ result: {}, text: 'ok' }))
  on('classic.UserPromptSubmit', () => ({}))
}

describe('titre : hooks', () => {
  test('prompt de session de plan → sessionTitle', async ($, on) => {
    monde(on)
    const r: any = await ($ as any).classic.UserPromptSubmit({ prompt: 'Ouvre plans/P7/S3.md et exécute-le.' })
    expect(r.sessionTitle).toBe('EBM-MSPv2 - P7 - S3')
  })

  test('même contexte au prompt suivant → titre non reposé (titre manuel préservé)', async ($, on) => {
    monde(on)
    await ($ as any).classic.UserPromptSubmit({ prompt: 'Ouvre plans/P7/S3.md' })
    const r: any = await ($ as any).classic.UserPromptSubmit({ prompt: 'reprends plans/P7/S3.md' })
    expect(r.sessionTitle).toBe(undefined)
  })

  test('skill appelé sur le fil principal → titre au prompt suivant ; dans un sous-agent → rien', async ($, on) => {
    monde(on)
    await ($ as any).tool.call({ tool: 'Skill', skill: 'workflow:cadrer', agentId: 'sous-agent' })
    const rien: any = await ($ as any).classic.UserPromptSubmit({ prompt: 'continue' })
    expect(rien.sessionTitle).toBe(undefined)
    await ($ as any).tool.call({ tool: 'Skill', skill: 'workflow:cadrer' })
    const r: any = await ($ as any).classic.UserPromptSubmit({ prompt: 'continue' })
    expect(r.sessionTitle).toBe('EBM-MSPv2 - Cadrer')
  })
})
