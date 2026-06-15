import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  compileLaserDmxBeamMatrix,
  resetBeamMatrixCompilerState,
} from '../LaserDmxBeamMatrixCompiler'
import { applyModulationRoute, resetAllEnvelopes } from '../LaserDmxModulationEngine'
import {
  BM_GLOBAL_TARGETS,
  BM_GROUP_TARGETS,
  BM_BEAM_TARGETS,
  validateRouteTarget,
} from '../../ReactModulationPanel'
import {
  LASER_DMX_BEAM_MATRIX_PRESETS,
} from '../../laserDmxBeamMatrixPresets'
import type {
  LaserDmxBeamMatrixSettings,
  LaserDmxMatrixBeam,
  LaserDmxBeamMatrixOutputSettings,
  LaserDmxModulationRoute,
  LaserDmxReactionGroup,
} from '../../ReactTypes'
import { DEFAULT_BEAM_MOTION, DEFAULT_BEAM_SEQUENCE, DEFAULT_LAUNCH_SETTINGS } from '../../ReactTypes'

vi.stubGlobal('crypto', { randomUUID: (() => { let n = 0; return () => `uuid-${++n}` })() })

// ── MI frame stub ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeMI(bands: Record<string, number> = {}): any {
  return {
    frameId: 1,
    bands:   { sub: 0, bass: 0, lowMid: 0, mid: 0, high: 0, air: 0, volume: 0, normalizedSub: 0, normalizedBass: 0, normalizedLowMid: 0, normalizedMid: 0, normalizedHigh: 0, normalizedAir: 0, ...bands },
    rhythm:  { beatHit: false, kickHit: false, snareHit: false, hatHit: false, downbeatHit: false, phrase4Hit: false, phrase8Hit: false, phrase16Hit: false, phrase32Hit: false, beatPhase: 0, bpm: 120, transient: 0, kickStrength: 0, snareStrength: 0, hatStrength: 0 },
    energy:  { instant: 0, shortTerm: 0, longTerm: 0, spectralFlux: 0, tension: 0, complexity: 0, buildProgress: 0, dropImpact: 0, rms: 0, peak: 0, crestFactor: 0, percentile: 0, delta: 0, spectralCentroid: 0, spectralSpread: 0, spectralRolloff: 0, spectralFlatness: 0 },
    harmonic:  { pitchHz: null, keyConfidence: 0, chordConfidence: 0, chordChanged: false, mode: 'unknown' },
    stems:   { vocals: 0, drums: 0, bassStemEnergy: 0, instrumentEnergy: 0, vocalEnergy: 0, drumEnergy: 0, vocalActivity: 0, drumTransient: false, bassStemTransient: false },
    lyrics:  { vocalActivity: 0, lyricLineProgress: 0, phraseConfidence: 0, wordHit: false, activeLine: null, activeWord: null },
    semantics: { buildConfidence: 0, dropConfidence: 0, fakeoutConfidence: 0, vocalHookConfidence: 0, mood: 'unknown' },
    section: { type: 'unknown', progress: 0, intensity: 0 },
  }
}

// ── Settings helpers ──────────────────────────────────────────────────────────

