import { describe, expect, it } from 'vitest'
import { AFTERHOURS_DEFAULTS } from '../../../CinematicWorldSettings'
import type { CinematicFrameContext } from '../../CinematicWorldRenderer'
import {
  AfterhoursAudioIntelligenceDirector,
  type AfterhoursAudioIntelligenceSettings,
} from './AfterhoursAudioIntelligenceDirector'

interface FrameOptions {
  barIndex?: number
  beatIndex?: number
  transportTimeSec?: number
  sectionType?: string
  sectionId?: string
  energy?: number
  build?: number
  drop?: number
  vocal?: number
  highs?: number
  kick?: boolean
  snare?: boolean
  downbeat?: boolean
  beat?: boolean
  sectionStart?: boolean
  dropStart?: boolean
  bar4Hit?: boolean
  bar8Hit?: boolean
  phraseHit?: boolean
  timingDiscontinuity?: boolean
  playing?: boolean
  intelligence?: boolean
  canonical?: boolean
}

const SETTINGS: AfterhoursAudioIntelligenceSettings = {
  pattern: AFTERHOURS_DEFAULTS.pattern,
  patternChange: AFTERHOURS_DEFAULTS.patternChange,
  trigger: AFTERHOURS_DEFAULTS.trigger,
  bpmSync: AFTERHOURS_DEFAULTS.bpmSync,
  masterIntensity: AFTERHOURS_DEFAULTS.masterIntensity,
  pulseAmount: AFTERHOURS_DEFAULTS.pulseAmount,
  pulseDecay: AFTERHOURS_DEFAULTS.pulseDecay,
  motionAmount: AFTERHOURS_DEFAULTS.motionAmount,
  blackoutAmount: AFTERHOURS_DEFAULTS.blackoutAmount,
  beamCount: AFTERHOURS_DEFAULTS.beamCount,
  spread: AFTERHOURS_DEFAULTS.spread,
  sideLasers: AFTERHOURS_DEFAULTS.sideLasers,
  topLasers: AFTERHOURS_DEFAULTS.topLasers,
}

