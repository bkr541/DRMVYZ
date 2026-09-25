import { describe, expect, it, vi } from 'vitest'

import { createCinemaMockWebGL } from '../../cinema/__tests__/CinemaWebGLTestUtils'
import type { Cinema2EffectId, Cinema2NativePresetManifest } from '../contracts/Cinema2NativePresetManifest'
import {
  CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID,
  cinema2CinematicFinishEffectDefinition,
} from '../effects/Cinema2CinematicFinishEffect'
import { cinema2NativeEffectRegistry } from '../effects/Cinema2EffectRegistry'
import { Cinema2EffectRuntime } from '../effects/Cinema2EffectRuntime'
import {
  CINEMA2_REFLECTIVE_FLOOR_EFFECT_TYPE_ID,
  CINEMA2_REFLECTIVE_FLOOR_QUALITY_PROFILES,
  cinema2ReflectiveFloorEffectDefinition,
} from '../effects/Cinema2ReflectiveFloorEffect'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import {
  CINEMA2_ATMOSPHERE_REFERENCE_FINISH_EFFECT_ID,
  CINEMA2_ATMOSPHERE_REFERENCE_FLOOR_EFFECT_ID,
  CINEMA2_ATMOSPHERE_REFERENCE_PRESET_MANIFEST,
  CINEMA2_ATMOSPHERE_REFERENCE_VOLUMETRIC_EFFECT_ID,
} from '../presets/Cinema2AtmosphereReferencePreset'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { Cinema2HistoryService } from '../runtime/Cinema2HistoryService'
import { Cinema2ResourceManager } from '../runtime/Cinema2ResourceManager'

const CAPABILITIES = ['render.webgl2', 'render.depth', 'scene.3d', 'camera.world', 'lighting', 'music.beat', 'music.downbeat', 'music.phrase', 'visual-director.significance'] as const

type ExecutionContext = Parameters<Cinema2EffectRuntime['execute']>[1]

function createEffectRuntime(quality: 'low' | 'medium' | 'high', manifest: Cinema2NativePresetManifest = CINEMA2_ATMOSPHERE_REFERENCE_PRESET_MANIFEST) {
  const compiled = compileCinema2NativePreset(manifest, { availableCapabilities: CAPABILITIES })
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
  return { gl, runtime: new Cinema2EffectRuntime(gl, plan, resolver, cinema2NativeEffectRegistry, quality, history) }
}

function perspectiveViewProjection(): number[] {
  const f = 1 / Math.tan((50 * Math.PI) / 360)
  const near = 0.1
  const far = 60
  const projection = [
    f / (16 / 9), 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) / (near - far), -1,
    0, 0, (2 * far * near) / (near - far), 0,
  ]
  const view = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -1, -5, 1]
  const out = new Array<number>(16).fill(0)
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) for (let k = 0; k < 4; k += 1) out[column * 4 + row] += projection[k * 4 + row] * view[column * 4 + k]
  }
  return out
}

function context(options: { depth: boolean; camera: boolean }): ExecutionContext {
  const color = { id: 'color', attachment: 'color' as const, texture: {} as WebGLTexture, width: 640, height: 360 }
  const depth = { id: 'depth', attachment: 'depth' as const, texture: {} as WebGLTexture, width: 640, height: 360 }
  return {
    frame: { frameId: 1, timestampMs: 16.67, deltaTimeSec: 1 / 60, elapsedTimeSec: 2, viewport: { width: 640, height: 360, dpr: 1 }, contextGeneration: 0, audio: null, director: null },
    input: color,
    inputs: options.depth ? [color, depth] : [color],
    target: null,
    width: 640,
    height: 360,
    camera: options.camera ? ({ viewProjectionMatrix: perspectiveViewProjection(), near: 0.1, far: 60 } as never) : undefined,
    lightingEnvironment: {
      quality: 'high',
      lights: [{ id: 'l', type: 'spot', color: [1, 1, 1, 1], intensity: 2, position: [0, 5, 0], targetPosition: null, direction: [0, -1, 0], spot: { outerAngleDegrees: 20, innerAngleDegrees: 10 }, range: 20 }],
      omittedLightCount: 0,
      environment: { authored: true, backgroundColor: [0, 0, 0, 1], exposure: 1, fog: null },
    },
  } as unknown as ExecutionContext
}