function makeBeam(overrides: Partial<LaserDmxMatrixBeam> = {}): LaserDmxMatrixBeam {
  return {
    id: 'test-beam', name: 'Test', enabled: true,
    sequenceIndex: 0,
    origin: { column: 8, row: 5, z: 0 },
    target: { kind: 'grid', column: 8, row: 9, z: 0 },
    groupId: null, useGroupColor: false,
    color: { red: 0, green: 255, blue: 220, white: 0, alpha: 1 },
    appearance: { dimmer: 1, shutterOpen: true, width: 1, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' },
    motion: DEFAULT_BEAM_MOTION,
    modulationRoutes: [],
    ...overrides,
  }
}

function makeOutput(overrides: Partial<LaserDmxBeamMatrixOutputSettings> = {}): LaserDmxBeamMatrixOutputSettings {
  return {
    masterDimmer: 1, blackout: false, safetyClamp: 1,
    backgroundFade: 0.18, beamPersistence: 0.6,
    globalBeamWidth: 1, globalGlow: 0.65, globalStrobeRate: 0,
    ...overrides,
  }
}

function makeSettings(
  beams: LaserDmxMatrixBeam[],
  outputOverrides: Partial<LaserDmxBeamMatrixOutputSettings> = {},
  groups: LaserDmxReactionGroup[] = [],
  globalRoutes: LaserDmxModulationRoute[] = [],
): LaserDmxBeamMatrixSettings {
  return {
    selectedBeamIds: [], selectedGroupId: null,
    beams, groups,
    globalModulationRoutes: globalRoutes,
    output: makeOutput(outputOverrides),
    fog: { enabled: false, density: 0.4, opacity: 0.5, noiseScale: 1, driftSpeed: 0.15, driftDirection: 0.25, turbulence: 0.2, diffusion: 0.3, dissipation: 0.4, beamScatter: 0.2, colorAbsorption: 0.1, quality: 'medium' },
    editor: { guidesVisible: true, snapEnabled: true, overscanAmount: 0, beamEditorVisible: true, beamPathsVisible: true },
  }
}

function mkRoute(overrides: Partial<LaserDmxModulationRoute>): LaserDmxModulationRoute {
  return {
    id: 'r1', enabled: true, source: 'bass', target: 'dimmer',
    amount: 1, min: 0, max: 1, curve: 'linear', mode: 'set' as const,
    smoothing: 0, attack: 0, release: 0, invert: false,
    ...overrides,
  }
}

function compile(settings: LaserDmxBeamMatrixSettings, mi = makeMI()) {
  return compileLaserDmxBeamMatrix({ settings, mi, time: 0, timeSec: 1, canvasWidth: 800, canvasHeight: 600 })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetBeamMatrixCompilerState()
  resetAllEnvelopes()
})

// 1 ── Matrix master dimmer applied exactly once ───────────────────────────────

describe('1 — master dimmer applied exactly once', () => {
  it('doubling masterDimmer doubles beam.intensity, not quadruples it', () => {
    const half = compile(makeSettings([makeBeam()], { masterDimmer: 0.5, safetyClamp: 1 }))
    resetBeamMatrixCompilerState()
    const full = compile(makeSettings([makeBeam()], { masterDimmer: 1.0, safetyClamp: 1 }))
    const halfI = half.beams[0].intensity
    const fullI = full.beams[0].intensity
    // ratio should be ≈ 2 (linear), not 4 (masterDimmer²)
    expect(fullI / halfI).toBeCloseTo(2, 1)
  })

  it('beam.rgba.a equals source color alpha and is not scaled by masterDimmer', () => {
    const settings = makeSettings([makeBeam({ color: { red: 0, green: 255, blue: 220, white: 0, alpha: 0.7 } })], { masterDimmer: 0.5, safetyClamp: 1 })
    const result = compile(settings)
    expect(result.beams[0].rgba.a).toBeCloseTo(0.7, 3)
  })
})

// 2 ── Group dimmer applied exactly once ──────────────────────────────────────

