import type { Register } from 'claude-code'

// Garde-fous du workflow (porte de la preuve P13, mods O1 et O3). Silencieux : aucune ecriture,
// aucun refus ; une lecture qui echoue laisse l'evenement inchange.
//
//   O1  agent.spawn   modele de la colonne Modele de plans/P<n>/index.md, seulement si absent
//   O3  tool.call     run_in_background: false quand le parametre manque (outil Agent)
//
// Forme imposee par `plugin validate` : `$` ne passe qu'a des fonctions declarees au sommet.

// Bord droit : `S\d+` suivi directement de `.md` (jamais S1.echec.md ni S1.revue.md).
const RE_SESSION = /plans[\\/](P\d+)[\\/](S\d+)\.md/
const MODELES = ['sonnet', 'opus', 'haiku']

async function racine($: any): Promise<string> {
  return String(await $.session.root()).replace(/[\\/]+$/, '')
}

async function lireTexte($: any, chemin: string): Promise<string | undefined> {
  try {
    const lu = await $.fs.read(chemin)
    return typeof lu === 'string' ? lu : undefined
  } catch {
    return undefined
  }
}

function cellules(ligne: string): string[] {
  return ligne.trim().split('|').slice(1, -1).map((c) => c.trim())
}

// Colonne Modele reperee par son en-tete, repli sur la 4e cellule.
async function modeleDeIndex($: any, plan: string, session: string): Promise<string | undefined> {
  const texte = await lireTexte($, `${await racine($)}/plans/${plan}/index.md`)
  if (texte === undefined) return undefined
  const lignes = texte.split(/\r?\n/).filter((l) => l.trim().startsWith('|'))
  let colonne = 3
  for (const l of lignes) {
    const i = cellules(l).findIndex((c) => /^mod[eè]le$/i.test(c.replace(/[`*]/g, '')))
    if (i >= 0) {
      colonne = i
      break
    }
  }
  const motif = new RegExp(`\\b${session}\\b`)
  for (const l of lignes) {
    const c = cellules(l)
    if (c.length <= colonne || !motif.test(c[0] ?? '')) continue
    const valeur = (c[colonne] ?? '').replace(/[`*]/g, '').trim().toLowerCase()
    return MODELES.includes(valeur) ? valeur : undefined
  }
  return undefined
}

export const register: Register = (on, options) => {
  const actif = (cle: 'o1' | 'o3') => options?.[cle] !== false

  on('agent.spawn', async ($, e, next) => {
    if (!actif('o1') || e.fork || e.model) return next(e)
    const trouve = RE_SESSION.exec(e.prompt)
    if (!trouve) return next(e)
    const impose = await modeleDeIndex($, trouve[1], trouve[2])
    return next(impose ? { ...e, model: impose } : e)
  })

  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    if (!actif('o3') || (e as any).run_in_background !== undefined) return next(e)
    return next({ ...e, run_in_background: false } as typeof e)
  })
}
