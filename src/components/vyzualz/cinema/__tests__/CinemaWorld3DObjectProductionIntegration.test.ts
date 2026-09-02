/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CINEMA_3D_OBJECT_PARAMETER_IDS,
  CINEMA_CAMERA_PARAMETER_IDS,
  CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE,
  CINEMA_FOUNDATION_INPUT_PORT_ID,
  CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
  CINEMA_MODULATION_SOURCE_IDS,
  createCinemaCinematicWorldComposition,
  createCinemaFoundationPersistedState,
  createCinemaParameterPath,
  getCinemaCinematicWorldSupportedParameterSchemasForNode,
  createDefaultCinema3DObjectDefinition,
  resolveCinemaCameraFrame,
  resolveCinemaWorld3DObjectCameraFocus,
  serializeCinema3DObjectDefinition,
  cinemaStableId,
  type CinemaAssetId,
  type CinemaCompositionDefinition,
  type CinemaFrameContext,
  type CinemaModulationRouteId,
  type CinemaParameterId,
} from '..'
import { CinemaRuntime } from '../runtime/CinemaRuntime'
import { CINEMATIC_WORLD_CATALOG } from '../../react/CinematicWorldControlSchema'
import {
  ORBITAL_PRISM_ARRAY_OBJECT_ANCHOR,
  orbitalPrismArrayWorldDefinition,
} from '../../react/renderers/cinematic/worlds/OrbitalPrismArrayWorld'
import { createCinemaMockWebGL } from './CinemaWebGLTestUtils'

