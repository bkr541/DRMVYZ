import { describe, expect, it, vi } from 'vitest'
import {
  CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE,
  CINEMA_CINEMATIC_WORLD_COLOR_OUTPUT_PORT_ID,
  CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION,
  CINEMA_FOUNDATION_INPUT_PORT_ID,
  CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
  CINEMA_FOUNDATION_PERSISTED_DEFINITIONS,
  CINEMA_FOUNDATION_RUNTIME_REGISTRY,
  CINEMA_PERFORMANCE_ACTION_SCHEMA_VERSION,
  CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION,
  CINEMA_PERFORMANCE_STATE_ACTION_IDS,
  CINEMA_PRODUCTION_RUNTIME_REGISTRY,
  cinemaCinematicResetReason,
  cinemaCinematicWorldTypeId,
  createCinemaCinematicWorldAdapterBundle,
  createCinemaCinematicWorldComposition,
  createCinemaFoundationPersistedState,
  type CinemaActionId,
  type CinemaCompositionDefinition,
  type CinemaEventId,
  type CinemaPerformanceRuleId,
} from '..'
import { cinemaStableId, type CinemaCompositionId } from '../CinemaIdentifiers'
import type { CinemaFrameContext } from '../CinemaRendererContracts'
import { createCinemaRuntimeNodeRegistry } from '../CinemaRuntimeNodeRegistry'
import { CinemaGraphExecutor } from '../runtime/CinemaGraphExecutor'
import { CinemaRenderTargetPool } from '../runtime/CinemaRenderTargetPool'
import { CinemaTextureManager } from '../runtime/CinemaTextureManager'
import { CinemaWebGLRenderServiceImpl } from '../runtime/CinemaWebGLRenderService'
import { cinematicWorldRendererRegistry } from '../../react/renderers/CinematicPortalRenderer'
import { cinematicWorldDefinitions } from '../../react/renderers/cinematic/worlds'
import { createCinemaMockWebGL } from './CinemaWebGLTestUtils'

