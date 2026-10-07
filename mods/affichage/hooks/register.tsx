import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { EtatFichiers, Fenetre, Limites, Mode, ModelePlan, PlanAffiche } from '../types'
import {
  CMD_NON_POUSSES,
  CMD_STATUS,
  ETAT_VIDE,
  RACINE_LABEL,
  SEUIL_REPLI,
  analyserNonPousses,
  analyserStatus,
  construireArbre,
  dossierReplie,
  ligneFichier,
} from './fichiers'
import {
  composerLigne,
  decalageLocal,
  lignesLimites,
  lireEtatPlan,
  planDepuisPrompt,
  planEstOuvert,
  plansParNumero,
} from './limites'
import { DOSSIER_INCIDENTS, depuisLe, estIncident, lireArgs, lireIncident, parentDe, projetScrutable, tableIncidents, trier } from './incidents'
import type { Incident } from './incidents'
import { BOUTONS, ligneSession, modelePlan, relance } from './plan'

// Affichage du workflow : une ligne d'etat (plan, limites 5 h / 7 j, contexte), un panneau « limites »,
// un panneau « fichiers » (etat git) et un panneau « plan » (sessions, prochaine action, boutons de relance).
// La commande `/incidents` liste les incidents de workflow des projets freres (lecture seule).
// Rien ici n'ecrit dans le projet ni ne refuse un evenement ; toute lecture qui echoue laisse l'affichage tel quel.
//
// Forme imposee par `plugin validate` : `$` ne passe qu'a des fonctions declarees au sommet.

const PANE_LIMITES = 'limites'
const PANE_FICHIERS = 'fichiers'
const PANE_PLAN = 'plan'
const CACHE_PLAN_MS = 20000
const DELAI_PROCESS_MS = 5000
const OUTILS_FICHIERS = ['Write', 'Edit', 'NotebookEdit', 'Bash', 'PowerShell']

const limitesAtom = atom({ plugin: 'affichage', key: 'limites' } as const, { fenetres: [] } as Limites)
const fichiersAtom = atom({ plugin: 'affichage', key: 'fichiers' } as const, ETAT_VIDE as EtatFichiers)
const repliAtom = atom({ plugin: 'affichage', key: 'repli' } as const, {} as Record<string, boolean>)
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
  contexte?: number
  fichiersJson?: string
  depot: boolean
  fichiersOuvert: boolean
  planModele?: ModelePlan
  planJson?: string
  planOuvert: boolean
  demarree: boolean
}

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

// La ligne d'etat, reecrite seulement si son texte change.
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
    const texte = composerLigne({
      plan,
      vague,
      sessions,
      fenetres: s.fenetres,
      contexte: s.contexte,
      maintenant,
      decalage: decalageLocal,
    })
    if (texte !== (s.dernierTexte ?? '')) {
      s.dernierTexte = texte
      $.ui.status(texte === '' ? undefined : texte)
    }
    await majPlan($, s, modele)
  } catch {
    // la ligne d'etat n'est jamais bloquante
  }
}

async function mesurer($: any, s: Etat, fenetres: Fenetre[], contexte: number | undefined): Promise<void> {
  s.fenetres = fenetres
  s.contexte = contexte
  await update($, limitesAtom, () => ({ fenetres, ...(contexte !== undefined ? { contexte } : {}) }))
  await rafraichirLigne($, s)
}

// L'etat git : `git status` (modifie, nouveau) et les commits sans amont atteint (`↑`).
async function rafraichirFichiers($: any, s: Etat): Promise<void> {
  try {
    const base = await racine($)
    const init = { cwd: base, timeoutMs: DELAI_PROCESS_MS }
    const st = await $.process.run([...CMD_STATUS], init)
    let etat: EtatFichiers = ETAT_VIDE
    if (st.exitCode === 0) {
      let amont = false
      let nonPousses: string[] = []
      try {
        const r = await $.process.run([...CMD_NON_POUSSES], init)
        if (r.exitCode === 0) {
          amont = true
          nonPousses = analyserNonPousses(String(r.stdout ?? ''))
        }
      } catch {
        amont = false
      }
      etat = construireArbre(analyserStatus(String(st.stdout ?? '')), nonPousses, amont)
    }
    s.depot = etat.depot
    const json = JSON.stringify(etat)
    if (json !== s.fichiersJson) {
      s.fichiersJson = json
      await update($, fichiersAtom, () => etat)
    }
    if (!etat.depot && s.fichiersOuvert) {
      s.fichiersOuvert = false
      await $.ui.close({ id: PANE_FICHIERS })
    }
  } catch {
    // le panneau garde son dernier etat
  }
}

