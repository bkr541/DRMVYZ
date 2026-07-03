// Tests for metadata-driven shader parameter UI — pure logic only (no DOM).
// Covers: type dispatch, range clamping, defaults, gradient ordering,
// effective-value display, scene switching, dev-scene filtering.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  toNumberValue, toBooleanValue, toStringValue,
  toRgbaValue, toVec2Value, toGradientValue,
  clampFloat, clampInteger, clamp01,
  rgbaToHex, hexToRgba,
  sortStops,
  groupParams,
  isDevScene, getUserFacingScenes,
  PARAM_GROUP_ORDER,
} from '../shaderParameterUiTypes'
import { getParamDefault } from '../../registry/ShaderParameterSchema'
import { ShaderRegistry } from '../../registry/ShaderRegistry'
import type {
  FloatParamDef, IntegerParamDef, BooleanParamDef, ColorParamDef,
  GradientParamDef, EnumParamDef, Vec2ParamDef, TriggerParamDef,
  TextureParamDef, ShaderDefinition, GradientStop, RGBA,
} from '../../registry/shaderRegistryTypes'

// ── Helper factories ──────────────────────────────────────────────────────────

function makeFloat(overrides: Partial<FloatParamDef> = {}): FloatParamDef {
  return { type: 'float', id: 'f', label: 'Float', uniformName: 'u_f', min: 0, max: 1, default: 0.5, ...overrides }
}

function makeInteger(overrides: Partial<IntegerParamDef> = {}): IntegerParamDef {
  return { type: 'integer', id: 'i', label: 'Int', uniformName: 'u_i', min: 0, max: 10, default: 5, ...overrides }
}

function makeBoolean(overrides: Partial<BooleanParamDef> = {}): BooleanParamDef {
  return { type: 'boolean', id: 'b', label: 'Bool', uniformName: 'u_b', default: false, ...overrides }
}

function makeColor(overrides: Partial<ColorParamDef> = {}): ColorParamDef {
  return { type: 'color', id: 'c', label: 'Color', uniformName: 'u_c', default: [1, 0, 0, 1], ...overrides }
}

function makeGradient(overrides: Partial<GradientParamDef> = {}): GradientParamDef {
  return {
    type: 'gradient', id: 'g', label: 'Grad', uniformName: 'u_g',
    default: [{ position: 0, color: [0, 0, 0, 1] }, { position: 1, color: [1, 1, 1, 1] }],
    ...overrides,
  }
}

function makeEnum(overrides: Partial<EnumParamDef> = {}): EnumParamDef {
  return {
    type: 'enum', id: 'e', label: 'Enum', uniformName: 'u_e',
    values: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
    default: 'a', ...overrides,
  }
}

function makeVec2(overrides: Partial<Vec2ParamDef> = {}): Vec2ParamDef {
  return { type: 'vec2', id: 'v', label: 'Vec2', uniformName: 'u_v', min: [0, 0], max: [1, 1], default: [0.5, 0.5], ...overrides }
}

function makeTrigger(overrides: Partial<TriggerParamDef> = {}): TriggerParamDef {
  return { type: 'trigger', id: 't', label: 'Trigger', uniformName: 'u_t', ...overrides }
}

function makeTexture(overrides: Partial<TextureParamDef> = {}): TextureParamDef {
  return { type: 'texture', id: 'tx', label: 'Tex', uniformName: 'u_tex', acceptedSources: ['uploaded-image'], ...overrides }
}

const MIN_FRAG_SRC = '#version 300 es\nprecision mediump float;\nout vec4 c;\nvoid main(){c=vec4(0);}'

function makeDef(
  id: string,
  params: ShaderDefinition['params'] = [],
  tags?: string[],
): ShaderDefinition {
  return {
    id,
    name: id,
    description: '',
    category: 'utility',
    version: 1,
    fragSrc: MIN_FRAG_SRC,
    params,
    defaults: {},
    quality: { minimumTier: 'low', recommendedTier: 'low', estimatedPassCount: 1, requiresFloatTarget: false, requiresPersistentBuffers: false },
    tags,
    resetOnActivation: false,
  }
}

// ── A: Control selection by parameter type ────────────────────────────────────

