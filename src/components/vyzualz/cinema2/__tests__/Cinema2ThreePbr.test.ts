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
import { createCinema2MainframeLightingDiagnosticFrame } from '../modules/mainframe/Cinema2MainframeLightingDiagnostic'

// The bridge talks to a real (shared) Three renderer; for these tests it gets a stand-in host so real Three scene objects can be inspected without a GPU.
const host = vi.hoisted(() => ({
  renderer: {
    resetState: vi.fn(), setRenderTarget: vi.fn(), render: vi.fn(), initTexture: vi.fn(),
    setRenderTargetFramebuffer: vi.fn(), compileAsync: vi.fn(() => Promise.resolve()),
    shadowMap: { enabled: false, type: 0 },
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

  it('accepts a list of part names and rejects anything else', () => {
    expect(codes({ parts: ['outline', 'crystal'] })).toEqual([])
    expect(codes({ parts: 'outline' })).toEqual(['CINEMA2_THREE_SCENE_PARTS_INVALID'])
    expect(codes({ parts: ['outline', 7] })).toEqual(['CINEMA2_THREE_SCENE_PARTS_INVALID'])
    expect(codes({ parts: [' '] })).toEqual(['CINEMA2_THREE_SCENE_PARTS_INVALID'])
  })

  it('accepts config.segments roles (feed, core, field) and rejects anything else', () => {
    expect(codes({ segments: { energy: 'feed', rim: 'core', segments: 'field' } })).toEqual([])
    expect(codes({ segments: ['energy'] })).toEqual(['CINEMA2_THREE_SCENE_SEGMENTS_INVALID'])
    expect(codes({ segments: { energy: 'glow' } })).toEqual(['CINEMA2_THREE_SCENE_SEGMENTS_INVALID'])
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
  it('binds each Mainframe lighting role and its shader uniforms to the intended mesh, even without audio', () => {
    const scene = new THREE.Group()
    const roles = { circuitHousings: 'circuitHousing', circuitCores: 'circuit', indicatorCores: 'indicator',
      radarHardware: 'radarHousing', radarCores: 'radar', chipHardware: 'chipHousing', chipCores: 'chip', logoCore: 'logo' } as const
    for (const part of Object.keys(roles)) {
      const geometry = new THREE.BoxGeometry(1, 1, 1)
      const count = geometry.getAttribute('position').count
      for (const name of ['_glow_phase', '_mainframe_route', '_mainframe_bank', '_mainframe_region', '_mainframe_system']) {
        geometry.setAttribute(name, new THREE.Float32BufferAttribute(new Float32Array(count), 1))
      }
      const material = new THREE.MeshStandardMaterial()
      material.name = part
      const mesh = new THREE.Mesh(geometry, material)
      mesh.name = part
      scene.add(mesh)
    }
    const bridge = new Cinema2ThreeSceneBridge(glGuardStub(), library, [
      { asset: { id: 'mainframe', scene, triangleCount: 60, gpuBytes: 100 } as never, node: null },
    ], { hdr: true, mainframe: roles })
    const ownedScene = (bridge as unknown as { scene: THREE.Scene }).scene
    for (const [part, role] of Object.entries(roles)) {
      const mesh = ownedScene.getObjectByName(part) as THREE.Mesh
      const material = mesh.material as THREE.MeshStandardMaterial
      expect(material.customProgramCacheKey()).toContain('-mainframe')
      const shader = {
        vertexShader: '#include <common>\n#include <begin_vertex>',
        fragmentShader: '#include <common>\n#include <emissivemap_fragment>',
        uniforms: {} as Record<string, { value: unknown }>,
      }
      material.onBeforeCompile(shader as never, undefined as never)
      expect(shader.vertexShader).toContain('#include <begin_vertex>')
      expect(shader.vertexShader).toContain('vCinema2MainframeMeta = vec4( _mainframe_route, _mainframe_bank, _mainframe_region, _mainframe_system )')
      expect(shader.fragmentShader).toContain('totalEmissiveRadiance = mix( totalEmissiveRadiance, cinema2MFFinal')
      expect(shader.fragmentShader).toContain('pow( clamp( cinema2MFSystemLight, 0.0, 1.0 ), 1.25 )')
      expect(shader.fragmentShader).toContain('float movingLight =')
      expect(shader.fragmentShader).toContain('float selection = 1.0;')
      expect(shader.fragmentShader).toContain('uCinema2MainframeCircuitResponse')
      expect(shader.fragmentShader).toContain('uCinema2MainframeHardware')
      // The shared State0.y level must be used in the visible emissive path,
      // not just uploaded to a dead uniform.
      expect(shader.fragmentShader).toContain('float cinema2MFEnergyLift = 0.42 + 0.93 * sqrt( clamp( uCinema2MainframeState0.y')
      expect(shader.fragmentShader).toContain('cinema2MFLight ) * cinema2MFEnergyLift')
      expect(shader.fragmentShader).toContain('pulse * selection * ( 0.75 + 0.5 * sqrt( clamp( uCinema2MainframeState0.y')
      expect(shader.fragmentShader).toContain('float radarWave = hwSweep')
      expect(shader.fragmentShader).toContain('float chipScan =')
      expect(shader.fragmentShader).toContain('cinema2MFLight *= cinema2MFRoute > 0.5 ? 0.17 : 0.015')
      expect(shader.fragmentShader).toContain('vCinema2MainframePhase')
      expect(shader.uniforms.uCinema2MainframeRole?.value).toBe(
        ['circuit', 'indicator', 'radar', 'chip', 'logo', 'circuitHousing', 'radarHousing', 'chipHousing'].indexOf(role),
      )
      expect(shader.uniforms.uCinema2MainframeStrength?.value).toBe(0)
      bridge.draw(execution('high'), overrides(), 0, null, null, null, {
        circuitColor: [0.24, 1, 0.12], indicatorColor: [0.4, 1, 0.22], logoColor: [0.3, 1, 0.18],
        strength: 1, frame: createCinema2MainframeLightingDiagnosticFrame('circuits'),
      })
      expect(shader.uniforms.uCinema2MainframeStrength?.value).toBe(1)
      expect((shader.uniforms.uCinema2MainframeSystems0?.value as THREE.Vector4).y).toBe(1)
      expect((shader.uniforms.uCinema2MainframeCircuitResponse?.value as THREE.Vector4).x).toBe(1)
      expect((shader.uniforms.uCinema2MainframeHardware?.value as THREE.Vector4).toArray()).toEqual([0, 0, 0, 0])
      expect((shader.uniforms.uCinema2MainframeSystems1?.value as THREE.Vector4).x).toBe(0)
      expect((shader.uniforms.uCinema2MainframeState0?.value as THREE.Vector4).y).toBe(1)
      const dim = { ...createCinema2MainframeLightingDiagnosticFrame('circuits'), level: 0.12 }
      bridge.draw(execution('high'), overrides(), 0, null, null, null, {
        circuitColor: [0.24, 1, 0.12], indicatorColor: [0.4, 1, 0.22], logoColor: [0.3, 1, 0.18],
        strength: 0.6, frame: dim,
      })
      expect((shader.uniforms.uCinema2MainframeState0?.value as THREE.Vector4).y).toBeCloseTo(0.12)
      expect(shader.uniforms.uCinema2MainframeStrength?.value).toBe(0.6)
    }
  })

  it('rejects incomplete Mainframe geometry rather than silently losing its emissive shader', () => {
    const scene = new THREE.Group()
    const material = new THREE.MeshStandardMaterial()
    material.name = 'circuitCores'
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material)
    mesh.name = 'circuitCores'
    scene.add(mesh)
    expect(() => new Cinema2ThreeSceneBridge(glGuardStub(), library, [
      { asset: { id: 'broken-mainframe', scene, triangleCount: 12, gpuBytes: 100 } as never, node: null },
    ], { mainframe: { circuitCores: 'circuit' } })).toThrow(/requires a per-vertex _mainframe_system/)
  })

  it('does not report Mainframe ready if asynchronous shader compilation fails', async () => {
    const scene = new THREE.Group()
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const count = geometry.getAttribute('position').count
    for (const name of ['_glow_phase', '_mainframe_route', '_mainframe_bank', '_mainframe_region', '_mainframe_system']) {
      geometry.setAttribute(name, new THREE.Float32BufferAttribute(new Float32Array(count), 1))
    }
    const material = new THREE.MeshStandardMaterial()
    material.name = 'circuitCores'
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = 'circuitCores'
    scene.add(mesh)
    host.renderer.compileAsync.mockRejectedValueOnce(new Error('invalid semantic shader'))
    const bridge = new Cinema2ThreeSceneBridge(glGuardStub(), library, [
      { asset: { id: 'mainframe-compile', scene, triangleCount: 12, gpuBytes: 100 } as never, node: null },
    ], { mainframe: { circuitCores: 'circuit' } })
    for (let index = 0; index < 5; index++) {
      bridge.draw(execution('high'), overrides())
      await Promise.resolve()
    }
    expect(bridge.ready).toBe(false)
    expect(bridge.getDiagnostics()).toEqual([expect.objectContaining({
      code: 'CINEMA2_THREE_MAINFRAME_SHADER_COMPILE_FAILED',
      message: expect.stringContaining('invalid semantic shader'),
    })])
  })

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

  it('gives each named part its own look: a part override beats the global value for that part only, and the other part keeps the global or asset value', async () => {
    const scene = new THREE.Group()
    const part = (name: string, material: THREE.MeshStandardMaterial) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material)
      mesh.name = name
      scene.add(mesh)
    }
    part('outline', new THREE.MeshStandardMaterial({ roughness: 0.15, metalness: 1, color: new THREE.Color(0.9, 0.6, 0.2) }))
    part('crystal', new THREE.MeshStandardMaterial({ roughness: 0.05, metalness: 1, color: new THREE.Color(1, 1, 1) }))
    const bridge = new Cinema2ThreeSceneBridge(glGuardStub(), library, [{ asset: { id: 'two-part', scene, triangleCount: 24, gpuBytes: 100 } as never, node: null }], {})
    const none = { color: null, emissive: null, emissiveIntensity: null, roughness: null, metalness: null, clearcoat: null, clearcoatRoughness: null, iridescence: null, iridescenceIOR: null, iridescenceThicknessMin: null, iridescenceThicknessMax: null, transmission: null, ior: null, thickness: null, dispersion: null, environmentIntensity: null }
    const materialOf = (name: string) => ((bridge as unknown as { scene: THREE.Scene }).scene.getObjectByName(name) as THREE.Mesh).material as THREE.MeshPhysicalMaterial

    // Only the crystal is overridden: rougher, tinted, with a clearcoat. The global roughness (0.6) applies to the outline; the crystal's own wins.
    bridge.draw(execution('high'), overrides({ roughness: 0.6, parts: { crystal: { ...none, roughness: 0.3, color: [0.5, 1, 1], clearcoat: 0.4 } } }))
    expect(materialOf('outline').roughness).toBe(0.6)
    expect(materialOf('crystal').roughness).toBe(0.3)
    expect(materialOf('crystal').clearcoat).toBeCloseTo(0.4)
    expect(materialOf('outline').metalness).toBe(1) // untouched: the asset's own value
    const gold = materialOf('outline').color
    expect(gold.r).toBeCloseTo(0.9, 5) // no tint anywhere on the outline: the asset's gold survives
    expect(materialOf('crystal').color.r).toBeLessThan(0.3) // the crystal's own tint multiplied its white

    // No part overrides again: both go back to the global value / the asset's own.
    bridge.draw(execution('high'), overrides({ parts: { outline: { ...none, roughness: 0.02 } } }))
    expect(materialOf('outline').roughness).toBe(0.02)
    expect(materialOf('crystal').roughness).toBe(0.05)
    expect(materialOf('crystal').color.r).toBeCloseTo(1, 5)
  })

  it('gives a part a thin-film iridescence on every tier, held above zero once requested so the control never recompiles a shader', async () => {
    const scene = new THREE.Group()
    for (const name of ['outline', 'crystal']) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.1, metalness: 1 }))
      mesh.name = name
      scene.add(mesh)
    }
    const bridge = new Cinema2ThreeSceneBridge(glGuardStub(), library, [{ asset: { id: 'two-part', scene, triangleCount: 24, gpuBytes: 100 } as never, node: null }], {})
    const none = { color: null, emissive: null, emissiveIntensity: null, roughness: null, metalness: null, clearcoat: null, clearcoatRoughness: null, iridescence: null, iridescenceIOR: null, iridescenceThicknessMin: null, iridescenceThicknessMax: null, transmission: null, ior: null, thickness: null, dispersion: null, environmentIntensity: null }
    const materialOf = (name: string) => ((bridge as unknown as { scene: THREE.Scene }).scene.getObjectByName(name) as THREE.Mesh).material as THREE.MeshPhysicalMaterial

    bridge.draw(execution('low'), overrides({ parts: { crystal: { ...none, iridescence: 0.8, iridescenceIOR: 1.4, iridescenceThicknessMin: 300, iridescenceThicknessMax: 200 } } }))
    expect(materialOf('crystal').isMeshPhysicalMaterial).toBe(true)
    expect(materialOf('crystal').iridescence).toBeCloseTo(0.8)
    expect(materialOf('crystal').iridescenceIOR).toBeCloseTo(1.4)
    expect(materialOf('crystal').iridescenceThicknessRange).toEqual([300, 300]) // the thickest is never thinner than the thinnest
    expect(materialOf('outline').iridescence).toBe(0) // only the named part

    bridge.draw(execution('low'), overrides({ parts: { crystal: { ...none, iridescence: 0 } } }))
    expect(materialOf('crystal').iridescence).toBeGreaterThan(0)
    expect(materialOf('crystal').iridescence).toBeLessThan(0.01)
  })

  it('matches a part by its material name when many meshes share one material (roots-3, leaf-12 ... -> roots, leaves)', () => {
    const scene = new THREE.Group()
    const shared = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 1 })
    shared.name = 'roots'
    for (const name of ['roots-0', 'roots-1']) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shared)
      mesh.name = name
      scene.add(mesh)
    }
    const bridge = new Cinema2ThreeSceneBridge(glGuardStub(), library, [{ asset: { id: 'many', scene, triangleCount: 24, gpuBytes: 100 } as never, node: null }], {})
    const none = { color: null, emissive: null, emissiveIntensity: null, roughness: null, metalness: null, clearcoat: null, clearcoatRoughness: null, iridescence: null, iridescenceIOR: null, iridescenceThicknessMin: null, iridescenceThicknessMax: null, transmission: null, ior: null, thickness: null, dispersion: null, environmentIntensity: null }
    bridge.draw(execution('high'), overrides({ parts: { roots: { ...none, roughness: 0.2 } } }))
    for (const name of ['roots-0', 'roots-1']) {
      expect((((bridge as unknown as { scene: THREE.Scene }).scene.getObjectByName(name) as THREE.Mesh).material as THREE.MeshStandardMaterial).roughness).toBe(0.2)
    }
  })

  it('makes a part clear glass on medium and high, and drops the refraction on low', () => {
    const scene = new THREE.Group()
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.1, metalness: 0 }))
    mesh.name = 'crystal'
    scene.add(mesh)
    const bridge = new Cinema2ThreeSceneBridge(glGuardStub(), library, [{ asset: { id: 'glass', scene, triangleCount: 12, gpuBytes: 100 } as never, node: null }], {})
    const none = { color: null, emissive: null, emissiveIntensity: null, roughness: null, metalness: null, clearcoat: null, clearcoatRoughness: null, iridescence: null, iridescenceIOR: null, iridescenceThicknessMin: null, iridescenceThicknessMax: null, transmission: null, ior: null, thickness: null, dispersion: null, environmentIntensity: null }
    const glass = overrides({ parts: { crystal: { ...none, transmission: 1, ior: 2.3, thickness: 0.2, dispersion: 4 } } })
    const material = () => ((bridge as unknown as { scene: THREE.Scene }).scene.getObjectByName('crystal') as THREE.Mesh).material as THREE.MeshPhysicalMaterial
    bridge.draw(execution('high'), glass)
    expect(material().transmission).toBe(1)
    expect(material().ior).toBeCloseTo(2.3)
    expect(material().dispersion).toBe(4)
    bridge.draw(execution('low'), glass)
    expect(material().transmission).toBe(0)
  })

  it('installs the audio-glow shader hook on the parts listed in config.glow (and only those), and feeds it each frame', () => {
    const scene = new THREE.Group()
    for (const [name, material] of [['veins-0', 'veins'], ['bark-0', 'bark']] as const) {
      const standard = new THREE.MeshStandardMaterial()
      standard.name = material
      const geometry = new THREE.BoxGeometry(1, 1, 1)
      geometry.setAttribute('_glow_phase', new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count), 1))
      const mesh = new THREE.Mesh(geometry, standard)
      mesh.name = name
      scene.add(mesh)
    }
    const bridge = new Cinema2ThreeSceneBridge(glGuardStub(), library, [{ asset: { id: 'glow', scene, triangleCount: 24, gpuBytes: 100 } as never, node: null }], { glow: { veins: 1 } })
    const materialOf = (name: string) => ((bridge as unknown as { scene: THREE.Scene }).scene.getObjectByName(name) as THREE.Mesh).material as THREE.MeshStandardMaterial
    expect(materialOf('veins-0').customProgramCacheKey()).toBe('cinema2-glow-phase')
    const shader = { vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <emissivemap_fragment>', uniforms: {} as Record<string, { value: unknown }> }
    materialOf('veins-0').onBeforeCompile(shader as never, undefined as never)
    expect(shader.fragmentShader).toContain('vec3 cinema2GlowLight = uCinema2GlowColor')
    // Emitted as is (no config.hdr): the 8-bit roll-off only applies to an HDR preset that fell back to 8-bit targets.
    expect(shader.fragmentShader).toContain('totalEmissiveRadiance += mix( cinema2GlowLight, 1.0 - exp( - cinema2GlowLight ), uCinema2GlowRolloff )')
    expect((shader.uniforms.uCinema2GlowRolloff as { value: number }).value).toBe(0)
    expect(shader.vertexShader).toContain('vCinema2GlowPhase = _glow_phase')
    expect(materialOf('bark-0').customProgramCacheKey()).not.toContain('glow')
    bridge.draw(execution('high'), overrides({}), 0, { color: [1, 0.5, 0], strength: 2, frame: { breath: 0.4, fronts: [0.3, -10, -10, -10], gains: [0.8, 0, 0, 0], beats: 12.5 } })
    expect((shader.uniforms.uCinema2GlowStrength as { value: number }).value).toBe(2)
    expect((shader.uniforms.uCinema2GlowBreath as { value: number }).value).toBeCloseTo(0.4)
    expect((shader.uniforms.uCinema2GlowFront as { value: THREE.Vector4 }).value.x).toBeCloseTo(0.3)
    expect((shader.uniforms.uCinema2GlowBeats as { value: number }).value).toBeCloseTo(12.5)
  })

  it('lights config.segments parts segment by segment: replaces their emissive with the pattern, skips the audio glow, and feeds the pattern each frame', () => {
    const scene = new THREE.Group()
    for (const [name, material, withSegments] of [['energy-0', 'energy', true], ['shell-0', 'shell', true], ['rim-0', 'rim', false]] as const) {
      const standard = new THREE.MeshStandardMaterial()
      standard.name = material
      const geometry = new THREE.BoxGeometry(1, 1, 1)
      const count = geometry.getAttribute('position').count
      geometry.setAttribute('_glow_phase', new THREE.Float32BufferAttribute(new Float32Array(count), 1))
      if (withSegments) geometry.setAttribute('_segment', new THREE.Float32BufferAttribute(new Float32Array(count * 4), 4))
      const mesh = new THREE.Mesh(geometry, standard)
      mesh.name = name
      scene.add(mesh)
    }
    const bridge = new Cinema2ThreeSceneBridge(glGuardStub(), library, [{ asset: { id: 'segments', scene, triangleCount: 36, gpuBytes: 100 } as never, node: null }], { glow: { energy: 1 }, segments: { energy: 'feed', rim: 'core' } })
    const materialOf = (name: string) => ((bridge as unknown as { scene: THREE.Scene }).scene.getObjectByName(name) as THREE.Mesh).material as THREE.MeshStandardMaterial
    // The segment role wins over config.glow; a part without the attribute (rim) or without a role (shell) is left alone.
    expect(materialOf('energy-0').customProgramCacheKey()).toBe('cinema2-segments')
    expect(materialOf('shell-0').customProgramCacheKey()).not.toContain('segments')
    expect(materialOf('rim-0').customProgramCacheKey()).not.toContain('segments')
    const shader = { vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <emissivemap_fragment>', uniforms: {} as Record<string, { value: unknown }> }
    materialOf('energy-0').onBeforeCompile(shader as never, undefined as never)
    expect(shader.vertexShader).toContain('vCinema2Segment = _segment')
    expect(shader.vertexShader).toContain('vCinema2SegPhase = _glow_phase')
    // Rolled off toward white unless the preset renders HDR (config.hdr) on a GPU with float targets; the stub has none.
    expect(shader.fragmentShader).toContain('totalEmissiveRadiance = mix( 1.0 - exp( - cinema2SegLight ), cinema2SegLight, uCinema2SegHdr )')
    expect(shader.fragmentShader).toContain('smoothstep( 0.08, 0.45, cinema2SegBrightness )')
    expect(shader.fragmentShader).toContain('mix( uCinema2SegColor, cinema2SegWhite, cinema2SegHotCore )')
    expect(shader.fragmentShader).toContain('cinema2SegHotCore *= uCinema2SegRole < 0.5 ? 0.72 : ( uCinema2SegRole < 1.5 ? 0.12 : 0.4 )')
    expect(shader.fragmentShader).toContain('min( 1.0, 1.3 * vCinema2SegPhase )')
    expect((shader.uniforms.uCinema2SegHdr as { value: number }).value).toBe(0)
    expect(shader.fragmentShader).not.toContain('uCinema2GlowColor')
    expect((shader.uniforms.uCinema2SegRole as { value: number }).value).toBe(0)
    const frame = { pattern: 'ringChase' as const, beats: 9.5, level: 0.6, drop: 0.2, quiet: 0.1, chase: 0.25, splitSide: 1, flicker: 0.3, reactivity: 0.9, weights: [0, 1, 0, 0] as const, fronts: [0.4, -10, -10, -10], gains: [1, 0, 0, 0] }
    bridge.draw(execution('high'), overrides({}), 0, null, { color: [1, 0.5, 0], strength: 3, frame })
    expect((shader.uniforms.uCinema2SegStrength as { value: number }).value).toBe(3)
    expect((shader.uniforms.uCinema2Seg0 as { value: THREE.Vector4 }).value.toArray()).toEqual([9.5, 0.6, 0.2, 0.1])
    expect((shader.uniforms.uCinema2Seg1 as { value: THREE.Vector4 }).value.toArray()).toEqual([0.25, 1, 0.3, 0.9])
    expect((shader.uniforms.uCinema2SegWeights as { value: THREE.Vector4 }).value.y).toBe(1)
    expect((shader.uniforms.uCinema2SegFront as { value: THREE.Vector4 }).value.x).toBeCloseTo(0.4)
    bridge.draw(execution('high'), overrides({}))
    expect((shader.uniforms.uCinema2SegStrength as { value: number }).value).toBe(0)
  })

  it('glows each seeded tree on its own: parts with a _glow_seed attribute get a per-tree swell, pulse stagger and ember flicker', () => {
    const scene = new THREE.Group()
    const standard = new THREE.MeshStandardMaterial()
    standard.name = 'vines'
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const count = geometry.getAttribute('position').count
    geometry.setAttribute('_glow_phase', new THREE.Float32BufferAttribute(new Float32Array(count), 1))
    geometry.setAttribute('_glow_seed', new THREE.Float32BufferAttribute(new Float32Array(count).fill(0.3), 1))
    const mesh = new THREE.Mesh(geometry, standard)
    mesh.name = 'vines'
    scene.add(mesh)
    const bridge = new Cinema2ThreeSceneBridge(glGuardStub(), library, [{ asset: { id: 'seeded', scene, triangleCount: 12, gpuBytes: 100 } as never, node: null }], { glow: { vines: 1 } })
    const material = ((bridge as unknown as { scene: THREE.Scene }).scene.getObjectByName('vines') as THREE.Mesh).material as THREE.MeshStandardMaterial
    expect(material.customProgramCacheKey()).toBe('cinema2-glow-phase-seed')
    const shader = { vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <emissivemap_fragment>', uniforms: {} as Record<string, { value: unknown }> }
    material.onBeforeCompile(shader as never, undefined as never)
    expect(shader.vertexShader).toContain('vCinema2GlowSeed = _glow_seed')
    expect(shader.fragmentShader).toContain('cinema2TreeGain')
    expect(shader.fragmentShader).toContain('cinema2Stagger')
  })

  it('flags the parts listed in config.shadows to cast and receive, by mesh or material name', () => {
    const scene = new THREE.Group()
    for (const [name, material] of [['roots-0', 'roots'], ['crystal', 'crystal'], ['bark-0', 'bark']] as const) {
      const standard = new THREE.MeshStandardMaterial()
      standard.name = material
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), standard)
      mesh.name = name
      scene.add(mesh)
    }
    const bridge = new Cinema2ThreeSceneBridge(glGuardStub(), library, [{ asset: { id: 'shadowed', scene, triangleCount: 36, gpuBytes: 100 } as never, node: null }], { shadows: { cast: ['roots'], receive: ['crystal'] } })
    const mesh = (name: string) => (bridge as unknown as { scene: THREE.Scene }).scene.getObjectByName(name) as THREE.Mesh
    expect(mesh('roots-0').castShadow).toBe(true)
    expect(mesh('roots-0').receiveShadow).toBe(false)
    expect(mesh('crystal').receiveShadow).toBe(true)
    expect(mesh('crystal').castShadow).toBe(false)
    expect(mesh('bark-0').castShadow).toBe(false)
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
