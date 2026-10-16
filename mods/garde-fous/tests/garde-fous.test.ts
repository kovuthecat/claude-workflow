import { describe, expect, test } from 'claude-code/testing'
import { MOTEUR_FINI, MOTEUR_LANCER, MOTEUR_REPRENDRE_OPUS, MOTEUR_REPRENDRE_SONNET } from './fixture-index'

// Les sorties du moteur sont GENEREES par tests/tester-mods.mjs depuis le vrai prochaine-action.mjs a chaque
// passage (voir fixture-index.ts) : O1 est confronte a ce que le moteur rend, pas a une sortie recopiee.

const norm = (p: string) => p.split('\\').join('/').replace(/^[A-Za-z]:/, '')
const RACINE = '/proj'
const SCRIPT = 'plugin/bin/prochaine-action.mjs'

type Monde = { spawns: any[]; appels: any[]; moteur: string[][] }

// `moteur` : stdout rendu par `node <script> P<n> --json` (absent : aucun script dans le projet).
function monde(on: any, opts: { moteur?: string; code?: number; vendore?: boolean } = {}): Monde {
  const m: Monde = { spawns: [], appels: [], moteur: [] }
  on('session.root', () => ({ value: RACINE }))
  on('fs.exists', (_$: any, e: any) => {
    const k = norm(e.path)
    const present = opts.moteur !== undefined && k === `${RACINE}/${opts.vendore ? '.claude/workflow/bin/prochaine-action.mjs' : SCRIPT}`
    return { value: present }
  })
  on('process.run', (_$: any, e: any) => {
    m.moteur.push([...e.argv])
    return {
      value: { exitCode: opts.code ?? 0, stdout: opts.moteur ?? '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
    }
  })
  on('agent.spawn', (_$: any, e: any) => {
    m.spawns.push(e)
    return { model: e.model ?? 'inherit', agentId: `agent-${m.spawns.length}` }
  })
  on('tool.call', { tool: 'Agent' }, (_$: any, e: any) => {
    m.appels.push(e)
    return { result: {}, text: 'ok' }
  })
  return m
}

const spawn = (prompt: string, extra: Record<string, unknown> = {}) => ({
  tool_use_id: 'tu-1',
  prompt,
  description: 'session',
  subagentType: 'general-purpose',
  provider: { plugin: 'workflow', tier: 'user' },
  parentModel: 'claude-opus',
  background: false,
  fork: false,
  ...extra,
})

describe('O1 modele calcule par le moteur', () => {
  test('lancer : agent.model de la session lancee, moteur lu en lecture seule (P<n> --json, sans --appliquer)', async ($, on) => {
    const m = monde(on, { moteur: MOTEUR_LANCER })
    await $.agent.spawn(spawn('Ouvre plans/P9/S1.md et execute-le.') as any)
    expect(m.spawns[0].model).toBe('sonnet')
    expect(m.moteur).toEqual([['node', `${RACINE}/${SCRIPT}`, 'P9', '--json']])
  })

  test('reprise : le modele du moteur (Sonnet) prime sur celui de l index (Haiku) — escalade preservee', async ($, on) => {
    const m = monde(on, { moteur: MOTEUR_REPRENDRE_SONNET })
    await $.agent.spawn(spawn('Ouvre plans/P9/S1.md') as any)
    expect(m.spawns[0].model).toBe('sonnet')
  })

  test('reprise escaladee : Opus, quel que soit le modele de l index (Sonnet)', async ($, on) => {
    const m = monde(on, { moteur: MOTEUR_REPRENDRE_OPUS })
    await $.agent.spawn(spawn('Ouvre plans\\P9\\S1.md') as any)
    expect(m.spawns[0].model).toBe('opus')
  })

  test('projet vendore : le script de .claude/workflow/bin est lance', async ($, on) => {
    const m = monde(on, { moteur: MOTEUR_LANCER, vendore: true })
    await $.agent.spawn(spawn('plans/P9/S1.md') as any)
    expect(m.spawns[0].model).toBe('sonnet')
    expect(m.moteur[0][1]).toBe(`${RACINE}/.claude/workflow/bin/prochaine-action.mjs`)
  })

  test('aucune action pour cette session (S2 hors vague, plan fini) : inchange, jamais un refus', async ($, on) => {
    const a = monde(on, { moteur: MOTEUR_LANCER })
    const r = await $.agent.spawn(spawn('plans/P9/S2.md') as any)
    expect(a.spawns[0].model).toBeUndefined()
    expect((r as any).deny).toBeUndefined()
  })

  test('plan fini : inchange', async ($, on) => {
    const m = monde(on, { moteur: MOTEUR_FINI })
    await $.agent.spawn(spawn('plans/P9/S1.md') as any)
    expect(m.spawns[0].model).toBeUndefined()
  })

  test('modele explicite : jamais ecrase, moteur non lance', async ($, on) => {
    const m = monde(on, { moteur: MOTEUR_LANCER })
    await $.agent.spawn(spawn('Ouvre plans/P9/S1.md', { model: 'opus' }) as any)
    expect(m.spawns[0].model).toBe('opus')
    expect(m.moteur).toEqual([])
  })

  test('S1.echec.md seul : inchange, moteur non lance', async ($, on) => {
    const m = monde(on, { moteur: MOTEUR_LANCER })
    await $.agent.spawn(spawn('Lis plans/P9/S1.echec.md') as any)
    expect(m.spawns[0].model).toBeUndefined()
    expect(m.moteur).toEqual([])
  })

  test('S1.revue.md seul : inchange', async ($, on) => {
    const m = monde(on, { moteur: MOTEUR_LANCER })
    await $.agent.spawn(spawn('Lis plans/P9/S1.revue.md') as any)
    expect(m.spawns[0].model).toBeUndefined()
  })

  test('fork : inchange', async ($, on) => {
    const m = monde(on, { moteur: MOTEUR_LANCER })
    await $.agent.spawn(spawn('Ouvre plans/P9/S1.md', { fork: true }) as any)
    expect(m.spawns[0].model).toBeUndefined()
  })

  test('script absent : inchange, jamais un refus', async ($, on) => {
    const m = monde(on)
    const r = await $.agent.spawn(spawn('plans/P9/S1.md') as any)
    expect(m.spawns[0].model).toBeUndefined()
    expect((r as any).deny).toBeUndefined()
    expect(m.moteur).toEqual([])
  })

  test('sortie illisible : inchange, jamais un refus', async ($, on) => {
    const m = monde(on, { moteur: 'prochaine-action: index illisible' })
    const r = await $.agent.spawn(spawn('plans/P9/S1.md') as any)
    expect(m.spawns[0].model).toBeUndefined()
    expect((r as any).deny).toBeUndefined()
  })

  test('moteur en echec (code 2) : inchange, jamais un refus', async ($, on) => {
    const m = monde(on, { moteur: MOTEUR_LANCER, code: 2 })
    const r = await $.agent.spawn(spawn('plans/P9/S1.md') as any)
    expect(m.spawns[0].model).toBeUndefined()
    expect((r as any).deny).toBeUndefined()
  })

  test('o1: false : inchange, moteur non lance', { options: { o1: false } }, async ($, on) => {
    const m = monde(on, { moteur: MOTEUR_LANCER })
    await $.agent.spawn(spawn('plans/P9/S1.md') as any)
    expect(m.spawns[0].model).toBeUndefined()
    expect(m.moteur).toEqual([])
  })
})

describe('O3 premier plan par defaut', () => {
  test('absent : false', async ($, on) => {
    const m = monde(on)
    await $.tool.call({ tool: 'Agent', description: 'x', prompt: 'y' } as any)
    expect(m.appels[0].run_in_background).toBe(false)
  })

  test('true explicite conserve', async ($, on) => {
    const m = monde(on)
    await $.tool.call({ tool: 'Agent', description: 'x', prompt: 'y', run_in_background: true } as any)
    expect(m.appels[0].run_in_background).toBe(true)
  })

  test('o3: false : entree telle quelle', { options: { o3: false } }, async ($, on) => {
    const m = monde(on)
    await $.tool.call({ tool: 'Agent', description: 'x', prompt: 'y' } as any)
    expect(m.appels[0].run_in_background).toBeUndefined()
  })
})
