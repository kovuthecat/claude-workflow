import { describe, expect, test } from 'claude-code/testing'
import {
  analyserNonPousses,
  analyserStatus,
  CMD_NON_POUSSES,
  CMD_STATUS,
  construireArbre,
  dossierReplie,
  ligneFichier,
  PLAFOND,
  SEUIL_REPLI,
} from '../hooks/fichiers'

// Les fixtures reproduisent la sortie des commandes REELLEMENT lancees (CMD_STATUS, CMD_NON_POUSSES) :
// separateur NUL, chemins non quotes.
const NUL = String.fromCharCode(0)
const sortieStatus = (...entrees: string[]) => entrees.map((e) => e + NUL).join('')

describe('commandes lancees', () => {
  test("status en porcelain v1 -z, diff -z contre l'amont", () => {
    expect(CMD_STATUS).toContain('--porcelain=v1')
    expect(CMD_STATUS).toContain('-z')
    expect(CMD_NON_POUSSES).toContain('-z')
    expect(CMD_NON_POUSSES).toContain('@{upstream}..HEAD')
  })
})

describe('analyserStatus', () => {
  test('modifie (arbre ou index), nouveau (non suivi ou ajoute)', () => {
    const r = analyserStatus(sortieStatus(' M src/a.ts', 'M  src/b.ts', 'MM src/c.ts', '?? src/d.ts', 'A  src/e.ts', ' D src/f.ts'))
    expect(r.map((f) => [f.chemin, f.icone])).toEqual([
      ['src/a.ts', '●'],
      ['src/b.ts', '●'],
      ['src/c.ts', '●'],
      ['src/d.ts', '+'],
      ['src/e.ts', '+'],
      ['src/f.ts', '●'],
    ])
  })

  test("renomme : le jeton suivant est l'ancien chemin, pas un fichier", () => {
    const r = analyserStatus(sortieStatus('R  nouveau/nom.ts', 'ancien/nom.ts', ' M autre.ts'))
    expect(r).toHaveLength(2)
    expect(r[0]).toMatchObject({ chemin: 'nouveau/nom.ts', ancien: 'ancien/nom.ts', icone: '●', nom: 'nom.ts' })
    expect(r[1].chemin).toBe('autre.ts')
  })

  test('chemin avec espaces et accents : tel quel, grace a -z', () => {
    const r = analyserStatus(sortieStatus('?? docs/note de février.md', ' M "guillemets".txt'))
    expect(r.map((f) => f.chemin)).toEqual(['docs/note de février.md', '"guillemets".txt'])
    expect(r[0].nom).toBe('note de février.md')
  })

  test('sortie vide ou jeton tronque : aucun fichier', () => {
    expect(analyserStatus('')).toEqual([])
    expect(analyserStatus('??')).toEqual([])
  })
})

describe('analyserNonPousses', () => {
  test('chemins separes par NUL, espaces conserves', () => {
    expect(analyserNonPousses(`a.ts${NUL}dossier/un fichier.md${NUL}`)).toEqual(['a.ts', 'dossier/un fichier.md'])
    expect(analyserNonPousses('')).toEqual([])
  })
})

describe('construireArbre', () => {
  test('groupe par dossier, tri stable, racine nommee', () => {
    const arbre = construireArbre(analyserStatus(sortieStatus(' M z/b.ts', ' M z/a.ts', '?? README.md', '?? a/x.ts')), [], true)
    expect(arbre.dossiers.map((d) => d.chemin)).toEqual(['(racine)', 'a', 'z'])
    expect(arbre.dossiers[2].fichiers.map((f) => f.nom)).toEqual(['a.ts', 'b.ts'])
    expect(arbre.total).toBe(4)
  })

  test('non pousse : ↑ ; modifie ET non pousse : ● (cumul)', () => {
    const arbre = construireArbre(analyserStatus(sortieStatus(' M s/a.ts')), ['s/a.ts', 's/b.ts'], true)
    const icones = Object.fromEntries(arbre.dossiers[0].fichiers.map((f) => [f.nom, f.icone]))
    expect(icones).toEqual({ 'a.ts': '●', 'b.ts': '↑' })
    expect(arbre.total).toBe(2)
  })

  test("pas d'amont : aucun ↑, et l'etat le dit", () => {
    const arbre = construireArbre([], ['s/a.ts'], false)
    expect(arbre.amont).toBe(false)
    expect(arbre.total).toBe(0)
    expect(arbre.dossiers).toEqual([])
  })

  test('plafond : le surplus est compte, pas affiche', () => {
    const statut = analyserStatus(sortieStatus(...Array.from({ length: PLAFOND + 7 }, (_, i) => `?? lots/f${String(i).padStart(4, '0')}.ts`)))
    const arbre = construireArbre(statut, [], true)
    expect(arbre.total).toBe(PLAFOND + 7)
    expect(arbre.tronque).toBe(7)
    expect(arbre.dossiers[0].fichiers).toHaveLength(PLAFOND)
  })
})

describe('repli', () => {
  const dossier = (n: number) => ({ chemin: 'd', fichiers: Array.from({ length: n }, (_, i) => ({ chemin: `d/${i}`, nom: String(i), icone: '●' as const })) })

  test(`replie d'office au-dela de ${SEUIL_REPLI} fichiers, deplie en dessous`, () => {
    expect(dossierReplie(dossier(SEUIL_REPLI), {})).toBe(false)
    expect(dossierReplie(dossier(SEUIL_REPLI + 1), {})).toBe(true)
  })

  test("le choix de la personne l'emporte dans les deux sens", () => {
    expect(dossierReplie(dossier(SEUIL_REPLI + 1), { d: false })).toBe(false)
    expect(dossierReplie(dossier(2), { d: true })).toBe(true)
  })

  test("ligne : icone, nom, ancien chemin d'un renommage", () => {
    expect(ligneFichier({ chemin: 'a/b.ts', nom: 'b.ts', icone: '+' })).toBe('+ b.ts')
    expect(ligneFichier({ chemin: 'a/b.ts', nom: 'b.ts', icone: '●', ancien: 'a/c.ts' })).toBe('● b.ts  ← a/c.ts')
  })
})
