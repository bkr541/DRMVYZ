import { describe, expect, it, vi } from 'vitest'

import { createCinemaMockWebGL } from '../../cinema/__tests__/CinemaWebGLTestUtils'
import type { Cinema2ModuleRenderPassProvider } from '../modules/Cinema2ModuleContracts'
import { CINEMA2_SHADOW_RESOLUTIONS, Cinema2ShadowService, fitLight } from '../runtime/Cinema2ShadowService'
import type { Cinema2CameraFrame } from '../spatial/Cinema2CameraRuntime'
import type { Cinema2LightingEnvironmentFrame, Cinema2LightShadowSettings, Cinema2ResolvedLightFrame } from '../spatial/Cinema2LightingEnvironmentRuntime'
import { CINEMA2_THRESHOLD_KEY_LIGHT_ID, CINEMA2_THRESHOLD_PRESET_MANIFEST } from '../presets/Cinema2ThresholdPreset'
import { packCinema2VolumetricLights } from '../effects/Cinema2VolumetricAtmosphereEffect'
import { Cinema2LightingEnvironmentRuntime } from '../spatial/Cinema2LightingEnvironmentRuntime'
import { multiplyMatrices, orthographicMatrix } from '../spatial/Cinema2LightMatrices'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { Cinema2SpatialRuntime } from '../spatial/Cinema2SpatialRuntime'

const CAPABILITIES = ['render.webgl2', 'render.depth', 'scene.3d', 'camera.world', 'lighting', 'audio.bands', 'audio.features', 'music.beat', 'music.downbeat', 'music.rhythm-events', 'music.phrase', 'music.drop', 'visual-director.significance'] as const

const SHADOW: Readonly<Cinema2LightShadowSettings> = Object.freeze({ extent: 40, depth: 160, focusAhead: 20, bias: 0.15, softness: 1 })

function directional(overrides: Partial<Cinema2ResolvedLightFrame> = {}): Readonly<Cinema2ResolvedLightFrame> {
  return {
    id: 'key' as never, type: 'directional', color: [1, 1, 1, 1], intensity: 1, position: [0, 0, 0], targetPosition: null,
    direction: [0.6, -0.3, -0.74], spot: null, range: 30, shadow: SHADOW, ...overrides,
  } as Readonly<Cinema2ResolvedLightFrame>
}

function camera(position: [number, number, number], target: [number, number, number] = [position[0], position[1], position[2] - 10]): Readonly<Cinema2CameraFrame> {
  return { position, target, near: 0.1, far: 100 } as unknown as Readonly<Cinema2CameraFrame>
}

function lighting(lights: Readonly<Cinema2ResolvedLightFrame>[]): Readonly<Cinema2LightingEnvironmentFrame> {
  return { quality: 'high', lights, omittedLightCount: 0 } as unknown as Readonly<Cinema2LightingEnvironmentFrame>
}

function project(matrix: readonly number[], p: readonly [number, number, number]): [number, number, number] {
  const x = matrix[0]! * p[0] + matrix[4]! * p[1] + matrix[8]! * p[2] + matrix[12]!
  const y = matrix[1]! * p[0] + matrix[5]! * p[1] + matrix[9]! * p[2] + matrix[13]!
  const z = matrix[2]! * p[0] + matrix[6]! * p[1] + matrix[10]! * p[2] + matrix[14]!
  const w = matrix[3]! * p[0] + matrix[7]! * p[1] + matrix[11]! * p[2] + matrix[15]!
  return [x / w, y / w, z / w]
}

function createGl() {
  const gl = createCinemaMockWebGL()
  const extras = gl as unknown as Record<string, unknown>
  Object.assign(extras, {
    texStorage2D: vi.fn(), polygonOffset: vi.fn(), depthFunc: vi.fn(), isEnabled: vi.fn(() => false), depthMask: vi.fn(),
    FRAMEBUFFER: 0x8d40, TEXTURE_COMPARE_MODE: 0x884c, COMPARE_REF_TO_TEXTURE: 0x884e, TEXTURE_COMPARE_FUNC: 0x884d,
    POLYGON_OFFSET_FILL: 0x8037, VIEWPORT: 0x0ba2, DEPTH_WRITEMASK: 0x0b72, COLOR_WRITEMASK: 0x0c23, DEPTH_FUNC: 0x0b74,
    TEXTURE_BINDING_2D: 0x8069, TEXTURE_2D: 0x0de1, LINEAR: 0x2601, TEXTURE_MIN_FILTER: 0x2801, TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_WRAP_S: 0x2802, TEXTURE_WRAP_T: 0x2803,
  })
  return gl
}

