import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import { createCinemaMockWebGL } from '../../cinema/__tests__/CinemaWebGLTestUtils'
import { Cinema2AudioIntelligenceBridge } from '../audio/Cinema2AudioIntelligenceBridge'
import {
  cinema2StableId,
  type Cinema2EffectId,
  type Cinema2NativePresetManifest,
} from '../contracts/Cinema2NativePresetManifest'
import {
  CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID,
  CINEMA2_VOLUMETRIC_MAX_LIGHTS,
  CINEMA2_VOLUMETRIC_QUALITY_PROFILES,
  cinema2VolumetricAtmosphereEffectDefinition,
  invertCinema2Matrix4,
  packCinema2VolumetricLights,
} from '../effects/Cinema2VolumetricAtmosphereEffect'
import { cinema2NativeEffectRegistry } from '../effects/Cinema2EffectRegistry'
import { Cinema2EffectRuntime } from '../effects/Cinema2EffectRuntime'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import {
  CINEMA2_ATMOSPHERE_REFERENCE_PRESET_ID,
  CINEMA2_ATMOSPHERE_REFERENCE_PRESET_MANIFEST,
  CINEMA2_ATMOSPHERE_REFERENCE_VOLUMETRIC_EFFECT_ID,
} from '../presets/Cinema2AtmosphereReferencePreset'
import { Cinema2Runtime } from '../runtime/Cinema2Runtime'
import { Cinema2ResourceManager } from '../runtime/Cinema2ResourceManager'
import { Cinema2HistoryService } from '../runtime/Cinema2HistoryService'
import type { Cinema2ResolvedLightFrame } from '../spatial/Cinema2LightingEnvironmentRuntime'

const CAPABILITIES = ['render.webgl2', 'render.depth', 'scene.3d', 'camera.world', 'lighting', 'music.downbeat'] as const

function light(overrides: Partial<Cinema2ResolvedLightFrame>): Cinema2ResolvedLightFrame {
  return {
    id: cinema2StableId('test-light'),
    type: 'point',
    color: [1, 0.5, 0.25, 1],
    intensity: 2,
    position: [1, 2, 3],
    targetPosition: null,
    direction: [0, -1, 0],
    spot: null,
    range: 20,
    ...overrides,
  } as Cinema2ResolvedLightFrame
}

function multiply(a: readonly number[], b: readonly number[]): number[] {
  const out = new Array<number>(16).fill(0)
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      for (let k = 0; k < 4; k += 1) out[column * 4 + row] += a[k * 4 + row] * b[column * 4 + k]
    }
  }
  return out
}

// Column-major perspective * a camera translated to (0, 1, 5) looking down -Z.
function perspectiveView(): number[] {
  const f = 1 / Math.tan((50 * Math.PI) / 360)
  const near = 0.1
  const far = 60
  const aspect = 16 / 9
  const projection = [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) / (near - far), -1,
    0, 0, (2 * far * near) / (near - far), 0,
  ]
  const view = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -1, -5, 1]
  return multiply(projection, view)
}

function createEffectRuntime(quality: 'low' | 'medium' | 'high') {
  const compiled = compileCinema2NativePreset(CINEMA2_ATMOSPHERE_REFERENCE_PRESET_MANIFEST, { availableCapabilities: CAPABILITIES })
  if (!compiled.ok) throw new Error(compiled.diagnostics.map(diagnostic => diagnostic.message).join('; '))
  const plan = compiled.plan
  const state = new Cinema2ParameterState(plan.parameters)
  const resolver = new Cinema2FinalValueResolver(plan.targets, {
    resolveBaseValue: target => target.parameterId == null ? target.authoredBaseValue : state.getValue(target.parameterId),
  })
  const gl = createCinemaMockWebGL()
  gl.getUniformLocation = vi.fn((_program: WebGLProgram, name: string) => ({ name } as unknown as WebGLUniformLocation))
  const resources = new Cinema2ResourceManager(gl)
  const history = new Cinema2HistoryService(gl, resources, plan.presetId)
  const runtime = new Cinema2EffectRuntime(gl, plan, resolver, cinema2NativeEffectRegistry, quality, history)
  return { gl, runtime, history }
}