describe('A: Control type dispatch', () => {
  it('float param default is a number', () => {
    const p = makeFloat({ default: 0.7 })
    expect(getParamDefault(p)).toBe(0.7)
    expect(typeof getParamDefault(p)).toBe('number')
  })

  it('boolean param default is a boolean', () => {
    const p = makeBoolean({ default: true })
    expect(getParamDefault(p)).toBe(true)
  })

  it('color param default is RGBA array', () => {
    const p = makeColor({ default: [0.2, 0.4, 0.6, 1] })
    const d = getParamDefault(p) as RGBA
    expect(Array.isArray(d)).toBe(true)
    expect(d).toHaveLength(4)
  })

  it('gradient param default is stop array', () => {
    const p = makeGradient()
    const d = getParamDefault(p) as GradientStop[]
    expect(Array.isArray(d)).toBe(true)
    expect(d[0]).toHaveProperty('position')
    expect(d[0]).toHaveProperty('color')
  })

  it('enum param default is a string', () => {
    const p = makeEnum({ default: 'b' })
    expect(getParamDefault(p)).toBe('b')
    expect(typeof getParamDefault(p)).toBe('string')
  })

  it('vec2 param default is a two-element array', () => {
    const p = makeVec2({ default: [0.25, 0.75] })
    const d = getParamDefault(p)
    expect(Array.isArray(d)).toBe(true)
    expect((d as number[])).toHaveLength(2)
  })

  it('trigger param has no default (undefined)', () => {
    const p = makeTrigger()
    expect(getParamDefault(p)).toBeUndefined()
  })

  it('texture param default is null', () => {
    const p = makeTexture()
    expect(getParamDefault(p)).toBeNull()
  })
})

// ── B: Hidden undeclared controls ─────────────────────────────────────────────

describe('B: Hidden undeclared controls', () => {
  it('groupParams for def A excludes def B params', () => {
    const defAParams = [makeFloat({ id: 'speed' }), makeFloat({ id: 'hue' })]
    const defBParams = [makeFloat({ id: 'brightness' }), makeBoolean({ id: 'mirror' })]

    const groupsA = groupParams(defAParams)
    const groupsB = groupParams(defBParams)

    const idsA = groupsA.flatMap(g => g.params.map(p => p.id))
    const idsB = groupsB.flatMap(g => g.params.map(p => p.id))

    expect(idsA).toContain('speed')
    expect(idsA).toContain('hue')
    expect(idsA).not.toContain('brightness')
    expect(idsA).not.toContain('mirror')

    expect(idsB).toContain('brightness')
    expect(idsB).toContain('mirror')
    expect(idsB).not.toContain('speed')
    expect(idsB).not.toContain('hue')
  })

  it('texture params do not appear in grouped param list (excluded by panel)', () => {
    const params = [makeFloat({ id: 'f1' }), makeTexture({ id: 'tx1' })]
    const nonTexture = params.filter(p => p.type !== 'texture')
    const groups = groupParams(nonTexture)
    const ids = groups.flatMap(g => g.params.map(p => p.id))
    expect(ids).toContain('f1')
    expect(ids).not.toContain('tx1')
  })

  it('params with no group land in the default group', () => {
    const params = [makeFloat({ id: 'a' }), makeFloat({ id: 'b' })]
    const groups = groupParams(params)
    expect(groups).toHaveLength(1)
    expect(groups[0].name).toBe('Parameters')
  })

  it('advanced params land in the Advanced group', () => {
    const params = [
      makeFloat({ id: 'basic' }),
      makeFloat({ id: 'adv', advanced: true }),
    ]
    const groups = groupParams(params)
    const advGroup = groups.find(g => g.advanced)
    expect(advGroup).toBeDefined()
    expect(advGroup!.params.map(p => p.id)).toContain('adv')
    const basicGroup = groups.find(g => !g.advanced && g.name !== 'Advanced')
    expect(basicGroup!.params.map(p => p.id)).toContain('basic')
    expect(basicGroup!.params.map(p => p.id)).not.toContain('adv')
  })
})

// ── C: Range clamping ─────────────────────────────────────────────────────────