function caster(overrides: Partial<Cinema2ModuleRenderPassProvider> = {}) {
  const renderShadow = vi.fn()
  const provider = { id: 'caster', moduleId: 'm', intent: 'world', execute: vi.fn(), renderShadow, ...overrides } as unknown as Readonly<Cinema2ModuleRenderPassProvider>
  return { provider, renderShadow }
}

const FRAME = { frameId: 1, timestampMs: 0, deltaTimeSec: 1 / 60, elapsedTimeSec: 0, viewport: { width: 640, height: 360, dpr: 1 }, contextGeneration: 0, audio: null, director: null } as never

describe('Cinema 2.0 light fitting', () => {
  it('centres a directional light on the point ahead of the camera and snaps to whole texels', () => {
    const light = directional()
    const resolution = 1024
    const texel = (2 * SHADOW.extent) / resolution
    const a = fitLight(light, camera([0, 2, -100]), resolution)!
    // A point at the focus (camera + forward * focusAhead) lands mid-map, and its depth is inside the range.
    const [x, y, z] = project(a.viewProjection, [0, 2, -120])
    expect(Math.abs(x)).toBeLessThan(texel * 2)
    expect(Math.abs(y)).toBeLessThan(0.2)
    expect(z).toBeGreaterThan(-1)
    expect(z).toBeLessThan(1)
    expect(a.texelWorldSize).toBeCloseTo(texel, 9)
    // Moving the camera by less than a texel keeps the matrix identical (no shimmer); a big move changes it.
    const nudged = fitLight(light, camera([0.00001, 2, -100.00001]), resolution)!
    expect(nudged.viewProjection).toEqual(a.viewProjection)
    const moved = fitLight(light, camera([0, 2, -110]), resolution)!
    expect(moved.viewProjection).not.toEqual(a.viewProjection)
  })

  it('projects points inside the extent into the unit cube and points outside past it', () => {
    const light = directional({ direction: [0, -1, 0] })
    const fit = fitLight(light, camera([0, 0, 0], [0, 0, -1]), 512)!
    const focus: [number, number, number] = [0, 0, -20]
    const inside = project(fit.viewProjection, [focus[0] + 30, 0, focus[2]])
    const outside = project(fit.viewProjection, [focus[0] + 60, 0, focus[2]])
    expect(Math.abs(inside[0]) <= 1 || Math.abs(inside[1]) <= 1).toBe(true)
    expect(Math.max(Math.abs(outside[0]), Math.abs(outside[1]))).toBeGreaterThan(1)
  })

  it('uses the cone and range for spot lights and returns null for lights without shadow settings', () => {
    const spot = directional({ type: 'spot', position: [0, 10, 0], direction: [0, -1, 0], spot: { outerAngleDegrees: 30, innerAngleDegrees: 20 }, range: 40 })
    const fit = fitLight(spot, camera([0, 0, 0]), 1024)!
    const centre = project(fit.viewProjection, [0, 0, 0])
    expect(Math.abs(centre[0])).toBeLessThan(1e-9)
    expect(centre[2]).toBeGreaterThan(-1)
    expect(centre[2]).toBeLessThan(1)
    // The cone edge at 30 degrees lands on the map border.
    const edge = project(fit.viewProjection, [Math.tan((30 * Math.PI) / 180) * 10, 0, 0])
    expect(Math.abs(edge[0])).toBeCloseTo(1, 1)
    expect(fitLight(directional({ shadow: null }), camera([0, 0, 0]), 1024)).toBeNull()
  })

  it('composes matrices in the documented order (a * b applies b first)', () => {
    const translate = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 0, 0, 1]
    const ortho = orthographicMatrix(-10, 10, -10, 10, 0, 20)
    expect(project(multiplyMatrices(ortho, translate), [5, 0, -10])[0]).toBeCloseTo(1, 9)
  })
})

