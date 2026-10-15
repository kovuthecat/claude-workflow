import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Bandeau, Fenetre, Mode, ModelePlan, PlanAffiche } from '../types'
import {
  composerBandeau,
  decalageLocal,
  lireEtatPlan,
  planDepuisPrompt,
  planEstOuvert,
  plansParNumero,
  texteBandeau,
} from './limites'
import { DOSSIER_INCIDENTS, depuisLe, estIncident, lireArgs, lireIncident, parentDe, projetScrutable, tableIncidents, trier } from './incidents'
import type { Incident } from './incidents'
import { BOUTONS, ligneSession, modelePlan, relance } from './plan'
import { contexteDepuisPrompt, contexteDepuisSkill, nomProjet, promptDeLaPersonne } from './titre'
import type { Contexte } from './titre'

// Affichage du workflow : un bandeau au-dessus du prompt (plan, limites 5 h / 7 j) et un panneau « plan »
// (sessions, prochaine action, boutons de relance).
// La commande `/incidents` liste les incidents de workflow des projets freres (lecture seule).
// Le titre de la session suit la convention « Projet - P<n> - S<k> » / « Projet - Cadrer » (titre.ts).
// Rien ici n'ecrit dans le projet ni ne refuse un evenement ; toute lecture qui echoue laisse l'affichage tel quel.
//
// Forme imposee par `plugin validate` : `$` ne passe qu'a des fonctions declarees au sommet.

const PANE_PLAN = 'plan'
const CACHE_PLAN_MS = 20000
const DELAI_PROCESS_MS = 5000

const bandeauAtom = atom({ plugin: 'affichage', key: 'bandeau' } as const, { fenetres: [] } as Bandeau)
const planAtom = atom({ plugin: 'affichage', key: 'plan' } as const, { modele: null, mode: 'source' } as PlanAffiche)