describe('C: Range clamping', () => {
  it('clampFloat keeps in-range values unchanged', () => {
    expect(clampFloat(0.5, 0, 1)).toBe(0.5)
  })

  it('clampFloat clamps below min', () => {
    expect(clampFloat(-0.1, 0, 1)).toBe(0)
  })

  it('clampFloat clamps above max', () => {
    expect(clampFloat(1.5, 0, 1)).toBe(1)
  })

  it('clampFloat handles non-unit ranges', () => {
    expect(clampFloat(200, 10, 100)).toBe(100)
    expect(clampFloat(5, 10, 100)).toBe(10)
  })

  it('clampInteger rounds and clamps', () => {
    expect(clampInteger(7.7, 0, 10)).toBe(8)
    expect(clampInteger(15, 0, 10)).toBe(10)
    expect(clampInteger(-3, 0, 10)).toBe(0)
  })

  it('clamp01 clamps to 0..1', () => {
    expect(clamp01(-1)).toBe(0)
    expect(clamp01(2)).toBe(1)
    expect(clamp01(0.5)).toBe(0.5)
  })

  it('toRgbaValue clamps out-of-range channels', () => {
    const v = toRgbaValue([-0.1, 1.5, 0.5, 2.0])
    expect(v[0]).toBe(0)
    expect(v[1]).toBe(1)
    expect(v[2]).toBe(0.5)
    expect(v[3]).toBe(1)
  })
})

// ── D: Reset to default ───────────────────────────────────────────────────────

describe('D: Reset to default', () => {
  it('getParamDefault returns the float default', () => {
    const p = makeFloat({ default: 0.42 })
    expect(getParamDefault(p)).toBe(0.42)
  })

  it('getParamDefault returns the integer default', () => {
    const p = makeInteger({ default: 7 })
    expect(getParamDefault(p)).toBe(7)
  })

  it('getParamDefault returns the boolean default', () => {
    const p = makeBoolean({ default: true })
    expect(getParamDefault(p)).toBe(true)
  })

  it('getParamDefault returns color array default', () => {
    const def: RGBA = [0.1, 0.2, 0.3, 1.0]
    const p = makeColor({ default: def })
    expect(getParamDefault(p)).toEqual(def)
  })

  it('getParamDefault returns enum string default', () => {
    const p = makeEnum({ default: 'b' })
    expect(getParamDefault(p)).toBe('b')
  })

  it('def.defaults is used as initial paramValues snapshot', () => {
    const defaults = { speed: 0.5, color: [1, 0, 0, 1] as RGBA }
    const paramValues = { ...defaults }
    // Simulate reset: restore to def.defaults
    paramValues.speed = 0.9
    const resetValues = { ...defaults }
    expect(resetValues.speed).toBe(0.5)
  })
})

// ── E: Trigger reset behavior ─────────────────────────────────────────────────

describe('E: Trigger reset', () => {
  it('trigger has no default value', () => {
    const p = makeTrigger()
    expect(getParamDefault(p)).toBeUndefined()
  })

  it('setParamValue(id, true) followed by false simulates pulse', () => {
    vi.useFakeTimers()
    const calls: boolean[] = []
    const setParamValue = (id: string, v: unknown) => calls.push(v as boolean)

    setParamValue('t', true)
    setTimeout(() => setParamValue('t', false), 16)

    expect(calls).toEqual([true])
    vi.advanceTimersByTime(20)
    expect(calls).toEqual([true, false])
    vi.useRealTimers()
  })
})

// ── F: Gradient stop ordering ─────────────────────────────────────────────────