describe('Cinema 2.0 lighting frame shadow settings', () => {
  it('resolves castShadow settings from the authored Threshold key light, and none for other lights', () => {
    const compiled = compileCinema2NativePreset(CINEMA2_THRESHOLD_PRESET_MANIFEST, { availableCapabilities: CAPABILITIES })
    if (!compiled.ok) throw new Error(compiled.diagnostics.map(diagnostic => diagnostic.message).join('; '))
    const plan = compiled.plan
    const parameters = new Cinema2ParameterState(plan.parameters)
    const resolver = new Cinema2FinalValueResolver(plan.targets, {
      resolveBaseValue: target => target.parameterId == null ? target.authoredBaseValue : parameters.getValue(target.parameterId),
    })
    const spatial = new Cinema2SpatialRuntime(plan.scene, plan.targets.targets, resolver)
    const frame = new Cinema2LightingEnvironmentRuntime(plan, resolver, spatial, 'high').getFrame()
    const key = frame.lights.find(light => light.id === CINEMA2_THRESHOLD_KEY_LIGHT_ID)!
    expect(key.type).toBe('directional')
    expect(key.shadow).toMatchObject({ extent: 70, depth: 200, focusAhead: 45, bias: 0.25, softness: 1 })
    // The direction the light travels: down the aisle toward the camera (+z), down and from the left (+x).
    expect(key.direction[2]).toBeGreaterThan(0.5)
    expect(key.direction[1]).toBeLessThan(0)
    expect(key.direction[0]).toBeGreaterThan(0)

    // A light without castShadow, and a point light with it, resolve no shadow (only directional and spot lights cast).
    const manifest = CINEMA2_THRESHOLD_PRESET_MANIFEST as unknown as { lighting: { lights: Record<string, unknown>[] } }
    const variant = { ...CINEMA2_THRESHOLD_PRESET_MANIFEST, lighting: { lights: [
      { ...manifest.lighting.lights[0], config: { castShadow: false } },
      { ...manifest.lighting.lights[0], id: 'point-caster', type: 'point', config: { castShadow: true } },
      { ...manifest.lighting.lights[0], id: 'clamped', config: { castShadow: true, shadowExtent: 9999, shadowBias: -3, shadowSoftness: 99 } },
    ] } } as unknown as typeof CINEMA2_THRESHOLD_PRESET_MANIFEST
    const variantCompiled = compileCinema2NativePreset(variant, { availableCapabilities: CAPABILITIES })
    if (!variantCompiled.ok) throw new Error(variantCompiled.diagnostics.map(diagnostic => diagnostic.message).join('; '))
    const variantPlan = variantCompiled.plan
    const variantParameters = new Cinema2ParameterState(variantPlan.parameters)
    const variantResolver = new Cinema2FinalValueResolver(variantPlan.targets, {
      resolveBaseValue: target => target.parameterId == null ? target.authoredBaseValue : variantParameters.getValue(target.parameterId),
    })
    const lights = new Cinema2LightingEnvironmentRuntime(variantPlan, variantResolver, new Cinema2SpatialRuntime(variantPlan.scene, variantPlan.targets.targets, variantResolver), 'high').getFrame().lights
    expect(lights.map(light => light.shadow ?? null)).toEqual([null, null, expect.objectContaining({ extent: 400, bias: 0, softness: 4 })])
  })

  it('packs the shadow-casting light index for effects, skipping ambient lights', () => {
    const lights = [
      { ...directional({ id: 'amb' as never, type: 'ambient', shadow: null }) },
      directional({ id: 'a' as never, shadow: null }),
      directional({ id: 'key' as never }),
    ] as Readonly<Cinema2ResolvedLightFrame>[]
    expect(packCinema2VolumetricLights(lights, 'key').shadowIndex).toBe(1)
    expect(packCinema2VolumetricLights(lights, 'missing').shadowIndex).toBe(-1)
    expect(packCinema2VolumetricLights(lights).shadowIndex).toBe(-1)
  })
})

