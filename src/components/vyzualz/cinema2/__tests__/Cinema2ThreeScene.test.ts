import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import {
  CINEMA2_REFERENCE_TORUS_KNOT_ASSET_ID,
  CINEMA2_THREE_MODEL_REFERENCE_PRESET_ID,
  CINEMA2_THREE_SCENE_MODULE_TYPE_ID,
  Cinema2ModuleRegistry,
  Cinema2ThreeAssetRegistry,
  cinema2NativeModuleRegistry,
  cinema2NativePresetRegistry,
  cinema2StableId,
  cinema2ThreeAssetRegistry,
  cinema2ThreeSceneModuleDefinition,
  createCinema2ThreeSceneModuleDefinition,
  type Cinema2ModuleId,
  type Cinema2ModuleManifest,
} from '..'
import type { Cinema2ModuleCreateContext } from '../modules/Cinema2ModuleContracts'
import { Cinema2ModuleResourceScope } from '../modules/Cinema2ModuleResources'
import { Cinema2GlStateGuard } from '../modules/three/Cinema2GlStateGuard'
import { Cinema2ThreeAssetCache, measureObject } from '../modules/three/Cinema2ThreeAssetCache'
import { Cinema2ThreeLightRig, applyCinema2CameraFrame } from '../modules/three/Cinema2ThreeCameraLightMapping'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import type { Cinema2CameraFrame } from '../spatial/Cinema2CameraRuntime'
import type { Cinema2LightingEnvironmentFrame, Cinema2ResolvedLightFrame } from '../spatial/Cinema2LightingEnvironmentRuntime'

const fakeLibrary = { THREE } as unknown as Cinema2ThreeLibrary

function moduleManifest(config: Record<string, unknown> | undefined): Readonly<Cinema2ModuleManifest> {
  return {
    id: cinema2StableId<Cinema2ModuleId>('three-test-module'),
    typeId: CINEMA2_THREE_SCENE_MODULE_TYPE_ID,
    version: 1,
    config,
  } as unknown as Readonly<Cinema2ModuleManifest>
}

function makeRegistry() {
  const registry = new Cinema2ThreeAssetRegistry()
  registry.register({ id: 'test-model', url: '/cinema2/models/test.glb', compression: 'meshopt', license: 'test' })
  return registry
}

function meshWithTexture(): { scene: THREE.Object3D; geometry: THREE.BufferGeometry; texture: THREE.Texture } {
  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const texture = new THREE.DataTexture(new Uint8Array(4 * 4 * 4), 4, 4)
  const material = new THREE.MeshStandardMaterial({ map: texture })
  const scene = new THREE.Group()
  scene.add(new THREE.Mesh(geometry, material))
  return { scene, geometry, texture }
}

describe('Cinema 2.0 Three asset registry', () => {
  it('only accepts app-origin paths, requires a license, and rejects duplicates', () => {
    const registry = new Cinema2ThreeAssetRegistry()
    expect(() => registry.register({ id: 'a', url: 'https://example.com/a.glb', compression: 'none', license: 'x' })).toThrow(/app-origin path/)
    expect(() => registry.register({ id: 'a', url: '//example.com/a.glb', compression: 'none', license: 'x' })).toThrow(/app-origin path/)
    expect(() => registry.register({ id: 'a', url: 'models/a.glb', compression: 'none', license: 'x' })).toThrow(/app-origin path/)
    expect(() => registry.register({ id: 'a', url: '/a.glb', compression: 'none', license: ' ' })).toThrow(/license/)
    registry.register({ id: 'a', url: '/a.glb', compression: 'none', license: 'x', variants: { low: '/a-low.glb' } })
    expect(() => registry.register({ id: 'a', url: '/b.glb', compression: 'none', license: 'x' })).toThrow(/already registered/)
    expect(registry.resolveUrl('a', 'low')).toBe('/a-low.glb')
    expect(registry.resolveUrl('a', 'high')).toBe('/a.glb')
    expect(registry.resolveUrl('missing', 'high')).toBeNull()
  })

  it('ships the reference asset with a license record', () => {
    expect(cinema2ThreeAssetRegistry.get(CINEMA2_REFERENCE_TORUS_KNOT_ASSET_ID)).toMatchObject({ compression: 'meshopt', license: 'generated-in-house' })
  })
})

