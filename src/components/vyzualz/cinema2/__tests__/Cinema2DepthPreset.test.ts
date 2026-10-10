import { describe, expect, it, vi } from 'vitest'
import { createCinemaMockWebGL } from '../../cinema/__tests__/CinemaWebGLTestUtils'
import type { Cinema2JsonValue } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import {
  CINEMA2_DEPTH_NATIVE_MODULE_TYPE_ID,
  CINEMA2_DEPTH_STRUCTURE_ROTATION_SECONDS,
  createCinema2DepthNativeModuleDefinition,
  type Cinema2DepthModuleInspection,
} from '../modules/Cinema2DepthNativeModule'
import type { Cinema2ModuleCreateContext } from '../modules/Cinema2ModuleContracts'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { cinema2NativeEffectRegistry } from '../effects/Cinema2EffectRegistry'
import {
  CINEMA2_DEPTH_DEFAULT_CENTER_Z,
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
  Cinema2DepthOrchestration,
  type Cinema2DepthOrchestrationFrame,
  type Cinema2DepthOrchestrationInputs,
} from '../modules/depth/Cinema2DepthOrchestration'
import {
  CINEMA2_DEPTH_CENTER_MATTE_COLOR,
  CINEMA2_DEPTH_STRIP_BOUNCE_GAIN,
  CINEMA2_DEPTH_STRIP_HDR_MULTIPLIER,
  CINEMA2_DEPTH_UNLIT_STRIP_LIGHT_MIX,
  CINEMA2_DEPTH_UNLIT_STRIP_MATERIAL_LIFT,
  Cinema2DepthRenderer,
} from '../modules/depth/Cinema2DepthRenderer'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { Cinema2CameraRuntime, type Cinema2CameraFrame } from '../spatial/Cinema2CameraRuntime'
import { Cinema2SpatialRuntime } from '../spatial/Cinema2SpatialRuntime'
import {
  CINEMA2_DEPTH_AUTO_PERFORMANCE_ID,
  CINEMA2_DEPTH_BPM_SYNC_ID,
  CINEMA2_DEPTH_LAP_DISTANCE,
  CINEMA2_DEPTH_LAP_SECONDS,
  CINEMA2_DEPTH_MOTION_SAFETY_ID,
  CINEMA2_DEPTH_PATTERN_CHANGE_ID,
  CINEMA2_DEPTH_PRESET_ID,
  CINEMA2_DEPTH_PRESET_MANIFEST,
  CINEMA2_DEPTH_TRIGGER_ID,
} from '../presets/Cinema2DepthPreset'

const DEPTH_DT = 1 / 60
const available = (value: number) => ({ available: true, value })

function depthMusicFrame(index: number, options: {
  energy?: number
  bass?: number
  vocal?: number
  build?: number
  sectionType?: string
  nextDropSec?: number
} = {}): Cinema2ModuleFrameReadContext {
  const time = index * DEPTH_DT
  const beatIndex = Math.floor(time * 2)
  const beatPhase = time * 2 - beatIndex
  return {
    frameId: index + 1,
    timestampMs: time * 1000,
    deltaTimeSec: DEPTH_DT,
    elapsedTimeSec: time,
    viewport: { width: 1200, height: 800, dpr: 1 },
    contextGeneration: 1,
    director: null,
    transport: { sourcePresent: true, playing: true, analysisActive: true, paused: false, animationActive: true, trackId: 'depth-test', timeSec: time },
    audio: {
      upstream: { timeSec: time },
      discontinuity: { occurred: false, reason: null },
      bands: { bass: available(options.bass ?? 0.55), sub: available(0.2) },
      features: {
        overallEnergy: available(options.energy ?? 0.55),
        buildProgress: available(options.build ?? 0),
        vocalPresence: available(options.vocal ?? 0),
      },
      rhythm: {
        bpm: available(120),
        beatIndex: available(beatIndex),
        beatPhase: available(beatPhase),
        beat: null,
        downbeat: null,
        kick: null,
        snare: null,
        transient: null,
      },
      structure: {
        section: { available: true, value: { id: 'depth-section', type: options.sectionType ?? 'verse' } },
        semanticMoments: {
          available: options.nextDropSec != null,
          value: options.nextDropSec == null ? [] : [{ id: 'depth-drop', timeSec: options.nextDropSec, type: 'drop' }],
        },
      },
    } as never,
  }
}

