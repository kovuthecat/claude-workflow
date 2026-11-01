import type { Register } from 'claude-code'

// Garde-fous du workflow (porte de la preuve P13, mods O1 et O3). Silencieux : aucune ecriture,
// aucun refus ; une lecture qui echoue laisse l'evenement inchange.
//
//   O1  agent.spawn   modele CALCULE PAR LE MOTEUR pour la session lancee (escalade comprise), seulement si absent
//   O3  tool.call     run_in_background: false quand le parametre manque (outil Agent)
//
// O1 ne lit plus l'index (P20/S10, point 22 de la revue externe) : imposer la colonne Modele annulait, sur
// une reprise escaladee ou `model` etait omis, l'escalade decidee par le moteur. Il lance
// `prochaine-action.mjs P<n> --json` (lecture seule, sans `--appliquer`) et prend `agent.model` de l'action
// qui vise la session ; sans action pour cette session (lancement hors orchestration), il laisse passer.
// Un processus par lancement d'agent : accepte.
//
// Forme imposee par `plugin validate` : `$` ne passe qu'a des fonctions declarees au sommet.

// Bord droit : `S\d+` suivi directement de `.md` (jamais S1.echec.md ni S1.revue.md).
const RE_SESSION = /plans[\\/](P\d+)[\\/](S\d+)\.md/
const MODELES = ['sonnet', 'opus', 'haiku']
const DELAI_MOTEUR_MS = 8000
// `plugin/bin/` dans le depot source, `.claude/workflow/bin/` dans un projet vendore.
const SCRIPTS = ['plugin/bin/prochaine-action.mjs', '.claude/workflow/bin/prochaine-action.mjs']

async function racine($: any): Promise<string> {
  return String(await $.session.root()).replace(/[\\/]+$/, '')
}

async function trouverScript($: any, base: string): Promise<string | undefined> {
  for (const c of SCRIPTS) {
    try {
      if (await $.fs.exists(`${base}/${c}`)) return `${base}/${c}`
    } catch {
      // essai suivant
    }
  }
  return undefined
}

// `agent.model` de l'action du moteur qui vise `session` : action `lancer` (liste `sessions`) ou
// `reprendre` / `enqueter` / `relancer-interrompue` (champ `session`). Autre chose : undefined.
function modeleDeAction(sortie: string, session: string): string | undefined {
  let action: any
  try {
    action = JSON.parse(sortie)
  } catch {
    return undefined
  }
  const cible = Array.isArray(action?.sessions)
    ? action.sessions.find((s: any) => s?.session === session)
    : action?.session === session
      ? action
      : undefined
  const valeur = String(cible?.agent?.model ?? '').trim().toLowerCase()
  return MODELES.includes(valeur) ? valeur : undefined
}

async function modeleDuMoteur($: any, plan: string, session: string): Promise<string | undefined> {
  try {
    const base = await racine($)
    const script = await trouverScript($, base)
    if (!script) return undefined
    const r = await $.process.run(['node', script, plan, '--json'], { cwd: base, timeoutMs: DELAI_MOTEUR_MS })
    return r?.exitCode === 0 || r?.exitCode === undefined ? modeleDeAction(String(r?.stdout ?? ''), session) : undefined
  } catch {
    return undefined
  }
}

export const register: Register = (on, options) => {
  const actif = (cle: 'o1' | 'o3') => options?.[cle] !== false

  on('agent.spawn', async ($, e, next) => {
    if (!actif('o1') || e.fork || e.model) return next(e)
    const trouve = RE_SESSION.exec(e.prompt)
    if (!trouve) return next(e)
    const impose = await modeleDuMoteur($, trouve[1], trouve[2])
    return next(impose ? { ...e, model: impose } : e)
  })

  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    if (!actif('o3') || (e as any).run_in_background !== undefined) return next(e)
    return next({ ...e, run_in_background: false } as typeof e)
  })
}