describe('Cinema 2.0 Three scene module config', () => {
  it('is registered and fails compile-time validation for missing, malformed and unknown instances', () => {
    expect(cinema2NativeModuleRegistry.get(CINEMA2_THREE_SCENE_MODULE_TYPE_ID, 1)).not.toBeNull()
    const registry = makeRegistry()
    const definition = createCinema2ThreeSceneModuleDefinition({ registry })
    expect(definition.validate!(moduleManifest(undefined))).toMatchObject([{ code: 'CINEMA2_THREE_SCENE_INSTANCES_REQUIRED' }])
    expect(definition.validate!(moduleManifest({ instances: [] }))).toMatchObject([{ code: 'CINEMA2_THREE_SCENE_INSTANCES_REQUIRED' }])
    expect(definition.validate!(moduleManifest({ instances: [5] }))).toMatchObject([{ code: 'CINEMA2_THREE_SCENE_INSTANCE_INVALID' }])
    expect(definition.validate!(moduleManifest({ instances: [{ asset: 'nope' }] }))).toMatchObject([{ code: 'CINEMA2_THREE_SCENE_ASSET_UNKNOWN', path: '$.config.instances[0].asset' }])
    expect(definition.validate!(moduleManifest({ instances: [{ asset: 'test-model', node: '' }] }))).toMatchObject([{ path: '$.config.instances[0].node' }])
    expect(definition.validate!(moduleManifest({ instances: [{ asset: 'test-model', node: 'n1' }, { asset: 'test-model' }] }))).toEqual([])
  })

  it('compiles the Three Model Reference preset and keeps it out of the visible preset list', () => {
    const compiled = cinema2NativePresetRegistry.compile(CINEMA2_THREE_MODEL_REFERENCE_PRESET_ID)
    expect(compiled.ok).toBe(true)
    expect(cinema2NativePresetRegistry.get(CINEMA2_THREE_MODEL_REFERENCE_PRESET_ID)?.metadata.tags).toContain('internal')
    const registry = new Cinema2ModuleRegistry()
    expect(registry.register(cinema2ThreeSceneModuleDefinition).ok).toBe(true)
  })
})

describe('Cinema 2.0 Three asset cache', () => {
  it('shares one load between holders, frees GPU resources on the last release, and keeps decoded data for a cheap re-entry', async () => {
    const registry = makeRegistry()
    const { scene, geometry, texture } = meshWithTexture()
    const loadModel = vi.fn(async () => scene)
    const cache = new Cinema2ThreeAssetCache(registry, { loadModel })
    const geometryDispose = vi.spyOn(geometry, 'dispose')
    const textureDispose = vi.spyOn(texture, 'dispose')

    const [a, b] = await Promise.all([cache.acquire(fakeLibrary, 'test-model', 'high'), cache.acquire(fakeLibrary, 'test-model', 'high')])
    expect(a).toBe(b)
    expect(loadModel).toHaveBeenCalledTimes(1)
    expect(a.triangleCount).toBe(12)
    expect(a.gpuBytes).toBeGreaterThan(0)
    expect(cache.getSnapshot()).toMatchObject({ entryCount: 1, heldCount: 2 })

    cache.release(a)
    expect(geometryDispose).not.toHaveBeenCalled()
    cache.release(b)
    expect(geometryDispose).toHaveBeenCalled()
    expect(textureDispose).toHaveBeenCalled()
    expect(cache.getSnapshot()).toMatchObject({ heldCount: 0, idleCount: 1 })

    const again = await cache.acquire(fakeLibrary, 'test-model', 'high')
    expect(again).toBe(a)
    expect(loadModel).toHaveBeenCalledTimes(1)
    expect(cache.getSnapshot()).toMatchObject({ heldCount: 1, idleCount: 0 })
  })

  it('reports unknown ids and load failures with codes, and does not cache a failure', async () => {
    const registry = makeRegistry()
    const loadModel = vi.fn()
      .mockRejectedValueOnce(new Error('HTTP 404'))
      .mockResolvedValueOnce(meshWithTexture().scene)
    const cache = new Cinema2ThreeAssetCache(registry, { loadModel })
    await expect(cache.acquire(fakeLibrary, 'nope', 'high')).rejects.toMatchObject({ code: 'CINEMA2_THREE_ASSET_UNKNOWN' })
    await expect(cache.acquire(fakeLibrary, 'test-model', 'high')).rejects.toMatchObject({ code: 'CINEMA2_THREE_ASSET_LOAD_FAILED', message: expect.stringContaining('HTTP 404') })
    expect(cache.getSnapshot()).toMatchObject({ entryCount: 0, heldCount: 0 })
    await expect(cache.acquire(fakeLibrary, 'test-model', 'high')).resolves.toMatchObject({ id: 'test-model' })
  })

  it('bounds the idle list', async () => {
    const registry = new Cinema2ThreeAssetRegistry()
    for (const id of ['a', 'b', 'c']) registry.register({ id, url: `/${id}.glb`, compression: 'none', license: 'x' })
    const cache = new Cinema2ThreeAssetCache(registry, { loadModel: async () => meshWithTexture().scene, idleLimit: 2 })
    for (const id of ['a', 'b', 'c']) cache.release(await cache.acquire(fakeLibrary, id, 'high'))
    expect(cache.getSnapshot()).toMatchObject({ entryCount: 2, idleCount: 2 })
  })

  it('counts shared geometry and textures once when measuring several instances', () => {
    const { scene } = meshWithTexture()
    const first = scene.clone(true)
    const second = scene.clone(true)
    const single = measureObject(first)
    expect(measureObject([first, second]).bytes).toBe(single.bytes)
  })
})