const depthInputs = (overrides: Partial<Cinema2DepthOrchestrationInputs> = {}): Cinema2DepthOrchestrationInputs => ({
  pattern: 'architecturalSparse',
  auto: true,
  patternChange: false,
  trigger: 'bar4',
  sync: true,
  routeDensity: 0.36,
  pulseWidth: 0.42,
  dropIntensity: 0.9,
  ...overrides,
})

describe('Cinema 2.0 Depth preset', () => {
  it('builds the fixed procedural proof tunnel deterministically', () => {
    const first = buildCinema2DepthProofLayout()
    const second = buildCinema2DepthProofLayout()
    expect(second).toEqual(first)
    expect(first).toMatchObject({
      portalCount: 8, lapCopies: 3, aperture: 8.2, spacing: 6, repeatDistance: 48,
      boxInstanceCount: 384, sphereInstanceCount: 385,
    })
    expect(first.instances).toHaveLength(769)
    expect(first.instances.filter(instance => instance.kind === 'strip')).toHaveLength(96)
    expect(first.instances.filter(instance => instance.kind === 'connector')).toHaveLength(96)
    expect(first.instances.filter(instance => instance.kind === 'rail')).toHaveLength(96)
    expect(first.instances.filter(instance => instance.kind === 'node')).toHaveLength(96)
    expect(first.instances.filter(instance => instance.kind === 'collar')).toHaveLength(288)
    expect(first.instances.filter(instance => instance.kind === 'center')).toHaveLength(1)
    expect(first.instances.find(instance => instance.kind === 'center')).toMatchObject({ center: [0, 0, CINEMA2_DEPTH_DEFAULT_CENTER_Z] })
    expect(first.instances.filter(instance => instance.kind === 'strip' && instance.emission > 0)).toHaveLength(12)
    expect(first.instances.every(instance => instance.size.every(value => value > 0))).toBe(true)

    const packed = packCinema2DepthInstances(first.instances)
    expect(packed).toHaveLength(first.instances.length * CINEMA2_DEPTH_INSTANCE_FLOATS)
    expect([...packed]).toEqual([...packCinema2DepthInstances(second.instances)])

    const baseLap = buildCinema2DepthProofLayout({ lapCopies: 1 })
    expect(baseLap).toMatchObject({ boxInstanceCount: 128, sphereInstanceCount: 129 })
    expect(baseLap.instances).toHaveLength(257)
    expect(baseLap.instances.filter(instance => instance.kind === 'strip' && instance.emission > 0)).toHaveLength(4)
    expect(baseLap.instances.filter(instance => instance.kind === 'strip' && instance.portalIndex === 0).map(instance => instance.emission)).toEqual([1, 0, 0, 0])
    for (let portal = 0; portal < baseLap.portalCount; portal += 1) {
      const strips = baseLap.instances.filter(instance => instance.kind === 'strip' && instance.portalIndex === portal)
      expect(strips).toHaveLength(4)
      for (const strip of strips) {
        const longAxis = Math.max(strip.size[0], strip.size[1])
        expect(longAxis).toBeGreaterThan(baseLap.aperture)
      }
      const connectors = baseLap.instances.filter(instance => instance.kind === 'connector' && instance.portalIndex === portal)
      expect(connectors).toHaveLength(4)
      expect(connectors.every(connector => connector.size[2] > baseLap.spacing && connector.emission === 0)).toBe(true)
      const nodes = baseLap.instances.filter(instance => instance.kind === 'node' && instance.portalIndex === portal)
      const collars = baseLap.instances.filter(instance => instance.kind === 'collar' && instance.portalIndex === portal)
      expect(nodes).toHaveLength(4)
      expect(collars).toHaveLength(12)
      for (const node of nodes) {
        expect(Math.abs(node.center[0])).toBeCloseTo(baseLap.aperture * 0.5, 6)
        expect(Math.abs(node.center[1])).toBeCloseTo(baseLap.aperture * 0.5, 6)
        expect(collars.filter(collar => collar.sideIndex === node.sideIndex)).toHaveLength(3)
        const connector = connectors.find(instance => instance.sideIndex === node.sideIndex)!
        const connectorEnd = connector.center[2] + connector.size[2] * 0.5
        expect(Math.abs(connectorEnd - node.center[2])).toBeLessThan(node.size[2] * 0.5)
      }
    }
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
    expect(CINEMA2_DEPTH_PRESET_MANIFEST.revision).toBe(12)
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
    expect(CINEMA2_DEPTH_UNLIT_STRIP_MATERIAL_LIFT).toBeGreaterThan(1)
    expect(CINEMA2_DEPTH_UNLIT_STRIP_MATERIAL_LIFT).toBeLessThan(2)
    expect(CINEMA2_DEPTH_UNLIT_STRIP_LIGHT_MIX).toBeGreaterThan(0.05)
    expect(CINEMA2_DEPTH_UNLIT_STRIP_LIGHT_MIX).toBeLessThan(0.1)
    expect(CINEMA2_DEPTH_STRIP_BOUNCE_GAIN).toBeGreaterThan(0)
    expect(CINEMA2_DEPTH_STRIP_BOUNCE_GAIN).toBeLessThanOrEqual(0.2)
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
    const values = new Map<string, Cinema2JsonValue>(actions.map(action => [action.id, action.value]))
    expect(values.get('depth-beat-bloom-action')).toBe(0.025)
    expect(values.get('depth-downbeat-bloom-action')).toBe(0.05)
    expect(values.get('depth-phrase-atmosphere-action')).toBe(0.001)
    expect(values.get('depth-build-atmosphere-action')).toBe(0.0015)
    expect(values.get('depth-drop-bloom-action')).toBe(0.08)
  })

  it('authors a centered slow-forward fly rig, three motion-safety modes, and bounded optional choreography', () => {
    const camera = CINEMA2_DEPTH_PRESET_MANIFEST.cameras![0]!
    expect(camera.rig).toMatchObject({
      kind: 'fly', durationSeconds: CINEMA2_DEPTH_LAP_SECONDS, loop: true,
      repeatOffset: [0, 0, -CINEMA2_DEPTH_LAP_DISTANCE],
    })
    expect(camera.motion).toMatchObject({
      interpolation: 'spline',
      constantSpeed: true,
      tempo: { flightSpeed: true, weave: 0, bob: 0, roll: 0, fov: 0, punch: 0 },
    })
    expect(camera.motion).not.toHaveProperty('drift')
    expect(camera.motion).not.toHaveProperty('bank')
    expect(camera.motion).not.toHaveProperty('rollDegrees')
    if (!camera.rig || (camera.rig.kind !== 'fly' && camera.rig.kind !== 'path')) throw new Error('Depth must author a fly path.')
    const rig = camera.rig
    const points = rig.points
    expect(points).toHaveLength(4)
    expect(points.every(point => point.position[0] === 0 && point.position[1] === 0)).toBe(true)
    expect(points.every(point => point.target?.[0] === 0 && point.target[1] === 0)).toBe(true)
    expect(points.every(point => point.rollDegrees === 0 && point.fovDegrees === 59)).toBe(true)
    expect(points.every(point => point.target && point.position[2] - point.target[2] === CINEMA2_DEPTH_REPEAT_ORIGIN_Z - CINEMA2_DEPTH_DEFAULT_CENTER_Z)).toBe(true)
    expect(points[0]).toMatchObject({ position: [0, 0, CINEMA2_DEPTH_REPEAT_ORIGIN_Z], target: [0, 0, CINEMA2_DEPTH_DEFAULT_CENTER_Z], rollDegrees: 0 })
    expect(points.map(point => point.position[2])).toEqual([12, 0, -12, -24])
    expect(camera.controls).toEqual({
      motionSafety: { $ref: CINEMA2_DEPTH_MOTION_SAFETY_ID },
      tempoSync: { $ref: CINEMA2_DEPTH_BPM_SYNC_ID },
    })
    expect(CINEMA2_DEPTH_PRESET_MANIFEST.parameters).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: CINEMA2_DEPTH_AUTO_PERFORMANCE_ID, defaultValue: true }),
      expect.objectContaining({ id: CINEMA2_DEPTH_MOTION_SAFETY_ID, type: 'enum', defaultValue: 'full' }),
    ]))
    expect(CINEMA2_DEPTH_PRESET_MANIFEST.choreography?.rules.map(rule => rule.source.signal)).toEqual([
      'kick', 'snare', 'transient', 'beat', 'downbeat', 'bar', 'phrase', 'section-change', 'drop',
      'beat', 'downbeat', 'phrase', 'continuous', 'drop',
    ])
    expect(CINEMA2_DEPTH_PRESET_MANIFEST.choreography?.rules.slice(9).every(rule => rule.enabledParameter?.$ref === CINEMA2_DEPTH_AUTO_PERFORMANCE_ID)).toBe(true)
    expect(new Set(CINEMA2_DEPTH_PRESET_MANIFEST.choreography?.rules.flatMap(rule => rule.actions.map(action => action.target.kind)))).toEqual(
      new Set(['parameter', 'module', 'effect']),
    )
    expect(CINEMA2_DEPTH_PRESET_MANIFEST.modules![0]!.parameters).toMatchObject({
      beatAccent: 0, downbeatAccent: 0, phraseAccent: 0, buildAmount: 0, dropAccent: 0,
    })
  })

  it('authors eight geometry-aware programs plus Pattern Change and Trigger controls', () => {
    const program = CINEMA2_DEPTH_PRESET_MANIFEST.parameters!.find(parameter => parameter.id === 'depth-program')
    expect(program).toMatchObject({
      type: 'enum',
      options: expect.arrayContaining([
        expect.objectContaining({ value: 'depthDischarge', label: 'Depth Discharge' }),
        expect.objectContaining({ value: 'portalRelay', label: 'Portal Relay' }),
      ]),
    })
    expect(CINEMA2_DEPTH_LIGHT_PROGRAMS).toHaveLength(8)
    expect(CINEMA2_DEPTH_PRESET_MANIFEST.parameters).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: CINEMA2_DEPTH_PATTERN_CHANGE_ID, defaultValue: false }),
      expect.objectContaining({ id: CINEMA2_DEPTH_TRIGGER_ID, defaultValue: 'bar4' }),
      expect.objectContaining({ id: 'depth-route-density', defaultValue: 0.36 }),
      expect.objectContaining({ id: 'depth-pulse-width', defaultValue: 0.42 }),
      expect.objectContaining({ id: 'depth-drop-intensity', defaultValue: 0.9 }),
    ]))
    expect(CINEMA2_DEPTH_PRESET_MANIFEST.modules![0]!.actionBindings).toEqual({ musicalCue: { $ref: 'depth-musical-cue' } })
  })

  it('uses shared musical context for the build countdown, drop discharge, pattern changes, and rotation direction', () => {
    const buildRuntime = new Cinema2DepthOrchestration()
    let buildFrame: Readonly<Cinema2DepthOrchestrationFrame> | null = null
    for (let index = 0; index <= 90; index += 1) {
      buildFrame = buildRuntime.update(depthMusicFrame(index, { energy: 0.78, bass: 0.72, build: 0.9, nextDropSec: 2.5 }), depthInputs(), CINEMA2_DEPTH_LIGHT_PROGRAMS)
    }
    expect(buildFrame).toMatchObject({ pattern: 'depthDischarge' })
    expect(buildFrame!.countdown).toBeGreaterThanOrEqual(1)
    expect(buildFrame!.countdown).toBeLessThanOrEqual(4)
    expect(buildFrame!.rotationMultiplier).toBeGreaterThan(1.5)

    buildRuntime.enqueueCue('drop', 'drop-cue')
    let dropFrame = buildRuntime.update(depthMusicFrame(91, { energy: 1, bass: 1 }), depthInputs(), CINEMA2_DEPTH_LIGHT_PROGRAMS)
    for (let index = 92; index <= 152; index += 1) {
      dropFrame = buildRuntime.update(depthMusicFrame(index, { energy: 1, bass: 1 }), depthInputs(), CINEMA2_DEPTH_LIGHT_PROGRAMS)
    }
    expect(dropFrame.pattern).toBe('depthDischarge')
    expect(dropFrame.dropDischarge).toBeGreaterThan(0)
    expect(dropFrame.rotationMultiplier).toBeLessThan(0)

    const quietRuntime = new Cinema2DepthOrchestration()
    let quietFrame = quietRuntime.update(depthMusicFrame(0, { energy: 0.08, bass: 0.05, vocal: 0.8, sectionType: 'breakdown' }), depthInputs(), CINEMA2_DEPTH_LIGHT_PROGRAMS)
    for (let index = 1; index <= 120; index += 1) {
      quietFrame = quietRuntime.update(depthMusicFrame(index, { energy: 0.08, bass: 0.05, vocal: 0.8, sectionType: 'breakdown' }), depthInputs(), CINEMA2_DEPTH_LIGHT_PROGRAMS)
    }
    expect(quietFrame.pattern).toBe('fullPulse')
    expect(quietFrame.rotationMultiplier).toBeLessThan(0.5)

    const manualRuntime = new Cinema2DepthOrchestration()
    manualRuntime.enqueueCue('kick', 'kick-cue')
    const changed = manualRuntime.update(depthMusicFrame(0), depthInputs({ auto: false, patternChange: true, trigger: 'kick' }), CINEMA2_DEPTH_LIGHT_PROGRAMS)
    expect(changed.pattern).toBe('depthChase')
  })

  it('builds sparse helical segments, discharges rings toward the camera, and never modulates the matte center', () => {
    const layout = buildCinema2DepthProofLayout()
    const centerIndex = layout.instances.findIndex(instance => instance.kind === 'center')
    const weights = CINEMA2_DEPTH_LIGHT_PROGRAMS.map(pattern => pattern === 'depthDischarge' ? 1 : 0)
    const orchestration = (overrides: Partial<Cinema2DepthOrchestrationFrame>): Cinema2DepthOrchestrationFrame => ({
      pattern: 'depthDischarge', weights, beats: 12, level: 0.8, quiet: 0, build: 0.72, countdown: 4,
      dropElapsed: Number.POSITIVE_INFINITY, dropDischarge: 0, dropAfterglow: 0,
      accents: [0, 0, 0, 0], relayGroup: 0, routeDensity: 0.36, pulseWidth: 0.42, dropIntensity: 0.9,
      rotationMultiplier: 1,
      ...overrides,
    })
    const controls = (frame: Cinema2DepthOrchestrationFrame): Cinema2DepthLightControls => ({
      program: 'depthDischarge', direction: 'forward', rate: 1, activeSpan: 4, seed: 7,
      centerEnabled: true, centerIntensity: 0.7, orchestration: frame,
    })
    const build = createCinema2DepthLightFrame(layout.instances.length, layout.portalCount)
    updateCinema2DepthLightFrame(build, layout, 6, controls(orchestration({})))
    const activeBuildSegments = [...build.segmentLevels].filter(value => value > 0.08).length
    expect(activeBuildSegments).toBeGreaterThanOrEqual(8)
    expect(activeBuildSegments).toBeLessThan(32)
    expect(build.emissions[centerIndex]).toBeCloseTo(0.7)

    const discharge = createCinema2DepthLightFrame(layout.instances.length, layout.portalCount)
    updateCinema2DepthLightFrame(discharge, layout, 6, controls(orchestration({
      build: 0, countdown: 0, dropElapsed: 0.8, dropDischarge: 0.49,
    })))
    const peakPortal = discharge.portalLevels.indexOf(Math.max(...discharge.portalLevels))
    expect(peakPortal).toBeGreaterThanOrEqual(3)
    expect(peakPortal).toBeLessThanOrEqual(4)
    expect(discharge.emissions[centerIndex]).toBeCloseTo(0.7)
  })

  it('alternates distributed near/far and middle counterpoint throughout each bar', () => {
    const pattern = 'alternatingFrames'
    const weights = CINEMA2_DEPTH_LIGHT_PROGRAMS.map(candidate => candidate === pattern ? 1 : 0)
    const frame = (beats: number): Cinema2DepthOrchestrationFrame => ({
      pattern, weights, beats, level: 0.65, quiet: 0, build: 0, countdown: 0,
      dropElapsed: Number.POSITIVE_INFINITY, dropDischarge: 0, dropAfterglow: 0,
      accents: [0, 0, 0, 0], relayGroup: 0, routeDensity: 0.36, pulseWidth: 0.42, dropIntensity: 0.9,
      rotationMultiplier: 1,
    })
    const portalTotals = (beats: number) => Array.from({ length: 8 }, (_, portal) => (
      Array.from({ length: 4 }, (_, side) => resolveCinema2DepthProgramEmission(portal, side, 8, beats / 2, {
        program: pattern, direction: 'forward', rate: 1, activeSpan: 4, seed: 7,
        centerEnabled: true, centerIntensity: 0.7, orchestration: frame(beats),
      })).reduce((sum, level) => sum + level, 0)
    ))

    const endsFrame = portalTotals(0)
    const middleFrame = portalTotals(1.5)
    const ends = endsFrame[0]! + endsFrame[1]! + endsFrame[6]! + endsFrame[7]!
    const endsMiddle = endsFrame[3]! + endsFrame[4]!
    const middle = middleFrame[3]! + middleFrame[4]!
    const middleEnds = middleFrame[0]! + middleFrame[1]! + middleFrame[6]! + middleFrame[7]!
    expect(ends).toBeGreaterThan(endsMiddle * 2)
    expect(middle).toBeGreaterThan(middleEnds)
    expect(endsFrame[0]).toBeGreaterThan(0)
    expect(endsFrame[7]).toBeGreaterThan(0)

    const signatures = Array.from({ length: 8 }, (_, subdivision) => Array.from({ length: 32 }, (_, segment) => (
      resolveCinema2DepthProgramEmission(Math.floor(segment / 4), segment % 4, 8, subdivision / 4, {
        program: pattern, direction: 'forward', rate: 1, activeSpan: 4, seed: 7,
        centerEnabled: true, centerIntensity: 0.7, orchestration: frame(subdivision / 2),
      }) > 0.3 ? '1' : '0'
    )).join(''))
    expect(new Set(signatures).size).toBeGreaterThanOrEqual(6)
  })

  it('progresses slowly and smoothly forward without leaving the tunnel centerline', () => {
    const compiled = compileCinema2NativePreset(CINEMA2_DEPTH_PRESET_MANIFEST)
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return
    const state = new Cinema2ParameterState(compiled.plan.parameters)
    const resolver = new Cinema2FinalValueResolver(compiled.plan.targets, {
      resolveBaseValue: target => target.parameterId == null ? target.authoredBaseValue : state.getValue(target.parameterId),
    })
    const spatial = new Cinema2SpatialRuntime(compiled.plan.scene, compiled.plan.targets.targets, resolver)
    const camera = new Cinema2CameraRuntime(compiled.plan, state, resolver, spatial)
    const frames: Readonly<Cinema2CameraFrame>[] = []
    for (let step = 0; step <= CINEMA2_DEPTH_LAP_SECONDS * 60 + 2; step += 1) {
      const time = step / 60
      const frame: Cinema2ModuleFrameReadContext = {
        frameId: step + 1, timestampMs: time * 1000, deltaTimeSec: 1 / 60, elapsedTimeSec: time,
        viewport: { width: 1200, height: 800, dpr: 1 }, contextGeneration: 1, audio: null, director: null,
      }
      frames.push(camera.update(frame))
    }
    expect(frames.every(frame => Math.abs(frame.position[0]) < 1e-8 && Math.abs(frame.position[1]) < 1e-8)).toBe(true)
    expect(frames.every(frame => Math.abs(frame.target[0]) < 1e-8 && Math.abs(frame.target[1]) < 1e-8)).toBe(true)
    expect(frames.every(frame => Math.abs(frame.rollDegrees) < 1e-8)).toBe(true)
    expect(frames.every(frame => Math.abs((frame.position[2] - frame.target[2]) - (CINEMA2_DEPTH_REPEAT_ORIGIN_Z - CINEMA2_DEPTH_DEFAULT_CENTER_Z)) < 1e-6)).toBe(true)
    expect(frames.every((frame, index) => index === 0 || frame.position[2] <= frames[index - 1]!.position[2])).toBe(true)
    const steps = frames.slice(1).map((frame, index) => Math.hypot(
      frame.position[0] - frames[index]!.position[0],
      frame.position[1] - frames[index]!.position[1],
      frame.position[2] - frames[index]!.position[2],
    ))
    expect(Math.max(...steps)).toBeLessThan(0.03)
    const start = frames[0]!
    const tenSeconds = frames[10 * 60]!
    expect(start.position[2] - tenSeconds.position[2]).toBeGreaterThan(9)
    expect(start.position[2] - tenSeconds.position[2]).toBeLessThan(11)
    const lap = frames[CINEMA2_DEPTH_LAP_SECONDS * 60]!
    expect(lap.position[2] - start.position[2]).toBeCloseTo(-CINEMA2_DEPTH_LAP_DISTANCE, 0)
  })

  it('keeps the moving camera aimed at the center object at the end of the tunnel', () => {
    const compiled = compileCinema2NativePreset(CINEMA2_DEPTH_PRESET_MANIFEST)
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return
    const state = new Cinema2ParameterState(compiled.plan.parameters)
    const resolver = new Cinema2FinalValueResolver(compiled.plan.targets, {
      resolveBaseValue: target => target.parameterId == null ? target.authoredBaseValue : state.getValue(target.parameterId),
    })
    const spatial = new Cinema2SpatialRuntime(compiled.plan.scene, compiled.plan.targets.targets, resolver)
    const camera = new Cinema2CameraRuntime(compiled.plan, state, resolver, spatial)
    const at = (time: number): Cinema2ModuleFrameReadContext => ({
      frameId: Math.round(time * 60) + 1, timestampMs: time * 1000, deltaTimeSec: 1 / 60, elapsedTimeSec: time,
      viewport: { width: 1200, height: 800, dpr: 1 }, contextGeneration: 1, audio: null, director: null,
    })
    const first = camera.update(at(0))
    let later = first
    for (let step = 1; step <= 8 * 60; step += 1) later = camera.update(at(step / 60))
    expect(first.position).toEqual([0, 0, CINEMA2_DEPTH_REPEAT_ORIGIN_Z])
    expect(first.target).toEqual([0, 0, CINEMA2_DEPTH_DEFAULT_CENTER_Z])
    expect(later.position[0]).toBe(0)
    expect(later.position[1]).toBe(0)
    expect(later.position[2]).toBeLessThan(first.position[2] - 7)
    expect(later.target[0]).toBe(0)
    expect(later.target[1]).toBe(0)
    expect(later.position[2] - later.target[2]).toBeCloseTo(CINEMA2_DEPTH_REPEAT_ORIGIN_Z - CINEMA2_DEPTH_DEFAULT_CENTER_Z, 6)
    expect(later.rollDegrees).toBe(0)
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

  it('keeps off LED fixtures present and reveals only those near active bars', () => {
    const layout = buildCinema2DepthProofLayout()
    const frame = createCinema2DepthLightFrame(layout.instances.length, layout.portalCount)
    updateCinema2DepthLightFrame(frame, layout, 2.75, {
      program: 'architecturalSparse', direction: 'forward', rate: 1.1, activeSpan: 4, seed: 7,
      centerEnabled: false, centerIntensity: 0,
    })
    const offStrips = layout.instances
      .map((instance, index) => ({ instance, index }))
      .filter(({ instance, index }) => instance.kind === 'strip' && frame.emissions[index] === 0)

    expect(offStrips.length).toBeGreaterThan(0)
    expect(offStrips.some(({ index }) => frame.spills[index]! > 0)).toBe(true)
    expect(offStrips.some(({ index }) => frame.spills[index] === 0)).toBe(true)
    expect(offStrips.every(({ index }) => frame.emissions[index] === 0)).toBe(true)

    const connectors = layout.instances
      .map((instance, index) => ({ instance, index }))
      .filter(({ instance }) => instance.kind === 'connector')
    expect(connectors).toHaveLength(layout.portalCount * 4 * layout.lapCopies)
    expect(connectors.every(({ index }) => frame.emissions[index] === 0)).toBe(true)
    expect(connectors.some(({ index }) => frame.spills[index]! > 0)).toBe(true)
    expect(connectors.some(({ index }) => frame.spills[index] === 0)).toBe(true)
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
      structureRotationRadians: Math.PI / 2,
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
    expect(draw.mock.calls[0]?.[0].emissions).toHaveLength(769)
    expect(draw.mock.calls[0]?.[0].spills).toHaveLength(769)
    expect(draw.mock.calls[0]?.[0]).toMatchObject({ repeatDistance: 48, repeatOriginZ: 12 })
    expect(draw.mock.calls[0]?.[0].structureRotationRadians).toBeCloseTo(2.25 / CINEMA2_DEPTH_STRUCTURE_ROTATION_SECONDS * Math.PI * 2, 8)
    expect(instance.inspect()).toMatchObject({ portalCount: 8, lapCopies: 3, instanceCount: 769, estimatedGpuBytes: 4096, lightProgram: 'sideOrbit', direction: 'reverse' })
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
