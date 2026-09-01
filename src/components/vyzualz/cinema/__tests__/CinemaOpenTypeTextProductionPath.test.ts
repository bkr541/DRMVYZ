/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as opentype from 'opentype.js'

import {
  CINEMA_FOUNDATION_COLOR_OUTPUT_PORT_ID,
  CINEMA_FOUNDATION_GRADIENT_DEFINITION,
  CINEMA_FOUNDATION_INPUT_PORT_ID,
  CINEMA_FOUNDATION_OUTPUT_PLUGIN_ID,
  CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
  CINEMA_FOUNDATION_RUNTIME_REGISTRY,
  createCinemaFoundationPersistedState,
} from '../CinemaFoundation'
import { CINEMA_CAMERA_PARAMETER_IDS } from '../CinemaCameraRuntime'
import {
  CINEMA_COMPOSITION_SCHEMA_ID,
  CINEMA_COMPOSITION_SCHEMA_VERSION,
  type CinemaCompositionDefinition,
} from '../CinemaDomain'
import {
  cinemaNamespacedId,
  cinemaStableId,
  type CinemaCameraId,
  type CinemaCompositionId,
  type CinemaConnectionId,
  type CinemaNodeId,
  type CinemaNodeTypeId,
  type CinemaRendererPluginId,
} from '../CinemaIdentifiers'
import { CinemaOpenTypeTextMeshCache } from '../CinemaOpenTypeTextGeometry'
import type { CinemaGpuMeshLease } from '../CinemaObject3DRenderer'
import type { CinemaPersistedDefinition } from '../CinemaPersistence'
import type { CinemaFrameContext, CinemaNodePlugin, CinemaNodeTypeDefinition } from '../CinemaRendererContracts'
import { createCinemaRuntimeNodeRegistry } from '../CinemaRuntimeNodeRegistry'
import { CinemaRuntime } from '../runtime/CinemaRuntime'
import { createCinemaMockWebGL } from './CinemaWebGLTestUtils'
import type { CanvasResolution } from '../../react/rendering/canvasResolution'

const OBJECT_TYPE_ID = cinemaNamespacedId<CinemaNodeTypeId>('drmvyz.cinema.generator.stage3-opentype-proof', 'node type')
const OBJECT_PLUGIN_ID = cinemaNamespacedId<CinemaRendererPluginId>('drmvyz.cinema.renderer.stage3-opentype-proof', 'renderer plugin')
const OBJECT_NODE_ID = cinemaStableId<CinemaNodeId>('stage3-opentype-proof-node', 'node')
const OUTPUT_NODE_ID = cinemaStableId<CinemaNodeId>('stage3-opentype-proof-output', 'node')
const CAMERA_ID = cinemaStableId<CinemaCameraId>('stage3-opentype-proof-camera', 'camera')

