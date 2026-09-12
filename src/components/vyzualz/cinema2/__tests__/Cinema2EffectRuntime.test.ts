import { describe, expect, it, vi } from 'vitest'
import { createCinemaMockWebGL } from '../../cinema/__tests__/CinemaWebGLTestUtils'
import {
  CINEMA2_REFERENCE_VISUAL_BLOOM_ENABLED_ID,
  CINEMA2_REFERENCE_VISUAL_OUTPUT_ENABLED_ID,
  CINEMA2_REFERENCE_VISUAL_BLOOM_MIX_ID,
  CINEMA2_REFERENCE_VISUAL_PRESET_MANIFEST,
} from '../presets/Cinema2ReferenceVisualPreset'
import {
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  type Cinema2EffectId,
  type Cinema2EffectTypeId,
  type Cinema2NativePresetManifest,
  type Cinema2PresetId,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_BLUR_EFFECT_TYPE_ID } from '../effects/Cinema2BuiltinEffects'
import { Cinema2EffectRegistry, cinema2NativeEffectRegistry } from '../effects/Cinema2EffectRegistry'
import { Cinema2EffectRuntime } from '../effects/Cinema2EffectRuntime'
import { Cinema2PresetRegistry } from '../presets/Cinema2PresetRegistry'
import { Cinema2Runtime } from '../runtime/Cinema2Runtime'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'

const SECOND_EFFECT_ID = cinema2StableId<Cinema2EffectId>('reference-secondary-blur')
const UNKNOWN_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('missing-effect')

function compileManifest(manifest: Cinema2NativePresetManifest = CINEMA2_REFERENCE_VISUAL_PRESET_MANIFEST) {
  const result = compileCinema2NativePreset(manifest, { availableCapabilities: ['render.webgl2', 'audio.features'] })
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.diagnostics.map(diagnostic => diagnostic.message).join('; '))
  return result.plan
}

function createRuntime(manifest: Cinema2NativePresetManifest = CINEMA2_REFERENCE_VISUAL_PRESET_MANIFEST, quality: 'low' | 'medium' | 'high' = 'high') {
  const compiled = compileManifest(manifest)
  const state = new Cinema2ParameterState(compiled.parameters)
  const resolver = new Cinema2FinalValueResolver(compiled.targets, {
    resolveBaseValue: target => target.parameterId == null ? target.authoredBaseValue : state.getValue(target.parameterId),
  })
  const gl = createCinemaMockWebGL()
  gl.getUniformLocation = vi.fn((_program: WebGLProgram, name: string) => ({ name } as unknown as WebGLUniformLocation))
  const runtime = new Cinema2EffectRuntime(gl, compiled, resolver, cinema2NativeEffectRegistry, quality)
  return { compiled, state, gl, runtime }
}

function executionContext() {
  return {
    frame: {
      frameId: 1,
      timestampMs: 16.67,
      deltaTimeSec: 1 / 60,
      elapsedTimeSec: 1 / 60,
      viewport: { width: 640, height: 360, dpr: 1 },
      contextGeneration: 0,
      audio: null,
    },
    input: { texture: {} as WebGLTexture, width: 640, height: 360 },
    target: null,
    width: 640,
    height: 360,
  } as const
}

function effectId(manifest: Cinema2NativePresetManifest = CINEMA2_REFERENCE_VISUAL_PRESET_MANIFEST): Cinema2EffectId {
  const effect = manifest.effects?.[0]
  if (!effect) throw new Error('Reference Visual effect is missing.')
  return effect.id
}

function lastUniform(gl: ReturnType<typeof createCinemaMockWebGL>, name: string): number | undefined {
  const calls = (gl.uniform1f as ReturnType<typeof vi.fn>).mock.calls
    .filter((call: unknown[]) => (call[0] as { name?: string } | null)?.name === name)
  return calls[calls.length - 1]?.[1] as number | undefined
}