function frame(input: FrameOptions = {}): CinematicFrameContext {
  const bar = input.barIndex ?? 0
  const beatIndex = input.beatIndex ?? bar * 4
  const sectionType = input.sectionType ?? 'verse'
  const sectionId = input.sectionId ?? `${sectionType}-1`
  const intelligence = input.intelligence ?? true
  const playing = input.playing ?? true
  const transport = input.transportTimeSec ?? beatIndex * 60 / 150
  const event = (active: boolean, id: string) => ({ active, eventId: active ? id : null })
  const clock = (spanBeats: number, index: number, hit = false, id = '') => ({
    available: true,
    spanBeats,
    index,
    phase: 0.25,
    hit,
    eventId: hit ? id : null,
  })
  const values = {
    overallEnergy: input.energy ?? 0.55,
    buildProgress: input.build ?? 0,
    dropState: input.drop ?? (sectionType === 'drop' ? 1 : 0),
    vocalEnergy: input.vocal ?? 0,
    highs: input.highs ?? 0.35,
    high: input.highs ?? 0.35,
    kickStrength: input.kick ? 1 : 0.35,
    snareStrength: input.snare ? 1 : 0.3,
  }
  const base: Record<string, unknown> = {
    elapsedTimeSec: transport,
    deltaTimeSec: 1 / 60,
    timingDiscontinuity: input.timingDiscontinuity ?? false,
    transportTimeSec: transport,
    isPlaying: playing,
    frameIndex: beatIndex,
    resolution: { width: 1280, height: 720 },
    devicePixelRatio: 1,
    audio: {
      raw: { bass: 0.6, mid: 0.5, high: input.highs ?? 0.35, volume: input.energy ?? 0.55 },
      smoothed: { bass: 0.6, mid: 0.5, high: input.highs ?? 0.35, volume: input.energy ?? 0.55 },
      spectrum: null,
      waveform: null,
    },
    beat: {
      hit: input.beat ?? false,
      phase: 0.25,
      bpm: 150,
      kick: input.kick ? 1 : 0.35,
      snare: input.snare ? 1 : 0.3,
      transient: input.kick || input.snare ? 1 : 0.2,
      beatIndex,
      beatInBar: beatIndex % 4,
      barIndex: bar,
      barProgress: 0.25,
      downbeat: input.downbeat ?? false,
    },
    section: { type: sectionType, startSec: 0, endSec: 64, progress: 0.4, changed: input.sectionStart ?? false, analysis: null },
    musicalAudio: intelligence ? {
      isPlaying: playing,
      values,
      events: {
        beat: input.beat ?? false,
        kick: input.kick ?? false,
        snare: input.snare ?? false,
        downbeat: input.downbeat ?? false,
        barStart: input.downbeat ?? false,
        sectionChange: input.sectionStart ?? false,
        dropEntry: input.dropStart ?? false,
      },
      timing: { bpm: 150, beatIndex, beatInBar: beatIndex % 4, barIndex: bar, barPosition: 0.25, beatPhase: 0.25, phraseProgress: (bar % 8) / 8 },
      section: { type: sectionType, startSec: 0, endSec: 64, progress: 0.4 },
      capabilities: {
        musicIntelligence: true,
        broadBands: true,
        detailedBands: true,
        transientEvents: true,
        kickEvents: true,
        snareEvents: true,
        beatTiming: true,
        downbeatTiming: true,
        barTiming: true,
        phraseTiming: true,
        sectionTiming: true,
        buildProgress: true,
        dropState: true,
        trackEnergyCurve: true,
        vocalEnergy: true,
      },
    } : undefined,
  }
  if (input.canonical !== false) {
    base.canonicalMusic = {
      impulses: {
        beat: event(input.beat ?? false, `beat:${beatIndex}`),
        downbeat: event(input.downbeat ?? false, `downbeat:${bar}`),
        kick: event(input.kick ?? false, `kick:${beatIndex}`),
        snare: event(input.snare ?? false, `snare:${beatIndex}`),
        transient: event(Boolean(input.kick || input.snare), `transient:${beatIndex}`),
        sectionStart: event(input.sectionStart ?? false, `section:${sectionId}`),
        dropStart: event(input.dropStart ?? false, `drop:${sectionId}`),
      },
      clocks: {
        beat: clock(1, beatIndex, input.beat ?? false, `beat:${beatIndex}`),
        beat2: clock(2, Math.floor(beatIndex / 2)),
        beat4: clock(4, Math.floor(beatIndex / 4)),
        bar: clock(4, bar, input.downbeat ?? false, `bar:${bar}`),
        bar4: clock(16, Math.floor(bar / 4), input.bar4Hit ?? false, `bar4:${Math.floor(bar / 4)}`),
        bar8: clock(32, Math.floor(bar / 8), input.bar8Hit ?? false, `bar8:${Math.floor(bar / 8)}`),
        phrase: clock(32, Math.floor(bar / 8), input.phraseHit ?? false, `phrase:${Math.floor(bar / 8)}`),
      },
      section: { id: sectionId, type: sectionType, progress: 0.4 },
    }
  }
  return base as unknown as CinematicFrameContext
}

function resolve(options: FrameOptions, settings: Partial<AfterhoursAudioIntelligenceSettings> = {}) {
  const director = new AfterhoursAudioIntelligenceDirector()
  return director.update({ frame: frame(options), settings: { ...SETTINGS, ...settings } })
}