describe('Cinema Cinematic World adapters', () => {
  it('maps Stage 12 stateful commands through the shared reset contract', () => {
    expect(cinemaCinematicResetReason(CINEMA_PERFORMANCE_STATE_ACTION_IDS.resetNodeState)).toBe('manualReset')
    expect(cinemaCinematicResetReason(CINEMA_PERFORMANCE_STATE_ACTION_IDS.resetFeedback)).toBe('manualReset')
    expect(cinemaCinematicResetReason(CINEMA_PERFORMANCE_STATE_ACTION_IDS.reseedSimulation)).toBe('manualReset')
    expect(cinemaCinematicResetReason(CINEMA_PERFORMANCE_STATE_ACTION_IDS.clearTrailHistory)).toBe('manualReset')
  })

  it('maps every built-in WebGL world and legacyPortal into stable Cinema procedural nodes', () => {
    expect(CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.entries).toHaveLength(cinematicWorldDefinitions.length + 1)

    for (const definition of cinematicWorldDefinitions) {
      const entry = CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.entries.find(candidate => candidate.worldId === definition.id)
      expect(entry).toBeDefined()
      expect(entry?.typeId).toBe(cinemaCinematicWorldTypeId(definition.id))
      expect(entry?.backend).toBe('webgl2')
      expect(entry?.definition.family).toBe('procedural')
      expect(entry?.definition.outputPorts[0]?.id).toBe(CINEMA_CINEMATIC_WORLD_COLOR_OUTPUT_PORT_ID)
      expect(entry?.definition.metadata?.worldId).toBe(definition.id)
      expect(entry?.definition.metadata?.standaloneEngineRetained).toBe(true)
      expect(entry?.definition.metadata?.legacyCapabilities).toEqual(definition.capabilities)
      expect(entry?.definition.metadata?.direction).toEqual(JSON.parse(JSON.stringify(definition.direction ?? null)))
      expect(entry?.definition.parameters.length).toBeGreaterThan(20)
      expect(Object.isFrozen(definition.capabilities)).toBe(false)
      if (definition.direction) expect(Object.isFrozen(definition.direction)).toBe(false)
    }

    const legacy = CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.entries.find(entry => entry.worldId === 'legacyPortal')
    expect(legacy?.backend).toBe('canvas2d')
    expect(legacy?.definition.capabilities.canvas2d.compatibility).toBe('raster-upload')
    expect(legacy?.definition.capabilities.requires).toEqual({ webgl2: true, canvas2d: true })
  })

  it('retains Reactive Constellation as a specialized deterministic procedural plugin', () => {
    const entry = CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.entries.find(candidate => candidate.worldId === 'reactiveConstellation')
    expect(entry?.definition.family).toBe('procedural')
    expect(entry?.definition.metadata?.specializedProceduralRenderer).toBe(true)
    expect(entry?.definition.metadata?.legacyCapabilities).toMatchObject({
      supportsGeometryPasses: true,
      supportsFullscreenPasses: false,
    })
    expect(entry?.definition.cost.cpu).toBe('high')
    expect(entry?.definition.cost.gpu).toBe('high')
    expect(entry?.definition.output.hasDepth).toBe(true)
    expect(entry?.definition.seekPolicy).toEqual({ mode: 'reset-at-position', seedScope: 'musical-position' })
    expect(cinemaCinematicResetReason('cinema.reset.seek')).toBe('seek')
    expect(cinemaCinematicResetReason('cinema.reset.track-change')).toBe('trackReplacement')
    expect(cinemaCinematicResetReason('cinema.reset.context-restore')).toBe('contextRestored')
  })

  it('executes and deterministically resets the specialized Reactive Constellation renderer', () => {
    const state = createCinemaFoundationPersistedState()
    const composition = createCinemaCinematicWorldComposition(
      'reactiveConstellation',
      CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
      CINEMA_FOUNDATION_INPUT_PORT_ID,
      { compositionId: cinemaStableId<CinemaCompositionId>('reactive-constellation-adapter-test', 'composition') },
    )
    const first = createExecutorHarness(CINEMA_PRODUCTION_RUNTIME_REGISTRY, state.definitions, false)
    first.executor.setGraph({ composition, instance: null, definitions: state.definitions })

    expect(first.executor.render(frame(0))).toBe(true)
    const initialResources = {
      programs: first.gl.__calls.createdPrograms,
      buffers: first.gl.__calls.createdBuffers,
      vertexArrays: first.gl.__calls.createdVertexArrays,
      draws: first.gl.__calls.drawInstancedCount,
    }
    expect(initialResources.buffers).toBeGreaterThan(0)
    expect(initialResources.vertexArrays).toBeGreaterThan(0)
    expect(initialResources.draws).toBeGreaterThan(0)

    expect(first.executor.render(frame(1, true))).toBe(true)
    expect(first.gl.__calls.createdPrograms).toBe(initialResources.programs)
    expect(first.gl.__calls.createdBuffers).toBe(initialResources.buffers)
    expect(first.gl.__calls.createdVertexArrays).toBe(initialResources.vertexArrays)
    expect(first.executor.getSnapshot().failedNodeCount).toBe(0)
    expect(first.diagnostics).not.toContain('CINEMA_NODE_RENDER_FAILED')

    const second = createExecutorHarness(CINEMA_PRODUCTION_RUNTIME_REGISTRY, state.definitions, false)
    second.executor.setGraph({ composition, instance: null, definitions: state.definitions })
    expect(second.executor.render(frame(0))).toBe(true)
    expect(second.executor.render(frame(1, true))).toBe(true)
    expect(second.gl.__calls.drawInstancedCount).toBe(first.gl.__calls.drawInstancedCount)
    expect(second.gl.__calls.createdBuffers).toBe(first.gl.__calls.createdBuffers)
    expect(second.gl.__calls.createdVertexArrays).toBe(first.gl.__calls.createdVertexArrays)

    first.dispose()
    second.dispose()
    expect(first.gl.__calls.deletedBuffers).toBe(first.gl.__calls.createdBuffers)
    expect(first.gl.__calls.deletedVertexArrays).toBe(first.gl.__calls.createdVertexArrays)
    expect(second.gl.__calls.deletedBuffers).toBe(second.gl.__calls.createdBuffers)
    expect(second.gl.__calls.deletedVertexArrays).toBe(second.gl.__calls.createdVertexArrays)
  })

  it('dispatches Stage 12 reseed commands through an adapter-backed cinematic node', () => {
    const state = createCinemaFoundationPersistedState()
    const base = createCinemaCinematicWorldComposition(
      'reactiveConstellation',
      CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
      CINEMA_FOUNDATION_INPUT_PORT_ID,
      { compositionId: cinemaStableId<CinemaCompositionId>('constellation-performance-reseed-test', 'composition') },
    )
    const cinematicNode = base.nodes.find(node => node.family === 'procedural')
    expect(cinematicNode).toBeDefined()
    if (!cinematicNode) return
    const composition: CinemaCompositionDefinition = {
      ...base,
      revision: base.revision + 1,
      performanceRules: [{
        schemaVersion: CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION,
        id: 'constellation-drop-reseed-rule' as CinemaPerformanceRuleId,
        label: 'Constellation Drop Reseed',
        priority: 100,
        enabled: true,
        condition: { schemaVersion: CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION, event: 'dropStart' },
        actions: [{
          schemaVersion: CINEMA_PERFORMANCE_ACTION_SCHEMA_VERSION,
          id: 'constellation-reseed' as CinemaActionId,
          type: 'reseedSimulation',
          nodeId: cinematicNode.id,
        }],
      }],
    }
    const harness = createExecutorHarness(CINEMA_PRODUCTION_RUNTIME_REGISTRY, state.definitions, false)
    harness.executor.setGraph({ composition, instance: null, definitions: state.definitions })

    expect(harness.executor.render(frame(0, false, true))).toBe(true)
    expect(harness.executor.getSnapshot()).toMatchObject({
      activePerformanceRuleCount: 1,
      failedNodeCount: 0,
    })
    expect(harness.diagnostics).not.toContain('CINEMA_NODE_RESET_FAILED')
    expect(harness.diagnostics).not.toContain('CINEMA_NODE_RENDER_FAILED')
    harness.dispose()
  })

  it('renders a representative WebGL world through the production Cinema graph executor', () => {
    const state = createCinemaFoundationPersistedState()
    const harness = createExecutorHarness(CINEMA_PRODUCTION_RUNTIME_REGISTRY, state.definitions, false)
    harness.executor.setGraph({
      composition: CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION,
      instance: null,
      definitions: state.definitions,
    })

    expect(harness.executor.render(frame(0))).toBe(true)
    expect(harness.gl.__calls.drawCount).toBeGreaterThanOrEqual(2)
    expect(harness.targets.getDiagnostics().activeLeaseCount).toBe(0)
    expect(harness.diagnostics).not.toContain('CINEMA_NODE_INITIALIZE_FAILED')
    expect(harness.diagnostics).not.toContain('CINEMA_NODE_RENDER_FAILED')
    expect(harness.executor.getSnapshot().safeOutputActive).toBe(false)

    const programsBeforeReset = harness.gl.__calls.createdPrograms
    expect(harness.executor.render(frame(1, true))).toBe(true)
    expect(harness.gl.__calls.createdPrograms).toBe(programsBeforeReset)
    expect(harness.executor.getSnapshot().failedNodeCount).toBe(0)
    harness.dispose()
  })

  it('renders legacyPortal through offscreen Canvas2D upload without creating another animation loop', () => {
    const legacyDefinition = cinematicWorldRendererRegistry.resolve('legacyPortal')
    if (!legacyDefinition || legacyDefinition.backend !== 'canvas2d') throw new Error('legacyPortal definition unavailable')
    const originalRequestAnimationFrame = globalThis.requestAnimationFrame
    const requestAnimationFrameSpy = vi.fn()
    Object.defineProperty(globalThis, 'requestAnimationFrame', {
      configurable: true,
      writable: true,
      value: requestAnimationFrameSpy,
    })
    const bundle = createCinemaCinematicWorldAdapterBundle({
      webglDefinitions: [],
      legacyDefinition,
      createCanvas: createCanvas2DStub,
    })
    const runtimeRegistry = createCinemaRuntimeNodeRegistry([
      ...CINEMA_FOUNDATION_RUNTIME_REGISTRY.list(),
      ...bundle.runtimeRegistrations,
    ]).registry
    const definitions = [...CINEMA_FOUNDATION_PERSISTED_DEFINITIONS, ...bundle.persistedDefinitions]
    const composition = createCinemaCinematicWorldComposition(
      'legacyPortal',
      CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
      CINEMA_FOUNDATION_INPUT_PORT_ID,
      { compositionId: cinemaStableId<CinemaCompositionId>('legacy-portal-adapter-test', 'composition') },
    )
    const harness = createExecutorHarness(runtimeRegistry, definitions, true)
    harness.executor.setGraph({ composition, instance: null, definitions })

    expect(harness.executor.render(frame(0))).toBe(true)
    expect(harness.gl.texImage2D).toHaveBeenCalled()
    expect(harness.gl.pixelStorei).toHaveBeenCalledWith(harness.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
    expect(harness.gl.__calls.drawCount).toBeGreaterThanOrEqual(2)
    expect(requestAnimationFrameSpy).not.toHaveBeenCalled()
    expect(harness.diagnostics).not.toContain('CINEMA_NODE_RENDER_FAILED')

    harness.dispose()
    if (originalRequestAnimationFrame) {
      Object.defineProperty(globalThis, 'requestAnimationFrame', {
        configurable: true,
        writable: true,
        value: originalRequestAnimationFrame,
      })
    } else {
      Reflect.deleteProperty(globalThis, 'requestAnimationFrame')
    }
  })

  it('fails closed with structured diagnostics when the Canvas2D compatibility context is unavailable', () => {
    const legacyDefinition = cinematicWorldRendererRegistry.resolve('legacyPortal')
    if (!legacyDefinition || legacyDefinition.backend !== 'canvas2d') throw new Error('legacyPortal definition unavailable')
    const bundle = createCinemaCinematicWorldAdapterBundle({
      webglDefinitions: [],
      legacyDefinition,
      createCanvas: () => ({
        width: 1,
        height: 1,
        getContext: vi.fn(() => null),
      } as unknown as HTMLCanvasElement),
    })
    const runtimeRegistry = createCinemaRuntimeNodeRegistry([
      ...CINEMA_FOUNDATION_RUNTIME_REGISTRY.list(),
      ...bundle.runtimeRegistrations,
    ]).registry
    const definitions = [...CINEMA_FOUNDATION_PERSISTED_DEFINITIONS, ...bundle.persistedDefinitions]
    const composition = createCinemaCinematicWorldComposition(
      'legacyPortal',
      CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
      CINEMA_FOUNDATION_INPUT_PORT_ID,
      { compositionId: cinemaStableId<CinemaCompositionId>('legacy-portal-missing-context-test', 'composition') },
    )
    const harness = createExecutorHarness(runtimeRegistry, definitions, true)
    harness.executor.setGraph({ composition, instance: null, definitions })

    expect(harness.executor.render(frame(0))).toBe(true)
    expect(harness.diagnostics).toContain('CINEMA_CAPABILITY_UNAVAILABLE')
    expect(harness.diagnostics).toContain('CINEMA_NODE_INITIALIZE_FAILED')
    expect(harness.executor.getSnapshot().safeOutputActive).toBe(true)
    expect(harness.targets.getDiagnostics().activeLeaseCount).toBe(0)
    harness.dispose()
  })

  it('registers Stage 10 built-ins through the canonical persisted and runtime production boundaries', () => {
    const state = createCinemaFoundationPersistedState()
    expect(state.compositions.some(composition => composition.id === CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION.id)).toBe(true)
    expect(state.editorMetadata.cinematicWorldAdapterVersion).toBe(1)
    expect(state.editorMetadata.canvas2dAdapterVersion).toBe(1)
    for (const entry of CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.entries) {
      expect(state.definitions.some(definition => definition.id === entry.typeId)).toBe(true)
      expect(CINEMA_PRODUCTION_RUNTIME_REGISTRY.hasPlugin(entry.pluginId)).toBe(true)
    }
  })
})

function createExecutorHarness(
  runtimeRegistry: ReturnType<typeof createCinemaRuntimeNodeRegistry>['registry'],
  _definitions: ReturnType<typeof createCinemaFoundationPersistedState>['definitions'],
  canvas2d: boolean,
) {
  const gl = createCinemaMockWebGL()
  const diagnostics: string[] = []
  const sink = { report: (diagnostic: { code: string }) => diagnostics.push(diagnostic.code) }
  const viewport = { width: 320, height: 180, dpr: 1 }
  const textures = new CinemaTextureManager()
  const targets = new CinemaRenderTargetPool(gl, textures, viewport, sink)
  const webgl = new CinemaWebGLRenderServiceImpl(gl, targets, textures)
  const executor = new CinemaGraphExecutor({
    runtimeRegistry,
    platform: {
      webgl2: true,
      canvas2d,
      floatColorTargets: true,
      floatBlending: true,
      textureArrays: true,
      instancing: true,
      timerQueries: false,
      maximumTextureSize: 8192,
      maximumTextureUnits: 16,
    },
    targets,
    textures,
    webgl,
    diagnostics: sink,
  })
  executor.resize({ width: 1, height: 1, dpr: 1 }, viewport)
  return {
    gl,
    diagnostics,
    targets,
    executor,
    dispose() {
      executor.dispose()
      targets.dispose()
      textures.dispose()
    },
  }
}

function createCanvas2DStub(): HTMLCanvasElement {
  const canvas = { width: 1, height: 1 } as HTMLCanvasElement
  const gradient = { addColorStop: vi.fn() }
  const known: Record<string, unknown> = {
    canvas,
    createLinearGradient: vi.fn(() => gradient),
    createRadialGradient: vi.fn(() => gradient),
  }
  const context = new Proxy(known, {
    get(target, property) {
      if (property in target) return target[String(property)]
      const value = vi.fn()
      target[String(property)] = value
      return value
    },
    set(target, property, value) {
      target[String(property)] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
  Object.assign(canvas, { getContext: vi.fn(() => context) })
  return canvas
}

function frame(generation: number, reset = false, dropStart = false): Readonly<CinemaFrameContext> {
  const clock = (spanBeats: number) => ({ available: true, spanBeats, index: 0, phase: 0.25, hit: false, eventId: null })
  return {
    version: 1,
    viewport: { width: 320, height: 180, dpr: 1 },
    timing: {
      frameIndex: generation,
      elapsedTimeSec: generation / 60,
      deltaTimeSec: 1 / 60,
      seeds: { composition: 1, track: 2, musicalPosition: 3, event: 4 },
    },
    transport: {
      trackId: 'stage-10-adapter-test',
      audioTimeSec: generation / 60,
      durationSec: 60,
      playing: true,
      paused: false,
      seeking: reset,
      looped: false,
      visibilitySuspended: false,
      discontinuity: reset,
      discontinuityReasons: reset ? ['seek'] : [],
      reset: {
        required: reset,
        reconstruct: reset,
        generation,
        reasons: reset ? ['seek'] : [],
        actionIds: reset ? ['cinema.reset.seek'] : [],
        identity: reset ? `seek-${generation}` : null,
      },
    },
    audio: {
      available: true,
      volume: 0.7,
      rms: 0.6,
      energy: 0.65,
      bass: 0.8,
      mid: 0.5,
      high: 0.4,
      sub: 0.75,
      centroid: 0.5,
      flux: 0.3,
      harmonicity: 0.5,
      complexity: 0.4,
      tension: 0.3,
      buildProgress: 0.2,
      dropImpact: dropStart ? 1 : 0,
      vocalPresence: 0.1,
      fft: new Uint8Array([0, 64, 128, 255]),
      waveform: new Uint8Array([128, 160, 96, 128]),
    },
    music: {
      available: true,
      source: 'music-intelligence',
      bpm: 150,
      beatIndex: generation,
      beatPhase: 0.25,
      beatInBar: generation % 4,
      barIndex: Math.floor(generation / 4),
      phraseIndex: 0,
      sectionId: 'verse-1',
      sectionType: 'verse',
      sectionProgress: 0.2,
      clocks: {
        beat: false,
        beat2: false,
        beat4: false,
        bar: false,
        bar4: false,
        bar8: false,
        phrase: false,
        states: {
          beat: clock(1),
          beat2: clock(2),
          beat4: clock(4),
          bar: clock(4),
          bar4: clock(16),
          bar8: clock(32),
          phrase: clock(32),
        },
      },
    },
    impulses: {
      beat: generation === 0,
      downbeat: generation === 0,
      kick: generation === 0,
      snare: false,
      transient: generation === 0,
      sectionStart: dropStart,
      dropStart,
      lyricCue: false,
      lyricWord: false,
      phrase4: false,
      phrase8: false,
      eventIds: {
        beat: null,
        downbeat: null,
        kick: null,
        snare: null,
        transient: null,
        sectionStart: dropStart ? 'music:drop-section' as CinemaEventId : null,
        dropStart: dropStart ? 'music:drop-section' as CinemaEventId : null,
        lyricCue: null,
        lyricWord: null,
        phrase4: null,
        phrase8: null,
      },
    },
    lyrics: {
      available: false,
      sourceIdentity: null,
      lineId: null,
      lineText: null,
      wordId: null,
      wordText: null,
      lineProgress: 0,
      wordProgress: 0,
      vocalsActive: false,
    },
    performance: { actionIds: [], toggleStates: {} },
    brand: { available: false, colors: {} },
    capabilities: {
      analyser: true,
      musicIntelligence: true,
      beatGrid: true,
      authoritativeSections: true,
      lyrics: false,
      brandKit: false,
      sharedPerformance: true,
      mediaAssets: false,
    },
    activeCameraId: null,
    camera: null,
  }
}
