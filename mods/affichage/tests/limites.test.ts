import { describe, expect, test } from 'claude-code/testing'
import {
  composerBandeau,
  fenetreBandeau,
  formaterReset,
  lignesLimites,
  lireEtatPlan,
  MESSAGE_LIMITES_VIDE,
  planDepuisPrompt,
  planEstOuvert,
  plansParNumero,
  texteBandeau,
} from '../hooks/limites'

// Horloge et fuseau injectes : aucun de ces tests ne depend de la machine qui les joue.
const MAINTENANT = Date.parse('2026-10-07T12:00:00Z') // un mercredi
const PARIS = () => 60
const NEW_YORK = () => -300

describe('formaterReset', () => {
  test('reset dans les 24 h : HH:MM en heure locale', () => {
    expect(formaterReset('2026-10-07T17:40:00Z', MAINTENANT, PARIS)).toBe('18:40')
    expect(formaterReset('2026-10-07T17:40:00Z', MAINTENANT, NEW_YORK)).toBe('12:40')
  })

  test('reset au-dela de 24 h : jour abrege et heure', () => {
    expect(formaterReset('2026-10-12T08:00:00Z', MAINTENANT, PARIS)).toBe('lun. 09:00')
  })

  test("le jour est celui du fuseau, pas celui d'UTC", () => {
    // 23:30Z un dimanche = 00:30 le lundi a Paris
    expect(formaterReset('2026-10-11T23:30:00Z', MAINTENANT, PARIS)).toBe('lun. 00:30')
    expect(formaterReset('2026-10-11T23:30:00Z', MAINTENANT, NEW_YORK)).toBe('dim. 18:30')
  })

  test('frontiere : 23 h 59 reste une heure, 24 h pile passe au jour', () => {
    expect(formaterReset('2026-10-08T11:59:00Z', MAINTENANT, PARIS)).toBe('12:59')
    expect(formaterReset('2026-10-08T12:00:00Z', MAINTENANT, PARIS)).toBe('jeu. 13:00')
  })

  test('absent, illisible ou deja passe : rien', () => {
    expect(formaterReset(undefined, MAINTENANT, PARIS)).toBeUndefined()
    expect(formaterReset('demain', MAINTENANT, PARIS)).toBeUndefined()
    expect(formaterReset('2026-10-07T11:00:00Z', MAINTENANT, PARIS)).toBeUndefined()
  })
})

describe('fenetreBandeau', () => {
  test("arrondi a l'entier ; reset pour 5 h seulement", () => {
    expect(fenetreBandeau({ kind: 'five_hour', percentUsed: 20.6, resetsAt: '2026-10-07T17:40:00Z' }, MAINTENANT, PARIS)).toEqual({
      libelle: '5 h',
      valeur: '21 % ↺ 18:40',
    })
    expect(fenetreBandeau({ kind: 'seven_day', percentUsed: 40.4, resetsAt: '2026-10-12T08:00:00Z' }, MAINTENANT, PARIS)).toEqual({
      libelle: '7 j',
      valeur: '40 %',
    })
  })

  test('fenetre inconnue : omise', () => {
    expect(fenetreBandeau({ kind: 'spend_limit', percentUsed: 3 }, MAINTENANT, PARIS)).toBeUndefined()
  })
})