describe('Afterhours Stage 6 hierarchical Audio Intelligence choreography', () => {
  it('uses scene, structure, event, and continuous scales for different properties', () => {
    const quiet = resolve({ sectionType: 'verse', energy: 0.14, barIndex: 0 }, { beamCount: 16, sideLasers: true, topLasers: true })
    const build = resolve({ sectionType: 'build', energy: 0.58, build: 0.92, barIndex: 4 }, { beamCount: 16, sideLasers: true, topLasers: true })
    const drop = resolve({ sectionType: 'drop', energy: 0.96, drop: 1, barIndex: 8 }, { beamCount: 16, sideLasers: true, topLasers: true })

    expect(quiet.sceneScale).toBe('quiet')
    expect(build.sceneScale).toBe('build')
    expect(drop.sceneScale).toBe('drop')
    expect(quiet.beamCount).toBeLessThan(drop.beamCount)
    expect(build.spread).toBeLessThan(drop.spread)
    expect(quiet.motionAuthority).toBeLessThan(drop.motionAuthority)
    expect([quiet.densityTier, build.densityTier, drop.densityTier]).toEqual(expect.arrayContaining(['sparse', 'dense']))
  })

  it('changes 4-bar structure without requiring a scene-family change', () => {
    const settings = { pattern: 'wideFan' as const, patternChange: 'off' as const, beamCount: 16, sideLasers: true, topLasers: true }
    const first = resolve({ barIndex: 0, energy: 0.58 }, settings)
    const next = resolve({ barIndex: 4, energy: 0.58 }, settings)

    expect(first.pattern).toBe('wideFan')
    expect(next.pattern).toBe('wideFan')
    expect(first.structuralOrdinal).toBe(0)
    expect(next.structuralOrdinal).toBe(1)
    expect(next.variation).not.toBe(first.variation)
    expect(next.spread).not.toBeCloseTo(first.spread, 6)
  })

  it('keeps Drop cadence on the manual scene until a drop, then resolves a different authored drop topology', () => {
    const settings = { pattern: 'wideFan' as const, patternChange: 'drop' as const }
    const verse = resolve({ sectionType: 'verse', sectionId: 'verse-drop-cadence', barIndex: 4 }, settings)
    const build = resolve({ sectionType: 'build', sectionId: 'build-drop-cadence', build: 0.9, barIndex: 8 }, settings)
    const drop = resolve({ sectionType: 'drop', sectionId: 'drop-drop-cadence', drop: 1, dropStart: true, barIndex: 12 }, settings)

    expect(verse.pattern).toBe('wideFan')
    expect(build.pattern).toBe('wideFan')
    expect(drop.pattern).not.toBe('wideFan')
    expect(['fullRig', 'radialCrown', 'crossCanopy', 'diamondStar']).toContain(drop.pattern)
  })

  it('lets 8-bar / phrase cadence and drop state materially alter topology deterministically', () => {
    const eightA = resolve({ barIndex: 0, sectionId: 'verse-a' }, { patternChange: 'bar8' })
    const eightB = resolve({ barIndex: 8, sectionId: 'verse-a', bar8Hit: true }, { patternChange: 'bar8' })
    expect([eightB.pattern, eightB.variation]).not.toEqual([eightA.pattern, eightA.variation])

    const phraseA = resolve({ barIndex: 0, sectionId: 'verse-b' }, { patternChange: 'phrase' })
    const phraseB = resolve({ barIndex: 8, sectionId: 'verse-b', phraseHit: true }, { patternChange: 'phrase' })
    expect([phraseB.pattern, phraseB.variation]).not.toEqual([phraseA.pattern, phraseA.variation])

    const verse = resolve({ sectionType: 'verse', sectionId: 'section-1', barIndex: 8 }, { patternChange: 'bar8' })
    const drop = resolve({ sectionType: 'drop', sectionId: 'drop-1', drop: 1, dropStart: true, barIndex: 8 }, { patternChange: 'bar8' })
    expect(drop.sceneScale).toBe('drop')
    expect([drop.pattern, drop.variation]).not.toEqual([verse.pattern, verse.variation])
  })

  it('makes kick and snare/high responses visibly distinguishable without changing random endpoints', () => {
    const settings = { sideLasers: true, topLasers: true, pulseAmount: 0, trigger: 'beat' as const }
    const kick = resolve({ kick: true, highs: 0.25, energy: 0.7 }, settings)
    const snare = resolve({ snare: true, highs: 0.9, energy: 0.7 }, settings)

    expect(kick.pattern).toBe(snare.pattern)
    expect(kick.variation).toBe(snare.variation)
    expect(kick.bankWeights.bottom).toBeGreaterThan(snare.bankWeights.bottom)
    expect(snare.bankWeights.top).toBeGreaterThan(kick.bankWeights.top)
    expect(kick.spread).toBeGreaterThan(snare.spread)
  })

  it('bounds energy/build/vocal density, aperture, and motion under user authority', () => {
    const settings = { beamCount: 12, spread: 0.8, motionAmount: 0.7, sideLasers: true, topLasers: true }
    const low = resolve({ energy: 0.16 }, settings)
    const high = resolve({ energy: 0.96 }, settings)
    const build = resolve({ energy: 0.7, build: 1, sectionType: 'build' }, settings)
    const vocal = resolve({ energy: 0.5, vocal: 0.9 }, settings)

    expect(low.beamCount).toBeLessThanOrEqual(high.beamCount)
    expect(high.beamCount).toBeLessThanOrEqual(12)
    expect(low.motionAuthority).toBeLessThan(high.motionAuthority)
    expect(high.motionAuthority).toBeLessThanOrEqual(0.7)
    expect(build.spread).toBeLessThan(resolve({ energy: 0.7, build: 0 }, settings).spread)
    expect(vocal.sceneScale).toBe('vocal')
    expect(vocal.beamCount).toBeLessThanOrEqual(resolve({ energy: 0.5, vocal: 0 }, settings).beamCount)
  })

  it('reconstructs the same logical show state on direct seek, backward seek, and a four-bar loop', () => {
    const settings = { patternChange: 'bar8' as const, beamCount: 14, sideLasers: true, topLasers: true }
    const director = new AfterhoursAudioIntelligenceDirector()
    director.update({ frame: frame({ barIndex: 0, sectionId: 'verse-seek' }), settings: { ...SETTINGS, ...settings } })
    director.update({ frame: frame({ barIndex: 4, sectionId: 'verse-seek', bar4Hit: true }), settings: { ...SETTINGS, ...settings } })
    director.update({ frame: frame({ barIndex: 8, sectionId: 'verse-seek', bar8Hit: true }), settings: { ...SETTINGS, ...settings } })
    const seeked = director.update({ frame: frame({ barIndex: 12, sectionId: 'verse-seek', timingDiscontinuity: true }), settings: { ...SETTINGS, ...settings } })
    const direct = resolve({ barIndex: 12, sectionId: 'verse-seek', timingDiscontinuity: true }, settings)

    expect({
      pattern: seeked.pattern,
      variation: seeked.variation,
      beamCount: seeked.beamCount,
      spread: seeked.spread,
      sideLasers: seeked.sideLasers,
      topLasers: seeked.topLasers,
      motionAuthority: seeked.motionAuthority,
      structuralOrdinal: seeked.structuralOrdinal,
      majorOrdinal: seeked.majorOrdinal,
    }).toEqual({
      pattern: direct.pattern,
      variation: direct.variation,
      beamCount: direct.beamCount,
      spread: direct.spread,
      sideLasers: direct.sideLasers,
      topLasers: direct.topLasers,
      motionAuthority: direct.motionAuthority,
      structuralOrdinal: direct.structuralOrdinal,
      majorOrdinal: direct.majorOrdinal,
    })
    expect(seeked.transition).toBe(1)

    const backward = director.update({ frame: frame({ barIndex: 4, sectionId: 'verse-seek', timingDiscontinuity: true }), settings: { ...SETTINGS, ...settings } })
    const directBackward = resolve({ barIndex: 4, sectionId: 'verse-seek', timingDiscontinuity: true }, settings)
    expect([backward.pattern, backward.variation, backward.beamCount, backward.spread]).toEqual([
      directBackward.pattern, directBackward.variation, directBackward.beamCount, directBackward.spread,
    ])

    const looped = director.update({ frame: frame({ barIndex: 0, sectionId: 'verse-seek', timingDiscontinuity: true }), settings: { ...SETTINGS, ...settings } })
    const loopStart = resolve({ barIndex: 0, sectionId: 'verse-seek', timingDiscontinuity: true }, settings)
    expect([looped.pattern, looped.variation, looped.beamCount, looped.spread]).toEqual([
      loopStart.pattern, loopStart.variation, loopStart.beamCount, loopStart.spread,
    ])
  })

  it('keeps Blackout Amount authoritative at exact 0 and exact 100%', () => {
    const noBlackout = resolve({ sectionType: 'drop', sectionId: 'drop-blackout', drop: 1, dropStart: true }, { blackoutAmount: 0 })
    const fullBlackout = resolve({ sectionType: 'drop', sectionId: 'drop-blackout', drop: 1, dropStart: true }, { blackoutAmount: 1 })
    expect(noBlackout.blackout).toBe(0)
    expect(fullBlackout.blackout).toBe(1)
  })

  it('keeps Trigger / Pulse controls coherent inside the hierarchy instead of a competing reaction director', () => {
    const dry = resolve({ beat: true }, { trigger: 'beat', pulseAmount: 0, masterIntensity: 0.6 })
    const pulsed = resolve({ beat: true }, { trigger: 'beat', pulseAmount: 1, masterIntensity: 0.6 })
    expect(pulsed.triggerEnvelope).toBe(1)
    expect(pulsed.intensity).toBeGreaterThan(dry.intensity)
    expect(resolve({ beat: true }, { trigger: 'beat', pulseAmount: 1, masterIntensity: 0 }).intensity).toBe(0)
  })

  it('keeps BPM Sync Off deterministic from transport time and does not synthesize a new clock', () => {
    const settings = { bpmSync: false, motionAmount: 0.8 }
    const first = resolve({ transportTimeSec: 20, barIndex: 12 }, settings)
    const replay = resolve({ transportTimeSec: 20, barIndex: 12 }, settings)
    expect(first.motionPhase).toBe(10)
    expect(replay.motionPhase).toBe(first.motionPhase)
  })

  it('falls back to the authored manual scene when Audio Intelligence is absent', () => {
    const fallback = resolve(
      { intelligence: false, canonical: false, energy: 0 },
      { pattern: 'fullRig', patternChange: 'off', beamCount: 9, spread: 0.4, motionAmount: 0.7, masterIntensity: 0.6 },
    )
    expect(fallback.pattern).toBe('fullRig')
    expect(fallback.variation).toBe(0)
    expect(fallback.beamCount).toBe(9)
    expect(fallback.spread).toBe(0.4)
    expect(fallback.motionAuthority).toBe(0.7)
    expect(fallback.intensity).toBe(0.6)
    expect(fallback.bankWeights).toEqual({ bottom: 1, left: 1, right: 1, top: 1 })
    expect(fallback.blackout).toBe(0)
  })

  it('does not advance event envelopes while transport is stopped and remains finite across rapid stop/start', () => {
    const director = new AfterhoursAudioIntelligenceDirector()
    const settings = { ...SETTINGS, trigger: 'kick' as const }
    const stopped = director.update({ frame: frame({ kick: true, playing: false }), settings })
    expect(stopped.kickEnvelope).toBe(0)
    const started = director.update({ frame: frame({ kick: true, playing: true, beatIndex: 1 }), settings })
    expect(started.kickEnvelope).toBe(1)
    for (const value of [started.intensity, started.spread, started.motionAuthority, started.blackout]) expect(Number.isFinite(value)).toBe(true)
  })
})
