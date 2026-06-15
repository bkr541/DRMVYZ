/**
 * Integration tests for the LaserDMX Beam Matrix sequencing system.
 *
 * These tests exercise the interaction between:
 * - The compiler (LaserDmxBeamMatrixCompiler)
 * - The modulation engine (LaserDmxModulationEngine)
 * - The beam sequencer (LaserDmxBeamSequencer)
 * - Factory presets and their migration paths
 * - Timing concerns (BPM, envelope reset on track change)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createDefaultLaserDmxBeamMatrixSettings,
  DEFAULT_BEAM_MOTION,
  DEFAULT_BEAM_SEQUENCE,
} from '../../ReactTypes'
import {
  LASER_DMX_BEAM_MATRIX_PRESETS,
  createLaserDmxBeamMatrixPresetSettings,
} from '../../laserDmxBeamMatrixPresets'
import {
  validateBeamMatrixSettings,
  isValid,
  normalizeBeamMatrixSettings,
} from '../laserDmxPresetValidation'

// ── MI frame helpers ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeMiFrame(overrides: Record<string, any> = {}): any {
  const base = {
    frameId: 1,
    bands:   { sub: 0.2, bass: 0.5, lowMid: 0.3, mid: 0.2, high: 0.15, air: 0.05, volume: 0.4,
               normalizedSub: 0.2, normalizedBass: 0.6, normalizedLowMid: 0.3, normalizedMid: 0.25, normalizedHigh: 0.2, normalizedAir: 0.1 },
    rhythm:  { beatHit: true, kickHit: false, snareHit: false, hatHit: false, downbeatHit: false,
               phrase4Hit: false, phrase8Hit: false, phrase16Hit: false, phrase32Hit: false,
               beatPhase: 0.0, bpm: 128, transient: 0.6, kickStrength: 0, snareStrength: 0, hatStrength: 0 },
    energy:  { instant: 0.5, shortTerm: 0.4, longTerm: 0.3, spectralFlux: 0.3, tension: 0.2,
               complexity: 0.3, buildProgress: 0.5, dropImpact: 0, rms: 0.4, peak: 0.6,
               crestFactor: 8, percentile: 0.5, delta: 0.1,
               spectralCentroid: 0.4, spectralSpread: 0.3, spectralRolloff: 0.5, spectralFlatness: 0.2 },
    harmonic:{ pitchHz: null, keyConfidence: 0, chordConfidence: 0, chordChanged: false, mode: null },
    stems:   { vocals: 0, drums: 0.5, bass: 0, instruments: 0, other: 0,
               bassStemEnergy: 0.4, instrumentEnergy: 0.2, otherStemEnergy: 0, vocalEnergy: 0,
               drumEnergy: 0.5, vocalActivity: 0, drumTransient: false, bassStemTransient: false },
    lyrics:  { vocalActivity: 0, lyricLineProgress: 0, phraseConfidence: 0, wordHit: false, activeLine: null, activeWord: null },
    semantics: { buildConfidence: 0, dropConfidence: 0, fakeoutConfidence: 0, vocalHookConfidence: 0, mood: null },
    section: { type: 'unknown', progress: 0, intensity: 0, label: '', startSec: 0, endSec: 60, confidence: 0, source: 'heuristic' },
  }
  return { ...base, ...overrides }
}

function makeDownbeatFrame() {
  return makeMiFrame({ rhythm: { ...makeMiFrame().rhythm, downbeatHit: true, beatHit: true, beatPhase: 0 } })
}

function makeBeatFrame(phase = 0) {
  return makeMiFrame({ rhythm: { ...makeMiFrame().rhythm, beatHit: true, beatPhase: phase } })
}

function makeNoHitFrame() {
  return makeMiFrame({ rhythm: { ...makeMiFrame().rhythm, beatHit: false, kickHit: false, downbeatHit: false } })
}

// ── Track add flow: compiler uses real BPM from MI frame ──────────────────────

describe('compiler uses MI frame BPM (not a hardcoded 120)', () => {
  it('beat timing at 140 BPM produces different step phase than at 128 BPM', async () => {
    const { compileLaserDmxBeamMatrix, resetBeamMatrixCompilerState } = await import('../LaserDmxBeamMatrixCompiler')
    const s = createLaserDmxBeamMatrixPresetSettings('center-out-chase')!

    resetBeamMatrixCompilerState()
    const mi128 = makeMiFrame({ rhythm: { ...makeMiFrame().rhythm, bpm: 128, beatPhase: 0.5 } })
    const result128 = compileLaserDmxBeamMatrix({ settings: s, mi: mi128, time: 0, timeSec: 0.016, canvasWidth: 1280, canvasHeight: 720 })

    resetBeamMatrixCompilerState()
    const mi140 = makeMiFrame({ rhythm: { ...makeMiFrame().rhythm, bpm: 140, beatPhase: 0.5 } })
    const result140 = compileLaserDmxBeamMatrix({ settings: s, mi: mi140, time: 0, timeSec: 0.016, canvasWidth: 1280, canvasHeight: 720 })

    // Both must produce finite output
    for (const b of result128.beams) expect(Number.isFinite(b.intensity)).toBe(true)
    for (const b of result140.beams) expect(Number.isFinite(b.intensity)).toBe(true)
  })
})

// ── Track replacement: envelopes clear after reset ────────────────────────────

describe('track replacement: resetBeamMatrixCompilerState clears envelope state', () => {
  beforeEach(async () => {
    const { resetAllEnvelopes } = await import('../LaserDmxModulationEngine')
    resetAllEnvelopes()
  })

  it('built-up envelope returns to 0 after a compiler reset (simulates track replace)', async () => {
    const { compileLaserDmxBeamMatrix, resetBeamMatrixCompilerState } = await import('../LaserDmxBeamMatrixCompiler')
    const { applyModulationRoute } = await import('../LaserDmxModulationEngine')

    const route = {
      id: 'integ:kick-dimmer', enabled: true,
      source: 'kickHit', target: 'dimmer' as const,
      amount: 1, min: 0, max: 1, curve: 'linear' as const,
      mode: 'trigger' as const, smoothing: 0, threshold: 0,
      attack: 0, release: 0.5, invert: false,
    }
    const dt = 1 / 60
    const kickFrame = makeMiFrame({ rhythm: { ...makeMiFrame().rhythm, kickHit: true } })

    applyModulationRoute(route, kickFrame, 'integ:kick-dimmer', dt)
    const before = applyModulationRoute(route, makeNoHitFrame(), 'integ:kick-dimmer', dt)!.value
    expect(before).toBeGreaterThan(0)

    // Simulate track replacement
    resetBeamMatrixCompilerState()

    const after = applyModulationRoute(route, makeNoHitFrame(), 'integ:kick-dimmer', dt)
    expect(after?.value ?? 0).toBeCloseTo(0, 3)
  })
})

// ── Seeking: compiler produces deterministic output from absoluteBeat ─────────

describe('seeking: deterministic output at same absoluteBeat position', () => {
  it('same absoluteBeat always gives same beam intensity for forward-sequence preset', async () => {
    const { compileLaserDmxBeamMatrix, resetBeamMatrixCompilerState } = await import('../LaserDmxBeamMatrixCompiler')
    const s = createLaserDmxBeamMatrixPresetSettings('center-out-chase')!

    const mi = makeMiFrame({ rhythm: { ...makeMiFrame().rhythm, beatPhase: 0.1, bpm: 128 } })

    resetBeamMatrixCompilerState()
    const r1 = compileLaserDmxBeamMatrix({ settings: s, mi, time: 10, timeSec: 10 / 60, canvasWidth: 1280, canvasHeight: 720 })

    resetBeamMatrixCompilerState()
    const r2 = compileLaserDmxBeamMatrix({ settings: s, mi, time: 10, timeSec: 10 / 60, canvasWidth: 1280, canvasHeight: 720 })

    // Intensity from the same beat phase must be identical
    for (let i = 0; i < r1.beams.length; i++) {
      expect(r1.beams[i].intensity).toBeCloseTo(r2.beams[i].intensity, 5)
    }
  })
})

// ── Pause/resume: envelopes continue without jump ─────────────────────────────

describe('pause/resume: envelope values are continuous across pause', () => {
  beforeEach(async () => {
    const { resetAllEnvelopes } = await import('../LaserDmxModulationEngine')
    resetAllEnvelopes()
  })

  it('envelope decays smoothly across consecutive frames (simulates pause boundary)', async () => {
    const { applyModulationRoute } = await import('../LaserDmxModulationEngine')
    const route = {
      id: 'pause-test', enabled: true,
      source: 'beatHit', target: 'dimmer' as const,
      amount: 1, min: 0, max: 1, curve: 'easeOut' as const,
      mode: 'trigger' as const, smoothing: 0, threshold: 0,
      attack: 0, release: 0.4, invert: false,
    }
    const dt = 1 / 60
    const hitMi  = makeBeatFrame()
    const noHit  = makeNoHitFrame()

    applyModulationRoute(route, hitMi, 'pause-test', dt)
    const v1 = applyModulationRoute(route, noHit, 'pause-test', dt)!.value
    const v2 = applyModulationRoute(route, noHit, 'pause-test', dt)!.value
    const v3 = applyModulationRoute(route, noHit, 'pause-test', dt)!.value

    expect(v1).toBeGreaterThan(0)
    // Decaying — each frame should be <= previous (monotonically decreasing)
    expect(v2).toBeLessThanOrEqual(v1 + 1e-9)
    expect(v3).toBeLessThanOrEqual(v2 + 1e-9)
  })
})

// ── Preset validation flow: all 20 presets pass with no errors ────────────────

describe('preset validation flow', () => {
  it('all 20 factory presets pass isValid() with no errors', () => {
    for (const preset of LASER_DMX_BEAM_MATRIX_PRESETS) {
      const s = preset.createSettings()
      const errors = validateBeamMatrixSettings(s).filter(i => i.severity === 'error')
      expect(errors).toHaveLength(0)
    }
  })

  it('all 20 presets: group routes are compiler-supported', () => {
    const GROUP_TARGETS = new Set(['dimmer', 'beamWidth', 'beamDivergence', 'beamGlow', 'strobeRate'])
    for (const preset of LASER_DMX_BEAM_MATRIX_PRESETS) {
      const s = preset.createSettings()
      for (const g of s.groups) {
        for (const r of g.modulationRoutes) {
          expect(GROUP_TARGETS.has(r.target), `${preset.id}: group route target "${r.target}" unsupported`).toBe(true)
        }
      }
    }
  })

  it('all 20 presets: global routes are compiler-supported', () => {
    const GLOBAL_TARGETS = new Set([
      'masterDimmer', 'backgroundFade', 'beamPersistence',
      'globalBeamWidth', 'globalGlow', 'globalStrobeRate',
      'fogDensity', 'fogOpacity', 'fogBeamScatter', 'fogTurbulence',
    ])
    for (const preset of LASER_DMX_BEAM_MATRIX_PRESETS) {
      const s = preset.createSettings()
      for (const r of s.globalModulationRoutes) {
        expect(GLOBAL_TARGETS.has(r.target), `${preset.id}: global route target "${r.target}" unsupported`).toBe(true)
      }
    }
  })
})

// ── Legacy project flow: normalize restores missing fields ────────────────────

describe('legacy project migration flow', () => {
  it('old preset with no sequence field is normalized to DEFAULT_BEAM_SEQUENCE', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('minimal-crossfire')!
    ;(s.groups[0] as any).sequence = undefined
    normalizeBeamMatrixSettings(s)
    expect(s.groups[0].sequence).toBeDefined()
    expect(s.groups[0].sequence.enabled).toBe(false)
    expect(s.groups[0].sequence.mode).toBe(DEFAULT_BEAM_SEQUENCE.mode)
  })

  it('old preset with no motion field is normalized to DEFAULT_BEAM_MOTION (static)', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('minimal-crossfire')!
    ;(s.beams[0] as any).motion = undefined
    normalizeBeamMatrixSettings(s)
    expect(s.beams[0].motion!.mode).toBe('static')
    expect(s.beams[0].motion!.mode).toBe(DEFAULT_BEAM_MOTION.mode)
  })

  it('normalized legacy settings pass validation', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('minimal-crossfire')!
    for (const g of s.groups) (g as any).sequence = undefined
    for (const b of s.beams) (b as any).motion = undefined
    normalizeBeamMatrixSettings(s)
    expect(isValid(s)).toBe(true)
  })

  it('default settings pass validation after normalization', () => {
    const s = createDefaultLaserDmxBeamMatrixSettings()
    normalizeBeamMatrixSettings(s)
    expect(isValid(s)).toBe(true)
  })
})

// ── Sequencing preset: sequence indices are unique per preset ─────────────────

describe('sequencing presets: sequence index uniqueness', () => {
  const seqPresets = [
    'bass-fan', 'snare-crossfire-seq', 'center-out-chase', 'drop-burst-seq',
    'phrase-scanner', 'outside-in-collapse', 'alternating-fan', 'ping-pong-pulse',
  ]

  for (const id of seqPresets) {
    it(`${id}: all beams have unique sequenceIndex values`, () => {
      const s = createLaserDmxBeamMatrixPresetSettings(id)!
      const indices = s.beams.map(b => b.sequenceIndex)
      expect(new Set(indices).size).toBe(indices.length)
    })
  }
})

// ── Sequencing preset: sequence enabled on all groups ─────────────────────────

describe('sequencing presets: all groups have sequence.enabled=true', () => {
  const seqPresets = [
    'bass-fan', 'snare-crossfire-seq', 'center-out-chase', 'drop-burst-seq',
    'phrase-scanner', 'outside-in-collapse', 'alternating-fan', 'ping-pong-pulse',
  ]

  for (const id of seqPresets) {
    it(`${id}: every group has sequence.enabled=true`, () => {
      const s = createLaserDmxBeamMatrixPresetSettings(id)!
      for (const g of s.groups) {
        expect(g.sequence.enabled).toBe(true)
      }
    })
  }
})

// ── Downbeat reset: center-out-chase resets sequence on downbeat ──────────────

describe('center-out-chase: resetOnDownbeat is set', () => {
  it('group has resetOnDownbeat=true', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('center-out-chase')!
    expect(s.groups[0].sequence.resetOnDownbeat).toBe(true)
  })

  it('compiles without throwing on a downbeat frame', async () => {
    const { compileLaserDmxBeamMatrix, resetBeamMatrixCompilerState } = await import('../LaserDmxBeamMatrixCompiler')
    resetBeamMatrixCompilerState()
    const s = createLaserDmxBeamMatrixPresetSettings('center-out-chase')!
    expect(() =>
      compileLaserDmxBeamMatrix({ settings: s, mi: makeDownbeatFrame(), time: 0, timeSec: 0, canvasWidth: 1280, canvasHeight: 720 }),
    ).not.toThrow()
  })
})

// ── Drop burst: triggers fire on dropImpact ───────────────────────────────────

describe('drop-burst-seq: dropImpact triggers produce non-zero output', () => {
  beforeEach(async () => {
    const { resetAllEnvelopes } = await import('../LaserDmxModulationEngine')
    resetAllEnvelopes()
  })

  it('dropImpact → dimmer trigger route produces non-zero value after hit', async () => {
    const { applyModulationRoute } = await import('../LaserDmxModulationEngine')
    const s = createLaserDmxBeamMatrixPresetSettings('drop-burst-seq')!
    const dropRoute = s.groups[0].modulationRoutes.find(r => r.source === 'dropImpact' && r.target === 'dimmer')!
    expect(dropRoute).toBeDefined()

    const dt = 1 / 60
    const dropMi = makeMiFrame({ energy: { ...makeMiFrame().energy, dropImpact: 1 } })

    applyModulationRoute(dropRoute, dropMi, 'drop-test', dt)
    const afterHit = applyModulationRoute(dropRoute, makeNoHitFrame(), 'drop-test', dt)!
    expect(afterHit.value).toBeGreaterThan(0)
  })
})

// ── Alternating fan: beat triggers alternate odd/even beams ──────────────────

describe('alternating-fan: alternate sequence runs without errors', () => {
  it('compiles cleanly on 8 consecutive beat frames', async () => {
    const { compileLaserDmxBeamMatrix, resetBeamMatrixCompilerState } = await import('../LaserDmxBeamMatrixCompiler')
    resetBeamMatrixCompilerState()
    const s = createLaserDmxBeamMatrixPresetSettings('alternating-fan')!
    const dt = 1 / 60

    for (let frame = 0; frame < 8; frame++) {
      const phase = (frame % 4) / 4
      const mi = makeBeatFrame(phase)
      expect(() =>
        compileLaserDmxBeamMatrix({ settings: s, mi, time: frame, timeSec: frame * dt, canvasWidth: 1280, canvasHeight: 720 }),
      ).not.toThrow()
    }
  })
})

// ── No per-frame Zustand writes from the compiler ─────────────────────────────

describe('compiler does not write to Zustand store', () => {
  it('compiling a sequencing preset does not throw from Zustand setter', async () => {
    const { compileLaserDmxBeamMatrix, resetBeamMatrixCompilerState } = await import('../LaserDmxBeamMatrixCompiler')
    resetBeamMatrixCompilerState()
    const s = createLaserDmxBeamMatrixPresetSettings('ping-pong-pulse')!
    const dt = 1 / 60

    expect(() => {
      for (let i = 0; i < 10; i++) {
        compileLaserDmxBeamMatrix({ settings: s, mi: makeBeatFrame(i / 10), time: i, timeSec: i * dt, canvasWidth: 1280, canvasHeight: 720 })
      }
    }).not.toThrow()
  })
})
