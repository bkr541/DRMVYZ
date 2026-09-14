import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../features/musicIntelligence/types'
import { createCinemaMockWebGL } from '../../cinema/__tests__/CinemaWebGLTestUtils'
import { afterhoursWorldDefinition } from '../../react/renderers/cinematic/worlds/AfterhoursWorld'
import { Cinema2AudioIntelligenceBridge } from '../audio/Cinema2AudioIntelligenceBridge'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { createCinema2InspectorModel } from '../parameters/Cinema2InspectorModel'
import {
  CINEMA2_AFTERHOURS_NATIVE_MODULE_TYPE_ID,
  CINEMA2_AFTERHOURS_NATIVE_PARAMETER_NAMES,
} from '../modules/Cinema2AfterhoursNativeModule'
import { CINEMA2_AFTERHOURS_TOPOLOGY_IDS } from '../modules/afterhours/Cinema2AfterhoursDomain'
import {
  CINEMA2_AFTERHOURS_AUTO_PERFORMANCE_ID,
  CINEMA2_AFTERHOURS_BACKGROUND_ID,
  CINEMA2_AFTERHOURS_BEAM_COUNT_ID,
  CINEMA2_AFTERHOURS_CAMERA_ID,
  CINEMA2_AFTERHOURS_MODULE_ID,
  CINEMA2_AFTERHOURS_PATTERN_ID,
  CINEMA2_AFTERHOURS_PRESET_ID,
  CINEMA2_AFTERHOURS_PRESET_MANIFEST,
  CINEMA2_AFTERHOURS_RESET_TRAILS_ID,
  CINEMA2_AFTERHOURS_SIDE_LASERS_ID,
  CINEMA2_AFTERHOURS_SYMMETRY_ID,
  CINEMA2_AFTERHOURS_TOP_LASERS_ID,
} from '../presets/Cinema2AfterhoursPreset'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { Cinema2Runtime } from '../runtime/Cinema2Runtime'

const REQUIRED_CAPABILITIES = Object.freeze(['render.webgl2', 'render.depth', 'render.history', 'scene.3d', 'camera.world'] as const)
const EXPECTED_USER_PARAMETER_IDS = Object.freeze([
  'afterhours-background',
  'afterhours-color-mode',
  'afterhours-primary-color',
  'afterhours-accent-color',
  'afterhours-accent-mix',
  'afterhours-pattern',
  'afterhours-auto-performance',
  'afterhours-symmetry',
  'afterhours-side-lasers',
  'afterhours-top-lasers',
  'afterhours-beam-count',
  'afterhours-spread',
  'afterhours-atmosphere',
  'afterhours-bpm-sync',
  'afterhours-master-intensity',
  'afterhours-trigger',
  'afterhours-pulse-amount',
  'afterhours-pulse-decay',
  'afterhours-motion-amount',
  'afterhours-pattern-change',
  'afterhours-blackout-amount',
])
const EXPECTED_PARAMETER_IDS = Object.freeze([...EXPECTED_USER_PARAMETER_IDS, 'afterhours-reset-trails'])

class FakeCanvas extends EventTarget {
  width = 640
  height = 360
  readonly getContext: ReturnType<typeof vi.fn>

  constructor(gl: WebGL2RenderingContext | null) {
    super()
    this.getContext = vi.fn(() => gl)
  }
}

function compileAfterhours() {
  const result = compileCinema2NativePreset(CINEMA2_AFTERHOURS_PRESET_MANIFEST, {
    availableCapabilities: REQUIRED_CAPABILITIES,
  })
  expect(result.ok, result.diagnostics.map(diagnostic => `${diagnostic.path}: ${diagnostic.message}`).join('\n')).toBe(true)
  if (!result.ok) throw new Error('Expected Afterhours 2.0 to compile')
  return result.plan
}

