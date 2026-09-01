/** @vitest-environment jsdom */

import type * as opentype from 'opentype.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CINEMA_3D_OBJECT_PARAMETER_CAPABILITIES,
  CINEMA_3D_OBJECT_PARAMETER_IDS,
  CINEMA_3D_OBJECT_PARAMETER_SCHEMAS,
  createDefaultCinema3DObjectDefinition,
  hydrateCinema3DObjectDefinition,
  serializeCinema3DObjectDefinition,
} from '../Cinema3DObjectState'
import { CINEMA_CAMERA_PARAMETER_IDS } from '../CinemaCameraRuntime'
import type { Cinema3DObjectRuntime } from '../Cinema3DObjectRuntime'
import {
  CINEMA_COMPOSITION_SCHEMA_ID,
  CINEMA_COMPOSITION_SCHEMA_VERSION,
  type CinemaCompositionDefinition,
  type CinemaModulationRouteDefinition,
} from '../CinemaDomain'
import {
  CINEMA_FOUNDATION_COLOR_OUTPUT_PORT_ID,
  CINEMA_FOUNDATION_GRADIENT_DEFINITION,
  CINEMA_FOUNDATION_INPUT_PORT_ID,
  CINEMA_FOUNDATION_OUTPUT_PLUGIN_ID,
  CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
  CINEMA_FOUNDATION_RUNTIME_REGISTRY,
  createCinemaFoundationPersistedState,
} from '../CinemaFoundation'
import {
  cinemaNamespacedId,
  cinemaStableId,
  createCinemaParameterPath,
  type CinemaCameraId,
  type CinemaCompositionId,
  type CinemaConnectionId,
  type CinemaEventId,
  type CinemaModulationRouteId,
  type CinemaNodeId,
  type CinemaNodeTypeId,
  type CinemaRendererPluginId,
} from '../CinemaIdentifiers'
import { CINEMA_MODULATION_SOURCE_IDS } from '../CinemaModulationSources'
import { validateCinemaModulationRoutes } from '../CinemaModulationRuntime'
import { createCinemaNodeDefinitionRegistry } from '../CinemaNodeRegistry'
import {
  normalizeCinemaPersistedState,
  snapshotCinemaPersistedState,
  type CinemaPersistedDefinition,
  type CinemaPersistedState,
} from '../CinemaPersistence'
import type { CinemaFrameContext, CinemaNodePlugin, CinemaNodeTypeDefinition } from '../CinemaRendererContracts'
import { createCinemaRuntimeNodeRegistry } from '../CinemaRuntimeNodeRegistry'
import { CinemaRuntime } from '../runtime/CinemaRuntime'
import { createCinemaMockWebGL } from './CinemaWebGLTestUtils'

const OBJECT_TYPE_ID = cinemaNamespacedId<CinemaNodeTypeId>('drmvyz.cinema.generator.stage6-object-modulation', 'node type')
const OBJECT_PLUGIN_ID = cinemaNamespacedId<CinemaRendererPluginId>('drmvyz.cinema.renderer.stage6-object-modulation', 'renderer plugin')
const OBJECT_NODE_ID = cinemaStableId<CinemaNodeId>('stage6-object-modulation-node', 'node')
const OUTPUT_NODE_ID = cinemaStableId<CinemaNodeId>('stage6-object-modulation-output', 'node')
const CAMERA_ID = cinemaStableId<CinemaCameraId>('stage6-object-modulation-camera', 'camera')
const EMISSIVE_PATH = createCinemaParameterPath('nodes', CINEMA_3D_OBJECT_PARAMETER_IDS.emissiveIntensity, OBJECT_NODE_ID)
const EXTRUSION_PATH = createCinemaParameterPath('nodes', CINEMA_3D_OBJECT_PARAMETER_IDS.extrusionDepth, OBJECT_NODE_ID)

const OBJECT_DEFINITION: Readonly<CinemaNodeTypeDefinition> = Object.freeze({
  ...CINEMA_FOUNDATION_GRADIENT_DEFINITION,
  typeId: OBJECT_TYPE_ID,
  label: 'Stage 6 Object Modulation',
  description: undefined,
  parameters: CINEMA_3D_OBJECT_PARAMETER_SCHEMAS,
  parameterCapabilities: CINEMA_3D_OBJECT_PARAMETER_CAPABILITIES,
  capabilities: {
    ...CINEMA_FOUNDATION_GRADIENT_DEFINITION.capabilities,
    camera: {
      mode: 'uniformCamera' as const,
      controls: ['position', 'rotation', 'target', 'fov', 'roll', 'near', 'far'] as const,
      autoDirector: false,
    },
  },
  output: { ...CINEMA_FOUNDATION_GRADIENT_DEFINITION.output, hasDepth: true, alphaMode: 'opaque' as const },
})

