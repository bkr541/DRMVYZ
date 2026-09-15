import { describe, expect, it } from 'vitest'

import type { Cinema2AudioIntelligenceFrame } from '../audio/Cinema2AudioIntelligenceBridge'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import {
  Cinema2InterlockClockResolver,
  nextCinema2InterlockBeatBoundary,
  resolveCinema2InterlockBackgroundClockTime,
  resolveCinema2InterlockSegmentClockPhase,
} from '../modules/interlock/Cinema2InterlockClock'

function audio(beatPosition: number, bpm: number, generation = 0): Cinema2AudioIntelligenceFrame {
  const beatIndex = Math.floor(Math.max(0, beatPosition))
  const beatPhase = Math.max(0, beatPosition) - beatIndex
  return {
    upstream: {
      trackId: 'track-a',
      analysisRevision: 'analysis-1',
      timelineRevision: 'timeline-1',
    },
    discontinuity: { occurred: false, reason: null, generation },
    rhythm: {
      bpm: { available: true, value: bpm },
      beatIndex: { available: true, value: beatIndex },
      beatPhase: { available: true, value: beatPhase },
    },
  } as unknown as Cinema2AudioIntelligenceFrame
}

function frame({
  timeSec,
  deltaTimeSec,
  bpm,
  beatPosition,
  bpmSync = true,
  paused = false,
  audioFrame = beatPosition == null || bpm == null ? null : audio(beatPosition, bpm),
}: {
  timeSec: number
  deltaTimeSec: number
  bpm?: number | null
  beatPosition?: number | null
  bpmSync?: boolean
  paused?: boolean
  audioFrame?: Cinema2AudioIntelligenceFrame | null
}): Cinema2ModuleFrameReadContext {
  return {
    frameId: Math.round(timeSec * 1000) + 1,
    timestampMs: timeSec * 1000,
    deltaTimeSec,
    elapsedTimeSec: timeSec,
    viewport: { width: 1280, height: 720, dpr: 1 },
    contextGeneration: 1,
    transport: {
      sourcePresent: true,
      playing: !paused,
      analysisActive: true,
      paused,
      animationActive: !paused,
      trackId: 'track-a',
      timeSec,
      bpmSync,
      bpm: bpm ?? null,
    },
    audio: audioFrame,
    director: null,
  }
}