function targetFor(plan: ReturnType<typeof compileAfterhours>, kind: string, ownerId: string, property: string) {
  const target = plan.targets.targets.find(candidate => (
    candidate.kind === kind && candidate.ownerId === ownerId && candidate.property === property
  ))
  if (!target) throw new Error(`Missing target ${kind}:${ownerId}:${property}`)
  return target
}

function stage8MusicFrame(frameId = 1, timeSec = 8): MusicIntelligenceFrame {
  return {
    ...DEFAULT_MI_FRAME,
    frameId,
    sourceId: 'afterhours-stage8-source',
    trackId: 'afterhours-stage8-track',
    timeSec,
    bands: {
      ...DEFAULT_MI_FRAME.bands,
      normalizedSub: 0.82,
      normalizedBass: 0.88,
      normalizedMid: 0.62,
      normalizedHigh: 0.7,
    },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 128,
      bpmConfidence: 0.98,
      bpmSource: 'offline_analysis',
      beatIndex: 32,
      beatPhase: 0,
      beatInBar: 0,
      barIndex: 8,
      beatHit: true,
      downbeatHit: true,
      beatEventTimeSec: timeSec,
      kickHit: true,
      kickStrength: 1,
      snareHit: true,
      snareStrength: 0.9,
      transient: 0.96,
      transientConfidence: 0.97,
      phrase4Hit: true,
      phrase4Progress: 0,
      phrase16Hit: true,
      phrase16Progress: 0,
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      instant: 0.94,
      rms: 0.84,
      spectralFlux: 0.9,
      buildProgress: 0.15,
      tension: 0.86,
      trackCurve: 0.98,
    },
    section: {
      ...DEFAULT_MI_FRAME.section,
      type: 'drop',
      label: 'drop',
      startSec: timeSec - 0.2,
      endSec: timeSec + 7.8,
      progress: 0.025,
      intensity: 0.98,
      confidence: 0.98,
      source: 'analysis',
    },
    stems: { ...DEFAULT_MI_FRAME.stems, vocalActivity: 0.08 },
    semantics: { ...DEFAULT_MI_FRAME.semantics, buildConfidence: 0.12, dropConfidence: 0.98 },
    capabilities: {
      ...DEFAULT_MI_FRAME.capabilities!,
      liveBands: true,
      rhythmEvents: true,
      beatGrid: true,
      sections: true,
      trackEnergyCurve: true,
      stemCurves: true,
    },
    analysisCapabilities: {
      ...DEFAULT_MI_FRAME.analysisCapabilities!,
      reliableBeatGrid: true,
      reliableDownbeatGrid: true,
      barAwareSections: true,
      selfSimilarityAnalysis: true,
      semanticClassification: true,
      phraseHierarchy: true,
      semanticMoments: true,
      legacyFallbackOnly: false,
    },
    analysisSource: 'bar_self_similarity',
    phraseMarkers: [{
      id: `stage8-phrase-${frameId}`,
      timeSec,
      phraseLength: 8,
      lengthBars: 8,
      barIndex: 8,
      confidence: 0.96,
      source: 'structural_boundary',
      structurallyDetected: true,
    }],
    semanticMoments: [{
      id: `stage8-drop-${frameId}`,
      timeSec,
      type: 'drop_impact',
      confidence: 0.99,
      source: 'structural_analysis',
    }],
    confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 0.97, rhythm: 0.98, section: 0.98 },
  }
}

function lastInstancedDrawCount(gl: ReturnType<typeof createCinemaMockWebGL>): number {
  const calls = (gl.drawArraysInstanced as unknown as { mock: { calls: unknown[][] } }).mock.calls
  return Number(calls[calls.length - 1]?.[3] ?? 0)
}