const SVG = '<svg><path d="M0 0 L120 0 L120 70 L0 70 Z M25 20 L95 20 L95 50 L25 50 Z" fill-rule="evenodd"/></svg>'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Cinema world 3D object production integration', () => {
  it('keeps Orbital Prism Array camera capabilities registry-safe and exposes Stage 8 object controls only on the adopting world', async () => {
    await expect(import('../index')).resolves.toBeDefined()

    const rendererRigs = new Set(orbitalPrismArrayWorldDefinition.capabilities.cameraRigs)
    const catalogRigs = new Set(CINEMATIC_WORLD_CATALOG.orbitalPrismArray.cameraRigs)
    expect(rendererRigs).toEqual(catalogRigs)
    expect(rendererRigs.has('flyThrough')).toBe(true)
    expect(orbitalPrismArrayWorldDefinition.object3dSlots).toEqual([ORBITAL_PRISM_ARRAY_OBJECT_ANCHOR])

    const composition = createCinemaCinematicWorldComposition(
      'orbitalPrismArray',
      CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
      CINEMA_FOUNDATION_INPUT_PORT_ID,
    )
    const worldNode = composition.nodes.find(node => node.family === 'procedural')
    expect(worldNode).toBeDefined()
    expect(worldNode?.parameterValues).toHaveProperty(CINEMA_3D_OBJECT_PARAMETER_IDS.extrusionDepth)
    const orbitalEntry = CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.entries.find(entry => entry.worldId === 'orbitalPrismArray')
    expect(orbitalEntry).toBeDefined()
    expect(getCinemaCinematicWorldSupportedParameterSchemasForNode(orbitalEntry!.definition, worldNode!).map(parameter => parameter.id))
      .toContain(CINEMA_3D_OBJECT_PARAMETER_IDS.extrusionDepth)

    const eventHorizon = CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.entries.find(entry => entry.worldId === 'eventHorizon')
    expect(eventHorizon?.definition.metadata?.object3dSlotIds).toEqual([])
    expect(eventHorizon?.definition.parameters.some(parameter => parameter.id === CINEMA_3D_OBJECT_PARAMETER_IDS.extrusionDepth)).toBe(false)
  })

  it('renders a Stage 5 SVG object inside the Orbital Prism Array opaque depth pass with one shared clear', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(SVG, {
      status: 200,
      headers: { 'content-type': 'image/svg+xml' },
    })))
    const canvas = document.createElement('canvas')
    const gl = createCinemaMockWebGL()
    vi.spyOn(canvas, 'getContext').mockReturnValue(gl)
    const callbacks = new Map<number, FrameRequestCallback>()
    let nextFrameId = 1
    const events: Array<{ type: 'clear' | 'world' | 'object'; framebuffer: WebGLFramebuffer | null }> = []
    vi.mocked(gl.clear).mockImplementation(() => {
      gl.__calls.clearCount += 1
      events.push({ type: 'clear', framebuffer: gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null })
    })
    vi.mocked(gl.drawArraysInstanced).mockImplementation(() => {
      gl.__calls.drawInstancedCount += 1
      events.push({ type: 'world', framebuffer: gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null })
    })
    vi.mocked(gl.drawElements).mockImplementation(() => {
      gl.__calls.drawCount += 1
      events.push({ type: 'object', framebuffer: gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null })
    })

    const created = CinemaRuntime.create(canvas, {
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

    const assetId = cinemaStableId<CinemaAssetId>('stage7-orbital-embedded-svg', 'asset')
    runtime.setAssetSources([{
      assetId,
      revision: 1,
      name: 'Stage 7 Embedded SVG',
      mimeType: 'image/svg+xml',
      mediaKind: 'svg',
      runtimeUrl: 'https://signed.example/stage7-orbital.svg',
    }])

    const state = createCinemaFoundationPersistedState()
    const composition = orbitalComposition(assetId, 1)
    runtime.resize(resolution(640, 360))
    runtime.setGraph(composition, null, state.definitions)
    await waitForInitialized(runtime, 2)
    runtime.setFrame(frame(640, 360, 1, 0.73))
    runtime.start()
    runNextFrame(callbacks, 16.67)

    expect(runtime.webgl.objectInstances.getDiagnostics().activeObjectCount).toBe(1)
    expect(runtime.webgl.objects3d.getDiagnostics()).toMatchObject({
      cachedMeshCount: 1,
      activeLeaseCount: 1,
      gpuUploadCount: 1,
      drawCount: 1,
    })
    expect(runtime.getSnapshot().graph.failedNodeCount).toBe(0)

    const firstObjectIndex = events.findIndex(event => event.type === 'object')
    expect(firstObjectIndex).toBeGreaterThan(0)
    const objectTarget = events[firstObjectIndex]?.framebuffer ?? null
    const beforeObject = events.slice(0, firstObjectIndex)
    expect(beforeObject.some(event => event.type === 'world' && event.framebuffer === objectTarget)).toBe(true)
    expect(beforeObject.filter(event => event.type === 'clear' && event.framebuffer === objectTarget)).toHaveLength(1)

    const expectedEmissive = 0.48
    expect(vi.mocked(gl.uniform1f).mock.calls.some((call: readonly unknown[]) => Math.abs(Number(call[1]) - expectedEmissive) < 0.000001)).toBe(true)

    runtime.setAssetSources([{
      assetId,
      revision: 2,
      name: 'Stage 8 Replaced SVG',
      mimeType: 'image/svg+xml',
      mediaKind: 'svg',
      runtimeUrl: 'https://signed.example/stage8-orbital-v2.svg',
    }])
    runtime.setFrame(frame(640, 360, 2, 0.4))
    runNextFrame(callbacks, 33.34)
    await waitForGpuUploads(runtime, 2)
    expect(runtime.webgl.objectInstances.getDiagnostics().activeObjectCount).toBe(1)
    expect(runtime.webgl.objects3d.getDiagnostics()).toMatchObject({ cachedMeshCount: 1, activeLeaseCount: 1, gpuUploadCount: 2 })

    runtime.setGraph(createCinemaCinematicWorldComposition(
      'eventHorizon',
      CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
      CINEMA_FOUNDATION_INPUT_PORT_ID,
    ), null, state.definitions)
    expect(runtime.webgl.objectInstances.getDiagnostics().activeObjectCount).toBe(0)
    expect(runtime.webgl.objects3d.getDiagnostics()).toMatchObject({ cachedMeshCount: 0, activeLeaseCount: 0 })
    runtime.dispose()
  })

  it('uses the existing Cinema camera runtime for orbit, dolly, and fly travel around the embedded anchor', () => {
    const base = createCinemaCinematicWorldComposition(
      'orbitalPrismArray',
      CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
      CINEMA_FOUNDATION_INPUT_PORT_ID,
    )
    const camera = base.cameras[0]
    expect(camera).toBeDefined()
    if (!camera) return
    expect(camera.safeRange?.minPosition[2]).toBeLessThan(0)
    expect(camera.safeRange?.maxPosition[2]).toBeGreaterThan(0)
    expect(camera.path?.some(point => (point.position?.[2] ?? 0) < 0)).toBe(true)

    const target = ORBITAL_PRISM_ARRAY_OBJECT_ANCHOR.transform?.position ?? [0, 0, 0]
    const authoredTarget = camera.parameterValues[CINEMA_CAMERA_PARAMETER_IDS.target]
    expect(authoredTarget).toEqual(target)
    const focus = resolveCinemaWorld3DObjectCameraFocus({
      min: [-0.8, -0.5, -0.2],
      max: [0.8, 0.5, 0.2],
      size: [1.6, 1, 0.4],
      center: target,
    }, Number(camera.parameterValues[CINEMA_CAMERA_PARAMETER_IDS.fovDegrees] ?? 58), 1.25, target)
    const expectedNear = Math.max(camera.safeRange?.minNear ?? 0.001, focus.suggestedNear)
    const expectedFar = Math.min(camera.safeRange?.maxFar ?? Number.POSITIVE_INFINITY, focus.suggestedFar)
    // resolveCinemaCameraFrame's resolvedParameterValues is keyed by full
    // "cameras.<cameraId>.<parameterId>" modulation paths (resolveCameraValues
    // in CinemaCameraRuntime.ts), not by bare parameter IDs — a plain
    // CINEMA_CAMERA_PARAMETER_IDS.near key is silently ignored and the
    // authored default (0.05) wins instead of the focus-derived override.
    const cameraPath = (parameterId: CinemaParameterId) => createCinemaParameterPath('cameras', parameterId, camera.id)
    const resolvedValues = {
      [cameraPath(CINEMA_CAMERA_PARAMETER_IDS.target)]: focus.target,
      [cameraPath(CINEMA_CAMERA_PARAMETER_IDS.near)]: focus.suggestedNear,
      [cameraPath(CINEMA_CAMERA_PARAMETER_IDS.far)]: focus.suggestedFar,
      [cameraPath(CINEMA_CAMERA_PARAMETER_IDS.orbitRadius)]: 4,
      [cameraPath(CINEMA_CAMERA_PARAMETER_IDS.orbitSpeed)]: 0.25,
      [cameraPath(CINEMA_CAMERA_PARAMETER_IDS.dollyRange)]: 1.2,
      [cameraPath(CINEMA_CAMERA_PARAMETER_IDS.dollySpeed)]: 0.5,
      [cameraPath(CINEMA_CAMERA_PARAMETER_IDS.flySpeed)]: 0.25,
    }

    const orbitComposition: CinemaCompositionDefinition = { ...base, cameras: [{ ...camera, mode: 'orbit' }] }
    const orbitFrames = [0, 1, 2, 3, 4].map(seconds => resolveCinemaCameraFrame({
      composition: orbitComposition,
      frame: frame(640, 360, seconds, 0),
      resolvedParameterValues: resolvedValues,
      motionScale: 1,
    }).camera)
    expect(orbitFrames.some(snapshot => snapshot != null && snapshot.position[2] < target[2])).toBe(true)
    expect(orbitFrames.some(snapshot => snapshot != null && Math.abs(snapshot.position[0] - target[0]) > 1)).toBe(true)
    for (const snapshot of orbitFrames) {
      if (!snapshot) continue
      expect(snapshot.target[0]).toBeCloseTo(target[0], 5)
      expect(snapshot.target[1]).toBeCloseTo(target[1], 5)
      expect(snapshot.target[2]).toBeCloseTo(target[2], 5)
      expect(snapshot.near).toBeCloseTo(expectedNear, 5)
      expect(snapshot.far).toBeCloseTo(expectedFar, 5)
    }

    const dollyComposition: CinemaCompositionDefinition = { ...base, cameras: [{ ...camera, mode: 'dolly' }] }
    const dollyPositions = [0, 0.5, 1, 1.5].map(seconds => resolveCinemaCameraFrame({
      composition: dollyComposition,
      frame: frame(640, 360, seconds, 0),
      resolvedParameterValues: resolvedValues,
    }).camera?.position[2]).filter((value): value is number => value != null)
    expect(dollyPositions).toHaveLength(4)
    expect(Math.max(...dollyPositions) - Math.min(...dollyPositions)).toBeGreaterThan(0.2)

    const flyComposition: CinemaCompositionDefinition = { ...base, cameras: [{ ...camera, mode: 'fly' }] }
    const fly = resolveCinemaCameraFrame({
      composition: flyComposition,
      frame: frame(640, 360, 2, 0),
      resolvedParameterValues: resolvedValues,
      motionScale: 1,
    }).camera
    expect(fly).not.toBeNull()
    expect(fly?.position[2]).toBeLessThan(target[2])
  })
})

