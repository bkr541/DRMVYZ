import { describe, expect, it } from 'vitest'

import {
  CINEMA2_ATL_HOE_PATTERN_IDS,
  evaluateCinema2AtlHoePattern,
  type Cinema2AtlHoePatternId,
  type Cinema2AtlHoePatternSignals,
  type Cinema2AtlHoePerformanceStage,
} from '../modules/atlHoe/Cinema2AtlHoePatternEngine'
import {
  CINEMA2_ATL_HOE_PATTERN_CROSSFADE_SECONDS,
  Cinema2AtlHoePatternController,
  CINEMA2_ATL_HOE_TRIGGER_IDS,
  createCinema2AtlHoePatternCycle,
  resolveCinema2AtlHoeAutoPattern,
} from '../modules/atlHoe/Cinema2AtlHoePatternController'

const SIGNALS: Cinema2AtlHoePatternSignals = Object.freeze({
  energy: 0.62, sub: 0.7, bass: 0.76, mid: 0.55, high: 0.48, flux: 0.42,
  vocal: 0.35, significance: 0.4, momentum: 0.44, impact: 0.2, variation: 0.3,
  kick: 0.82, snare: 0.58, transient: 0.66, beat: 0.52, downbeat: 0.7, bar: 0.5, phrase: 0.5, section: 0.4, sectionPolicy: 0.78,
  sectionProgress: 0.55, sectionIntensity: 0.62, sectionConfidence: 0.88,
  buildProgress: 0.64, buildConfidence: 0.9, buildIntensity: 0.72, build: 0.64, drop: 0,
})
const ZERO_SIGNALS: Cinema2AtlHoePatternSignals = Object.freeze(Object.fromEntries(Object.keys(SIGNALS).map(key => [key, 0])) as unknown as Cinema2AtlHoePatternSignals)

const frame = (pattern: Cinema2AtlHoePatternId, stage: Cinema2AtlHoePerformanceStage = 'active', signals = SIGNALS) =>
  evaluateCinema2AtlHoePattern({ pattern, beats: 13.375, stage, signals })

