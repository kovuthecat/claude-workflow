import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Bandeau, Fenetre } from '../types'
import {
  composerBandeau,
  decalageLocal,
  lireEtatPlan,
  planDepuisPrompt,
  planEstOuvert,
  plansParNumero,
  texteBandeau,
} from './limites'
import { lireArgs, lireCollecte, parentDe, tableIncidents, trier } from './incidents'
import { contexteDepuisPrompt, contexteDepuisSkill, nomProjet, promptDeLaPersonne } from './titre'
import type { Contexte } from './titre'

// Affichage du workflow : un bandeau au-dessus du prompt (plan, limites 5 h / 7 j). Le panneau « plan »
// est retiré (0.68.0) : il redisait ce que l'orchestrateur écrit dans la conversation, et ses boutons ne
// servaient presque pas.
// La commande `/incidents` liste les incidents de workflow des projets freres : elle appelle
// `collecter-incidents.mjs --json` (lecture seule), le script fait foi.
// Le titre de la session suit la convention « Projet - P<n> - S<k> » / « Projet - Cadrer » (titre.ts).
// Rien ici n'ecrit dans le projet ni ne refuse un evenement ; toute lecture qui echoue laisse l'affichage tel quel.
//
// Forme imposee par `plugin validate` : `$` ne passe qu'a des fonctions declarees au sommet.

// Le moteur n'est relu que quand `HEAD` change (commit, rebase) ; ce plancher rattrape les changements que git ne
// voit pas (un `index.md` ou un `.echec.md` ecrit sans commit).
const PLANCHER_PLAN_MS = 5 * 60 * 1000
const DELAI_PROCESS_MS = 5000
const DELAI_INCIDENTS_MS = 15000

const bandeauAtom = atom({ plugin: 'affichage', key: 'bandeau' } as const, { fenetres: [] } as Bandeau)

type Etat = {
  plan?: string
  session?: string
  script?: string | null
  cachePlan?: { plan: string; at: number; head?: string; vague?: string; sessions?: string }
  cacheDefaut?: { at: number; head?: string; plan?: string }
  dernierTexte?: string
  fenetres: Fenetre[]
  titreCle?: string
  titrePose?: string
  aReaffirmer?: boolean
  titreEnAttente?: Contexte
  origine?: string
}

async function racine($: any): Promise<string> {
  return String(await $.session.root()).replace(/[\\/]+$/, '')
}

// Nom du projet pour le titre : racine du dépôt (l'arbre principal, même depuis un worktree), sinon
// racine de session.
async function projetCourant($: any): Promise<string | undefined> {
  try {
    const depot = await $.session.repo()
    return nomProjet(depot?.root ?? (await racine($)))
  } catch {
    return undefined
  }
}

async function lireTexte($: any, chemin: string): Promise<string | undefined> {
  try {
    const lu = await $.fs.read(chemin)
    return typeof lu === 'string' ? lu : undefined
  } catch {
    return undefined
  }
}

// prochaine-action.mjs : `plugin/bin/` en source, `.claude/workflow/bin/` en vendore. Aucun des deux :
// hors projet du workflow, la ligne ne porte ni plan, ni vague.
async function trouverScript($: any, s: Etat): Promise<string | null> {
  if (s.script !== undefined) return s.script
  const base = await racine($)
  s.script = null
  for (const c of ['plugin/bin/prochaine-action.mjs', '.claude/workflow/bin/prochaine-action.mjs']) {
    if (await $.fs.exists(`${base}/${c}`)) {
      s.script = `${base}/${c}`
      break
    }
  }
  return s.script
}

async function lancerScript($: any, script: string, argv: string[]): Promise<string | undefined> {
  try {
    const r = await $.process.run(['node', script, ...argv], { cwd: await racine($), timeoutMs: DELAI_PROCESS_MS })
    return String(r.stdout ?? '')
  } catch {
    return undefined
  }
}

// `HEAD` du depot : change a chaque commit ou rebase. Sans git (ou sans commit) : undefined, seul le plancher joue.
async function lireHead($: any): Promise<string | undefined> {
  try {
    const r = await $.process.run(['git', 'rev-parse', 'HEAD'], { cwd: await racine($), timeoutMs: DELAI_PROCESS_MS })
    const head = String(r.stdout ?? '').trim()
    return r.exitCode === 0 && head !== '' ? head : undefined
  } catch {
    return undefined
  }
}

// Un releve (plan par defaut, etat du plan) vaut tant que `HEAD` est le meme et que le plancher n'est pas atteint.
const releveValide = (releve: { at: number; head?: string } | undefined, head: string | undefined, maintenant: number): boolean =>
  releve !== undefined && releve.head === head && maintenant - releve.at < PLANCHER_PLAN_MS