describe('Cinema 2.0 Three camera and light mapping', () => {
  it('copies the engine camera without letting Three recompute matrices', () => {
    const camera = new THREE.PerspectiveCamera()
    const projection = new THREE.Matrix4().makePerspective(-0.5, 0.5, 0.3, -0.3, 0.1, 50)
    const view = new THREE.Matrix4().makeTranslation(1, -2, -5)
    applyCinema2CameraFrame(camera, {
      projectionMatrix: projection.toArray(), viewMatrix: view.toArray(), near: 0.1, far: 50,
    } as unknown as Cinema2CameraFrame)
    expect(camera.matrixAutoUpdate).toBe(false)
    expect(camera.matrixWorldAutoUpdate).toBe(false)
    expect(camera.projectionMatrix.toArray()).toEqual(projection.toArray())
    expect(camera.matrixWorldInverse.toArray()).toEqual(view.toArray())
    const world = camera.matrixWorld.clone().multiply(view)
    world.toArray().forEach((value, index) => expect(value).toBeCloseTo(new THREE.Matrix4().identity().toArray()[index]!, 6))
    expect(camera.near).toBe(0.1)
    expect(camera.far).toBe(50)
  })

  function light(partial: Partial<Cinema2ResolvedLightFrame> & Pick<Cinema2ResolvedLightFrame, 'type'>): Cinema2ResolvedLightFrame {
    return {
      id: `${partial.type}-1`, color: [1, 1, 1, 1], intensity: 1, position: [0, 5, 0], targetPosition: [0, 0, 0], direction: [0, -1, 0], spot: null, range: 20,
      ...partial,
    } as unknown as Cinema2ResolvedLightFrame
  }
  const frame = (lights: Cinema2ResolvedLightFrame[]) => ({ quality: 'high', lights, omittedLightCount: 0, environment: {} }) as unknown as Cinema2LightingEnvironmentFrame

  it('maps the calibrated intensities and keeps a fixed pool so shaders do not recompile', () => {
    const scene = new THREE.Scene()
    const rig = new Cinema2ThreeLightRig(THREE, scene)
    rig.update(frame([
      light({ type: 'ambient', intensity: 0.5, color: [1, 1, 1, 1] }),
      light({ type: 'spot', intensity: 2, range: 20, spot: { outerAngleDegrees: 20, innerAngleDegrees: 10 } }),
      light({ type: 'point', intensity: 1, range: 10, position: [1, 2, 3] }),
      light({ type: 'directional', intensity: 1, direction: [0, -1, 0] }),
    ]))
    const lights = scene.children.filter(child => (child as THREE.Light).isLight) as THREE.Light[]
    expect(lights).toHaveLength(4)
    const ambient = lights.find(l => (l as THREE.AmbientLight).isAmbientLight) as THREE.AmbientLight
    const spot = lights.find(l => (l as THREE.SpotLight).isSpotLight) as THREE.SpotLight
    const point = lights.find(l => (l as THREE.PointLight).isPointLight) as THREE.PointLight
    const directional = lights.find(l => (l as THREE.DirectionalLight).isDirectionalLight) as THREE.DirectionalLight
    expect(ambient.intensity).toBeCloseTo(0.5 * Math.PI)
    expect(spot.intensity).toBeCloseTo(2 * Math.PI * 100)
    expect(spot.angle).toBeCloseTo((20 * Math.PI) / 180)
    expect(spot.penumbra).toBeCloseTo(0.5)
    expect(spot.distance).toBe(20)
    expect(point.intensity).toBeCloseTo(Math.PI * 25)
    expect(point.position.toArray()).toEqual([1, 2, 3])
    expect(directional.intensity).toBeCloseTo(Math.PI)
    expect(directional.position.y).toBeCloseTo(10)

    // Fewer lights next frame (e.g. a quality drop): spares stay in the scene at intensity 0, nothing is added or removed.
    const childCount = scene.children.length
    rig.update(frame([light({ type: 'ambient', intensity: 1 })]))
    expect(scene.children).toHaveLength(childCount)
    expect(spot.intensity).toBe(0)
    expect(point.intensity).toBe(0)
    expect(rig.lightCount).toBe(4)
    // The same list again does not grow the pool.
    rig.update(frame([light({ type: 'ambient' }), light({ type: 'spot', spot: { outerAngleDegrees: 20, innerAngleDegrees: 10 } })]))
    expect(scene.children).toHaveLength(childCount)
  })

  it('caps the pool at eight lights', () => {
    const scene = new THREE.Scene()
    const rig = new Cinema2ThreeLightRig(THREE, scene)
    rig.update(frame(Array.from({ length: 12 }, () => light({ type: 'point' }))))
    expect(rig.lightCount).toBe(8)
  })
})

