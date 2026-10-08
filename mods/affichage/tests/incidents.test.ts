import { describe, expect, test } from 'claude-code/testing'

import { depuisLe, lireArgs, lireIncident, parentDe, tableIncidents, trier } from '../hooks/incidents'
import { INCIDENT_HOOK, INCIDENT_NON_CONFORME, INCIDENT_PUBLIER } from './fixtures-incidents'

describe('lireIncident', () => {
  test('incident conforme (reel) : titre, date du nom de fichier, nature', () => {
    const i = lireIncident(INCIDENT_PUBLIER, '2026-10-05-publier-argument-inconnu.md', 'Templates')
    expect(i.projet).toBe('Templates')
    expect(i.date).toBe('2026-10-05')
    expect(i.titre).toBe('Incident workflow — 2026-10-05 — `publier.mjs --help` publie pour de bon')
    expect(i.nature).toBe('environnement')
    expect(i.conforme).toBe(true)
  })

  test('autre incident reel : plusieurs champs sur une puce, separes par « · »', () => {
    const i = lireIncident(INCIDENT_HOOK, '2026-09-29-hook-git-commit-a-faux-positif.md', 'Templates')
    expect(i.nature).toBe('environnement')
    expect(i.date).toBe('2026-09-29')
    expect(i.conforme).toBe(true)
  })

  test('fins de ligne Windows : meme resultat', () => {
    const crlf = INCIDENT_PUBLIER.replace(/\n/g, '\r\n')
    expect(lireIncident(crlf, '2026-10-05-x.md', 'T')).toEqual(lireIncident(INCIDENT_PUBLIER, '2026-10-05-x.md', 'T'))
  })

  test('non conforme : liste quand meme, champs vides, signale', () => {
    const i = lireIncident(INCIDENT_NON_CONFORME, 'sans-date.md', 'Autre')
    expect(i).toEqual({ projet: 'Autre', fichier: 'sans-date.md', date: '', titre: 'Un incident mal rempli', nature: '', conforme: false })
  })

  test('un champ du corps ne remplace pas celui de l en-tete (premier match gagne)', () => {
    const texte = `${INCIDENT_PUBLIER}\n- Nature : autre chose\n`
    expect(lireIncident(texte, '2026-10-05-x.md', 'T').nature).toBe('environnement')
  })

  test('en-tete incomplet (Nature absente) : non conforme', () => {
    const sans = INCIDENT_PUBLIER.replace('Nature : environnement', 'Remarque : rien')
    const i = lireIncident(sans, '2026-10-05-x.md', 'T')
    expect(i.nature).toBe('')
    expect(i.conforme).toBe(false)
  })
})

