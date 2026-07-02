/**
 * Focused tests for the shader scene registry and metadata system.
 *
 * Coverage:
 *   A. Successful registration and retrieval
 *   B. Duplicate scene ID rejection
 *   C. Invalid numeric ranges
 *   D. Invalid enum defaults
 *   E. Duplicate uniform names
 *   F. Missing render-pass dependency
 *   G. Registry filtering (getByCategory, getByTag)
 *   H. Deterministic insertion-order
 *   I. Validation of the dev scene registered in index.ts
 *   J. validateAll() health-check
 *   K. unregister removes the definition
 *   L. Invalid pass resolution scale
 *   M. Default value outside param range
 *   N. defaults map references unknown param id
 *   O. Texture input reference in pass not declared
 *   P. Pass references itself in dependsOn
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ShaderRegistry }           from '../ShaderRegistry'
import { ShaderDefinitionValidator } from '../ShaderDefinitionValidator'
import { shaderRegistry }           from '../index'
import type { ShaderDefinition }    from '../shaderRegistryTypes'
import { PRODUCTION_SCENES } from '../../scenes'

// ── Minimal valid definition factory ─────────────────────────────────────────

function minimalDef(overrides: Partial<ShaderDefinition> = {}): ShaderDefinition {
  return {
    id: 'test-scene',
    name: 'Test Scene',
    description: 'A minimal test definition.',
    category: 'utility',
    version: 1,
    fragSrc: '#version 300 es\nout vec4 c; void main() { c = vec4(1.0); }',
    params: [],
    defaults: {},
    ...overrides,
  }
}

// Each test creates its own fresh registry to avoid cross-test pollution.
let reg: ShaderRegistry

beforeEach(() => {
  reg = new ShaderRegistry()
})

// ── A. Successful registration ────────────────────────────────────────────────

describe('A — successful registration', () => {
  it('registers a valid definition without throwing', () => {
    expect(() => reg.register(minimalDef())).not.toThrow()
  })

  it('has() returns true after registration', () => {
    reg.register(minimalDef())
    expect(reg.has('test-scene')).toBe(true)
  })

  it('get() returns the definition after registration', () => {
    const def = minimalDef()
    reg.register(def)
    const retrieved = reg.get('test-scene')
    expect(retrieved?.id).toBe('test-scene')
    expect(retrieved?.name).toBe('Test Scene')
  })

  it('size increments after each registration', () => {
    expect(reg.size).toBe(0)
    reg.register(minimalDef({ id: 'a' }))
    reg.register(minimalDef({ id: 'b' }))
    expect(reg.size).toBe(2)
  })

  it('registers a definition with params and passes', () => {
    expect(() => reg.register(minimalDef({
      params: [
        {
          id: 'speed',
          type: 'float',
          label: 'Speed',
          uniformName: 'u_speed',
          min: 0, max: 1, default: 0.5,
          modulatable: true,
        },
      ],
      defaults: { speed: 0.5 },
    }))).not.toThrow()
  })
})

// ── B. Duplicate scene ID rejection ──────────────────────────────────────────

describe('B — duplicate scene ID rejection', () => {
  it('throws when registering a definition with an already-used id', () => {
    reg.register(minimalDef())
    expect(() => reg.register(minimalDef())).toThrow(/duplicate shader id/)
  })

  it('allows different IDs on the same fragment source', () => {
    reg.register(minimalDef({ id: 'a' }))
    expect(() => reg.register(minimalDef({ id: 'b' }))).not.toThrow()
  })
})

// ── C. Invalid numeric ranges ─────────────────────────────────────────────────

describe('C — invalid numeric ranges', () => {
  it('rejects a float param where min >= max', () => {
    expect(() => reg.register(minimalDef({
      params: [{
        id: 'p', type: 'float', label: 'P', uniformName: 'u_p',
        min: 1, max: 1, default: 1,
      }],
      defaults: { p: 1 },
    }))).toThrow()
  })

  it('rejects a float param where min > max', () => {
    expect(() => reg.register(minimalDef({
      params: [{
        id: 'p', type: 'float', label: 'P', uniformName: 'u_p',
        min: 5, max: 1, default: 3,
      }],
      defaults: { p: 3 },
    }))).toThrow()
  })

  it('rejects an integer param with step <= 0', () => {
    expect(() => reg.register(minimalDef({
      params: [{
        id: 'p', type: 'integer', label: 'P', uniformName: 'u_p',
        min: 0, max: 10, step: 0, default: 5,
      }],
      defaults: { p: 5 },
    }))).toThrow()
  })

  it('validator reports error for vec2 x min >= max', () => {
    const result = ShaderDefinitionValidator.validate(minimalDef({
      params: [{
        id: 'pos', type: 'vec2', label: 'Pos', uniformName: 'u_pos',
        min: [1, 0], max: [0, 1], default: [0.5, 0.5],
      }],
      defaults: { pos: [0.5, 0.5] },
    }))
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.field.includes('pos') && e.message.includes('min'))).toBe(true)
  })
})

// ── D. Invalid enum defaults ──────────────────────────────────────────────────

describe('D — invalid enum defaults', () => {
  it('rejects a definition where enum default is not in values list', () => {
    expect(() => reg.register(minimalDef({
      params: [{
        id: 'mode', type: 'enum', label: 'Mode', uniformName: 'u_mode',
        values: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
        default: 'c',
      }],
      defaults: { mode: 'c' },
    }))).toThrow()
  })

  it('accepts a definition where enum default is in values list', () => {
    expect(() => reg.register(minimalDef({
      params: [{
        id: 'mode', type: 'enum', label: 'Mode', uniformName: 'u_mode',
        values: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
        default: 'b',
      }],
      defaults: { mode: 'b' },
    }))).not.toThrow()
  })
})

// ── E. Duplicate uniform names ────────────────────────────────────────────────

describe('E — duplicate uniform names', () => {
  it('rejects two params with the same uniformName', () => {
    expect(() => reg.register(minimalDef({
      params: [
        {
          id: 'alpha', type: 'float', label: 'Alpha', uniformName: 'u_value',
          min: 0, max: 1, default: 0.5,
        },
        {
          id: 'beta', type: 'float', label: 'Beta', uniformName: 'u_value',
          min: 0, max: 1, default: 0.5,
        },
      ],
      defaults: { alpha: 0.5, beta: 0.5 },
    }))).toThrow()
  })

  it('validator reports the duplicate uniformName error', () => {
    const result = ShaderDefinitionValidator.validate(minimalDef({
      params: [
        { id: 'a', type: 'float', label: 'A', uniformName: 'u_x', min: 0, max: 1, default: 0.5 },
        { id: 'b', type: 'float', label: 'B', uniformName: 'u_x', min: 0, max: 1, default: 0.5 },
      ],
      defaults: { a: 0.5, b: 0.5 },
    }))
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.message.includes('u_x'))).toBe(true)
  })
})

// ── F. Missing render-pass dependency ────────────────────────────────────────

describe('F — missing render-pass dependency', () => {
  it('rejects a pass that depends on a non-existent pass id', () => {
    const result = ShaderDefinitionValidator.validate(minimalDef({
      passes: [
        {
          id: 'pass-a',
          fragSrc: '#version 300 es\nout vec4 c; void main() { c = vec4(0); }',
          inputs: [],
          output: 'tex-a',
          dependsOn: ['pass-ghost'],  // 'pass-ghost' does not exist
        },
      ],
    }))
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.message.includes('pass-ghost'))).toBe(true)
  })

  it('accepts a pass that depends on an existing pass id', () => {
    const result = ShaderDefinitionValidator.validate(minimalDef({
      passes: [
        {
          id: 'pass-a',
          fragSrc: '#version 300 es\nout vec4 c; void main() { c = vec4(0); }',
          inputs: [],
          output: 'tex-a',
        },
        {
          id: 'pass-b',
          fragSrc: '#version 300 es\nout vec4 c; void main() { c = vec4(1); }',
          inputs: ['tex-a'],
          output: 'tex-b',
          dependsOn: ['pass-a'],
        },
      ],
      textureInputs: [],
    }))
    expect(result.valid).toBe(true)
  })

  it('rejects a pass whose dependsOn references itself', () => {
    const result = ShaderDefinitionValidator.validate(minimalDef({
      passes: [
        {
          id: 'self-ref',
          fragSrc: '#version 300 es\nout vec4 c; void main() { c = vec4(0); }',
          inputs: [],
          output: 'tex-s',
          dependsOn: ['self-ref'],
        },
      ],
    }))
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.message.includes('itself'))).toBe(true)
  })
})

// ── G. Registry filtering ─────────────────────────────────────────────────────

describe('G — registry filtering', () => {
  beforeEach(() => {
    reg.register(minimalDef({ id: 'gen-1', category: 'generator', tags: ['glowy'] }))
    reg.register(minimalDef({ id: 'gen-2', category: 'generator', tags: ['dark'] }))
    reg.register(minimalDef({ id: 'eff-1', category: 'effect',    tags: ['glowy', 'subtle'] }))
    reg.register(minimalDef({ id: 'ray-1', category: 'raymarch'                              }))
  })

  it('getByCategory returns only matching definitions', () => {
    const gens = reg.getByCategory('generator')
    expect(gens.map(d => d.id)).toEqual(['gen-1', 'gen-2'])
  })

  it('getByCategory returns empty array for unregistered category', () => {
    expect(reg.getByCategory('fractal')).toHaveLength(0)
  })

  it('getByTag returns definitions containing the tag', () => {
    const glowy = reg.getByTag('glowy')
    expect(glowy.map(d => d.id)).toEqual(['gen-1', 'eff-1'])
  })

  it('getByTag is case-sensitive', () => {
    expect(reg.getByTag('Glowy')).toHaveLength(0)
  })
})

// ── H. Deterministic insertion order ─────────────────────────────────────────

describe('H — deterministic ordering', () => {
  it('getAll() returns definitions in registration order', () => {
    reg.register(minimalDef({ id: 'z' }))
    reg.register(minimalDef({ id: 'a' }))
    reg.register(minimalDef({ id: 'm' }))
    expect(reg.getAll().map(d => d.id)).toEqual(['z', 'a', 'm'])
  })
})

// ── I. Dev scene validation ───────────────────────────────────────────────────

describe('I — development scene', () => {
  it('shader-dev-solid-color is registered in the module-level singleton', () => {
    expect(shaderRegistry.has('shader-dev-solid-color')).toBe(true)
  })

  it('dev scene has category utility', () => {
    expect(shaderRegistry.get('shader-dev-solid-color')?.category).toBe('utility')
  })

  it('dev scene validates cleanly', () => {
    const def = shaderRegistry.get('shader-dev-solid-color')!
    const result = ShaderDefinitionValidator.validate(def)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('dev scene has exactly two params: color and brightness', () => {
    const def = shaderRegistry.get('shader-dev-solid-color')!
    expect(def.params.map(p => p.id)).toEqual(['color', 'brightness'])
  })

  it('registers and validates the fourteen production scenes', () => {
    expect(PRODUCTION_SCENES.map(scene => scene.id)).toEqual([
      'shader-neon-tunnel',
      'shader-liquid-metaballs',
      'shader-feedback-kaleidoscope',
      'shader-spectrum-cathedral',
      'shader-brand-echo-signal',
      'shader-semantic-drop-reactor',
      'shader-bass-cathedral',
      'shader-laser-lattice-overdrive',
      'shader-trap-shrapnel-reactor',
      'shader-wobble-glyph-forge',
      'shader-dreamstate-mycelium',
      'shader-melodic-rift-bloom',
      'shader-riddim-railgun-sequencer',
      'shader-brand-singularity',
    ])
    for (const scene of PRODUCTION_SCENES) {
      expect(shaderRegistry.has(scene.id)).toBe(true)
      expect(ShaderDefinitionValidator.validate(scene).valid).toBe(true)
    }
  })

  it('ships production coverage for FFT, waveform, gradients, Brand roles, and media inputs', () => {
    const spectrum = shaderRegistry.get('shader-spectrum-cathedral')!
    const echo = shaderRegistry.get('shader-brand-echo-signal')!
    expect(spectrum.fragSrc).toContain('uSpectrumTexture')
    expect(spectrum.params.some(param => param.type === 'gradient')).toBe(true)
    expect(echo.fragSrc).toContain('uWaveformTexture')
    expect(echo.fragSrc).toContain('uBrandLogoTexture')
    expect(echo.textureInputs?.map(input => input.source)).toEqual([
      'uploaded-image', 'album-artwork', 'media-output',
    ])
    expect(PRODUCTION_SCENES.some(scene => scene.params.some(param =>
      param.type === 'color' && param.brandRole === 'primary'
    ))).toBe(true)
  })
})

// ── J. validateAll health-check ───────────────────────────────────────────────

describe('J — validateAll', () => {
  it('returns an empty record when no definitions are registered', () => {
    expect(reg.validateAll()).toEqual({})
  })

  it('returns a valid result for every registered definition', () => {
    reg.register(minimalDef({ id: 'x' }))
    reg.register(minimalDef({ id: 'y' }))
    const results = reg.validateAll()
    expect(results['x'].valid).toBe(true)
    expect(results['y'].valid).toBe(true)
  })
})

// ── K. unregister ─────────────────────────────────────────────────────────────

describe('K — unregister', () => {
  it('removes the definition from the registry', () => {
    reg.register(minimalDef())
    reg.unregister('test-scene')
    expect(reg.has('test-scene')).toBe(false)
    expect(reg.size).toBe(0)
  })

  it('allows re-registration after unregister', () => {
    reg.register(minimalDef())
    reg.unregister('test-scene')
    expect(() => reg.register(minimalDef())).not.toThrow()
  })

  it('does nothing when called for an unknown id', () => {
    expect(() => reg.unregister('does-not-exist')).not.toThrow()
  })
})

// ── L. Invalid pass resolution scale ─────────────────────────────────────────

describe('L — invalid pass resolution scale', () => {
  it('rejects a resolution scale below the minimum', () => {
    const result = ShaderDefinitionValidator.validate(minimalDef({
      passes: [{
        id: 'p',
        fragSrc: '#version 300 es\nout vec4 c; void main() { c = vec4(0); }',
        inputs: [],
        output: 'tex',
        resolutionScale: 0.01,  // below 0.05
      }],
    }))
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.message.includes('resolutionScale'))).toBe(true)
  })

  it('rejects a resolution scale above the maximum', () => {
    const result = ShaderDefinitionValidator.validate(minimalDef({
      passes: [{
        id: 'p',
        fragSrc: '#version 300 es\nout vec4 c; void main() { c = vec4(0); }',
        inputs: [],
        output: 'tex',
        resolutionScale: 5.0,  // above 4.0
      }],
    }))
    expect(result.valid).toBe(false)
  })

  it('accepts a resolution scale of exactly 1.0', () => {
    const result = ShaderDefinitionValidator.validate(minimalDef({
      passes: [{
        id: 'p',
        fragSrc: '#version 300 es\nout vec4 c; void main() { c = vec4(0); }',
        inputs: [],
        output: 'tex',
        resolutionScale: 1.0,
      }],
    }))
    expect(result.valid).toBe(true)
  })
})

// ── M. Default value outside param range ──────────────────────────────────────

describe('M — default value outside param range', () => {
  it('rejects when the built-in default is above max', () => {
    const result = ShaderDefinitionValidator.validate(minimalDef({
      params: [{
        id: 'p', type: 'float', label: 'P', uniformName: 'u_p',
        min: 0, max: 1, default: 1.5,
      }],
      defaults: { p: 1.5 },
    }))
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.field.includes('default'))).toBe(true)
  })

  it('rejects when defaults map value is above max', () => {
    const result = ShaderDefinitionValidator.validate(minimalDef({
      params: [{
        id: 'p', type: 'float', label: 'P', uniformName: 'u_p',
        min: 0, max: 1, default: 0.5,
      }],
      defaults: { p: 2.0 },  // out of range
    }))
    expect(result.valid).toBe(false)
  })
})

// ── N. defaults map references unknown param id ───────────────────────────────

describe('N — defaults map references unknown param id', () => {
  it('rejects defaults with a key that has no corresponding param', () => {
    const result = ShaderDefinitionValidator.validate(minimalDef({
      params: [],
      defaults: { ghost: 0.5 },
    }))
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.message.includes('"ghost"'))).toBe(true)
  })
})

// ── O. Texture input reference in pass not declared ───────────────────────────

describe('O — texture input reference in pass not declared', () => {
  it('rejects a pass input that is not in textureInputs or another pass output', () => {
    const result = ShaderDefinitionValidator.validate(minimalDef({
      passes: [{
        id: 'p',
        fragSrc: '#version 300 es\nout vec4 c; void main() { c = vec4(0); }',
        inputs: ['fft-data'],  // not declared in textureInputs
        output: 'tex',
      }],
      textureInputs: [],
    }))
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.message.includes('fft-data'))).toBe(true)
  })

  it('accepts a pass input that is declared in textureInputs', () => {
    const result = ShaderDefinitionValidator.validate(minimalDef({
      passes: [{
        id: 'p',
        fragSrc: '#version 300 es\nout vec4 c; void main() { c = vec4(0); }',
        inputs: ['fft-data'],
        output: 'tex',
      }],
      textureInputs: [
        { name: 'fft-data', label: 'FFT', source: 'fft' },
      ],
    }))
    expect(result.valid).toBe(true)
  })
})

// ── P. Pass self-dependency ───────────────────────────────────────────────────

describe('P — pass self-dependency', () => {
  it('rejects a pass listed in its own dependsOn', () => {
    const result = ShaderDefinitionValidator.validate(minimalDef({
      passes: [{
        id: 'loop',
        fragSrc: '#version 300 es\nout vec4 c; void main() { c = vec4(0); }',
        inputs: [],
        output: 'tex',
        dependsOn: ['loop'],
      }],
    }))
    expect(result.valid).toBe(false)
  })
})
