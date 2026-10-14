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
} from '../modules/atlHoe/Cinema2AtlHoePatternController'

const SIGNALS: Cinema2AtlHoePatternSignals = Object.freeze({
  energy: 0.62, sub: 0.7, bass: 0.76, mid: 0.55, high: 0.48, flux: 0.42,
  kick: 0.82, snare: 0.58, transient: 0.66, downbeat: 0.7, phrase: 0.5, build: 0.64, drop: 0,
})

const frame = (pattern: Cinema2AtlHoePatternId, stage: Cinema2AtlHoePerformanceStage = 'active', signals = SIGNALS) =>
  evaluateCinema2AtlHoePattern({ pattern, beats: 13.375, stage, signals })

describe('ATL HOE full-scene pattern engine', () => {
  it('defines exactly six deterministic programs with distinct spatial selections', () => {
    expect(CINEMA2_ATL_HOE_PATTERN_IDS).toEqual([
      'city-pulse', 'waffle-marquee', 'interstate-flow', 'skyline-rise', 'neon-brownout', 'storm-takeover',
    ])
    const outputs = CINEMA2_ATL_HOE_PATTERN_IDS.map(pattern => frame(pattern))
    const signatures = outputs.map(output => JSON.stringify({
      roles: output.roleGains, zones: output.zoneWeights, routes: output.routeWidths,
      building: output.buildingLevel, sign: output.signCellSelection, outages: output.outageMasks,
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
    controller.update('city-pulse', 0)
    const start = controller.update('storm-takeover', 0)
    expect(start).toMatchObject({ pattern: 'storm-takeover', changed: true, transition: { outgoingPattern: 'city-pulse', progress: 0 } })
    const midpoint = controller.update('storm-takeover', CINEMA2_ATL_HOE_PATTERN_CROSSFADE_SECONDS / 2)
    const output = evaluateCinema2AtlHoePattern({ pattern: midpoint.pattern, beats: 8, stage: 'active', signals: SIGNALS, transition: midpoint.transition })
    expect(output.transition).toMatchObject({ outgoingWeight: 0.5, incomingWeight: 0.5 })
    expect(Math.max(...output.roleGains)).toBeLessThanOrEqual(1)
    expect(output.roleGains.filter(gain => gain > 0.08).length).toBeGreaterThanOrEqual(4)
    expect(controller.update('storm-takeover', CINEMA2_ATL_HOE_PATTERN_CROSSFADE_SECONDS / 2).transition).toBeNull()
  })
})