describe('tri, depuis, table', () => {
  const a = lireIncident(INCIDENT_HOOK, '2026-09-29-a.md', 'Zeta')
  const b = lireIncident(INCIDENT_PUBLIER, '2026-10-05-b.md', 'Alpha')
  const c = lireIncident(INCIDENT_HOOK, '2026-09-29-c.md', 'Alpha')
  const nc = lireIncident(INCIDENT_NON_CONFORME, 'sans-date.md', 'Beta')

  test('du plus recent au plus ancien, puis par projet', () => {
    expect(trier([a, c, b]).map((i) => `${i.date} ${i.projet}`)).toEqual(['2026-10-05 Alpha', '2026-09-29 Alpha', '2026-09-29 Zeta'])
  })

  test('sans date : en fin de liste', () => {
    expect(trier([nc, a]).map((i) => i.projet)).toEqual(['Zeta', 'Beta'])
  })

  test('depuis : inclusif ; un incident sans date reste', () => {
    expect(depuisLe([a, b, nc], '2026-10-05').map((i) => i.projet)).toEqual(['Alpha', 'Beta'])
    expect(depuisLe([a, b], '2026-09-29')).toHaveLength(2)
    expect(depuisLe([a, b], undefined)).toHaveLength(2)
  })

  test('table : projet, date, titre, nature ; non conforme signale', () => {
    const t = tableIncidents(trier([b, nc]), 2)
    expect(t.split('\n')).toEqual([
      '2 projet(s) scruté(s) · 2 incident(s)',
      '',
      '| Projet | Date | Titre | Nature |',
      '| --- | --- | --- | --- |',
      `| Alpha | 2026-10-05 | ${b.titre} | environnement |`,
      '| Beta |  | Un incident mal rempli ⚠ en-tête incomplet |  |',
    ])
  })

  test('50 lignes au plus, puis « … et <n> autres »', () => {
    const beaucoup = Array.from({ length: 53 }, (_, k) => lireIncident(INCIDENT_PUBLIER, `2026-10-05-${k}.md`, `P${k}`))
    const lignes = tableIncidents(trier(beaucoup), 53).split('\n')
    expect(lignes.filter((l) => /^\| P\d/.test(l))).toHaveLength(50)
    expect(lignes.at(-1)).toBe('… et 3 autres')
    expect(lignes[0]).toBe('53 projet(s) scruté(s) · 53 incident(s)')
  })

  test('aucun incident', () => {
    expect(tableIncidents([], 4, '2026-10-01')).toBe('4 projet(s) scruté(s) · depuis 2026-10-01 · 0 incident(s)\n\naucun incident')
  })

  test('une barre verticale dans un titre n\'ouvre pas de colonne', () => {
    const i = { ...a, titre: 'a | b' }
    expect(tableIncidents([i], 1)).toContain('| a \\| b |')
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

// La commande, avec un systeme de fichiers simule : deux projets (un sans dossier d'incidents), un dossier
// sans .git, un `#Archives`, un fichier.
const PARENT = '/Projets'
// Le moteur de test rend un chemin absolu avec une lettre de lecteur sous Windows : on la retire.
const norm = (p: string) => p.split(String.fromCharCode(92)).join('/').replace(/^[A-Za-z]:/, '')
const FICHIERS: Record<string, string> = {
  '/Projets/Templates/docs/workflow/incidents/2026-10-05-publier-argument-inconnu.md': INCIDENT_PUBLIER,
  '/Projets/Templates/docs/workflow/incidents/2026-09-29-hook-git-commit-a-faux-positif.md': INCIDENT_HOOK,
  '/Projets/Templates/docs/workflow/incidents/notes.txt': 'pas un incident',
  '/Projets/Chords/docs/workflow/incidents/mal-rempli.md': INCIDENT_NON_CONFORME,
}
const DOSSIERS: Record<string, { name: string; kind: string }[]> = {
  [PARENT]: [
    { name: 'Templates', kind: 'dir' },
    { name: 'Chords', kind: 'dir' },
    { name: 'Vide', kind: 'dir' },
    { name: 'SansGit', kind: 'dir' },
    { name: '#Archives', kind: 'dir' },
    { name: 'node_modules', kind: 'dir' },
    { name: 'remote-control.bat', kind: 'file' },
  ],
  '/Projets/Templates/docs/workflow/incidents': [
    { name: '2026-10-05-publier-argument-inconnu.md', kind: 'file' },
    { name: '2026-09-29-hook-git-commit-a-faux-positif.md', kind: 'file' },
    { name: 'notes.txt', kind: 'file' },
  ],
  '/Projets/Chords/docs/workflow/incidents': [{ name: 'mal-rempli.md', kind: 'file' }],
}
const PRESENTS = ['/Projets/Templates/.git', '/Projets/Chords/.git', '/Projets/Vide/.git', '/Projets/#Archives/.git', '/Projets/node_modules/.git']

function monde(on: any, opts: { workflow: boolean }) {
  const enregistrees: string[] = []
  const lus: string[] = []
  on('session.start', (_$: any, e: any) => ({ cwd: e.cwd }))
  on('session.root', () => ({ value: '/Projets/Templates' }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000 }, rateLimits: [] } }))
  on('process.run', () => ({ value: { exitCode: 128, stdout: '', stderr: 'fatal', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('fs.exists', (_$: any, e: any) => {
    const p = norm(e.path)
    return { value: PRESENTS.includes(p) || (opts.workflow && p === '/Projets/Templates/plugin/.claude-plugin/plugin.json') }
  })
  on('fs.list', (_$: any, e: any) => {
    const l = DOSSIERS[norm(e.path)]
    return l ? { value: l.map((x) => ({ ...x, size: 0, mtimeMs: 0 })) } : { deny: 'ENOENT' }
  })
  on('fs.read', (_$: any, e: any) => {
    const p = norm(e.path)
    lus.push(p)
    return p in FICHIERS ? { value: FICHIERS[p] } : { deny: 'ENOENT' }
  })
  on('command.register', (_$: any, e: any) => {
    enregistrees.push(e.name)
    return { value: { isRegistered: true } }
  })
  return { enregistrees, lus }
}

const demarrer = ($: any) => $.session.start({ cwd: '/Projets/Templates', surface: 'terminal', isInteractive: true })
const lancer = ($: any, args = '') => $.command.run({ command: 'incidents', args } as any) as Promise<{ text: string }>

describe('commande /incidents', () => {
  test('liste les incidents de tous les projets, du plus recent au plus ancien', async ($, on) => {
    const m = monde(on, { workflow: true })
    await demarrer($)
    expect(m.enregistrees).toContain('incidents')
    const { text } = await lancer($)
    const lignes = text.split('\n')
    expect(lignes[0]).toBe('3 projet(s) scruté(s) · 3 incident(s)')
    const donnees = lignes.filter((l) => l.startsWith('| ') && !l.startsWith('| Projet') && !l.startsWith('| ---'))
    expect(donnees.map((l) => l.split(' | ').slice(0, 2).join('/'))).toEqual(['| Templates/2026-10-05', '| Templates/2026-09-29', '| Chords/'])
    expect(donnees[2]).toContain('⚠ en-tête incomplet')
    expect(m.lus).not.toContain('/Projets/Templates/docs/workflow/incidents/notes.txt')
  })

  test('un projet sans dossier d incidents ni les dossiers hors projet ne comptent pas parmi les incidents', async ($, on) => {
    monde(on, { workflow: true })
    await demarrer($)
    const { text } = await lancer($)
    expect(text).not.toContain('SansGit')
    expect(text).not.toContain('Archives')
    expect(text).not.toContain('Vide')
    expect(text).toContain('3 projet(s) scruté(s)')
  })

  test('/incidents <date> : « depuis » inclusif', async ($, on) => {
    monde(on, { workflow: true })
    await demarrer($)
    const { text } = await lancer($, '2026-10-05')
    expect(text.split('\n')[0]).toBe('3 projet(s) scruté(s) · depuis 2026-10-05 · 2 incident(s)')
    expect(text).toContain('Chords')
    expect(text).not.toContain('2026-09-29 |')
  })

  test('argument illisible : message, aucune lecture', async ($, on) => {
    const m = monde(on, { workflow: true })
    await demarrer($)
    const { text } = await lancer($, 'hier')
    expect(text).toContain('YYYY-MM-DD')
    expect(m.lus).toEqual([])
  })

  test('hors projet du workflow : commande non enregistree', async ($, on) => {
    const m = monde(on, { workflow: false })
    await demarrer($)
    expect(m.enregistrees).not.toContain('incidents')
    expect(m.enregistrees).toContain('panneau')
  })
})
