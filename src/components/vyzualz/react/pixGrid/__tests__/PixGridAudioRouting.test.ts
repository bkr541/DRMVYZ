import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../../features/musicIntelligence/types'
import { buildSharedPerformanceContext } from '../../../../../features/performanceCore'
import type { ReactTrackSection } from '../../ReactTypes'
import {
  createPixGridAudioFrame,
  createSilentPixGridAudioFrame,
  pixGridReactionSourceValue,
  PixGridReactionRuntime,
} from '../PixGridAudioRouting'
import { createDefaultPixGridReactionAssignment } from '../PixGridGroups'


const SECTIONS: ReactTrackSection[] = [{
  id: 'section-a', label: 'Section A', type: 'drop', startSec: 0, endSec: 64,
  intensity: 0.9, source: 'auto', confidence: 0.9,
}]

function intelligence(timeSec: number, overrides: Partial<MusicIntelligenceFrame> = {}): MusicIntelligenceFrame {
  const absoluteBeat = timeSec * 2
  const beatIndex = Math.floor(absoluteBeat)
  return {
    ...DEFAULT_MI_FRAME,
    ...overrides,
    timeSec,
    frameId: beatIndex + 1,
    trackId: 'track-a',
    bands: {
      ...DEFAULT_MI_FRAME.bands,
      sub: 0.1, bass: 0.2, lowMid: 0.3, mid: 0.4, high: 0.5, air: 0.6, volume: 0.7,
      normalizedBass: 0.72, normalizedMid: 0.48, normalizedHigh: 0.35,
      ...overrides.bands,
    },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      beatIndex,
      beatPhase: absoluteBeat - beatIndex,
      beatInBar: beatIndex % 4,
      barIndex: Math.floor(beatIndex / 4),
      ...overrides.rhythm,
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      instant: 0.71, percentile: 0.76, spectralFlux: 0.41, tension: 0.53, complexity: 0.62, buildProgress: 0.33,
      ...overrides.energy,
    },
    stems: { ...DEFAULT_MI_FRAME.stems, vocalEnergy: 0.44, ...overrides.stems },
    capabilities: {
      ...DEFAULT_MI_FRAME.capabilities!, liveBands: true, rhythmEvents: true, beatGrid: true, trackEnergyCurve: true,
      ...overrides.capabilities,
    },
    confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 0.9, rhythm: 0.9, section: 0.9, ...overrides.confidence },
    raw: { ...DEFAULT_MI_FRAME.raw, ...overrides.raw },
  }
}

function context(timeSec: number, previous: ReturnType<typeof buildSharedPerformanceContext> | null = null, overrides: Partial<MusicIntelligenceFrame> = {}) {
  return buildSharedPerformanceContext({ audioTimeSec: timeSec, frame: intelligence(timeSec, overrides), resolvedSections: SECTIONS, trackIdentity: 'track-a', previous })
}

