/**
 * Tests for the Shader engine modulation matrix, evaluator, and envelope.
 *
 * A — applyCurve: all 7 curves
 * B — ShaderModulationEnvelope: trigger/gate, retrigger, phase progression
 * C — ShaderModulationMatrix: CRUD, validation, target rejection
 * D — ShaderModulationEvaluator: float add/multiply/replace
 * E — ShaderModulationEvaluator: inversion
 * F — ShaderModulationEvaluator: range clamping
 * G — ShaderModulationEvaluator: multiple routes on one param
 * H — ShaderModulationEvaluator: NaN / Infinity protection
 * I — ShaderModulationEvaluator: scene-change reset
 * J — ShaderModulationEvaluator: stable delta-time smoothing
 * K — ShaderModulationEvaluator: color param modulation
 * L — ShaderModulationEvaluator: vec2 param modulation
 * M — ShaderModulationEvaluator: boolean threshold
 * N — ShaderModulationEvaluator: trigger mode
 * O — ShaderModulationMatrix: non-modulatable target rejection
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { applyCurve, ShaderModulationEvaluator } from '../ShaderModulationEvaluator'
import { ShaderModulationEnvelope }  from '../ShaderModulationEnvelope'
import { ShaderModulationMatrix }    from '../ShaderModulationMatrix'
import {
  createModulationRoute,
  MODULATION_SOURCE_META,
} from '../shaderModulationTypes'
import type { ShaderModulationRoute } from '../shaderModulationTypes'
import type { ShaderDefinition }      from '../../registry/shaderRegistryTypes'
import type { MusicIntelligenceFrame } from '../../../../../../features/musicIntelligence/types'
import { MI_SOURCE_REGISTRY } from '../../../../../../lib/miSourceRegistry'
import type {
  ShaderAudioUniformFrame,
} from '../../audio/shaderAudioTypes'
import type {
  ShaderTimingUniformFrame,
} from '../../audio/shaderAudioTypes'
import { NEUTRAL_AUDIO_FRAME, NEUTRAL_TIMING_FRAME } from '../../audio/shaderAudioTypes'

// ── Test fixtures ─────────────────────────────────────────────────────────────

function makeFloatDef(modulatable = true): ShaderDefinition {
  return {
    id: 'test-shader',
    name: 'Test Shader',
    description: 'Modulation test fixture.',
    category: 'utility',
    version: 1,
    fragSrc: '#version 300 es\nvoid main(){}',
    params: [
      {
        id: 'speed',
        type: 'float',
        label: 'Speed',
        uniformName: 'u_speed',
        min: 0, max: 2, default: 1.0,
        modulatable,
      },
      {
        id: 'tint',
        type: 'color',
        label: 'Tint',
        uniformName: 'u_tint',
        default: [0.5, 0.5, 0.5, 1.0],
        modulatable: true,
      },
      {
        id: 'center',
        type: 'vec2',
        label: 'Center',
        uniformName: 'u_center',
        min: [-1, -1], max: [1, 1],
        default: [0, 0],
        modulatable: true,
      },
      {
        id: 'glow',
        type: 'boolean',
        label: 'Glow',
        uniformName: 'u_glow',
        default: false,
        modulatable: true,
      },
      {
        id: 'tex',
        type: 'texture',
        label: 'Texture',
        uniformName: 'u_tex',
        acceptedSources: ['uploaded-image'],
        modulatable: false,
      },
    ],
    defaults: {
      speed: 1.0,
      tint:  [0.5, 0.5, 0.5, 1.0],
      center: [0, 0],
      glow: false,
    },
  }
}

const BASE_PARAMS = {
  speed:  1.0,
  tint:   [0.5, 0.5, 0.5, 1.0] as [number, number, number, number],
  center: [0, 0] as [number, number],
  glow:   false,
}

function makeAudio(overrides: Partial<ShaderAudioUniformFrame> = {}): ShaderAudioUniformFrame {
  return { ...NEUTRAL_AUDIO_FRAME, ...overrides }
}

function makeTiming(overrides: Partial<ShaderTimingUniformFrame> = {}): ShaderTimingUniformFrame {
  return { ...NEUTRAL_TIMING_FRAME, ...overrides }
}

function makeRoute(
  overrides: Partial<ShaderModulationRoute> & { source?: ShaderModulationRoute['source'] } = {},
): ShaderModulationRoute {
  return createModulationRoute({
    source:       overrides.source       ?? 'energy',
    targetParamId: overrides.targetParamId ?? 'speed',
    ...overrides,
  })
}

function evaluate(
  evaluator: ShaderModulationEvaluator,
  matrix:    ShaderModulationMatrix,
  def:       ShaderDefinition,
  audio:     ShaderAudioUniformFrame,
  timing:    ShaderTimingUniformFrame,
  base = BASE_PARAMS,
  dt   = 0.016,
  scene = 'test-shader',
  miFrame?: MusicIntelligenceFrame | null,
) {
  return evaluator.evaluate(matrix, def, audio, timing, base, dt, scene, miFrame)
}

// ── A — Curves ───────────────────────────────────────────────────────────────

describe('A — applyCurve', () => {
  const cases: Array<[string, number, number]> = [
    ['linear',      0.5, 0.5],
    ['easeIn',      0.5, 0.25],      // 0.5^2
    ['easeOut',     0.5, 0.75],      // 1-(1-0.5)^2
    ['easeInOut',   0.5, 0.5],       // midpoint is always 0.5 for symmetric
    ['exponential', 0.5, 0.125],     // 0.5^3
  ]

  for (const [curve, x, expected] of cases) {
    it(`${curve}: f(${x}) ≈ ${expected}`, () => {
      const result = applyCurve(x, curve as never)
      expect(result).toBeCloseTo(expected, 3)
    })
  }

  it('linear: f(0)=0, f(1)=1', () => {
    expect(applyCurve(0, 'linear')).toBe(0)
    expect(applyCurve(1, 'linear')).toBe(1)
  })

  it('logarithmic: f(0)=0, f(1)=1', () => {
    expect(applyCurve(0, 'logarithmic')).toBeCloseTo(0)
    expect(applyCurve(1, 'logarithmic')).toBeCloseTo(1, 4)
  })

  it('logarithmic: concave (f(0.5) > 0.5)', () => {
    expect(applyCurve(0.5, 'logarithmic')).toBeGreaterThan(0.5)
  })

  it('stepped: quantises to 8 levels', () => {
    expect(applyCurve(0.0,  'stepped')).toBe(0)
    expect(applyCurve(0.13, 'stepped')).toBe(1 / 8)
    expect(applyCurve(0.99, 'stepped')).toBe(7 / 8)
    expect(applyCurve(1.0,  'stepped')).toBe(1)  // floor(8)/8
  })

  it('all curves clamp inputs below 0 to 0', () => {
    for (const { id: curve } of [
      { id: 'linear' }, { id: 'easeIn' }, { id: 'easeOut' }, { id: 'stepped' },
    ] as { id: string }[]) {
      expect(applyCurve(-0.5, curve as never)).toBe(applyCurve(0, curve as never))
    }
  })

  it('all curves clamp inputs above 1 to 1', () => {
    for (const { id: curve } of [
      { id: 'linear' }, { id: 'easeIn' }, { id: 'easeOut' }, { id: 'stepped' },
    ] as { id: string }[]) {
      expect(applyCurve(1.5, curve as never)).toBe(applyCurve(1, curve as never))
    }
  })
})

// ── B — ShaderModulationEnvelope ─────────────────────────────────────────────

describe('B — ShaderModulationEnvelope', () => {
  it('starts idle at 0', () => {
    const e = new ShaderModulationEnvelope(50, 0, 200)
    expect(e.value).toBe(0)
    expect(e.phase).toBe('idle')
  })

  it('attacks from 0 to 1 over attackMs duration', () => {
    const e = new ShaderModulationEnvelope(100, 0, 200)
    e.trigger()
    // Advance 0.05s (half of 100ms attack)
    for (let i = 0; i < 5; i++) e.update(0.01)
    expect(e.value).toBeCloseTo(0.5, 1)
    expect(e.phase).toBe('attack')
  })

  it('reaches 1.0 and transitions to release after attackMs', () => {
    const e = new ShaderModulationEnvelope(100, 0, 200)
    e.trigger()
    for (let i = 0; i < 20; i++) e.update(0.006)  // 120ms > 100ms attack; release started
    // After 120ms, attack (100ms) is done, so release has already begun
    expect(e.phase).toBe('release')
    // Value is below 1.0 (release ate ~20ms of the 200ms release time) but well above 0
    expect(e.value).toBeLessThan(1.0)
    expect(e.value).toBeGreaterThan(0.8)
  })

  it('holds for holdMs before releasing', () => {
    const e = new ShaderModulationEnvelope(10, 200, 100)
    e.trigger()
    for (let i = 0; i < 5; i++) e.update(0.003)  // attack completes
    expect(e.phase).toBe('hold')
    for (let i = 0; i < 10; i++) e.update(0.015) // 150ms out of 200ms hold
    expect(e.phase).toBe('hold')
    for (let i = 0; i < 5; i++) e.update(0.015) // hold expires
    expect(e.phase).toBe('release')
  })

  it('decays from 1 to 0 over releaseMs', () => {
    const e = new ShaderModulationEnvelope(10, 0, 200)
    e.trigger()
    // Fast-forward through attack
    for (let i = 0; i < 5; i++) e.update(0.003)
    expect(e.phase).toBe('release')
    const startVal = e.value
    for (let i = 0; i < 10; i++) e.update(0.01)  // 100ms = half release
    expect(e.value).toBeLessThan(startVal)
    expect(e.value).toBeGreaterThan(0)
  })

  it('reaches idle after full release', () => {
    const e = new ShaderModulationEnvelope(10, 0, 100)
    e.trigger()
    for (let i = 0; i < 50; i++) e.update(0.003)  // plenty of time
    expect(e.value).toBe(0)
    expect(e.phase).toBe('idle')
  })

  it('retrigger fires new attack during release when retrigger=true', () => {
    const e = new ShaderModulationEnvelope(10, 0, 500, true)
    e.trigger()
    for (let i = 0; i < 10; i++) e.update(0.002)  // attack completes → release starts
    expect(e.phase).toBe('release')
    e.trigger()  // retrigger
    expect(e.phase).toBe('attack')
  })

  it('retrigger is ignored during release when retrigger=false', () => {
    const e = new ShaderModulationEnvelope(10, 0, 500, false)
    e.trigger()
    for (let i = 0; i < 10; i++) e.update(0.002)  // attack → release
    e.trigger()  // should be ignored
    expect(e.phase).toBe('release')
  })

  it('gate: active=true triggers attack, active=false starts release', () => {
    const e = new ShaderModulationEnvelope(100, 0, 200)
    e.gate(true)
    for (let i = 0; i < 5; i++) e.update(0.01)
    expect(e.phase).toBe('attack')
    e.gate(false)
    expect(e.phase).toBe('release')
  })

  it('reset brings back to idle', () => {
    const e = new ShaderModulationEnvelope(50, 0, 200)
    e.trigger()
    e.update(0.05)
    e.reset()
    expect(e.value).toBe(0)
    expect(e.phase).toBe('idle')
  })

  it('never produces negative values', () => {
    const e = new ShaderModulationEnvelope(10, 0, 50)
    e.trigger()
    for (let i = 0; i < 100; i++) {
      const v = e.update(0.01)
      expect(v).toBeGreaterThanOrEqual(0)
    }
  })
})

// ── C — ShaderModulationMatrix ────────────────────────────────────────────────

describe('C — ShaderModulationMatrix', () => {
  let matrix: ShaderModulationMatrix
  let def: ShaderDefinition

  beforeEach(() => {
    def    = makeFloatDef()
    matrix = new ShaderModulationMatrix()
    matrix.setDefinition(def)
  })

  it('addRoute returns null for valid route', () => {
    const route = makeRoute({ targetParamId: 'speed' })
    expect(matrix.addRoute(route)).toBeNull()
    expect(matrix.size).toBe(1)
  })

  it('getRoutes returns insertion-order routes', () => {
    const r1 = makeRoute({ targetParamId: 'speed' })
    const r2 = makeRoute({ targetParamId: 'speed', source: 'bass' })
    matrix.addRoute(r1)
    matrix.addRoute(r2)
    expect(matrix.getRoutes().map(r => r.id)).toEqual([r1.id, r2.id])
  })

  it('removeRoute deletes the route', () => {
    const r = makeRoute({ targetParamId: 'speed' })
    matrix.addRoute(r)
    matrix.removeRoute(r.id)
    expect(matrix.size).toBe(0)
  })

  it('updateRoute patches without replacing the whole route', () => {
    const r = makeRoute({ targetParamId: 'speed', amount: 0.5 })
    matrix.addRoute(r)
    matrix.updateRoute(r.id, { amount: 0.8 })
    expect(matrix.getRoute(r.id)?.amount).toBe(0.8)
    expect(matrix.getRoute(r.id)?.targetParamId).toBe('speed')
  })

  it('getRoutesForParam filters by targetParamId', () => {
    const r1 = makeRoute({ targetParamId: 'speed' })
    const r2 = makeRoute({ targetParamId: 'tint' })
    matrix.addRoute(r1); matrix.addRoute(r2)
    expect(matrix.getRoutesForParam('speed')).toHaveLength(1)
    expect(matrix.getRoutesForParam('tint')).toHaveLength(1)
  })

  it('rejects route when target param is not found', () => {
    const r = makeRoute({ targetParamId: 'ghost' })
    const err = matrix.addRoute(r)
    expect(err?.code).toBe('TARGET_NOT_FOUND')
  })

  it('rejects route when param has modulatable: false', () => {
    const r = makeRoute({ targetParamId: 'tex' })
    const err = matrix.addRoute(r)
    expect(err?.code).toBe('NOT_MODULATABLE')
  })

  it('getModulatableParams excludes non-modulatable params', () => {
    const params = ShaderModulationMatrix.getModulatableParams(def)
    const ids = params.map(p => p.id)
    expect(ids).not.toContain('tex')
    expect(ids).toContain('speed')
    expect(ids).toContain('tint')
  })

  it('toArray/fromArray round-trips routes', () => {
    const r = makeRoute({ targetParamId: 'speed', amount: 0.7 })
    matrix.addRoute(r)
    const arr = matrix.toArray()
    const m2  = new ShaderModulationMatrix()
    m2.fromArray(arr)
    expect(m2.size).toBe(1)
    expect(m2.getRoutes()[0].amount).toBe(0.7)
  })

  it('clear removes all routes', () => {
    matrix.addRoute(makeRoute({ targetParamId: 'speed' }))
    matrix.addRoute(makeRoute({ targetParamId: 'tint' }))
    matrix.clear()
    expect(matrix.size).toBe(0)
  })

  it('unsupported type (gradient) is rejected', () => {
    // Make a def with a gradient param
    const defWithGrad: ShaderDefinition = {
      ...makeFloatDef(),
      params: [
        ...makeFloatDef().params,
        {
          id: 'grad', type: 'gradient', label: 'Gradient',
          uniformName: 'u_grad', modulatable: true,
          default: [{ position: 0, color: [1, 0, 0, 1] }],
        },
      ],
    }
    const m = new ShaderModulationMatrix()
    m.setDefinition(defWithGrad)
    const r = makeRoute({ targetParamId: 'grad' })
    const err = m.addRoute(r)
    expect(err?.code).toBe('TYPE_NOT_SUPPORTED')
  })
})

// ── D — Evaluator: float add/multiply/replace ─────────────────────────────────

describe('D — Evaluator: float combine modes', () => {
  let ev: ShaderModulationEvaluator
  let matrix: ShaderModulationMatrix
  const def = makeFloatDef()

  beforeEach(() => {
    ev = new ShaderModulationEvaluator()
    matrix = new ShaderModulationMatrix()
    matrix.setDefinition(def)
  })

  it('add: base=1.0, source=1.0, amount=1.0 → base + 1.0*range = clamp(3, 0, 2) = 2', () => {
    const r = makeRoute({ mode: 'phase', combineMode: 'add', amount: 1, outputMax: 1 })
    matrix.addRoute(r)
    const result = evaluate(ev, matrix, def, makeAudio({ energy: 1.0 }), makeTiming())
    // signal = 1.0 * 1.0 = 1.0; add: base(1) + 1.0 * range(2) = 3 → clamped to 2
    expect(result.params['speed'].effectiveValue).toBe(2)
  })

  it('add: source=0.5, amount=1 → base + 0.5*range = 1.0 + 1.0 = 2.0, clamped', () => {
    const r = makeRoute({ mode: 'phase', combineMode: 'add', amount: 1 })
    matrix.addRoute(r)
    const result = evaluate(ev, matrix, def, makeAudio({ energy: 0.5 }), makeTiming())
    // signal = 0.5; delta = 0.5 * 2 = 1.0; base+delta = 2.0
    expect(result.params['speed'].effectiveValue).toBeCloseTo(2.0)
  })

  it('multiply: source=1.0, amount=1.0 → base * (1+1) = 2.0', () => {
    const r = makeRoute({ mode: 'phase', combineMode: 'multiply', amount: 1 })
    matrix.addRoute(r)
    const result = evaluate(ev, matrix, def, makeAudio({ energy: 1.0 }), makeTiming())
    // signal = 1.0; eff = 1.0 * (1+1) = 2.0
    expect(result.params['speed'].effectiveValue).toBeCloseTo(2.0)
  })

  it('multiply: source=0.5 → base * 1.5 = 1.5', () => {
    const r = makeRoute({ mode: 'phase', combineMode: 'multiply', amount: 1 })
    matrix.addRoute(r)
    const result = evaluate(ev, matrix, def, makeAudio({ energy: 0.5 }), makeTiming())
    expect(result.params['speed'].effectiveValue).toBeCloseTo(1.5)
  })

  it('replace: source=0.5, amount=1.0 → min + 0.5*range = 0+0.5*2 = 1.0', () => {
    const r = makeRoute({ mode: 'phase', combineMode: 'replace', amount: 1 })
    matrix.addRoute(r)
    const result = evaluate(ev, matrix, def, makeAudio({ energy: 0.5 }), makeTiming())
    // replace: min + |signal| * range = 0 + 0.5 * 2 = 1.0
    expect(result.params['speed'].effectiveValue).toBeCloseTo(1.0)
  })

  it('replace: source=0.0 → min = 0.0', () => {
    const r = makeRoute({ mode: 'phase', combineMode: 'replace', amount: 1 })
    matrix.addRoute(r)
    const result = evaluate(ev, matrix, def, makeAudio({ energy: 0 }), makeTiming())
    expect(result.params['speed'].effectiveValue).toBeCloseTo(0)
  })
})

// ── E — Inversion ─────────────────────────────────────────────────────────────

describe('E — inversion', () => {
  let ev: ShaderModulationEvaluator
  let matrix: ShaderModulationMatrix
  const def = makeFloatDef()

  beforeEach(() => {
    ev = new ShaderModulationEvaluator()
    matrix = new ShaderModulationMatrix()
    matrix.setDefinition(def)
  })

  it('invert=true flips source before mapping: source=0.8 → curved=0.2', () => {
    const r = makeRoute({ mode: 'phase', combineMode: 'replace', amount: 1, invert: true })
    matrix.addRoute(r)
    // source=0.8 → curved=0.8 → inverted=0.2 → mapped=0.2 → replace: 0+0.2*2=0.4
    const result = evaluate(ev, matrix, def, makeAudio({ energy: 0.8 }), makeTiming())
    expect(result.params['speed'].effectiveValue).toBeCloseTo(0.4, 2)
  })

  it('amount=-1 inverts signal direction in add mode', () => {
    const r = makeRoute({ mode: 'phase', combineMode: 'add', amount: -1 })
    matrix.addRoute(r)
    // source=1.0, signal= 1.0 * -1 = -1.0; add: 1.0 + (-1.0)*2 = -1 → clamped to 0
    const result = evaluate(ev, matrix, def, makeAudio({ energy: 1.0 }), makeTiming())
    expect(result.params['speed'].effectiveValue).toBe(0)
  })
})

// ── F — Range clamping ────────────────────────────────────────────────────────

describe('F — range clamping', () => {
  let ev: ShaderModulationEvaluator
  let matrix: ShaderModulationMatrix
  const def = makeFloatDef()

  beforeEach(() => {
    ev = new ShaderModulationEvaluator()
    matrix = new ShaderModulationMatrix()
    matrix.setDefinition(def)
  })

  it('add: never exceeds param max', () => {
    const r = makeRoute({ mode: 'phase', combineMode: 'add', amount: 10, outputMax: 1 })
    matrix.addRoute(r)
    const result = evaluate(ev, matrix, def, makeAudio({ energy: 1 }), makeTiming())
    const v = result.params['speed'].effectiveValue as number
    expect(v).toBeLessThanOrEqual(2.0)
  })

  it('add: never goes below param min', () => {
    const r = makeRoute({ mode: 'phase', combineMode: 'add', amount: -10, outputMax: 1 })
    matrix.addRoute(r)
    const result = evaluate(ev, matrix, def, makeAudio({ energy: 1 }), makeTiming())
    const v = result.params['speed'].effectiveValue as number
    expect(v).toBeGreaterThanOrEqual(0)
  })

  it('multiply: never exceeds param max', () => {
    const r = makeRoute({ mode: 'phase', combineMode: 'multiply', amount: 100 })
    matrix.addRoute(r)
    const result = evaluate(ev, matrix, def, makeAudio({ energy: 1 }), makeTiming())
    const v = result.params['speed'].effectiveValue as number
    expect(v).toBeLessThanOrEqual(2.0)
  })
})

// ── G — Multiple routes on one param ─────────────────────────────────────────

describe('G — multiple routes targeting one param', () => {
  let ev: ShaderModulationEvaluator
  let matrix: ShaderModulationMatrix
  const def = makeFloatDef()

  beforeEach(() => {
    ev = new ShaderModulationEvaluator()
    matrix = new ShaderModulationMatrix()
    matrix.setDefinition(def)
  })

  it('two add routes accumulate (order-dependent)', () => {
    // Route 1: add 0.25 range (0.5 signal, range 2)
    const r1 = makeRoute({ source: 'bass',   mode: 'phase', combineMode: 'add', amount: 0.5 })
    // Route 2: add another 0.5 range
    const r2 = makeRoute({ source: 'energy', mode: 'phase', combineMode: 'add', amount: 1 })
    matrix.addRoute(r1); matrix.addRoute(r2)
    // r1: signal=0.5*0.5=0.25; delta=0.25*2=0.5; eff after r1 = 1.0+0.5=1.5
    // r2: signal=0.5*1=0.5;  delta=0.5*2=1.0;  eff after r2 = 1.5+1.0=2.5 → clamped to 2.0
    const result = evaluate(ev, matrix, def,
      makeAudio({ bass: 0.5, energy: 0.5 }), makeTiming())
    const v = result.params['speed'].effectiveValue as number
    expect(v).toBeCloseTo(2.0)  // clamped at max
  })

  it('disabled routes do not contribute', () => {
    const r1 = makeRoute({ source: 'energy', mode: 'phase', combineMode: 'add', amount: 1 })
    const r2 = makeRoute({ source: 'energy', mode: 'phase', combineMode: 'add', amount: 1, enabled: false })
    matrix.addRoute(r1); matrix.addRoute(r2)
    const result = evaluate(ev, matrix, def, makeAudio({ energy: 0.5 }), makeTiming())
    // Only r1 contributes: 1.0 + 0.5*2 = 2.0
    const v = result.params['speed'].effectiveValue as number
    expect(v).toBeCloseTo(2.0)
  })

  it('replace overrides accumulated value from earlier routes', () => {
    const r1 = makeRoute({ source: 'energy', mode: 'phase', combineMode: 'add', amount: 1 })
    const r2 = makeRoute({ source: 'bass',   mode: 'phase', combineMode: 'replace', amount: 1 })
    matrix.addRoute(r1); matrix.addRoute(r2)
    const result = evaluate(ev, matrix, def,
      makeAudio({ energy: 1.0, bass: 0.25 }), makeTiming())
    // r1 would make 3 → clamped 2; but r2 replaces with: min+|0.25|*range = 0+0.25*2 = 0.5
    const v = result.params['speed'].effectiveValue as number
    expect(v).toBeCloseTo(0.5, 2)
  })
})

// ── H — NaN / Infinity protection ────────────────────────────────────────────

describe('H — NaN / Infinity protection', () => {
  const ev     = new ShaderModulationEvaluator()
  const matrix = new ShaderModulationMatrix()
  const def    = makeFloatDef()
  matrix.setDefinition(def)

  it('NaN source value produces finite effective value', () => {
    const r = makeRoute({ mode: 'phase', combineMode: 'add', amount: 1 })
    matrix.addRoute(r)
    const audio = makeAudio({ energy: NaN })
    const result = evaluate(ev, matrix, def, audio, makeTiming())
    expect(isFinite(result.params['speed'].effectiveValue as number)).toBe(true)
  })

  it('Infinity source value produces finite effective value', () => {
    const r = makeRoute({ mode: 'phase', combineMode: 'add', amount: 1 })
    const audio = makeAudio({ energy: Infinity })
    const result = evaluate(ev, matrix, def, audio, makeTiming())
    expect(isFinite(result.params['speed'].effectiveValue as number)).toBe(true)
  })
})

// ── I — Scene-change reset ────────────────────────────────────────────────────

describe('I — scene-change reset', () => {
  it('changing sceneId resets continuous smoother state', () => {
    const ev     = new ShaderModulationEvaluator()
    const matrix = new ShaderModulationMatrix()
    const def    = makeFloatDef()
    matrix.setDefinition(def)

    const r = makeRoute({ mode: 'continuous', combineMode: 'add', amount: 1,
      attackMs: 1, releaseMs: 1 })
    matrix.addRoute(r)

    // Drive speed up on scene-a
    for (let i = 0; i < 20; i++) {
      evaluate(ev, matrix, def, makeAudio({ energy: 1 }), makeTiming(), BASE_PARAMS, 0.016, 'scene-a')
    }
    // Smoother should have built up
    const before = evaluate(ev, matrix, def, makeAudio({ energy: 0 }), makeTiming(),
      BASE_PARAMS, 0.001, 'scene-a').params['speed'].effectiveValue as number

    // Switch scene
    const after = evaluate(ev, matrix, def, makeAudio({ energy: 0 }), makeTiming(),
      BASE_PARAMS, 0.001, 'scene-b').params['speed'].effectiveValue as number

    // After scene change, smoother is reset → starting from 0
    expect(after).toBeLessThan(before)
  })
})

// ── J — Stable delta-time smoothing ──────────────────────────────────────────

describe('J — stable delta-time smoothing (continuous mode)', () => {
  const def = makeFloatDef()

  it('converges to similar value with different step sizes', () => {
    // Fast: 100 × 1ms steps
    const evFast = new ShaderModulationEvaluator()
    const mFast  = new ShaderModulationMatrix()
    mFast.setDefinition(def)
    mFast.addRoute(makeRoute({ mode: 'continuous', combineMode: 'replace', amount: 1,
      attackMs: 50, releaseMs: 50 }))

    // Slow: 2 × 50ms steps
    const evSlow = new ShaderModulationEvaluator()
    const mSlow  = new ShaderModulationMatrix()
    mSlow.setDefinition(def)
    mSlow.addRoute(makeRoute({ mode: 'continuous', combineMode: 'replace', amount: 1,
      attackMs: 50, releaseMs: 50 }))

    for (let i = 0; i < 100; i++) {
      evaluate(evFast, mFast, def, makeAudio({ energy: 1 }), makeTiming(), BASE_PARAMS, 0.001)
    }
    for (let i = 0; i < 2; i++) {
      evaluate(evSlow, mSlow, def, makeAudio({ energy: 1 }), makeTiming(), BASE_PARAMS, 0.05)
    }

    const fast = evFast.evaluate(mFast, def, makeAudio({ energy: 1 }), makeTiming(),
      BASE_PARAMS, 0, 'test-shader').params['speed'].effectiveValue as number
    const slow = evSlow.evaluate(mSlow, def, makeAudio({ energy: 1 }), makeTiming(),
      BASE_PARAMS, 0, 'test-shader').params['speed'].effectiveValue as number

    // Should be within 10% of each other after same total time
    expect(Math.abs(fast - slow)).toBeLessThan(0.2)
  })
})

// ── K — Color param modulation ───────────────────────────────────────────────

describe('K — color param modulation', () => {
  let ev: ShaderModulationEvaluator
  let matrix: ShaderModulationMatrix
  const def = makeFloatDef()

  beforeEach(() => {
    ev = new ShaderModulationEvaluator()
    matrix = new ShaderModulationMatrix()
    matrix.setDefinition(def)
  })

  it('add: brightens RGB channels', () => {
    const r = makeRoute({ targetParamId: 'tint', mode: 'phase', combineMode: 'add', amount: 0.5 })
    matrix.addRoute(r)
    const result = evaluate(ev, matrix, def, makeAudio({ energy: 1 }), makeTiming())
    const color = result.params['tint'].effectiveValue as [number, number, number, number]
    // base = [0.5, 0.5, 0.5, 1.0]; signal=0.5; each channel += 0.5 → [1.0, 1.0, 1.0, 1.0]
    expect(color[0]).toBeCloseTo(1.0)
    expect(color[3]).toBe(1.0)  // alpha preserved
  })

  it('multiply: scales channels', () => {
    const r = makeRoute({ targetParamId: 'tint', mode: 'phase', combineMode: 'multiply', amount: 1 })
    matrix.addRoute(r)
    const result = evaluate(ev, matrix, def, makeAudio({ energy: 1 }), makeTiming())
    const color = result.params['tint'].effectiveValue as [number, number, number, number]
    // base=0.5; signal=1; channel *= (1+1)=2 → 1.0 clamped
    expect(color[0]).toBeCloseTo(1.0)
  })

  it('replace: sets all RGB channels to |signal| value', () => {
    // amount=1, energy=0.5 → signal = 0.5 * 1.0 = 0.5; replace: channels = |0.5| = 0.5
    const r = makeRoute({ targetParamId: 'tint', mode: 'phase', combineMode: 'replace', amount: 1 })
    matrix.addRoute(r)
    const result = evaluate(ev, matrix, def, makeAudio({ energy: 0.5 }), makeTiming())
    const color = result.params['tint'].effectiveValue as [number, number, number, number]
    expect(color[0]).toBeCloseTo(0.5)
    expect(color[3]).toBe(1.0)  // alpha always preserved
  })
})

// ── L — Vec2 param modulation ─────────────────────────────────────────────────

describe('L — vec2 param modulation', () => {
  let ev: ShaderModulationEvaluator
  let matrix: ShaderModulationMatrix
  const def = makeFloatDef()

  beforeEach(() => {
    ev = new ShaderModulationEvaluator()
    matrix = new ShaderModulationMatrix()
    matrix.setDefinition(def)
  })

  it('add: shifts both components proportionally', () => {
    const r = makeRoute({ targetParamId: 'center', mode: 'phase', combineMode: 'add', amount: 0.5 })
    matrix.addRoute(r)
    // base=[0,0], range=2 each, signal=0.5*0.5=0.25 → each += 0.25*2=0.5
    const result = evaluate(ev, matrix, def, makeAudio({ energy: 0.5 }), makeTiming())
    const [x, y] = result.params['center'].effectiveValue as [number, number]
    expect(x).toBeCloseTo(0.5)
    expect(y).toBeCloseTo(0.5)
  })
})

// ── M — Boolean threshold ─────────────────────────────────────────────────────

describe('M — boolean threshold', () => {
  let ev: ShaderModulationEvaluator
  let matrix: ShaderModulationMatrix
  const def = makeFloatDef()

  beforeEach(() => {
    ev = new ShaderModulationEvaluator()
    matrix = new ShaderModulationMatrix()
    matrix.setDefinition(def)
  })

  it('signal > 0 → boolean becomes true', () => {
    const r = makeRoute({ targetParamId: 'glow', mode: 'phase', combineMode: 'add', amount: 1 })
    matrix.addRoute(r)
    const result = evaluate(ev, matrix, def, makeAudio({ energy: 0.8 }), makeTiming())
    expect(result.params['glow'].effectiveValue).toBe(true)
  })

  it('signal = 0 → boolean returns to base (false)', () => {
    const r = makeRoute({ targetParamId: 'glow', mode: 'phase', combineMode: 'add', amount: 1 })
    matrix.addRoute(r)
    const result = evaluate(ev, matrix, def, makeAudio({ energy: 0 }), makeTiming())
    expect(result.params['glow'].effectiveValue).toBe(false)
  })
})

// ── N — Trigger mode ──────────────────────────────────────────────────────────

describe('N — trigger mode', () => {
  let ev: ShaderModulationEvaluator
  let matrix: ShaderModulationMatrix
  const def = makeFloatDef()

  beforeEach(() => {
    ev = new ShaderModulationEvaluator()
    matrix = new ShaderModulationMatrix()
    matrix.setDefinition(def)
  })

  it('rising edge of source triggers envelope', () => {
    const r = makeRoute({
      source: 'beatHit', mode: 'trigger', combineMode: 'replace', amount: 1,
      attackMs: 1, holdMs: 0, releaseMs: 100,
    })
    matrix.addRoute(r)
    // beatHit rises to 0.8
    evaluate(ev, matrix, def, makeAudio({ beatHit: 0 }), makeTiming(), BASE_PARAMS, 0.016)
    const triggered = evaluate(ev, matrix, def, makeAudio({ beatHit: 0.8 }), makeTiming(),
      BASE_PARAMS, 0.016)
    // Envelope should have fired and be > 0
    const v = triggered.params['speed'].effectiveValue as number
    expect(v).toBeGreaterThan(0)
  })

  it('envelope decays over time after trigger', () => {
    const r = makeRoute({
      source: 'beatHit', mode: 'trigger', combineMode: 'replace', amount: 1,
      attackMs: 5, holdMs: 0, releaseMs: 200,
    })
    matrix.addRoute(r)
    // Fire trigger
    evaluate(ev, matrix, def, makeAudio({ beatHit: 0 }), makeTiming(), BASE_PARAMS, 0.016)
    evaluate(ev, matrix, def, makeAudio({ beatHit: 0.9 }), makeTiming(), BASE_PARAMS, 0.016)

    // Advance through release
    let lastVal = 2
    for (let i = 0; i < 10; i++) {
      const r2 = evaluate(ev, matrix, def, makeAudio({ beatHit: 0 }), makeTiming(),
        BASE_PARAMS, 0.02)
      const v = r2.params['speed'].effectiveValue as number
      expect(v).toBeLessThanOrEqual(lastVal + 0.001)  // monotonically decaying
      lastVal = v
    }
    expect(lastVal).toBeLessThan(1.5)
  })
})

// ── O — Non-modulatable param rejection ──────────────────────────────────────

describe('O — non-modulatable param rejection', () => {
  it('texture param with modulatable:false is rejected', () => {
    const matrix = new ShaderModulationMatrix()
    matrix.setDefinition(makeFloatDef())
    const r = makeRoute({ targetParamId: 'tex' })
    const err = matrix.addRoute(r)
    expect(err?.code).toBe('NOT_MODULATABLE')
    expect(err?.message).toContain('tex')
  })

  it('source metadata mirrors the canonical MI registry plus Shader aliases', () => {
    expect(MODULATION_SOURCE_META.length).toBe(MI_SOURCE_REGISTRY.length + 10)
    for (const source of MI_SOURCE_REGISTRY) {
      expect(MODULATION_SOURCE_META.some(meta => meta.id === source.key)).toBe(true)
    }
  })

  it('evaluates canonical stem and capability sources through shared selectors', () => {
    const def = makeFloatDef()
    const stemMatrix = new ShaderModulationMatrix()
    stemMatrix.setDefinition(def)
    stemMatrix.addRoute(makeRoute({
      source: 'vocalEnergy', mode: 'phase', combineMode: 'replace', amount: 1,
    }))
    const mi = {
      stems: { vocalEnergy: 0.75 },
      capabilities: { stemCurves: true },
    } as MusicIntelligenceFrame
    const stemResult = evaluate(
      new ShaderModulationEvaluator(), stemMatrix, def,
      makeAudio(), makeTiming(), BASE_PARAMS, 0.016, 'test-shader', mi,
    )
    expect(stemResult.params['speed'].effectiveValue).toBeCloseTo(1.5)

    const gateMatrix = new ShaderModulationMatrix()
    gateMatrix.setDefinition(def)
    gateMatrix.addRoute(makeRoute({
      source: 'hasStems', mode: 'phase', combineMode: 'replace', amount: 1,
    }))
    const gateResult = evaluate(
      new ShaderModulationEvaluator(), gateMatrix, def,
      makeAudio(), makeTiming(), BASE_PARAMS, 0.016, 'test-shader', mi,
    )
    expect(gateResult.params['speed'].effectiveValue).toBe(2)
  })
})
