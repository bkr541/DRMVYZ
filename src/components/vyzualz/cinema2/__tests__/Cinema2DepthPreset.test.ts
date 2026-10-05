import { describe, expect, it, vi } from 'vitest'
import { createCinemaMockWebGL } from '../../cinema/__tests__/CinemaWebGLTestUtils'
import type { Cinema2JsonValue } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import {
  CINEMA2_DEPTH_NATIVE_MODULE_TYPE_ID,
  createCinema2DepthNativeModuleDefinition,
  type Cinema2DepthModuleInspection,
} from '../modules/Cinema2DepthNativeModule'
import type { Cinema2ModuleCreateContext } from '../modules/Cinema2ModuleContracts'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { cinema2NativeEffectRegistry } from '../effects/Cinema2EffectRegistry'
import {
  CINEMA2_DEPTH_INSTANCE_FLOATS,
  CINEMA2_DEPTH_LAYOUT_CONFIG,
  CINEMA2_DEPTH_REPEAT_DISTANCE,
  CINEMA2_DEPTH_REPEAT_ORIGIN_Z,
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
import {
  CINEMA2_DEPTH_CENTER_MATTE_COLOR,
  CINEMA2_DEPTH_STRIP_HDR_MULTIPLIER,
  Cinema2DepthRenderer,
} from '../modules/depth/Cinema2DepthRenderer'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { Cinema2CameraRuntime } from '../spatial/Cinema2CameraRuntime'
import { Cinema2SpatialRuntime } from '../spatial/Cinema2SpatialRuntime'
import {
  CINEMA2_DEPTH_AUTO_PERFORMANCE_ID,
  CINEMA2_DEPTH_BPM_SYNC_ID,
  CINEMA2_DEPTH_LAP_DISTANCE,
  CINEMA2_DEPTH_LAP_SECONDS,
  CINEMA2_DEPTH_MOTION_SAFETY_ID,
  CINEMA2_DEPTH_PRESET_ID,
  CINEMA2_DEPTH_PRESET_MANIFEST,
} from '../presets/Cinema2DepthPreset'

describe('Cinema 2.0 Depth preset', () => {
  it('builds the fixed procedural proof tunnel deterministically', () => {
    const first = buildCinema2DepthProofLayout()
    const second = buildCinema2DepthProofLayout()
    expect(second).toEqual(first)
    expect(first).toMatchObject({
      portalCount: 8, lapCopies: 3, aperture: 8.2, spacing: 6, repeatDistance: 48,
      boxInstanceCount: 276, sphereInstanceCount: 97,
    })
    expect(first.instances).toHaveLength(373)
    expect(first.instances.filter(instance => instance.kind === 'strip')).toHaveLength(96)
    expect(first.instances.filter(instance => instance.kind === 'rail')).toHaveLength(84)
    expect(first.instances.filter(instance => instance.kind === 'node')).toHaveLength(96)
    expect(first.instances.filter(instance => instance.kind === 'center')).toHaveLength(1)
    expect(first.instances.filter(instance => instance.kind === 'strip' && instance.emission > 0)).toHaveLength(12)
    expect(first.instances.every(instance => instance.size.every(value => value > 0))).toBe(true)

    const packed = packCinema2DepthInstances(first.instances)
    expect(packed).toHaveLength(first.instances.length * CINEMA2_DEPTH_INSTANCE_FLOATS)
    expect([...packed]).toEqual([...packCinema2DepthInstances(second.instances)])

    const baseLap = buildCinema2DepthProofLayout({ lapCopies: 1 })
    expect(baseLap).toMatchObject({ boxInstanceCount: 92, sphereInstanceCount: 33 })
    expect(baseLap.instances).toHaveLength(125)
    expect(baseLap.instances.filter(instance => instance.kind === 'strip' && instance.emission > 0)).toHaveLength(4)
    expect(baseLap.instances.filter(instance => instance.kind === 'strip' && instance.portalIndex === 0).map(instance => instance.emission)).toEqual([1, 0, 0, 0])
    expect(CINEMA2_DEPTH_LAP_DISTANCE).toBe(CINEMA2_DEPTH_REPEAT_DISTANCE)
    expect(CINEMA2_DEPTH_REPEAT_DISTANCE).toBe(CINEMA2_DEPTH_LAYOUT_CONFIG.portalCount * CINEMA2_DEPTH_LAYOUT_CONFIG.spacing)
    expect(CINEMA2_DEPTH_PRESET_MANIFEST.modules![0]!.config).toBe(CINEMA2_DEPTH_LAYOUT_CONFIG)
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
      expect.objectContaining({ label: 'Light Program', type: 'enum', defaultValue: 'architecturalSparse' }),
      expect.objectContaining({ label: 'Direction', type: 'enum', defaultValue: 'forward' }),
      expect.objectContaining({ label: 'Rate', defaultValue: 1.1 }),
      expect.objectContaining({ label: 'Active Span', defaultValue: 4 }),
      expect.objectContaining({ label: 'Random Seed', defaultValue: 7 }),
      expect.objectContaining({ label: 'Center Object', defaultValue: true }),
      expect.objectContaining({ label: 'Center Tone', defaultValue: 0.7 }),
    ]))
    expect(Object.keys(CINEMA2_DEPTH_PRESET_MANIFEST.modules![0]!.parameterBindings ?? {})).toEqual(expect.arrayContaining([
      'program', 'direction', 'rate', 'activeSpan', 'seed', 'centerEnabled', 'centerScale', 'centerIntensity',
    ]))
  })

  it('authors a depth-aware HDR proof stack after the scene pass', () => {
    expect(CINEMA2_DEPTH_PRESET_MANIFEST.revision).toBe(7)
    expect(CINEMA2_DEPTH_PRESET_MANIFEST.effects?.map(effect => effect.typeId)).toEqual([
      'volumetric-atmosphere', 'hdr-bloom', 'cinematic-finish',
    ])
    expect(CINEMA2_DEPTH_PRESET_MANIFEST.render?.passes).toHaveLength(4)
    expect(CINEMA2_DEPTH_PRESET_MANIFEST.render?.targets).toHaveLength(3)
    expect(CINEMA2_DEPTH_PRESET_MANIFEST.render?.targets?.every(target => target.descriptor.colorFormat === 'rgba16f')).toBe(true)
    const atmospherePass = CINEMA2_DEPTH_PRESET_MANIFEST.render?.passes[1]
    expect(atmospherePass?.inputs?.map(input => input.attachment)).toEqual(['color', 'depth'])
  })

  it('authors a restrained high-contrast finishing stack', () => {
    expect(CINEMA2_DEPTH_STRIP_HDR_MULTIPLIER).toBeGreaterThan(1)
    expect(CINEMA2_DEPTH_STRIP_HDR_MULTIPLIER).toBeLessThanOrEqual(3)
    expect(CINEMA2_DEPTH_CENTER_MATTE_COLOR.every(component => component > 0.1 && component < 0.25)).toBe(true)
    expect(CINEMA2_DEPTH_PRESET_MANIFEST.parameters).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Light Spill', defaultValue: 0.28 }),
      expect.objectContaining({ label: 'Atmosphere', defaultValue: 0.004 }),
      expect.objectContaining({ label: 'Bloom', defaultValue: 0.28 }),
      expect.objectContaining({ label: 'Background', defaultValue: [0.0005, 0.0007, 0.001, 1] }),
      expect.objectContaining({ label: 'Structure Color', defaultValue: [0.018, 0.019, 0.024, 1] }),
    ]))
    expect(CINEMA2_DEPTH_PRESET_MANIFEST.modules![0]!.parameters).toMatchObject({ spill: 0.28 })

    const atmosphere = CINEMA2_DEPTH_PRESET_MANIFEST.effects?.find(effect => effect.typeId === 'volumetric-atmosphere')
    const bloom = CINEMA2_DEPTH_PRESET_MANIFEST.effects?.find(effect => effect.typeId === 'hdr-bloom')
    const finish = CINEMA2_DEPTH_PRESET_MANIFEST.effects?.find(effect => effect.typeId === 'cinematic-finish')
    expect(atmosphere?.parameters).toMatchObject({
      density: 0.004, beamIntensity: 0.065, ambientHaze: 0.004, noiseStrength: 0.08, maxDistance: 60,
    })
    expect(bloom?.parameters).toMatchObject({
      threshold: 2.1, knee: 0.35, intensity: 0.28, spread: 0.28, levels: 4, clampMax: 12,
    })
    expect(finish?.parameters).toMatchObject({ exposure: 0.92, contrast: 1.28, vignette: 0.68 })
    expect(CINEMA2_DEPTH_PRESET_MANIFEST.lighting?.lights.map(light => light.intensity)).toEqual([0.025, 0.14])
  })

  it('bounds high-energy atmosphere and bloom accents', () => {
    const actions = CINEMA2_DEPTH_PRESET_MANIFEST.choreography?.rules.flatMap(rule => rule.actions) ?? []
    const values = new Map(actions.map(action => [action.id, action.value]))
    expect(values.get('depth-beat-bloom-action')).toBe(0.025)
    expect(values.get('depth-downbeat-bloom-action')).toBe(0.05)
    expect(values.get('depth-phrase-atmosphere-action')).toBe(0.001)
    expect(values.get('depth-build-atmosphere-action')).toBe(0.0015)
    expect(values.get('depth-drop-bloom-action')).toBe(0.08)
  })

  it('authors a seamless fly rig, three motion-safety modes, and bounded optional choreography', () => {
    const camera = CINEMA2_DEPTH_PRESET_MANIFEST.cameras![0]!
    expect(camera.rig).toMatchObject({
      kind: 'fly', durationSeconds: CINEMA2_DEPTH_LAP_SECONDS, loop: true,
      repeatOffset: [0, 0, -CINEMA2_DEPTH_LAP_DISTANCE],
    })
    expect(camera.motion).toMatchObject({ interpolation: 'spline', constantSpeed: true })
    expect(camera.motion).not.toHaveProperty('rollDegrees')
    if (!camera.rig || (camera.rig.kind !== 'fly' && camera.rig.kind !== 'path')) throw new Error('Depth must author a fly path.')
    const rig = camera.rig
    const points = rig.points
    const xs = points.map(point => point.position[0])
    const ys = points.map(point => point.position[1])
    const rolls = points.map(point => point.rollDegrees ?? 0)
    expect(Math.min(...xs)).toBeLessThan(-2.4)
    expect(Math.max(...xs)).toBeGreaterThan(2.4)
    expect(Math.min(...ys)).toBeLessThan(-2.2)
    expect(Math.max(...ys)).toBeGreaterThan(2.2)
    expect(Math.max(...rolls)).toBeGreaterThanOrEqual(38)
    expect(Math.min(...rolls)).toBeLessThanOrEqual(-28)
    expect(points.every(point => point.target && (Math.abs(point.target[0]) > 1 || Math.abs(point.target[1]) > 0.6))).toBe(true)
    const nextLapStart = points[0]!.position.map((value, axis) => value + rig.repeatOffset![axis])
    expect(Math.hypot(...points[points.length - 1]!.position.map((value, axis) => value - nextLapStart[axis]))).toBeLessThan(2)
    expect(Math.abs((points[points.length - 1]!.rollDegrees ?? 0) - (points[0]!.rollDegrees ?? 0))).toBeLessThanOrEqual(2)
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

  it('flies smoothly through multiple quadrants with changing perspective and strong authored roll', () => {
    const compiled = compileCinema2NativePreset(CINEMA2_DEPTH_PRESET_MANIFEST)
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return
    const state = new Cinema2ParameterState(compiled.plan.parameters)
    const resolver = new Cinema2FinalValueResolver(compiled.plan.targets, {
      resolveBaseValue: target => target.parameterId == null ? target.authoredBaseValue : state.getValue(target.parameterId),
    })
    const spatial = new Cinema2SpatialRuntime(compiled.plan.scene, compiled.plan.targets.targets, resolver)
    const camera = new Cinema2CameraRuntime(compiled.plan, state, resolver, spatial)
    const frames = []
    for (let step = 0; step <= CINEMA2_DEPTH_LAP_SECONDS * 60 + 2; step += 1) {
      const time = step / 60
      const frame: Cinema2ModuleFrameReadContext = {
        frameId: step + 1, timestampMs: time * 1000, deltaTimeSec: 1 / 60, elapsedTimeSec: time,
        viewport: { width: 1200, height: 800, dpr: 1 }, contextGeneration: 1, audio: null, director: null,
      }
      frames.push(camera.update(frame))
    }
    const xs = frames.map(frame => frame.position[0])
    const ys = frames.map(frame => frame.position[1])
    const rolls = frames.map(frame => frame.rollDegrees)
    const lookXs = frames.map(frame => frame.target[0] - frame.position[0])
    const lookYs = frames.map(frame => frame.target[1] - frame.position[1])
    expect(Math.min(...xs)).toBeLessThan(-2.3)
    expect(Math.max(...xs)).toBeGreaterThan(2.3)
    expect(Math.min(...ys)).toBeLessThan(-2)
    expect(Math.max(...ys)).toBeGreaterThan(2.1)
    expect(Math.min(...lookXs)).toBeLessThan(-3)
    expect(Math.max(...lookXs)).toBeGreaterThan(3)
    expect(Math.min(...lookYs)).toBeLessThan(-2)
    expect(Math.max(...lookYs)).toBeGreaterThan(2)
    expect(Math.min(...rolls)).toBeLessThan(-27)
    expect(Math.max(...rolls)).toBeGreaterThan(36)
    const steps = frames.slice(1).map((frame, index) => Math.hypot(
      frame.position[0] - frames[index]!.position[0],
      frame.position[1] - frames[index]!.position[1],
      frame.position[2] - frames[index]!.position[2],
    ))
    expect(Math.max(...steps)).toBeLessThan(0.2)
    const start = frames[0]!
    const lap = frames[CINEMA2_DEPTH_LAP_SECONDS * 60]!
    expect(Math.hypot(lap.position[0] - start.position[0], lap.position[1] - start.position[1])).toBeLessThan(0.5)
    expect(lap.position[2] - start.position[2]).toBeCloseTo(-CINEMA2_DEPTH_LAP_DISTANCE, 0)
  })

  it('evaluates every light program deterministically with bounded per-side output', () => {
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

  it('keeps the default program sparse, per-segment, and distributed through depth', () => {
    const controls: Cinema2DepthLightControls = {
      program: 'architecturalSparse', direction: 'forward', rate: 1.1, activeSpan: 4, seed: 7,
      centerEnabled: true, centerIntensity: 0.38,
    }
    const levelsAt = (time: number, overrides: Partial<Cinema2DepthLightControls> = {}) => Array.from(
      { length: CINEMA2_DEPTH_LAYOUT_CONFIG.portalCount * 4 },
      (_, segment) => resolveCinema2DepthProgramEmission(
        Math.floor(segment / 4), segment % 4, CINEMA2_DEPTH_LAYOUT_CONFIG.portalCount, time, { ...controls, ...overrides },
      ),
    )

    for (const time of [0, 0.8, 2.1, 4.6, 7.4, 11.2, 13.8]) {
      const levels = levelsAt(time)
      const visible = levels.map((value, segment) => ({ value, segment })).filter(item => item.value > 0.08)
      const activePortals = new Set(visible.map(item => Math.floor(item.segment / 4)))
      const completePortals = Array.from({ length: CINEMA2_DEPTH_LAYOUT_CONFIG.portalCount }, (_, portal) => levels.slice(portal * 4, portal * 4 + 4))
        .filter(sides => sides.every(value => value > 0.08))
      expect(visible.length).toBeGreaterThanOrEqual(3)
      expect(visible.length).toBeLessThanOrEqual(6)
      expect(activePortals.size).toBeGreaterThanOrEqual(3)
      expect(completePortals).toHaveLength(0)
      expect(levels.filter(value => value === 0).length).toBeGreaterThanOrEqual(26)
      expect(levelsAt(time)).toEqual(levels)
    }
  })

  it('keeps builds dark and limits drops to one additional deterministic bar', () => {
    const controls: Cinema2DepthLightControls = {
      program: 'architecturalSparse', direction: 'forward', rate: 1.1, activeSpan: 4, seed: 7,
      centerEnabled: false, centerIntensity: 0,
    }
    const levelsAt = (time: number, overrides: Partial<Cinema2DepthLightControls> = {}) => Array.from(
      { length: CINEMA2_DEPTH_LAYOUT_CONFIG.portalCount * 4 },
      (_, segment) => resolveCinema2DepthProgramEmission(
        Math.floor(segment / 4), segment % 4, CINEMA2_DEPTH_LAYOUT_CONFIG.portalCount, time, { ...controls, ...overrides },
      ),
    )

    let observedDropBar = false
    for (const time of [0.4, 2.3, 5.7, 9.1]) {
      const idle = levelsAt(time)
      const build = levelsAt(time, { buildAmount: 1 })
      const drop = levelsAt(time, { dropAccent: 1 })
      const newlyLitByBuild = build.filter((value, segment) => idle[segment] === 0 && value > 0)
      const newlyLitByDrop = drop.filter((value, segment) => idle[segment] === 0 && value > 0.08)
      expect(newlyLitByBuild).toHaveLength(0)
      expect(newlyLitByDrop.length).toBeLessThanOrEqual(1)
      expect(drop.filter(value => value > 0.08).length).toBeLessThanOrEqual(7)
      observedDropBar ||= newlyLitByDrop.length === 1
    }
    expect(observedDropBar).toBe(true)
  })

  it('spills active light onto matching structure sides instead of whole portals', () => {
    const layout = buildCinema2DepthProofLayout()
    const frame = createCinema2DepthLightFrame(layout.instances.length, layout.portalCount)
    updateCinema2DepthLightFrame(frame, layout, 2.75, {
      program: 'architecturalSparse', direction: 'forward', rate: 1.1, activeSpan: 4, seed: 7,
      centerEnabled: false, centerIntensity: 0,
    })
    const frameInstances = layout.instances
      .map((instance, index) => ({ instance, index }))
      .filter(({ instance }) => instance.kind === 'frame')
    for (const { instance, index } of frameInstances) {
      const segmentLevel = frame.segmentLevels[instance.portalIndex * 4 + instance.sideIndex]!
      expect(frame.spills[index]).toBeCloseTo(segmentLevel * 0.34, 6)
    }
    expect(frameInstances.some(({ index }) => frame.spills[index] === 0)).toBe(true)
    expect(frameInstances.some(({ index }) => frame.spills[index]! > 0)).toBe(true)
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

  it('keeps the focal sphere matte, stable through accents, and independently visible', () => {
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
    updateCinema2DepthLightFrame(frame, layout, 1, { ...controls, centerEnabled: true, downbeatAccent: 1, dropAccent: 1 })
    expect(frame.emissions[centerIndex]).toBeCloseTo(1.4)
    expect(layout.instances[centerIndex]).toMatchObject({ kind: 'center', size: [0.9, 0.9, 0.9], spill: 0 })
    expect(frame.emissions).toHaveLength(layout.instances.length)
  })

  it('uploads one light buffer and renders boxes plus spheres in two instanced draws', () => {
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
      repeatOriginZ: CINEMA2_DEPTH_REPEAT_ORIGIN_Z,
      centerDistance: CINEMA2_DEPTH_REPEAT_ORIGIN_Z - layout.centerDepth,
    })
    expect(vi.mocked(gl.bufferSubData)).toHaveBeenCalledOnce()
    expect(vi.mocked(gl.drawElementsInstanced)).toHaveBeenCalledTimes(2)
    expect(vi.mocked(gl.drawElementsInstanced).mock.calls.map(call => call[4])).toEqual([
      layout.boxInstanceCount,
      layout.sphereInstanceCount,
    ])
    expect(vi.mocked(gl.drawElementsInstanced).mock.calls[1]?.[1]).toBeGreaterThan(36)
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
    expect(draw.mock.calls[0]?.[0].emissions).toHaveLength(373)
    expect(draw.mock.calls[0]?.[0].spills).toHaveLength(373)
    expect(draw.mock.calls[0]?.[0]).toMatchObject({ repeatDistance: 48, repeatOriginZ: 12 })
    expect(instance.inspect()).toMatchObject({ portalCount: 8, lapCopies: 3, instanceCount: 373, estimatedGpuBytes: 4096, lightProgram: 'sideOrbit', direction: 'reverse' })
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