function orbitalComposition(assetId: CinemaAssetId, revision: number): CinemaCompositionDefinition {
  const base = createCinemaCinematicWorldComposition(
    'orbitalPrismArray',
    CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
    CINEMA_FOUNDATION_INPUT_PORT_ID,
  )
  const worldNode = base.nodes.find(node => node.family === 'procedural')
  if (!worldNode) throw new Error('Orbital Prism Array procedural node unavailable.')
  const defaults = createDefaultCinema3DObjectDefinition()
  const objectValues = serializeCinema3DObjectDefinition({
    ...defaults,
    source: { type: 'svg', asset: { assetId, role: 'logo' } },
    appearance: { ...defaults.appearance, emissiveIntensity: 0.17 },
  }, worldNode.parameterValues)
  return {
    ...base,
    revision,
    nodes: base.nodes.map(node => node.id === worldNode.id ? { ...node, parameterValues: objectValues } : node),
    modulationRoutes: [{
      id: cinemaStableId<CinemaModulationRouteId>('stage7-embedded-emissive', 'modulation route'),
      sourceId: CINEMA_MODULATION_SOURCE_IDS.audioBass,
      destination: createCinemaParameterPath('nodes', CINEMA_3D_OBJECT_PARAMETER_IDS.emissiveIntensity, worldNode.id),
      mode: 'add',
      amount: 0.43,
      enabled: true,
    }],
  }
}

