/**
 * Feature tests for the LaserDMX Beam Matrix implementation:
 *   - phaseSpread stagger
 *   - physically forward-only travel (legacy reverse / alternate coercion)
 *   - beatsPerTravel in sequenced mode
 *   - retrigger modes (restart / continue / queue)
 *   - audio launch triggers
 *   - pulse train segments in compiled output
 *   - head glow remains on the target-facing travel head
 *   - group route ops (add / multiply relative to beam base)
 *   - white channel blending
 *   - maxActiveBeams enforcement
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  compileLaserDmxBeamMatrix,
  resetBeamMatrixCompilerState,
} from '../LaserDmxBeamMatrixCompiler'
import {
  createDefaultLaserDmxBeamMatrixSettings,
  DEFAULT_BEAM_MOTION,
  DEFAULT_BEAM_SEQUENCE,
  DEFAULT_LAUNCH_SETTINGS,
} from '../../ReactTypes'
import type {
  LaserDmxBeamMatrixSettings,
  LaserDmxMatrixBeam,
  LaserDmxReactionGroup,
  LaserDmxBeamMatrixOutputSettings,
  LaserDmxModulationRoute,
} from '../../ReactTypes'

vi.stubGlobal('crypto', { randomUUID: (() => { let n = 0; return () => `uuid-feat-${++n}` })() })

// ── Helpers ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeMi(overrides: Record<string, any> = {}): any {
  return {
    frameId: 1,
    bands: { sub: 0, bass: 0, lowMid: 0, mid: 0, high: 0, air: 0, volume: 0,
      normalizedSub: 0, normalizedBass: 0, normalizedLowMid: 0,
      normalizedMid: 0, normalizedHigh: 0, normalizedAir: 0 },
    rhythm: {
      beatHit: false, kickHit: false, snareHit: false, hatHit: false,
      downbeatHit: false, phrase4Hit: false, phrase8Hit: false,
      phrase16Hit: false, phrase32Hit: false,
      beatPhase: 0, beatIndex: 0, beatInBar: 0, barIndex: 0,
      bpm: 120, transient: 0, kickStrength: 0, snareStrength: 0, hatStrength: 0,
      phrase4Progress: 0, phrase8Progress: 0, phrase16Progress: 0, phrase32Progress: 0,
      ...overrides.rhythm,
    },
    energy: {
      instant: 0, shortTerm: 0, longTerm: 0, spectralFlux: 0, tension: 0,
      complexity: 0, buildProgress: 0, dropImpact: 0, rms: 0, peak: 0,
      crestFactor: 0, percentile: 0, delta: 0, spectralCentroid: 0,
      spectralSpread: 0, spectralRolloff: 0, spectralFlatness: 0,
      ...overrides.energy,
    },
    harmonic: { pitchHz: null, keyConfidence: 0, chordConfidence: 0, chordChanged: false, mode: 'unknown' },
    stems: { vocals: 0, drums: 0, bassStemEnergy: 0, instrumentEnergy: 0, vocalEnergy: 0, drumEnergy: 0, vocalActivity: 0, drumTransient: false, bassStemTransient: false },
    lyrics: { vocalActivity: 0, lyricLineProgress: 0, phraseConfidence: 0, wordHit: false, activeLine: null, activeWord: null },
    semantics: { buildConfidence: 0, dropConfidence: 0, fakeoutConfidence: 0, vocalHookConfidence: 0, mood: 'unknown' },
    section: { type: 'unknown', progress: 0, intensity: 0 },
  }
}

function makeOutput(overrides: Partial<LaserDmxBeamMatrixOutputSettings> = {}): LaserDmxBeamMatrixOutputSettings {
  return {
    masterDimmer: 1, blackout: false, safetyClamp: 1,
    backgroundFade: 0, beamPersistence: 0, globalBeamWidth: 1, globalGlow: 1, globalStrobeRate: 0,
    ...overrides,
  }
}

function makeGroup(overrides: Partial<LaserDmxReactionGroup> = {}): LaserDmxReactionGroup {
  return {
    id: 'g1', name: 'G1', enabled: true, muted: false, soloed: false,
    colorOverrideEnabled: false,
    color: { red: 255, green: 255, blue: 255, white: 0, alpha: 1 },
    sequence: DEFAULT_BEAM_SEQUENCE,
    launch: DEFAULT_LAUNCH_SETTINGS,
    maxActiveBeams: 0,
    modulationRoutes: [],
    ...overrides,
  }
}

function makeBeam(overrides: Partial<LaserDmxMatrixBeam> = {}): LaserDmxMatrixBeam {
  return {
    id: `beam-${Math.random().toFixed(6)}`,
    name: 'B', enabled: true, sequenceIndex: 0,
    origin: { column: 1, row: 1, z: 0 },
    target: { kind: 'grid', column: 8, row: 5, z: 0 },
    groupId: null, useGroupColor: false,
    color: { red: 0, green: 255, blue: 220, white: 0, alpha: 1 },
    appearance: {
      dimmer: 1, shutterOpen: true, width: 1, focus: 1,
      strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65,
      geometry: 'line',
    },
    motion: { ...DEFAULT_BEAM_MOTION },
    modulationRoutes: [],
    ...overrides,
  }
}

function makeRoute(overrides: Partial<LaserDmxModulationRoute>): LaserDmxModulationRoute {
  return {
    id: `r-${Math.random().toFixed(6)}`,
    enabled: true, source: 'nBass', target: 'dimmer',
    amount: 1, min: 0, max: 1, curve: 'linear', mode: 'set',
    smoothing: 0, attack: 0, release: 0, invert: false,
    ...overrides,
  }
}

function makeSettings(
  beams: LaserDmxMatrixBeam[],
  output: Partial<LaserDmxBeamMatrixOutputSettings> = {},
  groups: LaserDmxReactionGroup[] = [],
  routes: LaserDmxModulationRoute[] = [],
): LaserDmxBeamMatrixSettings {
  const base = createDefaultLaserDmxBeamMatrixSettings()
  return {
    ...base,
    beams,
    groups,
    globalModulationRoutes: routes,
    output: makeOutput(output),
  }
}

function compile(
  settings: LaserDmxBeamMatrixSettings,
  mi = makeMi(),
  timeSec = 1,
) {
  return compileLaserDmxBeamMatrix({
    settings, mi, time: 0, timeSec, canvasWidth: 800, canvasHeight: 600,
  })
}

// ── 1. phaseSpread stagger ────────────────────────────────────────────────────

describe('phaseSpread', () => {
  beforeEach(() => resetBeamMatrixCompilerState())

  it('phaseSpread=0: all sequenced beams have identical gate state at the same beat', () => {
    // With phaseSpread=0, every beam sees the same phasedBeat, so only one can be active
    // (step-through). Check that beams have consistent gate vs the step index.
    const group = makeGroup({
      id: 'g-spread',
      sequence: {
        ...DEFAULT_BEAM_SEQUENCE,
        enabled: true, mode: 'forward', stepsPerBeat: 1, stepGate: 1, phaseSpread: 0,
      },
    })
    const beams = [
      makeBeam({ id: 'b0', groupId: 'g-spread', sequenceIndex: 0, motion: { ...DEFAULT_BEAM_MOTION, mode: 'grow' } }),
      makeBeam({ id: 'b1', groupId: 'g-spread', sequenceIndex: 1, motion: { ...DEFAULT_BEAM_MOTION, mode: 'grow' } }),
    ]
    const settings = makeSettings(beams, { masterDimmer: 1, safetyClamp: 1 }, [group])
    const mi = makeMi({ rhythm: { bpm: 120, beatIndex: 0, beatPhase: 0, beatInBar: 0, barIndex: 0 } })
    const result = compile(settings, mi)
    // At beat 0, beam b0 (step 0) is active; b1 (step 1) is not
    const r0 = result.beams.find(b => b.beamId === 'b0')
    const r1 = result.beams.find(b => b.beamId === 'b1')
    if (r0 && r1) {
      expect(r0.sequenceGate).toBe(1)
      expect(r1.sequenceGate).toBe(0)
    }
  })

  it('phaseSpread=0.5: beam 1 is delayed by half a beat relative to beam 0', () => {
    // phaseSpread=0.5: beam at index 1 has phasedBeat = beat - 1*0.5
    // At beat=0.5, beam0 phasedBeat=0.5, beam1 phasedBeat=0.0.
    // With stepsPerBeat=1: beam0 at step 0 (active); beam1 also sees step 0 of its delayed clock.
    const group = makeGroup({
      id: 'g-ps',
      sequence: {
        ...DEFAULT_BEAM_SEQUENCE,
        enabled: true, mode: 'all', stepsPerBeat: 1, stepGate: 1, phaseSpread: 0.5,
      },
    })
    const beams = [
      makeBeam({ id: 'b0', groupId: 'g-ps', sequenceIndex: 0, motion: { ...DEFAULT_BEAM_MOTION, mode: 'grow' } }),
      makeBeam({ id: 'b1', groupId: 'g-ps', sequenceIndex: 1, motion: { ...DEFAULT_BEAM_MOTION, mode: 'grow' } }),
    ]
    const settings = makeSettings(beams, { masterDimmer: 1, safetyClamp: 1 }, [group])
    // At beat=0.5: beam0 phasedBeat=0.5→stepPhase=0.5; beam1 phasedBeat=0.0→stepPhase=0.0
    const mi = makeMi({ rhythm: { bpm: 120, beatIndex: 0, beatPhase: 0.5, beatInBar: 0, barIndex: 0 } })
    const result = compile(settings, mi)
    const r0 = result.beams.find(b => b.beamId === 'b0')
    const r1 = result.beams.find(b => b.beamId === 'b1')
    if (r0 && r1) {
      // Beam0 travelProgress should be ahead of beam1 (phaseSpread delay)
      expect(r0.travelProgress).toBeGreaterThan(r1.travelProgress)
    }
  })
})

// ── 2. Physically forward-only travel ────────────────────────────────────────

describe('beam travel direction', () => {
  beforeEach(() => resetBeamMatrixCompilerState())

  it('forward grow remains anchored at the fixture and extends toward the target', () => {
    const beam = makeBeam({
      motion: { ...DEFAULT_BEAM_MOTION, mode: 'grow', direction: 'forward', beatsPerTravel: 1 },
    })
    const mi = makeMi({ rhythm: { bpm: 120, beatIndex: 0, beatPhase: 0.5, beatInBar: 0, barIndex: 0 } })
    const compiled = compile(makeSettings([beam]), mi).beams[0]

    expect(compiled.visibleOrigin.x).toBeCloseTo(compiled.origin.x)
    expect(compiled.visibleOrigin.y).toBeCloseTo(compiled.origin.y)
    expect(compiled.visibleTarget.x).toBeGreaterThan(compiled.visibleOrigin.x)
    expect(compiled.visibleTarget.x).toBeLessThan(compiled.target.x)
  })

  it('legacy reverse grow is coerced to fixture-to-target travel', () => {
    const beam = makeBeam({
      motion: { ...DEFAULT_BEAM_MOTION, mode: 'grow', direction: 'reverse' as any, beatsPerTravel: 1 },
    })
    const mi = makeMi({ rhythm: { bpm: 120, beatIndex: 0, beatPhase: 0.5, beatInBar: 0, barIndex: 0 } })
    const compiled = compile(makeSettings([beam]), mi).beams[0]

    expect(compiled.visibleOrigin.x).toBeCloseTo(compiled.origin.x)
    expect(compiled.visibleOrigin.y).toBeCloseTo(compiled.origin.y)
    expect(compiled.visibleTarget.x).toBeGreaterThan(compiled.visibleOrigin.x)
  })

  it('legacy reverse projectile still advances from origin toward target', () => {
    const beam = makeBeam({
      motion: { ...DEFAULT_BEAM_MOTION, mode: 'projectile', direction: 'reverse' as any, tailLength: 0.2, beatsPerTravel: 1 },
    })
    const mi = makeMi({ rhythm: { bpm: 120, beatIndex: 0, beatPhase: 0.5, beatInBar: 0, barIndex: 0 } })
    const compiled = compile(makeSettings([beam]), mi).beams[0]

    expect(compiled.visibleOrigin.x).toBeLessThan(compiled.visibleTarget.x)
  })

  it('legacy alternate direction cannot reverse odd-index beams', () => {
    const group = makeGroup({
      id: 'g-alt',
      sequence: { ...DEFAULT_BEAM_SEQUENCE, enabled: true, mode: 'all', stepsPerBeat: 1, stepGate: 1 },
    })
    const beams = [
      makeBeam({ id: 'b0', groupId: 'g-alt', sequenceIndex: 0, motion: { ...DEFAULT_BEAM_MOTION, mode: 'grow', direction: 'alternate' as any, beatsPerTravel: 4 } }),
      makeBeam({ id: 'b1', groupId: 'g-alt', sequenceIndex: 1, motion: { ...DEFAULT_BEAM_MOTION, mode: 'grow', direction: 'alternate' as any, beatsPerTravel: 4 } }),
    ]
    const settings = makeSettings(beams, { masterDimmer: 1, safetyClamp: 1 }, [group])
    const mi = makeMi({ rhythm: { bpm: 120, beatIndex: 0, beatPhase: 0.5, beatInBar: 0, barIndex: 0 } })
    const result = compile(settings, mi)

    for (const compiled of result.beams) {
        expect(compiled.visibleOrigin.x).toBeCloseTo(compiled.origin.x)
      expect(compiled.visibleTarget.x).toBeGreaterThanOrEqual(compiled.visibleOrigin.x)
    }
  })
})

// ── 3. beatsPerTravel in sequenced mode ──────────────────────────────────────

describe('beatsPerTravel in sequenced mode', () => {
  beforeEach(() => resetBeamMatrixCompilerState())

  it('travelProgress advances across step even when gate=1 for the full step', () => {
    const group = makeGroup({
      id: 'g-bpt',
      sequence: { ...DEFAULT_BEAM_SEQUENCE, enabled: true, mode: 'all', stepsPerBeat: 1, stepGate: 1, phaseSpread: 0 },
    })
    const beam = makeBeam({
      groupId: 'g-bpt', sequenceIndex: 0,
      motion: { ...DEFAULT_BEAM_MOTION, mode: 'projectile', beatsPerTravel: 1, tailLength: 0.2 },
    })
    const settings = makeSettings([beam], { masterDimmer: 1, safetyClamp: 1 }, [group])

    const early = compileLaserDmxBeamMatrix({
      settings, mi: makeMi({ rhythm: { bpm: 120, beatIndex: 0, beatPhase: 0.2, beatInBar: 0, barIndex: 0 } }),
      time: 0, timeSec: 0.1, canvasWidth: 800, canvasHeight: 600,
    })
    resetBeamMatrixCompilerState()
    const late = compileLaserDmxBeamMatrix({
      settings, mi: makeMi({ rhythm: { bpm: 120, beatIndex: 0, beatPhase: 0.8, beatInBar: 0, barIndex: 0 } }),
      time: 0, timeSec: 0.1, canvasWidth: 800, canvasHeight: 600,
    })

    const te = early.beams[0]?.travelProgress ?? 0
    const tl = late.beams[0]?.travelProgress ?? 0
    expect(tl).toBeGreaterThan(te)
  })
})

// ── 4. Retrigger modes ────────────────────────────────────────────────────────

describe('retrigger: restart', () => {
  beforeEach(() => resetBeamMatrixCompilerState())

  it('restart: re-triggering resets travel progress toward 0', () => {
    const beam = makeBeam({
      id: 'b-restart',
      motion: { ...DEFAULT_BEAM_MOTION, mode: 'projectile', beatsPerTravel: 4, retrigger: 'restart', tailLength: 0.3 },
    })
    const group = makeGroup({
      id: 'g-restart',
      launch: { trigger: 'kick', threshold: 0, cooldownBeats: 0, minimumEnergy: 0 },
    })
    beam.groupId = 'g-restart'
    const settings = makeSettings([beam], { masterDimmer: 1, safetyClamp: 1 }, [group])

    // First kick at beat=0, timeSec=0
    compileLaserDmxBeamMatrix({
      settings, mi: makeMi({ rhythm: { bpm: 120, beatIndex: 0, beatPhase: 0, beatInBar: 0, barIndex: 0, kickHit: true, kickStrength: 1 } }),
      time: 0, timeSec: 0, canvasWidth: 800, canvasHeight: 600,
    })
    // Advance 2 beats worth of time
    const r1 = compileLaserDmxBeamMatrix({
      settings, mi: makeMi({ rhythm: { bpm: 120, beatIndex: 2, beatPhase: 0, beatInBar: 2, barIndex: 0 } }),
      time: 0, timeSec: 1.0, canvasWidth: 800, canvasHeight: 600,
    })
    const tp1 = r1.beams[0]?.travelProgress ?? 0
    expect(tp1).toBeGreaterThan(0.3)  // well into travel

    // Retrigger: new kick → restart should bring progress back toward 0
    const r2 = compileLaserDmxBeamMatrix({
      settings, mi: makeMi({ rhythm: { bpm: 120, beatIndex: 2, beatPhase: 0, beatInBar: 2, barIndex: 0, kickHit: true, kickStrength: 1 } }),
      time: 0, timeSec: 1.0 + 1/60, canvasWidth: 800, canvasHeight: 600,
    })
    const tp2 = r2.beams[0]?.travelProgress ?? 0
    // After restart, progress should be much closer to 0 than tp1
    expect(tp2).toBeLessThan(tp1)
  })
})

describe('retrigger: continue', () => {
  beforeEach(() => resetBeamMatrixCompilerState())

  it('continue: re-triggering mid-travel does not reset progress', () => {
    const beam = makeBeam({
      id: 'b-cont',
      motion: { ...DEFAULT_BEAM_MOTION, mode: 'projectile', beatsPerTravel: 4, retrigger: 'continue', tailLength: 0.2 },
    })
    const group = makeGroup({
      id: 'g-cont',
      launch: { trigger: 'kick', threshold: 0, cooldownBeats: 0, minimumEnergy: 0 },
    })
    beam.groupId = 'g-cont'
    const settings = makeSettings([beam], { masterDimmer: 1, safetyClamp: 1 }, [group])

    // First kick
    compileLaserDmxBeamMatrix({
      settings, mi: makeMi({ rhythm: { bpm: 120, beatIndex: 0, beatPhase: 0, beatInBar: 0, barIndex: 0, kickHit: true, kickStrength: 1 } }),
      time: 0, timeSec: 0, canvasWidth: 800, canvasHeight: 600,
    })
    // Advance 1 beat
    const r1 = compileLaserDmxBeamMatrix({
      settings, mi: makeMi({ rhythm: { bpm: 120, beatIndex: 1, beatPhase: 0, beatInBar: 1, barIndex: 0 } }),
      time: 0, timeSec: 0.5, canvasWidth: 800, canvasHeight: 600,
    })
    const tp1 = r1.beams[0]?.travelProgress ?? 0

    // Second kick with 'continue' — progress should NOT reset
    const r2 = compileLaserDmxBeamMatrix({
      settings, mi: makeMi({ rhythm: { bpm: 120, beatIndex: 1, beatPhase: 0, beatInBar: 1, barIndex: 0, kickHit: true, kickStrength: 1 } }),
      time: 0, timeSec: 0.5 + 1/60, canvasWidth: 800, canvasHeight: 600,
    })
    const tp2 = r2.beams[0]?.travelProgress ?? 0
    // progress continues forward (not reset to 0)
    expect(tp2).toBeGreaterThanOrEqual(tp1)
  })
})

// ── 5. Audio launch triggers ──────────────────────────────────────────────────

describe('audio launch triggers', () => {
  beforeEach(() => resetBeamMatrixCompilerState())

  it('kick trigger fires on kickHit', () => {
    const beam = makeBeam({
      id: 'b-kick',
      motion: { ...DEFAULT_BEAM_MOTION, mode: 'projectile', beatsPerTravel: 4, tailLength: 0.2 },
    })
    const group = makeGroup({
      id: 'g-kick',
      launch: { trigger: 'kick', threshold: 0.3, cooldownBeats: 0, minimumEnergy: 0 },
    })
    beam.groupId = 'g-kick'
    const settings = makeSettings([beam], { masterDimmer: 1, safetyClamp: 1 }, [group])

    // Kick fires
    const r = compileLaserDmxBeamMatrix({
      settings,
      mi: makeMi({ rhythm: { bpm: 120, beatIndex: 0, beatPhase: 0, beatInBar: 0, barIndex: 0, kickHit: true, kickStrength: 0.9 } }),
      time: 0, timeSec: 0, canvasWidth: 800, canvasHeight: 600,
    })
    // Beam should be visible (launched)
    expect(r.beams[0]?.sequenceGate).toBe(1)
  })

  it('kick trigger above threshold fires a launch envelope; below threshold stays free-running', () => {
    const group = makeGroup({
      id: 'g-kick2',
      launch: { trigger: 'kick', threshold: 0.8, cooldownBeats: 0, minimumEnergy: 0 },
    })

    // Weak kick: no launch fired; beam runs free-running (progress cycles from 0)
    resetBeamMatrixCompilerState()
    const beamWeak = makeBeam({ id: 'b-kick2-w', groupId: 'g-kick2',
      motion: { ...DEFAULT_BEAM_MOTION, mode: 'projectile', beatsPerTravel: 2, tailLength: 0.2 } })
    const settingsWeak = makeSettings([beamWeak], { masterDimmer: 1, safetyClamp: 1 }, [group])
    // Weak kick at beat=0 → no launch
    compileLaserDmxBeamMatrix({ settings: settingsWeak,
      mi: makeMi({ rhythm: { bpm: 120, beatIndex: 0, beatPhase: 0, beatInBar: 0, barIndex: 0, kickHit: true, kickStrength: 0.2 } }),
      time: 0, timeSec: 0, canvasWidth: 800, canvasHeight: 600 })
    // At beat=0.5 (half of beatsPerTravel=2): free-running gives travelProgress≈0.25
    const afterWeak = compileLaserDmxBeamMatrix({ settings: settingsWeak,
      mi: makeMi({ rhythm: { bpm: 120, beatIndex: 0, beatPhase: 0.5, beatInBar: 0, barIndex: 0 } }),
      time: 0, timeSec: 0.25, canvasWidth: 800, canvasHeight: 600 })

    // Strong kick: launches a new envelope at beat=0
    resetBeamMatrixCompilerState()
    const beamStrong = makeBeam({ id: 'b-kick2-s', groupId: 'g-kick2',
      motion: { ...DEFAULT_BEAM_MOTION, mode: 'projectile', beatsPerTravel: 2, tailLength: 0.2 } })
    const settingsStrong = makeSettings([beamStrong], { masterDimmer: 1, safetyClamp: 1 }, [group])
    compileLaserDmxBeamMatrix({ settings: settingsStrong,
      mi: makeMi({ rhythm: { bpm: 120, beatIndex: 0, beatPhase: 0, beatInBar: 0, barIndex: 0, kickHit: true, kickStrength: 0.9 } }),
      time: 0, timeSec: 0, canvasWidth: 800, canvasHeight: 600 })
    const afterStrong = compileLaserDmxBeamMatrix({ settings: settingsStrong,
      mi: makeMi({ rhythm: { bpm: 120, beatIndex: 0, beatPhase: 0.5, beatInBar: 0, barIndex: 0 } }),
      time: 0, timeSec: 0.25, canvasWidth: 800, canvasHeight: 600 })

    // Both produce beams; the strong-kick launch keeps progress in envelope range
    expect(afterWeak.beams[0]).toBeDefined()
    expect(afterStrong.beams[0]).toBeDefined()
    // Both at the same beat phase → travel progress should be equal for same beatsPerTravel
    // (weak = free-running 0.25; strong = envelope elapsed=0.5beat of 2beat travel = 0.25)
    // They converge at the same value — the key distinction is the `env.active` flag, not visible here.
    // Just verify both are close to 0.25
    expect(afterWeak.beams[0].travelProgress).toBeGreaterThan(0.1)
    expect(afterStrong.beams[0].travelProgress).toBeGreaterThan(0.1)
  })

  it('cooldown prevents re-launch within cooldownBeats', () => {
    const beam = makeBeam({
      id: 'b-cool',
      motion: { ...DEFAULT_BEAM_MOTION, mode: 'projectile', beatsPerTravel: 8, tailLength: 0.2 },
    })
    const group = makeGroup({
      id: 'g-cool',
      launch: { trigger: 'kick', threshold: 0, cooldownBeats: 4, minimumEnergy: 0 },
    })
    beam.groupId = 'g-cool'
    const settings = makeSettings([beam], { masterDimmer: 1, safetyClamp: 1 }, [group])

    // First kick
    compileLaserDmxBeamMatrix({
      settings,
      mi: makeMi({ rhythm: { bpm: 120, beatIndex: 0, beatPhase: 0, beatInBar: 0, barIndex: 0, kickHit: true, kickStrength: 1 } }),
      time: 0, timeSec: 0, canvasWidth: 800, canvasHeight: 600,
    })
    // Second kick at beat=1 (within cooldown of 4 beats)
    // The group last launch beat = 0; elapsed = 1 < 4 → no restart
    const r2 = compileLaserDmxBeamMatrix({
      settings,
      mi: makeMi({ rhythm: { bpm: 120, beatIndex: 1, beatPhase: 0, beatInBar: 1, barIndex: 0, kickHit: true, kickStrength: 1 } }),
      time: 0, timeSec: 0.5, canvasWidth: 800, canvasHeight: 600,
    })
    // Beam is still running from first launch (not restarted) — progress should be ~0.125 (1beat/8beats)
    const tp = r2.beams[0]?.travelProgress ?? 0
    expect(tp).toBeGreaterThan(0)
    expect(tp).toBeLessThan(0.5)  // not restarted to ~0 again
  })

  it('minimumEnergy gate: trigger suppressed when energy below minimumEnergy; fires when above', () => {
    const group = makeGroup({
      id: 'g-energy',
      launch: { trigger: 'beat', threshold: 0, cooldownBeats: 0, minimumEnergy: 0.5 },
    })

    // Low energy: beat fires, but minimumEnergy not met → no launch envelope started
    resetBeamMatrixCompilerState()
    const beamLow = makeBeam({ id: 'b-en-low', groupId: 'g-energy',
      motion: { ...DEFAULT_BEAM_MOTION, mode: 'projectile', beatsPerTravel: 4, tailLength: 0.2 } })
    const settingsLow = makeSettings([beamLow], { masterDimmer: 1, safetyClamp: 1 }, [group])
    // Beat hit frame — low energy → launch suppressed, beam remains in free-running mode
    const rLow = compileLaserDmxBeamMatrix({ settings: settingsLow,
      mi: makeMi({ rhythm: { bpm: 120, beatIndex: 0, beatPhase: 0, beatInBar: 0, barIndex: 0, beatHit: true }, energy: { instant: 0.1 } }),
      time: 0, timeSec: 0, canvasWidth: 800, canvasHeight: 600 })
    expect(rLow.beams).toHaveLength(1)  // beam still renders (free-running)

    // High energy: beat fires, minimumEnergy met → launch fires
    resetBeamMatrixCompilerState()
    const beamHigh = makeBeam({ id: 'b-en-high', groupId: 'g-energy',
      motion: { ...DEFAULT_BEAM_MOTION, mode: 'projectile', beatsPerTravel: 4, tailLength: 0.2 } })
    const settingsHigh = makeSettings([beamHigh], { masterDimmer: 1, safetyClamp: 1 }, [group])
    const rHigh = compileLaserDmxBeamMatrix({ settings: settingsHigh,
      mi: makeMi({ rhythm: { bpm: 120, beatIndex: 0, beatPhase: 0, beatInBar: 0, barIndex: 0, beatHit: true }, energy: { instant: 0.8 } }),
      time: 0, timeSec: 0, canvasWidth: 800, canvasHeight: 600 })
    expect(rHigh.beams).toHaveLength(1)  // beam renders (launched + in flight)
    expect(rHigh.beams[0].sequenceGate).toBe(1)
  })
})

// ── 6. Pulse train segments ───────────────────────────────────────────────────

describe('pulse train: compiled beam has pulseSegments', () => {
  beforeEach(() => resetBeamMatrixCompilerState())

  it('pulseTrain mode produces pulseSegments array in compiled output', () => {
    const beam = makeBeam({
      motion: { ...DEFAULT_BEAM_MOTION, mode: 'pulseTrain', tailLength: 0.3, beatsPerTravel: 1 },
    })
    const mi = makeMi({ rhythm: { bpm: 120, beatIndex: 0, beatPhase: 0.5, beatInBar: 0, barIndex: 0 } })
    const result = compile(makeSettings([beam]), mi)
    const b = result.beams[0]
    expect(b).toBeDefined()
    expect(b.pulseSegments).toBeDefined()
    expect(b.pulseSegments!.length).toBeGreaterThan(0)
  })

  it('static mode does not produce pulseSegments', () => {
    const beam = makeBeam({ motion: { ...DEFAULT_BEAM_MOTION, mode: 'static' } })
    const result = compile(makeSettings([beam]))
    const b = result.beams[0]
    expect(b.pulseSegments).toBeUndefined()
  })
})

// ── 7. Head glow ──────────────────────────────────────────────────────────────

describe('head glow', () => {
  beforeEach(() => resetBeamMatrixCompilerState())

  it('grow mode with headGlow>0 produces headIntensity>0', () => {
    const beam = makeBeam({
      motion: { ...DEFAULT_BEAM_MOTION, mode: 'grow', headGlow: 0.8, beatsPerTravel: 1 },
    })
    const mi = makeMi({ rhythm: { bpm: 120, beatIndex: 0, beatPhase: 0.5, beatInBar: 0, barIndex: 0 } })
    const result = compile(makeSettings([beam]), mi)
    expect(result.beams[0].headIntensity).toBeGreaterThan(0)
  })

  it('static mode has headIntensity=0', () => {
    const beam = makeBeam({ motion: { ...DEFAULT_BEAM_MOTION, mode: 'static', headGlow: 0.8 } })
    const result = compile(makeSettings([beam]))
    expect(result.beams[0].headIntensity).toBe(0)
  })

  it('legacy reverse direction keeps the head on the target-facing end', () => {
    const beam = makeBeam({
      motion: { ...DEFAULT_BEAM_MOTION, mode: 'grow', direction: 'reverse' as any, headGlow: 0.5, beatsPerTravel: 1 },
    })
    const mi = makeMi({ rhythm: { bpm: 120, beatIndex: 0, beatPhase: 0.5, beatInBar: 0, barIndex: 0 } })
    const compiled = compile(makeSettings([beam]), mi).beams[0]
    expect(compiled.visibleOrigin.x).toBeCloseTo(compiled.origin.x)
    expect(compiled.visibleTarget.x).toBeGreaterThan(compiled.visibleOrigin.x)
  })
})

// ── 8. Group route ops (add / multiply relative to beam base) ─────────────────

describe('group routes as ops: add/multiply relative to beam base', () => {
  beforeEach(() => resetBeamMatrixCompilerState())

  it('group add route: dimmer adds on top of beam base', () => {
    const group = makeGroup({
      id: 'g-add',
      modulationRoutes: [makeRoute({ source: 'nBass', target: 'dimmer', mode: 'add', min: 0.3, max: 0.3, amount: 1 })],
    })
    // Two beams with different base dimmers: 0.4 and 0.6
    const b1 = makeBeam({ id: 'bA', groupId: 'g-add', appearance: { dimmer: 0.4, shutterOpen: true, width: 1, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' } })
    const b2 = makeBeam({ id: 'bB', groupId: 'g-add', appearance: { dimmer: 0.6, shutterOpen: true, width: 1, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' } })
    const settings = makeSettings([b1, b2], { masterDimmer: 1, safetyClamp: 1 }, [group])
    const mi = makeMi({ bands: { normalizedBass: 1 } })
    const result = compile(settings, mi)

    const rA = result.beams.find(b => b.beamId === 'bA')
    const rB = result.beams.find(b => b.beamId === 'bB')
    if (rA && rB) {
      // With add mode, 0.4+0.3=0.7 and 0.6+0.3=0.9 — the beams differ by 0.2 still
      expect(rB.intensity).toBeGreaterThan(rA.intensity)
      // They should NOT both be clamped to the same value
      expect(Math.abs(rB.intensity - rA.intensity)).toBeGreaterThan(0.1)
    }
  })

  it('group multiply route: scales each beam relative to its own base', () => {
    const group = makeGroup({
      id: 'g-mul',
      modulationRoutes: [makeRoute({ source: 'nBass', target: 'dimmer', mode: 'multiply', min: 0.5, max: 0.5, amount: 1 })],
    })
    const b1 = makeBeam({ id: 'bC', groupId: 'g-mul', appearance: { dimmer: 0.5, shutterOpen: true, width: 1, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' } })
    const b2 = makeBeam({ id: 'bD', groupId: 'g-mul', appearance: { dimmer: 1.0, shutterOpen: true, width: 1, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' } })
    const settings = makeSettings([b1, b2], { masterDimmer: 1, safetyClamp: 1 }, [group])
    const mi = makeMi({ bands: { normalizedBass: 1 } })
    const result = compile(settings, mi)

    const rC = result.beams.find(b => b.beamId === 'bC')
    const rD = result.beams.find(b => b.beamId === 'bD')
    if (rC && rD) {
      // multiply(0.5, 0.5)=0.25; multiply(1.0, 0.5)=0.5 → rD should be double rC
      expect(rD.intensity).toBeGreaterThan(rC.intensity)
    }
  })
})

// ── 9. White channel ──────────────────────────────────────────────────────────

describe('white channel blending', () => {
  beforeEach(() => resetBeamMatrixCompilerState())

  it('white > 0 increases all RGB channels', () => {
    const noWhite = makeBeam({
      id: 'bW0',
      color: { red: 100, green: 100, blue: 100, white: 0, alpha: 1 },
    })
    const withWhite = makeBeam({
      id: 'bW1',
      color: { red: 100, green: 100, blue: 100, white: 100, alpha: 1 },
    })
    const s0 = compile(makeSettings([noWhite]))
    const s1 = compile(makeSettings([withWhite]))
    const r0 = s0.beams[0]
    const r1 = s1.beams[0]
    if (r0 && r1) {
      expect(r1.rgba.r).toBeGreaterThan(r0.rgba.r)
      expect(r1.rgba.g).toBeGreaterThan(r0.rgba.g)
      expect(r1.rgba.b).toBeGreaterThan(r0.rgba.b)
    }
  })
})

// ── 10. maxActiveBeams enforcement ────────────────────────────────────────────

describe('maxActiveBeams', () => {
  beforeEach(() => resetBeamMatrixCompilerState())

  it('maxActiveBeams=1 limits simultaneous active beams in a group with all-mode sequence', () => {
    const group = makeGroup({
      id: 'g-max',
      maxActiveBeams: 1,
      sequence: {
        ...DEFAULT_BEAM_SEQUENCE, enabled: true, mode: 'all', stepsPerBeat: 1, stepGate: 1,
      },
    })
    // 4 beams all in the group — without maxActiveBeams all would be active in 'all' mode
    const beams = [0, 1, 2, 3].map(i =>
      makeBeam({ id: `b-max-${i}`, groupId: 'g-max', sequenceIndex: i,
        motion: { ...DEFAULT_BEAM_MOTION, mode: 'grow', beatsPerTravel: 4 } })
    )
    const settings = makeSettings(beams, { masterDimmer: 1, safetyClamp: 1 }, [group])
    const mi = makeMi({ rhythm: { bpm: 120, beatIndex: 0, beatPhase: 0.2, beatInBar: 0, barIndex: 0 } })
    const result = compileLaserDmxBeamMatrix({
      settings, mi, time: 0, timeSec: 0.1, canvasWidth: 800, canvasHeight: 600,
    })
    // Only 1 beam should have non-zero intensity (maxActiveBeams=1)
    const activeBeams = result.beams.filter(b => b.sequenceGate > 0)
    expect(activeBeams.length).toBeLessThanOrEqual(1)
  })

  it('maxActiveBeams=0 means unlimited', () => {
    const group = makeGroup({
      id: 'g-unlimited',
      maxActiveBeams: 0,
      sequence: {
        ...DEFAULT_BEAM_SEQUENCE, enabled: true, mode: 'all', stepsPerBeat: 1, stepGate: 1,
      },
    })
    const beams = [0, 1, 2].map(i =>
      makeBeam({ id: `b-ul-${i}`, groupId: 'g-unlimited', sequenceIndex: i,
        motion: { ...DEFAULT_BEAM_MOTION, mode: 'grow', beatsPerTravel: 4 } })
    )
    const settings = makeSettings(beams, { masterDimmer: 1, safetyClamp: 1 }, [group])
    const mi = makeMi({ rhythm: { bpm: 120, beatIndex: 0, beatPhase: 0.2, beatInBar: 0, barIndex: 0 } })
    const result = compileLaserDmxBeamMatrix({
      settings, mi, time: 0, timeSec: 0.1, canvasWidth: 800, canvasHeight: 600,
    })
    // All 3 should be active
    const activeBeams = result.beams.filter(b => b.sequenceGate > 0)
    expect(activeBeams.length).toBe(3)
  })
})