type EffectExecutionContext = Parameters<Cinema2EffectRuntime['execute']>[1]

function executionContext(options: { depth: boolean; camera: boolean; lights: Cinema2ResolvedLightFrame[] }): EffectExecutionContext {
  const color = { id: 'color', attachment: 'color' as const, texture: {} as WebGLTexture, width: 640, height: 360 }
  const depth = { id: 'depth', attachment: 'depth' as const, texture: {} as WebGLTexture, width: 640, height: 360 }
  const vp = perspectiveView()
  return {
    frame: {
      frameId: 1,
      timestampMs: 16.67,
      deltaTimeSec: 1 / 60,
      elapsedTimeSec: 2,
      viewport: { width: 640, height: 360, dpr: 1 },
      contextGeneration: 0,
      audio: null,
      director: null,
    },
    input: color,
    inputs: options.depth ? [color, depth] : [color],
    target: null,
    width: 640,
    height: 360,
    camera: options.camera ? ({ viewProjectionMatrix: vp, near: 0.1, far: 60 } as never) : undefined,
    lightingEnvironment: {
      quality: 'high' as const,
      lights: options.lights,
      omittedLightCount: 0,
      environment: { authored: true, backgroundColor: [0, 0, 0, 1], exposure: 1, fog: null },
    },
  } as unknown as EffectExecutionContext
}

function lastUniform(gl: ReturnType<typeof createCinemaMockWebGL>, fn: 'uniform1f' | 'uniform1i', name: string): number | undefined {
  const calls = (gl[fn] as ReturnType<typeof vi.fn>).mock.calls.filter((call: unknown[]) => (call[0] as { name?: string } | null)?.name === name)
  return calls[calls.length - 1]?.[1] as number | undefined
}