describe('Cinema 2.0 Afterhours 2.0 production preset', () => {
  it('registers as a first-party keeper and passes the shared authoring/compiler gates', () => {
    const declaration = CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.find(candidate => candidate.manifest.id === CINEMA2_AFTERHOURS_PRESET_ID)
    expect(declaration).toMatchObject({ role: 'keeper' })
    expect(declaration?.manifest.metadata.name).toBe('Afterhours 2.0')
    expect(validateCinema2PresetAuthoringConventions({ role: 'keeper', manifest: CINEMA2_AFTERHOURS_PRESET_MANIFEST })).toMatchObject({ ok: true })
    expect(cinema2NativePresetRegistry.has(CINEMA2_AFTERHOURS_PRESET_ID)).toBe(true)

    const plan = compileAfterhours()
    expect(plan.manifest.modules).toHaveLength(1)
    expect(plan.manifest.effects).toHaveLength(1)
    expect(plan.manifest.revision).toBe(5)
    expect(plan.manifest.modules?.[0]).toMatchObject({
      id: CINEMA2_AFTERHOURS_MODULE_ID,
      typeId: CINEMA2_AFTERHOURS_NATIVE_MODULE_TYPE_ID,
      version: 1,
    })
    expect(plan.capabilities.required).toEqual(expect.arrayContaining(REQUIRED_CAPABILITIES))
  })

  it('authors the complete independent parameter contract and binds every exposed control into shared engine state', () => {
    const plan = compileAfterhours()
    expect(plan.parameters.definitions.map(definition => definition.id).sort()).toEqual([...EXPECTED_PARAMETER_IDS].sort())

    const module = plan.manifest.modules?.[0]
    expect(module).toBeDefined()
    const bindings = module?.parameterBindings ?? {}
    expect(Object.keys(module?.parameters ?? {}).sort()).toEqual([...CINEMA2_AFTERHOURS_NATIVE_PARAMETER_NAMES].sort())

    for (const property of CINEMA2_AFTERHOURS_NATIVE_PARAMETER_NAMES) {
      const moduleTarget = targetFor(plan, 'module', CINEMA2_AFTERHOURS_MODULE_ID, property)
      const binding = bindings[property]
      if (binding) expect(moduleTarget.parameterId, property).toBe(binding.$ref)
      else expect(moduleTarget.parameterId, `${property} is internal choreography state`).toBeNull()
    }
    expect(targetFor(plan, 'environment', 'root', 'backgroundColor').parameterId).toBe(CINEMA2_AFTERHOURS_BACKGROUND_ID)

    const pattern = plan.parameters.definitions.find(definition => definition.id === CINEMA2_AFTERHOURS_PATTERN_ID)
    expect(pattern?.options?.map(option => option.value)).toEqual(CINEMA2_AFTERHOURS_TOPOLOGY_IDS)
    expect(plan.parameters.authoredDefaults[CINEMA2_AFTERHOURS_AUTO_PERFORMANCE_ID]).toBe(false)
    expect(plan.parameters.definitions.find(definition => definition.id === CINEMA2_AFTERHOURS_RESET_TRAILS_ID)).toMatchObject({
      type: 'trigger',
      exposure: 'hidden',
      persistence: 'runtime-only',
    })
    expect(plan.parameters.definitions.find(definition => definition.id === CINEMA2_AFTERHOURS_BEAM_COUNT_ID)).toMatchObject({ min: 2, max: 16, step: 1 })
    expect(plan.manifest.choreography?.rules).toHaveLength(10)
    expect(plan.capabilities.required.some(capability => capability.startsWith('music.'))).toBe(false)
    expect(plan.capabilities.optional).toEqual(expect.arrayContaining([
      'audio.transport',
      'music.beat',
      'music.bar',
      'music.rhythm-events',
      'music.downbeat',
      'music.phrase',
      'music.section',
      'music.drop',
      'music.vocal-presence',
      'visual-director.significance',
    ]))
    expect(plan.capabilities.unavailableOptional).toEqual(expect.arrayContaining([
      'audio.transport',
      'music.beat',
      'music.bar',
      'music.rhythm-events',
      'music.downbeat',
      'music.phrase',
      'music.section',
      'music.drop',
      'music.vocal-presence',
      'visual-director.significance',
    ]))
  })

  it('uses the shared Inspector projection with coherent groups and no preset-specific settings surface', () => {
    const plan = compileAfterhours()
    const state = new Cinema2ParameterState(plan.parameters)
    const design = createCinema2InspectorModel(plan, state.getSnapshot(), 'design')
    const react = createCinema2InspectorModel(plan, state.getSnapshot(), 'react')

    const designGroups = design.flatMap(section => section.groups.map(group => group.label))
    const reactGroups = react.flatMap(section => section.groups.map(group => group.label))
    const allControls = [...design, ...react]
      .flatMap(section => section.groups)
      .flatMap(group => group.controls)
      .map(control => control.definition.id)

    expect(designGroups).toEqual(expect.arrayContaining(['Color', 'Rig', 'Pattern', 'Motion', 'Atmosphere']))
    expect(reactGroups).toEqual(expect.arrayContaining(['Reactivity', 'Structure']))
    expect(allControls).toEqual(expect.arrayContaining(EXPECTED_USER_PARAMETER_IDS))
    expect(allControls).not.toContain(CINEMA2_AFTERHOURS_RESET_TRAILS_ID)
    expect(allControls).toContain(CINEMA2_AFTERHOURS_AUTO_PERFORMANCE_ID)
  })

  it('persists independently, accepts every enum/boundary, and resolves bound module state through the canonical target runtime', () => {
    const plan = compileAfterhours()
    const state = new Cinema2ParameterState(plan.parameters)

    for (const definition of plan.parameters.definitions) {
      if (definition.type !== 'trigger') {
        expect(state.getValue(definition.id), `fresh default for ${definition.id}`).toEqual(plan.parameters.authoredDefaults[definition.id])
      }
      if (definition.type === 'enum') {
        for (const option of definition.options ?? []) {
          expect(state.setPersistentValue(definition.id, option.value), `${definition.id}=${option.value}`).toMatchObject({ ok: true })
        }
      }
      if ((definition.type === 'float' || definition.type === 'integer') && definition.min != null && definition.max != null) {
        expect(state.setPersistentValue(definition.id, definition.min), `${definition.id}=min`).toMatchObject({ ok: true })
        expect(state.setPersistentValue(definition.id, definition.max), `${definition.id}=max`).toMatchObject({ ok: true })
      }
    }

    for (const symmetry of [false, true]) {
      for (const sideLasers of [false, true]) {
        for (const topLasers of [false, true]) {
          expect(state.setPersistentValue(CINEMA2_AFTERHOURS_SYMMETRY_ID, symmetry)).toMatchObject({ ok: true })
          expect(state.setPersistentValue(CINEMA2_AFTERHOURS_SIDE_LASERS_ID, sideLasers)).toMatchObject({ ok: true })
          expect(state.setPersistentValue(CINEMA2_AFTERHOURS_TOP_LASERS_ID, topLasers)).toMatchObject({ ok: true })
        }
      }
    }

    expect(state.setPersistentValue(CINEMA2_AFTERHOURS_PATTERN_ID, 'crossCanopy')).toMatchObject({ ok: true })
    expect(state.setPersistentValue(CINEMA2_AFTERHOURS_BEAM_COUNT_ID, 12)).toMatchObject({ ok: true })
    expect(state.setPersistentValue(CINEMA2_AFTERHOURS_AUTO_PERFORMANCE_ID, true)).toMatchObject({ ok: true })
    expect(JSON.parse(state.serialize()).presetId).toBe(CINEMA2_AFTERHOURS_PRESET_ID)

    const restored = new Cinema2ParameterState(plan.parameters)
    expect(restored.restore(state.serialize())).toMatchObject({ ok: true })
    expect(restored.getValue(CINEMA2_AFTERHOURS_PATTERN_ID)).toBe('crossCanopy')
    expect(restored.getValue(CINEMA2_AFTERHOURS_BEAM_COUNT_ID)).toBe(12)
    expect(restored.getValue(CINEMA2_AFTERHOURS_AUTO_PERFORMANCE_ID)).toBe(true)

    const resolver = new Cinema2FinalValueResolver(plan.targets, {
      resolveBaseValue: target => target.parameterId == null ? target.authoredBaseValue : restored.getValue(target.parameterId),
    })
    expect(resolver.resolve(targetFor(plan, 'module', CINEMA2_AFTERHOURS_MODULE_ID, 'pattern').id).value).toBe('crossCanopy')
    expect(resolver.resolve(targetFor(plan, 'module', CINEMA2_AFTERHOURS_MODULE_ID, 'beamCount').id).value).toBe(12)
    expect(resolver.resolve(targetFor(plan, 'module', CINEMA2_AFTERHOURS_MODULE_ID, 'autoPerformance').id).value).toBe(true)
  })

  it('authors one world-space depth layer and conservative perspective camera for the native 3D renderer', () => {
    const plan = compileAfterhours()
    expect(plan.scene.nodes.some(node => node.coordinateSpace === 'world' && node.moduleId === CINEMA2_AFTERHOURS_MODULE_ID)).toBe(true)
    expect(plan.manifest.layers).toEqual([
      expect.objectContaining({ role: 'world', depthPolicy: 'read-write' }),
    ])
    expect(plan.render.targets.some(target => target.descriptor.depthFormat === 'depth24')).toBe(true)
    expect(plan.render).toMatchObject({
      synthesized: false,
      intent: 'authored-render-graph',
      passOrder: ['afterhours-scene-pass', 'afterhours-trails-pass'],
      outputPassId: 'afterhours-trails-pass',
    })
    expect(plan.render.targets).toHaveLength(2)
    expect(plan.manifest.effects?.[0]).toMatchObject({
      id: 'afterhours-feedback-trails',
      typeId: 'feedback-trails',
      parameters: { mix: 0.12, persistence: 0.76 },
      actionBindings: { reset: { $ref: CINEMA2_AFTERHOURS_RESET_TRAILS_ID } },
    })
    const trailsPass = plan.render.passes.find(pass => pass.id === 'afterhours-trails-pass')
    expect(trailsPass?.inputs).toHaveLength(1)
    expect(trailsPass?.inputs[0]?.sourcePass.id).toBe('afterhours-scene-pass')
    expect(plan.manifest.cameras?.find(camera => camera.id === CINEMA2_AFTERHOURS_CAMERA_ID)).toMatchObject({
      projection: 'perspective',
      rig: { kind: 'static' },
      safety: {
        minPosition: [-1.6, 2.5, 17.4],
        maxPosition: [1.6, 4.2, 20.7],
        minFovDegrees: 44,
        maxFovDegrees: 56,
      },
    })
    expect(plan.manifest.defaults?.camera?.$ref).toBe(CINEMA2_AFTERHOURS_CAMERA_ID)
  })

  it('activates through the real production registry/runtime and instantiates the native module with the shared final camera/depth path', () => {
    const gl = createCinemaMockWebGL()
    let scheduledFrame: FrameRequestCallback | null = null
    const created = Cinema2Runtime.create(new FakeCanvas(gl) as unknown as HTMLCanvasElement, {
      presetId: CINEMA2_AFTERHOURS_PRESET_ID,
      requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
        scheduledFrame = callback
        return 1
      }),
      cancelAnimationFrame: vi.fn(),
      renderQuality: 'high',
    })
    expect(created.error).toBeNull()
    expect(created.runtime).not.toBeNull()
    if (!created.runtime) return

    expect(created.runtime.getCompiledPresetPlan().presetId).toBe(CINEMA2_AFTERHOURS_PRESET_ID)
    expect(created.runtime.getModuleRuntimeSnapshot().activeModuleCount).toBe(1)
    expect(created.runtime.getCameraRuntimeSnapshot()).toMatchObject({ activeCameraId: CINEMA2_AFTERHOURS_CAMERA_ID })
    expect(created.runtime.getCompiledPresetPlan().render.targets.some(target => target.descriptor.depthFormat === 'depth24')).toBe(true)

    created.runtime.resize({ width: 640, height: 360, dpr: 1 })
    created.runtime.start()
    expect(scheduledFrame).not.toBeNull()
    ;(scheduledFrame as FrameRequestCallback | null)?.(16)

    expect(created.runtime.getRenderGraphExecutorSnapshot()).toMatchObject({
      frameCount: 1,
      executedPassCount: 2,
      failedPassCount: 0,
    })
    expect(created.runtime.getHistoryServiceSnapshot()).toMatchObject({ activeBufferCount: 1, validBufferCount: 1 })
    expect(created.runtime.getEffectRuntimeSnapshot().effects).toEqual([expect.objectContaining({
      effectId: 'afterhours-feedback-trails',
      typeId: 'feedback-trails',
      status: 'active',
    })])

    const resetTarget = created.runtime.getCompiledPresetPlan().targets.targets.find(target => (
      target.channel === 'action' && target.parameterId === CINEMA2_AFTERHOURS_RESET_TRAILS_ID
    ))
    expect(resetTarget).toBeDefined()
    if (!resetTarget) throw new Error('Afterhours Trails reset action target was not compiled.')
    expect(created.runtime.getTargetResolver().dispatch(resetTarget.id, [{
      contributorId: 'afterhours-stage7-test',
      operation: 'action',
      eventId: 'afterhours-stage7-test:reset',
    }])).toMatchObject({ ok: true })
    expect(created.runtime.getHistoryServiceSnapshot()).toMatchObject({ validBufferCount: 0, lastResetReason: 'manual' })

    const cameraFrame = created.runtime.getCameraRuntimeSnapshot().camera
    const matrixCalls = (gl.uniformMatrix4fv as unknown as { mock: { calls: unknown[][] } }).mock.calls
    const uploadedMatrix = Array.from(matrixCalls[matrixCalls.length - 1]?.[2] as Float32Array)
    expect(uploadedMatrix).toHaveLength(16)
    for (let index = 0; index < 16; index += 1) {
      expect(uploadedMatrix[index]).toBeCloseTo(cameraFrame.viewProjectionMatrix[index] ?? 0, 5)
    }

    created.runtime.dispose()
  })

  it('executes the final first-party path from selection through audio/director choreography, planner, camera, render graph, trails, and native pixels', () => {
    const gl = createCinemaMockWebGL()
    let scheduledFrame: FrameRequestCallback | null = null
    const upstream = stage8MusicFrame()
    const transport = {
      sourcePresent: true,
      playing: true,
      analysisActive: true,
      paused: false,
      trackId: upstream.trackId,
      timeSec: upstream.timeSec,
    }
    const bridge = new Cinema2AudioIntelligenceBridge({
      getFrame: () => upstream,
      getPublicationMeta: () => ({
        sequence: upstream.frameId,
        publishedAtMs: upstream.timeSec * 1000,
        publisherId: 'afterhours-stage8-integration',
        kind: 'frame' as const,
      }),
    })
    const created = Cinema2Runtime.create(new FakeCanvas(gl) as unknown as HTMLCanvasElement, {
      presetId: CINEMA2_AFTERHOURS_PRESET_ID,
      audioIntelligenceBridge: bridge,
      transportSource: { getState: () => transport },
      requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
        scheduledFrame = callback
        return 1
      }),
      cancelAnimationFrame: vi.fn(),
      renderQuality: 'high',
    })
    expect(created.error).toBeNull()
    if (!created.runtime) return

    const state = created.runtime.getParameterState()
    expect(state.setPersistentValue(CINEMA2_AFTERHOURS_PATTERN_ID, 'wideFan')).toMatchObject({ ok: true })
    expect(state.setPersistentValue(CINEMA2_AFTERHOURS_AUTO_PERFORMANCE_ID, true)).toMatchObject({ ok: true })
    expect(state.setPersistentValue(CINEMA2_AFTERHOURS_SIDE_LASERS_ID, false)).toMatchObject({ ok: true })
    expect(state.setPersistentValue(CINEMA2_AFTERHOURS_TOP_LASERS_ID, false)).toMatchObject({ ok: true })
    expect(state.setPersistentValue(CINEMA2_AFTERHOURS_BEAM_COUNT_ID, 7)).toMatchObject({ ok: true })

    created.runtime.resize({ width: 640, height: 360, dpr: 1 })
    created.runtime.start()
    expect(scheduledFrame).not.toBeNull()
    ;(scheduledFrame as FrameRequestCallback | null)?.(16)

    const plan = created.runtime.getCompiledPresetPlan()
    expect(plan.presetId).toBe(CINEMA2_AFTERHOURS_PRESET_ID)
    expect(created.runtime.getModuleRuntimeSnapshot().activeModuleCount).toBe(1)
    expect(created.runtime.getCameraRuntimeSnapshot().activeCameraId).toBe(CINEMA2_AFTERHOURS_CAMERA_ID)
    expect(created.runtime.getTargetResolver().resolve(targetFor(plan, 'module', CINEMA2_AFTERHOURS_MODULE_ID, 'directorImpact').id).value).toBeGreaterThan(0)
    expect(created.runtime.getTargetResolver().resolve(targetFor(plan, 'module', CINEMA2_AFTERHOURS_MODULE_ID, 'kickAccent').id).value).toBeGreaterThan(0)
    expect(created.runtime.getTargetResolver().resolve(targetFor(plan, 'module', CINEMA2_AFTERHOURS_MODULE_ID, 'snareAccent').id).value).toBeGreaterThan(0)
    expect(created.runtime.getRenderGraphExecutorSnapshot()).toMatchObject({ frameCount: 1, executedPassCount: 2, failedPassCount: 0 })
    expect(created.runtime.getHistoryServiceSnapshot()).toMatchObject({ activeBufferCount: 1, validBufferCount: 1 })
    expect(created.runtime.getEffectRuntimeSnapshot().effects).toEqual([expect.objectContaining({
      effectId: 'afterhours-feedback-trails',
      typeId: 'feedback-trails',
      status: 'active',
    })])
    expect(lastInstancedDrawCount(gl)).toBeGreaterThan(0)
    expect(lastInstancedDrawCount(gl)).toBeLessThanOrEqual(7)

    expect(state.getValue(CINEMA2_AFTERHOURS_PATTERN_ID)).toBe('wideFan')
    expect(state.getValue(CINEMA2_AFTERHOURS_SIDE_LASERS_ID)).toBe(false)
    expect(state.getValue(CINEMA2_AFTERHOURS_TOP_LASERS_ID)).toBe(false)
    expect(state.getValue(CINEMA2_AFTERHOURS_BEAM_COUNT_ID)).toBe(7)

    created.runtime.dispose()
  })

  it('keeps legacy Afterhours independent from the Cinema 2.0 keeper identity and native module registration', () => {
    expect(afterhoursWorldDefinition).toMatchObject({ id: 'afterhours', label: 'Afterhours', backend: 'webgl2' })
    expect(afterhoursWorldDefinition.id).not.toBe(CINEMA2_AFTERHOURS_PRESET_ID)
    expect(CINEMA2_AFTERHOURS_PRESET_MANIFEST.modules?.[0]).toMatchObject({
      id: CINEMA2_AFTERHOURS_MODULE_ID,
      typeId: CINEMA2_AFTERHOURS_NATIVE_MODULE_TYPE_ID,
    })
  })

  it('keeps feedback history clean while audio is absent or paused and preserves engine lifecycle resets', () => {
    const gl = createCinemaMockWebGL()
    let scheduledFrame: FrameRequestCallback | null = null
    const transport = {
      sourcePresent: false,
      playing: false,
      analysisActive: false,
      paused: false,
      trackId: null as string | null,
      timeSec: 0,
    }
    const created = Cinema2Runtime.create(new FakeCanvas(gl) as unknown as HTMLCanvasElement, {
      presetId: CINEMA2_AFTERHOURS_PRESET_ID,
      requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
        scheduledFrame = callback
        return 1
      }),
      cancelAnimationFrame: vi.fn(),
      transportSource: { getState: () => transport },
      renderQuality: 'high',
    })
    expect(created.error).toBeNull()
    if (!created.runtime) return

    const runFrame = (timestampMs: number) => {
      expect(scheduledFrame).not.toBeNull()
      ;(scheduledFrame as FrameRequestCallback | null)?.(timestampMs)
    }

    created.runtime.resize({ width: 640, height: 360, dpr: 1 })
    created.runtime.start()
    runFrame(16)
    expect(created.runtime.getHistoryServiceSnapshot()).toMatchObject({
      activeBufferCount: 0,
      validBufferCount: 0,
      lastResetReason: 'resize',
    })

    transport.sourcePresent = true
    transport.playing = true
    transport.analysisActive = true
    transport.trackId = 'track-a'
    transport.timeSec = 1
    runFrame(32)
    expect(created.runtime.getHistoryServiceSnapshot()).toMatchObject({ activeBufferCount: 1, validBufferCount: 1 })

    transport.playing = false
    transport.paused = true
    transport.timeSec = 1.25
    runFrame(48)
    const pausedSnapshot = created.runtime.getHistoryServiceSnapshot()
    expect(pausedSnapshot).toMatchObject({ activeBufferCount: 1, validBufferCount: 0, lastResetReason: 'transport-inactive' })
    runFrame(64)
    expect(created.runtime.getHistoryServiceSnapshot().resetCount).toBe(pausedSnapshot.resetCount)

    transport.playing = true
    transport.paused = false
    transport.timeSec = 1.5
    runFrame(80)
    expect(created.runtime.getHistoryServiceSnapshot()).toMatchObject({ activeBufferCount: 1, validBufferCount: 1 })

    transport.sourcePresent = false
    transport.playing = false
    transport.analysisActive = false
    transport.trackId = null
    transport.timeSec = 0
    runFrame(96)
    expect(created.runtime.getHistoryServiceSnapshot()).toMatchObject({ validBufferCount: 0, lastResetReason: 'deactivation' })

    created.runtime.dispose()
  })

  it('keeps the engine-owned trails pass valid across all eight topology families', () => {
    const gl = createCinemaMockWebGL()
    let scheduledFrame: FrameRequestCallback | null = null
    const created = Cinema2Runtime.create(new FakeCanvas(gl) as unknown as HTMLCanvasElement, {
      presetId: CINEMA2_AFTERHOURS_PRESET_ID,
      requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
        scheduledFrame = callback
        return 1
      }),
      cancelAnimationFrame: vi.fn(),
      renderQuality: 'high',
    })
    expect(created.error).toBeNull()
    if (!created.runtime) return

    created.runtime.resize({ width: 640, height: 360, dpr: 1 })
    created.runtime.start()
    let timestampMs = 16
    for (const topologyId of CINEMA2_AFTERHOURS_TOPOLOGY_IDS) {
      expect(created.runtime.getParameterState().setPersistentValue(CINEMA2_AFTERHOURS_PATTERN_ID, topologyId)).toMatchObject({ ok: true })
      expect(scheduledFrame).not.toBeNull()
      ;(scheduledFrame as FrameRequestCallback | null)?.(timestampMs)
      timestampMs += 16
      expect(created.runtime.getHistoryServiceSnapshot()).toMatchObject({ activeBufferCount: 1, validBufferCount: 1 })
      expect(created.runtime.getRenderGraphExecutorSnapshot().failedPassCount).toBe(0)
    }
    expect(created.runtime.getRenderGraphExecutorSnapshot()).toMatchObject({
      frameCount: CINEMA2_AFTERHOURS_TOPOLOGY_IDS.length,
      executedPassCount: CINEMA2_AFTERHOURS_TOPOLOGY_IDS.length * 2,
    })

    created.runtime.dispose()
  })

})