describe('Cinema 2.0 shadow service', () => {
  it('has no map at low quality and sizes the map by tier otherwise', () => {
    expect(CINEMA2_SHADOW_RESOLUTIONS).toEqual({ low: 0, medium: 1024, high: 2048 })
    const { provider } = caster()
    for (const [quality, resolution] of [['low', 0], ['medium', 1024], ['high', 2048]] as const) {
      const gl = createGl()
      const service = new Cinema2ShadowService(gl, quality)
      service.update({ frame: FRAME, camera: camera([0, 2, -100]), lighting: lighting([directional()]), providers: [provider] })
      expect(service.getFrame() != null).toBe(resolution > 0)
      expect(service.getSnapshot()).toMatchObject({ resolution, estimatedGpuBytes: resolution * resolution * 4 })
      service.dispose()
    }
  })

  it('is inactive without a shadow-casting light, a caster or a camera, and frees its map when they go away', () => {
    const gl = createGl()
    const service = new Cinema2ShadowService(gl, 'high')
    const { provider } = caster()
    const input = { frame: FRAME, camera: camera([0, 2, -100]), lighting: lighting([directional()]), providers: [provider] }
    service.update(input)
    expect(service.getFrame()).not.toBeNull()
    service.update({ ...input, lighting: lighting([directional({ shadow: null })]) })
    expect(service.getFrame()).toBeNull()
    expect(service.getSnapshot().estimatedGpuBytes).toBe(0)
    expect(gl.deleteTexture).toHaveBeenCalledTimes(1)
    service.update(input)
    service.update({ ...input, providers: [{ ...provider, renderShadow: undefined } as never] })
    expect(service.getFrame()).toBeNull()
    service.update({ ...input, camera: undefined })
    expect(service.getFrame()).toBeNull()
    service.update({ ...input, lighting: lighting([directional({ intensity: 0 })]) })
    expect(service.getFrame()).toBeNull()
    service.dispose()
  })

  it('renders casters into the map, hands them the light matrix, and restores the pipeline state', () => {
    const gl = createGl()
    const service = new Cinema2ShadowService(gl, 'high')
    const { provider, renderShadow } = caster()
    service.update({ frame: FRAME, camera: camera([0, 2, -100]), lighting: lighting([directional()]), providers: [provider] })
    expect(renderShadow).toHaveBeenCalledTimes(1)
    const context = renderShadow.mock.calls[0]![0] as { lightViewProjection: number[]; resolution: number; lightDirection: number[] }
    expect(context.lightViewProjection).toHaveLength(16)
    expect(context.resolution).toBe(2048)
    expect(context.lightDirection[0]).toBeGreaterThan(0)
    const frame = service.getFrame()!
    expect(frame).toMatchObject({ lightId: 'key', resolution: 2048, bias: 0.15, softness: 1, depthRange: 160 })
    expect(frame.viewProjection).toBeInstanceOf(Float32Array)
    // The map framebuffer was bound for drawing, then the previous binding restored.
    const binds = vi.mocked(gl.bindFramebuffer).mock.calls
    expect(binds.length).toBeGreaterThanOrEqual(3)
    expect(gl.colorMask).toHaveBeenCalledWith(false, false, false, false)
    service.dispose()
  })

  it('reuses the map while the light matrix is unchanged and refreshes it when the matrix or a dynamic caster demands', () => {
    const gl = createGl()
    const service = new Cinema2ShadowService(gl, 'high')
    const staticCaster = caster()
    const input = { frame: FRAME, camera: camera([0, 2, -100]), lighting: lighting([directional()]), providers: [staticCaster.provider] }
    service.update(input)
    service.update(input)
    service.update({ ...input, camera: camera([0.00001, 2, -100]) })
    expect(staticCaster.renderShadow).toHaveBeenCalledTimes(1)
    expect(service.getSnapshot()).toMatchObject({ renderCount: 1, reuseCount: 2 })
    service.update({ ...input, camera: camera([0, 2, -140]) })
    expect(staticCaster.renderShadow).toHaveBeenCalledTimes(2)
    const dynamicCaster = caster({ dynamicShadowCaster: true })
    const dynamicInput = { ...input, providers: [dynamicCaster.provider] }
    service.update(dynamicInput)
    service.update(dynamicInput)
    service.update(dynamicInput)
    expect(dynamicCaster.renderShadow).toHaveBeenCalledTimes(3)
    service.dispose()
  })

  it('isolates a failing caster and keeps the others', () => {
    const gl = createGl()
    const service = new Cinema2ShadowService(gl, 'high')
    const broken = caster()
    broken.renderShadow.mockImplementation(() => { throw new Error('bad draw') })
    const healthy = caster()
    service.update({ frame: FRAME, camera: camera([0, 2, -100]), lighting: lighting([directional()]), providers: [broken.provider, healthy.provider] })
    expect(healthy.renderShadow).toHaveBeenCalledTimes(1)
    expect(service.getSnapshot().lastDiagnostic).toMatch(/bad draw/)
    expect(service.getFrame()).not.toBeNull()
    service.dispose()
  })

  it('changes tiers by releasing the old map, forgets GL objects on context loss and rebuilds after restore', () => {
    const gl = createGl()
    const service = new Cinema2ShadowService(gl, 'high')
    const { provider, renderShadow } = caster()
    const input = { frame: FRAME, camera: camera([0, 2, -100]), lighting: lighting([directional()]), providers: [provider] }
    service.update(input)
    service.setQuality('medium')
    expect(gl.deleteTexture).toHaveBeenCalledTimes(1)
    service.update(input)
    expect(service.getSnapshot().resolution).toBe(1024)
    expect(renderShadow).toHaveBeenCalledTimes(2)

    service.handleContextLost()
    expect(service.getFrame()).toBeNull()
    service.update(input) // ignored while the context is gone
    expect(service.getFrame()).toBeNull()
    expect(gl.deleteTexture).toHaveBeenCalledTimes(1) // nothing deleted on an invalid context
    service.handleContextRestored()
    service.update(input)
    expect(service.getFrame()).not.toBeNull()
    expect(renderShadow).toHaveBeenCalledTimes(3)

    service.dispose()
    expect(service.getFrame()).toBeNull()
    expect(service.getSnapshot()).toMatchObject({ disposed: true, estimatedGpuBytes: 0 })
    expect(gl.deleteTexture).toHaveBeenCalledTimes(2)
  })
})