describe('Cinema 2.0 effect registry and instance runtime', () => {
  it('validates registered type versions and fails unknown authored effects before activation', () => {
    const registry = new Cinema2EffectRegistry()
    const definition = cinema2NativeEffectRegistry.get(CINEMA2_BLUR_EFFECT_TYPE_ID, 1)
    if (!definition) throw new Error('Built-in Blur definition is missing.')

    expect(registry.register(definition).ok).toBe(true)
    expect(registry.register(definition).diagnostics[0]?.code).toBe('CINEMA2_EFFECT_REGISTRY_VERSION_CONFLICT')

    const referenceEffect = CINEMA2_REFERENCE_VISUAL_PRESET_MANIFEST.effects?.[0]
    if (!referenceEffect) throw new Error('Reference effect is missing.')
    const unknownEffect = {
      ...referenceEffect,
      id: cinema2StableId<Cinema2EffectId>('unknown-effect'),
      typeId: UNKNOWN_EFFECT_TYPE_ID,
    }
    const validation = registry.validateEffects([unknownEffect])
    expect(validation.ok).toBe(false)
    expect(validation.diagnostics[0]).toMatchObject({ code: 'CINEMA2_EFFECT_TYPE_VERSION_UNAVAILABLE', effectId: unknownEffect.id })
  })

  it('rejects malformed order and incompatible parameter bindings at the preset compile boundary', () => {
    const referenceEffect = CINEMA2_REFERENCE_VISUAL_PRESET_MANIFEST.effects?.[0]
    if (!referenceEffect) throw new Error('Reference effect is missing.')
    const manifest: Cinema2NativePresetManifest = {
      ...CINEMA2_REFERENCE_VISUAL_PRESET_MANIFEST,
      effects: [{
        ...referenceEffect,
        order: -1,
        parameterBindings: {
          ...referenceEffect.parameterBindings,
          mix: cinema2Ref(CINEMA2_REFERENCE_VISUAL_OUTPUT_ENABLED_ID),
        },
      }],
    }

    const result = compileCinema2NativePreset(manifest, { availableCapabilities: ['render.webgl2', 'audio.features'] })
    expect(result.ok).toBe(false)
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CINEMA2_PRESET_EFFECT_ORDER_INVALID' }),
      expect.objectContaining({ code: 'CINEMA2_PRESET_EFFECT_BINDING_TYPE_MISMATCH' }),
    ]))
  })

  it('rejects unavailable effect implementations through runtime activation before requesting WebGL', () => {
    const referenceEffect = CINEMA2_REFERENCE_VISUAL_PRESET_MANIFEST.effects?.[0]
    if (!referenceEffect) throw new Error('Reference effect is missing.')
    const manifest: Cinema2NativePresetManifest = {
      ...CINEMA2_REFERENCE_VISUAL_PRESET_MANIFEST,
      id: cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.reference-visual-unknown-effect'),
      effects: [{ ...referenceEffect, typeId: UNKNOWN_EFFECT_TYPE_ID }],
    }
    const registry = new Cinema2PresetRegistry()
    expect(registry.register(manifest).ok).toBe(true)
    const canvas = new class extends EventTarget {
      width = 300
      height = 150
      readonly getContext = vi.fn(() => null)
    }()

    const result = Cinema2Runtime.create(canvas as unknown as HTMLCanvasElement, {
      presetId: manifest.id,
      presetRegistry: registry,
    })
    expect(result.runtime).toBeNull()
    expect(result.error).toContain('No Cinema 2.0 effect implementation is registered')
    expect(canvas.getContext).not.toHaveBeenCalled()
  })

  it('uses canonical parameter targets for mix/enabled, bypasses without work, and recreates lazily after re-enable', () => {
    const { state, gl, runtime } = createRuntime()
    const id = effectId()

    expect(gl.__calls.createdPrograms).toBe(0)
    expect(runtime.execute(id, executionContext())).toBe('applied')
    expect(gl.__calls.createdPrograms).toBe(1)
    expect(gl.__calls.drawCount).toBe(1)
    expect(lastUniform(gl, 'u_mix')).toBe(0.4)
    expect(runtime.getSnapshot()).toMatchObject({ activeEffectCount: 1, failedEffectCount: 0 })

    expect(state.setPersistentValue(CINEMA2_REFERENCE_VISUAL_BLOOM_MIX_ID, 0).ok).toBe(true)
    expect(runtime.execute(id, executionContext())).toBe('bypassed')
    expect(gl.__calls.drawCount).toBe(1)
    expect(gl.__calls.deletedPrograms).toBe(1)
    expect(runtime.getSnapshot().activeEffectCount).toBe(0)

    expect(state.setPersistentValue(CINEMA2_REFERENCE_VISUAL_BLOOM_MIX_ID, 0.75).ok).toBe(true)
    expect(runtime.execute(id, executionContext())).toBe('applied')
    expect(gl.__calls.createdPrograms).toBe(2)
    expect(lastUniform(gl, 'u_mix')).toBe(0.75)

    expect(state.setPersistentValue(CINEMA2_REFERENCE_VISUAL_BLOOM_ENABLED_ID, false).ok).toBe(true)
    expect(runtime.execute(id, executionContext())).toBe('bypassed')
    expect(gl.__calls.deletedPrograms).toBe(2)
    runtime.dispose()
    expect(runtime.getSnapshot().effects[0]?.status).toBe('disposed')
  })

  it('preserves explicit authored ordering and scope independent of effect type', () => {
    const first = CINEMA2_REFERENCE_VISUAL_PRESET_MANIFEST.effects?.[0]
    if (!first) throw new Error('Reference effect is missing.')
    const manifest: Cinema2NativePresetManifest = {
      ...CINEMA2_REFERENCE_VISUAL_PRESET_MANIFEST,
      effects: [
        { ...first, order: 20 },
        {
          id: SECOND_EFFECT_ID,
          typeId: CINEMA2_BLUR_EFFECT_TYPE_ID,
          version: 1,
          enabled: true,
          order: 5,
          scope: 'output',
          parameters: { mix: 0.5, radius: 2 },
        },
      ],
    }
    const { runtime } = createRuntime(manifest)
    expect(runtime.getOrderedEffectIds('output')).toEqual([SECOND_EFFECT_ID, first.id])
    runtime.dispose()
  })

  it('inherits quality gates and avoids creating GPU resources when the active quality is outside the authored range', () => {
    const first = CINEMA2_REFERENCE_VISUAL_PRESET_MANIFEST.effects?.[0]
    if (!first) throw new Error('Reference effect is missing.')
    const manifest: Cinema2NativePresetManifest = {
      ...CINEMA2_REFERENCE_VISUAL_PRESET_MANIFEST,
      effects: [{ ...first, quality: { min: 'high' } }],
    }
    const { gl, runtime } = createRuntime(manifest, 'medium')
    expect(runtime.execute(first.id, executionContext())).toBe('bypassed')
    expect(gl.__calls.createdPrograms).toBe(0)
    expect(runtime.getSnapshot().activeEffectCount).toBe(0)
    runtime.dispose()
  })

  it('disposes active instances on context loss and recreates them only on the next eligible frame', () => {
    const { gl, runtime } = createRuntime()
    const id = effectId()
    expect(runtime.execute(id, executionContext())).toBe('applied')
    expect(gl.__calls.createdPrograms).toBe(1)

    runtime.handleContextLost()
    expect(gl.__calls.deletedPrograms).toBe(1)
    expect(runtime.getSnapshot().activeEffectCount).toBe(0)
    runtime.handleContextRestored()
    expect(gl.__calls.createdPrograms).toBe(1)

    expect(runtime.execute(id, executionContext())).toBe('applied')
    expect(gl.__calls.createdPrograms).toBe(2)
    runtime.dispose()
    expect(gl.__calls.deletedPrograms).toBe(2)
  })
})
