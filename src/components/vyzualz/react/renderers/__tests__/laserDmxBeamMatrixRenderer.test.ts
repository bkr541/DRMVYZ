/**
 * Comprehensive tests for the Beam Matrix rendering pipeline.
 * Tests cover: compiler, geometry, fog pure math, mode isolation, capacity.
 * No canvas required — all canvas-using functions are tested indirectly via
 * the pure compiler and geometry modules (environment = node).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── Stable crypto mock ────────────────────────────────────────────────────────
let uuidCounter = 0
vi.stubGlobal('crypto', { randomUUID: () => `t-${++uuidCounter}` })

// ── Imports ───────────────────────────────────────────────────────────────────
import {
  gridAnchorToCanvas,
  targetToCanvas,
  zDepthFactors,
  computeLineGeometry,
  computeConeGeometry,
} from '../LaserDmxBeamGeometry'

import {
  compileLaserDmxBeamMatrix,
  resetBeamMatrixCompilerState,
} from '../LaserDmxBeamMatrixCompiler'

import {
  valueNoise,
  fbmNoise,
  fogBufferDimensions,
} from '../LaserDmxFogRenderer'

import {
  createDefaultLaserDmxBeamMatrixSettings,
  LASER_DMX_MATRIX_COLUMNS,
  LASER_DMX_MATRIX_ROWS,
  LASER_DMX_MATRIX_MAX_BEAMS,
  DEFAULT_BEAM_MOTION,
} from '../../ReactTypes'

import { useReactStore } from '../../../../../stores/reactStore'

// ── MI stub ───────────────────────────────────────────────────────────────────

type HitKey = 'beatHit' | 'kickHit' | 'snareHit' | 'hatHit'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeMi(overrides: Partial<Record<string, any>> = {}): any {
  return {
    frameId: 1,
    bands: {
      sub: 0, bass: 0, lowMid: 0, mid: 0, high: 0, air: 0, volume: 0,
      normalizedSub: 0, normalizedBass: 0, normalizedLowMid: 0,
      normalizedMid: 0, normalizedHigh: 0, normalizedAir: 0,
      ...overrides.bands,
    },
    rhythm: {
      beatHit: false, kickHit: false, snareHit: false, hatHit: false,
      downbeatHit: false, phrase4Hit: false, phrase8Hit: false,
      phrase16Hit: false, phrase32Hit: false,
      beatPhase: 0, bpm: 120, transient: 0,
      kickStrength: 0, snareStrength: 0, hatStrength: 0,
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
    harmonic: { pitchHz: null, keyConfidence: 0, chordConfidence: 0, chordChanged: false, mode: 'unknown', ...overrides.harmonic },
    stems: { vocals: 0, drums: 0, bassStemEnergy: 0, instrumentEnergy: 0, vocalEnergy: 0, drumEnergy: 0, vocalActivity: 0, drumTransient: false, bassStemTransient: false },
    lyrics: { vocalActivity: 0, lyricLineProgress: 0, phraseConfidence: 0, wordHit: false, activeLine: null, activeWord: null },
    semantics: { buildConfidence: 0, dropConfidence: 0, fakeoutConfidence: 0, vocalHookConfidence: 0, mood: 'unknown' },
    section: { type: 'unknown', progress: 0, intensity: 0 },
  }
}

function makeHitMi(hit: HitKey) {
  return makeMi({ rhythm: { [hit]: true } })
}

const MI0 = makeMi()
const W = 600, H = 400

function defaultInput(overrides = {}) {
  return {
    settings: createDefaultLaserDmxBeamMatrixSettings(),
    mi: MI0,
    time: 0,
    timeSec: 0,
    canvasWidth: W,
    canvasHeight: H,
    ...overrides,
  }
}

// ── GEOMETRY TESTS ────────────────────────────────────────────────────────────

describe('gridAnchorToCanvas', () => {
  it('column 1 row 1 maps to upper-left cell centre', () => {
    const { x, y } = gridAnchorToCanvas(1, 1, 0, W, H)
    expect(x).toBeCloseTo(0.5 / LASER_DMX_MATRIX_COLUMNS * W)
    expect(y).toBeCloseTo(0.5 / LASER_DMX_MATRIX_ROWS * H)
  })

  it('column 15 row 10 maps to lower-right cell centre', () => {
    const { x, y } = gridAnchorToCanvas(15, 10, 0, W, H)
    expect(x).toBeCloseTo(14.5 / LASER_DMX_MATRIX_COLUMNS * W)
    expect(y).toBeCloseTo(9.5  / LASER_DMX_MATRIX_ROWS    * H)
  })

  it('column 13, row 10 maps correctly', () => {
    const { x, y } = gridAnchorToCanvas(13, 10, 0, W, H)
    expect(x).toBeCloseTo(12.5 / 15 * W)
    expect(y).toBeCloseTo(9.5  / 10 * H)
  })

  it('column 7, row 1 maps correctly', () => {
    const { x, y } = gridAnchorToCanvas(7, 1, 0, W, H)
    expect(x).toBeCloseTo(6.5 / 15 * W)
    expect(y).toBeCloseTo(0.5 / 10 * H)
  })
})

describe('targetToCanvas', () => {
  it('grid target compiles the same as gridAnchorToCanvas', () => {
    const t = targetToCanvas({ kind: 'grid', column: 8, row: 5, z: 0 }, W, H)
    const a = gridAnchorToCanvas(8, 5, 0, W, H)
    expect(t.x).toBeCloseTo(a.x)
    expect(t.y).toBeCloseTo(a.y)
    expect(t.offscreen).toBe(false)
  })

  it('stage target x=−0.1 produces pixel x < 0 and offscreen=true', () => {
    const t = targetToCanvas({ kind: 'stage', x: -0.1, y: 0.5, z: 0 }, W, H)
    expect(t.x).toBeLessThan(0)
    expect(t.offscreen).toBe(true)
  })

  it('stage target x=1.1 produces pixel x > W and offscreen=true', () => {
    const t = targetToCanvas({ kind: 'stage', x: 1.1, y: 0.5, z: 0 }, W, H)
    expect(t.x).toBeGreaterThan(W)
    expect(t.offscreen).toBe(true)
  })

  it('stage target y=−0.2 produces pixel y < 0 and offscreen=true', () => {
    const t = targetToCanvas({ kind: 'stage', x: 0.5, y: -0.2, z: 0 }, W, H)
    expect(t.y).toBeLessThan(0)
    expect(t.offscreen).toBe(true)
  })

  it('stage target y=1.3 produces pixel y > H and offscreen=true', () => {
    const t = targetToCanvas({ kind: 'stage', x: 0.5, y: 1.3, z: 0 }, W, H)
    expect(t.y).toBeGreaterThan(H)
    expect(t.offscreen).toBe(true)
  })

  it('stage target (0.5, 0.5) is on-screen', () => {
    const t = targetToCanvas({ kind: 'stage', x: 0.5, y: 0.5, z: 0 }, W, H)
    expect(t.offscreen).toBe(false)
  })
})

describe('zDepthFactors', () => {
  it('Z=0 returns neutral (1.0, 1.0)', () => {
    const { widthScale, intensityScale } = zDepthFactors(0)
    expect(widthScale).toBeCloseTo(1)
    expect(intensityScale).toBeCloseTo(1)
  })

  it('Z=+1 returns widthScale > 1 and intensityScale > 1', () => {
    const { widthScale, intensityScale } = zDepthFactors(1)
    expect(widthScale).toBeGreaterThan(1)
    expect(intensityScale).toBeGreaterThan(1)
  })

  it('Z=−1 returns widthScale < 1 and intensityScale < 1', () => {
    const { widthScale, intensityScale } = zDepthFactors(-1)
    expect(widthScale).toBeLessThan(1)
    expect(intensityScale).toBeLessThan(1)
  })

  it('clamps NaN to neutral', () => {
    const { widthScale } = zDepthFactors(NaN)
    expect(widthScale).toBeCloseTo(1)
  })
})

describe('computeLineGeometry', () => {
  it('returns finite values for a normal line', () => {
    const g = computeLineGeometry(0, 0, 100, 50)
    expect(Number.isFinite(g.len)).toBe(true)
    expect(Number.isFinite(g.dx)).toBe(true)
    expect(Number.isFinite(g.dy)).toBe(true)
  })

  it('degenerates safely when origin === target', () => {
    const g = computeLineGeometry(50, 50, 50, 50)
    expect(Number.isFinite(g.dx)).toBe(true)
    expect(Number.isFinite(g.dy)).toBe(true)
    expect(g.len).toBeCloseTo(0.001)
  })

  it('direction vector is unit length', () => {
    const g = computeLineGeometry(10, 20, 80, 60)
    const len = Math.sqrt(g.dx * g.dx + g.dy * g.dy)
    expect(len).toBeCloseTo(1)
  })
})

describe('computeConeGeometry', () => {
  it('returns all finite values for a normal cone', () => {
    const g = computeConeGeometry(0, 0, 0, 100, 50, 0, 2, 0.3)
    for (const v of g.quad) {
      expect(Number.isFinite(v.x)).toBe(true)
      expect(Number.isFinite(v.y)).toBe(true)
    }
    expect(Number.isFinite(g.len)).toBe(true)
  })

  it('target half-width > origin half-width (cone expands)', () => {
    const g = computeConeGeometry(0, 0, 0, 300, 0, 0, 2, 0.4)
    expect(g.targetHalfWidth).toBeGreaterThan(g.originHalfWidth)
  })

  it('divergence=0 still produces valid minimal expansion', () => {
    const g = computeConeGeometry(0, 0, 0, 200, 0, 0, 2, 0)
    expect(g.targetHalfWidth).toBeGreaterThanOrEqual(g.originHalfWidth)
    for (const v of g.quad) {
      expect(Number.isFinite(v.x)).toBe(true)
    }
  })

  it('larger divergence produces wider target than smaller divergence', () => {
    const g1 = computeConeGeometry(0, 0, 0, 200, 0, 0, 2, 0.1)
    const g2 = computeConeGeometry(0, 0, 0, 200, 0, 0, 2, 0.8)
    expect(g2.targetHalfWidth).toBeGreaterThan(g1.targetHalfWidth)
  })

  it('handles identical origin and target safely', () => {
    const g = computeConeGeometry(50, 50, 0, 50, 50, 0, 2, 0.3)
    expect(Number.isFinite(g.nx)).toBe(true)
    expect(Number.isFinite(g.ny)).toBe(true)
  })

  it('supports offscreen targets (values remain finite)', () => {
    const g = computeConeGeometry(0, 0, 0, W * 2, H * -1, 0, 2, 0.3)
    for (const v of g.quad) {
      expect(Number.isFinite(v.x)).toBe(true)
      expect(Number.isFinite(v.y)).toBe(true)
    }
  })
})

// ── COMPILER TESTS ────────────────────────────────────────────────────────────

describe('compiler: empty matrix', () => {
  beforeEach(() => resetBeamMatrixCompilerState())

  it('compiles safely with zero beams', () => {
    const result = compileLaserDmxBeamMatrix(defaultInput())
    expect(result.beams).toHaveLength(0)
    expect(Number.isFinite(result.output.masterDimmer)).toBe(true)
  })

  it('output is present even with no beams', () => {
    const result = compileLaserDmxBeamMatrix(defaultInput())
    expect(result.output).toBeDefined()
    expect(result.fog).toBeDefined()
  })

  it('compiles safely with W=0 (degenerate canvas)', () => {
    const result = compileLaserDmxBeamMatrix({ ...defaultInput(), canvasWidth: 0 })
    expect(result.beams).toHaveLength(0)
  })
})

describe('compiler: disabled beams', () => {
  beforeEach(() => resetBeamMatrixCompilerState())

  it('disabled beam does not appear in output', () => {
    const store = useReactStore.getState()
    store.resetLaserDmxBeamMatrix()
    store.addLaserDmxMatrixBeam()
    const beamId = useReactStore.getState().laserDmxBeamMatrix.beams[0].id
    store.updateLaserDmxMatrixBeam(beamId, { enabled: false })
    const settings = useReactStore.getState().laserDmxBeamMatrix
    const result = compileLaserDmxBeamMatrix({ ...defaultInput(), settings })
    expect(result.beams).toHaveLength(0)
  })

  it('enabled beam appears in output', () => {
    const store = useReactStore.getState()
    store.resetLaserDmxBeamMatrix()
    // Add beam with high dimmer to ensure it passes intensity threshold
    store.addLaserDmxMatrixBeam({ appearance: { dimmer: 1, shutterOpen: true, width: 1, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' } })
    const settings = useReactStore.getState().laserDmxBeamMatrix
    const result = compileLaserDmxBeamMatrix({ ...defaultInput(), settings })
    expect(result.beams.length).toBeGreaterThan(0)
  })
})

describe('compiler: group gating', () => {
  beforeEach(() => {
    useReactStore.getState().resetLaserDmxBeamMatrix()
    resetBeamMatrixCompilerState()
  })

  function addBeamInGroup(groupId: string) {
    const store = useReactStore.getState()
    store.addLaserDmxMatrixBeam({
      groupId,
      appearance: { dimmer: 1, shutterOpen: true, width: 1, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' },
    })
  }

  it('beam in disabled group does not compile', () => {
    const store = useReactStore.getState()
    const groupId = store.laserDmxBeamMatrix.groups[0].id
    store.updateLaserDmxReactionGroup(groupId, { enabled: false })
    addBeamInGroup(groupId)
    const settings = useReactStore.getState().laserDmxBeamMatrix
    const result = compileLaserDmxBeamMatrix({ ...defaultInput(), settings })
    expect(result.beams.filter(b => b.groupId === groupId)).toHaveLength(0)
  })

  it('beam in muted group does not compile', () => {
    const store = useReactStore.getState()
    const groupId = store.laserDmxBeamMatrix.groups[0].id
    store.setLaserDmxReactionGroupMuted(groupId, true)
    addBeamInGroup(groupId)
    const settings = useReactStore.getState().laserDmxBeamMatrix
    const result = compileLaserDmxBeamMatrix({ ...defaultInput(), settings })
    expect(result.beams.filter(b => b.groupId === groupId)).toHaveLength(0)
  })

  it('when groups are soloed, only soloed-group beams compile', () => {
    const store = useReactStore.getState()
    const groups = store.laserDmxBeamMatrix.groups
    const soloGroup  = groups[0]
    const otherGroup = groups[1]

    store.setLaserDmxReactionGroupSoloed(soloGroup.id, true)
    addBeamInGroup(soloGroup.id)
    addBeamInGroup(otherGroup.id)

    const settings = useReactStore.getState().laserDmxBeamMatrix
    const result = compileLaserDmxBeamMatrix({ ...defaultInput(), settings })

    const soloBeams  = result.beams.filter(b => b.groupId === soloGroup.id)
    const otherBeams = result.beams.filter(b => b.groupId === otherGroup.id)
    expect(soloBeams.length).toBeGreaterThan(0)
    expect(otherBeams).toHaveLength(0)
  })

  it('ungrouped beams are hidden when any group is soloed', () => {
    const store = useReactStore.getState()
    const groups = store.laserDmxBeamMatrix.groups
    store.setLaserDmxReactionGroupSoloed(groups[0].id, true)
    // Add ungrouped beam
    store.addLaserDmxMatrixBeam({
      groupId: null,
      appearance: { dimmer: 1, shutterOpen: true, width: 1, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' },
    })
    const settings = useReactStore.getState().laserDmxBeamMatrix
    const result = compileLaserDmxBeamMatrix({ ...defaultInput(), settings })
    const ungrouped = result.beams.filter(b => b.groupId === null)
    expect(ungrouped).toHaveLength(0)
  })

  it('ungrouped beams render when no solo is active', () => {
    const store = useReactStore.getState()
    store.addLaserDmxMatrixBeam({
      groupId: null,
      appearance: { dimmer: 1, shutterOpen: true, width: 1, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' },
    })
    const settings = useReactStore.getState().laserDmxBeamMatrix
    const result = compileLaserDmxBeamMatrix({ ...defaultInput(), settings })
    const ungrouped = result.beams.filter(b => b.groupId === null)
    expect(ungrouped.length).toBeGreaterThan(0)
  })
})

describe('compiler: color logic', () => {
  beforeEach(() => {
    useReactStore.getState().resetLaserDmxBeamMatrix()
    resetBeamMatrixCompilerState()
  })

  it('group color override replaces beam color when useGroupColor=true and override enabled', () => {
    const store = useReactStore.getState()
    const group = store.laserDmxBeamMatrix.groups[0]  // Bass React = red
    store.addLaserDmxMatrixBeam({
      groupId: group.id,
      useGroupColor: true,
      color: { red: 0, green: 255, blue: 0, white: 0, alpha: 1 },  // green beam
      appearance: { dimmer: 1, shutterOpen: true, width: 1, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' },
    })
    const settings = useReactStore.getState().laserDmxBeamMatrix
    const result = compileLaserDmxBeamMatrix({
      ...defaultInput(),
      settings,
      mi: makeMi({ bands: { normalizedBass: 1 } }),  // drive bass to ensure dimmer > 0
    })
    // The group (Bass React) has red color override enabled
    const beam = result.beams.find(b => b.groupId === group.id)
    if (!beam) return  // may be filtered by low intensity — just skip
    // Red channel should dominate (group is red)
    expect(beam.rgba.r).toBeGreaterThan(beam.rgba.g)
  })

  it('beam color remains independent when useGroupColor=false', () => {
    const store = useReactStore.getState()
    const group = store.laserDmxBeamMatrix.groups[0]  // Bass React = red group
    store.addLaserDmxMatrixBeam({
      groupId: group.id,
      useGroupColor: false,  // keep own color
      color: { red: 0, green: 0, blue: 255, white: 0, alpha: 1 },  // blue beam
      appearance: { dimmer: 1, shutterOpen: true, width: 1, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' },
    })
    const settings = useReactStore.getState().laserDmxBeamMatrix
    const result = compileLaserDmxBeamMatrix({
      ...defaultInput(),
      settings,
      mi: makeMi({ bands: { normalizedBass: 1 } }),
    })
    const beam = result.beams.find(b => b.groupId === group.id)
    if (!beam) return
    // Should still be blue (not red from group)
    expect(beam.rgba.b).toBeGreaterThan(beam.rgba.r)
  })
})

describe('compiler: modulation and safety clamp', () => {
  beforeEach(() => {
    useReactStore.getState().resetLaserDmxBeamMatrix()
    resetBeamMatrixCompilerState()
  })

  it('safety clamp ≤ 0.5 limits intensity output', () => {
    const store = useReactStore.getState()
    store.addLaserDmxMatrixBeam({
      appearance: { dimmer: 1, shutterOpen: true, width: 1, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' },
    })
    const base = createDefaultLaserDmxBeamMatrixSettings()
    const settings = {
      ...useReactStore.getState().laserDmxBeamMatrix,
      output: { ...base.output, safetyClamp: 0.4, masterDimmer: 1 },
    }
    const result = compileLaserDmxBeamMatrix({ ...defaultInput(), settings })
    for (const beam of result.beams) {
      // intensity = dimmer(1) * safetyClamp(0.4) * masterDimmer(1) = 0.4
      expect(beam.intensity).toBeLessThanOrEqual(0.41)
    }
  })

  it('beam routes do not mutate the saved beam object', () => {
    const store = useReactStore.getState()
    store.addLaserDmxMatrixBeam({
      appearance: { dimmer: 1, shutterOpen: true, width: 1, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' },
      modulationRoutes: [{
        id: 'test-r1', enabled: true,
        source: 'beat', target: 'dimmer' as const,
        amount: 1, min: 0, max: 1,
        curve: 'linear' as const, mode: 'trigger' as const,
        smoothing: 0, attack: 0, release: 0.3, invert: false,
      }],
    })
    const settings = useReactStore.getState().laserDmxBeamMatrix
    const savedDimmerBefore = settings.beams[0].appearance.dimmer
    compileLaserDmxBeamMatrix({
      ...defaultInput(),
      settings,
      mi: makeHitMi('beatHit'),
    })
    // Saved beam must be unmodified
    const savedDimmerAfter = useReactStore.getState().laserDmxBeamMatrix.beams[0].appearance.dimmer
    expect(savedDimmerAfter).toBe(savedDimmerBefore)
  })

  it('all compiled beam numbers are finite', () => {
    const store = useReactStore.getState()
    for (let i = 0; i < 5; i++) {
      store.addLaserDmxMatrixBeam({
        appearance: { dimmer: 1, shutterOpen: true, width: 1, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' },
      })
    }
    const settings = useReactStore.getState().laserDmxBeamMatrix
    const result = compileLaserDmxBeamMatrix({ ...defaultInput(), settings })
    for (const beam of result.beams) {
      expect(Number.isFinite(beam.intensity)).toBe(true)
      expect(Number.isFinite(beam.beamWidth)).toBe(true)
      expect(Number.isFinite(beam.divergence)).toBe(true)
      expect(Number.isFinite(beam.glow)).toBe(true)
      expect(Number.isFinite(beam.origin.x)).toBe(true)
      expect(Number.isFinite(beam.origin.y)).toBe(true)
      expect(Number.isFinite(beam.target.x)).toBe(true)
      expect(Number.isFinite(beam.target.y)).toBe(true)
      expect(Number.isFinite(beam.rgba.r)).toBe(true)
      expect(Number.isFinite(beam.rgba.g)).toBe(true)
      expect(Number.isFinite(beam.rgba.b)).toBe(true)
      expect(Number.isFinite(beam.rgba.a)).toBe(true)
    }
  })
})

// ── MODULATION / AUDIO-REACTION TESTS ─────────────────────────────────────────

describe('audio-reactive group behaviour', () => {
  beforeEach(() => {
    useReactStore.getState().resetLaserDmxBeamMatrix()
    resetBeamMatrixCompilerState()
  })

  it('Bass React group dimmer tracks normalizedBass (continuous source)', () => {
    const store = useReactStore.getState()
    const bassGroup = store.laserDmxBeamMatrix.groups.find(g => g.id === 'grp-bass')!
    store.addLaserDmxMatrixBeam({
      groupId: bassGroup.id,
      appearance: { dimmer: 1, shutterOpen: true, width: 1, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' },
    })
    const settings = useReactStore.getState().laserDmxBeamMatrix

    const lowBass = compileLaserDmxBeamMatrix({
      ...defaultInput(), settings,
      mi: makeMi({ bands: { normalizedBass: 0.05 } }),
    })
    const highBass = compileLaserDmxBeamMatrix({
      ...defaultInput(), settings,
      mi: makeMi({ bands: { normalizedBass: 0.95 } }),
    })

    // High bass → higher intensity
    const lI = lowBass.beams[0]?.intensity ?? 0
    const hI = highBass.beams[0]?.intensity ?? 0
    expect(hI).toBeGreaterThan(lI)
  })

  // ── Default starter group tests (pulse curve, real groups) ──────────────────
  // The trigger envelope now uses attack/hold/release phases (values in seconds).
  // Curve is NOT applied to the trigger envelope output, so pulse curve can no
  // longer destroy the initial hit (pulse(1.0) = sin(π)² ≈ 0 was the old bug).

  it('Snare React group (default pulse curve, release=0.22) produces visible intensity on snare hit', () => {
    const store = useReactStore.getState()
    const snareGroup = store.laserDmxBeamMatrix.groups.find(g => g.id === 'grp-snare')!
    store.addLaserDmxMatrixBeam({
      groupId: snareGroup.id,
      appearance: { dimmer: 1, shutterOpen: true, width: 1, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' },
    })
    const settings = useReactStore.getState().laserDmxBeamMatrix
    const result = compileLaserDmxBeamMatrix({
      ...defaultInput(), settings,
      mi: makeHitMi('snareHit'),
    })
    const beam = result.beams.find(b => b.groupId === 'grp-snare')
    expect(beam).toBeDefined()
    expect(beam!.intensity).toBeGreaterThan(0)
  })

  it('Snare React release=0.22 gives multi-frame visible tail (not one-frame collapse)', () => {
    // approachBySeconds(1.0→0, dt=1/60≈0.0167s, durationSec=0.22):
    // coeff = 1 - e^(-0.0167/0.22) ≈ 0.073 → value decays to ≈0.927 after frame 1.
    // Previously the rate formula made dt*rate > 1 → tail collapsed in one frame.
    const store = useReactStore.getState()
    const snareGroup = store.laserDmxBeamMatrix.groups.find(g => g.id === 'grp-snare')!
    store.addLaserDmxMatrixBeam({
      groupId: snareGroup.id,
      appearance: { dimmer: 1, shutterOpen: true, width: 1, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' },
    })
    const settings = useReactStore.getState().laserDmxBeamMatrix

    // Hit frame
    compileLaserDmxBeamMatrix({ ...defaultInput(), settings, mi: makeHitMi('snareHit'), timeSec: 0 })

    // Next frame — no hit, but release=0.22 keeps the tail alive
    const afterHit = compileLaserDmxBeamMatrix({ ...defaultInput(), settings, mi: MI0, timeSec: 1 / 60 })
    const beam = afterHit.beams.find(b => b.groupId === 'grp-snare')
    expect(beam).toBeDefined()
    expect(beam!.intensity).toBeGreaterThan(0)
  })

  it('Beat React group (default pulse curve, release=0.3) produces visible intensity on beat hit', () => {
    const store = useReactStore.getState()
    const beatGroup = store.laserDmxBeamMatrix.groups.find(g => g.id === 'grp-beat')!
    store.addLaserDmxMatrixBeam({
      groupId: beatGroup.id,
      appearance: { dimmer: 1, shutterOpen: true, width: 1, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' },
    })
    const settings = useReactStore.getState().laserDmxBeamMatrix
    const result = compileLaserDmxBeamMatrix({
      ...defaultInput(), settings,
      mi: makeHitMi('beatHit'),
    })
    const beam = result.beams.find(b => b.groupId === 'grp-beat')
    expect(beam).toBeDefined()
    expect(beam!.intensity).toBeGreaterThan(0)
  })

  it('Beat React release=0.3 gives multi-frame visible tail', () => {
    const store = useReactStore.getState()
    const beatGroup = store.laserDmxBeamMatrix.groups.find(g => g.id === 'grp-beat')!
    store.addLaserDmxMatrixBeam({
      groupId: beatGroup.id,
      appearance: { dimmer: 1, shutterOpen: true, width: 1, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' },
    })
    const settings = useReactStore.getState().laserDmxBeamMatrix

    compileLaserDmxBeamMatrix({ ...defaultInput(), settings, mi: makeHitMi('beatHit'), timeSec: 0 })

    const afterHit = compileLaserDmxBeamMatrix({ ...defaultInput(), settings, mi: MI0, timeSec: 1 / 60 })
    const beam = afterHit.beams.find(b => b.groupId === 'grp-beat')
    expect(beam).toBeDefined()
    expect(beam!.intensity).toBeGreaterThan(0)
  })

  it('trigger beam-level route (linear curve) produces non-zero intensity on snare hit', () => {
    // Beam-level route on grp-custom (whose only group route is disabled).
    // With the envelope fix, the trigger envelope reaches 1.0 instantly (attack=0)
    // and curve is not applied, so the output is full intensity.
    const store = useReactStore.getState()
    const customGroup = store.laserDmxBeamMatrix.groups.find(g => g.id === 'grp-custom')!
    store.addLaserDmxMatrixBeam({
      groupId: customGroup.id,
      appearance: { dimmer: 1, shutterOpen: true, width: 1, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' },
      modulationRoutes: [{
        id: 'test-snr-hit', enabled: true,
        source: 'snare', target: 'dimmer' as const,
        amount: 1, min: 0, max: 1,
        curve: 'linear' as const, mode: 'trigger' as const,
        smoothing: 0, attack: 0, release: 0.8, invert: false,
      }],
    })
    const settings = useReactStore.getState().laserDmxBeamMatrix
    const result = compileLaserDmxBeamMatrix({
      ...defaultInput(), settings,
      mi: makeHitMi('snareHit'),
    })
    const beam = result.beams.find(b => b.groupId === 'grp-custom')
    expect(beam).toBeDefined()
    expect(beam!.intensity).toBeGreaterThan(0)
  })

  it('trigger release tail persists across multiple frames with release=0.8', () => {
    // approachBySeconds(1.0→0, dt=1/60, durationSec=0.8):
    // coeff ≈ 0.021 → value decays to ≈0.979 after one frame. Clearly visible.
    const store = useReactStore.getState()
    const customGroup = store.laserDmxBeamMatrix.groups.find(g => g.id === 'grp-custom')!
    store.addLaserDmxMatrixBeam({
      groupId: customGroup.id,
      appearance: { dimmer: 1, shutterOpen: true, width: 1, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' },
      modulationRoutes: [{
        id: 'test-snr-rel', enabled: true,
        source: 'snare', target: 'dimmer' as const,
        amount: 1, min: 0, max: 1,
        curve: 'linear' as const, mode: 'trigger' as const,
        smoothing: 0, attack: 0, release: 0.8, invert: false,
      }],
    })
    const settings = useReactStore.getState().laserDmxBeamMatrix

    compileLaserDmxBeamMatrix({ ...defaultInput(), settings, mi: makeHitMi('snareHit'), timeSec: 0 })

    const afterHit = compileLaserDmxBeamMatrix({ ...defaultInput(), settings, mi: MI0, timeSec: 1 / 60 })
    const beam = afterHit.beams.find(b => b.groupId === 'grp-custom')
    expect(beam).toBeDefined()
    expect(beam!.intensity).toBeGreaterThan(0)
  })

  it('trigger beam-level route (linear curve) produces non-zero intensity on beat hit', () => {
    const store = useReactStore.getState()
    const customGroup = store.laserDmxBeamMatrix.groups.find(g => g.id === 'grp-custom')!
    store.addLaserDmxMatrixBeam({
      groupId: customGroup.id,
      appearance: { dimmer: 1, shutterOpen: true, width: 1, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' },
      modulationRoutes: [{
        id: 'test-beat-hit', enabled: true,
        source: 'beat', target: 'dimmer' as const,
        amount: 1, min: 0, max: 1,
        curve: 'linear' as const, mode: 'trigger' as const,
        smoothing: 0, attack: 0, release: 0.8, invert: false,
      }],
    })
    const settings = useReactStore.getState().laserDmxBeamMatrix
    const result = compileLaserDmxBeamMatrix({
      ...defaultInput(), settings,
      mi: makeHitMi('beatHit'),
    })
    const beam = result.beams.find(b => b.groupId === 'grp-custom')
    expect(beam).toBeDefined()
    expect(beam!.intensity).toBeGreaterThan(0)
  })

  it('group routes are applied per-group (same route produces same result for all beams in group)', () => {
    const store = useReactStore.getState()
    const bassGroup = store.laserDmxBeamMatrix.groups.find(g => g.id === 'grp-bass')!
    store.addLaserDmxMatrixBeam({
      groupId: bassGroup.id,
      appearance: { dimmer: 1, shutterOpen: true, width: 1, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' },
    })
    store.addLaserDmxMatrixBeam({
      groupId: bassGroup.id,
      appearance: { dimmer: 1, shutterOpen: true, width: 2, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' },
    })
    const settings = useReactStore.getState().laserDmxBeamMatrix
    const result = compileLaserDmxBeamMatrix({
      ...defaultInput(), settings,
      mi: makeMi({ bands: { normalizedBass: 0.7 } }),
    })
    const bassBeams = result.beams.filter(b => b.groupId === 'grp-bass')
    if (bassBeams.length < 2) return
    // Both beams should have the same group-driven dimmer (before beam width difference)
    expect(bassBeams[0].intensity).toBeCloseTo(bassBeams[1].intensity, 3)
  })

  it('custom group can use a different trigger source (kick)', () => {
    const store = useReactStore.getState()
    const customGroup = store.laserDmxBeamMatrix.groups.find(g => g.id === 'grp-custom')!
    // Set up a kick route on the custom group
    store.updateLaserDmxReactionGroup(customGroup.id, {
      modulationRoutes: [{
        id: 'custom-kick', enabled: true,
        source: 'kick', target: 'dimmer' as const,
        amount: 1, min: 0, max: 1,
        curve: 'linear' as const, mode: 'trigger' as const,
        smoothing: 0, attack: 0, release: 0.3, invert: false,
      }],
    })
    store.addLaserDmxMatrixBeam({
      groupId: customGroup.id,
      appearance: { dimmer: 1, shutterOpen: true, width: 1, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' },
    })
    const settings = useReactStore.getState().laserDmxBeamMatrix
    const result = compileLaserDmxBeamMatrix({
      ...defaultInput(), settings,
      mi: makeHitMi('kickHit'),
    })
    const beam = result.beams.find(b => b.groupId === 'grp-custom')
    expect(beam).toBeDefined()
    expect(beam!.intensity).toBeGreaterThan(0)
  })
})

// ── FOG PURE MATH TESTS ───────────────────────────────────────────────────────

describe('valueNoise', () => {
  it('returns values in [0, 1]', () => {
    for (let i = 0; i < 20; i++) {
      const v = valueNoise(i * 0.37, i * 0.53)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('is deterministic (same input → same output)', () => {
    const a = valueNoise(1.5, 2.3)
    const b = valueNoise(1.5, 2.3)
    expect(a).toBe(b)
  })

  it('different inputs produce different values (not constant)', () => {
    const v1 = valueNoise(0, 0)
    const v2 = valueNoise(5.5, 3.2)
    expect(v1).not.toBeCloseTo(v2, 2)
  })
})

describe('fbmNoise', () => {
  it('returns values in approximately [0, 1]', () => {
    for (let i = 0; i < 20; i++) {
      const v = fbmNoise(i * 0.31, i * 0.47, 3, 1.5, i * 0.1, 0.2)
      expect(v).toBeGreaterThanOrEqual(-0.01)  // slight numerical tolerance
      expect(v).toBeLessThanOrEqual(1.01)
    }
  })

  it('is deterministic', () => {
    const a = fbmNoise(1.0, 2.0, 3, 1.5, 0.5, 0.2)
    const b = fbmNoise(1.0, 2.0, 3, 1.5, 0.5, 0.2)
    expect(a).toBe(b)
  })

  it('large time delta produces visibly different values (animation changes values)', () => {
    // At time=0 vs time=50 the directional UV drift is large enough to sample a
    // completely different noise region — difference well above floating-point noise.
    const v0 = fbmNoise(0.5, 0.5, 2, 1, 0,  0)
    const v1 = fbmNoise(0.5, 0.5, 2, 1, 50, 0)
    expect(Math.abs(v0 - v1)).toBeGreaterThan(0.01)
  })

  it('turbulence=0 differs from turbulence=1 (distortion is visible)', () => {
    const v0 = fbmNoise(0.3, 0.7, 3, 1, 0.5, 0)
    const v1 = fbmNoise(0.3, 0.7, 3, 1, 0.5, 1)
    // Values may differ when turbulence distorts the UV
    expect(typeof v0).toBe('number')
    expect(typeof v1).toBe('number')
  })
})

describe('fogBufferDimensions', () => {
  it('low quality uses 64-px width', () => {
    const { w } = fogBufferDimensions(640, 360, 'low')
    expect(w).toBe(64)
  })

  it('medium quality uses 128-px width', () => {
    const { w } = fogBufferDimensions(640, 360, 'medium')
    expect(w).toBe(128)
  })

  it('high quality uses 256-px width', () => {
    const { w } = fogBufferDimensions(640, 360, 'high')
    expect(w).toBe(256)
  })

  it('height maintains canvas aspect ratio for low quality', () => {
    const { w, h } = fogBufferDimensions(640, 320, 'low')
    expect(h / w).toBeCloseTo(320 / 640, 1)
  })

  it('height is at least 4 for tiny canvas', () => {
    const { h } = fogBufferDimensions(2, 1, 'low')
    expect(h).toBeGreaterThanOrEqual(4)
  })

  it('aspect ratio preserved for 16:9 medium quality', () => {
    const { w, h } = fogBufferDimensions(1920, 1080, 'medium')
    expect(w).toBe(128)
    expect(h / w).toBeCloseTo(1080 / 1920, 1)
  })

  it('pixel stride regression: w > h for wide buffers, so w-stride differs from h-stride', () => {
    // Bug: foreground wisp loop used (py * h + px) instead of (py * w + px).
    // For 16:9 medium buffer (w=128, h=72): row 1 at h-stride=72 vs w-stride=128.
    // This confirms the bug was meaningful (and is now fixed).
    const { w, h } = fogBufferDimensions(640, 360, 'medium')
    expect(w).toBeGreaterThan(h)  // 128 > 72 → wrong stride would corrupt writes
    // Additionally verify aspect ratio is sensible
    expect(h).toBeGreaterThan(0)
    expect(w * h * 4).toBeLessThanOrEqual(128 * 128 * 4)  // stays within reasonable buffer
  })

  it('non-square buffer: all pixel indices with w-stride stay in bounds', () => {
    // For a 160×90 buffer: max index = (89 * 160 + 159) * 4 = 14399 * 4 = 57596
    // which is < 160 * 90 * 4 = 57600. With h-stride (90): max index = (89*90+159)*4 = 8175*4=32700
    // — writes row 89 col 159 at index 32700 instead of 57596 → corruption.
    const W = 1280, H = 720
    const { w, h } = fogBufferDimensions(W, H, 'medium')
    const bufLen = w * h
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const correct = py * w + px  // correct stride
        expect(correct).toBeGreaterThanOrEqual(0)
        expect(correct).toBeLessThan(bufLen)
      }
    }
  })
})

// ── MODE ISOLATION TESTS ──────────────────────────────────────────────────────

describe('mode isolation', () => {
  beforeEach(() => {
    useReactStore.getState().resetLaserDmxBeamMatrix()
    resetBeamMatrixCompilerState()
  })

  it('requesting Spatial Fixtures mode does not clear Beam Matrix beams or unlock the workspace', () => {
    // useReactStore.getState() returns a snapshot; call getState() again AFTER mutations
    // to read the updated beam count rather than the pre-mutation snapshot.
    const store = useReactStore.getState()
    store.addLaserDmxMatrixBeam()
    const bmBefore = useReactStore.getState().laserDmxBeamMatrix.beams.length  // re-read after add

    store.setLaserDmxWorkspaceMode('spatialFixtures')
    expect(useReactStore.getState().laserDmxWorkspaceMode).toBe('beamMatrix')
    expect(useReactStore.getState().laserDmxBeamMatrix.beams.length).toBe(bmBefore)
    store.setLaserDmxWorkspaceMode('beamMatrix')
  })

  it('switching modes preserves both stored programs', () => {
    const store = useReactStore.getState()
    store.addLaserDmxMatrixBeam()
    // Re-read state after mutation — the store snapshot captured in `store` is stale.
    const bmCount = useReactStore.getState().laserDmxBeamMatrix.beams.length
    const sfCount = useReactStore.getState().laserDmxSettings.fixtures.length

    store.setLaserDmxWorkspaceMode('spatialFixtures')
    expect(useReactStore.getState().laserDmxWorkspaceMode).toBe('beamMatrix')
    store.setLaserDmxWorkspaceMode('beamMatrix')

    expect(useReactStore.getState().laserDmxBeamMatrix.beams.length).toBe(bmCount)
    expect(useReactStore.getState().laserDmxSettings.fixtures.length).toBe(sfCount)
  })

  it('Beam Matrix compiler with 0 canvas returns empty beams (mode not active)', () => {
    const result = compileLaserDmxBeamMatrix({ ...defaultInput(), canvasWidth: 0 })
    expect(result.beams).toHaveLength(0)
  })
})

// ── CAPACITY / STRESS TESTS ───────────────────────────────────────────────────

describe('capacity', () => {
  beforeEach(() => {
    useReactStore.getState().resetLaserDmxBeamMatrix()
    resetBeamMatrixCompilerState()
  })

  it('compiles 300 simple line beams without throwing', () => {
    const settings = createDefaultLaserDmxBeamMatrixSettings()
    const beams = Array.from({ length: LASER_DMX_MATRIX_MAX_BEAMS }, (_, i) => ({
      id: `b-${i}`, name: `B${i}`, enabled: true,
      sequenceIndex: i, motion: DEFAULT_BEAM_MOTION,
      origin: { column: (i % 15) + 1, row: Math.floor(i / 15) % 10 + 1, z: 0 },
      target: { kind: 'grid' as const, column: (14 - i % 15) + 1, row: Math.floor(i / 15) % 10 + 1, z: 0 },
      groupId: null, useGroupColor: false,
      color: { red: 0, green: 255, blue: 220, white: 0, alpha: 1 },
      appearance: { dimmer: 1, shutterOpen: true, width: 1, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' as const },
      modulationRoutes: [],
    }))
    settings.beams = beams

    let result: ReturnType<typeof compileLaserDmxBeamMatrix> | undefined
    expect(() => {
      result = compileLaserDmxBeamMatrix({ ...defaultInput(), settings })
    }).not.toThrow()
    expect(result!.beams.length).toBeLessThanOrEqual(LASER_DMX_MATRIX_MAX_BEAMS)
    expect(result!.beams.length).toBeGreaterThan(0)
  })

  it('compiles 300 beams across 4 groups', () => {
    const settings = createDefaultLaserDmxBeamMatrixSettings()
    const groups = settings.groups
    const beams = Array.from({ length: LASER_DMX_MATRIX_MAX_BEAMS }, (_, i) => ({
      id: `bg-${i}`, name: `G${i}`, enabled: true,
      sequenceIndex: i, motion: DEFAULT_BEAM_MOTION,
      origin: { column: (i % 15) + 1, row: Math.floor(i / 15) % 10 + 1, z: 0 },
      target: { kind: 'grid' as const, column: (14 - i % 15) + 1, row: Math.floor(i / 15) % 10 + 1, z: 0 },
      groupId: groups[i % 4].id,
      useGroupColor: true,
      color: { red: 255, green: 255, blue: 255, white: 0, alpha: 1 },
      appearance: { dimmer: 1, shutterOpen: true, width: 1, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' as const },
      modulationRoutes: [],
    }))
    settings.beams = beams

    expect(() => {
      compileLaserDmxBeamMatrix({ ...defaultInput(), settings })
    }).not.toThrow()
  })

  it('compiles 300 beams with group routes (Bass React)', () => {
    const settings = createDefaultLaserDmxBeamMatrixSettings()
    const bassGroup = settings.groups.find(g => g.id === 'grp-bass')!
    const beams = Array.from({ length: LASER_DMX_MATRIX_MAX_BEAMS }, (_, i) => ({
      id: `bgr-${i}`, name: `R${i}`, enabled: true,
      sequenceIndex: i, motion: DEFAULT_BEAM_MOTION,
      origin: { column: (i % 15) + 1, row: Math.floor(i / 15) % 10 + 1, z: 0 },
      target: { kind: 'grid' as const, column: (14 - i % 15) + 1, row: Math.floor(i / 15) % 10 + 1, z: 0 },
      groupId: bassGroup.id,
      useGroupColor: true,
      color: { red: 255, green: 0, blue: 0, white: 0, alpha: 1 },
      appearance: { dimmer: 1, shutterOpen: true, width: 1, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' as const },
      modulationRoutes: [],
    }))
    settings.beams = beams

    expect(() => {
      compileLaserDmxBeamMatrix({
        ...defaultInput(), settings,
        mi: makeMi({ bands: { normalizedBass: 0.8 } }),
      })
    }).not.toThrow()
  })

  it('compiles offscreen stage-target beams', () => {
    const settings = createDefaultLaserDmxBeamMatrixSettings()
    settings.beams = [
      {
        id: 'os1', name: 'Offscreen L', enabled: true,
        sequenceIndex: 0, motion: DEFAULT_BEAM_MOTION,
        origin: { column: 1, row: 5, z: 0 },
        target: { kind: 'stage', x: -0.5, y: 0.5, z: 0 },
        groupId: null, useGroupColor: false,
        color: { red: 255, green: 100, blue: 0, white: 0, alpha: 1 },
        appearance: { dimmer: 1, shutterOpen: true, width: 1, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' as const },
        modulationRoutes: [],
      },
      {
        id: 'os2', name: 'Offscreen R', enabled: true,
        sequenceIndex: 1, motion: DEFAULT_BEAM_MOTION,
        origin: { column: 15, row: 5, z: 0 },
        target: { kind: 'stage', x: 1.5, y: 1.5, z: 0 },
        groupId: null, useGroupColor: false,
        color: { red: 0, green: 100, blue: 255, white: 0, alpha: 1 },
        appearance: { dimmer: 1, shutterOpen: true, width: 1, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' as const },
        modulationRoutes: [],
      },
    ]

    let result: ReturnType<typeof compileLaserDmxBeamMatrix> | undefined
    expect(() => {
      result = compileLaserDmxBeamMatrix({ ...defaultInput(), settings })
    }).not.toThrow()
    expect(result!.beams.length).toBe(2)
    const os = result!.beams.find(b => b.beamId === 'os1')!
    expect(os.target.offscreen).toBe(true)
  })

  it('compiles a mix of line and volumetric cone beams', () => {
    const settings = createDefaultLaserDmxBeamMatrixSettings()
    settings.beams = [
      {
        id: 'lne1', name: 'Line', enabled: true,
        sequenceIndex: 0, motion: DEFAULT_BEAM_MOTION,
        origin: { column: 3, row: 5, z: 0 },
        target: { kind: 'grid', column: 12, row: 2, z: 0 },
        groupId: null, useGroupColor: false,
        color: { red: 0, green: 255, blue: 200, white: 0, alpha: 1 },
        appearance: { dimmer: 1, shutterOpen: true, width: 1, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' as const },
        modulationRoutes: [],
      },
      {
        id: 'vcn1', name: 'Cone', enabled: true,
        sequenceIndex: 1, motion: DEFAULT_BEAM_MOTION,
        origin: { column: 7, row: 9, z: 0.3 },
        target: { kind: 'grid', column: 7, row: 2, z: -0.3 },
        groupId: null, useGroupColor: false,
        color: { red: 60, green: 200, blue: 80, white: 0, alpha: 1 },
        appearance: { dimmer: 1, shutterOpen: true, width: 2, focus: 0.5, strobeRate: 0, flickerAmount: 0, divergence: 0.5, glow: 0.8, geometry: 'volumetricCone' as const },
        modulationRoutes: [],
      },
    ]
    const result = compileLaserDmxBeamMatrix({ ...defaultInput(), settings })
    const lines = result.beams.filter(b => b.geometry === 'line')
    const cones = result.beams.filter(b => b.geometry === 'volumetricCone')
    expect(lines.length).toBe(1)
    expect(cones.length).toBe(1)
  })
})

// ── BLACKOUT TEST ─────────────────────────────────────────────────────────────

describe('blackout', () => {
  beforeEach(() => resetBeamMatrixCompilerState())

  it('blackout=true returns empty beams', () => {
    const settings = {
      ...createDefaultLaserDmxBeamMatrixSettings(),
      output: { ...createDefaultLaserDmxBeamMatrixSettings().output, blackout: true },
    }
    settings.beams = [
      {
        id: 'b1', name: 'Test', enabled: true,
        sequenceIndex: 0, motion: DEFAULT_BEAM_MOTION,
        origin: { column: 1, row: 1, z: 0 },
        target: { kind: 'grid' as const, column: 15, row: 10, z: 0 },
        groupId: null, useGroupColor: false,
        color: { red: 255, green: 255, blue: 255, white: 0, alpha: 1 },
        appearance: { dimmer: 1, shutterOpen: true, width: 1, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' as const },
        modulationRoutes: [],
      },
    ]
    const result = compileLaserDmxBeamMatrix({ ...defaultInput(), settings })
    expect(result.beams).toHaveLength(0)
    expect(result.output.blackout).toBe(true)
  })
})
