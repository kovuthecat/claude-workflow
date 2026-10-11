import { describe, expect, test } from 'claude-code/testing'

import { BOUTONS, ligneSession, modelePlan, relance, texteAction, texteBouton } from '../hooks/plan'
import { P11_ACTION, P11_ETAT, P15_ACTION, P15_ETAT, P2_ACTION, P2_ETAT, P9_ACTION } from './fixtures-plan'

// Les fixtures sont des sorties REELLES de prochaine-action.mjs (voir fixtures-plan.ts).

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

describe('modelePlan sur des sorties reelles', () => {
  test('lancer : vague, action, avertissement, sessions et session courante', () => {
    const m = modelePlan('P15', P15_ACTION, P15_ETAT)
    expect(m).toBeDefined()
    expect(m?.plan).toBe('P15')
    expect(m?.vague).toBe('2')
    expect(m?.action).toBe('lancer — vague 2 (séquentiel) : S2')
    expect(m?.avertissement).toBe('index déclare Workflow : v0.54.0, plugin en v0.56.0')
    expect(m?.clos).toBe(false)
    expect(m?.sessions.map((s) => `${s.session}:${s.etat}:${s.courante}`)).toEqual([
      'S1:faite:false',
      'S2:a-lancer:true',
      'S3:a-lancer:false',
      'S4:a-lancer:false',
      'S5:a-lancer:false',
      'S6:a-lancer:false',
    ])
    expect(m?.sessions.map(ligneSession)[0]).toBe("✓ S1  Hook Stop : jamais de relance d'une session planifiée (sur …")
    expect(m?.sessions.map(ligneSession)[1].startsWith('→ S2  ')).toBe(true)
    expect(m?.sessions.map(ligneSession)[2].startsWith('○ S3  ')).toBe(true)
  })

  test('titre long tronque', () => {
    const l = ligneSession({ session: 'S9', titre: 'x'.repeat(100), etat: 'a-lancer', courante: false })
    expect(l).toBe(`○ S9  ${'x'.repeat(59)}…`)
  })

  test('question : motif dans le texte de l action, pas de vague', () => {
    const m = modelePlan('P9', P9_ACTION)
    expect(m?.action).toBe('question — prérequis non validés : S5')
    expect(m?.vague).toBeUndefined()
    expect(m?.sessions).toEqual([])
    expect(m?.avertissement).toBe('index déclare Workflow : v0.41.0, plugin en v0.56.0')
  })

  test('fini : action seule, sans avertissement', () => {
    const m = modelePlan('P2', P2_ACTION, P2_ETAT)
    expect(m?.action).toBe('fini')
    expect(m?.avertissement).toBeUndefined()
    expect(m?.sessions.length).toBeGreaterThan(0)
    expect(m?.sessions.some((s) => s.courante)).toBe(false)
  })

  test('plan clos : le drapeau suit la ligne Clos ; une session deja faite n est pas courante', () => {
    const m = modelePlan('P11', P11_ACTION, P11_ETAT)
    expect(m?.clos).toBe(true)
    expect(m?.action).toBe('relire — vague 2 : S2')
    expect(m?.sessions.find((s) => s.session === 'S2')?.courante).toBe(false)
  })

  test('sans la sortie --etat : action seule, liste de sessions vide', () => {
    const m = modelePlan('P15', P15_ACTION, undefined)
    expect(m?.action).toBe('lancer — vague 2 (séquentiel) : S2')
    expect(m?.sessions).toEqual([])
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

  test('etat illisible : le modele garde l action', () => {
    expect(modelePlan('P15', P15_ACTION, 'pas du json')?.sessions).toEqual([])
  })
})

describe('texteAction', () => {
  test('reprendre, enqueter, parallele', () => {
    expect(texteAction({ action: 'reprendre', session: 'S3', modele: 'Opus', option: 2 })).toBe('reprendre — S3 (Opus · option 2)')
    expect(texteAction({ action: 'enqueter', session: 'S3', modele: 'Opus' })).toBe('enqueter — S3 (Opus)')
    expect(texteAction({ action: 'lancer', vague: 3, parallele: true, sessions: [{ session: 'S2' }, { session: 'S4' }] })).toBe(
      'lancer — vague 3 (parallèle) : S2, S4',
    )
  })

  test('action sans forme dediee : son nom', () => {
    expect(texteAction({ action: 'pousser' })).toBe('pousser')
    expect(texteAction({ action: 'cloturer' })).toBe('cloturer')
  })
})