describe('Cinema 2.0 Volumetric Atmosphere effect', () => {
  it('inverts a perspective view-projection so unprojected clip points round-trip', () => {
    const vp = perspectiveView()
    const inverse = invertCinema2Matrix4(vp)
    expect(inverse).not.toBeNull()
    const product = multiply(vp, Array.from(inverse!))
    for (let index = 0; index < 16; index += 1) expect(product[index]).toBeCloseTo(index % 5 === 0 ? 1 : 0, 4)
    expect(invertCinema2Matrix4(new Array(16).fill(0))).toBeNull()
    expect(invertCinema2Matrix4([...vp.slice(0, 15), Number.NaN])).toBeNull()
  })

  it('packs spot, point, directional and ambient lights into the fixed uniform layout', () => {
    const packed = packCinema2VolumetricLights([
      light({ type: 'ambient', color: [0.5, 0.5, 1, 1], intensity: 0.4 }),
      light({ type: 'spot', spot: { outerAngleDegrees: 20, innerAngleDegrees: 10 }, position: [4, 5, 6], range: 12 }),
      light({ type: 'directional' }),
      light({ type: 'point' }),
    ])
    expect(packed.count).toBe(3)
    expect(packed.ambient[0]).toBeCloseTo(0.2)
    expect(packed.ambient[2]).toBeCloseTo(0.4)
    expect(Array.from(packed.position.slice(0, 4))).toEqual([4, 5, 6, 12])
    expect(packed.direction[3]).toBeCloseTo(Math.cos((20 * Math.PI) / 180))
    expect(packed.inner[0]).toBeCloseTo(Math.cos((10 * Math.PI) / 180))
    expect([packed.color[3], packed.color[7], packed.color[11]]).toEqual([3, 1, 2])
    expect(packed.color[0]).toBeCloseTo(2)
  })

  it('never packs more lights than the shader array holds', () => {
    const many = Array.from({ length: CINEMA2_VOLUMETRIC_MAX_LIGHTS + 4 }, () => light({}))
    expect(packCinema2VolumetricLights(many).count).toBe(CINEMA2_VOLUMETRIC_MAX_LIGHTS)
  })

  it('is registered and validates ranges and haze color', () => {
    expect(cinema2NativeEffectRegistry.get(CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID, 1)).not.toBeNull()
    const base = CINEMA2_ATMOSPHERE_REFERENCE_PRESET_MANIFEST.effects![0]
    expect(cinema2VolumetricAtmosphereEffectDefinition.validate!(base)).toEqual([])
    const bad = { ...base, parameters: { ...base.parameters, density: 9, hazeColor: [2, 0, 0] } }
    const codes = cinema2VolumetricAtmosphereEffectDefinition.validate!(bad).map(diagnostic => diagnostic.path)
    expect(codes).toEqual(expect.arrayContaining(['$.parameters.density', '$.parameters.hazeColor']))
  })

  it('scales step count with the shared quality level', () => {
    expect(CINEMA2_VOLUMETRIC_QUALITY_PROFILES.low.steps).toBeLessThan(CINEMA2_VOLUMETRIC_QUALITY_PROFILES.medium.steps)
    expect(CINEMA2_VOLUMETRIC_QUALITY_PROFILES.medium.steps).toBeLessThan(CINEMA2_VOLUMETRIC_QUALITY_PROFILES.high.steps)
    for (const quality of ['low', 'high'] as const) {
      const { gl, runtime } = createEffectRuntime(quality)
      const result = runtime.execute(CINEMA2_ATMOSPHERE_REFERENCE_VOLUMETRIC_EFFECT_ID, executionContext({ depth: true, camera: true, lights: [light({})] }))
      expect(result).toBe('applied')
      expect(lastUniform(gl, 'uniform1i', 'u_steps')).toBe(CINEMA2_VOLUMETRIC_QUALITY_PROFILES[quality].steps)
      runtime.dispose()
    }
  })

  it('marches at reduced resolution into a history-owned buffer sized by quality, and releases it on dispose', () => {
    const { runtime, history } = createEffectRuntime('high')
    runtime.execute(CINEMA2_ATMOSPHERE_REFERENCE_VOLUMETRIC_EFFECT_ID, executionContext({ depth: true, camera: true, lights: [light({})] }))
    const buffer = history.getSnapshot().buffers.find(entry => entry.name.includes('volumetric-atmosphere'))
    const scale = CINEMA2_VOLUMETRIC_QUALITY_PROFILES.high.scale
    expect(scale).toBeLessThan(1)
    expect(buffer).toMatchObject({ width: Math.round(640 * scale), height: Math.round(360 * scale) })
    runtime.dispose()
    expect(history.getSnapshot().buffers.some(entry => entry.name.includes('volumetric-atmosphere'))).toBe(false)
  })

  it('falls back to a full-resolution march when the reduced buffer is unavailable', () => {
    const { gl, runtime, history } = createEffectRuntime('medium')
    vi.spyOn(history, 'beginFrame').mockReturnValue(null)
    const result = runtime.execute(CINEMA2_ATMOSPHERE_REFERENCE_VOLUMETRIC_EFFECT_ID, executionContext({ depth: true, camera: true, lights: [light({})] }))
    expect(result).toBe('applied')
    expect(lastUniform(gl, 'uniform1i', 'u_steps')).toBe(CINEMA2_VOLUMETRIC_QUALITY_PROFILES.medium.steps)
    runtime.dispose()
  })

  it('marches to the scene depth when a depth input is wired and degrades to unoccluded haze without one', () => {
    const withDepth = createEffectRuntime('high')
    withDepth.runtime.execute(CINEMA2_ATMOSPHERE_REFERENCE_VOLUMETRIC_EFFECT_ID, executionContext({ depth: true, camera: true, lights: [] }))
    expect(lastUniform(withDepth.gl, 'uniform1f', 'u_hasDepth')).toBe(1)
    expect(lastUniform(withDepth.gl, 'uniform1f', 'u_hasCamera')).toBe(1)

    const withoutDepth = createEffectRuntime('high')
    const result = withoutDepth.runtime.execute(CINEMA2_ATMOSPHERE_REFERENCE_VOLUMETRIC_EFFECT_ID, executionContext({ depth: false, camera: true, lights: [] }))
    expect(result).toBe('applied')
    expect(lastUniform(withoutDepth.gl, 'uniform1f', 'u_hasDepth')).toBe(0)

    const withoutCamera = createEffectRuntime('high')
    const fallback = withoutCamera.runtime.execute(CINEMA2_ATMOSPHERE_REFERENCE_VOLUMETRIC_EFFECT_ID, executionContext({ depth: false, camera: false, lights: [] }))
    expect(fallback).toBe('applied')
    expect(lastUniform(withoutCamera.gl, 'uniform1f', 'u_hasCamera')).toBe(0)
    withDepth.runtime.dispose()
    withoutDepth.runtime.dispose()
    withoutCamera.runtime.dispose()
  })
})