const OBJECT_DEFINITION: Readonly<CinemaNodeTypeDefinition> = Object.freeze({
  ...CINEMA_FOUNDATION_GRADIENT_DEFINITION,
  typeId: OBJECT_TYPE_ID,
  label: 'Stage 3 OpenType Solid Proof',
  description: undefined,
  parameters: [],
  parameterCapabilities: [],
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

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Cinema OpenType text production path', () => {
  it('compiles once, uploads once, and draws generated glyph geometry through CinemaRuntime', () => {
    const canvas = document.createElement('canvas')
    const gl = createCinemaMockWebGL()
    vi.spyOn(canvas, 'getContext').mockReturnValue(gl)
    const callbacks = new Map<number, FrameRequestCallback>()
    let nextFrameId = 1
    let lease: CinemaGpuMeshLease | null = null
    const textCache = new CinemaOpenTypeTextMeshCache()
    const font = productionProofFont()

    const objectPlugin: CinemaNodePlugin = {
      definition: OBJECT_DEFINITION,
      createNode: node => ({
        nodeId: node.id,
        typeId: node.typeId,
        initialize(context) {
          const compiled = textCache.getOrCompile({
            font,
            fontIdentity: 'stage3-production-proof-font',
            text: 'O',
          })
          if (!compiled.ok) throw new Error(compiled.error.message)
          if (!compiled.value.mesh) throw new Error('Stage 3 production proof did not produce a solid mesh')
          lease = context.webgl.objects3d.acquireMesh(compiled.value.cacheKey, compiled.value.mesh)
        },
        resize() {},
        render(context) {
          if (!lease || !context.target) return
          const gl = context.webgl.gl
          context.webgl.bindTarget(context.target)
          context.webgl.resetState()
          gl.clearColor(0, 0, 0, 1)
          gl.clearDepth(1)
          gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
          context.webgl.objects3d.draw({
            mesh: lease,
            viewport: context.viewport,
            camera: context.frame.camera,
            transform: { rotation: [0.15, context.frame.timing.elapsedTimeSec * 0.2, 0], scale: [1.2, 1.2, 0.45] },
            material: { frontColor: [0.95, 0.3, 0.8, 1], sideColor: [0.1, 0.7, 0.95, 1] },
          })
        },
        reset() {},
        dispose() {
          lease?.release()
          lease = null
        },
      }),
    }

    const state = createCinemaFoundationPersistedState()
    const foundationOutputDefinition = state.definitions.find(
      definition => definition.rendererPluginId === CINEMA_FOUNDATION_OUTPUT_PLUGIN_ID,
    )
    const runtimeOutputRegistration = CINEMA_FOUNDATION_RUNTIME_REGISTRY.getByPluginId(CINEMA_FOUNDATION_OUTPUT_PLUGIN_ID)
    expect(foundationOutputDefinition).toBeDefined()
    expect(runtimeOutputRegistration).toBeDefined()
    if (!foundationOutputDefinition || !runtimeOutputRegistration) return

    const runtimeRegistryResult = createCinemaRuntimeNodeRegistry([
      { pluginId: OBJECT_PLUGIN_ID, plugin: objectPlugin },
      runtimeOutputRegistration,
    ])
    expect(runtimeRegistryResult.diagnostics).toEqual([])
    const baselineDefinition = state.definitions.find(definition => definition.id === CINEMA_FOUNDATION_GRADIENT_DEFINITION.typeId)
    expect(baselineDefinition).toBeDefined()
    if (!baselineDefinition) return
    const definitions: CinemaPersistedDefinition[] = [
      {
        ...baselineDefinition,
        id: OBJECT_TYPE_ID,
        definition: OBJECT_DEFINITION,
        rendererPluginId: OBJECT_PLUGIN_ID,
        source: { kind: 'built-in', id: 'cinema-stage3-opentype-proof' },
      },
      foundationOutputDefinition,
    ]

    const created = CinemaRuntime.create(canvas, {
      runtimeRegistry: runtimeRegistryResult.registry,
      requestAnimationFrame: callback => {
        const id = nextFrameId++
        callbacks.set(id, callback)
        return id
      },
      cancelAnimationFrame: id => { callbacks.delete(id) },
    })
    const runtime = created.runtime
    expect(runtime).not.toBeNull()
    if (!runtime) return

    runtime.resize(resolution(640, 360))
    runtime.setGraph(composition(), null, definitions)
    runtime.setFrame(frame(640, 360, 0))
    runtime.start()
    runNextFrame(callbacks, 16.67)

    expect(textCache.getStats()).toEqual({ entries: 1, buildCount: 1, hitCount: 0 })
    expect(runtime.webgl.objects3d.getDiagnostics()).toMatchObject({
      cachedMeshCount: 1,
      activeLeaseCount: 1,
      gpuUploadCount: 1,
      drawCount: 1,
    })

    runtime.setFrame(frame(640, 360, 1))
    runNextFrame(callbacks, 33.34)
    expect(textCache.getStats().buildCount).toBe(1)
    expect(runtime.webgl.objects3d.getDiagnostics()).toMatchObject({ gpuUploadCount: 1, drawCount: 2 })

    runtime.dispose()
    expect(runtime.webgl.objects3d.getDiagnostics()).toMatchObject({ cachedMeshCount: 0, activeLeaseCount: 0 })
  })
})

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
        for (let index = 1; index < ring.length; index += 1) {
          commands.push({ type: 'L', x: x + ring[index][0] * scale, y: y + ring[index][1] * scale })
        }
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