const AUTHORED_OBJECT = {
  ...createDefaultCinema3DObjectDefinition(),
  source: { type: 'text' as const, text: 'O', fontIdentity: 'stage6-font', font: null },
  geometry: { ...createDefaultCinema3DObjectDefinition().geometry, extrusionDepth: 0.35 },
  appearance: { ...createDefaultCinema3DObjectDefinition().appearance, emissiveIntensity: 0.1 },
}

interface RenderedObjectFrame {
  emissiveIntensity: number
  extrusionDepth: number
  meshKey: string | null
  invalidation: string
}

const renderedFrames: RenderedObjectFrame[] = []

const objectPlugin: CinemaNodePlugin = {
  definition: OBJECT_DEFINITION,
  createNode: node => {
    let object: Cinema3DObjectRuntime | null = null
    return {
      nodeId: node.id,
      typeId: node.typeId,
      initialize(context) {
        object = context.webgl.objectInstances.createObject(hydrateCinema3DObjectDefinition(node.parameterValues))
        const prepared = object.prepareText({ font: productionProofFont(), fontRevision: 1 })
        if (prepared.status !== 'ready') throw new Error('Stage 6 modulation proof object did not prepare.')
      },
      resize() {},
      render(context) {
        if (!object) return
        const invalidation = object.setResolvedParameterValues(context.values)
        const snapshot = object.getSnapshot()
        renderedFrames.push({
          emissiveIntensity: context.values[CINEMA_3D_OBJECT_PARAMETER_IDS.emissiveIntensity] as number,
          extrusionDepth: context.values[CINEMA_3D_OBJECT_PARAMETER_IDS.extrusionDepth] as number,
          meshKey: snapshot.meshKey,
          invalidation,
        })
        if (!context.target) return
        context.webgl.bindTarget(context.target)
        context.webgl.resetState()
        object.draw(context.viewport, context.frame.camera)
      },
      reset() {},
      dispose() {
        object?.dispose()
        object = null
      },
    }
  },
}

afterEach(() => {
  renderedFrames.length = 0
  vi.restoreAllMocks()
})