describe('Cinema 2.0 GL state guard', () => {
  it('restores the state the render graph relies on and unbinds everything else', () => {
    const state: Record<number, unknown> = {}
    const constants = new Proxy({} as Record<string, number>, { get: (target, key: string) => (target[key] ??= Object.keys(target).length + 1) })
    const calls: string[] = []
    const gl = new Proxy({} as Record<string, unknown>, {
      get(_t, key: string) {
        if (key in constants || /^[A-Z_0-9]+$/.test(key)) return constants[key]
        if (key === 'getParameter') return (name: number) => state[name]
        if (key === 'isEnabled') return (name: number) => Boolean(state[name])
        return (...args: unknown[]) => { calls.push(`${key}:${args.map(String).join(',')}`) }
      },
    }) as unknown as WebGL2RenderingContext
    const c = constants
    Object.assign(state, {
      [c.DRAW_FRAMEBUFFER_BINDING!]: 'fbo', [c.READ_FRAMEBUFFER_BINDING!]: 'rfbo', [c.VIEWPORT!]: new Int32Array([0, 0, 640, 360]),
      [c.SCISSOR_BOX!]: new Int32Array([0, 0, 1, 1]), [c.DEPTH_FUNC!]: 515, [c.DEPTH_WRITEMASK!]: true, [c.COLOR_WRITEMASK!]: [true, true, true, false],
      [c.COLOR_CLEAR_VALUE!]: new Float32Array([0.25, 0.5, 0.75, 1]), [c.VERTEX_ARRAY_BINDING!]: 'vao', [c.CURRENT_PROGRAM!]: 'prog', [c.ARRAY_BUFFER_BINDING!]: 'buf',
      [c.DEPTH_TEST!]: true, [c.BLEND!]: false,
    })
    const guard = new Cinema2GlStateGuard(gl).capture()
    guard.restore()
    expect(calls).toContain('bindFramebuffer:' + [c.DRAW_FRAMEBUFFER, 'fbo'].join(','))
    expect(calls).toContain('bindFramebuffer:' + [c.READ_FRAMEBUFFER, 'rfbo'].join(','))
    expect(calls).toContain('viewport:0,0,640,360')
    expect(calls).toContain('clearColor:' + [0.25, 0.5, 0.75, 1].join(','))
    expect(calls).toContain('colorMask:true,true,true,false')
    expect(calls).toContain('enable:' + c.DEPTH_TEST)
    expect(calls).toContain('disable:' + c.BLEND)
    expect(calls).toContain('bindVertexArray:vao')
    expect(calls).toContain('useProgram:prog')
    expect(calls).toContain('bindBuffer:' + [c.ARRAY_BUFFER, 'buf'].join(','))
    // All 16 texture units are unbound for 2D and cube maps.
    expect(calls.filter(call => call.startsWith('bindTexture:') && call.endsWith(',null'))).toHaveLength(32)
  })
})

