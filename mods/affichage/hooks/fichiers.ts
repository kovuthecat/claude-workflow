import type { Dossier, EtatFichiers, Fichier } from '../types'

// Parsing pur de l'etat git. Les commandes REELLEMENT lancees par le module (les fixtures de test
// reproduisent leur sortie, `-z` compris) :
export const CMD_STATUS = ['git', 'status', '--porcelain=v1', '-z', '--untracked-files=all'] as const
export const CMD_NON_POUSSES = ['git', 'diff', '--name-only', '-z', '@{upstream}..HEAD'] as const

export const SEUIL_REPLI = 20
export const PLAFOND = 500
export const RACINE_LABEL = '(racine)'

// `XY chemin\0`, et pour un renommage ou une copie `XY nouveau\0ancien\0`.
export function analyserStatus(sortie: string): Fichier[] {
  const jetons = sortie.split('\0')
  const res: Fichier[] = []
  for (let i = 0; i < jetons.length; i++) {
    const t = jetons[i]
    if (t.length < 4 || t[2] !== ' ') continue
    const x = t[0]
    const y = t[1]
    const chemin = t.slice(3)
    let ancien: string | undefined
    if (x === 'R' || x === 'C' || y === 'R' || y === 'C') {
      ancien = jetons[i + 1] || undefined
      i++
    }
    const nouveau = (x === '?' && y === '?') || x === 'A'
    res.push({
      chemin,
      nom: nomDe(chemin),
      icone: nouveau ? '+' : '●',
      ...(ancien !== undefined ? { ancien } : {}),
    })
  }
  return res
}

// `git diff --name-only -z` : chemins separes par NUL.
export function analyserNonPousses(sortie: string): string[] {
  return sortie.split('\0').filter((c) => c !== '')
}

export const nomDe = (chemin: string) => chemin.slice(chemin.lastIndexOf('/') + 1)
const dossierDe = (chemin: string) => (chemin.includes('/') ? chemin.slice(0, chemin.lastIndexOf('/')) : RACINE_LABEL)

// Etat par fichier -> arbre par dossier. Un fichier modifie ET non pousse garde `●` ; `↑` seulement
// pour un fichier commite et non pousse. Sans amont (`amont` faux) : aucun `↑`.
export function construireArbre(statut: readonly Fichier[], nonPousses: readonly string[], amont: boolean): EtatFichiers {
  const parChemin = new Map<string, Fichier>()
  for (const f of statut) parChemin.set(f.chemin, f)
  if (amont) {
    for (const chemin of nonPousses) {
      if (!parChemin.has(chemin)) parChemin.set(chemin, { chemin, nom: nomDe(chemin), icone: '↑' })
    }
  }
  const tous = [...parChemin.values()].sort((a, b) => (a.chemin < b.chemin ? -1 : a.chemin > b.chemin ? 1 : 0))
  const gardes = tous.slice(0, PLAFOND)
  const groupes = new Map<string, Fichier[]>()
  for (const f of gardes) {
    const d = dossierDe(f.chemin)
    const liste = groupes.get(d)
    if (liste) liste.push(f)
    else groupes.set(d, [f])
  }
  const dossiers: Dossier[] = [...groupes.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([chemin, fichiers]) => ({ chemin, fichiers }))
  return { depot: true, amont, total: tous.length, tronque: tous.length - gardes.length, dossiers }
}

export const ETAT_VIDE: EtatFichiers = { depot: false, amont: false, total: 0, tronque: 0, dossiers: [] }

// Un dossier de plus de SEUIL_REPLI fichiers est replie d'office ; un choix de la personne l'emporte.
export function dossierReplie(dossier: Dossier, repli: Readonly<Record<string, boolean>>): boolean {
  return repli[dossier.chemin] ?? dossier.fichiers.length > SEUIL_REPLI
}

export function ligneFichier(f: Fichier): string {
  return `${f.icone} ${f.nom}${f.ancien !== undefined ? `  ← ${f.ancien}` : ''}`
}