function lastUniform(gl: ReturnType<typeof createCinemaMockWebGL>, fn: 'uniform1f' | 'uniform1i', name: string): number | undefined {
  const calls = (gl[fn] as ReturnType<typeof vi.fn>).mock.calls.filter((call: unknown[]) => (call[0] as { name?: string } | null)?.name === name)
  return calls[calls.length - 1]?.[1] as number | undefined
}

const FLOOR = CINEMA2_ATMOSPHERE_REFERENCE_FLOOR_EFFECT_ID
const FINISH = CINEMA2_ATMOSPHERE_REFERENCE_FINISH_EFFECT_ID
const VOLUMETRIC = CINEMA2_ATMOSPHERE_REFERENCE_VOLUMETRIC_EFFECT_ID

function effectManifest(id: Cinema2EffectId) {
  return CINEMA2_ATMOSPHERE_REFERENCE_PRESET_MANIFEST.effects!.find(effect => effect.id === id)!
}

describe('Cinema 2.0 Cinematic Finish effect', () => {
  it('is registered and validates its controls', () => {
    expect(cinema2NativeEffectRegistry.get(CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID, 1)).not.toBeNull()
    expect(cinema2CinematicFinishEffectDefinition.validate!(effectManifest(FINISH))).toEqual([])
    const bad = { ...effectManifest(FINISH), parameters: { mix: 1, exposure: 9, toneMap: 1.5, vignette: -1, shadowTint: [2, 0, 0] } }
    expect(cinema2CinematicFinishEffectDefinition.validate!(bad).map(diagnostic => diagnostic.path)).toEqual(
      expect.arrayContaining(['$.parameters.exposure', '$.parameters.toneMap', '$.parameters.vignette', '$.parameters.shadowTint']),
    )
  })

  it('renders with clamped controls and filmic tone mapping by default', () => {
    const { gl, runtime } = createEffectRuntime('high')
    expect(runtime.execute(FINISH, context({ depth: false, camera: false }))).toBe('applied')
    expect(lastUniform(gl, 'uniform1i', 'u_toneMap')).toBe(1)
    expect(lastUniform(gl, 'uniform1f', 'u_exposure')).toBeCloseTo(1.35)
    expect(lastUniform(gl, 'uniform1f', 'u_vignette')).toBeCloseTo(0.4)
    expect(lastUniform(gl, 'uniform1f', 'u_mix')).toBe(1)
    runtime.dispose()
  })

  it('needs neither depth nor a camera, so any preset can end with it', () => {
    const { runtime } = createEffectRuntime('low')
    expect(runtime.execute(FINISH, context({ depth: false, camera: false }))).toBe('applied')
    runtime.dispose()
  })
})