// Vague et sessions du bandeau : UN appel du moteur, `prochaine-action.mjs P<n> --json`, relance seulement quand
// `HEAD` change ; delai 5 s.
async function etatDuPlan(
  $: any,
  s: Etat,
  plan: string,
  maintenant: number,
  head: string | undefined,
): Promise<{ vague?: string; sessions?: string }> {
  if (s.cachePlan && s.cachePlan.plan === plan && releveValide(s.cachePlan, head, maintenant)) return s.cachePlan
  const script = await trouverScript($, s)
  let etat: { vague?: string; sessions?: string } = {}
  if (script) {
    const action = await lancerScript($, script, [plan, '--json'])
    if (action !== undefined) etat = lireEtatPlan(action)
  }
  s.cachePlan = { plan, at: maintenant, head, ...etat }
  return etat
}

// A defaut de repere dans un prompt d'agent : le plus grand P<n> dont l'index n'a pas de ligne `Clos :`.
async function planParDefaut($: any, s: Etat, maintenant: number, head: string | undefined): Promise<string | undefined> {
  if (releveValide(s.cacheDefaut, head, maintenant)) return s.cacheDefaut?.plan
  let plan: string | undefined
  try {
    const base = await racine($)
    const entrees = await $.fs.list(`${base}/plans`)
    const noms = (entrees as any[]).filter((x) => x.kind === 'dir').map((x) => String(x.name))
    for (const nom of plansParNumero(noms)) {
      const texte = await lireTexte($, `${base}/plans/${nom}/index.md`)
      if (texte !== undefined && planEstOuvert(texte)) {
        plan = nom
        break
      }
    }
  } catch {
    plan = undefined
  }
  s.cacheDefaut = { at: maintenant, head, plan }
  return plan
}

// collecter-incidents.mjs : `plugin/bin/` dans le depot source (le script n'est pas vendore, geste de
// mainteneur). Absent : la commande `/incidents` n'est pas enregistree.
async function trouverCollecte($: any): Promise<string | undefined> {
  try {
    const base = await racine($)
    for (const c of ['plugin/bin/collecter-incidents.mjs', '.claude/workflow/bin/collecter-incidents.mjs']) {
      if (await $.fs.exists(`${base}/${c}`)) return `${base}/${c}`
    }
  } catch {
    // pas de commande
  }
  return undefined
}

// Les incidents de tous les projets freres : le script les collecte (`--projets <parent> --json`, `--depuis`).
async function collecterIncidents($: any, depuis: string | undefined): Promise<string> {
  const script = await trouverCollecte($)
  if (!script) return 'collecter-incidents.mjs introuvable dans ce projet.'
  const argv = ['--projets', parentDe(await racine($)), '--json', ...(depuis ? ['--depuis', depuis] : [])]
  const r = await $.process.run(['node', script, ...argv], { cwd: await racine($), timeoutMs: DELAI_INCIDENTS_MS })
  if (r.exitCode !== 0) throw new Error(String(r.stderr ?? '').trim() || `collecter-incidents.mjs a rendu le code ${r.exitCode}`)
  const collecte = lireCollecte(String(r.stdout ?? ''))
  if ('erreur' in collecte) throw new Error(collecte.erreur)
  return tableIncidents(trier(collecte.incidents), collecte.projets, depuis)
}

// Le bandeau, reecrit seulement si son texte change.
async function rafraichirLigne($: any, s: Etat): Promise<void> {
  try {
    const maintenant = Number(await $.clock.now())
    let plan: string | undefined
    let vague: string | undefined
    let sessions: string | undefined
    if (await trouverScript($, s)) {
      const head = await lireHead($)
      plan = s.plan ?? (await planParDefaut($, s, maintenant, head))
      if (plan) {
        const etat = await etatDuPlan($, s, plan, maintenant, head)
        vague = etat.vague
        sessions = etat.sessions ?? (plan === s.plan ? s.session : undefined)
      }
    }
    const bandeau = composerBandeau({ plan, vague, sessions, fenetres: s.fenetres, maintenant, decalage: decalageLocal })
    const texte = texteBandeau(bandeau)
    if (texte !== (s.dernierTexte ?? '')) {
      s.dernierTexte = texte
      await update($, bandeauAtom, () => bandeau)
    }
  } catch {
    // le bandeau n'est jamais bloquant
  }
}

async function mesurer($: any, s: Etat, fenetres: Fenetre[]): Promise<void> {
  s.fenetres = fenetres
  await rafraichirLigne($, s)
}

