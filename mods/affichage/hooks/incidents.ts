// Parsing pur des incidents de workflow (`docs/workflow/incidents/*.md`, gabarit WORKFLOW.md §9b), PORTE de
// `plugin/bin/collecter-incidents.mjs` (`lireIncident`) : le mod n'a pas Node. Memes regles : un champ est un
// segment `Champ : valeur` d'une puce, premier match gagne ; un incident non conforme est liste quand meme,
// champs vides ; la date vient du nom du fichier. Aucun `$` ici.

export const CHAMPS = ['Projet', 'Workflow', 'Plan', 'Environnement', 'Étape', 'Nature'] as const

export const DOSSIER_INCIDENTS = 'docs/workflow/incidents'
export const LIGNES_MAX = 50

export type Incident = {
  projet: string
  fichier: string
  date: string
  titre: string
  nature: string
  conforme: boolean
}

export function lireIncident(texte: string, fichier: string, projet: string): Incident {
  const lignes = texte.replace(/\r\n/g, '\n').split('\n')
  const titre = (lignes.find((l) => l.startsWith('# ')) ?? '').replace(/^#\s*/, '')
  const champs: Record<string, string> = {}
  for (const ligne of lignes) {
    if (!/^-\s/.test(ligne)) continue
    for (const segment of ligne.replace(/^-\s*/, '').split('·')) {
      const m = /^\s*([^:]+?)\s*:\s*(.*)$/.exec(segment)
      if (!m) continue
      const nom = m[1].trim()
      if ((CHAMPS as readonly string[]).includes(nom) && champs[nom] === undefined) champs[nom] = m[2].trim()
    }
  }
  const date = /^(\d{4}-\d{2}-\d{2})/.exec(nomDeFichier(fichier))?.[1] ?? ''
  const complet = CHAMPS.every((c) => (champs[c] ?? '') !== '')
  return { projet, fichier, date, titre, nature: champs.Nature ?? '', conforme: complet && date !== '' }
}

// Separateur de chemin Windows (ecrit par son code : un antislash litteral se perd dans trop de couches).
const ANTISLASH = String.fromCharCode(92)
const derniereCoupe = (chemin: string) => Math.max(chemin.lastIndexOf('/'), chemin.lastIndexOf(ANTISLASH))

export const nomDeFichier = (chemin: string) => chemin.slice(derniereCoupe(chemin) + 1)

// Le dossier qui contient les projets : le parent de la racine de la session.
export function parentDe(racine: string): string {
  let net = racine
  while (net.endsWith('/') || net.endsWith(ANTISLASH)) net = net.slice(0, -1)
  const coupe = derniereCoupe(net)
  return coupe < 0 ? '' : coupe === 0 ? '/' : net.slice(0, coupe)
}

// Un dossier est un projet a scruter comme dans collecter-incidents.mjs : ni `#...`, ni node_modules.
export const projetScrutable = (nom: string) => !nom.startsWith('#') && nom !== 'node_modules'

export const estIncident = (nom: string) => nom.endsWith('.md')

// `/incidents [YYYY-MM-DD]` : « depuis » facultatif. Argument illisible : une erreur, pas de collecte.
export function lireArgs(args: string | undefined): { depuis?: string } | { erreur: string } {
  const a = String(args ?? '').trim()
  if (a === '') return {}
  if (/^\d{4}-\d{2}-\d{2}$/.test(a)) return { depuis: a }
  return { erreur: `/incidents attend une date YYYY-MM-DD (« depuis »), reçu « ${a} ».` }
}

// Garde un incident daté a partir de `depuis` (inclus) ; sans date lisible, il reste (a corriger).
export const depuisLe = (liste: readonly Incident[], depuis: string | undefined): Incident[] =>
  depuis ? liste.filter((i) => !(i.date && i.date < depuis)) : [...liste]

// Du plus recent au plus ancien ; a date egale, par projet puis par fichier.
export function trier(liste: readonly Incident[]): Incident[] {
  return [...liste].sort(
    (a, b) =>
      (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) ||
      (a.projet < b.projet ? -1 : a.projet > b.projet ? 1 : 0) ||
      (a.fichier < b.fichier ? -1 : a.fichier > b.fichier ? 1 : 0),
  )
}

const cellule = (t: string) => t.replace(/[|]/g, `${ANTISLASH}|`).replace(/\s+/g, ' ').trim()

export function ligneTable(i: Incident): string {
  const titre = `${cellule(i.titre)}${i.conforme ? '' : ' ⚠ en-tête incomplet'}`
  return `| ${cellule(i.projet)} | ${i.date} | ${titre} | ${cellule(i.nature)} |`
}

// Table markdown, `max` lignes de donnees au plus, puis « … et <n> autres ».
export function tableIncidents(liste: readonly Incident[], projets: number, depuis?: string, max = LIGNES_MAX): string {
  const entete = `${projets} projet(s) scruté(s)${depuis ? ` · depuis ${depuis}` : ''} · ${liste.length} incident(s)`
  if (liste.length === 0) return `${entete}\n\naucun incident`
  const gardes = liste.slice(0, max)
  const lignes = ['| Projet | Date | Titre | Nature |', '| --- | --- | --- | --- |', ...gardes.map(ligneTable)]
  if (liste.length > max) lignes.push('', `… et ${liste.length - max} autres`)
  return `${entete}\n\n${lignes.join('\n')}`
}
