import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../features/musicIntelligence/types'
import {
  CinemaWorkspaceRuntimeFrameSource,
  type CinemaWorkspaceRuntimeFrameConfig,
} from '../../react/CinemaWorkspaceRuntimeFrameSource'

const VIEWPORT = { width: 1920, height: 1080, dpr: 1.5 }

function musicFrame(timeSec: number, trackId = 'track-a'): MusicIntelligenceFrame {
  const beatPosition = timeSec * 2
  return {
    ...DEFAULT_MI_FRAME,
    frameId: Math.round(timeSec * 1000) + 1,
    sourceId: trackId,
    trackId,
    timeSec,
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      beatIndex: Math.floor(beatPosition),
      beatPhase: beatPosition % 1,
    },
  }
}

function baseConfig(getAudioTime: () => number): CinemaWorkspaceRuntimeFrameConfig {
  return {
    analyser: null,
    getAudioTime,
    durationSec: 120,
    trackId: 'track-a',
    playing: true,
    paused: false,
    bpm: 120,
    getMusicIntelligence: () => musicFrame(getAudioTime()),
  }
}

describe('Cinema production RAF frame source', () => {
  it.each([30, 60, 120])('builds 120 fresh frames at %s Hz from stable React configuration', hz => {
    let audioTime = 0
    const getAudioTime = vi.fn(() => audioTime)
    const config = baseConfig(getAudioTime)
    const source = new CinemaWorkspaceRuntimeFrameSource(() => config)
    const frames = Array.from({ length: 120 }, (_, index) => {
      audioTime = index / hz
      return source.sample({
        nowMs: index * 1000 / hz,
        deltaTimeSec: index === 0 ? 0 : 1 / hz,
        timingDiscontinuity: index === 0,
        viewport: VIEWPORT,
      })
    })

    expect(getAudioTime).toHaveBeenCalledTimes(240)
    expect(frames.every(Boolean)).toBe(true)
    expect(frames[0]?.timing.frameIndex).toBe(0)
    expect(frames[119]?.timing.frameIndex).toBe(119)
    expect(frames[119]?.transport.audioTimeSec).toBeCloseTo(119 / hz)
    expect(frames[119]?.timing.deltaTimeSec).toBeCloseTo(1 / hz)
    expect(frames[119]?.viewport).toEqual(VIEWPORT)
    expect(new Set(frames.map(frame => frame?.transport.audioTimeSec)).size).toBe(120)
    source.dispose()
  })

  it('freezes pause, reconstructs resume/seek/loop/track changes, and clamps hidden-tab recovery', () => {
    let audioTime = 1
    let config = baseConfig(() => audioTime)
    const source = new CinemaWorkspaceRuntimeFrameSource(() => config)
    const sample = (overrides: Partial<{ deltaTimeSec: number; timingDiscontinuity: boolean }> = {}) => source.sample({
      nowMs: audioTime * 1000,
      deltaTimeSec: overrides.deltaTimeSec ?? 1 / 60,
      timingDiscontinuity: overrides.timingDiscontinuity ?? false,
      viewport: VIEWPORT,
    })!

    sample({ timingDiscontinuity: true, deltaTimeSec: 0 })
    config = { ...config, playing: false, paused: true }
    const paused = sample()
    expect(paused.timing.deltaTimeSec).toBe(0)
    config = { ...config, playing: true, paused: false }
    audioTime = 1.1
    expect(sample().transport.discontinuityReasons).toContain('resume')

    audioTime = 20
    expect(sample().transport.discontinuityReasons).toContain('seek')
    audioTime = 110
    expect(sample().transport.discontinuityReasons).toContain('seek')
    audioTime = 0.1
    expect(sample().transport.discontinuityReasons).toContain('loop-wrap')

    config = { ...config, trackId: 'track-b', getMusicIntelligence: () => musicFrame(audioTime, 'track-b') }
    expect(sample().transport.discontinuityReasons).toContain('track-change')
    const restored = sample({ timingDiscontinuity: true, deltaTimeSec: 0 })
    expect(restored.timing.deltaTimeSec).toBe(0)
    expect(restored.transport.discontinuityReasons).toContain('timing-discontinuity')

    source.dispose()
    expect(source.sample({ nowMs: 0, deltaTimeSec: 0, timingDiscontinuity: true, viewport: VIEWPORT })).toBeNull()
  })

  it('degrades safely without analyser, beat grid, or Music Intelligence', () => {
    const config = { ...baseConfig(() => 0), bpm: null, getMusicIntelligence: () => DEFAULT_MI_FRAME }
    const source = new CinemaWorkspaceRuntimeFrameSource(() => config)
    const frame = source.sample({ nowMs: 0, deltaTimeSec: 0, timingDiscontinuity: true, viewport: VIEWPORT })!
    expect(frame.capabilities).toMatchObject({ analyser: false, beatGrid: false, musicIntelligence: false })
    expect(frame.audio.available).toBe(false)
    source.dispose()
  })
})