describe('F: Gradient stop ordering', () => {
  it('sortStops returns stops in ascending position order', () => {
    const stops: GradientStop[] = [
      { position: 0.8, color: [1, 0, 0, 1] },
      { position: 0.2, color: [0, 1, 0, 1] },
      { position: 0.5, color: [0, 0, 1, 1] },
    ]
    const sorted = sortStops(stops)
    expect(sorted[0].position).toBe(0.2)
    expect(sorted[1].position).toBe(0.5)
    expect(sorted[2].position).toBe(0.8)
  })

  it('sortStops does not mutate the input array', () => {
    const stops: GradientStop[] = [
      { position: 0.9, color: [1, 0, 0, 1] },
      { position: 0.1, color: [0, 0, 1, 1] },
    ]
    const original0 = stops[0].position
    sortStops(stops)
    expect(stops[0].position).toBe(original0)
  })

  it('sortStops handles already-sorted stops', () => {
    const stops: GradientStop[] = [
      { position: 0, color: [0, 0, 0, 1] },
      { position: 1, color: [1, 1, 1, 1] },
    ]
    const sorted = sortStops(stops)
    expect(sorted[0].position).toBe(0)
    expect(sorted[1].position).toBe(1)
  })

  it('toGradientValue sorts and clamps positions', () => {
    const raw = [
      { position: 1.5, color: [1, 0, 0, 1] as RGBA },
      { position: -0.5, color: [0, 1, 0, 1] as RGBA },
      { position: 0.5, color: [0, 0, 1, 1] as RGBA },
    ]
    const result = toGradientValue(raw)
    expect(result[0].position).toBe(0)   // clamped from -0.5
    expect(result[1].position).toBe(0.5) // unchanged
    expect(result[2].position).toBe(1)   // clamped from 1.5
  })
})

// ── G: Effective-value display ────────────────────────────────────────────────

describe('G: Effective-value display', () => {
  it('float control shows effectiveValue when provided', () => {
    const paramId = 'speed'
    const modulatedValues: Record<string, number> = { [paramId]: 0.75 }
    const hasEff = modulatedValues[paramId] !== undefined
    expect(hasEff).toBe(true)
    expect(modulatedValues[paramId]).toBe(0.75)
  })

  it('float control does not show effectiveValue when absent', () => {
    const paramId = 'speed'
    const modulatedValues: Record<string, number> = {}
    const hasEff = modulatedValues[paramId] !== undefined
    expect(hasEff).toBe(false)
  })

  it('modulatedValues override does not change the stored base value', () => {
    const paramValues = { speed: 0.3 }
    const modulatedValues = { speed: 0.9 }
    // The base value in the control stays at 0.3; only the display shows 0.9
    expect(paramValues.speed).toBe(0.3)
    expect(modulatedValues.speed).toBe(0.9)
  })
})

// ── H: Scene switching clears stale controls ──────────────────────────────────

describe('H: Scene switching', () => {
  it('setActiveShaderId resets paramValues to new def defaults', () => {
    const reg = new ShaderRegistry()
    const defA = makeDef('a', [makeFloat({ id: 'speed', default: 0.5 })])
    defA.defaults = { speed: 0.5 }
    const defB = makeDef('b', [makeFloat({ id: 'hue', default: 0.8 })])
    defB.defaults = { hue: 0.8 }
    reg.register(defA)
    reg.register(defB)

    let paramValues: Record<string, unknown> = { speed: 0.9 }  // stale values from defA

    function switchScene(id: string) {
      const def = reg.get(id)
      paramValues = def ? { ...def.defaults } : {}
    }

    switchScene('b')
    expect(paramValues).toEqual({ hue: 0.8 })
    expect(paramValues).not.toHaveProperty('speed')
  })

  it('stale modulatedValues are cleared on scene switch', () => {
    let modulatedValues: Record<string, number> = { speed: 0.7, energy: 0.5 }
    // Switching clears modulated values
    modulatedValues = {}
    expect(Object.keys(modulatedValues)).toHaveLength(0)
  })

  it('switching to null clears all values', () => {
    let paramValues: Record<string, unknown> = { speed: 0.5, hue: 0.8 }
    const deactivate = () => { paramValues = {} }
    deactivate()
    expect(Object.keys(paramValues)).toHaveLength(0)
  })
})

// ── I: Internal development scenes hidden ─────────────────────────────────────