describe('Cinema 2.0 module resource reporting', () => {
  it('sums reported GPU bytes per module scope and clears them on dispose', () => {
    const scope = new Cinema2ModuleResourceScope({} as WebGL2RenderingContext, () => {})
    expect(scope.getSnapshot().estimatedGpuBytes).toBe(0)
    scope.reportGpuBytes(1024)
    expect(scope.getSnapshot().estimatedGpuBytes).toBe(1024)
    scope.reportGpuBytes(2048)
    expect(scope.getSnapshot().estimatedGpuBytes).toBe(2048)
    scope.reportGpuBytes(Number.NaN)
    expect(scope.getSnapshot().estimatedGpuBytes).toBe(0)
    scope.reportGpuBytes(4096)
    scope.disposeAll()
    expect(scope.getSnapshot().estimatedGpuBytes).toBe(0)
  })
})

describe('Cinema 2.0 Three scene module lifecycle', () => {
  function createContext(module: Readonly<Cinema2ModuleManifest>) {
    const resources = new Cinema2ModuleResourceScope({} as WebGL2RenderingContext, () => {})
    const context = {
      module, resources,
      parameters: { get: () => undefined, getAuthored: () => undefined, resolve: () => null },
    } as unknown as Cinema2ModuleCreateContext
    return { context, resources }
  }
  const exec = { lightingEnvironment: { quality: 'high' } } as never
  const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }

  it('renders nothing and surfaces a diagnostic when the 3D library cannot load', async () => {
    const definition = createCinema2ThreeSceneModuleDefinition({ registry: makeRegistry(), loadLibrary: async () => { throw new Error('offline') } })
    const { context } = createContext(moduleManifest({ instances: [{ asset: 'test-model' }] }))
    const instance = definition.create(context) as ReturnType<typeof definition.create> & { inspect(): { state: string } }
    expect(instance.getDiagnostics!()).toEqual([])
    expect(() => instance.render!.providers[0]!.execute(exec)).not.toThrow()
    await settle()
    expect(instance.inspect().state).toBe('failed')
    expect(instance.getDiagnostics!()).toMatchObject([{ code: 'CINEMA2_THREE_LIBRARY_LOAD_FAILED' }])
    expect(() => instance.render!.providers[0]!.execute(exec)).not.toThrow()
  })

  it('skips assets that fail to load and reports every one', async () => {
    const loadModel = vi.fn(async () => { throw new Error('HTTP 404') })
    const registry = makeRegistry()
    const definition = createCinema2ThreeSceneModuleDefinition({
      registry, assets: new Cinema2ThreeAssetCache(registry, { loadModel }), loadLibrary: async () => fakeLibrary,
    })
    const { context } = createContext(moduleManifest({ instances: [{ asset: 'test-model' }, { asset: 'not-registered' }] }))
    const instance = definition.create(context) as ReturnType<typeof definition.create> & { inspect(): { state: string; skippedInstanceCount: number } }
    instance.render!.providers[0]!.execute(exec)
    await settle()
    expect(instance.inspect()).toMatchObject({ state: 'failed', skippedInstanceCount: 2 })
    expect(instance.getDiagnostics!().map(d => d.code).sort()).toEqual(['CINEMA2_THREE_ASSET_LOAD_FAILED', 'CINEMA2_THREE_ASSET_UNKNOWN'])
  })

  it('releases assets that finish loading after the module was disposed', async () => {
    const registry = makeRegistry()
    let finish: (scene: THREE.Object3D) => void = () => {}
    const loadModel = vi.fn(() => new Promise<THREE.Object3D>(resolve => { finish = resolve }))
    const assets = new Cinema2ThreeAssetCache(registry, { loadModel })
    const definition = createCinema2ThreeSceneModuleDefinition({ registry, assets, loadLibrary: async () => fakeLibrary })
    const { context } = createContext(moduleManifest({ instances: [{ asset: 'test-model' }] }))
    const instance = definition.create(context)
    instance.render!.providers[0]!.execute(exec)
    await settle()
    instance.lifecycle.dispose()
    finish(meshWithTexture().scene)
    await settle()
    expect(assets.getSnapshot()).toMatchObject({ heldCount: 0 })
  })
})
