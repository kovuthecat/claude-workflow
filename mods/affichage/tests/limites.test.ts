import { describe, expect, test } from 'claude-code/testing'
import {
  composerLigne,
  formaterFenetre,
  formaterReset,
  lignesLimites,
  lireEtatPlan,
  MESSAGE_LIMITES_VIDE,
  planDepuisPrompt,
  planEstOuvert,
  plansParNumero,
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

describe('formaterFenetre', () => {
  test("arrondi a l'entier", () => {
    expect(formaterFenetre({ kind: 'five_hour', percentUsed: 20.6, resetsAt: '2026-10-07T17:40:00Z' }, MAINTENANT, PARIS)).toBe('5 h 21 % ↺ 18:40')
    expect(formaterFenetre({ kind: 'seven_day', percentUsed: 40.4 }, MAINTENANT, PARIS)).toBe('7 j 40 %')
  })

  test('fenetre inconnue : omise', () => {
    expect(formaterFenetre({ kind: 'spend_limit', percentUsed: 3 }, MAINTENANT, PARIS)).toBeUndefined()
  })
})

describe('composerLigne', () => {
  const fenetres = [
    { kind: 'seven_day', percentUsed: 40, resetsAt: '2026-10-12T08:00:00Z' },
    { kind: 'five_hour', percentUsed: 20.6, resetsAt: '2026-10-07T17:40:00Z' },
  ]

  test("ligne complete, fenetres remises dans l'ordre 5 h puis 7 j", () => {
    const ligne = composerLigne({ plan: 'P16', vague: '2', sessions: 'S5', fenetres, contexte: 10, maintenant: MAINTENANT, decalage: PARIS })
    expect(ligne).toBe('P16 · vague 2 · S5 · 5 h 21 % ↺ 18:40 · 7 j 40 % ↺ lun. 09:00 · contexte 10 %')
  })

  test('sans plan : limites et contexte seulement', () => {
    const ligne = composerLigne({ fenetres, contexte: 9.6, maintenant: MAINTENANT, decalage: PARIS })
    expect(ligne).toBe('5 h 21 % ↺ 18:40 · 7 j 40 % ↺ lun. 09:00 · contexte 10 %')
  })

  test('segments manquants omis : plan sans vague, une seule fenetre, pas de contexte', () => {
    expect(composerLigne({ plan: 'P3', fenetres: [fenetres[1]], maintenant: MAINTENANT, decalage: PARIS })).toBe('P3 · 5 h 21 % ↺ 18:40')
  })

  test('rien a dire : chaine vide', () => {
    expect(composerLigne({ fenetres: [], maintenant: MAINTENANT, decalage: PARIS })).toBe('')
  })

  test('vague et session sans plan : jamais affichees seules', () => {
    expect(composerLigne({ vague: '2', sessions: 'S5', fenetres: [], contexte: 1, maintenant: MAINTENANT, decalage: PARIS })).toBe('contexte 1 %')
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
