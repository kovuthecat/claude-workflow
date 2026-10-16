import { describe, expect, test } from 'claude-code/testing'

import { lireArgs, lireCollecte, parentDe, tableIncidents, trier } from '../hooks/incidents'
import type { Incident } from '../hooks/incidents'
import { COLLECTE_DEPUIS_JSON, COLLECTE_JSON } from './fixtures-incidents'

// Les sorties du script sont GENEREES par tests/tester-mods.mjs depuis le vrai collecter-incidents.mjs a chaque
// passage (voir fixtures-incidents.ts) : le mod lit ce que le script rend, il ne le re-parse plus.

const collecte = (sortie: string) => {
  const c = lireCollecte(sortie)
  if ('erreur' in c) throw new Error(c.erreur)
  return c
}

describe('lireCollecte : la sortie --json du script', () => {
  test('trois projets scrutes, trois incidents ; fichier reduit a son nom', () => {
    const c = collecte(COLLECTE_JSON)
    expect(c.projets).toBe(3)
    expect(c.incidents).toHaveLength(3)
    for (const i of c.incidents) expect(i.fichier).toMatch(/^[^/\\]+\.md$/)
  })

  test('incident conforme (reel) : titre, date du nom de fichier, nature, projet', () => {
    const i = collecte(COLLECTE_JSON).incidents.find((x) => x.fichier === '2026-10-05-publier-argument-inconnu.md')
    expect(i?.projet).toBe('Templates')
    expect(i?.date).toBe('2026-10-05')
    expect(i?.titre).toBe('Incident workflow — 2026-10-05 — `publier.mjs --help` publie pour de bon')
    expect(i?.nature).toBe('environnement')
    expect(i?.conforme).toBe(true)
  })

  test('non conforme : liste quand meme, champs vides, signale', () => {
    const i = collecte(COLLECTE_JSON).incidents.find((x) => x.projet === 'Chords')
    expect(i).toEqual({ projet: 'Chords', fichier: 'mal-rempli.md', date: '', titre: 'Un incident mal rempli', nature: '', conforme: false })
  })

  test('--depuis : le script filtre, le mod garde sa sortie ; un incident sans date reste', () => {
    const c = collecte(COLLECTE_DEPUIS_JSON)
    expect(c.projets).toBe(3)
    expect(c.incidents.map((i) => i.projet).sort()).toEqual(['Chords', 'Templates'])
    expect(c.incidents.some((i) => i.date === '2026-09-29')).toBe(false)
  })

  test('sortie illisible ou d une autre forme : une erreur, jamais une table vide', () => {
    expect('erreur' in lireCollecte('pas du json')).toBe(true)
    expect('erreur' in lireCollecte('{}')).toBe(true)
    expect('erreur' in lireCollecte('[1]')).toBe(true)
    expect('erreur' in lireCollecte('null')).toBe(true)
  })
})

describe('tri et table', () => {
  const incident = (projet: string, date: string, titre = 't'): Incident => ({ projet, fichier: `${date}-${projet}.md`, date, titre, nature: 'environnement', conforme: true })
  const a = incident('Zeta', '2026-09-29')
  const b = incident('Alpha', '2026-10-05', 'publier')
  const c = incident('Alpha', '2026-09-29')
  const nc: Incident = { projet: 'Beta', fichier: 'sans-date.md', date: '', titre: 'Un incident mal rempli', nature: '', conforme: false }

  test('du plus recent au plus ancien, puis par projet', () => {
    expect(trier([a, c, b]).map((i) => `${i.date} ${i.projet}`)).toEqual(['2026-10-05 Alpha', '2026-09-29 Alpha', '2026-09-29 Zeta'])
  })

  test('sans date : en fin de liste', () => {
    expect(trier([nc, a]).map((i) => i.projet)).toEqual(['Zeta', 'Beta'])
  })

  test('table : projet, date, titre, nature ; non conforme signale', () => {
    const t = tableIncidents(trier([b, nc]), 2)
    expect(t.split('\n')).toEqual([
      '2 projet(s) scruté(s) · 2 incident(s)',
      '',
      '| Projet | Date | Titre | Nature |',
      '| --- | --- | --- | --- |',
      '| Alpha | 2026-10-05 | publier | environnement |',
      '| Beta |  | Un incident mal rempli ⚠ en-tête incomplet |  |',
    ])
  })

  test('50 lignes au plus, puis « … et <n> autres »', () => {
    const beaucoup = Array.from({ length: 53 }, (_, k) => incident(`P${k}`, '2026-10-05'))
    const lignes = tableIncidents(trier(beaucoup), 53).split('\n')
    expect(lignes.filter((l) => /^\| P\d/.test(l))).toHaveLength(50)
    expect(lignes.at(-1)).toBe('… et 3 autres')
    expect(lignes[0]).toBe('53 projet(s) scruté(s) · 53 incident(s)')
  })

  test('aucun incident', () => {
    expect(tableIncidents([], 4, '2026-10-01')).toBe('4 projet(s) scruté(s) · depuis 2026-10-01 · 0 incident(s)\n\naucun incident')
  })

  test('une barre verticale dans un titre n\'ouvre pas de colonne', () => {
    expect(tableIncidents([{ ...a, titre: 'a | b' }], 1)).toContain('| a \\| b |')
  })
})