export const register: Register = (on) => {
  const s: Etat = { fenetres: [] }

  on('session.start', async ($, e, next) => {
    try {
      const usage = await $.session.usage()
      await mesurer($, s, usage?.rateLimits ?? [])
    } catch {
      // limites connues a la premiere mesure
    }
    try {
      if (await trouverCollecte($)) {
        await $.command.register({ name: 'incidents', description: 'Incidents de workflow de tous les projets', argumentHint: '[YYYY-MM-DD]' })
      }
    } catch {
      // la commande n'est jamais bloquante
    }
    return next(e)
  })

  on('command.run', { command: 'incidents' }, async ($, e) => {
    const args = lireArgs(e.args)
    if ('erreur' in args) return { text: args.erreur }
    try {
      return { text: await collecterIncidents($, args.depuis) }
    } catch (x: any) {
      return { text: `Incidents illisibles : ${String(x?.message ?? x)}` }
    }
  })

  on('session.measure', async ($, e, next) => {
    await mesurer($, s, e.rateLimits)
    return next(e)
  })

  // Titre de session « Projet - P<n> - S<k> » / « Projet - P<n> - orchestrateur » / « Projet - Cadrer ».
  // Seuls SessionStart et UserPromptSubmit peuvent poser un titre : un skill appelé par le modèle sur
  // le fil principal (jamais dans un sous-agent : `agentId`) attend le prompt suivant. Même contexte
  // que la dernière fois → rien, pour ne pas écraser un titre posé à la main — sauf au prompt qui suit
  // la pose : Desktop génère son propre titre depuis le premier message et écrase le nôtre dans la
  // seconde (constaté dans les transcripts) ; on le réaffirme alors une fois. Le prompt d'un sous-agent
  // (`agent_id`) ne touche à rien : il renommait la session principale « P<n> - S<k> ».
  on('tool.call', { tool: 'Skill' }, async ($, e, next) => {
    if (e.tool === 'Skill' && !e.agentId) {
      const projet = await projetCourant($)
      const ctx = projet ? contexteDepuisSkill(projet, String(e.skill ?? ''), String(e.args ?? '')) : undefined
      if (ctx && ctx.cle !== s.titreCle) s.titreEnAttente = ctx
    }
    return next(e)
  })

  // /clear (ou une reprise) ouvre une autre conversation dans le même processus : elle n'hérite pas
  // de ce que le mod a retenu de la précédente, sinon le même contexte relancé n'y serait pas renommé.
  // Le compactage ne termine pas la session : rien n'est oublié.
  on('session.end', async ($, e, next) => {
    s.titreCle = s.titrePose = s.titreEnAttente = undefined
    s.aReaffirmer = false
    return next(e)
  })

  // L'origine du prompt (la personne, un compte rendu de sous-agent, une notification) n'est connue que de
  // `prompt.submit`, dont le `next(e)` lance classic.UserPromptSubmit : elle est retenue le temps de ce `next`.
  on('prompt.submit', async ($, e, next) => {
    s.origine = e.origin?.kind
    try {
      return await next(e)
    } finally {
      s.origine = undefined
    }
  })

  on('classic.UserPromptSubmit', async ($, e, next) => {
    const r = await next(e)
    if (e.agent_id) return r
    try {
      const projet = await projetCourant($)
      const lu = projet && promptDeLaPersonne(e.source, s.origine) ? contexteDepuisPrompt(projet, String(e.prompt ?? '')) : undefined
      const ctx = lu ?? s.titreEnAttente
      s.titreEnAttente = undefined
      if (ctx && ctx.cle !== s.titreCle) {
        s.titreCle = ctx.cle
        s.titrePose = ctx.titre
        s.aReaffirmer = true
        return ctx.titre === e.session_title ? r : { ...r, sessionTitle: ctx.titre }
      }
      const reaffirmer = s.aReaffirmer && s.titrePose !== undefined && s.titrePose !== e.session_title
      s.aReaffirmer = false
      return reaffirmer ? { ...r, sessionTitle: s.titrePose } : r
    } catch {
      return r
    }
  })

  // Repere du plan : le dernier plans/P<n>/S<k>.md vu dans un prompt d'agent. `next(e)` inchange.
  on('agent.spawn', async ($, e, next) => {
    const lien = planDepuisPrompt(e.prompt)
    if (lien) {
      s.plan = lien.plan
      s.session = lien.session
      await rafraichirLigne($, s)
    }
    return next(e)
  })

  // Le bandeau au-dessus du prompt : plan, puis « │ », puis les limites, libelles en gras. Il cede la
  // place a un sondage du moteur et ne dessine rien quand il n'a rien a dire.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const bandeau = await read($, bandeauAtom)
    if (e.props.hasSurvey || (!bandeau.plan && bandeau.fenetres.length === 0)) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const limites = bandeau.fenetres.flatMap((f, i) => [
      ...(i > 0 ? [<Text dimColor>{' · '}</Text>] : []),
      <Text bold>{f.libelle}</Text>,
      <Text>{` ${f.valeur}`}</Text>,
    ])
    return (
      <Box flexWrap="wrap">
        {bandeau.plan && <Text>{bandeau.plan}</Text>}
        {bandeau.plan && limites.length > 0 && <Text dimColor>{'  │  '}</Text>}
        {limites}
      </Box>
    )
  })
}
