import { describe, expect, it } from 'vitest'

import type { Cinema2AfterhoursRandomSource } from '../modules/afterhours/Cinema2AfterhoursDomain'
import {
  planCinema2AfterhoursShow,
  resolveCinema2AfterhoursCadenceIdentity,
  type Cinema2AfterhoursShowPlannerSettings,
  type Cinema2AfterhoursShowPlannerStructure,
} from '../modules/afterhours/Cinema2AfterhoursShowPlanner'

const SETTINGS: Cinema2AfterhoursShowPlannerSettings = Object.freeze({
  pattern: 'wideFan',
  autoPerformance: false,
  beamCount: 16,
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
    sample(namespace, index = 0) {
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
  it('keeps authored topology and hard bank authorizations authoritative when Auto Performance is off', () => {
    const plan = planCinema2AfterhoursShow(SETTINGS, STRUCTURE, random())
    expect(plan.topologyId).toBe('wideFan')
    expect(plan.sideLasers).toBe(false)
    expect(plan.topLasers).toBe(false)
    expect(plan.symmetry).toBe(true)
    expect(plan.beamCount).toBe(16)
    expect(plan.transitionIntent).toBe('smooth')
  })

  it('ignores transient performance intent when Auto Performance is off', () => {
    const baseline = planCinema2AfterhoursShow(SETTINGS, STRUCTURE, random(0.99))
    const stalePerformance = planCinema2AfterhoursShow(
      SETTINGS,
      { ...STRUCTURE, hardCutIntent: true, performance: { build: 1, impact: 1, vocalPresence: 1, kickAccent: 1, snareAccent: 1, downbeatAccent: 1, phraseAccent: 1, sectionAccent: 1, dropAccent: 1 } },
      random(0.99),
    )
    expect(stalePerformance).toEqual(baseline)
  })

  it('may choose another topology and recruit side/top banks without mutating authored settings', () => {
    const authored = { ...SETTINGS, autoPerformance: true, patternChange: 'off' as const }
    const plan = planCinema2AfterhoursShow(authored, STRUCTURE, random(0.99))
    expect(plan.topologyId).toBe('fullRig')
    expect(plan.topologyId).not.toBe(authored.pattern)
    expect(plan.sideLasers).toBe(true)
    expect(plan.topLasers).toBe(true)
    expect(authored.sideLasers).toBe(false)
    expect(authored.topLasers).toBe(false)
    expect(authored.pattern).toBe('wideFan')
  })

  it('never exceeds Beam Count and preserves authored Symmetry in either authority mode', () => {
    for (const autoPerformance of [false, true]) {
      for (const beamCount of [2, 7, 16]) {
        const plan = planCinema2AfterhoursShow(
          { ...SETTINGS, autoPerformance, beamCount, symmetry: false },
          STRUCTURE,
          hashedRandom(),
        )
        expect(plan.beamCount).toBeGreaterThanOrEqual(2)
        expect(plan.beamCount).toBeLessThanOrEqual(beamCount)
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
    expect(offB.variationKey).toBe(offA.variationKey)
    expect(offB.topologyId).toBe(offA.topologyId)

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
    expect(vocal.beamCount).toBeLessThan(baseline.beamCount)
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

  it('chooses deterministic sparse-versus-dense hero drop boundaries only inside Auto Performance authority', () => {
    const peak = { ...STRUCTURE, performance: { impact: 1, dropAccent: 1 } }
    const sparse = planCinema2AfterhoursShow({ ...SETTINGS, autoPerformance: true }, peak, random(0.1))
    const dense = planCinema2AfterhoursShow({ ...SETTINGS, autoPerformance: true }, peak, random(0.5))
    const manual = planCinema2AfterhoursShow(SETTINGS, peak, random(0.1))

    expect(sparse.topologyId).toBe('sparseArchitecture')
    expect(['fullRig', 'radialCrown', 'crossCanopy']).toContain(dense.topologyId)
    expect(manual.topologyId).toBe(SETTINGS.pattern)
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
