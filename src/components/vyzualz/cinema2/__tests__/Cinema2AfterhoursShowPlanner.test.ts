import { describe, expect, it } from 'vitest'

import type { Cinema2AfterhoursRandomSource } from '../modules/afterhours/Cinema2AfterhoursDomain'
import { CINEMA2_AFTERHOURS_PATTERNS, CINEMA2_AFTERHOURS_PATTERN_IDS } from '../modules/afterhours/Cinema2AfterhoursPatternLibrary'
import {
  pickCinema2AfterhoursNextPattern,
  planCinema2AfterhoursShow,
  resolveCinema2AfterhoursCadenceIdentity,
  type Cinema2AfterhoursShowPlannerSettings,
  type Cinema2AfterhoursShowPlannerStructure,
} from '../modules/afterhours/Cinema2AfterhoursShowPlanner'

const SETTINGS: Cinema2AfterhoursShowPlannerSettings = Object.freeze({
  pattern: 'wideFan',
  autoPerformance: false,
  laserLimit: 16,
  symmetry: true,
  sideLasers: false,
  topLasers: false,
  patternChange: 'bar4',
})

const STRUCTURE: Cinema2AfterhoursShowPlannerStructure = Object.freeze({
  sourceIdentity: 'track-a',
  absoluteBarIndex: 0,
  phraseIdentity: 'phrase-a',
  dropIdentity: 'drop-a',
  hardCutIntent: false,
})

function random(value = 0.99): Cinema2AfterhoursRandomSource {
  return Object.freeze({ sample: () => value })
}

function hashedRandom(): Cinema2AfterhoursRandomSource {
  return Object.freeze({
    sample(namespace: Parameters<Cinema2AfterhoursRandomSource['sample']>[0], index = 0) {
      const text = `${namespace.moduleId}|${namespace.eventId ?? ''}|${namespace.purpose}|${namespace.substream ?? ''}|${index}`
      let hash = 2166136261
      for (let cursor = 0; cursor < text.length; cursor += 1) {
        hash ^= text.charCodeAt(cursor)
        hash = Math.imul(hash, 16777619)
      }
      return (hash >>> 0) / 4294967296
    },
  })
}