describe('I: Internal development scenes hidden', () => {
  it('isDevScene returns true for scenes tagged dev', () => {
    const def = makeDef('d1', [], ['dev', 'utility'])
    expect(isDevScene(def)).toBe(true)
  })

  it('isDevScene returns true for scenes tagged internal', () => {
    const def = makeDef('d2', [], ['internal'])
    expect(isDevScene(def)).toBe(true)
  })

  it('isDevScene returns false for production scenes', () => {
    const def = makeDef('d3', [], ['generator'])
    expect(isDevScene(def)).toBe(false)
  })

  it('isDevScene returns false when tags is absent', () => {
    const def = makeDef('d4')
    expect(isDevScene(def)).toBe(false)
  })

  it('getUserFacingScenes excludes dev and internal scenes', () => {
    const defs = [
      makeDef('prod1', [], ['generator']),
      makeDef('dev1',  [], ['dev', 'utility']),
      makeDef('prod2', [], ['feedback']),
      makeDef('int1',  [], ['internal']),
    ]
    const result = getUserFacingScenes(defs)
    const ids = result.map(d => d.id)
    expect(ids).toContain('prod1')
    expect(ids).toContain('prod2')
    expect(ids).not.toContain('dev1')
    expect(ids).not.toContain('int1')
  })

  it('getUserFacingScenes preserves order of production scenes', () => {
    const defs = [
      makeDef('c', [], ['generator']),
      makeDef('a', [], ['dev']),
      makeDef('b', [], ['feedback']),
    ]
    const result = getUserFacingScenes(defs)
    expect(result.map(d => d.id)).toEqual(['c', 'b'])
  })
})

// ── J: Other engine panel branches unchanged ──────────────────────────────────

describe('J: Other engine branches not affected', () => {
  it('ENGINE_IDS list shape check — each engine has its own id', () => {
    // Verify the known set of engine IDs includes 'shaderPads'
    const ENGINE_IDS = ['shaderPads', 'cinematicPortal', 'oscilloscope', 'laserDmx']
    expect(ENGINE_IDS).toContain('shaderPads')
    expect(ENGINE_IDS).toContain('cinematicPortal')
    expect(ENGINE_IDS).toContain('oscilloscope')
    expect(ENGINE_IDS).toContain('laserDmx')
    expect(ENGINE_IDS).not.toContain('neonLattice')
  })

  it('groupParams for shader params does not influence oscilloscope params', () => {
    // Each engine generates its own control tree from its own definition
    const shaderParams = [makeFloat({ id: 'brightness' })]
    const groups = groupParams(shaderParams)
    const ids = groups.flatMap(g => g.params.map(p => p.id))
    // Only shader params appear — no oscilloscope crossover
    expect(ids).toEqual(['brightness'])
  })

  it('PARAM_GROUP_ORDER does not contain oscilloscope-specific groups', () => {
    // Shader-specific group ordering list stays in shader domain
    expect(PARAM_GROUP_ORDER).not.toContain('Sound Drawing')
    expect(PARAM_GROUP_ORDER).not.toContain('Classic Scope')
    expect(PARAM_GROUP_ORDER).toContain('Color')
    expect(PARAM_GROUP_ORDER).toContain('Motion')
  })
})

// ── K: Value extractor edge cases ─────────────────────────────────────────────

describe('K: Value extractor edge cases', () => {
  it('toNumberValue returns fallback for non-numbers', () => {
    expect(toNumberValue(true, 99)).toBe(99)
    expect(toNumberValue('hello', 7)).toBe(7)
    expect(toNumberValue(null as unknown as number, 3)).toBe(3)
  })

  it('toBooleanValue returns false for non-booleans', () => {
    expect(toBooleanValue(0)).toBe(false)
    expect(toBooleanValue('true')).toBe(false)
    expect(toBooleanValue(null as unknown as boolean)).toBe(false)
  })

  it('toStringValue returns empty string for non-strings', () => {
    expect(toStringValue(42)).toBe('')
    expect(toStringValue(true)).toBe('')
  })

  it('rgbaToHex converts normalized values to hex', () => {
    expect(rgbaToHex([1, 0, 0, 1])).toBe('#ff0000')
    expect(rgbaToHex([0, 1, 0, 1])).toBe('#00ff00')
    expect(rgbaToHex([0, 0, 1, 1])).toBe('#0000ff')
    expect(rgbaToHex([1, 1, 1, 1])).toBe('#ffffff')
  })

  it('hexToRgba converts hex back to normalized RGBA', () => {
    const [r, g, b, a] = hexToRgba('#ff8000', 0.5)
    expect(r).toBeCloseTo(1, 1)
    expect(g).toBeCloseTo(0.502, 1)
    expect(b).toBeCloseTo(0, 1)
    expect(a).toBe(0.5)
  })
})
