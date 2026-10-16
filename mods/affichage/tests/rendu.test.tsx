import { describe, expect, mock, test } from 'claude-code/testing'

import { MOTEUR_LANCER } from './fixtures-plan'

const norm = (p: string) => p.split(String.fromCharCode(92)).join('/')
const RACINE = '/proj'
const SURFACES = ['desktop', 'mobile'] as const

const PROPS_PANE = {
  title: 'Panneau',
  isFocused: false,
  bodyColumns: 60,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 30 },
  view: {},
}

type Sorties = {
  status: (string | undefined)[]
  commandes: string[][]
  panneaux: string[]
  fermes: string[]
  relances: { via: 'prompt' | 'commande' | 'toast'; text: string }[]
}

// Le monde sous le mod : un depot git simule, a la sortie EXACTE de chaque commande lancee.
function monde(
  on: any,
  opts: {
    status?: string
    nonPousses?: string
    amont?: boolean
    depot?: boolean
    rateLimits?: any[]
    contexte?: number
    fichiers?: string[]
    scripts?: Record<string, string>
    // `git rev-parse HEAD` : une valeur fixe, ou une fonction (le test fait avancer HEAD) ; absent : pas de depot lisible.
    head?: string | (() => string)
  } = {},
): Sorties {
  const s: Sorties = { status: [], commandes: [], panneaux: [], fermes: [], relances: [] }
  const depot = opts.depot !== false
  mock.clock(on, { now: Date.parse('2026-10-07T12:00:00Z') })
  on('session.start', (_$: any, e: any) => ({ cwd: e.cwd }))
  on('session.measure', (_$: any, e: any) => ({ changed: e.changed }))
  on('tool.call', () => ({ result: {}, text: 'ok' }))
  on('session.root', () => ({ value: RACINE }))
  on('session.usage', () => ({
    value: { startedAt: 0, context: { window: 200000, percent: opts.contexte }, rateLimits: opts.rateLimits ?? [] },
  }))
  on('fs.exists', (_$: any, e: any) => ({ value: (opts.fichiers ?? []).some((f) => norm(e.path).endsWith(f)) }))
  on('fs.list', () => ({ value: [{ name: 'P1', kind: 'dir', size: 0, mtimeMs: 0 }] }))
  on('fs.read', (_$: any, e: any) => (norm(e.path).endsWith('plans/P1/index.md') ? { value: '# P1\n' } : { deny: 'ENOENT' }))
  on('command.register', () => ({ value: { isRegistered: true } }))
  // Ce que les boutons du panneau « plan » declenchent : un prompt, une commande slash, ou un toast d'echec.
  on('command.run', (_$: any, e: any) => {
    s.relances.push({ via: 'commande', text: `/${e.command}${e.args ? ` ${e.args}` : ''}` })
    return { text: 'ok' }
  })
  on('ui.toast', (_$: any, e: any) => {
    s.relances.push({ via: 'toast', text: e.text })
    return { value: undefined }
  })
  on('prompt.submit', (_$: any, e: any) => {
    s.relances.push({ via: 'prompt', text: e.text })
    return { text: e.text, origin: e.origin }
  })
  on('ui.status', (_$: any, e: any) => {
    s.status.push(e.text)
    return { value: undefined }
  })
  on('ui.open', (_$: any, e: any) => {
    s.panneaux.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.close', (_$: any, e: any) => {
    s.fermes.push(e.id)
    return { value: undefined }
  })
  on('process.run', (_$: any, e: any) => {
    const argv = [...e.argv]
    s.commandes.push(argv)
    if (argv[0] === 'git' && argv[1] === 'status') {
      return depot
        ? { value: { exitCode: 0, stdout: opts.status ?? '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
        : { value: { exitCode: 128, stdout: '', stderr: 'fatal: not a git repository', isStdoutTruncated: false, isStderrTruncated: false } }
    }
    if (argv[0] === 'git' && argv[1] === 'diff') {
      return opts.amont === false
        ? { value: { exitCode: 128, stdout: '', stderr: 'fatal: no upstream configured', isStdoutTruncated: false, isStderrTruncated: false } }
        : { value: { exitCode: 0, stdout: opts.nonPousses ?? '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    }
    if (argv[0] === 'git' && argv[1] === 'rev-parse') {
      const head = typeof opts.head === 'function' ? opts.head() : opts.head
      return head === undefined
        ? { value: { exitCode: 128, stdout: '', stderr: 'fatal', isStdoutTruncated: false, isStderrTruncated: false } }
        : { value: { exitCode: 0, stdout: `${head}\n`, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    }
    if (argv[0] === 'node') {
      return { value: { exitCode: 0, stdout: opts.scripts?.[argv[2]] ?? '{}', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    }
    return { value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  return s
}

// Laisse finir ce que session.start lance sans l'attendre (ouverture des panneaux) : le $ des tests n'a pas d'horloge.
const attendre = async ($: any) => {
  for (let i = 0; i < 30; i++) await $.tool.call({ tool: 'Read', file_path: '/proj/a' } as any)
}

const demarrer = ($: any) => $.session.start({ cwd: RACINE, surface: 'terminal', isInteractive: true })

const monter = ($: any, surface: (typeof SURFACES)[number], id: string) =>
  $.ui.mount({ plugin: 'affichage', surface, component: 'Pane', requestId: id, props: { ...PROPS_PANE, title: id }, viewport: { columns: 60, rows: 30 } })

const textes = async (ui: any) => (await ui.findAll({ type: 'Text' })).map((t: any) => String(t.text))

describe('bandeau au-dessus du prompt', () => {
  // Le bandeau dessine : son texte bout a bout, et les Text en gras a part.
  const bandeau = async ($: any, surface: (typeof SURFACES)[number] = 'desktop', hasSurvey = false) => {
    const ui = await $.ui.mount({
      plugin: 'affichage',
      surface,
      component: 'AbovePrompt',
      props: { hasSurvey, isWorking: false, maxRows: 10, bodyColumns: 120, scroll: { offset: 0, bodyRows: 10 }, view: {} },
      viewport: { columns: 120, rows: 30 },
    })
    const tous = await ui.findAll({ type: 'Text' })
    return {
      texte: tous.map((t: any) => String(t.text)).join(''),
      gras: tous.filter((t: any) => t.props?.bold).map((t: any) => String(t.text)),
    }
  }

  for (const surface of SURFACES) {
    test(`${surface} : limites, libelles en gras, ni contexte ni reset 7 j`, async ($, on) => {
      monde(on, {
        rateLimits: [
          { kind: 'five_hour', percentUsed: 21, resetsAt: '2026-10-07T17:40:00Z' },
          { kind: 'seven_day', percentUsed: 63, resetsAt: '2026-10-12T08:00:00Z' },
        ],
        contexte: 10,
      })
      await demarrer($)
      const b = await bandeau($, surface)
      expect(b.texte).toMatch(/^5 h 21 % ↺ \d\d:\d\d · 7 j 63 %$/)
      expect(b.gras).toEqual(['5 h', '7 j'])
    })
  }

  test("plus de ligne d'etat : le prefixe du plugin n'apparait plus", async ($, on) => {
    const s = monde(on, { rateLimits: [{ kind: 'five_hour', percentUsed: 21 }], contexte: 10 })
    await demarrer($)
    await $.session.measure({ context: { window: 200000, percent: 11 }, rateLimits: [], changed: ['context'] })
    expect(s.status).toEqual([])
  })

  test('hors projet du workflow : pas de plan, prochaine-action jamais lance', async ($, on) => {
    const s = monde(on, { rateLimits: [{ kind: 'five_hour', percentUsed: 21 }] })
    await demarrer($)
    expect((await bandeau($)).texte).toBe('5 h 21 %')
    expect(s.commandes.some((c) => c[0] === 'node')).toBe(false)
  })

  test('dans un projet du workflow : plan, vague et session par prochaine-action ; repere par agent.spawn', async ($, on) => {
    monde(on, {
      fichiers: ['plugin/bin/prochaine-action.mjs'],
      scripts: {
        P1: JSON.stringify({ action: 'lancer', vague: 2, sessions: [{ session: 'S3' }] }),
        P7: JSON.stringify({ action: 'lancer', vague: 4, sessions: [{ session: 'S2' }] }),
      },
      rateLimits: [{ kind: 'seven_day', percentUsed: 40 }],
    })
    on('agent.spawn', () => ({ model: 'inherit', agentId: 'a1' }))
    await demarrer($)
    // plan par defaut : P1 (index sans « Clos : »)
    expect((await bandeau($)).texte).toBe('P1 · vague 2 · S3  │  7 j 40 %')
    await $.agent.spawn({
      tool_use_id: 't1',
      prompt: 'Ouvre plans/P7/S2.md',
      description: 'session',
      subagentType: 'general-purpose',
      provider: { plugin: 'workflow', tier: 'user' },
      parentModel: 'claude-opus',
      background: false,
      fork: false,
    } as any)
    expect((await bandeau($)).texte).toBe('P7 · vague 4 · S2  │  7 j 40 %')
  })

  test('script en echec : le bandeau garde le plan et les limites', async ($, on) => {
    monde(on, { fichiers: ['plugin/bin/prochaine-action.mjs'], scripts: { P1: 'pas du json' }, rateLimits: [{ kind: 'seven_day', percentUsed: 40 }] })
    await demarrer($)
    expect((await bandeau($)).texte).toBe('P1  │  7 j 40 %')
  })

  // Ce que le moteur dessine de lui-meme quand le mod passe la main (`next(e)`).
  const moteur = (on: any) =>
    on('ui.render', ($: any, e: any) => {
      const { Text } = $.ui.resolve(e)
      return <Text>moteur</Text>
    })

  test('pendant un sondage du moteur : le bandeau lui laisse la place', async ($, on) => {
    monde(on, { rateLimits: [{ kind: 'five_hour', percentUsed: 21 }] })
    moteur(on)
    await demarrer($)
    expect((await bandeau($, 'desktop', true)).texte).toBe('moteur')
  })

  test('sans plan ni limites : le bandeau passe la main', async ($, on) => {
    monde(on)
    moteur(on)
    await demarrer($)
    expect((await bandeau($)).texte).toBe('moteur')
  })
})

describe('panneau plan', () => {
  // P1 est le plan par defaut de monde() ; sa sortie est celle, reelle et regeneree a chaque passage, du moteur
  // (voir fixtures-plan.ts).
  const SCRIPTS = { P1: MOTEUR_LANCER }
  const TEXTE_MOTEUR: string[] = JSON.parse(MOTEUR_LANCER).texte.trimEnd().split('\n')
  const AVEC_PLAN = (vendore: boolean) => ({
    fichiers: ['plugin/bin/prochaine-action.mjs', ...(vendore ? ['.claude/workflow/manifest.json'] : [])],
    scripts: SCRIPTS,
  })
  // Chaque bouton : par quel canal il part et ce qui part. `$.prompt.submit` refuse un texte en `/` (le moteur
  // le tient pour une commande) : les boutons slash passent par `$.command.run`.
  const BOUTONS_ATTENDUS = (pref: string) => [
    ['bouton:go', { via: 'prompt', text: 'Go' }],
    ['bouton:reprends', { via: 'commande', text: `${pref}reprendre` }],
    ['bouton:orchestrer', { via: 'commande', text: `${pref}orchestrer-plan P1` }],
    ['bouton:commit', { via: 'prompt', text: `Committe et pousse le travail en attente, selon ${pref}fin-de-tache.` }],
  ] as const
  for (const surface of SURFACES) {
    test(`${surface} : plan, vague, texte du moteur ligne a ligne et quatre boutons`, async ($, on) => {
      monde(on, AVEC_PLAN(false))
      await demarrer($)
      const ui = await monter($, surface, 'plan')
      const lignes = await textes(ui)
      expect(lignes[0]).toBe('P1 · vague 1')
      // Le texte du moteur, tel quel (une ligne vide s'affiche en blanc) : la premiere ligne n'est plus refaite.
      expect(lignes.slice(1, 1 + TEXTE_MOTEUR.length)).toEqual(TEXTE_MOTEUR.map((l) => (l === '' ? ' ' : l)))
      expect(lignes[1]).toBe('lancer — vague 1 : S1')
      expect(lignes.some((l) => l.includes('parallele'))).toBe(false)
      const boutons = await ui.findAll({ type: 'Button' })
      expect(boutons.map((b: any) => b.text)).toEqual(['Go', 'Reprends', "Enchaîne l'orchestration", 'Commit+push'])
    })

    test(`${surface} : depot source, un appui lance ce que dit chaque bouton, prefixe /workflow:`, async ($, on) => {
      const s = monde(on, AVEC_PLAN(false))
      await demarrer($)
      const ui = await monter($, surface, 'plan')
      for (const [cle, attendu] of BOUTONS_ATTENDUS('/workflow:')) {
        s.relances.length = 0
        await ui.press({ key: cle })
        expect(s.relances).toEqual([attendu])
      }
    })

    test(`${surface} : projet vendore, un appui lance ce que dit chaque bouton, prefixe /`, async ($, on) => {
      const s = monde(on, AVEC_PLAN(true))
      await demarrer($)
      const ui = await monter($, surface, 'plan')
      for (const [cle, attendu] of BOUTONS_ATTENDUS('/')) {
        s.relances.length = 0
        await ui.press({ key: cle })
        expect(s.relances).toEqual([attendu])
      }
    })

    test(`${surface} : sans plan, message d'attente`, async ($, on) => {
      monde(on)
      await demarrer($)
      expect(await textes(await monter($, surface, 'plan'))).toEqual(['Pas de plan en cours.'])
    })
  }

  test('ouvert au demarrage quand un plan est en cours, jamais sinon', async ($, on) => {
    const avec = monde(on, AVEC_PLAN(false))
    await demarrer($)
    await attendre($)
    expect(avec.panneaux).toContain('plan')
  })

  test('hors projet du workflow : panneau plan jamais ouvert', async ($, on) => {
    const s = monde(on)
    await demarrer($)
    await attendre($)
    expect(s.panneaux).not.toContain('plan')
  })

  test('script en echec : pas de panneau plan', async ($, on) => {
    const s = monde(on, { fichiers: ['plugin/bin/prochaine-action.mjs'], scripts: { P1: 'pas du json' } })
    await demarrer($)
    await attendre($)
    expect(s.panneaux).not.toContain('plan')
  })

  test('commande /panneau : rouvre le panneau plan, et lui seul', async ($, on) => {
    const s = monde(on, AVEC_PLAN(false))
    await demarrer($)
    await attendre($)
    s.panneaux.length = 0
    const r: any = await $.command.run({ command: 'panneau', args: '' } as any)
    expect(s.panneaux).toEqual(['plan'])
    expect(String(r.text)).toBe('Panneau plan ouvert.')
  })
})

describe('panneau plan : le moteur est relu quand HEAD change, pas avant', () => {
  const AVEC_PLAN = { fichiers: ['plugin/bin/prochaine-action.mjs'], scripts: { P1: MOTEUR_LANCER } }
  const moteur = (s: Sorties) => s.commandes.filter((c) => c[0] === 'node')
  const mesurer = ($: any) => $.session.measure({ context: { window: 200000, percent: 11 }, rateLimits: [], changed: ['context'] })

  test('HEAD inchange : un seul appel du moteur (P<n> --json), aucun de plus a chaque mesure', async ($, on) => {
    const s = monde(on, { ...AVEC_PLAN, head: 'aaa111' })
    await demarrer($)
    await attendre($)
    expect(moteur(s)).toHaveLength(1)
    expect(moteur(s)[0].slice(2)).toEqual(['P1', '--json'])
    for (let i = 0; i < 5; i++) await mesurer($)
    expect(moteur(s)).toHaveLength(1)
  })

  test('HEAD change (commit, rebase) : un appel de plus, et un seul, puis plus rien tant que HEAD tient', async ($, on) => {
    let head = 'aaa111'
    const s = monde(on, { ...AVEC_PLAN, head: () => head })
    await demarrer($)
    await attendre($)
    expect(moteur(s)).toHaveLength(1)
    head = 'bbb222'
    await mesurer($)
    expect(moteur(s)).toHaveLength(2)
    await mesurer($)
    await mesurer($)
    expect(moteur(s)).toHaveLength(2)
    head = 'aaa111'
    await mesurer($)
    expect(moteur(s)).toHaveLength(3)
  })

  test('le panneau suit le moteur relu : nouveau texte apres un changement de HEAD', async ($, on) => {
    let head = 'aaa111'
    const sorties: Record<string, string> = { P1: MOTEUR_LANCER }
    const s = monde(on, { ...AVEC_PLAN, scripts: sorties, head: () => head })
    await demarrer($)
    await attendre($)
    const ligne2 = async () => {
      const ui = await monter($, 'desktop', 'plan')
      const t = (await textes(ui))[1]
      await ui.unmount()
      return t
    }
    expect(await ligne2()).toBe('lancer — vague 1 : S1')
    sorties.P1 = JSON.stringify({ action: 'pousser', texte: 'pousser' })
    await mesurer($)
    expect(await ligne2()).toBe('lancer — vague 1 : S1') // HEAD identique : releve garde
    head = 'bbb222'
    await mesurer($)
    expect(await ligne2()).toBe('pousser')
    expect(moteur(s)).toHaveLength(2)
  })

  test('sans depot lisible (git en echec) : relu seulement au plancher, pas a chaque mesure', async ($, on) => {
    const s = monde(on, AVEC_PLAN)
    await demarrer($)
    await attendre($)
    for (let i = 0; i < 5; i++) await mesurer($)
    expect(moteur(s)).toHaveLength(1)
  })
})

describe('panneaux retires', () => {
  test("ni limites ni fichiers ne s'ouvrent, meme dans un depot git avec un plan", async ($, on) => {
    const s = monde(on, { fichiers: ['plugin/bin/prochaine-action.mjs'], scripts: { P1: MOTEUR_LANCER } })
    await demarrer($)
    await attendre($)
    expect(s.panneaux).toEqual(['plan'])
    // Seul `git rev-parse HEAD` est lance (le repere du rafraichissement) : ni status ni diff.
    expect(s.commandes.filter((c) => c[0] === 'git' && c[1] !== 'rev-parse')).toEqual([])
  })

  test("commande /panneau sans plan : le dit, n'ouvre rien", async ($, on) => {
    const s = monde(on)
    await demarrer($)
    await attendre($)
    s.panneaux.length = 0
    const r: any = await $.command.run({ command: 'panneau', args: '' } as any)
    expect(s.panneaux).toEqual([])
    expect(String(r.text)).toBe('Pas de plan en cours.')
  })
})