describe('Cinema 2.0 Interlock synchronized clock', () => {
  it.each([60, 120, 128, 150, 180])('completes the same four musical beats at %i BPM', (bpm: number) => {
    const resolver = new Cinema2InterlockClockResolver()
    resolver.resolve(frame({ timeSec: 0, deltaTimeSec: 0, bpm, beatPosition: 0 }))
    const secondsForFourBeats = 4 * 60 / bpm
    const resolved = resolver.resolve(frame({
      timeSec: secondsForFourBeats,
      deltaTimeSec: secondsForFourBeats,
      bpm,
      beatPosition: 4,
    }))

    expect(resolved.source).toBe('analyzed-beat-grid')
    expect(resolved.bpm).toBe(bpm)
    expect(resolved.motionBeatPosition).toBeCloseTo(4, 6)
    expect(resolved.fourBeatPhase).toBeCloseTo(0, 6)
  })

  it('uses deterministic seconds-based motion when Sync is off regardless of host BPM', () => {
    const a = new Cinema2InterlockClockResolver()
    const b = new Cinema2InterlockClockResolver()
    const firstA = a.resolve(frame({ timeSec: 3, deltaTimeSec: 0, bpm: 60, bpmSync: false, beatPosition: null, audioFrame: null }))
    const firstB = b.resolve(frame({ timeSec: 3, deltaTimeSec: 0, bpm: 180, bpmSync: false, beatPosition: null, audioFrame: null }))

    expect(firstA.source).toBe('free-running')
    expect(firstA.motionBeatPosition).toBeCloseTo(firstB.motionBeatPosition, 8)
    expect(resolveCinema2InterlockSegmentClockPhase(firstA, 0.5)).toBeCloseTo(
      resolveCinema2InterlockSegmentClockPhase(firstB, 0.5),
      8,
    )
  })

  it('falls back to transport BPM, then a bounded visual-only 120 BPM clock without fabricating events', () => {
    const transportResolver = new Cinema2InterlockClockResolver()
    const transport = transportResolver.resolve(frame({ timeSec: 2, deltaTimeSec: 0, bpm: 150, beatPosition: null, audioFrame: null }))
    expect(transport.source).toBe('transport-bpm')
    expect(transport.motionBeatPosition).toBeCloseTo(5, 6)

    const fallbackResolver = new Cinema2InterlockClockResolver()
    const fallback = fallbackResolver.resolve(frame({ timeSec: 2, deltaTimeSec: 0, bpm: null, beatPosition: null, audioFrame: null }))
    expect(fallback.source).toBe('visual-fallback-120')
    expect(fallback.bpm).toBe(120)
    expect(fallback.motionBeatPosition).toBeCloseTo(4, 6)
  })

  it('freezes while paused and preserves the visible phase while toggling Sync before re-anchoring', () => {
    const resolver = new Cinema2InterlockClockResolver()
    const free = resolver.resolve(frame({ timeSec: 1, deltaTimeSec: 0, bpm: 120, bpmSync: false, beatPosition: null, audioFrame: null }))
    const toggled = resolver.resolve(frame({ timeSec: 1, deltaTimeSec: 0, bpm: 120, bpmSync: true, beatPosition: 2 }))
    expect(toggled.motionBeatPosition).toBeCloseTo(free.motionBeatPosition, 8)
    expect(toggled.reanchorGeneration).toBeGreaterThan(0)

    const paused = resolver.resolve(frame({ timeSec: 5, deltaTimeSec: 4, bpm: 120, bpmSync: true, beatPosition: 10, paused: true }))
    expect(paused.motionBeatPosition).toBeCloseTo(toggled.motionBeatPosition, 8)
  })

  it('derives one shared set of musical divisions for segments and the liquid-light background', () => {
    const resolver = new Cinema2InterlockClockResolver()
    const resolved = resolver.resolve(frame({ timeSec: 2.25, deltaTimeSec: 0, bpm: 120, beatPosition: 4.5 }))
    expect(resolved.beatPhase).toBeCloseTo(0.5)
    expect(resolved.twoBeatPhase).toBeCloseTo(0.25)
    expect(resolved.fourBeatPhase).toBeCloseTo(0.125)
    expect(resolveCinema2InterlockSegmentClockPhase(resolved, 0.5)).toBeGreaterThanOrEqual(0)
    expect(resolveCinema2InterlockBackgroundClockTime(resolved, 0.5)).toBeGreaterThan(0)
    expect(nextCinema2InterlockBeatBoundary(resolved.motionBeatPosition)).toBe(5)
  })

  it('keeps independent native-module resolvers phase-identical across toggles, seeks, and BPM changes', () => {
    const bars = new Cinema2InterlockClockResolver()
    const background = new Cinema2InterlockClockResolver()
    const sequence = [
      frame({ timeSec: 0, deltaTimeSec: 0, bpm: 128, beatPosition: 0 }),
      frame({ timeSec: 0.46875, deltaTimeSec: 0.46875, bpm: 128, beatPosition: 1 }),
      frame({ timeSec: 0.46875, deltaTimeSec: 0, bpm: 128, beatPosition: 1, bpmSync: false }),
      frame({ timeSec: 0.96875, deltaTimeSec: 0.5, bpm: 128, beatPosition: 2, bpmSync: false }),
      frame({ timeSec: 0.96875, deltaTimeSec: 0, bpm: 150, beatPosition: 2.421875, bpmSync: true }),
      frame({ timeSec: 0.25, deltaTimeSec: 0, bpm: 150, beatPosition: 0.625, bpmSync: true }),
    ]

    for (const current of sequence) {
      const barClock = bars.resolve(current)
      const backgroundClock = background.resolve(current)
      expect(backgroundClock.motionBeatPosition).toBeCloseTo(barClock.motionBeatPosition, 10)
      expect(backgroundClock.reanchorGeneration).toBe(barClock.reanchorGeneration)
    }
  })

  it.each([0, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid BPM %s and stays finite', (invalidBpm: number) => {
    const resolver = new Cinema2InterlockClockResolver()
    const resolved = resolver.resolve(frame({
      timeSec: 12,
      deltaTimeSec: 0,
      bpm: invalidBpm,
      beatPosition: null,
      audioFrame: null,
    }))
    expect(resolved.source).toBe('visual-fallback-120')
    expect(Number.isFinite(resolved.motionBeatPosition)).toBe(true)
    expect(Number.isFinite(resolved.beatPhase)).toBe(true)
  })

})