describe('Cinema reusable 3D object audio modulation integration', () => {
  it('drives live object material/depth values through the production modulation path without rebuilding mesh topology', () => {
    const canvas = document.createElement('canvas')
    const gl = createCinemaMockWebGL()
    vi.spyOn(canvas, 'getContext').mockReturnValue(gl)
    const callbacks = new Map<number, FrameRequestCallback>()
    let nextFrameId = 1
    const { runtime, definitions } = createRuntime(canvas, callbacks, () => nextFrameId++)
    expect(runtime).not.toBeNull()
    if (!runtime) return

    runtime.resize(resolution(640, 360))
    runtime.setGraph(composition(1, modulationRoutes()), null, definitions)
    runtime.setFrame(frame({ bass: 0.25 }))
    runtime.start()
    runNextFrame(callbacks, 16.67)

    expect(renderedFrames[renderedFrames.length - 1]).toMatchObject({ emissiveIntensity: 0.35, extrusionDepth: 0.35, invalidation: 'material' })
    const initialMeshKey = renderedFrames[renderedFrames.length - 1]?.meshKey
    expect(initialMeshKey).toBeTruthy()
    expect(runtime.webgl.objects3d.getDiagnostics()).toMatchObject({ gpuUploadCount: 1, activeLeaseCount: 1 })

    runtime.setFrame(frame({ bass: 0.5, beat: true, beatEventId: 'stage6-beat-1' }))
    runNextFrame(callbacks, 33.34)
    expect(renderedFrames[renderedFrames.length - 1]).toMatchObject({ emissiveIntensity: 0.6, extrusionDepth: 0.75, meshKey: initialMeshKey, invalidation: 'transform' })
    expect(runtime.webgl.objects3d.getDiagnostics()).toMatchObject({ gpuUploadCount: 1, activeLeaseCount: 1 })

    runtime.setFrame(frame({ bass: 0.5, deltaTimeSec: 0.25 }))
    runNextFrame(callbacks, 283.34)
    expect(renderedFrames[renderedFrames.length - 1]).toMatchObject({ emissiveIntensity: 0.6, extrusionDepth: 0.35, meshKey: initialMeshKey, invalidation: 'transform' })
    expect(runtime.webgl.objects3d.getDiagnostics()).toMatchObject({ gpuUploadCount: 1, activeLeaseCount: 1 })

    runtime.setFrame(frame({ bass: 0.5, beat: true, beatEventId: 'stage6-beat-reset' }))
    runNextFrame(callbacks, 286.67)
    expect(renderedFrames[renderedFrames.length - 1]).toMatchObject({ extrusionDepth: 0.75, meshKey: initialMeshKey })
    runtime.setFrame(frame({ bass: 0.5, reset: true, resetGeneration: 1 }))
    runNextFrame(callbacks, 288.34)
    expect(renderedFrames[renderedFrames.length - 1]).toMatchObject({ emissiveIntensity: 0.6, extrusionDepth: 0.35, meshKey: initialMeshKey })
    expect(runtime.webgl.objects3d.getDiagnostics()).toMatchObject({ gpuUploadCount: 1, activeLeaseCount: 1 })

    runtime.setFrame(frame({ bass: 1, audioAvailable: false }))
    runNextFrame(callbacks, 291.67)
    expect(renderedFrames[renderedFrames.length - 1]).toMatchObject({ emissiveIntensity: 0.1, extrusionDepth: 0.35, meshKey: initialMeshKey })
    expect(runtime.webgl.objects3d.getDiagnostics()).toMatchObject({ gpuUploadCount: 1, activeLeaseCount: 1 })

    runtime.setGraph(composition(2, []), null, definitions)
    runtime.setFrame(frame({ bass: 1, beat: true, beatEventId: 'stage6-beat-2' }))
    runNextFrame(callbacks, 300.01)
    expect(renderedFrames[renderedFrames.length - 1]).toMatchObject({ emissiveIntensity: 0.1, extrusionDepth: 0.35 })
    expect(runtime.webgl.objectInstances.getDiagnostics().activeObjectCount).toBe(1)

    runtime.dispose()
    expect(runtime.webgl.objectInstances.getDiagnostics().activeObjectCount).toBe(0)
  })

  it('registers every live 3D object transform and material parameter as an ordinary Cinema modulation destination', () => {
    const parameterIds = [
      CINEMA_3D_OBJECT_PARAMETER_IDS.extrusionDepth,
      CINEMA_3D_OBJECT_PARAMETER_IDS.position,
      CINEMA_3D_OBJECT_PARAMETER_IDS.rotation,
      CINEMA_3D_OBJECT_PARAMETER_IDS.scale,
      CINEMA_3D_OBJECT_PARAMETER_IDS.frontColor,
      CINEMA_3D_OBJECT_PARAMETER_IDS.sideColor,
      CINEMA_3D_OBJECT_PARAMETER_IDS.emissiveIntensity,
    ] as const
    const routes = parameterIds.map((parameterId, index): CinemaModulationRouteDefinition => ({
      id: cinemaStableId<CinemaModulationRouteId>(`stage6-live-destination-${index + 1}`, 'modulation route'),
      sourceId: CINEMA_MODULATION_SOURCE_IDS.audioBass,
      destination: createCinemaParameterPath('nodes', parameterId, OBJECT_NODE_ID),
      mode: 'add',
      amount: 0.25,
      enabled: true,
    }))
    const foundationDefinition = createCinemaFoundationPersistedState().definitions.find(
      definition => definition.id === CINEMA_FOUNDATION_GRADIENT_DEFINITION.typeId,
    )
    expect(foundationDefinition).toBeDefined()
    if (!foundationDefinition) return
    const registry = createCinemaNodeDefinitionRegistry([{
      definition: OBJECT_DEFINITION,
      rendererPlugin: { id: OBJECT_PLUGIN_ID, available: true },
      source: { kind: 'built-in', id: 'cinema-stage6-object-modulation' },
      quality: foundationDefinition.quality,
    }])
    expect(registry.diagnostics).toEqual([])
    expect(validateCinemaModulationRoutes({ composition: composition(1, routes), registry: registry.registry }).diagnostics).toEqual([])
  })

  it('round-trips stable object modulation destination IDs through existing Cinema persistence', () => {
    const persisted = createCinemaFoundationPersistedState() as CinemaPersistedState
    const mutable = JSON.parse(JSON.stringify(persisted)) as CinemaPersistedState
    const definitionIndex = mutable.definitions.findIndex(entry => entry.id === CINEMA_FOUNDATION_GRADIENT_DEFINITION.typeId)
    const compositionIndex = mutable.compositions.findIndex(candidate => candidate.nodes.some(node => node.typeId === CINEMA_FOUNDATION_GRADIENT_DEFINITION.typeId))
    expect(definitionIndex).toBeGreaterThanOrEqual(0)
    expect(compositionIndex).toBeGreaterThanOrEqual(0)
    if (definitionIndex < 0 || compositionIndex < 0) return

    const originalDefinition = mutable.definitions[definitionIndex]
    const targetNode = mutable.compositions[compositionIndex].nodes.find(node => node.typeId === CINEMA_FOUNDATION_GRADIENT_DEFINITION.typeId)
    expect(targetNode).toBeDefined()
    if (!targetNode) return
    const destination = createCinemaParameterPath('nodes', CINEMA_3D_OBJECT_PARAMETER_IDS.emissiveIntensity, targetNode.id)
    const route: CinemaModulationRouteDefinition = {
      id: cinemaStableId<CinemaModulationRouteId>('stage6-persisted-object-route', 'modulation route'),
      sourceId: CINEMA_MODULATION_SOURCE_IDS.audioHigh,
      destination,
      mode: 'add',
      amount: 1,
      enabled: true,
    }

    mutable.definitions = mutable.definitions.map((entry, index) => index === definitionIndex ? {
      ...entry,
      definition: {
        ...originalDefinition.definition,
        parameters: [...originalDefinition.definition.parameters, ...CINEMA_3D_OBJECT_PARAMETER_SCHEMAS],
        parameterCapabilities: [
          ...(originalDefinition.definition.parameterCapabilities ?? []),
          ...CINEMA_3D_OBJECT_PARAMETER_CAPABILITIES,
        ],
      },
    } : entry)
    mutable.compositions = mutable.compositions.map((candidate, index) => index === compositionIndex ? {
      ...candidate,
      nodes: candidate.nodes.map(node => node.id === targetNode.id ? {
        ...node,
        parameterValues: { ...node.parameterValues, ...serializeCinema3DObjectDefinition(AUTHORED_OBJECT) },
      } : node),
      modulationRoutes: [...candidate.modulationRoutes, route],
    } : candidate)

    const snapshot = snapshotCinemaPersistedState(mutable)
    const normalized = normalizeCinemaPersistedState(JSON.parse(JSON.stringify(snapshot)))
    expect(normalized.ok).toBe(true)
    if (!normalized.ok) return
    const reloadedRoute = normalized.value.compositions[compositionIndex].modulationRoutes.find(candidate => candidate.id === route.id)
    expect(reloadedRoute).toEqual(route)
    expect(reloadedRoute?.destination).toBe(destination)
  })
})