describe('Cinema 2.0 Reflective Floor effect', () => {
  it('is registered and validates its controls', () => {
    expect(cinema2NativeEffectRegistry.get(CINEMA2_REFLECTIVE_FLOOR_EFFECT_TYPE_ID, 1)).not.toBeNull()
    expect(cinema2ReflectiveFloorEffectDefinition.validate!(effectManifest(FLOOR))).toEqual([])
    const bad = { ...effectManifest(FLOOR), parameters: { mix: 1, floorY: 99, reflectivity: 2, baseColor: [1, 1] } }
    expect(cinema2ReflectiveFloorEffectDefinition.validate!(bad).map(diagnostic => diagnostic.path)).toEqual(
      expect.arrayContaining(['$.parameters.floorY', '$.parameters.reflectivity', '$.parameters.baseColor']),
    )
  })

  it('scales reflection march steps and blur with the shared quality level', () => {
    const profiles = CINEMA2_REFLECTIVE_FLOOR_QUALITY_PROFILES
    expect(profiles.low.steps).toBeLessThan(profiles.medium.steps)
    expect(profiles.medium.steps).toBeLessThan(profiles.high.steps)
    for (const quality of ['low', 'high'] as const) {
      const { gl, runtime } = createEffectRuntime(quality)
      expect(runtime.execute(FLOOR, context({ depth: true, camera: true }))).toBe('applied')
      expect(lastUniform(gl, 'uniform1i', 'u_steps')).toBe(profiles[quality].steps)
      expect(lastUniform(gl, 'uniform1i', 'u_blurTaps')).toBe(profiles[quality].blurTaps)
      expect(lastUniform(gl, 'uniform1f', 'u_enabled')).toBe(1)
      expect(lastUniform(gl, 'uniform1f', 'u_floorY')).toBeCloseTo(-1.2)
      runtime.dispose()
    }
  })

  it('passes the image through when it cannot depth-test against a world camera', () => {
    for (const options of [{ depth: false, camera: true }, { depth: true, camera: false }]) {
      const { gl, runtime } = createEffectRuntime('high')
      expect(runtime.execute(FLOOR, context(options))).toBe('applied')
      expect(lastUniform(gl, 'uniform1f', 'u_enabled')).toBe(0)
      runtime.dispose()
    }
  })
})

describe('Cinema 2.0 volumetric floor integration', () => {
  it('clamps haze at an authored floor plane and leaves it unclamped otherwise', () => {
    const withFloor = createEffectRuntime('high')
    withFloor.runtime.execute(VOLUMETRIC, context({ depth: true, camera: true }))
    expect(lastUniform(withFloor.gl, 'uniform1f', 'u_floorEnabled')).toBe(1)
    expect(lastUniform(withFloor.gl, 'uniform1f', 'u_floorY')).toBeCloseTo(-1.2)
    expect(lastUniform(withFloor.gl, 'uniform1f', 'u_floorReflection')).toBeCloseTo(0.7)
    withFloor.runtime.dispose()

    const volumetric = effectManifest(VOLUMETRIC)
    const { floorY: _floorY, ...withoutFloorParameters } = volumetric.parameters as Record<string, unknown>
    const manifest = {
      ...CINEMA2_ATMOSPHERE_REFERENCE_PRESET_MANIFEST,
      effects: CINEMA2_ATMOSPHERE_REFERENCE_PRESET_MANIFEST.effects!.map(effect => effect.id === VOLUMETRIC ? { ...effect, parameters: withoutFloorParameters } : effect),
    } as Cinema2NativePresetManifest
    const withoutFloor = createEffectRuntime('high', manifest)
    withoutFloor.runtime.execute(VOLUMETRIC, context({ depth: true, camera: true }))
    expect(lastUniform(withoutFloor.gl, 'uniform1f', 'u_floorEnabled')).toBe(0)
    withoutFloor.runtime.dispose()
  })

  it('orders the reference chain scene -> floor -> volumetric -> bloom -> finish with finish as the output', () => {
    const compiled = compileCinema2NativePreset(CINEMA2_ATMOSPHERE_REFERENCE_PRESET_MANIFEST, { availableCapabilities: CAPABILITIES })
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return
    const order = compiled.plan.render.passOrder.map(passId => compiled.plan.render.passes.find(pass => pass.id === passId)?.effect?.id ?? 'scene')
    expect(order).toEqual(['scene', FLOOR, VOLUMETRIC, 'atmosphere-reference-bloom', FINISH])
    expect(compiled.plan.render.passes.find(pass => pass.effect?.id === FINISH)?.id).toBe(compiled.plan.render.outputPassId)
  })
})
