import { describe, expect, test } from 'claude-code/testing'
import { INDEX_FIXTURE, INDEX_ILLISIBLE } from './fixture-index'

const norm = (p: string) => p.split('\\').join('/').replace(/^[A-Za-z]:/, '')
const RACINE = '/proj'

type Monde = { spawns: any[]; appels: any[] }

function monde(on: any, fichiers: Record<string, string> = {}): Monde {
  const m: Monde = { spawns: [], appels: [] }
  on('session.root', () => ({ value: RACINE }))
  on('fs.read', (_$: any, e: any) => {
    const k = norm(e.path)
    return k in fichiers ? { value: fichiers[k] } : { deny: 'ENOENT' }
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
  subagentType: 'workflow:session-high',
  provider: { plugin: 'workflow', tier: 'user' },
  parentModel: 'claude-opus',
  background: false,
  fork: false,
  ...extra,
})

const INDEX = { [`${RACINE}/plans/P1/index.md`]: INDEX_FIXTURE }

describe('O1 filet de modele', () => {
  test('modele absent, prompt cite plans/P1/S1.md : Sonnet impose', async ($, on) => {
    const m = monde(on, INDEX)
    await $.agent.spawn(spawn('Ouvre plans/P1/S1.md et execute-le.') as any)
    expect(m.spawns[0].model).toBe('sonnet')
  })

  test('chemin Windows plans\\P1\\S2.md : Opus ; S10 distinct de S1 (Haiku)', async ($, on) => {
    const m = monde(on, INDEX)
    await $.agent.spawn(spawn('Ouvre plans\\P1\\S2.md') as any)
    await $.agent.spawn(spawn('Ouvre plans/P1/S10.md') as any)
    expect(m.spawns[0].model).toBe('opus')
    expect(m.spawns[1].model).toBe('haiku')
  })

  test('modele explicite : jamais ecrase', async ($, on) => {
    const m = monde(on, INDEX)
    await $.agent.spawn(spawn('Ouvre plans/P1/S1.md', { model: 'opus' }) as any)
    expect(m.spawns[0].model).toBe('opus')
  })

  test('S1.echec.md seul : inchange', async ($, on) => {
    const m = monde(on, INDEX)
    await $.agent.spawn(spawn('Lis plans/P1/S1.echec.md') as any)
    expect(m.spawns[0].model).toBeUndefined()
  })

  test('S1.revue.md seul : inchange', async ($, on) => {
    const m = monde(on, INDEX)
    await $.agent.spawn(spawn('Lis plans/P1/S1.revue.md') as any)
    expect(m.spawns[0].model).toBeUndefined()
  })

  test('fork : inchange', async ($, on) => {
    const m = monde(on, INDEX)
    await $.agent.spawn(spawn('Ouvre plans/P1/S1.md', { fork: true }) as any)
    expect(m.spawns[0].model).toBeUndefined()
  })

  test('index illisible, absent ou session inconnue : inchange, jamais un refus', async ($, on) => {
    const m = monde(on, { [`${RACINE}/plans/P2/index.md`]: INDEX_ILLISIBLE })
    const a = await $.agent.spawn(spawn('plans/P2/S1.md') as any)
    const b = await $.agent.spawn(spawn('plans/P3/S1.md') as any)
    const c = await $.agent.spawn(spawn('plans/P2/S9.md') as any)
    for (const r of [a, b, c]) expect((r as any).deny).toBeUndefined()
    expect(m.spawns.map((s) => s.model)).toEqual([undefined, undefined, undefined])
  })

  test('valeur hors liste : inchange', async ($, on) => {
    const m = monde(on, {
      [`${RACINE}/plans/P1/index.md`]: INDEX_FIXTURE.replace('| Sonnet |', '| Gpt |'),
    })
    await $.agent.spawn(spawn('plans/P1/S1.md') as any)
    expect(m.spawns[0].model).toBeUndefined()
  })

  test('o1: false : inchange', { options: { o1: false } }, async ($, on) => {
    const m = monde(on, INDEX)
    await $.agent.spawn(spawn('plans/P1/S1.md') as any)
    expect(m.spawns[0].model).toBeUndefined()
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
