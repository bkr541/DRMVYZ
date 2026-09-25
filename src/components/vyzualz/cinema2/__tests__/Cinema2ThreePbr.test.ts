import * as THREE from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Cinema2ThreeAssetRegistry, cinema2StableId, createCinema2ThreeSceneModuleDefinition, type Cinema2ModuleId, type Cinema2ModuleManifest } from '..'
import { CINEMA2_ASSET_RECORDS } from '../assets/Cinema2AssetManifest.generated'
import type { Cinema2ModuleRenderExecutionContext } from '../modules/Cinema2ModuleContracts'
import { CINEMA2_THREE_SCENE_MODULE_TYPE_ID } from '../modules/Cinema2ThreeSceneModule'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import {
  CINEMA2_STUDIO_ENVIRONMENT_ASSET_ID,
  Cinema2ThreeEnvironmentRegistry,
  cinema2ThreeEnvironmentRegistry,
} from '../modules/three/Cinema2ThreeEnvironmentRegistry'
import {
  CINEMA2_THREE_DEFAULT_OVERRIDES,
  CINEMA2_THREE_PANEL_LIMITS,
  Cinema2ThreeSceneBridge,
  type Cinema2ThreeMaterialOverrides,
  type Cinema2ThreePanelSpec,
} from '../modules/three/Cinema2ThreeSceneBridge'
import { CINEMA2_THREE_MODEL_REFERENCE_PRESET_MANIFEST } from '../presets/Cinema2ThreeModelReferencePreset'

// The bridge talks to a real (shared) Three renderer; for these tests it gets a stand-in host so real Three scene objects can be inspected without a GPU.
const host = vi.hoisted(() => ({
  renderer: {
    resetState: vi.fn(), setRenderTarget: vi.fn(), render: vi.fn(), initTexture: vi.fn(),
    setRenderTargetFramebuffer: vi.fn(), compileAsync: vi.fn(() => Promise.resolve()),
  },
  getEnvironment: vi.fn(),
  loadEnvironment: vi.fn(),
}))
vi.mock('../modules/three/Cinema2ThreeRendererHost', () => ({ getCinema2ThreeRenderer: () => host }))

const areaInit = vi.fn()
const areaTables = { init: areaInit }
const library = { THREE, loadAreaLightTables: () => Promise.resolve(areaTables) } as unknown as Cinema2ThreeLibrary

function glGuardStub(): WebGL2RenderingContext {
  const constants = new Proxy({} as Record<string, number>, { get: (target, key: string) => (target[key] ??= Object.keys(target).length + 1) })
  return new Proxy({} as Record<string, unknown>, {
    get(_t, key: string) {
      if (/^[A-Z_0-9]+$/.test(key)) return constants[key]
      if (key === 'getParameter') return () => new Int32Array(4)
      if (key === 'isEnabled') return () => false
      return () => undefined
    },
  }) as unknown as WebGL2RenderingContext
}

function loadedAsset() {
  const scene = new THREE.Group()
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.4 })))
  return { id: 'test', scene, triangleCount: 12, gpuBytes: 100 }
}

const PANELS: Cinema2ThreePanelSpec[] = [0, 1, 2, 3, 4].map(index => ({
  position: [index, 4, 6], target: [0, 1, 0], width: 4, height: 3, color: [1, 0.5, 0.25], intensity: 2 + index,
}))

function execution(quality: 'low' | 'medium' | 'high', exposure = 1): Cinema2ModuleRenderExecutionContext {
  const projection = new THREE.Matrix4().makePerspective(-0.5, 0.5, 0.3, -0.3, 0.1, 50)
  return {
    frame: {} as never, target: {} as WebGLFramebuffer, width: 64, height: 36, depthAvailable: true, spatialNodes: [],
    camera: { projectionMatrix: projection.toArray(), viewMatrix: new THREE.Matrix4().toArray(), near: 0.1, far: 50 } as never,
    lightingEnvironment: { quality, lights: [], omittedLightCount: 0, environment: { exposure } } as never,
  }
}

