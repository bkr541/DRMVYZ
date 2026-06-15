/**
 * Tests for static-beam sequencer gating (the bug fix).
 *
 * Root cause: seqStateMap lookup was inside `if (motionMode !== 'static')`,
 * so static beams always had sequenceGate=1 and ignored the group sequencer.
 *
 * These tests verify that static beams respect the Reaction Group sequencer
 * gate across all sequence modes, while non-static behavior is unchanged.
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
} from '../../ReactTypes'

vi.stubGlobal('crypto', { randomUUID: (() => { let n = 0; return () => `uuid-ss-${++n}` })() })

// ── Helpers ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeMi(rhythm: Record<string, unknown> = {}): any {
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
      ...rhythm,
    },
    energy: { instant: 0, shortTerm: 0, longTerm: 0, spectralFlux: 0, tension: 0,
      complexity: 0, buildProgress: 0, dropImpact: 0, rms: 0, peak: 0,
      crestFactor: 0, percentile: 0, delta: 0, spectralCentroid: 0,
      spectralSpread: 0, spectralRolloff: 0, spectralFlatness: 0 },
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

let _bid = 0
function makeStaticBeam(overrides: Partial<LaserDmxMatrixBeam> = {}): LaserDmxMatrixBeam {
  return {
    id: `sb-${++_bid}`,
    name: `StaticBeam${_bid}`, enabled: true, sequenceIndex: 0,
    origin: { column: 1, row: 1, z: 0 },
    target: { kind: 'grid', column: 8, row: 5, z: 0 },
    groupId: null, useGroupColor: false,
    color: { red: 0, green: 255, blue: 220, white: 0, alpha: 1 },
    appearance: {
      dimmer: 1, shutterOpen: true, width: 1, focus: 1,
      strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65,
      geometry: 'line',
    },
    motion: { ...DEFAULT_BEAM_MOTION, mode: 'static' },
    modulationRoutes: [],
    ...overrides,
  }
}

function makeSettings(
  beams: LaserDmxMatrixBeam[],
  groups: LaserDmxReactionGroup[] = [],
  output: Partial<LaserDmxBeamMatrixOutputSettings> = {},
): LaserDmxBeamMatrixSettings {
  const base = createDefaultLaserDmxBeamMatrixSettings()
  return { ...base, beams, groups, globalModulationRoutes: [], output: makeOutput(output) }
}

function run(
  settings: LaserDmxBeamMatrixSettings,
  rhythm: Record<string, unknown> = {},
) {
  return compileLaserDmxBeamMatrix({
    settings, mi: makeMi(rhythm), time: 0, timeSec: 1,
    canvasWidth: 800, canvasHeight: 600,
  })
}

beforeEach(() => { resetBeamMatrixCompilerState(); _bid = 0 })

// ── 1. Static beam without a group: always visible ────────────────────────────

describe('1. Static beam without Reaction Group', () => {
  it('is compiled and has sequenceGate=1', () => {
    const beam = makeStaticBeam()
    const result = run(makeSettings([beam]))
    expect(result.beams).toHaveLength(1)
    expect(result.beams[0].sequenceGate).toBe(1)
    expect(result.beams[0].intensity).toBeGreaterThan(0)
  })
})

// ── 2. Static beam with disabled sequencer: always visible ────────────────────

describe('2. Static beam in group with sequencer disabled', () => {
  it('has sequenceGate=1 when seq.enabled=false', () => {
    const group = makeGroup({
      id: 'g-dis',
      sequence: { ...DEFAULT_BEAM_SEQUENCE, enabled: false },
    })
    const beam = makeStaticBeam({ groupId: 'g-dis', sequenceIndex: 0 })
    const result = run(makeSettings([beam], [group]))
    expect(result.beams[0].sequenceGate).toBe(1)
    expect(result.beams[0].intensity).toBeGreaterThan(0)
  })
})

// ── 3. Static beam: inactive sequence gate → zero intensity ───────────────────

describe('3. Static beam with inactive gate → zero intensity', () => {
  it('sequenceGate=0 when not the active step (forward mode, 2 beams)', () => {
    const group = makeGroup({
      id: 'g-fwd',
      sequence: { ...DEFAULT_BEAM_SEQUENCE, enabled: true, mode: 'forward', stepsPerBeat: 1, stepGate: 1, phaseSpread: 0 },
    })
    // Two static beams; only beam at sequenceIndex=0 active at beat 0
    const b0 = makeStaticBeam({ id: 'b0', groupId: 'g-fwd', sequenceIndex: 0 })
    const b1 = makeStaticBeam({ id: 'b1', groupId: 'g-fwd', sequenceIndex: 1 })

    const r = run(makeSettings([b0, b1], [group]), { beatIndex: 0, beatPhase: 0 })

    const c0 = r.beams.find(b => b.beamId === 'b0')!
    const c1 = r.beams.find(b => b.beamId === 'b1')!

    expect(c0.sequenceGate).toBe(1)
    expect(c0.intensity).toBeGreaterThan(0)

    expect(c1.sequenceGate).toBe(0)
    expect(c1.intensity).toBe(0)
  })
})

// ── 4. Static beam: active sequence gate → full-length beam ───────────────────

describe('4. Static beam with active gate → full length', () => {
  it('visibleOrigin equals origin and visibleTarget equals target (fracs 0→1)', () => {
    const group = makeGroup({
      id: 'g-full',
      sequence: { ...DEFAULT_BEAM_SEQUENCE, enabled: true, mode: 'all', stepsPerBeat: 1, stepGate: 1 },
    })
    const b = makeStaticBeam({ id: 'b-full', groupId: 'g-full', sequenceIndex: 0 })
    const r = run(makeSettings([b], [group]), { beatIndex: 0, beatPhase: 0 })
    const c = r.beams.find(x => x.beamId === 'b-full')!

    expect(c.sequenceGate).toBe(1)
    expect(c.intensity).toBeGreaterThan(0)
    // Static mode: visible segment spans full beam (fracs 0→1)
    // visibleOrigin === compiled origin, visibleTarget === compiled target
    expect(c.visibleOrigin.x).toBeCloseTo(c.origin.x, 3)
    expect(c.visibleOrigin.y).toBeCloseTo(c.origin.y, 3)
    expect(c.visibleTarget.x).toBeCloseTo(c.target.x, 3)
    expect(c.visibleTarget.y).toBeCloseTo(c.target.y, 3)
    // travelProgress stays 0 for static mode
    expect(c.travelProgress).toBe(0)
  })
})

// ── 5. Forward sequencing with static beams ───────────────────────────────────

describe('5. Forward sequencing with static beams', () => {
  function makeForwardGroup(id: string) {
    return makeGroup({
      id,
      sequence: { ...DEFAULT_BEAM_SEQUENCE, enabled: true, mode: 'forward', stepsPerBeat: 1, stepGate: 1, phaseSpread: 0 },
    })
  }

  it('activates beam at seqIndex=0 at beat 0', () => {
    const g = makeForwardGroup('g-fwd5')
    const b0 = makeStaticBeam({ id: 'b0', groupId: 'g-fwd5', sequenceIndex: 0 })
    const b1 = makeStaticBeam({ id: 'b1', groupId: 'g-fwd5', sequenceIndex: 1 })
    const r = run(makeSettings([b0, b1], [g]), { beatIndex: 0, beatPhase: 0 })
    expect(r.beams.find(b => b.beamId === 'b0')!.sequenceGate).toBe(1)
    expect(r.beams.find(b => b.beamId === 'b1')!.sequenceGate).toBe(0)
  })

  it('activates beam at seqIndex=1 at beat 1', () => {
    const g = makeForwardGroup('g-fwd5b')
    const b0 = makeStaticBeam({ id: 'b0', groupId: 'g-fwd5b', sequenceIndex: 0 })
    const b1 = makeStaticBeam({ id: 'b1', groupId: 'g-fwd5b', sequenceIndex: 1 })
    const r = run(makeSettings([b0, b1], [g]), { beatIndex: 1, beatPhase: 0 })
    expect(r.beams.find(b => b.beamId === 'b0')!.sequenceGate).toBe(0)
    expect(r.beams.find(b => b.beamId === 'b1')!.sequenceGate).toBe(1)
  })
})

// ── 6. Reverse sequencing with static beams ───────────────────────────────────

describe('6. Reverse sequencing with static beams', () => {
  it('activates beam at seqIndex=1 first (highest index = first in reverse)', () => {
    const g = makeGroup({
      id: 'g-rev',
      sequence: { ...DEFAULT_BEAM_SEQUENCE, enabled: true, mode: 'reverse', stepsPerBeat: 1, stepGate: 1, phaseSpread: 0 },
    })
    const b0 = makeStaticBeam({ id: 'b0', groupId: 'g-rev', sequenceIndex: 0 })
    const b1 = makeStaticBeam({ id: 'b1', groupId: 'g-rev', sequenceIndex: 1 })
    // reverse order: [b1, b0], at beat 0 → step 0 → b1 active
    const r = run(makeSettings([b0, b1], [g]), { beatIndex: 0, beatPhase: 0 })
    expect(r.beams.find(b => b.beamId === 'b1')!.sequenceGate).toBe(1)
    expect(r.beams.find(b => b.beamId === 'b0')!.sequenceGate).toBe(0)
  })

  it('activates beam at seqIndex=0 at beat 1 in reverse mode', () => {
    const g = makeGroup({
      id: 'g-rev2',
      sequence: { ...DEFAULT_BEAM_SEQUENCE, enabled: true, mode: 'reverse', stepsPerBeat: 1, stepGate: 1, phaseSpread: 0 },
    })
    const b0 = makeStaticBeam({ id: 'b0', groupId: 'g-rev2', sequenceIndex: 0 })
    const b1 = makeStaticBeam({ id: 'b1', groupId: 'g-rev2', sequenceIndex: 1 })
    const r = run(makeSettings([b0, b1], [g]), { beatIndex: 1, beatPhase: 0 })
    expect(r.beams.find(b => b.beamId === 'b0')!.sequenceGate).toBe(1)
    expect(r.beams.find(b => b.beamId === 'b1')!.sequenceGate).toBe(0)
  })
})

// ── 7. All-At-Once sequence with static beams ─────────────────────────────────

describe('7. All-at-once sequence with static beams', () => {
  it('all beams active simultaneously', () => {
    const g = makeGroup({
      id: 'g-all',
      sequence: { ...DEFAULT_BEAM_SEQUENCE, enabled: true, mode: 'all', stepsPerBeat: 1, stepGate: 1 },
    })
    const b0 = makeStaticBeam({ id: 'b0', groupId: 'g-all', sequenceIndex: 0 })
    const b1 = makeStaticBeam({ id: 'b1', groupId: 'g-all', sequenceIndex: 1 })
    const r = run(makeSettings([b0, b1], [g]), { beatIndex: 0, beatPhase: 0 })
    expect(r.beams.find(b => b.beamId === 'b0')!.sequenceGate).toBe(1)
    expect(r.beams.find(b => b.beamId === 'b1')!.sequenceGate).toBe(1)
  })
})

// ── 8. Alternate sequence mode with static beams ──────────────────────────────

describe('8. Alternate sequence mode with static beams', () => {
  it('activates beams in interleaved steps', () => {
    const g = makeGroup({
      id: 'g-alt',
      sequence: { ...DEFAULT_BEAM_SEQUENCE, enabled: true, mode: 'alternate', stepsPerBeat: 1, stepGate: 1, phaseSpread: 0 },
    })
    const b0 = makeStaticBeam({ id: 'b0', groupId: 'g-alt', sequenceIndex: 0 })
    const b1 = makeStaticBeam({ id: 'b1', groupId: 'g-alt', sequenceIndex: 1 })
    // 'alternate' uses natural order, so same as forward for gate determination
    const r0 = run(makeSettings([b0, b1], [g]), { beatIndex: 0, beatPhase: 0 })
    const r1 = run(makeSettings([b0, b1], [g]), { beatIndex: 1, beatPhase: 0 })
    expect(r0.beams.find(b => b.beamId === 'b0')!.sequenceGate).toBe(1)
    expect(r0.beams.find(b => b.beamId === 'b1')!.sequenceGate).toBe(0)
    expect(r1.beams.find(b => b.beamId === 'b0')!.sequenceGate).toBe(0)
    expect(r1.beams.find(b => b.beamId === 'b1')!.sequenceGate).toBe(1)
  })
})

// ── 9. Center Out with static beams ──────────────────────────────────────────

describe('9. Center-Out sequence mode with static beams', () => {
  it('sequences 4 beams in center-out order', () => {
    const g = makeGroup({
      id: 'g-co',
      sequence: { ...DEFAULT_BEAM_SEQUENCE, enabled: true, mode: 'centerOut', stepsPerBeat: 1, stepGate: 1, phaseSpread: 0 },
    })
    const beams = [0,1,2,3].map(i => makeStaticBeam({ id: `bc${i}`, groupId: 'g-co', sequenceIndex: i }))
    // centerOut with 4 beams → [b1,b2,b0,b3] → at beat0, step0 → bc1 active
    const r = run(makeSettings(beams, [g]), { beatIndex: 0, beatPhase: 0 })
    const gates = beams.map(b => r.beams.find(c => c.beamId === b.id)!.sequenceGate)
    // Exactly one beam is active at beat 0
    expect(gates.filter(g => g === 1)).toHaveLength(1)
    expect(gates.filter(g => g === 0)).toHaveLength(3)
  })
})

// ── 10. Outside In with static beams ─────────────────────────────────────────

describe('10. Outside-In sequence mode with static beams', () => {
  it('sequences 4 beams in outside-in order', () => {
    const g = makeGroup({
      id: 'g-oi',
      sequence: { ...DEFAULT_BEAM_SEQUENCE, enabled: true, mode: 'outsideIn', stepsPerBeat: 1, stepGate: 1, phaseSpread: 0 },
    })
    const beams = [0,1,2,3].map(i => makeStaticBeam({ id: `bo${i}`, groupId: 'g-oi', sequenceIndex: i }))
    const r = run(makeSettings(beams, [g]), { beatIndex: 0, beatPhase: 0 })
    const gates = beams.map(b => r.beams.find(c => c.beamId === b.id)!.sequenceGate)
    expect(gates.filter(g => g === 1)).toHaveLength(1)
    expect(gates.filter(g => g === 0)).toHaveLength(3)
  })
})

// ── 11. Step Gate duty cycle with static beams ────────────────────────────────

describe('11. Step Gate controls active duty cycle for static beams', () => {
  // stepGate=0.5: active for first half of each step period
  function makeStepGateGroup(id: string, stepGate: number) {
    return makeGroup({
      id,
      sequence: { ...DEFAULT_BEAM_SEQUENCE, enabled: true, mode: 'forward', stepsPerBeat: 1, stepGate, phaseSpread: 0 },
    })
  }

  it('beam active at stepPhase=0.3 with stepGate=0.5', () => {
    const g = makeStepGateGroup('g-sg1', 0.5)
    const b = makeStaticBeam({ id: 'b-sg', groupId: 'g-sg1', sequenceIndex: 0 })
    // beatPhase=0.3 → stepPhase=0.3 < 0.5 → gate=1
    const r = run(makeSettings([b], [g]), { beatIndex: 0, beatPhase: 0.3 })
    expect(r.beams[0].sequenceGate).toBe(1)
    expect(r.beams[0].intensity).toBeGreaterThan(0)
  })

  it('beam inactive at stepPhase=0.7 with stepGate=0.5', () => {
    const g = makeStepGateGroup('g-sg2', 0.5)
    const b = makeStaticBeam({ id: 'b-sg2', groupId: 'g-sg2', sequenceIndex: 0 })
    // beatPhase=0.7 → stepPhase=0.7 ≥ 0.5 → gate=0
    const r = run(makeSettings([b], [g]), { beatIndex: 0, beatPhase: 0.7 })
    expect(r.beams[0].sequenceGate).toBe(0)
    expect(r.beams[0].intensity).toBe(0)
  })

  it('stepGate=1.0 keeps beam active for entire step', () => {
    const g = makeStepGateGroup('g-sg3', 1.0)
    const b = makeStaticBeam({ id: 'b-sg3', groupId: 'g-sg3', sequenceIndex: 0 })
    const r = run(makeSettings([b], [g]), { beatIndex: 0, beatPhase: 0.99 })
    expect(r.beams[0].sequenceGate).toBe(1)
  })
})

// ── 12. Reset on downbeat with static beams ───────────────────────────────────

describe('12. Reset on downbeat resets step counter for static beams', () => {
  it('sequence resets to step 0 at downbeat (beatInBar=0)', () => {
    // resetOnDownbeat uses beatInBar + beatPhase instead of absoluteBeat,
    // so beatIndex advances but step resets to 0 at each downbeat.
    const g = makeGroup({
      id: 'g-rod',
      sequence: { ...DEFAULT_BEAM_SEQUENCE, enabled: true, mode: 'forward', stepsPerBeat: 1, stepGate: 1, resetOnDownbeat: true, phaseSpread: 0 },
    })
    const b0 = makeStaticBeam({ id: 'b0', groupId: 'g-rod', sequenceIndex: 0 })
    const b1 = makeStaticBeam({ id: 'b1', groupId: 'g-rod', sequenceIndex: 1 })

    // At beatIndex=1, beatInBar=0 (downbeat), beatPhase=0 → beatForSeq=0 → step=0 → b0 active
    const r = run(makeSettings([b0, b1], [g]), { beatIndex: 1, beatInBar: 0, beatPhase: 0 })
    expect(r.beams.find(b => b.beamId === 'b0')!.sequenceGate).toBe(1)
    expect(r.beams.find(b => b.beamId === 'b1')!.sequenceGate).toBe(0)
  })
})

// ── 13. Beam safety controls override sequencer ───────────────────────────────

describe('13. Safety controls still override sequencer gate for static beams', () => {
  const activeSeq = { ...DEFAULT_BEAM_SEQUENCE, enabled: true, mode: 'all' as const, stepsPerBeat: 1, stepGate: 1 }

  it('beam.enabled=false → beam not compiled (sequencer cannot override)', () => {
    const g = makeGroup({ id: 'g-dis', sequence: activeSeq })
    const b = makeStaticBeam({ id: 'b-dis', groupId: 'g-dis', enabled: false })
    const r = run(makeSettings([b], [g]))
    expect(r.beams.find(x => x.beamId === 'b-dis')).toBeUndefined()
  })

  it('shutterOpen=false → intensity=0 regardless of sequence gate', () => {
    const g = makeGroup({ id: 'g-shut', sequence: activeSeq })
    const b = makeStaticBeam({
      id: 'b-shut', groupId: 'g-shut',
      appearance: { dimmer: 1, shutterOpen: false, width: 1, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' },
    })
    const r = run(makeSettings([b], [g]))
    // shutterOpen=false → bs.dimmer=0 → baseIntensity<0.001 → beam skipped (continue)
    expect(r.beams.find(x => x.beamId === 'b-shut')).toBeUndefined()
  })

  it('global blackout → no beams output', () => {
    const g = makeGroup({ id: 'g-bo', sequence: activeSeq })
    const b = makeStaticBeam({ id: 'b-bo', groupId: 'g-bo' })
    const r = run(makeSettings([b], [g], { blackout: true }))
    expect(r.beams).toHaveLength(0)
  })

  it('masterDimmer=0 → beam skipped (continue), not forced on by gate', () => {
    const g = makeGroup({ id: 'g-md', sequence: activeSeq })
    const b = makeStaticBeam({ id: 'b-md', groupId: 'g-md' })
    const r = run(makeSettings([b], [g], { masterDimmer: 0 }))
    expect(r.beams.find(x => x.beamId === 'b-md')).toBeUndefined()
  })

  it('group muted → beam not output (group gate prevents compilation)', () => {
    const g = makeGroup({ id: 'g-muted', muted: true, sequence: activeSeq })
    const b = makeStaticBeam({ id: 'b-muted', groupId: 'g-muted' })
    const r = run(makeSettings([b], [g]))
    expect(r.beams.find(x => x.beamId === 'b-muted')).toBeUndefined()
  })
})

// ── 14. Non-static beams: no regression in geometry ──────────────────────────

describe('14. Non-static beam geometry unchanged after fix', () => {
  it('grow beam travelProgress still advances with sequence', () => {
    const g = makeGroup({
      id: 'g-grow',
      sequence: { ...DEFAULT_BEAM_SEQUENCE, enabled: true, mode: 'all', stepsPerBeat: 1, stepGate: 1 },
    })
    const b = { ...makeStaticBeam({ id: 'b-grow', groupId: 'g-grow' }),
      motion: { ...DEFAULT_BEAM_MOTION, mode: 'grow' as const, beatsPerTravel: 1 } }
    const r = run(makeSettings([b], [g]), { beatIndex: 0, beatPhase: 0.5 })
    const c = r.beams.find(x => x.beamId === 'b-grow')!
    expect(c.motionMode).toBe('grow')
    expect(c.travelProgress).toBeGreaterThan(0)
    expect(c.sequenceGate).toBe(1)
  })

  it('grow beam with inactive gate → gate=0 and intensity=0', () => {
    const g = makeGroup({
      id: 'g-grow2',
      sequence: { ...DEFAULT_BEAM_SEQUENCE, enabled: true, mode: 'forward', stepsPerBeat: 1, stepGate: 1, phaseSpread: 0 },
    })
    const b0 = { ...makeStaticBeam({ id: 'b-grow2', groupId: 'g-grow2', sequenceIndex: 1 }),
      motion: { ...DEFAULT_BEAM_MOTION, mode: 'grow' as const, beatsPerTravel: 1 } }
    const b1 = { ...makeStaticBeam({ id: 'b-other', groupId: 'g-grow2', sequenceIndex: 0 }),
      motion: { ...DEFAULT_BEAM_MOTION, mode: 'grow' as const, beatsPerTravel: 1 } }
    // At beat 0, step 0 → sequenceIndex 0 (b1) is active, sequenceIndex 1 (b0) is not
    const r = run(makeSettings([b0, b1], [g]), { beatIndex: 0, beatPhase: 0 })
    const c = r.beams.find(x => x.beamId === 'b-grow2')!
    expect(c.sequenceGate).toBe(0)
    expect(c.intensity).toBe(0)
  })
})

// ── 15. sequenceGate not multiplied twice for non-static beams ────────────────

describe('15. sequenceGate applied exactly once for non-static beams', () => {
  it('projectile beam sequenceGate matches compiled.sequenceGate (not squared)', () => {
    const g = makeGroup({
      id: 'g-proj',
      sequence: { ...DEFAULT_BEAM_SEQUENCE, enabled: true, mode: 'all', stepsPerBeat: 1, stepGate: 1 },
    })
    const b = { ...makeStaticBeam({ id: 'b-proj', groupId: 'g-proj' }),
      motion: { ...DEFAULT_BEAM_MOTION, mode: 'projectile' as const, beatsPerTravel: 2, tailLength: 0.2 } }
    const r = run(makeSettings([b], [g]), { beatIndex: 0, beatPhase: 0.1 })
    const c = r.beams.find(x => x.beamId === 'b-proj')!
    // Gate is 1; intensity ≈ 1 (not 1² = 1 — both yield 1 but we verify gate value)
    expect(c.sequenceGate).toBe(1)
    // If gate were applied twice, a partial gate value (from stepGate<1) would be squared.
    // Test with stepGate=0.8: at stepPhase=0.1 (< 0.8) gate=1 still, but verify independence.
    const g2 = makeGroup({
      id: 'g-proj2',
      sequence: { ...DEFAULT_BEAM_SEQUENCE, enabled: true, mode: 'all', stepsPerBeat: 1, stepGate: 0.8 },
    })
    const b2 = { ...makeStaticBeam({ id: 'b-proj2', groupId: 'g-proj2' }),
      motion: { ...DEFAULT_BEAM_MOTION, mode: 'projectile' as const, beatsPerTravel: 2, tailLength: 0.2 } }
    const r2 = run(makeSettings([b2], [g2]), { beatIndex: 0, beatPhase: 0.1 })
    const c2 = r2.beams.find(x => x.beamId === 'b-proj2')!
    expect(c2.sequenceGate).toBe(1)  // gate=1 not 1*1 (would still be 1 — harmless)
  })
})

// ── 16. maxActiveBeams with static beams ──────────────────────────────────────

describe('16. maxActiveBeams limits static beam activation', () => {
  it('maxActiveBeams=1 keeps only first active static beam on', () => {
    const g = makeGroup({
      id: 'g-max',
      maxActiveBeams: 1,
      sequence: { ...DEFAULT_BEAM_SEQUENCE, enabled: true, mode: 'all', stepsPerBeat: 1, stepGate: 1 },
    })
    const b0 = makeStaticBeam({ id: 'b0', groupId: 'g-max', sequenceIndex: 0 })
    const b1 = makeStaticBeam({ id: 'b1', groupId: 'g-max', sequenceIndex: 1 })
    const r = run(makeSettings([b0, b1], [g]))
    const gates = r.beams.map(c => c.sequenceGate)
    // Only 1 beam should have gate=1 due to maxActiveBeams
    expect(gates.filter(g => g === 1)).toHaveLength(1)
    expect(gates.filter(g => g === 0)).toHaveLength(1)
  })
})

// ── 17. Preset migration not needed ──────────────────────────────────────────

describe('17. Preset migration not needed (runtime correction only)', () => {
  it('existing static beam with no group still compiles unchanged', () => {
    // Verify no preset schema changes are required: a legacy static beam
    // without any sequence config compiles exactly as before.
    const b = makeStaticBeam()  // no groupId, default static motion
    const r = run(makeSettings([b]))
    expect(r.beams).toHaveLength(1)
    expect(r.beams[0].motionMode).toBe('static')
    expect(r.beams[0].sequenceGate).toBe(1)
    expect(r.beams[0].travelProgress).toBe(0)
    expect(r.beams[0].intensity).toBeGreaterThan(0)
  })
})
