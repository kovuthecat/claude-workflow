import type { Bandeau, Fenetre, FenetreBandeau } from '../types'

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

// Une fenetre du bandeau : libelle (en gras a l'ecran) et valeur. Le reset ne sert que pour 5 h : celui
// de 7 j tombe toujours au meme moment de la semaine, il est dans le panneau « limites ».
export function fenetreBandeau(f: Fenetre, maintenant: number, decalage: Decalage): FenetreBandeau | undefined {
  const libelle = libelleFenetre(f.kind)
  if (libelle === undefined) return undefined
  const reset = f.kind === 'five_hour' ? formaterReset(f.resetsAt, maintenant, decalage) : undefined
  return { libelle, valeur: `${arrondi(f.percentUsed)} %${reset === undefined ? '' : ` ↺ ${reset}`}` }
}

// Les fenetres connues, dans l'ordre 5 h puis 7 j.
export function fenetresConnues(fenetres: readonly Fenetre[]): Fenetre[] {
  const ordre = ['five_hour', 'seven_day']
  return ordre.map((k) => fenetres.find((f) => f.kind === k)).filter((f): f is Fenetre => f !== undefined)
}

export type EntreeBandeau = {
  plan?: string
  vague?: string
  sessions?: string
  fenetres: readonly Fenetre[]
  maintenant: number
  decalage: Decalage
}

// Bandeau au-dessus du prompt : `P16 · vague 2 · S5` puis les fenetres ; segment absent = omis.
export function composerBandeau(e: EntreeBandeau): Bandeau {
  const plan = e.plan ? [e.plan, e.vague ? `vague ${e.vague}` : '', e.sessions ?? ''].filter(Boolean).join(' · ') : undefined
  const fenetres = fenetresConnues(e.fenetres)
    .map((f) => fenetreBandeau(f, e.maintenant, e.decalage))
    .filter((f): f is FenetreBandeau => f !== undefined)
  return { ...(plan ? { plan } : {}), fenetres }
}

// Forme texte du bandeau (tests, comparaison) : `P16 · vague 2 │ 5 h 21 % ↺ 18:40 · 7 j 40 %`.
export function texteBandeau(b: Bandeau): string {
  const limites = b.fenetres.map((f) => `${f.libelle} ${f.valeur}`).join(' · ')
  return [b.plan ?? '', limites].filter(Boolean).join(' │ ')
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
