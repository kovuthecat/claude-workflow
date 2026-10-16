import { describe, expect, test } from 'claude-code/testing'

import { BOUTONS, modelePlan, relance, texteBouton } from '../hooks/plan'
import { MOTEUR_FINI, MOTEUR_LANCER, MOTEUR_REPRENDRE_SONNET } from './fixtures-plan'

// Les fixtures sont des sorties REELLES de prochaine-action.mjs, regenerees a chaque passage de
// tests/tester-mods.mjs (voir fixtures-plan.ts) : le texte attendu est lu dans la sortie, jamais recopie ici.
const texteDe = (sortie: string): string => JSON.parse(sortie).texte.trimEnd()

describe('texteBouton', () => {
  test('mode vendore : skills sous /<skill>', () => {
    expect(texteBouton('go', 'vendore', 'P16')).toBe('Go')
    expect(texteBouton('reprends', 'vendore', 'P16')).toBe('/reprendre')
    expect(texteBouton('orchestrer', 'vendore', 'P16')).toBe('/orchestrer-plan P16')
    expect(texteBouton('commit', 'vendore', 'P16')).toBe('Committe et pousse le travail en attente, selon /fin-de-tache.')
  })

  test('mode source : skills sous /workflow:<skill>', () => {
    expect(texteBouton('go', 'source', 'P16')).toBe('Go')
    expect(texteBouton('reprends', 'source', 'P16')).toBe('/workflow:reprendre')
    expect(texteBouton('orchestrer', 'source', 'P16')).toBe('/workflow:orchestrer-plan P16')
    expect(texteBouton('commit', 'source', 'P16')).toBe('Committe et pousse le travail en attente, selon /workflow:fin-de-tache.')
  })

  test('quatre boutons, dans cet ordre', () => {
    expect(BOUTONS.map((b) => b.label)).toEqual(['Go', 'Reprends', "Enchaîne l'orchestration", 'Commit+push'])
  })
})

describe('relance : canal de chaque bouton', () => {
  test('un texte en / part par $.command.run (command + args), jamais par $.prompt.submit', () => {
    expect(relance('go', 'source', 'P16')).toEqual({ via: 'prompt', text: 'Go' })
    expect(relance('reprends', 'source', 'P16')).toEqual({ via: 'commande', command: 'workflow:reprendre', args: '' })
    expect(relance('orchestrer', 'source', 'P16')).toEqual({ via: 'commande', command: 'workflow:orchestrer-plan', args: 'P16' })
    expect(relance('orchestrer', 'vendore', 'P3')).toEqual({ via: 'commande', command: 'orchestrer-plan', args: 'P3' })
    expect(relance('commit', 'vendore', 'P16')).toEqual({
      via: 'prompt',
      text: 'Committe et pousse le travail en attente, selon /fin-de-tache.',
    })
  })
})

describe('modelePlan : le texte du moteur, tel quel', () => {
  test('lancer : plan, vague, texte integral du moteur', () => {
    const m = modelePlan('P9', MOTEUR_LANCER)
    expect(m?.plan).toBe('P9')
    expect(m?.vague).toBe('1')
    expect(m?.texte).toBe(texteDe(MOTEUR_LANCER))
    expect(m?.texte.split('\n')[0]).toBe('lancer — vague 1 : S1')
    expect(m?.texte).toContain('Avertissement : ')
  })

  test('reprendre : pas de vague, texte du moteur', () => {
    const m = modelePlan('P9', MOTEUR_REPRENDRE_SONNET)
    expect(m?.vague).toBeUndefined()
    expect(m?.texte).toBe(texteDe(MOTEUR_REPRENDRE_SONNET))
    expect(m?.texte.split('\n')[0]).toBe('reprendre — S1 (Sonnet)')
  })

  test('fini : le rapport du moteur, premiere ligne nue', () => {
    const m = modelePlan('P9', MOTEUR_FINI)
    expect(m?.texte).toBe(texteDe(MOTEUR_FINI))
    expect(m?.texte.split('\n')[0]).toBe('fini')
  })

  test('action inconnue : affichee comme les autres, jamais refaite ni rejetee', () => {
    const m = modelePlan('P9', JSON.stringify({ action: 'inedite', texte: 'inedite — S4\n   detail du moteur\n' }))
    expect(m?.texte).toBe('inedite — S4\n   detail du moteur')
  })

  test('moteur sans champ texte (plus ancien) : le nom de l action', () => {
    expect(modelePlan('P9', JSON.stringify({ action: 'pousser' }))?.texte).toBe('pousser')
    expect(modelePlan('P9', JSON.stringify({ action: 'pousser', texte: '  ' }))?.texte).toBe('pousser')
  })

  test('fins de ligne Windows normalisees', () => {
    expect(modelePlan('P9', JSON.stringify({ action: 'x', texte: 'a\r\nb' }))?.texte).toBe('a\nb')
  })
})

describe('plan absent ou sortie illisible', () => {
  test('rien a afficher', () => {
    expect(modelePlan('P1', undefined)).toBeUndefined()
    expect(modelePlan('P1', '')).toBeUndefined()
    expect(modelePlan('P1', 'prochaine-action: index illisible')).toBeUndefined()
    expect(modelePlan('P1', '{}')).toBeUndefined()
    expect(modelePlan('P1', '[1]')).toBeUndefined()
  })
})