function modulationRoutes(): readonly CinemaModulationRouteDefinition[] {
  return [
    {
      id: cinemaStableId<CinemaModulationRouteId>('stage6-bass-emissive', 'modulation route'),
      sourceId: CINEMA_MODULATION_SOURCE_IDS.audioBass,
      destination: EMISSIVE_PATH,
      mode: 'add',
      amount: 1,
      enabled: true,
    },
    {
      id: cinemaStableId<CinemaModulationRouteId>('stage6-beat-depth', 'modulation route'),
      sourceId: CINEMA_MODULATION_SOURCE_IDS.impulseBeat,
      destination: EXTRUSION_PATH,
      mode: 'add',
      amount: 0.4,
      releaseMs: 120,
      enabled: true,
    },
  ]
}

function composition(revision: number, routes: readonly CinemaModulationRouteDefinition[]): CinemaCompositionDefinition {
  return {
    schemaId: CINEMA_COMPOSITION_SCHEMA_ID,
    schemaVersion: CINEMA_COMPOSITION_SCHEMA_VERSION,
    id: cinemaStableId<CinemaCompositionId>('stage6-object-modulation-composition', 'composition'),
    revision,
    metadata: { name: 'Stage 6 Object Modulation' },
    nodes: [
      {
        id: OBJECT_NODE_ID,
        typeId: OBJECT_TYPE_ID,
        typeVersion: 1,
        family: 'procedural',
        label: 'Object',
        enabled: true,
        opacity: 1,
        parameterValues: serializeCinema3DObjectDefinition(AUTHORED_OBJECT),
      },
      {
        id: OUTPUT_NODE_ID,
        typeId: CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
        typeVersion: 1,
        family: 'output',
        label: 'Output',
        enabled: true,
        opacity: 1,
        parameterValues: {},
      },
    ],
    connections: [{
      id: cinemaStableId<CinemaConnectionId>('stage6-object-output', 'connection'),
      from: { nodeId: OBJECT_NODE_ID, portId: CINEMA_FOUNDATION_COLOR_OUTPUT_PORT_ID },
      to: { nodeId: OUTPUT_NODE_ID, portId: CINEMA_FOUNDATION_INPUT_PORT_ID },
      enabled: true,
    }],
    outputNodeId: OUTPUT_NODE_ID,
    masterParameters: [],
    masterValues: {},
    cameras: [{
      id: CAMERA_ID,
      label: 'Stage 6 Camera',
      mode: 'locked',
      parameterValues: {
        [CINEMA_CAMERA_PARAMETER_IDS.position]: [0, 0, 6],
        [CINEMA_CAMERA_PARAMETER_IDS.rotation]: [0, 0, 0],
        [CINEMA_CAMERA_PARAMETER_IDS.target]: [0, 0, 0],
        [CINEMA_CAMERA_PARAMETER_IDS.fovDegrees]: 50,
        [CINEMA_CAMERA_PARAMETER_IDS.near]: 0.1,
        [CINEMA_CAMERA_PARAMETER_IDS.far]: 100,
      },
    }],
    assetBindings: [],
    modulationRoutes: routes,
    performanceRules: [],
  }
}

