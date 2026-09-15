import { describe, expect, it } from 'vitest'

import {
  planCinema2InterlockShow,
  resolveCinema2InterlockCadenceIdentity,
  type Cinema2InterlockRandomSource,
  type Cinema2InterlockShowPlannerStructure,
} from '../modules/interlock/Cinema2InterlockShowPlanner'

const random = (value = 0.1): Cinema2InterlockRandomSource => Object.freeze({ sample: () => value })
const baseStructure = (overrides: Partial<Cinema2InterlockShowPlannerStructure> = {}): Cinema2InterlockShowPlannerStructure => ({
  sourceIdentity: 'track-a',
  absoluteBeatIndex: 16,
  phraseIdentity: 'phrase-a',
  sectionIdentity: 'section-a',
  dropIdentity: null,
  phase: 'steady',
  performance: {},
  ...overrides,
})

const AUTO_SETTINGS = Object.freeze({
  pattern: 'diamondTunnel' as const,
  segmentPattern: 'centerOut' as const,
  autoPerformance: true,
  patternChange: 'phrase' as const,
})

describe('Cinema 2.0 Interlock deterministic show planner', () => {
  it('keeps manual pattern and segment authority even across a detected drop', () => {
    const plan = planCinema2InterlockShow({
      pattern: 'bassPortal', segmentPattern: 'alternating', autoPerformance: false, patternChange: 'phrase',
    }, baseStructure({ phase: 'peak', dropIdentity: 'drop-a', performance: { dropAccent: 1, impact: 1 } }), random())

    expect(plan.layoutId).toBe('bassPortal')
    expect(plan.segmentProgram).toBe('alternating')
    expect(plan.resetHistory).toBe(false)
  })

  it('uses phase-aware layout families and prevents immediate repeats when alternatives exist', () => {
    const low = planCinema2InterlockShow(AUTO_SETTINGS, baseStructure({ phase: 'low', phraseIdentity: 'p-low' }), random())
    expect(low.layoutId).toBe('diamondTunnel')

    const steady = planCinema2InterlockShow(AUTO_SETTINGS, baseStructure({ phase: 'steady', phraseIdentity: 'p-steady', absoluteBeatIndex: 32 }), random(), low)
    expect(steady.layoutId).toBe('doubleWing')

    const build = planCinema2InterlockShow(AUTO_SETTINGS, baseStructure({ phase: 'building', phraseIdentity: 'p-build', absoluteBeatIndex: 48 }), random(), steady)
    expect(['mechanicalIris', 'bassPortal']).toContain(build.layoutId)

    const release = planCinema2InterlockShow(AUTO_SETTINGS, baseStructure({ phase: 'release', phraseIdentity: 'p-release', absoluteBeatIndex: 64 }), random(), build)
    expect(['doubleWing', 'diamondTunnel']).toContain(release.layoutId)
    expect(release.layoutId).not.toBe(build.layoutId)
  })

  it('makes the first routed drop a Four-Way Vortex hero reveal with a bounded significant-event segment program', () => {
    const plan = planCinema2InterlockShow(AUTO_SETTINGS, baseStructure({
      phase: 'peak', dropIdentity: 'drop-a', performance: { dropAccent: 0.75, impact: 0.82, intensity: 0.95 },
    }), random())
    expect(plan.layoutId).toBe('fourWayVortex')
    expect(plan.segmentProgram).toBe('impactBurst')
    expect(plan.dropHeroShown).toBe(true)
    expect(plan.resetHistory).toBe(true)

    const sameDrop = planCinema2InterlockShow(AUTO_SETTINGS, baseStructure({
      phase: 'peak', dropIdentity: 'drop-a', performance: { dropAccent: 0.4, impact: 0.4 },
    }), random(), plan)
    expect(sameDrop.dropHeroShown).toBe(true)
    expect(sameDrop.lastDropIdentity).toBe('drop-a')
  })

  it('falls back to deterministic 16/32-beat cadence without fabricating phrase or section identities', () => {
    expect(resolveCinema2InterlockCadenceIdentity('phrase', baseStructure({ absoluteBeatIndex: 31, phraseIdentity: null })))
      .toBe('track-a:phrase:fallback16:16')
    expect(resolveCinema2InterlockCadenceIdentity('section', baseStructure({ absoluteBeatIndex: 63, sectionIdentity: null })))
      .toBe('track-a:section:fallback32:32')
  })

  it('keeps Pattern Change Off stable except for the required first detected drop hero', () => {
    const settings = { ...AUTO_SETTINGS, patternChange: 'off' as const }
    const first = planCinema2InterlockShow(settings, baseStructure({ phase: 'steady' }), random())
    const phrase = planCinema2InterlockShow(settings, baseStructure({
      phase: 'building', phraseIdentity: 'phrase-b', sectionIdentity: 'section-b', performance: { phraseAccent: 1, sectionAccent: 1 },
    }), random(), first)
    expect(phrase.layoutId).toBe(first.layoutId)

    const drop = planCinema2InterlockShow(settings, baseStructure({
      phase: 'peak', dropIdentity: 'drop-b', performance: { dropAccent: 1 },
    }), random(), phrase)
    expect(drop.layoutId).toBe('fourWayVortex')
  })

  it('is repeatable for identical event identity and deterministic random input', () => {
    const structure = baseStructure({ phase: 'building', phraseIdentity: 'phrase-repeat', absoluteBeatIndex: 80, performance: { intensity: 0.8, build: 0.9, momentum: 0.7 } })
    expect(planCinema2InterlockShow(AUTO_SETTINGS, structure, random(0.63)))
      .toEqual(planCinema2InterlockShow(AUTO_SETTINGS, structure, random(0.63)))
  })
})