const overrides = (partial: Partial<Cinema2ThreeMaterialOverrides> = {}): Readonly<Cinema2ThreeMaterialOverrides> => ({ ...CINEMA2_THREE_DEFAULT_OVERRIDES, ...partial })

async function readyBridge(options: NonNullable<ConstructorParameters<typeof Cinema2ThreeSceneBridge>[3]>, quality: 'low' | 'medium' | 'high', partial: Partial<Cinema2ThreeMaterialOverrides> = {}) {
  const bridge = new Cinema2ThreeSceneBridge(glGuardStub(), library, [{ asset: loadedAsset() as never, node: null }], options)
  const exec = execution(quality)
  for (let index = 0; index < 8 && !bridge.ready; index += 1) {
    bridge.draw(exec, overrides(partial))
    await Promise.resolve()
    await Promise.resolve()
  }
  return { bridge, scene: (bridge as unknown as { scene: THREE.Scene }).scene }
}

beforeEach(() => {
  areaInit.mockClear()
  host.renderer.render.mockClear()
  host.getEnvironment.mockReset().mockReturnValue(new THREE.Texture())
  host.loadEnvironment.mockReset().mockResolvedValue(new THREE.Texture())
})

describe('Cinema 2.0 shipped environment registry', () => {
  it('only accepts app-origin paths, requires a license and resolves quality variants', () => {
    const registry = new Cinema2ThreeEnvironmentRegistry()
    expect(() => registry.register({ id: 'e', url: 'https://example.com/e.hdr', license: 'CC0' })).toThrow(/app-origin/)
    expect(() => registry.register({ id: 'e', url: '/cinema2/environments/e.hdr', license: ' ' })).toThrow(/license/)
    registry.register({ id: 'e', url: '/cinema2/environments/e-1024.hdr', variants: { low: '/cinema2/environments/e-512.hdr' }, license: 'CC0' })
    expect(() => registry.register({ id: 'e', url: '/cinema2/environments/e.hdr', license: 'CC0' })).toThrow(/already/)
    expect(registry.resolveUrl('e', 'high')).toBe('/cinema2/environments/e-1024.hdr')
    expect(registry.resolveUrl('e', 'low')).toBe('/cinema2/environments/e-512.hdr')
    expect(registry.resolveUrl('nope', 'high')).toBeNull()
  })

  it('ships the studio environment, filled from the generated manifest', () => {
    expect(cinema2ThreeEnvironmentRegistry.has(CINEMA2_STUDIO_ENVIRONMENT_ASSET_ID)).toBe(true)
    expect(cinema2ThreeEnvironmentRegistry.resolveUrl(CINEMA2_STUDIO_ENVIRONMENT_ASSET_ID, 'low')).toBe('/cinema2/environments/studio-512.hdr')
    expect(CINEMA2_ASSET_RECORDS.filter(record => record.kind === 'environment').map(record => record.id)).toEqual(cinema2ThreeEnvironmentRegistry.list().map(record => record.id))
  })
})