async function waitForInitialized(runtime: CinemaRuntime, expectedCount: number): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (runtime.getSnapshot().graph.initializedNodeCount >= expectedCount) return
    await new Promise(resolve => setTimeout(resolve, 0))
  }
  expect(runtime.getSnapshot().graph.initializedNodeCount).toBeGreaterThanOrEqual(expectedCount)
}

async function waitForGpuUploads(runtime: CinemaRuntime, expectedCount: number): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (runtime.webgl.objects3d.getDiagnostics().gpuUploadCount >= expectedCount) return
    await new Promise(resolve => setTimeout(resolve, 0))
  }
  expect(runtime.webgl.objects3d.getDiagnostics().gpuUploadCount).toBeGreaterThanOrEqual(expectedCount)
}

function runNextFrame(callbacks: Map<number, FrameRequestCallback>, timestamp: number): void {
  const next = [...callbacks.entries()][0]
  expect(next).toBeDefined()
  if (!next) return
  callbacks.delete(next[0])
  next[1](timestamp)
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

function frame(width: number, height: number, audioTimeSec: number, bass: number): Readonly<CinemaFrameContext> {
  const clock = (spanBeats: number) => ({ available: true, spanBeats, index: 0, phase: 0, hit: false, eventId: null })
  return {
    version: 1,
    viewport: { width, height, dpr: 1 },
    timing: { frameIndex: Math.round(audioTimeSec * 60), elapsedTimeSec: audioTimeSec, deltaTimeSec: 1 / 60, seeds: { composition: 1, track: 2, musicalPosition: 3, event: 4 } },
    transport: {
      trackId: 'stage7-runtime-proof', audioTimeSec, durationSec: 60, playing: true, paused: false,
      seeking: false, looped: false, visibilitySuspended: false, discontinuity: false,
      discontinuityReasons: [], reset: { required: false, reconstruct: false, generation: 0, reasons: [], actionIds: [], identity: null },
    },
    audio: {
      available: bass > 0, volume: bass, rms: bass, energy: bass, bass, mid: 0.2, high: 0.1, sub: bass,
      centroid: 0.3, flux: 0.2, harmonicity: 0.5, complexity: 0.2, tension: 0.2, buildProgress: 0,
      dropImpact: 0, vocalPresence: 0, fft: null, waveform: null,
    },
    music: {
      available: true, source: 'music-intelligence', bpm: 150, beatIndex: Math.floor(audioTimeSec * 2.5), beatPhase: 0,
      beatInBar: 0, barIndex: 0, phraseIndex: 0, sectionId: 'verse-1', sectionType: 'verse', sectionProgress: 0.2,
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
      analyser: bass > 0, musicIntelligence: true, beatGrid: true, authoritativeSections: true,
      lyrics: false, brandKit: false, sharedPerformance: true, mediaAssets: true,
    },
    activeCameraId: null,
    camera: null,
  }
}
