/**
 * Tests for the shader audio bridge, smoothing system, and texture wrappers.
 *
 * A — AudioSmoother: attack/release timing
 * B — TriggerEnvelope: decay behavior
 * C — AudioSmootherSet: reset
 * D — ShaderAudioBridge: neutral frame behavior
 * E — ShaderAudioBridge: NaN / Infinity protection
 * F — ShaderAudioBridge: section-type encoding stability
 * G — ShaderAudioBridge: beat and bar phase normalization
 * H — ShaderAudioBridge: track-change reset
 * I — ShaderAudioBridge: timing frame
 * J — ShaderSpectrumTexture: data normalization, buffer reuse
 * K — ShaderWaveformTexture: silence fallback, buffer reuse
 * L — ShaderAudioBridge: applyToProgram optional uniforms
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { AudioSmoother, TriggerEnvelope, AudioSmootherSet } from '../ShaderAudioSmoothing'
import { ShaderAudioBridge }    from '../ShaderAudioBridge'
import { ShaderSpectrumTexture, SPECTRUM_BIN_COUNT } from '../ShaderSpectrumTexture'
import { ShaderWaveformTexture, WAVEFORM_SAMPLE_COUNT } from '../ShaderWaveformTexture'
import { SECTION_TYPE_CODES, NEUTRAL_AUDIO_FRAME, NEUTRAL_TIMING_FRAME } from '../shaderAudioTypes'
import type { ReactFrameContext }      from '../../../renderers/reactRenderUtils'
import type { MusicIntelligenceFrame } from '../../../../../../features/musicIntelligence/types'

// ── Factories ─────────────────────────────────────────────────────────────────

function makeFrame(overrides: Partial<ReactFrameContext> = {}): ReactFrameContext {
  return {
    W: 1280, H: 720, dpr: 1,
    t: 0, timeSec: 0, audioTime: 0,
    bpm: 120, beatPhase: 0, beatHit: false, isPlaying: true,
    audio: { bass: 0, mid: 0, high: 0, volume: 0 },
    freqData: null, timeDomainData: null,
    musicIntelligence: null,
    ...overrides,
  }
}

function makeMI(overrides: DeepPartial<MusicIntelligenceFrame> = {}): MusicIntelligenceFrame {
  const base: MusicIntelligenceFrame = {
    timeSec: 0, frameId: 1, sampleRate: 44100,
    sourceId: 'track-a', trackId: 'track-a',
    bands: {
      sub: 0, bass: 0, lowMid: 0, mid: 0, high: 0, air: 0, volume: 0,
      normalizedSub: 0, normalizedBass: 0, normalizedLowMid: 0,
      normalizedMid: 0, normalizedHigh: 0, normalizedAir: 0,
    },
    rhythm: {
      bpm: 120, bpmConfidence: 0.9,
      beatPhase: 0, beatHit: false, beatIndex: 0, beatInBar: 0, barIndex: 0,
      downbeatHit: false,
      phrase4Progress: 0, phrase8Progress: 0, phrase16Progress: 0, phrase32Progress: 0,
      phrase4Hit: false, phrase8Hit: false, phrase16Hit: false, phrase32Hit: false,
      kickHit: false, kickStrength: 0,
      snareHit: false, snareStrength: 0,
      hatHit: false, hatStrength: 0,
      transient: 0, transientConfidence: 0,
    },
    energy: {
      instant: 0, shortTerm: 0, longTerm: 0, peak: 0, rms: 0,
      crestFactor: 0, spectralFlux: 0, delta: 0, percentile: 0,
      buildProgress: 0, dropImpact: 0, tension: 0, complexity: 0,
      spectralCentroid: 0, spectralSpread: 0, spectralRolloff: 0, spectralFlatness: 0,
    },
    section: {
      type: null, label: '', startSec: 0, endSec: 0,
      progress: 0, intensity: 0.5, confidence: 0.8, source: 'analysis',
    },
    harmonic: {
      key: null, mode: null, keyConfidence: 0, chord: null, chordConfidence: 0,
      chordChanged: false, rootNote: null, pitchHz: null, note: null, melodyContour: null,
    },
    stems: {
      vocals: 0, drums: 0, bass: 0, instruments: 0, other: 0,
      vocalEnergy: 0, drumEnergy: 0, bassStemEnergy: 0, instrumentEnergy: 0, otherStemEnergy: 0,
      vocalActivity: 0, drumTransient: false, bassStemTransient: false,
    },
    lyrics: {
      activeLine: null, activeWord: null, vocalActivity: 0,
      phraseConfidence: 0, lyricLineProgress: 0, wordHit: false,
    },
    semantics: {
      buildConfidence: 0, dropConfidence: 0, fakeoutConfidence: 0,
      vocalHookConfidence: 0, mood: null, texture: null,
    },
    raw: { freqData: null, timeDomainData: null },
    confidence: { overall: 0.5, rhythm: 0.7, harmonic: 0.3, section: 0.6 },
  }
  return deepMerge(base, overrides) as MusicIntelligenceFrame
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }
function deepMerge(base: unknown, over: unknown): unknown {
  const b = base as Record<string, unknown>
  const o = over as Record<string, unknown>
  const result: Record<string, unknown> = { ...b }
  for (const key of Object.keys(o)) {
    const bv = b[key]; const ov = o[key]
    if (ov !== null && typeof ov === 'object' && !Array.isArray(ov) &&
        bv !== null && typeof bv === 'object' && !Array.isArray(bv)) {
      result[key] = deepMerge(bv, ov)
    } else {
      result[key] = ov
    }
  }
  return result
}

// ── Minimal mock GL for texture tests ─────────────────────────────────────────

function makeGl() {
  const texSubImage2DCalls: unknown[][] = []
  const texImage2DCalls:    unknown[][] = []
  let nextTex = 1

  const gl = {
    TEXTURE_2D: 0x0DE1,
    TEXTURE_MIN_FILTER: 0x2801, TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_WRAP_S: 0x2802, TEXTURE_WRAP_T: 0x2803,
    LINEAR: 0x2601, CLAMP_TO_EDGE: 0x812F,
    UNSIGNED_BYTE: 0x1401,
    R8: 0x8229, RED: 0x1903,

    createTexture: () => ({ _id: nextTex++ }),
    deleteTexture: (_t: unknown) => {},
    bindTexture: (_target: number, _tex: unknown) => {},
    texParameteri: (_target: number, _pname: number, _param: number) => {},
    texImage2D: (...args: unknown[]) => { texImage2DCalls.push(args) },
    texSubImage2D: (...args: unknown[]) => { texSubImage2DCalls.push(args) },

    _texSubImage2DCalls: texSubImage2DCalls,
    _texImage2DCalls:    texImage2DCalls,
  }

  return gl as unknown as WebGL2RenderingContext & typeof gl
}

// ── Mock ShaderProgram ────────────────────────────────────────────────────────

function makeMockProgram() {
  const floats: Record<string, number> = {}
  const ints:   Record<string, number> = {}
  const samplers: Record<string, number> = {}

  return {
    setFloat:   (name: string, v: number)  => { floats[name]   = v },
    setInt:     (name: string, v: number)  => { ints[name]     = v },
    setSampler: (name: string, unit: number) => { samplers[name] = unit },
    _floats: floats, _ints: ints, _samplers: samplers,
  }
}

// ── A — AudioSmoother ─────────────────────────────────────────────────────────

describe('A — AudioSmoother', () => {
  it('starts at 0', () => {
    expect(new AudioSmoother(0.01, 0.1).value).toBe(0)
  })

  it('approaches target over time (attack)', () => {
    const s = new AudioSmoother(0.05, 0.5)  // fast attack
    let v = 0
    for (let i = 0; i < 20; i++) v = s.update(1.0, 0.01)
    expect(v).toBeGreaterThan(0.5)
    expect(v).toBeLessThan(1.0)  // never overshoots
  })

  it('release is slower than attack when different times are set', () => {
    const s = new AudioSmoother(0.001, 0.5)
    // Pin value near 1
    for (let i = 0; i < 50; i++) s.update(1.0, 0.01)
    const afterAttack = s.value
    // Now release
    for (let i = 0; i < 5; i++) s.update(0.0, 0.01)
    const afterRelease = s.value
    // With 5ms release time constant > 1ms attack, we should still be high
    expect(afterRelease).toBeGreaterThan(afterAttack * 0.5)
  })

  it('never overshoots target', () => {
    const s = new AudioSmoother(0.01, 0.1)
    for (let i = 0; i < 100; i++) {
      const v = s.update(1.0, 0.033)
      expect(v).toBeLessThanOrEqual(1.0)
      expect(v).toBeGreaterThanOrEqual(0.0)
    }
  })

  it('clamps output for target > 1', () => {
    const s = new AudioSmoother(0.001, 0.001)
    for (let i = 0; i < 100; i++) s.update(999, 0.1)
    expect(s.value).toBeLessThanOrEqual(1.0)
  })

  it('returns 0 for non-finite target', () => {
    const s = new AudioSmoother(0.001, 0.001)
    s.update(NaN, 0.01)
    expect(s.value).toBe(0)
  })

  it('reset brings value back to 0', () => {
    const s = new AudioSmoother(0.001, 0.1)
    for (let i = 0; i < 50; i++) s.update(1.0, 0.01)
    expect(s.value).toBeGreaterThan(0.5)
    s.reset()
    expect(s.value).toBe(0)
    expect(s.peak).toBe(0)
  })

  it('is frame-rate stable: fast and slow tick converge to same result', () => {
    const total = 0.2  // 200ms
    const fast = new AudioSmoother(0.05, 0.2)
    const slow = new AudioSmoother(0.05, 0.2)

    // Fast: 200 steps of 1ms
    for (let i = 0; i < 200; i++) fast.update(1.0, 0.001)
    // Slow: 2 steps of 100ms
    for (let i = 0; i < 2; i++) slow.update(1.0, total / 2)

    expect(Math.abs(fast.value - slow.value)).toBeLessThan(0.02)
  })

  it('peak hold tracks the maximum', () => {
    const s = new AudioSmoother(0.001, 0.5, 0.1)  // 100ms hold
    for (let i = 0; i < 10; i++) s.update(0.8, 0.01)
    expect(s.peak).toBeCloseTo(s.value, 1)
    for (let i = 0; i < 10; i++) s.update(0.0, 0.01)  // value drops
    // Peak should still be > value while hold timer active
    expect(s.peak).toBeGreaterThanOrEqual(s.value)
  })
})

// ── B — TriggerEnvelope ───────────────────────────────────────────────────────

describe('B — TriggerEnvelope', () => {
  it('starts at 0', () => {
    expect(new TriggerEnvelope(0.1).value).toBe(0)
  })

  it('fires to 1.0 on trigger()', () => {
    const env = new TriggerEnvelope(0.1)
    env.trigger()
    expect(env.value).toBe(1.0)
  })

  it('decays toward 0 over time', () => {
    const env = new TriggerEnvelope(0.1)
    env.trigger()
    for (let i = 0; i < 20; i++) env.update(0.01)  // 200ms > 100ms tau
    expect(env.value).toBeLessThan(0.2)
  })

  it('reaches exactly 0 after enough time (floor clamp)', () => {
    const env = new TriggerEnvelope(0.01)
    env.trigger()
    for (let i = 0; i < 100; i++) env.update(0.01)  // 1 second >> 10ms tau
    expect(env.value).toBe(0)
  })

  it('re-fires to 1.0 even during decay', () => {
    const env = new TriggerEnvelope(0.2)
    env.trigger()
    env.update(0.05)
    expect(env.value).toBeLessThan(1.0)
    env.trigger()  // re-fire
    expect(env.value).toBe(1.0)
  })

  it('is frame-rate stable', () => {
    const total = 0.1
    const fast = new TriggerEnvelope(0.05)
    const slow = new TriggerEnvelope(0.05)
    fast.trigger(); slow.trigger()
    for (let i = 0; i < 100; i++) fast.update(total / 100)
    for (let i = 0; i < 10; i++)  slow.update(total / 10)
    expect(Math.abs(fast.value - slow.value)).toBeLessThan(0.01)
  })

  it('reset brings value to 0', () => {
    const env = new TriggerEnvelope(1.0)
    env.trigger()
    env.reset()
    expect(env.value).toBe(0)
  })

  it('never goes below 0', () => {
    const env = new TriggerEnvelope(0.001)
    env.trigger()
    for (let i = 0; i < 1000; i++) env.update(0.1)
    expect(env.value).toBeGreaterThanOrEqual(0)
  })
})

// ── C — AudioSmootherSet ──────────────────────────────────────────────────────

describe('C — AudioSmootherSet', () => {
  it('resetAll() brings all smoothers and envelopes to 0', () => {
    const set = new AudioSmootherSet()
    for (let i = 0; i < 50; i++) {
      set.sub.update(1.0, 0.01)
      set.bass.update(1.0, 0.01)
    }
    set.kickHitEnv.trigger()
    set.resetAll()
    expect(set.sub.value).toBe(0)
    expect(set.bass.value).toBe(0)
    expect(set.kickHitEnv.value).toBe(0)
  })
})

// ── D — Neutral frame ─────────────────────────────────────────────────────────

describe('D — neutral frame behavior', () => {
  let bridge: ShaderAudioBridge
  beforeEach(() => { bridge = new ShaderAudioBridge() })

  it('audioFrame values are all 0 before any update', () => {
    const a = bridge.audioFrame
    expect(a).toEqual(NEUTRAL_AUDIO_FRAME)
  })

  it('timingFrame is neutral before any update', () => {
    expect(bridge.timingFrame).toEqual(NEUTRAL_TIMING_FRAME)
  })

  it('all audio values stay at 0 when frame has no MI and zero audio', () => {
    bridge.update(makeFrame(), 0, 0.016)
    const a = bridge.audioFrame
    expect(a.sub).toBe(0)
    expect(a.highMid).toBe(0)
    expect(a.air).toBe(0)
    expect(a.tension).toBe(0)
    expect(a.buildProgress).toBe(0)
  })

  it('trigger values are 0 when no hits occur', () => {
    bridge.update(makeFrame(), 0, 0.016)
    const a = bridge.audioFrame
    expect(a.kickHit).toBe(0)
    expect(a.snareHit).toBe(0)
    expect(a.hatHit).toBe(0)
    expect(a.beatHit).toBe(0)
    expect(a.downbeatHit).toBe(0)
  })
})

// ── E — NaN / Infinity protection ────────────────────────────────────────────

describe('E — NaN and Infinity protection', () => {
  it('NaN from MI bands produces 0 in audioFrame', () => {
    const bridge = new ShaderAudioBridge()
    const mi = makeMI({
      bands: { normalizedBass: NaN, normalizedMid: NaN } as never,
    })
    bridge.update(makeFrame({ musicIntelligence: mi }), 0, 0.016)
    expect(isFinite(bridge.audioFrame.bass)).toBe(true)
    expect(isFinite(bridge.audioFrame.mid)).toBe(true)
    expect(bridge.audioFrame.bass).toBe(0)
  })

  it('Infinity from MI energy produces finite output', () => {
    const bridge = new ShaderAudioBridge()
    const mi = makeMI({ energy: { instant: Infinity, tension: -Infinity } as never })
    bridge.update(makeFrame({ musicIntelligence: mi }), 0, 0.016)
    expect(isFinite(bridge.audioFrame.energy)).toBe(true)
    expect(isFinite(bridge.audioFrame.tension)).toBe(true)
  })

  it('NaN from basic audio fallback produces finite output', () => {
    const bridge = new ShaderAudioBridge()
    const frame = makeFrame({ audio: { bass: NaN, mid: NaN, high: NaN, volume: NaN } })
    bridge.update(frame, 0, 0.016)
    const a = bridge.audioFrame
    for (const key of Object.keys(a) as (keyof typeof a)[]) {
      expect(isFinite(a[key])).toBe(true)
    }
  })

  it('NaN runtimeTime produces 0 in timingFrame', () => {
    const bridge = new ShaderAudioBridge()
    bridge.update(makeFrame(), NaN, NaN)
    expect(isFinite(bridge.timingFrame.time)).toBe(true)
    expect(isFinite(bridge.timingFrame.deltaTime)).toBe(true)
  })
})

// ── F — Section-type encoding ─────────────────────────────────────────────────

describe('F — section-type encoding', () => {
  it('encodes known section types to stable integers', () => {
    expect(SECTION_TYPE_CODES['intro']).toBe(1)
    expect(SECTION_TYPE_CODES['verse']).toBe(2)
    expect(SECTION_TYPE_CODES['build']).toBe(3)
    expect(SECTION_TYPE_CODES['preDrop']).toBe(4)
    expect(SECTION_TYPE_CODES['drop']).toBe(5)
    expect(SECTION_TYPE_CODES['breakdown']).toBe(6)
    expect(SECTION_TYPE_CODES['bridge']).toBe(7)
    expect(SECTION_TYPE_CODES['outro']).toBe(8)
    expect(SECTION_TYPE_CODES['unknown']).toBe(9)
  })

  it('produces 0 for null section type', () => {
    const bridge = new ShaderAudioBridge()
    const mi = makeMI({ section: { type: null } })
    bridge.update(makeFrame({ musicIntelligence: mi }), 0, 0.016)
    expect(bridge.timingFrame.sectionType).toBe(0)
  })

  it('produces 5 for drop section', () => {
    const bridge = new ShaderAudioBridge()
    const mi = makeMI({ section: { type: 'drop', startSec: 0 } })
    bridge.update(makeFrame({ musicIntelligence: mi }), 0, 0.016)
    expect(bridge.timingFrame.sectionType).toBe(5)
  })

  it('produces 3 for build section', () => {
    const bridge = new ShaderAudioBridge()
    const mi = makeMI({ section: { type: 'build', startSec: 10 } })
    bridge.update(makeFrame({ musicIntelligence: mi }), 0, 0.016)
    expect(bridge.timingFrame.sectionType).toBe(3)
  })
})

// ── G — Beat and bar phase ───────────────────────────────────────────────────

describe('G — beat and bar phase normalization', () => {
  it('beatPhase is clamped to 0–1', () => {
    const bridge = new ShaderAudioBridge()
    const mi = makeMI({ rhythm: { beatPhase: 0.75 } })
    bridge.update(makeFrame({ musicIntelligence: mi }), 0, 0.016)
    expect(bridge.timingFrame.beatPhase).toBeCloseTo(0.75)
    expect(bridge.timingFrame.beatPhase).toBeGreaterThanOrEqual(0)
    expect(bridge.timingFrame.beatPhase).toBeLessThanOrEqual(1)
  })

  it('barPhase = (beatInBar + beatPhase) / 4', () => {
    const bridge = new ShaderAudioBridge()
    const mi = makeMI({ rhythm: { beatInBar: 2, beatPhase: 0.5 } })
    bridge.update(makeFrame({ musicIntelligence: mi }), 0, 0.016)
    // (2 + 0.5) / 4 = 0.625
    expect(bridge.timingFrame.barPhase).toBeCloseTo(0.625)
  })

  it('barPhase is 0 for beatInBar=0, beatPhase=0', () => {
    const bridge = new ShaderAudioBridge()
    const mi = makeMI({ rhythm: { beatInBar: 0, beatPhase: 0 } })
    bridge.update(makeFrame({ musicIntelligence: mi }), 0, 0.016)
    expect(bridge.timingFrame.barPhase).toBeCloseTo(0)
  })

  it('barPhase is 0.75 for beat 3 start', () => {
    const bridge = new ShaderAudioBridge()
    const mi = makeMI({ rhythm: { beatInBar: 3, beatPhase: 0 } })
    bridge.update(makeFrame({ musicIntelligence: mi }), 0, 0.016)
    expect(bridge.timingFrame.barPhase).toBeCloseTo(0.75)
  })

  it('phrasePhase maps to phrase8Progress', () => {
    const bridge = new ShaderAudioBridge()
    const mi = makeMI({ rhythm: { phrase8Progress: 0.4 } })
    bridge.update(makeFrame({ musicIntelligence: mi }), 0, 0.016)
    expect(bridge.timingFrame.phrasePhase).toBeCloseTo(0.4)
  })

  it('sectionPhase maps to section.progress', () => {
    const bridge = new ShaderAudioBridge()
    const mi = makeMI({ section: { progress: 0.6 } })
    bridge.update(makeFrame({ musicIntelligence: mi }), 0, 0.016)
    expect(bridge.timingFrame.sectionPhase).toBeCloseTo(0.6)
  })
})

// ── H — Track-change reset ────────────────────────────────────────────────────

describe('H — track-change reset', () => {
  it('resets smoothers when trackId changes', () => {
    const bridge = new ShaderAudioBridge()
    const hiMI = makeMI({ bands: { normalizedBass: 1.0 } })

    // Drive bass high on track-a
    for (let i = 0; i < 30; i++) {
      bridge.update(makeFrame({ musicIntelligence: { ...hiMI, trackId: 'track-a', sourceId: 'track-a' } }), i * 0.016, 0.016)
    }
    const bassAfterTrackA = bridge.audioFrame.bass
    expect(bassAfterTrackA).toBeGreaterThan(0.5)

    // Switch to track-b with silence — smoothers must reset first
    const silentMI = makeMI({ trackId: 'track-b', sourceId: 'track-b', bands: { normalizedBass: 0 } })
    bridge.update(makeFrame({ musicIntelligence: silentMI }), 31 * 0.016, 0.016)

    // After reset, bass should be near 0 (smoother was reset to 0, then one small step toward 0)
    expect(bridge.audioFrame.bass).toBeLessThan(0.05)
  })

  it('sectionChangePulse fires only on the first frame of a new section', () => {
    const bridge = new ShaderAudioBridge()
    const mi1 = makeMI({ section: { type: 'verse', startSec: 10 } })
    bridge.update(makeFrame({ musicIntelligence: mi1 }), 0, 0.016)
    const pulse1 = bridge.timingFrame.sectionChangePulse

    // Same section again
    bridge.update(makeFrame({ musicIntelligence: mi1 }), 0.016, 0.016)
    const pulse2 = bridge.timingFrame.sectionChangePulse

    // New section
    const mi2 = makeMI({ section: { type: 'drop', startSec: 30 } })
    bridge.update(makeFrame({ musicIntelligence: mi2 }), 0.032, 0.016)
    const pulse3 = bridge.timingFrame.sectionChangePulse

    // pulse1: first-ever update, section start changes from -1 → 10 → fires
    expect(pulse1).toBe(1.0)
    // pulse2: same startSec, no change
    expect(pulse2).toBe(0.0)
    // pulse3: new section started
    expect(pulse3).toBe(1.0)
  })
})

// ── I — Timing frame ──────────────────────────────────────────────────────────

describe('I — timing frame', () => {
  it('runtimeTimeSec passes through to timingFrame.time', () => {
    const bridge = new ShaderAudioBridge()
    bridge.update(makeFrame(), 42.5, 0.016)
    expect(bridge.timingFrame.time).toBeCloseTo(42.5)
  })

  it('playbackTime comes from frame.audioTime', () => {
    const bridge = new ShaderAudioBridge()
    bridge.update(makeFrame({ audioTime: 123.45 }), 0, 0.016)
    expect(bridge.timingFrame.playbackTime).toBeCloseTo(123.45)
  })

  it('playbackProgress is 0 (not available in ReactFrameContext)', () => {
    const bridge = new ShaderAudioBridge()
    bridge.update(makeFrame(), 0, 0.016)
    expect(bridge.timingFrame.playbackProgress).toBe(0)
  })

  it('beatIndex and barIndex from MI are passed through', () => {
    const bridge = new ShaderAudioBridge()
    const mi = makeMI({ rhythm: { beatIndex: 17, barIndex: 4 } })
    bridge.update(makeFrame({ musicIntelligence: mi }), 0, 0.016)
    expect(bridge.timingFrame.beatIndex).toBe(17)
    expect(bridge.timingFrame.barIndex).toBe(4)
  })

  it('negative runtimeTime is clamped to 0', () => {
    const bridge = new ShaderAudioBridge()
    bridge.update(makeFrame(), -10, -0.1)
    expect(bridge.timingFrame.time).toBe(0)
    expect(bridge.timingFrame.deltaTime).toBe(0)
  })
})

// ── J — ShaderSpectrumTexture ─────────────────────────────────────────────────

describe('J — ShaderSpectrumTexture', () => {
  it('binCount equals SPECTRUM_BIN_COUNT', () => {
    const gl = makeGl()
    const tex = new ShaderSpectrumTexture(gl)
    expect(tex.binCount).toBe(SPECTRUM_BIN_COUNT)
  })

  it('buffer is a Uint8Array of SPECTRUM_BIN_COUNT bytes', () => {
    const gl = makeGl()
    const tex = new ShaderSpectrumTexture(gl)
    expect(tex.buffer).toBeInstanceOf(Uint8Array)
    expect(tex.buffer.length).toBe(SPECTRUM_BIN_COUNT)
  })

  it('reuses the same buffer object across multiple updates', () => {
    const gl = makeGl()
    const tex = new ShaderSpectrumTexture(gl)
    const ref = tex.buffer
    tex.update(new Uint8Array(SPECTRUM_BIN_COUNT).fill(100))
    tex.update(new Uint8Array(SPECTRUM_BIN_COUNT).fill(200))
    expect(tex.buffer).toBe(ref)  // same object identity
  })

  it('uses texSubImage2D (not texImage2D) for subsequent uploads', () => {
    const gl = makeGl()
    const tex = new ShaderSpectrumTexture(gl)
    const sub0 = gl._texSubImage2DCalls.length
    tex.update(new Uint8Array(16).fill(128))
    expect(gl._texSubImage2DCalls.length).toBe(sub0 + 1)
  })

  it('copies frequency data into the buffer (normalized by WebGL)', () => {
    const gl = makeGl()
    const tex = new ShaderSpectrumTexture(gl)
    const data = new Uint8Array(SPECTRUM_BIN_COUNT)
    data[0] = 255; data[1] = 128; data[2] = 0
    tex.update(data)
    // Buffer stores raw bytes; WebGL converts to 0..1 in GLSL
    expect(tex.buffer[0]).toBe(255)
    expect(tex.buffer[1]).toBe(128)
    expect(tex.buffer[2]).toBe(0)
  })

  it('fills with 0 when null data is provided', () => {
    const gl = makeGl()
    const tex = new ShaderSpectrumTexture(gl)
    tex.update(new Uint8Array(SPECTRUM_BIN_COUNT).fill(200))  // dirty the buffer
    tex.update(null)
    expect(tex.buffer.every(v => v === 0)).toBe(true)
  })

  it('zero-fills tail when input is shorter than BIN_COUNT', () => {
    const gl = makeGl()
    const tex = new ShaderSpectrumTexture(gl)
    const short = new Uint8Array(10).fill(99)
    tex.update(short)
    expect(tex.buffer[0]).toBe(99)
    expect(tex.buffer[10]).toBe(0)
    expect(tex.buffer[SPECTRUM_BIN_COUNT - 1]).toBe(0)
  })

  it('ignores input beyond BIN_COUNT', () => {
    const gl = makeGl()
    const tex = new ShaderSpectrumTexture(gl)
    const long = new Uint8Array(SPECTRUM_BIN_COUNT + 100).fill(77)
    tex.update(long)
    expect(tex.buffer.length).toBe(SPECTRUM_BIN_COUNT)
  })
})

// ── K — ShaderWaveformTexture ─────────────────────────────────────────────────

describe('K — ShaderWaveformTexture', () => {
  it('sampleCount equals WAVEFORM_SAMPLE_COUNT', () => {
    const gl = makeGl()
    const tex = new ShaderWaveformTexture(gl)
    expect(tex.sampleCount).toBe(WAVEFORM_SAMPLE_COUNT)
  })

  it('buffer starts filled with 128 (digital silence)', () => {
    const gl = makeGl()
    const tex = new ShaderWaveformTexture(gl)
    expect(tex.buffer.every(v => v === 128)).toBe(true)
  })

  it('reuses the same buffer object across updates', () => {
    const gl = makeGl()
    const tex = new ShaderWaveformTexture(gl)
    const ref = tex.buffer
    tex.update(new Uint8Array(WAVEFORM_SAMPLE_COUNT).fill(64))
    tex.update(new Uint8Array(WAVEFORM_SAMPLE_COUNT).fill(192))
    expect(tex.buffer).toBe(ref)
  })

  it('fills with 128 when null data is provided', () => {
    const gl = makeGl()
    const tex = new ShaderWaveformTexture(gl)
    tex.update(new Uint8Array(WAVEFORM_SAMPLE_COUNT).fill(200))
    tex.update(null)
    expect(tex.buffer.every(v => v === 128)).toBe(true)
  })

  it('uses texSubImage2D for updates', () => {
    const gl = makeGl()
    const tex = new ShaderWaveformTexture(gl)
    const before = gl._texSubImage2DCalls.length
    tex.update(new Uint8Array(WAVEFORM_SAMPLE_COUNT))
    expect(gl._texSubImage2DCalls.length).toBe(before + 1)
  })

  it('zero-fills tail when input is shorter than SAMPLE_COUNT', () => {
    const gl = makeGl()
    const tex = new ShaderWaveformTexture(gl)
    const short = new Uint8Array(8).fill(200)
    tex.update(short)
    expect(tex.buffer[0]).toBe(200)
    expect(tex.buffer[8]).toBe(128)  // filled with silence
  })
})

// ── L — applyToProgram optional uniforms ────────────────────────────────────

describe('L — applyToProgram', () => {
  function makeGlForProgram() {
    return {
      TEXTURE0: 0x84C0, TEXTURE_2D: 0x0DE1,
      activeTexture: (_u: number) => {},
      bindTexture: (_t: number, _tex: unknown) => {},
    } as unknown as WebGL2RenderingContext
  }

  it('sets all timing and audio uniforms', () => {
    const bridge = new ShaderAudioBridge()
    const mi = makeMI({ rhythm: { beatPhase: 0.3 }, energy: { instant: 0.7 } })
    bridge.update(makeFrame({ audioTime: 10, musicIntelligence: mi }), 5, 0.016)

    const prog = makeMockProgram()
    bridge.applyToProgram(prog as never, makeGlForProgram())

    expect(prog._floats['uTime']).toBeCloseTo(5)
    expect(prog._floats['uPlaybackTime']).toBeCloseTo(10)
    expect(prog._floats['uBeatPhase']).toBeCloseTo(0.3)
    expect(prog._floats['uEnergy']).toBeGreaterThan(0)
  })

  it('does not throw when textures are omitted', () => {
    const bridge = new ShaderAudioBridge()
    bridge.update(makeFrame(), 0, 0.016)
    const prog = makeMockProgram()
    expect(() => bridge.applyToProgram(prog as never, makeGlForProgram())).not.toThrow()
  })

  it('sets sampler uniforms when textures are provided', () => {
    const bridge = new ShaderAudioBridge()
    bridge.update(makeFrame(), 0, 0.016)

    const glTex = makeGl()
    const specTex = new ShaderSpectrumTexture(glTex)
    const waveTex = new ShaderWaveformTexture(glTex)

    const prog = makeMockProgram()
    const glProg = makeGlForProgram()
    bridge.applyToProgram(prog as never, glProg, specTex, waveTex)

    expect(prog._samplers['uSpectrumTexture']).toBe(14)
    expect(prog._samplers['uWaveformTexture']).toBe(15)
    expect(prog._ints['uSpectrumBinCount']).toBe(SPECTRUM_BIN_COUNT)
    expect(prog._ints['uWaveformSampleCount']).toBe(WAVEFORM_SAMPLE_COUNT)
  })
})