describe('arguments et chemins', () => {
  test('lireArgs', () => {
    expect(lireArgs(undefined)).toEqual({})
    expect(lireArgs('  ')).toEqual({})
    expect(lireArgs('2026-10-01')).toEqual({ depuis: '2026-10-01' })
    expect('erreur' in lireArgs('hier')).toBe(true)
    expect('erreur' in lireArgs('2026-10')).toBe(true)
  })

  test('parentDe : slashs et antislashs, separateur final ignore', () => {
    expect(parentDe('D:\\Dev\\Projets\\Templates')).toBe('D:\\Dev\\Projets')
    expect(parentDe('/work/Projets/Templates/')).toBe('/work/Projets')
    expect(parentDe('/proj')).toBe('/')
  })
})

// La commande, avec un monde simule : le script de collecte rend la sortie reelle (regeneree) du script.
// Le moteur de test rend un chemin absolu avec une lettre de lecteur sous Windows : on la retire.
const norm = (p: string) => p.split(String.fromCharCode(92)).join('/').replace(/^[A-Za-z]:/, '')
const SCRIPT = '/Projets/Templates/plugin/bin/collecter-incidents.mjs'

function monde(on: any, opts: { script: boolean; code?: number; stdout?: string; stderr?: string }) {
  const enregistrees: string[] = []
  const lancements: string[][] = []
  on('session.start', (_$: any, e: any) => ({ cwd: e.cwd }))
  on('session.root', () => ({ value: '/Projets/Templates' }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000 }, rateLimits: [] } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('fs.exists', (_$: any, e: any) => ({ value: opts.script && norm(e.path) === SCRIPT }))
  on('process.run', (_$: any, e: any) => {
    const argv = [...e.argv]
    if (argv[0] !== 'node') return { value: { exitCode: 128, stdout: '', stderr: 'fatal', isStdoutTruncated: false, isStderrTruncated: false } }
    lancements.push(argv)
    const stdout = opts.stdout ?? (argv.includes('--depuis') ? COLLECTE_DEPUIS_JSON : COLLECTE_JSON)
    return { value: { exitCode: opts.code ?? 0, stdout, stderr: opts.stderr ?? '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('command.register', (_$: any, e: any) => {
    enregistrees.push(e.name)
    return { value: { isRegistered: true } }
  })
  return { enregistrees, lancements }
}

const demarrer = ($: any) => $.session.start({ cwd: '/Projets/Templates', surface: 'terminal', isInteractive: true })
const lancer = ($: any, args = '') => $.command.run({ command: 'incidents', args } as any) as Promise<{ text: string }>

describe('commande /incidents : appelle collecter-incidents.mjs', () => {
  test('lance le script --projets <parent> --json et met sa sortie en table, du plus recent au plus ancien', async ($, on) => {
    const m = monde(on, { script: true })
    await demarrer($)
    expect(m.enregistrees).toContain('incidents')
    const { text } = await lancer($)
    expect(m.lancements).toHaveLength(1)
    expect(norm(m.lancements[0][1])).toBe(SCRIPT)
    expect(m.lancements[0].slice(2).map(norm)).toEqual(['--projets', '/Projets', '--json'])
    const lignes = text.split('\n')
    expect(lignes[0]).toBe('3 projet(s) scruté(s) · 3 incident(s)')
    const donnees = lignes.filter((l) => l.startsWith('| ') && !l.startsWith('| Projet') && !l.startsWith('| ---'))
    expect(donnees.map((l) => l.split(' | ').slice(0, 2).join('/'))).toEqual(['| Templates/2026-10-05', '| Templates/2026-09-29', '| Chords/'])
    expect(donnees[2]).toContain('⚠ en-tête incomplet')
  })

  test('/incidents <date> : la date part au script (--depuis), qui filtre', async ($, on) => {
    const m = monde(on, { script: true })
    await demarrer($)
    const { text } = await lancer($, '2026-10-05')
    expect(m.lancements[0].slice(2).map(norm)).toEqual(['--projets', '/Projets', '--json', '--depuis', '2026-10-05'])
    expect(text.split('\n')[0]).toBe('3 projet(s) scruté(s) · depuis 2026-10-05 · 2 incident(s)')
    expect(text).toContain('Chords')
    expect(text).not.toContain('2026-09-29 |')
  })

  test('argument illisible : message, script jamais lance', async ($, on) => {
    const m = monde(on, { script: true })
    await demarrer($)
    const { text } = await lancer($, 'hier')
    expect(text).toContain('YYYY-MM-DD')
    expect(m.lancements).toEqual([])
  })

  test('script en echec : le dit, jamais une table vide', async ($, on) => {
    monde(on, { script: true, code: 2, stdout: '', stderr: 'collecter-incidents: dossier introuvable' })
    await demarrer($)
    const { text } = await lancer($)
    expect(text).toBe('Incidents illisibles : collecter-incidents: dossier introuvable')
  })

  test('sortie du script illisible : le dit', async ($, on) => {
    monde(on, { script: true, stdout: 'pas du json' })
    await demarrer($)
    const { text } = await lancer($)
    expect(text).toContain('Incidents illisibles')
  })

  test('script absent (projet sans collecter-incidents.mjs) : commande non enregistree', async ($, on) => {
    const m = monde(on, { script: false })
    await demarrer($)
    expect(m.enregistrees).not.toContain('incidents')
    expect(m.enregistrees).toContain('panneau')
  })
})
