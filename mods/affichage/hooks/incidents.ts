// Presentation de `/incidents` : la collecte est faite par `plugin/bin/collecter-incidents.mjs --json` (le script
// fait foi — P20/S10 : la copie de son parsing `lireIncident` est supprimee, jamais regeneree) ; ce fichier
// ne fait que lire sa sortie, trier et mettre en table. Aucun `$` ici.

export const LIGNES_MAX = 50

export type Incident = {
  projet: string
  fichier: string
  date: string
  titre: string
  nature: string
  conforme: boolean
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

// `/incidents [YYYY-MM-DD]` : « depuis » facultatif. Argument illisible : une erreur, pas de collecte.
export function lireArgs(args: string | undefined): { depuis?: string } | { erreur: string } {
  const a = String(args ?? '').trim()
  if (a === '') return {}
  if (/^\d{4}-\d{2}-\d{2}$/.test(a)) return { depuis: a }
  return { erreur: `/incidents attend une date YYYY-MM-DD (« depuis »), reçu « ${a} ».` }
}

// Sortie `--json` de collecter-incidents.mjs : `{ projets: [noms], incidents: [{ date, projet, fichier, titre,
// nature, conforme, ... }] }` ; `fichier` y est un chemin complet, le tableau n'en garde que le nom.
// Illisible ou d'une autre forme : une erreur, jamais une table vide qui ferait croire a « aucun incident ».
export function lireCollecte(sortie: string): { projets: number; incidents: Incident[] } | { erreur: string } {
  let j: any
  try {
    j = JSON.parse(sortie)
  } catch {
    return { erreur: 'sortie du script illisible' }
  }
  if (!j || !Array.isArray(j.projets) || !Array.isArray(j.incidents)) return { erreur: 'sortie du script inattendue' }
  const incidents: Incident[] = j.incidents.map((x: any) => ({
    projet: String(x?.projet ?? ''),
    fichier: nomDeFichier(String(x?.fichier ?? '')),
    date: String(x?.date ?? ''),
    titre: String(x?.titre ?? ''),
    nature: String(x?.nature ?? ''),
    conforme: x?.conforme === true,
  }))
  return { projets: j.projets.length, incidents }
}

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