describe('composerBandeau', () => {
  const fenetres = [
    { kind: 'seven_day', percentUsed: 40, resetsAt: '2026-10-12T08:00:00Z' },
    { kind: 'five_hour', percentUsed: 20.6, resetsAt: '2026-10-07T17:40:00Z' },
  ]
  const texte = (e: Parameters<typeof composerBandeau>[0]) => texteBandeau(composerBandeau(e))

  test("bandeau complet, fenetres remises dans l'ordre 5 h puis 7 j, plan separe par │", () => {
    const b = composerBandeau({ plan: 'P16', vague: '2', sessions: 'S5', fenetres, maintenant: MAINTENANT, decalage: PARIS })
    expect(b).toEqual({
      plan: 'P16 · vague 2 · S5',
      fenetres: [
        { libelle: '5 h', valeur: '21 % ↺ 18:40' },
        { libelle: '7 j', valeur: '40 %' },
      ],
    })
    expect(texteBandeau(b)).toBe('P16 · vague 2 · S5 │ 5 h 21 % ↺ 18:40 · 7 j 40 %')
  })

  test('sans plan : limites seulement', () => {
    expect(texte({ fenetres, maintenant: MAINTENANT, decalage: PARIS })).toBe('5 h 21 % ↺ 18:40 · 7 j 40 %')
  })

  test('segments manquants omis : plan sans vague, une seule fenetre', () => {
    expect(texte({ plan: 'P3', fenetres: [fenetres[1]], maintenant: MAINTENANT, decalage: PARIS })).toBe('P3 │ 5 h 21 % ↺ 18:40')
  })

  test('rien a dire : vide', () => {
    expect(composerBandeau({ fenetres: [], maintenant: MAINTENANT, decalage: PARIS })).toEqual({ fenetres: [] })
  })

  test('vague et session sans plan : jamais affichees seules', () => {
    expect(texte({ vague: '2', sessions: 'S5', fenetres: [], maintenant: MAINTENANT, decalage: PARIS })).toBe('')
  })
})

describe('lignesLimites (panneau)', () => {
  test("liste vide : message d'attente", () => {
    expect(lignesLimites([], MAINTENANT, PARIS)).toEqual([MESSAGE_LIMITES_VIDE])
  })

  test('une ligne par fenetre : barre, pourcentage, reset', () => {
    const lignes = lignesLimites(
      [
        { kind: 'five_hour', percentUsed: 50, resetsAt: '2026-10-07T17:40:00Z' },
        { kind: 'seven_day', percentUsed: 100 },
      ],
      MAINTENANT,
      PARIS,
    )
    expect(lignes).toEqual(['5 h  █████░░░░░  50 %  ↺ 18:40', '7 j  ██████████  100 %'])
  })
})

describe('plan en cours', () => {
  test("repere dans un prompt d'agent, jamais S<k>.echec.md ni S<k>.revue.md", () => {
    expect(planDepuisPrompt('Ouvre plans/P16/S5.md et execute-le')).toEqual({ plan: 'P16', session: 'S5' })
    expect(planDepuisPrompt('Ouvre plans\\P2\\S10.md')).toEqual({ plan: 'P2', session: 'S10' })
    expect(planDepuisPrompt('Lis plans/P16/S5.echec.md')).toBeUndefined()
    expect(planDepuisPrompt('Lis plans/P16/S5.revue.md')).toBeUndefined()
    expect(planDepuisPrompt(undefined)).toBeUndefined()
  })

  test('plan ouvert = index sans ligne Clos', () => {
    expect(planEstOuvert('# P1\n\nWorkflow : v0.55.0\n')).toBe(true)
    expect(planEstOuvert('# P1\n\nClos : 2026-09-25\n')).toBe(false)
    expect(planEstOuvert('# P1\r\n  Clos : 2026-09-25\r\n')).toBe(false)
  })

  test('plans classes par numero decroissant (P10 avant P9)', () => {
    expect(plansParNumero(['P9', 'P10', 'notes', 'P2', 'P16'])).toEqual(['P16', 'P10', 'P9', 'P2'])
  })

  test('sortie de prochaine-action --json : vague et sessions', () => {
    const json = JSON.stringify({ action: 'lancer', vague: 5, sessions: [{ session: 'S5' }, { session: 'S6' }] })
    expect(lireEtatPlan(json)).toEqual({ vague: '5', sessions: 'S5+S6' })
    expect(lireEtatPlan('{"action":"relire","vague":2}')).toEqual({ vague: '2' })
    expect(lireEtatPlan('pas du json')).toEqual({})
  })
})