describe('Cinema 2.0 Afterhours 2.0 Stage 5 Show Planner', () => {
  it('keeps the authored pattern and hard bank authorizations authoritative when Auto Performance is off', () => {
    const plan = planCinema2AfterhoursShow(SETTINGS, STRUCTURE, random())
    expect(plan.patternId).toBe('wideFan')
    expect(plan.sideLasers).toBe(false)
    expect(plan.topLasers).toBe(false)
    expect(plan.symmetry).toBe(true)
    expect(plan.laserLimit).toBe(16)
    expect(plan.transitionIntent).toBe('smooth')
  })

  it('keeps the manual pattern/banks authoritative while shared performance intent modulates the authored show', () => {
    const baseline = planCinema2AfterhoursShow(SETTINGS, STRUCTURE, random(0.99))
    const reactive = planCinema2AfterhoursShow(
      SETTINGS,
      { ...STRUCTURE, hardCutIntent: true, performance: { build: 0.9, intensity: 0.8, kickAccent: 1, downbeatAccent: 1 } },
      random(0.99),
    )
    expect(reactive.patternId).toBe(SETTINGS.pattern)
    expect(reactive.sideLasers).toBe(false)
    expect(reactive.topLasers).toBe(false)
    expect(reactive.transitionIntent).toBe('smooth')
    expect(reactive.spreadScale).toBeLessThan(baseline.spreadScale)
    expect(reactive.motionScale).toBeGreaterThan(baseline.motionScale)
    expect(reactive.bottomIntensity).toBeGreaterThan(baseline.bottomIntensity)
  })

  it('may choose another pattern but never resurrects disabled user fixture banks', () => {
    const authored = { ...SETTINGS, autoPerformance: true, patternChange: 'off' as const }
    const plan = planCinema2AfterhoursShow(authored, STRUCTURE, random(0.99))
    expect(CINEMA2_AFTERHOURS_PATTERN_IDS).toContain(plan.patternId)
    expect(plan.patternId).not.toBe(authored.pattern)
    expect(plan.sideLasers).toBe(false)
    expect(plan.topLasers).toBe(false)
    expect(authored.sideLasers).toBe(false)
    expect(authored.topLasers).toBe(false)
    expect(authored.pattern).toBe('wideFan')
  })

  it('plays the runtime pattern Pattern Change moved to, without requiring full Auto Performance', () => {
    const first = planCinema2AfterhoursShow({ ...SETTINGS, patternChange: 'bar' }, { ...STRUCTURE, absoluteBarIndex: 12 }, random())
    const next = planCinema2AfterhoursShow({ ...SETTINGS, patternChange: 'bar', activePattern: 'crossfire' }, { ...STRUCTURE, absoluteBarIndex: 13 }, random())
    expect(first.patternId).toBe('wideFan')
    expect(next.patternId).toBe('crossfire')
    expect(next.sideLasers).toBe(false)
    expect(next.topLasers).toBe(false)
    // With Pattern Change off, a stale runtime pattern never overrides the authored one.
    expect(planCinema2AfterhoursShow({ ...SETTINGS, patternChange: 'off', activePattern: 'crossfire' }, STRUCTURE, random()).patternId).toBe('wideFan')
  })

  it('picks a random next pattern that is never the current one, deterministically per boundary', () => {
    const source = hashedRandom()
    const picks = new Set<string>()
    let current = 'wideFan'
    for (let bar = 0; bar < 60; bar += 1) {
      const next = pickCinema2AfterhoursNextPattern(current, `track-a:bar:${bar}`, source)
      expect(next).not.toBe(current)
      expect(CINEMA2_AFTERHOURS_PATTERN_IDS).toContain(next)
      expect(pickCinema2AfterhoursNextPattern(current, `track-a:bar:${bar}`, source)).toBe(next)
      picks.add(next)
      current = next
    }
    // Random, not a fixed rotation: many different patterns come up and the order is not the list order.
    expect(picks.size).toBeGreaterThan(15)
    const order = [...picks].map(id => CINEMA2_AFTERHOURS_PATTERN_IDS.indexOf(id))
    expect(order).not.toEqual([...order].sort((a, b) => a - b))
  })

  it('never exceeds Laser Count and preserves authored Symmetry in either authority mode', () => {
    for (const autoPerformance of [false, true]) {
      for (const laserLimit of [2, 7, 46]) {
        const plan = planCinema2AfterhoursShow(
          { ...SETTINGS, autoPerformance, laserLimit, symmetry: false },
          STRUCTURE,
          hashedRandom(),
        )
        expect(plan.laserLimit).toBeGreaterThanOrEqual(2)
        expect(plan.laserLimit).toBeLessThanOrEqual(laserLimit)
        expect(plan.symmetry).toBe(false)
      }
    }
  })

  it('derives bar4 and bar8 from actual absolute bars rather than beat-length clocks', () => {
    const bar4 = (bar: number) => resolveCinema2AfterhoursCadenceIdentity('bar4', { ...STRUCTURE, absoluteBarIndex: bar })
    expect(bar4(0)).toBe(bar4(3))
    expect(bar4(4)).not.toBe(bar4(3))
    expect(bar4(4)).toBe(bar4(7))
    expect(bar4(8)).not.toBe(bar4(7))

    const bar8 = (bar: number) => resolveCinema2AfterhoursCadenceIdentity('bar8', { ...STRUCTURE, absoluteBarIndex: bar })
    expect(bar8(0)).toBe(bar8(7))
    expect(bar8(8)).not.toBe(bar8(7))
    expect(bar8(8)).toBe(bar8(15))
    expect(bar8(16)).not.toBe(bar8(15))
  })

  it('keeps Pattern Change off structurally stable while bar cadence changes once per actual bar', () => {
    const offA = planCinema2AfterhoursShow(
      { ...SETTINGS, autoPerformance: true, patternChange: 'off' },
      { ...STRUCTURE, absoluteBarIndex: 1 },
      hashedRandom(),
    )
    const offB = planCinema2AfterhoursShow(
      { ...SETTINGS, autoPerformance: true, patternChange: 'off' },
      { ...STRUCTURE, absoluteBarIndex: 99 },
      hashedRandom(),
    )
    expect(offB.cadenceIdentity).toBe(offA.cadenceIdentity)
    expect(offB.patternId).toBe(offA.patternId)

    const barA = resolveCinema2AfterhoursCadenceIdentity('bar', { ...STRUCTURE, absoluteBarIndex: 12 })
    const barARepeat = resolveCinema2AfterhoursCadenceIdentity('bar', { ...STRUCTURE, absoluteBarIndex: 12 })
    const barB = resolveCinema2AfterhoursCadenceIdentity('bar', { ...STRUCTURE, absoluteBarIndex: 13 })
    expect(barARepeat).toBe(barA)
    expect(barB).not.toBe(barA)
  })

  it('uses authoritative phrase/drop identities as stable cadence boundaries', () => {
    const phraseA = resolveCinema2AfterhoursCadenceIdentity('phrase', STRUCTURE)
    const phraseB = resolveCinema2AfterhoursCadenceIdentity('phrase', { ...STRUCTURE, absoluteBarIndex: 40 })
    const phraseC = resolveCinema2AfterhoursCadenceIdentity('phrase', { ...STRUCTURE, phraseIdentity: 'phrase-b' })
    expect(phraseB).toBe(phraseA)
    expect(phraseC).not.toBe(phraseA)

    const dropA = resolveCinema2AfterhoursCadenceIdentity('drop', STRUCTURE)
    const dropB = resolveCinema2AfterhoursCadenceIdentity('drop', { ...STRUCTURE, absoluteBarIndex: 80 })
    const dropC = resolveCinema2AfterhoursCadenceIdentity('drop', { ...STRUCTURE, dropIdentity: 'drop-b' })
    expect(dropB).toBe(dropA)
    expect(dropC).not.toBe(dropA)
  })

  it('defaults to smooth transitions and requires explicit delegated hard-cut intent', () => {
    const auto = { ...SETTINGS, autoPerformance: true }
    expect(planCinema2AfterhoursShow(auto, STRUCTURE, random()).transitionIntent).toBe('smooth')
    expect(planCinema2AfterhoursShow(auto, { ...STRUCTURE, hardCutIntent: true }, random()).transitionIntent).toBe('hardCut')
    expect(planCinema2AfterhoursShow(SETTINGS, { ...STRUCTURE, hardCutIntent: true }, random()).transitionIntent).toBe('smooth')
  })

  it('reconstructs identical decisions for equivalent structural inputs across replay/seek', () => {
    const settings = { ...SETTINGS, autoPerformance: true, patternChange: 'bar8' as const }
    const source = hashedRandom()
    const first = planCinema2AfterhoursShow(settings, { ...STRUCTURE, absoluteBarIndex: 24 }, source)
    const repeated = planCinema2AfterhoursShow(settings, { ...STRUCTURE, absoluteBarIndex: 24 }, source)
    const replayedWithinSameEightBarWindow = planCinema2AfterhoursShow(settings, { ...STRUCTURE, absoluteBarIndex: 31 }, source)
    expect(repeated).toEqual(first)
    expect(replayedWithinSameEightBarWindow).toEqual(first)
  })

  it('compresses builds, releases on impact, and lets vocal presence create negative space', () => {
    const auto = { ...SETTINGS, autoPerformance: true }
    const baseline = planCinema2AfterhoursShow(auto, STRUCTURE, random(0.99))
    const building = planCinema2AfterhoursShow(
      auto,
      { ...STRUCTURE, performance: { build: 0.9, intensity: 0.7 } },
      random(0.99),
    )
    const impact = planCinema2AfterhoursShow(
      auto,
      { ...STRUCTURE, performance: { build: 0.15, impact: 1, dropAccent: 1 } },
      random(0.99),
    )
    const vocal = planCinema2AfterhoursShow(
      auto,
      { ...STRUCTURE, performance: { vocalPresence: 1, intensity: 0.8 } },
      random(0.99),
    )

    expect(building.spreadScale).toBeLessThan(baseline.spreadScale)
    expect(impact.spreadScale).toBeGreaterThan(building.spreadScale)
    expect(vocal.laserLimit).toBeLessThan(baseline.laserLimit)
    expect(vocal.motionScale).toBeLessThan(baseline.motionScale)
  })

  it('gives kick and snare meaningfully different fixture-family emphasis', () => {
    const auto = { ...SETTINGS, autoPerformance: true }
    const kick = planCinema2AfterhoursShow(
      auto,
      { ...STRUCTURE, performance: { kickAccent: 1 } },
      random(0.99),
    )
    const snare = planCinema2AfterhoursShow(
      auto,
      { ...STRUCTURE, performance: { snareAccent: 1 } },
      random(0.99),
    )

    expect(kick.bottomIntensity).toBeGreaterThan(kick.sideIntensity)
    expect(kick.bottomIntensity).toBeGreaterThan(kick.topIntensity)
    expect(snare.sideIntensity).toBeGreaterThan(snare.bottomIntensity)
    expect(snare.topIntensity).toBeGreaterThan(snare.bottomIntensity)
  })

  it('picks patterns whose energy suits the music, only inside Auto Performance authority', () => {
    const energyOf = (id: string) => CINEMA2_AFTERHOURS_PATTERNS.find(candidate => candidate.id === id)!.energy
    const auto = { ...SETTINGS, autoPerformance: true }
    for (const value of [0.05, 0.4, 0.8]) {
      expect(energyOf(planCinema2AfterhoursShow(auto, { ...STRUCTURE, performance: { impact: 1, dropAccent: 1 } }, random(value)).patternId)).toBe('high')
      expect(energyOf(planCinema2AfterhoursShow(auto, { ...STRUCTURE, performance: { build: 0.9 } }, random(value)).patternId)).toBe('build')
      expect(energyOf(planCinema2AfterhoursShow(auto, { ...STRUCTURE, performance: { vocalPresence: 0.9 } }, random(value)).patternId)).toBe('low')
    }
    const manual = planCinema2AfterhoursShow(SETTINGS, { ...STRUCTURE, performance: { impact: 1, dropAccent: 1 } }, random(0.1))
    expect(manual.patternId).toBe(SETTINGS.pattern)
  })

  it('gates blackouts to sparse structural significance instead of kick/snare flicker', () => {
    const auto = { ...SETTINGS, autoPerformance: true }
    const kickOnly = planCinema2AfterhoursShow(
      auto,
      { ...STRUCTURE, performance: { kickAccent: 1, snareAccent: 1 } },
      random(0.99),
    )
    const structuralBelowGate = planCinema2AfterhoursShow(
      auto,
      { ...STRUCTURE, performance: { dropAccent: 1, impact: 1 } },
      random(0.5),
    )
    const structuralAccepted = planCinema2AfterhoursShow(
      auto,
      { ...STRUCTURE, performance: { dropAccent: 1, impact: 1 } },
      random(0.99),
    )
    const phraseAccepted = planCinema2AfterhoursShow(
      auto,
      { ...STRUCTURE, dropIdentity: null, performance: { phraseAccent: 1 } },
      random(0.99),
    )

    expect(kickOnly.blackout).toBe(0)
    expect(structuralBelowGate.blackout).toBe(0)
    expect(structuralAccepted.blackout).toBeGreaterThan(0)
    expect(phraseAccepted.blackout).toBeGreaterThan(0)
  })

})
