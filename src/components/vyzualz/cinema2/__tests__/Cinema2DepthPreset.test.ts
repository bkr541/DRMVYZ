import { describe, expect, it, vi } from 'vitest'
import { createCinemaMockWebGL } from '../../cinema/__tests__/CinemaWebGLTestUtils'
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
import {
  CINEMA2_DEPTH_LIGHT_PROGRAMS,
  createCinema2DepthLightFrame,
  resolveCinema2DepthProgramEmission,
  updateCinema2DepthLightFrame,
  type Cinema2DepthLightControls,
} from '../modules/depth/Cinema2DepthLightPrograms'
import { Cinema2DepthRenderer } from '../modules/depth/Cinema2DepthRenderer'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import {
  CINEMA2_DEPTH_AUTO_PERFORMANCE_ID,
  CINEMA2_DEPTH_BPM_SYNC_ID,
  CINEMA2_DEPTH_LAP_DISTANCE,
  CINEMA2_DEPTH_LAP_SECONDS,
  CINEMA2_DEPTH_MOTION_SAFETY_ID,
  CINEMA2_DEPTH_PRESET_ID,
  CINEMA2_DEPTH_PRESET_MANIFEST,
} from '../presets/Cinema2DepthPreset'

describe('Cinema 2.0 Depth Step-3 preset', () => {
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

    const repeated = buildCinema2DepthProofLayout({ lapCopies: 3 })
    expect(repeated).toMatchObject({ portalCount: 10, lapCopies: 3, repeatDistance: CINEMA2_DEPTH_LAP_DISTANCE })
    expect(repeated.instances).toHaveLength(469)
    expect(repeated.instances.filter(instance => instance.kind === 'center')).toHaveLength(1)
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
    expect(CINEMA2_DEPTH_PRESET_MANIFEST.parameters).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Light Program', type: 'enum', defaultValue: 'depthChase' }),
      expect.objectContaining({ label: 'Direction', type: 'enum', defaultValue: 'forward' }),
      expect.objectContaining({ label: 'Rate', defaultValue: 1.1 }),
      expect.objectContaining({ label: 'Active Span', defaultValue: 3 }),
      expect.objectContaining({ label: 'Random Seed', defaultValue: 7 }),
      expect.objectContaining({ label: 'Center Object', defaultValue: true }),
    ]))
    expect(Object.keys(CINEMA2_DEPTH_PRESET_MANIFEST.modules![0]!.parameterBindings ?? {})).toEqual(expect.arrayContaining([
      'program', 'direction', 'rate', 'activeSpan', 'seed', 'centerEnabled', 'centerScale', 'centerIntensity',
    ]))
  })

  it('authors a depth-aware HDR proof stack after the scene pass', () => {
    expect(CINEMA2_DEPTH_PRESET_MANIFEST.revision).toBe(3)
    expect(CINEMA2_DEPTH_PRESET_MANIFEST.effects?.map(effect => effect.typeId)).toEqual([
      'volumetric-atmosphere', 'hdr-bloom', 'cinematic-finish',
    ])
    expect(CINEMA2_DEPTH_PRESET_MANIFEST.render?.passes).toHaveLength(4)
    expect(CINEMA2_DEPTH_PRESET_MANIFEST.render?.targets).toHaveLength(3)
    expect(CINEMA2_DEPTH_PRESET_MANIFEST.render?.targets?.every(target => target.descriptor.colorFormat === 'rgba16f')).toBe(true)
    const atmospherePass = CINEMA2_DEPTH_PRESET_MANIFEST.render?.passes[1]
    expect(atmospherePass?.inputs?.map(input => input.attachment)).toEqual(['color', 'depth'])
  })

  it('authors a seamless fly rig, three motion-safety modes, and bounded optional choreography', () => {
    const camera = CINEMA2_DEPTH_PRESET_MANIFEST.cameras![0]!
    expect(camera.rig).toMatchObject({
      kind: 'fly', durationSeconds: CINEMA2_DEPTH_LAP_SECONDS, loop: true,
      repeatOffset: [0, 0, -CINEMA2_DEPTH_LAP_DISTANCE],
    })
    expect(camera.motion).toMatchObject({ interpolation: 'spline', constantSpeed: true, rollDegrees: -7 })
    expect(camera.controls).toEqual({
      motionSafety: { $ref: CINEMA2_DEPTH_MOTION_SAFETY_ID },
      tempoSync: { $ref: CINEMA2_DEPTH_BPM_SYNC_ID },
    })
    expect(CINEMA2_DEPTH_PRESET_MANIFEST.parameters).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: CINEMA2_DEPTH_AUTO_PERFORMANCE_ID, defaultValue: true }),
      expect.objectContaining({ id: CINEMA2_DEPTH_MOTION_SAFETY_ID, type: 'enum', defaultValue: 'full' }),
    ]))
    expect(CINEMA2_DEPTH_PRESET_MANIFEST.choreography?.rules.map(rule => rule.source.signal)).toEqual([
      'beat', 'downbeat', 'phrase', 'continuous', 'drop',
    ])
    expect(CINEMA2_DEPTH_PRESET_MANIFEST.choreography?.rules.every(rule => rule.enabledParameter?.$ref === CINEMA2_DEPTH_AUTO_PERFORMANCE_ID)).toBe(true)
    expect(new Set(CINEMA2_DEPTH_PRESET_MANIFEST.choreography?.rules.flatMap(rule => rule.actions.map(action => action.target.kind)))).toEqual(
      new Set(['module', 'effect', 'camera']),
    )
    expect(CINEMA2_DEPTH_PRESET_MANIFEST.modules![0]!.parameters).toMatchObject({
      beatAccent: 0, downbeatAccent: 0, phraseAccent: 0, buildAmount: 0, dropAccent: 0,
    })
  })

  it('evaluates all five light programs deterministically with bounded per-side output', () => {
    const layout = buildCinema2DepthProofLayout()
    for (const program of CINEMA2_DEPTH_LIGHT_PROGRAMS) {
      const controls: Cinema2DepthLightControls = {
        program,
        direction: 'forward',
        rate: 1.1,
        activeSpan: 3,
        seed: 41,
        centerEnabled: true,
        centerIntensity: 0.38,
      }
      const first = createCinema2DepthLightFrame(layout.instances.length, layout.portalCount)
      const second = createCinema2DepthLightFrame(layout.instances.length, layout.portalCount)
      updateCinema2DepthLightFrame(first, layout, 2.75, controls)
      updateCinema2DepthLightFrame(second, layout, 2.75, controls)
      expect([...second.emissions]).toEqual([...first.emissions])
      expect([...second.spills]).toEqual([...first.spills])
      expect([...first.emissions].every(value => value >= 0 && value <= 2)).toBe(true)
      expect([...first.spills].every(value => value >= 0 && value <= 2)).toBe(true)
    }

    const orbit: Cinema2DepthLightControls = {
      program: 'sideOrbit', direction: 'forward', rate: 1, activeSpan: 10, seed: 0,
      centerEnabled: false, centerIntensity: 0,
    }
    const sideLevels = [0, 1, 2, 3].map(side => resolveCinema2DepthProgramEmission(2, side, 10, 0.6, orbit))
    expect(new Set(sideLevels.map(value => value.toFixed(5))).size).toBeGreaterThan(1)
  })

  it('reverses the depth chase, loops exactly, and preserves authored zero rate', () => {
    const base: Cinema2DepthLightControls = {
      program: 'depthChase', direction: 'forward', rate: 2, activeSpan: 1, seed: 0,
      centerEnabled: true, centerIntensity: 0.4,
    }
    const forwardNear = resolveCinema2DepthProgramEmission(2, 0, 10, 1, base)
    const reverseFar = resolveCinema2DepthProgramEmission(8, 0, 10, 1, { ...base, direction: 'reverse' })
    expect(forwardNear).toBeCloseTo(reverseFar, 6)
    expect(resolveCinema2DepthProgramEmission(2, 0, 10, 0, base)).toBeCloseTo(
      resolveCinema2DepthProgramEmission(2, 0, 10, 5, base),
      6,
    )
    const frozen = { ...base, rate: 0 }
    expect(resolveCinema2DepthProgramEmission(4, 3, 10, 0, frozen)).toBe(
      resolveCinema2DepthProgramEmission(4, 3, 10, 999, frozen),
    )
  })

  it('keeps music accents bounded and optional', () => {
    const base: Cinema2DepthLightControls = {
      program: 'sideOrbit', direction: 'forward', rate: 1.1, activeSpan: 3, seed: 7,
      centerEnabled: true, centerIntensity: 0.38,
    }
    const idle = resolveCinema2DepthProgramEmission(4, 2, 10, 1.25, base)
    const absent = resolveCinema2DepthProgramEmission(4, 2, 10, 1.25, { ...base, beatAccent: 0, downbeatAccent: 0, phraseAccent: 0, buildAmount: 0, dropAccent: 0 })
    const drop = resolveCinema2DepthProgramEmission(4, 2, 10, 1.25, { ...base, dropAccent: 1 })
    expect(absent).toBe(idle)
    expect(drop).toBeGreaterThanOrEqual(idle)
    expect(drop).toBeLessThanOrEqual(1)
  })

  it('applies center-object visibility and intensity without changing instance count', () => {
    const layout = buildCinema2DepthProofLayout()
    const frame = createCinema2DepthLightFrame(layout.instances.length, layout.portalCount)
    const centerIndex = layout.instances.findIndex(instance => instance.kind === 'center')
    const controls: Cinema2DepthLightControls = {
      program: 'fullPulse', direction: 'forward', rate: 1, activeSpan: 3, seed: 7,
      centerEnabled: false, centerIntensity: 1.4,
    }
    updateCinema2DepthLightFrame(frame, layout, 1, controls)
    expect(frame.emissions[centerIndex]).toBe(0)
    updateCinema2DepthLightFrame(frame, layout, 1, { ...controls, centerEnabled: true })
    expect(frame.emissions[centerIndex]).toBeCloseTo(1.4)
    expect(frame.emissions).toHaveLength(157)
  })

  it('uploads the animated light state and keeps the complete tunnel to one instanced draw', () => {
    const gl = createCinemaMockWebGL()
    const layout = buildCinema2DepthProofLayout()
    const frame = createCinema2DepthLightFrame(layout.instances.length, layout.portalCount)
    updateCinema2DepthLightFrame(frame, layout, 1.5, {
      program: 'gatePulse', direction: 'forward', rate: 1.1, activeSpan: 3, seed: 7,
      centerEnabled: true, centerIntensity: 0.38,
    })
    const renderer = new Cinema2DepthRenderer(gl, packCinema2DepthInstances(layout.instances))
    renderer.draw({
      viewProjection: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      cameraPosition: [0, 0, 8],
      lightColor: [0.86, 0.9, 1],
      bodyColor: [0.012, 0.014, 0.021],
      intensity: 1,
      spill: 0.72,
      centerScale: 1,
      emissions: frame.emissions,
      spills: frame.spills,
      repeatDistance: layout.repeatDistance,
      repeatOriginZ: 8.4,
      centerDistance: 8.4 - layout.centerDepth,
    })
    expect(vi.mocked(gl.bufferSubData)).toHaveBeenCalledOnce()
    expect(vi.mocked(gl.drawElementsInstanced)).toHaveBeenCalledOnce()
    renderer.dispose()
    expect(gl.__calls.createdBuffers).toBe(gl.__calls.deletedBuffers)
    expect(gl.__calls.createdVertexArrays).toBe(gl.__calls.deletedVertexArrays)
    expect(gl.__calls.createdPrograms).toBe(gl.__calls.deletedPrograms)
  })

  it('passes final camera and bound controls to one resource-owned tunnel renderer', () => {
    const moduleManifest = CINEMA2_DEPTH_PRESET_MANIFEST.modules![0]!
    const values = new Map<string, Cinema2JsonValue>(Object.entries(moduleManifest.parameters ?? {}))
    values.set('intensity', 1.4)
    values.set('spill', 0.9)
    values.set('program', 'sideOrbit')
    values.set('direction', 'reverse')
    values.set('rate', 1.5)
    values.set('activeSpan', 4)
    values.set('seed', 27)
    values.set('centerEnabled', true)
    values.set('centerScale', 1.6)
    values.set('centerIntensity', 0.6)
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
      frame: { elapsedTimeSec: 2.25 },
    } as never)
    expect(draw).toHaveBeenCalledOnce()
    expect(draw.mock.calls[0]?.[0]).toMatchObject({ intensity: 1.4, spill: 0.9, centerScale: 1.6, cameraPosition: [1, 2, 8] })
    expect(draw.mock.calls[0]?.[0].emissions).toHaveLength(469)
    expect(draw.mock.calls[0]?.[0].spills).toHaveLength(469)
    expect(instance.inspect()).toMatchObject({ portalCount: 10, lapCopies: 3, instanceCount: 469, estimatedGpuBytes: 4096, lightProgram: 'sideOrbit', direction: 'reverse' })
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