// Ouvre les panneaux utiles ; « fichiers » seulement dans un depot git.
async function ouvrirPanneaux($: any, s: Etat): Promise<string> {
  const ouverts: string[] = []
  const limites = await $.ui.open({ id: PANE_LIMITES, title: 'Limites' })
  if (limites?.isPlaced !== false) ouverts.push('limites')
  if (s.depot) {
    const fichiers = await $.ui.open({ id: PANE_FICHIERS, title: 'Fichiers' })
    s.fichiersOuvert = true
    if (fichiers?.isPlaced !== false) ouverts.push('fichiers')
  }
  if (s.planModele) {
    s.planOuvert = true
    const plan = await $.ui.open({ id: PANE_PLAN, title: 'Plan' })
    if (plan?.isPlaced !== false) ouverts.push('plan')
  }
  return ouverts.length > 0 ? `Panneaux ouverts : ${ouverts.join(', ')}.` : 'Aucun panneau placé : élargir le terminal.'
}

export const register: Register = (on) => {
  const s: Etat = { fenetres: [], depot: false, fichiersOuvert: false, planOuvert: false, demarree: false }

  on('session.start', async ($, e, next) => {
    try {
      const usage = await $.session.usage()
      await mesurer($, s, usage?.rateLimits ?? [], usage?.context?.percent)
    } catch {
      // limites connues a la premiere mesure
    }
    await rafraichirFichiers($, s)
    try {
      if (await projetDuWorkflow($)) {
        await $.command.register({ name: 'incidents', description: 'Incidents de workflow de tous les projets', argumentHint: '[YYYY-MM-DD]' })
      }
    } catch {
      // la commande n'est jamais bloquante
    }
    try {
      await $.command.register({ name: 'panneau', description: 'Rouvre les panneaux limites, fichiers et plan' })
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
    await rafraichirFichiers($, s)
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
    await mesurer($, s, e.rateLimits, e.context?.percent)
    return next(e)
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

  on('tool.call', { tool: OUTILS_FICHIERS }, async ($, e, next) => {
    const r = await next(e)
    await rafraichirFichiers($, s)
    return r
  })

  on('ui.render', { component: 'Pane', requestId: PANE_LIMITES }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const { fenetres } = await read($, limitesAtom)
    const maintenant = Number(await $.clock.now())
    return (
      <Box flexDirection="column">
        {lignesLimites(fenetres, maintenant, decalageLocal).map((l) => (
          <Text>{l}</Text>
        ))}
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

  on('ui.render', { component: 'Pane', requestId: PANE_FICHIERS }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const etat = await read($, fichiersAtom)
    const repli = await read($, repliAtom)
    if (!etat.depot) return <Text dimColor>Pas de dépôt git.</Text>
    const entete = `${etat.total} fichier${etat.total > 1 ? 's' : ''} · ● modifié  + nouveau  ↑ non poussé`
    return (
      <Box flexDirection="column">
        {!etat.amont && <Text dimColor>pas d'amont</Text>}
        {etat.total === 0 ? <Text dimColor>Rien à committer ni à pousser.</Text> : <Text dimColor>{entete}</Text>}
        {etat.dossiers.map((d) => {
          const replie = dossierReplie(d, repli)
          const nom = d.chemin === RACINE_LABEL ? d.chemin : `${d.chemin}/`
          return (
            <Box flexDirection="column">
              <Button
                key={`dossier:${d.chemin}`}
                plain
                label={`${replie ? '▸' : '▾'} ${nom} (${d.fichiers.length})`}
                onPress={() =>
                  update($, repliAtom, (r) => ({ ...r, [d.chemin]: !(r[d.chemin] ?? d.fichiers.length > SEUIL_REPLI) }))
                }
              />
              {!replie && d.fichiers.map((f) => <Text>{`  ${ligneFichier(f)}`}</Text>)}
            </Box>
          )
        })}
        {etat.tronque > 0 && <Text dimColor>{`… et ${etat.tronque} autres fichiers`}</Text>}
      </Box>
    )
  })
}