describe('ATL HOE full-scene pattern engine', () => {
  it('assigns independent frequency and vocal responsibilities instead of applying global brightness', () => {
    const base = evaluateCinema2AtlHoePattern({ pattern: 'city-pulse', beats: 8, stage: 'active', signals: ZERO_SIGNALS })
    const withSignal = (key: keyof Cinema2AtlHoePatternSignals) => evaluateCinema2AtlHoePattern({
      pattern: 'city-pulse', beats: 8, stage: 'active', signals: { ...ZERO_SIGNALS, [key]: 1 },
    })
    expect(withSignal('sub').city.roadGain).toBeGreaterThan(base.city.roadGain + 0.3)
    expect(withSignal('sub').roleGains[0]).toBeCloseTo(base.roleGains[0])
    expect(withSignal('bass').roleGains[0]).toBeGreaterThan(base.roleGains[0] + 0.25)
    expect(withSignal('mid').city.heroGains[1]).toBeGreaterThan(base.city.heroGains[1] + 0.35)
    expect(withSignal('high').sky.starBrightness).toBeGreaterThan(base.sky.starBrightness + 0.25)
    expect(withSignal('flux').city.foliageGain).toBeGreaterThan(base.city.foliageGain + 0.45)
    expect(withSignal('vocal').roleGains[0]).toBeGreaterThan(base.roleGains[0] + 0.12)
  })

  it('keeps rhythm and structural envelopes on separate component families', () => {
    const base = evaluateCinema2AtlHoePattern({ pattern: 'city-pulse', beats: 8, stage: 'active', signals: ZERO_SIGNALS })
    const withSignal = (key: keyof Cinema2AtlHoePatternSignals) => evaluateCinema2AtlHoePattern({
      pattern: 'city-pulse', beats: 8, stage: 'active', signals: { ...ZERO_SIGNALS, [key]: 1 },
    })
    expect(withSignal('kick').city.streetlightGain).toBeGreaterThan(base.city.streetlightGain + 0.35)
    expect(withSignal('snare').city.foliageGain).toBeGreaterThan(base.city.foliageGain + 0.45)
    expect(withSignal('bar').city.roadGain).toBeGreaterThan(base.city.roadGain + 0.1)
    expect(withSignal('downbeat').roleGains[2]).toBeGreaterThan(base.roleGains[2] + 0.3)
    expect(withSignal('phrase').sky.starBrightness).toBeGreaterThan(base.sky.starBrightness + 0.12)
    expect(withSignal('impact').city.roadGain).toBeCloseTo(base.city.roadGain)
  })

  it('applies distinct breakdown, unknown, verse, buildup and drop activity policies', () => {
    const signature = (stage: Cinema2AtlHoePerformanceStage, sectionPolicy: number, build = 0, drop = 0) => {
      const output = evaluateCinema2AtlHoePattern({ pattern: 'city-pulse', beats: 8, stage,
        signals: { ...ZERO_SIGNALS, energy: 0.5, sectionIntensity: 0.6, sectionPolicy, build, drop } })
      return output.roleGains.reduce((sum, gain) => sum + gain, 0) + output.atmosphereGain
    }
    const breakdown = signature('rest', 0.2)
    const unknown = signature('active', 0.45)
    const verse = signature('active', 0.78)
    const buildup = signature('buildup', 0.9, 0.8)
    const drop = signature('drop', 1, 0, 1)
    expect(new Set([breakdown, unknown, verse, buildup, drop])).toHaveLength(5)
    expect(unknown).toBeGreaterThan(breakdown)
    expect(verse).toBeGreaterThan(unknown)
    expect(drop).toBeGreaterThan(buildup)
  })

  it('defines exactly six deterministic programs with distinct spatial selections', () => {
    expect(CINEMA2_ATL_HOE_PATTERN_IDS).toEqual([
      'city-pulse', 'waffle-marquee', 'interstate-flow', 'skyline-rise', 'neon-brownout', 'storm-takeover',
    ])
    const outputs = CINEMA2_ATL_HOE_PATTERN_IDS.map(pattern => frame(pattern))
    const signatures = outputs.map(output => JSON.stringify({
      roles: output.roleGains, zones: output.zoneWeights, routes: output.routeWidths,
      building: output.buildingLevel, sign: output.signCellSelection, outages: output.outageMasks, sky: output.sky,
    }))
    expect(new Set(signatures)).toHaveLength(6)
    expect(frame('neon-brownout')).toEqual(frame('neon-brownout'))
  })

  it('gives every program at least four active component families while preserving dark regions', () => {
    for (const pattern of CINEMA2_ATL_HOE_PATTERN_IDS) {
      const output = frame(pattern)
      expect(output.roleGains.filter(gain => gain >= 0.15).length, pattern).toBeGreaterThanOrEqual(4)
      expect(Math.min(...output.zoneWeights), `${pattern} negative space`).toBeLessThanOrEqual(0.2)
      expect(Math.max(...output.zoneWeights), `${pattern} focal zone`).toBeGreaterThanOrEqual(0.78)
    }
  })

  it('authors distinct rest, active, buildup, drop and recovery states for every program', () => {
    const stageSignals: Record<Cinema2AtlHoePerformanceStage, Cinema2AtlHoePatternSignals> = {
      rest: { ...SIGNALS, energy: 0, kick: 0, snare: 0, transient: 0, downbeat: 0, phrase: 0, build: 0, drop: 0 },
      active: SIGNALS,
      buildup: { ...SIGNALS, build: 0.9 },
      drop: { ...SIGNALS, drop: 1 },
      recovery: { ...SIGNALS, drop: 0.4 },
    }
    for (const pattern of CINEMA2_ATL_HOE_PATTERN_IDS) {
      const signatures = (Object.keys(stageSignals) as Cinema2AtlHoePerformanceStage[]).map(stage => {
        const output = frame(pattern, stage, stageSignals[stage])
        return JSON.stringify({ roles: output.roleGains, building: output.buildingLevel, sky: output.skyGain,
          lightning: output.lightningGain, atmosphere: output.atmosphereGain, practical: output.practicalLightGain,
          recovery: output.recoveryMasks })
      })
      expect(new Set(signatures).size, pattern).toBe(5)
    }
  })

  it('crossfades manual changes for 450 ms without a black frame or white-flash overshoot', () => {
    const controller = new Cinema2AtlHoePatternController('city-pulse')
    const input = (authoredPattern: Cinema2AtlHoePatternId, deltaTimeSec: number) => ({
      authoredPattern, autoPerformance: false, patternChange: false, triggerEventId: null,
      autoBoundaryId: null, autoPattern: authoredPattern, deltaTimeSec,
    })
    controller.update(input('city-pulse', 0))
    const start = controller.update(input('storm-takeover', 0))
    expect(start).toMatchObject({ pattern: 'storm-takeover', changed: true, transition: { outgoingPattern: 'city-pulse', progress: 0 } })
    const midpoint = controller.update(input('storm-takeover', CINEMA2_ATL_HOE_PATTERN_CROSSFADE_SECONDS / 2))
    const output = evaluateCinema2AtlHoePattern({ pattern: midpoint.pattern, beats: 8, stage: 'active', signals: SIGNALS, transition: midpoint.transition })
    expect(output.transition).toMatchObject({ outgoingWeight: 0.5, incomingWeight: 0.5 })
    expect(Math.max(...output.roleGains)).toBeLessThanOrEqual(1)
    expect(output.roleGains.filter(gain => gain > 0.08).length).toBeGreaterThanOrEqual(4)
    expect(controller.update(input('storm-takeover', CINEMA2_ATL_HOE_PATTERN_CROSSFADE_SECONDS / 2)).transition).toBeNull()
  })

  it('cycles without immediate repeats for every supported trigger and de-duplicates stable event ids', () => {
    expect(CINEMA2_ATL_HOE_TRIGGER_IDS).toEqual(['beat', 'kick', 'snare', 'downbeat', 'beat2', 'bar', 'bar4', 'bar8', 'phrase', 'section', 'drop'])
    const controller = new Cinema2AtlHoePatternController('city-pulse', createCinema2AtlHoePatternCycle(index => index / 7))
    let previous = controller.activePattern
    for (const [index, trigger] of CINEMA2_ATL_HOE_TRIGGER_IDS.entries()) {
      const event = `${trigger}:${index}`
      const selection = controller.update({ authoredPattern: 'city-pulse', autoPerformance: false, patternChange: true,
        triggerEventId: event, autoBoundaryId: null, autoPattern: 'city-pulse', deltaTimeSec: 0 })
      expect(selection.pattern, trigger).not.toBe(previous)
      expect(controller.update({ authoredPattern: 'city-pulse', autoPerformance: false, patternChange: true,
        triggerEventId: event, autoBoundaryId: null, autoPattern: 'city-pulse', deltaTimeSec: 0 }).changed, trigger).toBe(false)
      previous = selection.pattern
    }
  })

  it('applies the auto policy once per boundary, prioritizes drops, and resets event ownership', () => {
    expect(resolveCinema2AtlHoeAutoPattern({ stage: 'drop', energy: 1, vocalPresence: 0, current: 'city-pulse', boundaryOrdinal: 2 })).toBe('storm-takeover')
    expect(['skyline-rise', 'interstate-flow']).toContain(resolveCinema2AtlHoeAutoPattern({ stage: 'buildup', energy: 0.6, vocalPresence: 0, current: 'city-pulse', boundaryOrdinal: 1 }))
    expect(['city-pulse', 'neon-brownout']).toContain(resolveCinema2AtlHoeAutoPattern({ stage: 'rest', energy: 0.05, vocalPresence: 0, current: 'waffle-marquee', boundaryOrdinal: 0 }))
    const controller = new Cinema2AtlHoePatternController('city-pulse')
    const auto = (boundary: string | null) => controller.update({ authoredPattern: 'city-pulse', autoPerformance: true, patternChange: false,
      triggerEventId: null, autoBoundaryId: boundary, autoPattern: 'storm-takeover', deltaTimeSec: 0 })
    expect(auto('drop:1')).toMatchObject({ pattern: 'storm-takeover', changed: true })
    expect(auto('drop:1').changed).toBe(false)
    controller.reset('city-pulse')
    expect(auto('drop:1').changed).toBe(true)
  })

  it('gives every program an integrated, distinct sky state and reveals storm bolts top-to-bottom', () => {
    const skies = CINEMA2_ATL_HOE_PATTERN_IDS.map(pattern => frame(pattern).sky)
    expect(new Set(skies.map(sky => JSON.stringify(sky)))).toHaveLength(6)
    const storm = frame('storm-takeover', 'drop', { ...SIGNALS, transient: 1, drop: 1 }).sky
    expect(storm.stormDarkness).toBeGreaterThan(0.8)
    expect(storm.lightningFlash).toBe(1)
    expect(storm.cityPowerResponse).toBeGreaterThan(0.9)
    expect(storm.boltIdentities.filter(identity => identity >= 0)).toHaveLength(4)
    expect(storm.boltProgress[0]).toBeGreaterThanOrEqual(storm.boltProgress[1])
  })
})