describe('PixGrid advanced audio routing', () => {
  it('maps every continuous source from the shared Music Intelligence context', () => {
    const frame = createPixGridAudioFrame(context(4), { isPlaying: true, deltaTimeSec: 1 / 60 })
    expect(frame).toMatchObject({ sub: 0.1, bass: 0.72, lowMid: 0.3, mid: 0.48, high: 0.35, air: 0.6, volume: 0.7 })
    expect(pixGridReactionSourceValue(frame, 'trackRelativeEnergy')).toBeCloseTo(0.76)
    expect(pixGridReactionSourceValue(frame, 'spectralFlux')).toBeCloseTo(0.41)
    expect(pixGridReactionSourceValue(frame, 'vocalEnergy')).toBeCloseTo(0.44)
  })

  it('suppresses discrete triggers while paused without muting continuous values', () => {
    const frame = createPixGridAudioFrame(
      context(2, null, { rhythm: { ...DEFAULT_MI_FRAME.rhythm, bpm: 120, kickHit: true, snareHit: true, hatHit: true, transientConfidence: 0.9 } }),
      { isPlaying: false, deltaTimeSec: 0 },
    )
    expect([frame.beatHit, frame.kickHit, frame.snareHit, frame.hatHit, frame.transientHit]).toEqual([false, false, false, false, false])
    expect(frame.bass).toBeCloseTo(0.72)
  })

  it('keeps kick, snare, and hat triggers distinct', () => {
    const frame = createPixGridAudioFrame(context(2, null, { rhythm: { ...DEFAULT_MI_FRAME.rhythm, bpm: 120, kickHit: true, snareHit: false, hatHit: true, transientConfidence: 0.9 } }), { isPlaying: true, deltaTimeSec: 1 / 60 })
    expect([frame.kickHit, frame.snareHit, frame.hatHit]).toEqual([true, false, true])
    expect(pixGridReactionSourceValue(frame, 'kick')).toBe(1)
    expect(pixGridReactionSourceValue(frame, 'snare')).toBe(0)
    expect(pixGridReactionSourceValue(frame, 'hat')).toBe(1)
  })

  it('publishes four, eight, and sixteen-bar boundaries from the shared grid', () => {
    let previous = context(7.99)
    let current = context(8, previous)
    expect(createPixGridAudioFrame(current, { isPlaying: true, deltaTimeSec: 0.01 }).fourBarBoundary).toBe(true)
    previous = context(15.99, current)
    current = context(16, previous)
    expect(createPixGridAudioFrame(current, { isPlaying: true, deltaTimeSec: 0.01 }).eightBarBoundary).toBe(true)
    previous = context(31.99, current)
    current = context(32, previous)
    expect(createPixGridAudioFrame(current, { isPlaying: true, deltaTimeSec: 0.01 }).sixteenBarBoundary).toBe(true)
  })

  it('resolves attack/hold/release, freezes on pause, and resets on seek', () => {
    const assignment = {
      ...createDefaultPixGridReactionAssignment(),
      id: 'kick-envelope', source: 'kick' as const, attack: 0.1, hold: 0.1, release: 0.2, smoothing: 0,
    }
    const runtime = new PixGridReactionRuntime()
    const fired = createSilentPixGridAudioFrame({ audioTime: 1, kickHit: true, beatIndex: 2, isPlaying: true })
    expect(runtime.resolve(assignment, fired).value).toBe(0)
    const attack = runtime.resolve(assignment, { ...fired, audioTime: 1.05, kickHit: false }).value
    expect(attack).toBeGreaterThan(0)
    expect(attack).toBeLessThan(1)
    const held = runtime.resolve(assignment, { ...fired, audioTime: 1.15, kickHit: false }).value
    expect(held).toBeCloseTo(1)
    const paused = runtime.resolve(assignment, { ...fired, audioTime: 1.15, kickHit: false, isPlaying: false }).value
    expect(paused).toBeCloseTo(held)
    const sought = runtime.resolve(assignment, { ...fired, audioTime: 9, kickHit: false, timingDiscontinuity: true }).value
    expect(sought).toBe(0)
  })

  it('holds continuous modulation while paused and honors confidence/capability fallback', () => {
    const assignment = { ...createDefaultPixGridReactionAssignment(), id: 'vocal', source: 'vocalEnergy' as const, minimumConfidence: 0.8, capabilityFallback: 'energy' as const, smoothing: 0 }
    const runtime = new PixGridReactionRuntime()
    const fallback = runtime.resolve(assignment, createSilentPixGridAudioFrame({
      energy: 0.66, vocalEnergy: 0.95, isPlaying: true,
      capabilities: { vocalEnergy: false }, confidence: { vocalEnergy: 0.1 },
    }))
    expect(fallback.supported).toBe(true)
    expect(fallback.value).toBeCloseTo(0.66)

    const continuous = { ...assignment, id: 'bass', source: 'bass' as const, minimumConfidence: 0, capabilityFallback: 'disable' as const }
    const live = runtime.resolve(continuous, createSilentPixGridAudioFrame({ bass: 0.8, isPlaying: true, deltaTimeSec: 1 / 60 })).value
    const paused = runtime.resolve(continuous, createSilentPixGridAudioFrame({ bass: 0.1, isPlaying: false, deltaTimeSec: 0 })).value
    expect(paused).toBe(live)
  })
})