describe('Cinema 2.0 three-scene PBR config validation', () => {
  const registry = new Cinema2ThreeAssetRegistry()
  registry.register({ id: 'test-model', url: '/cinema2/models/test.glb', compression: 'none', license: 'test' })
  const definition = createCinema2ThreeSceneModuleDefinition({ registry })
  const manifest = (config: Record<string, unknown>) => ({ id: cinema2StableId<Cinema2ModuleId>('pbr'), typeId: CINEMA2_THREE_SCENE_MODULE_TYPE_ID, version: 1, config: { instances: [{ asset: 'test-model' }], ...config } }) as unknown as Readonly<Cinema2ModuleManifest>
  const codes = (config: Record<string, unknown>) => definition.validate!(manifest(config)).map(item => item.code)

  it('accepts a shipped environment and well-formed panels', () => {
    expect(codes({ environment: CINEMA2_STUDIO_ENVIRONMENT_ASSET_ID, panels: [{ position: [0, 1, 2], target: [0, 0, 0], size: [2, 1], color: [1, 1, 1], intensity: 3 }] })).toEqual([])
  })

  it('rejects unknown environments and malformed panels', () => {
    expect(codes({ environment: 'nope' })).toEqual(['CINEMA2_THREE_SCENE_ENVIRONMENT_UNKNOWN'])
    expect(codes({ environment: 7 })).toEqual(['CINEMA2_THREE_SCENE_ENVIRONMENT_UNKNOWN'])
    expect(codes({ panels: 'x' })).toEqual(['CINEMA2_THREE_SCENE_PANELS_INVALID'])
    const good = { position: [0, 1, 2], target: [0, 0, 0], size: [2, 1], color: [1, 1, 1], intensity: 3 }
    for (const bad of [{ ...good, size: [0, 1] }, { ...good, color: [2, 0, 0] }, { ...good, intensity: -1 }, { ...good, position: [0, 1] }, { ...good, target: undefined }]) {
      expect(codes({ panels: [bad] })).toEqual(['CINEMA2_THREE_SCENE_PANELS_INVALID'])
    }
  })

  it('the reference preset opts in to the shipped environment and two panels, all within a tier budget', () => {
    const module = CINEMA2_THREE_MODEL_REFERENCE_PRESET_MANIFEST.modules![0]!
    expect(module.config).toMatchObject({ environment: CINEMA2_STUDIO_ENVIRONMENT_ASSET_ID })
    expect((module.config as { panels: unknown[] }).panels).toHaveLength(2)
    expect(CINEMA2_THREE_PANEL_LIMITS).toEqual({ low: 0, medium: 2, high: 4 })
  })
})