type Etat = {
  plan?: string
  session?: string
  script?: string | null
  mode?: Mode
  cachePlan?: { plan: string; at: number; vague?: string; sessions?: string; modele?: ModelePlan }
  cacheDefaut?: { at: number; plan?: string }
  dernierTexte?: string
  fenetres: Fenetre[]
  planModele?: ModelePlan
  planJson?: string
  planOuvert: boolean
  demarree: boolean
  titreCle?: string
  titrePose?: string
  aReaffirmer?: boolean
  titreEnAttente?: Contexte
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

// Mode, comme installer-mods.mjs : manifeste vendore present -> skills sous /<skill>, sinon depot source.
async function trouverMode($: any, s: Etat): Promise<Mode> {
  if (s.mode) return s.mode
  try {
    const base = await racine($)
    s.mode = (await $.fs.exists(`${base}/.claude/workflow/manifest.json`)) ? 'vendore' : 'source'
  } catch {
    s.mode = 'source'
  }
  return s.mode
}

async function lancerScript($: any, script: string, argv: string[]): Promise<string | undefined> {
  try {
    const r = await $.process.run(['node', script, ...argv], { cwd: await racine($), timeoutMs: DELAI_PROCESS_MS })
    return String(r.stdout ?? '')
  } catch {
    return undefined
  }
}

// Vague, sessions et modele du panneau : `prochaine-action.mjs P<n> --json` puis `--etat --json`, cache 20 s, delai 5 s.
async function etatDuPlan(
  $: any,
  s: Etat,
  plan: string,
  maintenant: number,
): Promise<{ vague?: string; sessions?: string; modele?: ModelePlan }> {
  if (s.cachePlan && s.cachePlan.plan === plan && maintenant - s.cachePlan.at < CACHE_PLAN_MS) return s.cachePlan
  const script = await trouverScript($, s)
  let etat: { vague?: string; sessions?: string; modele?: ModelePlan } = {}
  if (script) {
    const action = await lancerScript($, script, [plan, '--json'])
    if (action !== undefined) {
      etat = lireEtatPlan(action)
      const lignes = await lancerScript($, script, [plan, '--etat', '--json'])
      const modele = modelePlan(plan, action, lignes)
      if (modele) etat = { ...etat, modele }
    }
  }
  s.cachePlan = { plan, at: maintenant, ...etat }
  return etat
}

// A defaut de repere dans un prompt d'agent : le plus grand P<n> dont l'index n'a pas de ligne `Clos :`.
async function planParDefaut($: any, s: Etat, maintenant: number): Promise<string | undefined> {
  if (s.cacheDefaut && maintenant - s.cacheDefaut.at < CACHE_PLAN_MS) return s.cacheDefaut.plan
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
  s.cacheDefaut = { at: maintenant, plan }
  return plan
}

// Le panneau « plan » : son etat suit le modele ; il s'ouvre de lui-meme des qu'un plan en cours apparait
// (une fois la session demarree) et se ferme quand il n'y en a plus.
async function majPlan($: any, s: Etat, modele: ModelePlan | undefined): Promise<void> {
  s.planModele = modele
  const affiche: PlanAffiche = { modele: modele ?? null, mode: await trouverMode($, s) }
  const json = JSON.stringify(affiche)
  if (json !== s.planJson) {
    s.planJson = json
    await update($, planAtom, () => affiche)
  }
  if (modele && !s.planOuvert && s.demarree) {
    s.planOuvert = true
    await $.ui.open({ id: PANE_PLAN, title: 'Plan' })
  } else if (!modele && s.planOuvert) {
    s.planOuvert = false
    await $.ui.close({ id: PANE_PLAN })
  }
}

// Projet du workflow : manifeste vendore ou manifeste du plugin source. Hors de l'un et de l'autre, les
// commandes du workflow ne sont pas enregistrees.
async function projetDuWorkflow($: any): Promise<boolean> {
  try {
    const base = await racine($)
    return (await $.fs.exists(`${base}/.claude/workflow/manifest.json`)) || (await $.fs.exists(`${base}/plugin/.claude-plugin/plugin.json`))
  } catch {
    return false
  }
}

// Les incidents de tous les projets freres (`<parent>/*/docs/workflow/incidents/*.md`) : comme
// collecter-incidents.mjs, seuls les dossiers portant un `.git` sont des projets. Lecture seule.
async function collecterIncidents($: any): Promise<{ projets: number; incidents: Incident[] }> {
  const parent = parentDe(await racine($))
  const incidents: Incident[] = []
  let projets = 0
  const entrees = (await $.fs.list(parent)) as any[]
  for (const entree of entrees) {
    const nom = String(entree.name)
    if (entree.kind !== 'dir' || !projetScrutable(nom)) continue
    const dossierProjet = `${parent}/${nom}`
    try {
      if (!(await $.fs.exists(`${dossierProjet}/.git`))) continue
    } catch {
      continue
    }
    projets++
    let fichiers: any[]
    try {
      fichiers = (await $.fs.list(`${dossierProjet}/${DOSSIER_INCIDENTS}`)) as any[]
    } catch {
      continue
    }
    for (const f of fichiers) {
      const fichier = String(f.name)
      if (f.kind === 'dir' || !estIncident(fichier)) continue
      const texte = await lireTexte($, `${dossierProjet}/${DOSSIER_INCIDENTS}/${fichier}`)
      if (texte !== undefined) incidents.push(lireIncident(texte, fichier, nom))
    }
  }
  return { projets, incidents }
}

// Le bandeau, reecrit seulement si son texte change.
async function rafraichirLigne($: any, s: Etat): Promise<void> {
  try {
    const maintenant = Number(await $.clock.now())
    let plan: string | undefined
    let vague: string | undefined
    let sessions: string | undefined
    let modele: ModelePlan | undefined
    if (await trouverScript($, s)) {
      plan = s.plan ?? (await planParDefaut($, s, maintenant))
      if (plan) {
        const etat = await etatDuPlan($, s, plan, maintenant)
        vague = etat.vague
        modele = etat.modele
        sessions = etat.sessions ?? (plan === s.plan ? s.session : undefined)
      }
    }
    const bandeau = composerBandeau({ plan, vague, sessions, fenetres: s.fenetres, maintenant, decalage: decalageLocal })
    const texte = texteBandeau(bandeau)
    if (texte !== (s.dernierTexte ?? '')) {
      s.dernierTexte = texte
      await update($, bandeauAtom, () => bandeau)
    }
    await majPlan($, s, modele)
  } catch {
    // le bandeau n'est jamais bloquant
  }
}

async function mesurer($: any, s: Etat, fenetres: Fenetre[]): Promise<void> {
  s.fenetres = fenetres
  await rafraichirLigne($, s)
}

// Rouvre le panneau « plan » s'il y a un plan en cours.
async function ouvrirPanneaux($: any, s: Etat): Promise<string> {
  if (!s.planModele) return 'Pas de plan en cours.'
  s.planOuvert = true
  const plan = await $.ui.open({ id: PANE_PLAN, title: 'Plan' })
  return plan?.isPlaced !== false ? 'Panneau plan ouvert.' : 'Aucun panneau placé : élargir le terminal.'
}

export const register: Register = (on) => {
  const s: Etat = { fenetres: [], planOuvert: false, demarree: false }

  on('session.start', async ($, e, next) => {
    try {
      const usage = await $.session.usage()
      await mesurer($, s, usage?.rateLimits ?? [])
    } catch {
      // limites connues a la premiere mesure
    }
    try {
      if (await projetDuWorkflow($)) {
        await $.command.register({ name: 'incidents', description: 'Incidents de workflow de tous les projets', argumentHint: '[YYYY-MM-DD]' })
      }
    } catch {
      // la commande n'est jamais bloquante
    }
    try {
      await $.command.register({ name: 'panneau', description: 'Rouvre le panneau plan' })
      void ouvrirPanneaux($, s)
        .catch(() => {})
        .then(() => {
          s.demarree = true
        })
    } catch {
      // les panneaux ne sont jamais bloquants
    }
    return next(e)
  })

  on('command.run', { command: 'panneau' }, async ($) => {
    await rafraichirLigne($, s)
    return { text: await ouvrirPanneaux($, s) }
  })

  on('command.run', { command: 'incidents' }, async ($, e) => {
    const args = lireArgs(e.args)
    if ('erreur' in args) return { text: args.erreur }
    try {
      const { projets, incidents } = await collecterIncidents($)
      return { text: tableIncidents(trier(depuisLe(incidents, args.depuis)), projets, args.depuis) }
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

  on('classic.UserPromptSubmit', async ($, e, next) => {
    const r = await next(e)
    if (e.agent_id) return r
    try {
      const projet = await projetCourant($)
      const lu = projet && promptDeLaPersonne(e.source) ? contexteDepuisPrompt(projet, String(e.prompt ?? '')) : undefined
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

  on('ui.render', { component: 'Pane', requestId: PANE_PLAN }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const { modele, mode } = await read($, planAtom)
    if (!modele) return <Text dimColor>Pas de plan en cours.</Text>
    const entete = [modele.plan, modele.vague ? `vague ${modele.vague}` : '', modele.clos ? 'clos' : ''].filter(Boolean).join(' · ')
    return (
      <Box flexDirection="column">
        <Text bold>{entete}</Text>
        <Text>{`Prochaine action : ${modele.action}`}</Text>
        {modele.avertissement && <Text dimColor>{`⚠ ${modele.avertissement}`}</Text>}
        {modele.sessions.map((x) => (
          <Text>{ligneSession(x)}</Text>
        ))}
        <Box flexWrap="wrap" columnGap={1}>
          {BOUTONS.map((b) => (
            <Button
              key={`bouton:${b.id}`}
              label={b.label}
              onPress={() => {
                const r = relance(b.id, mode, modele.plan)
                const echec = (x: any) => $.ui.toast(`Relance impossible : ${String(x?.message ?? x)}`)
                if (r.via === 'prompt') void $.prompt.submit({ text: r.text, asUser: true }).catch(echec)
                else void $.command.run({ command: r.command, args: r.args }).catch(echec)
              }}
            />
          ))}
        </Box>
      </Box>
    )
  })
}