describe('Cinema 2.0 Atmosphere Reference preset', () => {
  it('compiles with the depth-fed volumetric pass between the scene and bloom', () => {
    const compiled = compileCinema2NativePreset(CINEMA2_ATMOSPHERE_REFERENCE_PRESET_MANIFEST, { availableCapabilities: CAPABILITIES })
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return
    const effectPass = compiled.plan.render.passes.find(pass => pass.effect?.id === CINEMA2_ATMOSPHERE_REFERENCE_VOLUMETRIC_EFFECT_ID)
    expect(effectPass?.inputs.map(input => input.attachment).sort()).toEqual(['color', 'depth'])
    expect(compiled.plan.render.targets.find(target => target.sampleableDepth)).toBeDefined()
    expect(compiled.plan.manifest.effects?.map(effect => effect.id as Cinema2EffectId)).toHaveLength(2)
  })

  it('renders through the real Runtime path with the volumetric effect active and no failed passes', () => {
    const gl = createCinemaMockWebGL()
    class FakeCanvas extends EventTarget {
      width = 640
      height = 360
      getContext = vi.fn(() => gl)
    }
    const frameCallback: { current: FrameRequestCallback | null } = { current: null }
    const bridge = new Cinema2AudioIntelligenceBridge({
      getFrame: () => ({ ...DEFAULT_MI_FRAME, frameId: 1, timeSec: 1 }),
      getPublicationMeta: () => ({ sequence: 1, publishedAtMs: 1000, publisherId: 'atmosphere-test', kind: 'frame' as const }),
    })
    const created = Cinema2Runtime.create(new FakeCanvas() as unknown as HTMLCanvasElement, {
      presetId: CINEMA2_ATMOSPHERE_REFERENCE_PRESET_ID,
      audioIntelligenceBridge: bridge,
      requestAnimationFrame: (cb: FrameRequestCallback) => { frameCallback.current = cb; return 1 },
      cancelAnimationFrame: () => { frameCallback.current = null },
      renderQuality: 'high',
    })
    expect(created.error).toBeNull()
    if (!created.runtime) return
    created.runtime.resize({ width: 640, height: 360, dpr: 1 })
    created.runtime.start()
    frameCallback.current?.(1000)
    expect(created.runtime.getRenderGraphExecutorSnapshot()).toMatchObject({ failedPassCount: 0, executedPassCount: 3 })
    expect(created.runtime.getEffectRuntimeSnapshot().effects.map(effect => effect.status)).toEqual(['active', 'active'])
    created.runtime.dispose()
    expect(gl.__calls.createdPrograms).toBe(gl.__calls.deletedPrograms)
    expect(gl.__calls.createdTextures).toBe(gl.__calls.deletedTextures)
    expect(gl.__calls.createdFramebuffers).toBe(gl.__calls.deletedFramebuffers)
  })

  it('is a valid first-party manifest and does not change the existing presets', () => {
    const manifest: Cinema2NativePresetManifest = CINEMA2_ATMOSPHERE_REFERENCE_PRESET_MANIFEST
    expect(manifest.metadata.tags).not.toContain('internal')
  })
})