describe('2 — group dimmer applied exactly once', () => {
  it('group dimmer route produces linear intensity effect', () => {
    const group: LaserDmxReactionGroup = {
      id: 'g1', name: 'G1', enabled: true, muted: false, soloed: false,
      colorOverrideEnabled: false,
      color: { red: 255, green: 255, blue: 255, white: 0, alpha: 1 },
      sequence: DEFAULT_BEAM_SEQUENCE,
      launch: DEFAULT_LAUNCH_SETTINGS,
      maxActiveBeams: 0,
      modulationRoutes: [
        mkRoute({ source: 'nBass', target: 'dimmer', min: 0, max: 0.5 }),
      ],
    }
    const beam = makeBeam({ groupId: 'g1', appearance: { dimmer: 1, shutterOpen: true, width: 1, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' } })
    const mi = makeMI({ normalizedBass: 1.0 })
    const result = compileLaserDmxBeamMatrix({ settings: makeSettings([beam], { masterDimmer: 1, safetyClamp: 1 }, [group]), mi, time: 0, timeSec: 1, canvasWidth: 800, canvasHeight: 600 })
    // group dimmer = lerp(0, 0.5, 1) = 0.5 → beam.intensity ≈ 0.5
    expect(result.beams[0].intensity).toBeCloseTo(0.5, 2)
  })
})

// 3 ── Beam alpha and intensity have separate responsibilities ─────────────────

describe('3 — beam alpha and intensity are separate', () => {
  it('beam.rgba.a is color alpha only (not multiplied by dimmer)', () => {
    const beam = makeBeam({ color: { red: 0, green: 255, blue: 220, white: 0, alpha: 0.6 }, appearance: { dimmer: 0.8, shutterOpen: true, width: 1, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' } })
    const result = compile(makeSettings([beam], { masterDimmer: 0.5, safetyClamp: 1 }))
    expect(result.beams[0].rgba.a).toBeCloseTo(0.6, 3)
  })

  it('beam.intensity carries all dimmer factors (beam × master)', () => {
    const beam = makeBeam({ color: { red: 0, green: 255, blue: 220, white: 0, alpha: 1 }, appearance: { dimmer: 0.8, shutterOpen: true, width: 1, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' } })
    const result = compile(makeSettings([beam], { masterDimmer: 0.5, safetyClamp: 1 }))
    // finalIntensity = dimmer(0.8) × masterDimmer(0.5) × safetyClamp(1) × oIS(1) = 0.4
    expect(result.beams[0].intensity).toBeCloseTo(0.4, 2)
  })
})

// 4 ── Negative target offsets remain negative ─────────────────────────────────

describe('4 — negative target offsets remain negative', () => {
  it('applyModulationRoute with min=-0.12 returns negative value when source=0', () => {
    const route = mkRoute({ source: 'bass', target: 'targetOffsetX', min: -0.12, max: 0.12, mode: 'set' })
    const mi = makeMI({ bass: 0 })
    const result = applyModulationRoute(route, mi, 'env:test', 1 / 60)
    // lerp(-0.12, 0.12, 0) = -0.12; should NOT be clamped to 0
    expect(result!.value).toBeCloseTo(-0.12, 3)
  })

  it('applyModulationRoute with min=-0.15 returns negative value when source=0', () => {
    const route = mkRoute({ source: 'bass', target: 'targetOffsetX', min: -0.15, max: 0.15, mode: 'set' })
    const mi = makeMI({ bass: 0 })
    const result = applyModulationRoute(route, mi, 'env:test2', 1 / 60)
    expect(result!.value).toBeCloseTo(-0.15, 3)
  })
})

// 5 ── Bipolar modulation moves both left/right or up/down ────────────────────

describe('5 — bipolar offset modulation produces both positive and negative offsets', () => {
  it('source=0 produces negative targetOffsetX', () => {
    const route = mkRoute({ source: 'bass', target: 'targetOffsetX', min: -0.2, max: 0.2, mode: 'set' })
    const result = applyModulationRoute(route, makeMI({ bass: 0 }), 'env:bip-left', 1 / 60)
    expect(result!.value).toBeLessThan(0)
  })

  it('source=1 produces positive targetOffsetX', () => {
    const route = mkRoute({ source: 'bass', target: 'targetOffsetX', min: -0.2, max: 0.2, mode: 'set' })
    const result = applyModulationRoute(route, makeMI({ bass: 1 }), 'env:bip-right', 1 / 60)
    expect(result!.value).toBeGreaterThan(0)
  })

  it('source=0.5 produces near-zero targetOffsetX (midpoint of bipolar range)', () => {
    const route = mkRoute({ source: 'bass', target: 'targetOffsetX', min: -0.2, max: 0.2, mode: 'set' })
    const result = applyModulationRoute(route, makeMI({ bass: 0.5 }), 'env:bip-mid', 1 / 60)
    expect(Math.abs(result!.value)).toBeLessThan(0.01)
  })
})

// 6 ── Global target list contains only globally supported targets ─────────────

describe('6 — BM_GLOBAL_TARGETS contains only globally supported targets', () => {
  const KNOWN_GLOBAL = new Set([
    'masterDimmer', 'backgroundFade', 'beamPersistence',
    'globalBeamWidth', 'globalGlow', 'globalStrobeRate',
    'fogDensity', 'fogOpacity', 'fogBeamScatter', 'fogTurbulence',
  ])

  it('every BM_GLOBAL_TARGETS entry is in the applyGlobalRoute dispatch table', () => {
    for (const t of BM_GLOBAL_TARGETS) {
      expect(KNOWN_GLOBAL.has(t.value)).toBe(true)
    }
  })

  it('BM_GLOBAL_TARGETS does not contain beam-only targets (e.g. originOffsetX, dimmer)', () => {
    const vals = BM_GLOBAL_TARGETS.map(t => t.value)
    expect(vals).not.toContain('originOffsetX')
    expect(vals).not.toContain('dimmer')
    expect(vals).not.toContain('alpha')
  })
})

// 7 ── Group target list contains only group-supported targets ─────────────────

describe('7 — BM_GROUP_TARGETS contains only group-supported targets', () => {
  const KNOWN_GROUP = new Set(['dimmer', 'beamWidth', 'beamDivergence', 'beamGlow', 'strobeRate'])

  it('every BM_GROUP_TARGETS entry is in the compileGroupRoutes dispatch table', () => {
    for (const t of BM_GROUP_TARGETS) {
      expect(KNOWN_GROUP.has(t.value)).toBe(true)
    }
  })

  it('BM_GROUP_TARGETS does not contain global-only targets (e.g. masterDimmer, fogDensity)', () => {
    const vals = BM_GROUP_TARGETS.map(t => t.value)
    expect(vals).not.toContain('masterDimmer')
    expect(vals).not.toContain('fogDensity')
    expect(vals).not.toContain('fogOpacity')
  })
})

// 8 ── Beam target list contains only beam-supported targets ───────────────────

describe('8 — BM_BEAM_TARGETS contains only beam-supported targets', () => {
  const KNOWN_BEAM = new Set([
    'dimmer', 'beamWidth', 'beamDivergence', 'focus', 'beamGlow',
    'strobeRate', 'flickerAmount', 'alpha', 'red', 'green', 'blue', 'white',
    'originOffsetX', 'originOffsetY', 'targetOffsetX', 'targetOffsetY',
  ])

  it('every BM_BEAM_TARGETS entry is in the applyBeamRoute dispatch table', () => {
    for (const t of BM_BEAM_TARGETS) {
      expect(KNOWN_BEAM.has(t.value)).toBe(true)
    }
  })

  it('BM_BEAM_TARGETS contains offset targets needed for bipolar scan routes', () => {
    const vals = BM_BEAM_TARGETS.map(t => t.value)
    expect(vals).toContain('targetOffsetX')
    expect(vals).toContain('targetOffsetY')
    expect(vals).toContain('originOffsetX')
    expect(vals).toContain('originOffsetY')
  })
})

// 9 ── New routes receive valid scope-specific defaults ────────────────────────

describe('9 — scope-aware route factories produce valid default targets', () => {
  it('global route default target passes validateRouteTarget for global scope', () => {
    // makeNewModulationRoute() → masterDimmer (valid global)
    expect(validateRouteTarget('masterDimmer', 'global')).toBe(true)
  })

  it('group route default target passes validateRouteTarget for group scope', () => {
    // makeNewGroupRoute() → dimmer (valid group)
    expect(validateRouteTarget('dimmer', 'group')).toBe(true)
  })

  it('beam route default target passes validateRouteTarget for beam scope', () => {
    // makeNewBeamRoute() → dimmer (valid beam)
    expect(validateRouteTarget('dimmer', 'beam')).toBe(true)
  })

  it('old global default (masterDimmer) is invalid at group scope', () => {
    expect(validateRouteTarget('masterDimmer', 'group')).toBe(false)
  })

  it('old global default (masterDimmer) is invalid at beam scope', () => {
    expect(validateRouteTarget('masterDimmer', 'beam')).toBe(false)
  })
})

// 10 ── Route min/max mapping occurs exactly once ─────────────────────────────

describe('10 — min/max mapping applied once (group beamWidth)', () => {
  it('group beamWidth at source=0.5 gives midpoint of [min, max], not max', () => {
    const group: LaserDmxReactionGroup = {
      id: 'g-width', name: 'G', enabled: true, muted: false, soloed: false,
      colorOverrideEnabled: false,
      color: { red: 255, green: 255, blue: 255, white: 0, alpha: 1 },
      sequence: DEFAULT_BEAM_SEQUENCE,
      launch: DEFAULT_LAUNCH_SETTINGS,
      maxActiveBeams: 0,
      modulationRoutes: [
        mkRoute({ source: 'nBass', target: 'beamWidth', min: 0.5, max: 3.5, mode: 'set' }),
      ],
    }
    const beam = makeBeam({ groupId: 'g-width' })
    const mi = makeMI({ normalizedBass: 0.5 })
    const result = compileLaserDmxBeamMatrix({ settings: makeSettings([beam], { globalBeamWidth: 1, safetyClamp: 1 }, [group]), mi, time: 0, timeSec: 1, canvasWidth: 800, canvasHeight: 600 })
    // lerp(0.5, 3.5, 0.5) = 2.0  (midpoint)
    // Old double-map: clamp01(2.0)=1.0 → lerp(0.5,3.5,1.0) = 3.5 (wrong)
    expect(result.beams[0].beamWidth).toBeCloseTo(2.0, 1)
    expect(result.beams[0].beamWidth).not.toBeCloseTo(3.5, 1)
  })
})

// 11 ── Unsupported saved routes are flagged and disabled ─────────────────────

describe('11 — validateRouteTarget flags scope-invalid targets', () => {
  it('masterDimmer is valid for global scope', () => {
    expect(validateRouteTarget('masterDimmer', 'global')).toBe(true)
  })

  it('masterDimmer is invalid for group scope', () => {
    expect(validateRouteTarget('masterDimmer', 'group')).toBe(false)
  })

  it('masterDimmer is invalid for beam scope', () => {
    expect(validateRouteTarget('masterDimmer', 'beam')).toBe(false)
  })

  it('targetOffsetX is invalid for global scope', () => {
    expect(validateRouteTarget('targetOffsetX', 'global')).toBe(false)
  })

  it('targetOffsetX is invalid for group scope', () => {
    expect(validateRouteTarget('targetOffsetX', 'group')).toBe(false)
  })

  it('targetOffsetX is valid for beam scope', () => {
    expect(validateRouteTarget('targetOffsetX', 'beam')).toBe(true)
  })

  it('fogDensity is valid for global scope', () => {
    expect(validateRouteTarget('fogDensity', 'global')).toBe(true)
  })

  it('fogDensity is invalid for group scope', () => {
    expect(validateRouteTarget('fogDensity', 'group')).toBe(false)
  })

  it('fogDensity is invalid for beam scope', () => {
    expect(validateRouteTarget('fogDensity', 'beam')).toBe(false)
  })

  it('unknown/removed targets (shutter, targetDepth, fogDriftSpeed) are invalid at all scopes', () => {
    for (const scope of ['global', 'group', 'beam'] as const) {
      expect(validateRouteTarget('shutter',      scope)).toBe(false)
      expect(validateRouteTarget('targetDepth',  scope)).toBe(false)
      expect(validateRouteTarget('fogDriftSpeed', scope)).toBe(false)
    }
  })
})

// 12 ── Factory presets contain no unsupported routes ─────────────────────────

describe('12 — factory presets contain no unsupported routes', () => {
  it('all preset global routes pass validateRouteTarget for global scope', () => {
    for (const preset of LASER_DMX_BEAM_MATRIX_PRESETS) {
      const s = preset.createSettings()
      for (const r of s.globalModulationRoutes) {
        expect(validateRouteTarget(r.target, 'global')).toBe(true)
      }
    }
  })

  it('all preset group routes pass validateRouteTarget for group scope', () => {
    for (const preset of LASER_DMX_BEAM_MATRIX_PRESETS) {
      const s = preset.createSettings()
      for (const g of s.groups) {
        for (const r of g.modulationRoutes) {
          expect(validateRouteTarget(r.target, 'group')).toBe(true)
        }
      }
    }
  })

  it('all preset beam routes pass validateRouteTarget for beam scope', () => {
    for (const preset of LASER_DMX_BEAM_MATRIX_PRESETS) {
      const s = preset.createSettings()
      for (const b of s.beams) {
        for (const r of b.modulationRoutes) {
          expect(validateRouteTarget(r.target, 'beam')).toBe(true)
        }
      }
    }
  })
})

// 13 ── No visible target silently falls into unimplemented default branch ─────

describe('13 — every visible target has a compiler implementation', () => {
  it('all BM_GLOBAL_TARGETS entries are handled by applyGlobalRoute (compile test)', () => {
    const KNOWN_GLOBAL = new Set([
      'masterDimmer', 'backgroundFade', 'beamPersistence',
      'globalBeamWidth', 'globalGlow', 'globalStrobeRate',
      'fogDensity', 'fogOpacity', 'fogBeamScatter', 'fogTurbulence',
    ])
    const missing = BM_GLOBAL_TARGETS.filter(t => !KNOWN_GLOBAL.has(t.value))
    expect(missing).toHaveLength(0)
  })

  it('all BM_GROUP_TARGETS entries are handled by compileGroupRoutes', () => {
    const KNOWN_GROUP = new Set(['dimmer', 'beamWidth', 'beamDivergence', 'beamGlow', 'strobeRate'])
    const missing = BM_GROUP_TARGETS.filter(t => !KNOWN_GROUP.has(t.value))
    expect(missing).toHaveLength(0)
  })

  it('all BM_BEAM_TARGETS entries are handled by applyBeamRoute', () => {
    const KNOWN_BEAM = new Set([
      'dimmer', 'beamWidth', 'beamDivergence', 'focus', 'beamGlow',
      'strobeRate', 'flickerAmount', 'alpha', 'red', 'green', 'blue', 'white',
      'originOffsetX', 'originOffsetY', 'targetOffsetX', 'targetOffsetY',
    ])
    const missing = BM_BEAM_TARGETS.filter(t => !KNOWN_BEAM.has(t.value))
    expect(missing).toHaveLength(0)
  })
})

// 14 ── Normalized coordinate offsets (viewport-relative) ─────────────────────
//
// Grid column=8, row=9 on an 800×600 canvas resolves to:
//   targetBase.x = (8 - 0.5) / 15 * 800 = 400
//   targetBase.y = (9 - 0.5) / 10 * 600 = 510
// Origin column=8, row=5:
//   originBase.x = (8 - 0.5) / 15 * 800 = 400
//   originBase.y = (5 - 0.5) / 10 * 600 = 270
//
// Offset 0.10 → +80 px X on 800px canvas, +60 px Y on 600px canvas.
// ─────────────────────────────────────────────────────────────────────────────

import { migrateReactStore } from '../../../../../stores/reactStore'

function compileFull(
  settings: LaserDmxBeamMatrixSettings,
  W: number,
  H: number,
  mi = makeMI(),
) {
  return compileLaserDmxBeamMatrix({ settings, mi, time: 0, timeSec: 1, canvasWidth: W, canvasHeight: H })
}

describe('14 — normalized coordinate offsets produce correct pixel movement', () => {
  const W = 800, H = 600
  // Baseline target pixel coordinates for the default makeBeam() target (col=8, row=9)
  const BASE_TX = (8 - 0.5) / 15 * W  // 400
  const BASE_TY = (9 - 0.5) / 10 * H  // 510
  // Baseline origin pixel coordinates for the default makeBeam() origin (col=8, row=5)
  const BASE_OX = (8 - 0.5) / 15 * W  // 400
  const BASE_OY = (5 - 0.5) / 10 * H  // 270

  it('targetOffsetX 0.10 shifts target by exactly 10% of canvas width', () => {
    const beam = makeBeam({
      modulationRoutes: [mkRoute({ target: 'targetOffsetX', source: 'bass', min: 0.10, max: 0.10, mode: 'set' })],
    })
    const result = compileFull(makeSettings([beam]), W, H, makeMI({ bass: 1 }))
    expect(result.beams[0].target.x).toBeCloseTo(BASE_TX + 0.10 * W, 1)
  })

  it('targetOffsetX -0.10 shifts target by -10% of canvas width', () => {
    const beam = makeBeam({
      modulationRoutes: [mkRoute({ target: 'targetOffsetX', source: 'bass', min: -0.10, max: -0.10, mode: 'set' })],
    })
    const result = compileFull(makeSettings([beam]), W, H, makeMI({ bass: 1 }))
    expect(result.beams[0].target.x).toBeCloseTo(BASE_TX - 0.10 * W, 1)
  })

  it('targetOffsetY 0.10 shifts target by exactly 10% of canvas height', () => {
    const beam = makeBeam({
      modulationRoutes: [mkRoute({ target: 'targetOffsetY', source: 'bass', min: 0.10, max: 0.10, mode: 'set' })],
    })
    const result = compileFull(makeSettings([beam]), W, H, makeMI({ bass: 1 }))
    expect(result.beams[0].target.y).toBeCloseTo(BASE_TY + 0.10 * H, 1)
  })

  it('canvas resize proportionality: same 0.10 offset produces 2× pixel movement on 2× canvas', () => {
    const beam = makeBeam({
      modulationRoutes: [mkRoute({ target: 'targetOffsetX', source: 'bass', min: 0.10, max: 0.10, mode: 'set' })],
    })
    const r800  = compileFull(makeSettings([beam]), 800,  600,  makeMI({ bass: 1 }))
    resetBeamMatrixCompilerState()
    const r1600 = compileFull(makeSettings([beam]), 1600, 1200, makeMI({ bass: 1 }))
    const base800  = (8 - 0.5) / 15 * 800
    const base1600 = (8 - 0.5) / 15 * 1600
    const delta800  = r800.beams[0].target.x  - base800
    const delta1600 = r1600.beams[0].target.x - base1600
    expect(delta1600 / delta800).toBeCloseTo(2, 2)
  })

  it('modulation offset does not mutate the saved beam.target', () => {
    const beam = makeBeam({
      modulationRoutes: [mkRoute({ target: 'targetOffsetX', source: 'bass', min: 0.50, max: 0.50, mode: 'set' })],
    })
    const originalColumn = beam.target.kind === 'grid' ? beam.target.column : null
    compileFull(makeSettings([beam]), W, H, makeMI({ bass: 1 }))
    expect(beam.target.kind === 'grid' ? (beam.target as { column: number }).column : null)
      .toBe(originalColumn)
  })

  it('originOffsetX 0.10 shifts origin by 10% of canvas width', () => {
    const beam = makeBeam({
      modulationRoutes: [mkRoute({ target: 'originOffsetX', source: 'bass', min: 0.10, max: 0.10, mode: 'set' })],
    })
    const result = compileFull(makeSettings([beam]), W, H, makeMI({ bass: 1 }))
    expect(result.beams[0].origin.x).toBeCloseTo(BASE_OX + 0.10 * W, 1)
  })

  it('originOffsetY 0.10 shifts origin by 10% of canvas height', () => {
    const beam = makeBeam({
      modulationRoutes: [mkRoute({ target: 'originOffsetY', source: 'bass', min: 0.10, max: 0.10, mode: 'set' })],
    })
    const result = compileFull(makeSettings([beam]), W, H, makeMI({ bass: 1 }))
    expect(result.beams[0].origin.y).toBeCloseTo(BASE_OY + 0.10 * H, 1)
  })

  it('stage target supports dynamic offsets the same way as grid target', () => {
    const beam = makeBeam({
      target: { kind: 'stage', x: 0.5, y: 0.5, z: 0 },
      modulationRoutes: [mkRoute({ target: 'targetOffsetX', source: 'bass', min: 0.10, max: 0.10, mode: 'set' })],
    })
    const result = compileFull(makeSettings([beam]), W, H, makeMI({ bass: 1 }))
    // stage base x = 0.5 * 800 = 400; offset 0.10 * 800 = 80 → 480
    expect(result.beams[0].target.x).toBeCloseTo(0.5 * W + 0.10 * W, 1)
  })

  it('negative route range moves target in the negative direction', () => {
    const beam = makeBeam({
      modulationRoutes: [mkRoute({ target: 'targetOffsetX', source: 'bass', min: -0.30, max: -0.10, mode: 'set' })],
    })
    const result = compileFull(makeSettings([beam]), W, H, makeMI({ bass: 1 }))
    // max = -0.10, bass=1 → lerp(-0.30, -0.10, 1) = -0.10 → 400 - 80 = 320
    expect(result.beams[0].target.x).toBeCloseTo(BASE_TX - 0.10 * W, 1)
    expect(result.beams[0].target.x).toBeLessThan(BASE_TX)
  })

  it('dimmer route still clamps to 0–1 (non-offset targets retain existing limits)', () => {
    const beam = makeBeam({
      modulationRoutes: [mkRoute({ target: 'dimmer', source: 'bass', min: 2.0, max: 5.0, mode: 'set' })],
    })
    const result = compileFull(makeSettings([beam], { masterDimmer: 1, safetyClamp: 1 }), W, H, makeMI({ bass: 1 }))
    expect(result.beams[0].intensity).toBeLessThanOrEqual(1.0)
  })

  it('preset min/max values of ±0.12 produce ~10% canvas movement', () => {
    const beam = makeBeam({
      modulationRoutes: [mkRoute({ target: 'targetOffsetX', source: 'bass', min: -0.12, max: 0.12, mode: 'set' })],
    })
    const resultMax = compileFull(makeSettings([beam]), W, H, makeMI({ bass: 1 }))
    const pixelDelta = Math.abs(resultMax.beams[0].target.x - BASE_TX)
    // 0.12 * 800 = 96px ≈ 12% of canvas width — should be clearly visible (> 5%)
    expect(pixelDelta).toBeGreaterThan(W * 0.05)
    expect(pixelDelta).toBeCloseTo(0.12 * W, 0)
  })
})

// 15 ── v6→v7 migration: legacy pixel values converted to normalized ────────────

describe('15 — v6→v7 migration converts legacy pixel-range offset values to normalized', () => {
  it('offset route with |min| > 2 is divided by 200', () => {
    const state = {
      laserDmxBeamMatrix: {
        beams: [{
          id: 'b1', name: 'B',
          modulationRoutes: [
            { id: 'r1', enabled: true, source: 'bass', target: 'targetOffsetX',
              amount: 1, min: -24, max: 24, curve: 'linear', mode: 'set',
              smoothing: 0, attack: 0, release: 0, invert: false },
          ],
        }],
        groups: [],
      },
    }
    const migrated = migrateReactStore(state, 6)
    const bm = migrated.laserDmxBeamMatrix as Record<string, unknown>
    const beams = bm.beams as Array<Record<string, unknown>>
    const routes = beams[0].modulationRoutes as Array<Record<string, unknown>>
    expect(routes[0].min).toBeCloseTo(-0.12, 4)
    expect(routes[0].max).toBeCloseTo( 0.12, 4)
  })

  it('offset route with |max| > 2 is divided by 200', () => {
    const state = {
      laserDmxBeamMatrix: {
        beams: [{
          id: 'b1', name: 'B',
          modulationRoutes: [
            { id: 'r1', enabled: true, source: 'bass', target: 'originOffsetY',
              amount: 1, min: 0, max: 200, curve: 'linear', mode: 'set',
              smoothing: 0, attack: 0, release: 0, invert: false },
          ],
        }],
        groups: [],
      },
    }
    const migrated = migrateReactStore(state, 6)
    const bm = migrated.laserDmxBeamMatrix as Record<string, unknown>
    const beams = bm.beams as Array<Record<string, unknown>>
    const routes = beams[0].modulationRoutes as Array<Record<string, unknown>>
    expect(routes[0].max).toBeCloseTo(1.0, 4)
  })

  it('offset route already in normalized range (|val| ≤ 2) is left unchanged', () => {
    const state = {
      laserDmxBeamMatrix: {
        beams: [{
          id: 'b1', name: 'B',
          modulationRoutes: [
            { id: 'r1', enabled: true, source: 'bass', target: 'targetOffsetX',
              amount: 1, min: -0.12, max: 0.12, curve: 'linear', mode: 'set',
              smoothing: 0, attack: 0, release: 0, invert: false },
          ],
        }],
        groups: [],
      },
    }
    const migrated = migrateReactStore(state, 6)
    const bm = migrated.laserDmxBeamMatrix as Record<string, unknown>
    const beams = bm.beams as Array<Record<string, unknown>>
    const routes = beams[0].modulationRoutes as Array<Record<string, unknown>>
    expect(routes[0].min).toBeCloseTo(-0.12, 4)
    expect(routes[0].max).toBeCloseTo( 0.12, 4)
  })

  it('non-offset routes are not touched by v7 migration', () => {
    const state = {
      laserDmxBeamMatrix: {
        beams: [{
          id: 'b1', name: 'B',
          modulationRoutes: [
            { id: 'r1', enabled: true, source: 'bass', target: 'dimmer',
              amount: 1, min: 0, max: 100, curve: 'linear', mode: 'set',
              smoothing: 0, attack: 0, release: 0, invert: false },
          ],
        }],
        groups: [],
      },
    }
    const migrated = migrateReactStore(state, 6)
    const bm = migrated.laserDmxBeamMatrix as Record<string, unknown>
    const beams = bm.beams as Array<Record<string, unknown>>
    const routes = beams[0].modulationRoutes as Array<Record<string, unknown>>
    // dimmer route with large max should be untouched
    expect(routes[0].max).toBe(100)
  })

  it('v7 migration handles group routes too', () => {
    const state = {
      laserDmxBeamMatrix: {
        beams: [],
        groups: [{
          id: 'g1', name: 'G',
          modulationRoutes: [
            { id: 'r1', enabled: true, source: 'bass', target: 'targetOffsetY',
              amount: 1, min: -30, max: 30, curve: 'linear', mode: 'set',
              smoothing: 0, attack: 0, release: 0, invert: false },
          ],
        }],
      },
    }
    const migrated = migrateReactStore(state, 6)
    const bm = migrated.laserDmxBeamMatrix as Record<string, unknown>
    const groups = bm.groups as Array<Record<string, unknown>>
    const routes = groups[0].modulationRoutes as Array<Record<string, unknown>>
    expect(routes[0].min).toBeCloseTo(-0.15, 4)
    expect(routes[0].max).toBeCloseTo( 0.15, 4)
  })
})