function createRuntime(
  canvas: HTMLCanvasElement,
  callbacks: Map<number, FrameRequestCallback>,
  nextFrameId: () => number,
): { runtime: CinemaRuntime | null; definitions: readonly CinemaPersistedDefinition[] } {
  const state = createCinemaFoundationPersistedState()
  const foundationOutputDefinition = state.definitions.find(definition => definition.rendererPluginId === CINEMA_FOUNDATION_OUTPUT_PLUGIN_ID)
  const runtimeOutputRegistration = CINEMA_FOUNDATION_RUNTIME_REGISTRY.getByPluginId(CINEMA_FOUNDATION_OUTPUT_PLUGIN_ID)
  if (!foundationOutputDefinition || !runtimeOutputRegistration) return { runtime: null, definitions: [] }
  const baselineDefinition = state.definitions.find(definition => definition.id === CINEMA_FOUNDATION_GRADIENT_DEFINITION.typeId)
  if (!baselineDefinition) return { runtime: null, definitions: [] }
  const registry = createCinemaRuntimeNodeRegistry([
    { pluginId: OBJECT_PLUGIN_ID, plugin: objectPlugin },
    runtimeOutputRegistration,
  ]).registry
  const definitions: CinemaPersistedDefinition[] = [
    {
      ...baselineDefinition,
      id: OBJECT_TYPE_ID,
      definition: OBJECT_DEFINITION,
      rendererPluginId: OBJECT_PLUGIN_ID,
      source: { kind: 'built-in', id: 'cinema-stage6-object-modulation' },
    },
    foundationOutputDefinition,
  ]
  const created = CinemaRuntime.create(canvas, {
    runtimeRegistry: registry,
    requestAnimationFrame: callback => {
      const id = nextFrameId()
      callbacks.set(id, callback)
      return id
    },
    cancelAnimationFrame: id => { callbacks.delete(id) },
  })
  return { runtime: created.runtime, definitions }
}