function composition(): CinemaCompositionDefinition {
  return {
    schemaId: CINEMA_COMPOSITION_SCHEMA_ID,
    schemaVersion: CINEMA_COMPOSITION_SCHEMA_VERSION,
    id: cinemaStableId<CinemaCompositionId>('stage3-opentype-proof-composition', 'composition'),
    revision: 1,
    metadata: { name: 'Stage 3 OpenType Runtime Proof' },
    nodes: [
      { id: OBJECT_NODE_ID, typeId: OBJECT_TYPE_ID, typeVersion: 1, family: 'procedural', label: 'Text', enabled: true, opacity: 1, parameterValues: {} },
      { id: OUTPUT_NODE_ID, typeId: CINEMA_FOUNDATION_OUTPUT_TYPE_ID, typeVersion: 1, family: 'output', label: 'Output', enabled: true, opacity: 1, parameterValues: {} },
    ],
    connections: [{
      id: cinemaStableId<CinemaConnectionId>('stage3-opentype-proof-output', 'connection'),
      from: { nodeId: OBJECT_NODE_ID, portId: CINEMA_FOUNDATION_COLOR_OUTPUT_PORT_ID },
      to: { nodeId: OUTPUT_NODE_ID, portId: CINEMA_FOUNDATION_INPUT_PORT_ID },
      enabled: true,
    }],
    outputNodeId: OUTPUT_NODE_ID,
    masterParameters: [],
    masterValues: {},
    cameras: [{
      id: CAMERA_ID,
      label: 'Stage 3 Camera',
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
    modulationRoutes: [],
    performanceRules: [],
  }
}

function runNextFrame(callbacks: Map<number, FrameRequestCallback>, timestamp: number): void {
  const next = [...callbacks.entries()][0]
  expect(next).toBeDefined()
  if (!next) return
  callbacks.delete(next[0])
  next[1](timestamp)
}

function resolution(width: number, height: number): CanvasResolution {
  return {
    valid: true,
    cssWidth: width,
    cssHeight: height,
    backingWidth: width,
    backingHeight: height,
    effectiveDpr: 1,
    resolutionScale: 1,
    quality: 'high',
    cappedByDpr: false,
    cappedByPixelBudget: false,
    cappedByDimension: false,
  }
}

function frame(width: number, height: number, elapsedTimeSec: number): Readonly<CinemaFrameContext> {
  const clock = (spanBeats: number) => ({ available: true, spanBeats, index: 0, phase: 0, hit: false, eventId: null })
  return {
    version: 1,
    viewport: { width, height, dpr: 1 },
    timing: { frameIndex: Math.round(elapsedTimeSec * 60), elapsedTimeSec, deltaTimeSec: 1 / 60, seeds: { composition: 1, track: 2, musicalPosition: 3, event: 4 } },
    transport: {
      trackId: 'stage3-runtime-proof', audioTimeSec: elapsedTimeSec, durationSec: 60, playing: true, paused: false,
      seeking: false, looped: false, visibilitySuspended: false, discontinuity: false,
      discontinuityReasons: [], reset: { required: false, reconstruct: false, generation: 0, reasons: [], actionIds: [], identity: null },
    },
    audio: {
      available: false, volume: 0, rms: 0, energy: 0, bass: 0, mid: 0, high: 0, sub: 0,
      centroid: 0, flux: 0, harmonicity: 0, complexity: 0, tension: 0, buildProgress: 0,
      dropImpact: 0, vocalPresence: 0, fft: null, waveform: null,
    },
    music: {
      available: false, source: 'unavailable', bpm: null, beatIndex: null, beatPhase: 0, beatInBar: null,
      barIndex: null, phraseIndex: null, sectionId: null, sectionType: null, sectionProgress: 0,
      clocks: {
        beat: false, beat2: false, beat4: false, bar: false, bar4: false, bar8: false, phrase: false,
        states: { beat: clock(1), beat2: clock(2), beat4: clock(4), bar: clock(4), bar4: clock(16), bar8: clock(32), phrase: clock(16) },
      },
    },
    impulses: {
      beat: false, downbeat: false, kick: false, snare: false, transient: false, sectionStart: false,
      dropStart: false, lyricCue: false, lyricWord: false, phrase4: false, phrase8: false,
      eventIds: { beat: null, downbeat: null, kick: null, snare: null, transient: null, sectionStart: null, dropStart: null, lyricCue: null, lyricWord: null, phrase4: null, phrase8: null },
    },
    lyrics: { available: false, sourceIdentity: null, lineId: null, lineText: null, wordId: null, wordText: null, lineProgress: 0, wordProgress: 0, vocalsActive: false },
    performance: { events: [], actionIds: [], toggleStates: {} },
    brand: { available: false, colors: {} },
    capabilities: {
      analyser: false, musicIntelligence: false, beatGrid: false, authoritativeSections: false,
      lyrics: false, brandKit: false, sharedPerformance: false, mediaAssets: false,
    },
    activeCameraId: null,
    camera: null,
  }
}
