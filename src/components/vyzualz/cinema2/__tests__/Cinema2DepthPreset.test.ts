import { describe, expect, it, vi } from 'vitest'
import type { Cinema2JsonValue } from '../contracts/Cinema2NativePresetManifest'
import {
  CINEMA2_DEPTH_NATIVE_MODULE_TYPE_ID,
  createCinema2DepthNativeModuleDefinition,
  type Cinema2DepthModuleInspection,
} from '../modules/Cinema2DepthNativeModule'
import type { Cinema2ModuleCreateContext } from '../modules/Cinema2ModuleContracts'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { cinema2NativeEffectRegistry } from '../effects/Cinema2EffectRegistry'
import {
  CINEMA2_DEPTH_INSTANCE_FLOATS,
  buildCinema2DepthProofLayout,
  packCinema2DepthInstances,
} from '../modules/depth/Cinema2DepthLayout'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import {
  CINEMA2_DEPTH_PRESET_ID,
  CINEMA2_DEPTH_PRESET_MANIFEST,
} from '../presets/Cinema2DepthPreset'

describe('Cinema 2.0 Depth Step-1 preset', () => {
  it('builds the fixed procedural proof tunnel deterministically', () => {
    const first = buildCinema2DepthProofLayout()
    const second = buildCinema2DepthProofLayout()
    expect(second).toEqual(first)
    expect(first).toMatchObject({ portalCount: 10, aperture: 7.4, spacing: 4.2, repeatDistance: 42 })
    expect(first.instances).toHaveLength(157)
    expect(first.instances.filter(instance => instance.kind === 'strip')).toHaveLength(40)
    expect(first.instances.filter(instance => instance.kind === 'rail')).toHaveLength(36)
    expect(first.instances.filter(instance => instance.kind === 'center')).toHaveLength(1)
    expect(first.instances.filter(instance => instance.kind === 'strip' && instance.portalIndex === 0).every(instance => instance.emission === 1)).toBe(true)
    expect(first.instances.every(instance => instance.size.every(value => value > 0))).toBe(true)

    const packed = packCinema2DepthInstances(first.instances)
    expect(packed).toHaveLength(first.instances.length * CINEMA2_DEPTH_INSTANCE_FLOATS)
    expect([...packed]).toEqual([...packCinema2DepthInstances(second.instances)])
  })

  it('registers an exact-name first-party keeper that passes authoring and compilation', () => {
    expect(CINEMA2_DEPTH_PRESET_MANIFEST.metadata.name).toBe('Depth')
    expect(CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'keeper', manifest: expect.objectContaining({ id: CINEMA2_DEPTH_PRESET_ID }) }),
    ]))
    expect(cinema2NativeModuleRegistry.get(CINEMA2_DEPTH_NATIVE_MODULE_TYPE_ID, 1)).not.toBeNull()
    expect(validateCinema2PresetAuthoringConventions({ role: 'keeper', manifest: CINEMA2_DEPTH_PRESET_MANIFEST })).toEqual({ ok: true, diagnostics: [] })
    const compilation = compileCinema2NativePreset(CINEMA2_DEPTH_PRESET_MANIFEST, {
      availableCapabilities: ['render.webgl2', 'render.depth', 'render.hdr', 'scene.3d', 'camera.world', 'lighting'],
    })
    expect(compilation.ok, compilation.diagnostics.map(diagnostic => `${diagnostic.code}: ${diagnostic.message}`).join('\n')).toBe(true)
    const effectValidation = cinema2NativeEffectRegistry.validateEffects(CINEMA2_DEPTH_PRESET_MANIFEST.effects ?? [])
    expect(effectValidation.ok, effectValidation.diagnostics.map(diagnostic => `${diagnostic.code}: ${diagnostic.message}`).join('\n')).toBe(true)
  })

  it('authors a depth-aware HDR proof stack after the scene pass', () => {
    expect(CINEMA2_DEPTH_PRESET_MANIFEST.revision).toBe(1)
    expect(CINEMA2_DEPTH_PRESET_MANIFEST.effects?.map(effect => effect.typeId)).toEqual([
      'volumetric-atmosphere', 'hdr-bloom', 'cinematic-finish',
    ])
    expect(CINEMA2_DEPTH_PRESET_MANIFEST.render?.passes).toHaveLength(4)
    expect(CINEMA2_DEPTH_PRESET_MANIFEST.render?.targets).toHaveLength(3)
    expect(CINEMA2_DEPTH_PRESET_MANIFEST.render?.targets?.every(target => target.descriptor.colorFormat === 'rgba16f')).toBe(true)
    const atmospherePass = CINEMA2_DEPTH_PRESET_MANIFEST.render?.passes[1]
    expect(atmospherePass?.inputs?.map(input => input.attachment)).toEqual(['color', 'depth'])
  })

  it('passes final camera and bound controls to one resource-owned tunnel renderer', () => {
    const moduleManifest = CINEMA2_DEPTH_PRESET_MANIFEST.modules![0]!
    const values = new Map<string, Cinema2JsonValue>(Object.entries(moduleManifest.parameters ?? {}))
    values.set('intensity', 1.4)
    values.set('spill', 0.9)
    const parameters = {
      get: (name: string) => values.get(name),
      getAuthored: (name: string) => values.get(name),
      resolve: () => null,
    }
    const draw = vi.fn()
    const dispose = vi.fn()
    const reportGpuBytes = vi.fn()
    let releaseLease: (() => void) | null = null
    const renderer = { draw, dispose, estimateGpuBytes: () => 4096 }
    const definition = createCinema2DepthNativeModuleDefinition({ createRenderer: () => renderer })
    const resources = {
      acquire: (_key: string, _kind: string, create: (gl: WebGL2RenderingContext) => typeof renderer, release: (value: typeof renderer) => void) => {
        const value = create({} as WebGL2RenderingContext)
        releaseLease = () => release(value)
        return value
      },
      reportGpuBytes,
      getSnapshot: () => ({ activeLeaseCount: 1, disposedLeaseCount: 0, estimatedGpuBytes: 4096 }),
    }
    const instance = definition.create({
      module: moduleManifest,
      parameters,
      targets: {},
      media: {},
      resources,
      randomness: {},
    } as unknown as Cinema2ModuleCreateContext) as ReturnType<typeof definition.create> & { inspect(): Cinema2DepthModuleInspection }

    instance.render!.providers[0]!.execute({
      depthAvailable: true,
      camera: { position: [1, 2, 8], viewProjectionMatrix: Array.from({ length: 16 }, (_, index) => index) },
    } as never)
    expect(draw).toHaveBeenCalledOnce()
    expect(draw.mock.calls[0]?.[0]).toMatchObject({ intensity: 1.4, spill: 0.9, cameraPosition: [1, 2, 8] })
    expect(instance.inspect()).toMatchObject({ portalCount: 10, instanceCount: 157, estimatedGpuBytes: 4096 })
    expect(reportGpuBytes).toHaveBeenCalledWith(4096)

    instance.lifecycle.dispose()
    expect(dispose).not.toHaveBeenCalled()
    releaseLease!()
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('rejects non-finite authored layout config', () => {
    const module = { ...CINEMA2_DEPTH_PRESET_MANIFEST.modules![0]!, config: { portalCount: Number.NaN } }
    expect(createCinema2DepthNativeModuleDefinition().validate?.(module)).toEqual([
      expect.objectContaining({ code: 'CINEMA2_DEPTH_CONFIG_INVALID', path: '$.config.portalCount' }),
    ])
  })
})
