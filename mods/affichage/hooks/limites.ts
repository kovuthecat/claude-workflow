import type { Fenetre } from '../types'

// Logique pure de l'affichage : aucun `$`, aucune horloge, aucun fuseau lus ici. L'heure courante et
// le fuseau (`Decalage`) sont injectes par l'appelant, pour que les tests ne dependent pas de la machine.

// Decalage du fuseau local a l'instant `ms`, en minutes a l'est d'UTC (Paris l'hiver : +60).
export type Decalage = (ms: number) => number

export const decalageLocal: Decalage = (ms) => {
  try {
    return -new Date(ms).getTimezoneOffset()
  } catch {
    return 0
  }
}

const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']
const JOUR_MS = 24 * 3600 * 1000

const deuxChiffres = (n: number) => (n < 10 ? `0${n}` : String(n))

// Libelle court d'une fenetre ; une fenetre inconnue (spend_limit...) n'a pas de libelle.
export function libelleFenetre(kind: string): string | undefined {
  if (kind === 'five_hour') return '5 h'
  if (kind === 'seven_day') return '7 j'
  return undefined
}

// `HH:MM` si le reset tombe dans les 24 h, sinon `lun. 09:00` ; rien si la date est illisible ou passee.
export function formaterReset(resetsAt: string | undefined, maintenant: number, decalage: Decalage): string | undefined {
  if (resetsAt === undefined) return undefined
  const ts = Date.parse(resetsAt)
  if (Number.isNaN(ts) || ts < maintenant) return undefined
  const local = new Date(ts + decalage(ts) * 60000)
  const heure = `${deuxChiffres(local.getUTCHours())}:${deuxChiffres(local.getUTCMinutes())}`
  return ts - maintenant < JOUR_MS ? heure : `${JOURS[local.getUTCDay()]} ${heure}`
}

export const arrondi = (pourcent: number) => Math.round(pourcent)

// `5 h 21 % ↺ 18:40` ; undefined pour une fenetre sans libelle.
export function formaterFenetre(f: Fenetre, maintenant: number, decalage: Decalage): string | undefined {
  const libelle = libelleFenetre(f.kind)
  if (libelle === undefined) return undefined
  const reset = formaterReset(f.resetsAt, maintenant, decalage)
  return `${libelle} ${arrondi(f.percentUsed)} %${reset === undefined ? '' : ` ↺ ${reset}`}`
}

// Les fenetres connues, dans l'ordre 5 h puis 7 j.
export function fenetresConnues(fenetres: readonly Fenetre[]): Fenetre[] {
  const ordre = ['five_hour', 'seven_day']
  return ordre.map((k) => fenetres.find((f) => f.kind === k)).filter((f): f is Fenetre => f !== undefined)
}

export type EntreeLigne = {
  plan?: string
  vague?: string
  sessions?: string
  fenetres: readonly Fenetre[]
  contexte?: number
  maintenant: number
  decalage: Decalage
}

// `P16 · vague 2 · S5 · 5 h 21 % ↺ 18:40 · 7 j 40 % ↺ lun. 09:00 · contexte 10 %` ; segment absent = omis.
export function composerLigne(e: EntreeLigne): string {
  const segments: string[] = []
  if (e.plan) {
    segments.push(e.plan)
    if (e.vague) segments.push(`vague ${e.vague}`)
    if (e.sessions) segments.push(e.sessions)
  }
  for (const f of fenetresConnues(e.fenetres)) {
    const texte = formaterFenetre(f, e.maintenant, e.decalage)
    if (texte !== undefined) segments.push(texte)
  }
  if (e.contexte !== undefined) segments.push(`contexte ${arrondi(e.contexte)} %`)
  return segments.join(' · ')
}

// Barre texte de 10 cases : `██░░░░░░░░`.
export function barre(pourcent: number, largeur = 10): string {
  const plein = Math.max(0, Math.min(largeur, Math.round((pourcent / 100) * largeur)))
  return '█'.repeat(plein) + '░'.repeat(largeur - plein)
}

export const MESSAGE_LIMITES_VIDE = 'limites connues après la première réponse'

// Lignes du panneau « limites » : une par fenetre connue ; message d'attente si aucune.
export function lignesLimites(fenetres: readonly Fenetre[], maintenant: number, decalage: Decalage): string[] {
  const connues = fenetresConnues(fenetres)
  if (connues.length === 0) return [MESSAGE_LIMITES_VIDE]
  return connues.map((f) => {
    const reset = formaterReset(f.resetsAt, maintenant, decalage)
    return `${libelleFenetre(f.kind)}  ${barre(f.percentUsed)}  ${arrondi(f.percentUsed)} %${reset === undefined ? '' : `  ↺ ${reset}`}`
  })
}

// ---- Plan en cours ---------------------------------------------------------------------------------

// Bord droit : `S\d+` suivi directement de `.md` (jamais S1.echec.md ni S1.revue.md).
const RE_SESSION = /plans[\\/](P\d+)[\\/](S\d+)\.md/

export function planDepuisPrompt(prompt: string | undefined): { plan: string; session: string } | undefined {
  const trouve = RE_SESSION.exec(String(prompt ?? ''))
  return trouve ? { plan: trouve[1], session: trouve[2] } : undefined
}

// Un index sans ligne `Clos :` est un plan ouvert.
export const planEstOuvert = (texteIndex: string): boolean => !texteIndex.split(/\r?\n/).some((l) => /^Clos\s*:/.test(l.trim()))

// Plans candidats (noms de dossiers de plans/), du plus grand numero au plus petit.
export function plansParNumero(noms: readonly string[]): string[] {
  return noms
    .filter((n) => /^P\d+$/.test(n))
    .sort((a, b) => Number(b.slice(1)) - Number(a.slice(1)))
}

// Sortie `prochaine-action.mjs P<n> --json` : vague (nombre) et sessions ({ session } ou chaine).
export function lireEtatPlan(sortie: string): { vague?: string; sessions?: string } {
  try {
    const j = JSON.parse(sortie)
    const vague = j.vague ?? j.options?.vague
    const liste: string[] = Array.isArray(j.sessions)
      ? j.sessions.map((x: any) => (typeof x === 'string' ? x : x?.session)).filter(Boolean)
      : j.session
        ? [String(j.session)]
        : []
    return {
      ...(vague !== undefined && vague !== null ? { vague: String(vague) } : {}),
      ...(liste.length > 0 ? { sessions: liste.join('+') } : {}),
    }
  } catch {
    return {}
  }
}