function frame(overrides: {
  bass?: number
  beat?: boolean
  beatEventId?: string | null
  audioAvailable?: boolean
  playing?: boolean
  paused?: boolean
  reset?: boolean
  resetGeneration?: number
  deltaTimeSec?: number
} = {}): Readonly<CinemaFrameContext> {
  const eventId = overrides.beatEventId == null ? null : overrides.beatEventId as CinemaEventId
  const beat = overrides.beat === true
  const playing = overrides.playing ?? true
  const paused = overrides.paused ?? false
  const reset = overrides.reset === true
  const clock = (spanBeats: number, hit = false) => ({ available: true, spanBeats, index: 0, phase: 0, hit, eventId: hit ? eventId : null })
  return Object.freeze({
    version: 1,
    viewport: { width: 640, height: 360, dpr: 1 },
    timing: { frameIndex: 1, elapsedTimeSec: 1, deltaTimeSec: overrides.deltaTimeSec ?? 1 / 60, seeds: { composition: 1, track: 2, musicalPosition: 3, event: 4 } },
    transport: {
      trackId: 'stage6-track', audioTimeSec: 1, durationSec: 120, playing, paused, seeking: reset, looped: false,
      visibilitySuspended: false, discontinuity: reset, discontinuityReasons: reset ? ['seek'] : [],
      reset: { required: reset, reconstruct: reset, generation: overrides.resetGeneration ?? (reset ? 1 : 0), reasons: reset ? ['seek'] : [], actionIds: reset ? ['cinema.reset.seek'] : [], identity: reset ? 'seek:stage6' : null },
    },
    audio: {
      available: overrides.audioAvailable ?? true, volume: 0.5, rms: 0.5, energy: 0.5, bass: overrides.bass ?? 0,
      mid: 0.25, high: 0.25, sub: 0.25, centroid: 0.25, flux: 0.25, harmonicity: 0.25,
      complexity: 0.25, tension: 0.25, buildProgress: 0, dropImpact: 0, vocalPresence: 0, fft: null, waveform: null,
    },
    music: {
      available: true, source: 'music-intelligence', bpm: 120, beatIndex: 1, beatPhase: 0, beatInBar: 0,
      barIndex: 0, phraseIndex: 0, sectionId: 'stage6-section', sectionType: 'verse', sectionProgress: 0.25,
      clocks: {
        beat, beat2: false, beat4: false, bar: false, bar4: false, bar8: false, phrase: false,
        states: { beat: clock(1, beat), beat2: clock(2), beat4: clock(4), bar: clock(4), bar4: clock(16), bar8: clock(32), phrase: clock(16) },
      },
    },
    impulses: {
      beat, downbeat: false, kick: false, snare: false, transient: false, sectionStart: false, dropStart: false,
      lyricCue: false, lyricWord: false, phrase4: false, phrase8: false,
      eventIds: { beat: eventId, downbeat: null, kick: null, snare: null, transient: null, sectionStart: null, dropStart: null, lyricCue: null, lyricWord: null, phrase4: null, phrase8: null },
    },
    lyrics: { available: false, sourceIdentity: null, lineId: null, lineText: null, wordId: null, wordText: null, lineProgress: 0, wordProgress: 0, vocalsActive: false },
    performance: { events: [], actionIds: [], toggleStates: {} },
    brand: { available: false, colors: {} },
    capabilities: { analyser: true, musicIntelligence: true, beatGrid: true, authoritativeSections: true, lyrics: false, brandKit: false, sharedPerformance: false, mediaAssets: false },
    activeCameraId: CAMERA_ID,
    camera: null,
  }) as unknown as Readonly<CinemaFrameContext>
}

function resolution(width: number, height: number) {
  return {
    valid: true,
    cssWidth: width,
    cssHeight: height,
    backingWidth: width,
    backingHeight: height,
    effectiveDpr: 1,
    resolutionScale: 1,
    quality: 'high' as const,
    cappedByDpr: false,
    cappedByPixelBudget: false,
    cappedByDimension: false,
  }
}

function runNextFrame(callbacks: Map<number, FrameRequestCallback>, timestamp: number): void {
  const next = [...callbacks.entries()][0]
  expect(next).toBeDefined()
  if (!next) return
  callbacks.delete(next[0])
  next[1](timestamp)
}

function productionProofFont(): opentype.Font {
  const outer = [[0, 0], [600, 0], [600, 1000], [0, 1000]] as const
  const hole = [[180, 220], [420, 220], [420, 780], [180, 780]] as const
  const glyph = {
    index: 1,
    advanceWidth: 650,
    getPath(x: number, y: number, fontSize: number) {
      const scale = fontSize / 1000
      const commands: Array<Record<string, number | string>> = []
      for (const ring of [outer, hole]) {
        commands.push({ type: 'M', x: x + ring[0][0] * scale, y: y + ring[0][1] * scale })
        for (let index = 1; index < ring.length; index += 1) commands.push({ type: 'L', x: x + ring[index][0] * scale, y: y + ring[index][1] * scale })
        commands.push({ type: 'Z' })
      }
      return { commands }
    },
  }
  return {
    unitsPerEm: 1000,
    ascender: 1000,
    charToGlyph: () => glyph as unknown as opentype.Glyph,
    getKerningValue: () => 0,
  } as unknown as opentype.Font
}