describe('Cinema 2.0 Three bridge PBR', () => {
  it('keeps a fixed pool of panel lights, shows 0 / 2 / 4 by tier, scales them by panelIntensity and initialises the area-light tables once', async () => {
    const counts: Record<string, number> = {}
    for (const quality of ['low', 'medium', 'high'] as const) {
      const { scene } = await readyBridge({ panels: PANELS, areaLightTables: areaTables }, quality, { panelIntensity: 2 })
      const lights = scene.children.filter((child): child is THREE.RectAreaLight => (child as THREE.RectAreaLight).isRectAreaLight === true)
      expect(lights).toHaveLength(5)
      counts[quality] = lights.filter(light => light.visible).length
      if (quality === 'high') {
        expect(lights.map(light => light.intensity)).toEqual(PANELS.map(panel => panel.intensity * 2))
        expect(lights[0]!.width).toBe(4)
        expect(lights[0]!.position.toArray()).toEqual([0, 4, 6])
      }
    }
    expect(counts).toEqual({ low: 0, medium: 2, high: 4 })
    expect(areaInit).toHaveBeenCalledTimes(1)
  })

  it('creates no panel lights (and never touches the area-light tables) without config.panels', async () => {
    const { scene } = await readyBridge({}, 'high')
    expect(scene.children.some(child => (child as THREE.RectAreaLight).isRectAreaLight)).toBe(false)
    expect(areaInit).not.toHaveBeenCalled()
  })

  it('upgrades to physical materials only when a clearcoat is requested, holds it above zero on the tiers that draw it, and drops it on low', async () => {
    const plain = await readyBridge({}, 'high')
    const plainMaterial = (plain.bridge as unknown as { placed: { materials: { material: THREE.Material }[] }[] }).placed[0]!.materials[0]!.material
    expect((plainMaterial as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial).not.toBe(true)

    const high = await readyBridge({}, 'high', { clearcoat: 0, clearcoatRoughness: 0.3 })
    const highMaterial = (high.bridge as unknown as { placed: { materials: { material: THREE.MeshPhysicalMaterial }[] }[] }).placed[0]!.materials[0]!.material
    expect(highMaterial.isMeshPhysicalMaterial).toBe(true)
    expect(highMaterial.clearcoat).toBeCloseTo(0.001) // never exactly 0: turning it up must not recompile the shader
    expect(highMaterial.clearcoatRoughness).toBe(0.3)
    expect(highMaterial.roughness).toBe(0.5) // the asset's own values survive the upgrade
    expect(highMaterial.metalness).toBe(0.4)
    const mesh = high.scene.getObjectByProperty('isMesh', true) as THREE.Mesh
    expect(mesh.material).toBe(highMaterial)

    high.bridge.draw(execution('high'), overrides({ clearcoat: 0.8, clearcoatRoughness: 0.3 }))
    expect(highMaterial.clearcoat).toBe(0.8)
    const low = await readyBridge({}, 'low', { clearcoat: 0.8 })
    const lowMaterial = (low.bridge as unknown as { placed: { materials: { material: THREE.MeshPhysicalMaterial }[] }[] }).placed[0]!.materials[0]!.material
    expect(lowMaterial.clearcoat).toBe(0)
  })

  it('rotates the environment in degrees and scales its intensity by the Cinema 2.0 environment exposure', async () => {
    const { bridge, scene } = await readyBridge({}, 'high', { environmentIntensity: 1.5, environmentRotation: 90 })
    bridge.draw(execution('high', 0.5), overrides({ environmentIntensity: 1.5, environmentRotation: 90 }))
    expect(scene.environmentRotation.y).toBeCloseTo(Math.PI / 2)
    expect(scene.environmentIntensity).toBeCloseTo(0.75)
    bridge.draw(execution('high', 2), overrides({ environmentIntensity: 1.5, environmentRotation: -180 }))
    expect(scene.environmentRotation.y).toBeCloseTo(-Math.PI)
    expect(scene.environmentIntensity).toBeCloseTo(3)
  })

  it('draws nothing until the shipped environment is loaded, then uses it', async () => {
    const shipped = new THREE.Texture()
    let resolve!: (texture: THREE.Texture) => void
    host.loadEnvironment.mockReturnValue(new Promise<THREE.Texture>(done => { resolve = done }))
    const bridge = new Cinema2ThreeSceneBridge(glGuardStub(), library, [{ asset: loadedAsset() as never, node: null }], { environmentUrl: quality => `/cinema2/environments/${quality}.hdr` })
    for (let index = 0; index < 5; index += 1) bridge.draw(execution('high'), overrides())
    expect(bridge.ready).toBe(false)
    expect(host.loadEnvironment).toHaveBeenCalledTimes(1)
    expect(host.loadEnvironment).toHaveBeenCalledWith('/cinema2/environments/high.hdr')
    resolve(shipped)
    await Promise.resolve()
    await Promise.resolve()
    for (let index = 0; index < 6 && !bridge.ready; index += 1) { bridge.draw(execution('high'), overrides()); await Promise.resolve(); await Promise.resolve() }
    expect(bridge.ready).toBe(true)
    expect((bridge as unknown as { scene: THREE.Scene }).scene.environment).toBe(shipped)
    expect(host.getEnvironment).not.toHaveBeenCalled()
    expect(bridge.getDiagnostics()).toEqual([])
  })

  it('falls back to the built-in studio room with a diagnostic when the shipped environment cannot load', async () => {
    host.loadEnvironment.mockRejectedValue(new Error('HTTP 404'))
    const fallback = new THREE.Texture()
    host.getEnvironment.mockReturnValue(fallback)
    const { bridge, scene } = await readyBridge({ environmentUrl: () => '/cinema2/environments/missing.hdr' }, 'high')
    expect(bridge.ready).toBe(true)
    expect(scene.environment).toBe(fallback)
    expect(bridge.getDiagnostics().map(entry => entry.code)).toEqual(['CINEMA2_THREE_ENVIRONMENT_LOAD_FAILED'])
    expect(bridge.getDiagnostics()[0]!.message).toMatch(/HTTP 404/)
  })

  it('refuses panel lights without the area-light tables', () => {
    expect(() => new Cinema2ThreeSceneBridge(glGuardStub(), library, [{ asset: loadedAsset() as never, node: null }], { panels: PANELS })).toThrow(/area-light tables/)
  })

  it('removes its panel lights and frees its materials on dispose', async () => {
    const { bridge, scene } = await readyBridge({ panels: PANELS, areaLightTables: areaTables }, 'high', { clearcoat: 0.5 })
    bridge.dispose()
    expect(scene.children.some(child => (child as THREE.RectAreaLight).isRectAreaLight)).toBe(false)
  })
})
