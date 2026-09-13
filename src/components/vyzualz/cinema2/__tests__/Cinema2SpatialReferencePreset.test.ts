import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import { createCinemaMockWebGL } from '../../cinema/__tests__/CinemaWebGLTestUtils'
import { Cinema2AudioIntelligenceBridge } from '../audio/Cinema2AudioIntelligenceBridge'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { createCinema2InspectorModel } from '../parameters/Cinema2InspectorModel'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { CINEMA2_REFERENCE_VISUAL_PRESET_ID } from '../presets/Cinema2ReferenceVisualPreset'
import {
  CINEMA2_SPATIAL_REFERENCE_FOCUS_NODE_ID,
  CINEMA2_SPATIAL_REFERENCE_FLY_CAMERA_ID,
  CINEMA2_SPATIAL_REFERENCE_KEY_LIGHT_ID,
  CINEMA2_SPATIAL_REFERENCE_OBJECT_CENTER_NODE_ID,
  CINEMA2_SPATIAL_REFERENCE_OBJECT_MODULE_ID,
  CINEMA2_SPATIAL_REFERENCE_ORBIT_CAMERA_ID,
  CINEMA2_SPATIAL_REFERENCE_PRESET_ID,
  CINEMA2_SPATIAL_REFERENCE_PRESET_MANIFEST,
} from '../presets/Cinema2SpatialReferencePreset'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { Cinema2Runtime, getCinema2RuntimeDiagnostics } from '../runtime/Cinema2Runtime'
import type { Cinema2NativePresetManifest } from '../contracts/Cinema2NativePresetManifest'

class FakeCanvas extends EventTarget {
  width = 640
  height = 360
  readonly getContext: ReturnType<typeof vi.fn>

  constructor(gl: WebGL2RenderingContext | null) {
    super()
    this.getContext = vi.fn(() => gl)
  }
}

function createRafHarness() {
  const callbacks = new Map<number, FrameRequestCallback>()
  let nextId = 1
  return {
    requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
      const id = nextId++
      callbacks.set(id, callback)
      return id
    }),
    cancelAnimationFrame: vi.fn((id: number) => callbacks.delete(id)),
    runNext(timestamp = 1000) {
      const entry = [...callbacks.entries()][0]
      if (!entry) throw new Error('No animation frame is scheduled')
      callbacks.delete(entry[0])
      entry[1](timestamp)
    },
  }
}

function createReactiveBridge() {
  let publicationSequence = 1
  let frame = {
    ...DEFAULT_MI_FRAME,
    frameId: 41,
    sourceId: 'cinema2-spatial-reference-test',
    timeSec: 1,
    energy: { ...DEFAULT_MI_FRAME.energy, instant: 0.8, buildProgress: 0.4, dropImpact: 0.2 },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      bpmConfidence: 0.98,
      beatIndex: 4,
      beatPhase: 0,
      beatInBar: 0,
      barIndex: 1,
      beatHit: true,
      downbeatHit: true,
      beatEventTimeSec: 1,
      transientConfidence: 0.98,
    },
    capabilities: {
      ...DEFAULT_MI_FRAME.capabilities!,
      liveBands: true,
      beatGrid: true,
      rhythmEvents: true,
    },
    confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 0.98, rhythm: 0.98 },
  }
  const bridge = new Cinema2AudioIntelligenceBridge({
    getFrame: () => frame,
    getPublicationMeta: () => ({
      sequence: publicationSequence,
      publishedAtMs: frame.timeSec * 1000,
      publisherId: 'cinema2-spatial-reference-test',
      kind: 'frame' as const,
    }),
  })
  return {
    bridge,
    advance() {
      publicationSequence += 1
      frame = {
        ...frame,
        frameId: frame.frameId + 1,
        timeSec: frame.timeSec + 0.1,
        rhythm: { ...frame.rhythm, beatHit: false, downbeatHit: false, beatPhase: 0.2 },
      }
    },
  }
}

function findTarget(runtime: Cinema2Runtime, kind: string, ownerId: string, property: string) {
  const target = runtime.getCompiledPresetPlan().targets.targets.find(candidate => (
    candidate.kind === kind && candidate.ownerId === ownerId && candidate.property === property
  ))
  if (!target) throw new Error(`Missing ${kind}:${ownerId}:${property} target`)
  return target
}

describe('Cinema 2.0 Stage 13 Spatial Reference preset', () => {
  it('registers one native preset contract that composes world depth, screen overlay, orbit/fly cameras, shared lighting and one shared effect', () => {
    expect(cinema2NativePresetRegistry.get(CINEMA2_SPATIAL_REFERENCE_PRESET_ID)?.id).toBe(CINEMA2_SPATIAL_REFERENCE_PRESET_ID)
    expect(cinema2NativePresetRegistry.list().map(preset => preset.metadata.name)).toContain('Spatial Reference')

    const compilation = compileCinema2NativePreset(CINEMA2_SPATIAL_REFERENCE_PRESET_MANIFEST, {
      availableCapabilities: ['render.webgl2', 'render.depth', 'scene.3d', 'camera.world', 'lighting', 'audio.features', 'music.downbeat'],
    })
    expect(compilation.ok).toBe(true)
    if (!compilation.ok) return

    const worldObjectNodes = compilation.plan.scene.nodes.filter(node => node.moduleId === CINEMA2_SPATIAL_REFERENCE_OBJECT_MODULE_ID)
    expect(worldObjectNodes).toHaveLength(3)
    expect(worldObjectNodes.every(node => node.coordinateSpace === 'world')).toBe(true)
    expect(compilation.plan.scene.nodes.some(node => node.coordinateSpace === 'normalized-screen')).toBe(true)
    expect(compilation.plan.render.targets.some(target => target.descriptor.depthFormat === 'depth24')).toBe(true)
    expect(compilation.plan.manifest.effects).toHaveLength(1)

    const cameras = compilation.plan.manifest.cameras ?? []
    expect(cameras.find(camera => camera.id === CINEMA2_SPATIAL_REFERENCE_ORBIT_CAMERA_ID)?.rig?.kind).toBe('orbit')
    expect(cameras.find(camera => camera.id === CINEMA2_SPATIAL_REFERENCE_FLY_CAMERA_ID)?.rig?.kind).toBe('fly')
    expect(cameras.find(camera => camera.id === CINEMA2_SPATIAL_REFERENCE_ORBIT_CAMERA_ID)?.targetNode?.$ref).toBe(CINEMA2_SPATIAL_REFERENCE_FOCUS_NODE_ID)

    const key = compilation.plan.manifest.lighting?.lights.find(light => light.id === CINEMA2_SPATIAL_REFERENCE_KEY_LIGHT_ID)
    expect(key?.node).toBeDefined()
    expect(key?.targetNode?.$ref).toBe(CINEMA2_SPATIAL_REFERENCE_FOCUS_NODE_ID)

    const targetKinds = new Set((compilation.plan.manifest.choreography?.rules ?? [])
      .flatMap(rule => rule.actions.map(action => action.target.kind)))
    expect(targetKinds.has('camera')).toBe(true)
    expect(targetKinds.has('light')).toBe(true)
    expect(targetKinds.has('module')).toBe(true)
    expect(targetKinds.has('scene-node')).toBe(true)
  })

  it('projects only authored Scene, Design, Camera, Environment and React controls through the generic Inspector model', () => {
    const compilation = compileCinema2NativePreset(CINEMA2_SPATIAL_REFERENCE_PRESET_MANIFEST)
    expect(compilation.ok).toBe(true)
    if (!compilation.ok) return
    const state = new Cinema2ParameterState(compilation.plan.parameters)

    const designSections = createCinema2InspectorModel(compilation.plan, state.getSnapshot(), 'design').map(section => section.label)
    const reactSections = createCinema2InspectorModel(compilation.plan, state.getSnapshot(), 'react').map(section => section.label)
    expect(designSections).toEqual(expect.arrayContaining(['Scene', 'Design', 'Camera', 'Environment']))
    expect(reactSections).toEqual(['React'])
  })

  it('enters through the real registry -> Runtime path and resolves depth, overlay, choreography, camera impulse and lighting/object response in one frame', () => {
    const gl = createCinemaMockWebGL()
    const canvas = new FakeCanvas(gl)
    const raf = createRafHarness()
    const audio = createReactiveBridge()
    const created = Cinema2Runtime.create(canvas as unknown as HTMLCanvasElement, {
      presetId: CINEMA2_SPATIAL_REFERENCE_PRESET_ID,
      audioIntelligenceBridge: audio.bridge,
      requestAnimationFrame: raf.requestAnimationFrame,
      cancelAnimationFrame: raf.cancelAnimationFrame,
      renderQuality: 'high',
    })
    expect(created.error).toBeNull()
    if (!created.runtime) return
    const runtime = created.runtime

    runtime.resize({ width: 640, height: 360, dpr: 1 })
    runtime.start()
    raf.runNext(1000)

    expect(runtime.getCompiledPresetPlan().presetId).toBe(CINEMA2_SPATIAL_REFERENCE_PRESET_ID)
    expect(runtime.getRenderGraphExecutorSnapshot()).toMatchObject({ failedPassCount: 0, executedPassCount: 2 })
    expect(runtime.getCameraRuntimeSnapshot()).toMatchObject({ activeCameraId: CINEMA2_SPATIAL_REFERENCE_ORBIT_CAMERA_ID })
    expect(runtime.getCameraRuntimeSnapshot().camera.rig).toBe('orbit')
    expect(runtime.getCameraRuntimeSnapshot().camera.fovDegrees).toBeLessThan(48)

    const lightTarget = findTarget(runtime, 'light', CINEMA2_SPATIAL_REFERENCE_KEY_LIGHT_ID, 'intensity')
    const emissiveTarget = findTarget(runtime, 'module', CINEMA2_SPATIAL_REFERENCE_OBJECT_MODULE_ID, 'emissiveIntensity')
    expect(runtime.getTargetResolver().resolve(lightTarget.id).value).toBeGreaterThan(1.35)
    expect(runtime.getTargetResolver().resolve(emissiveTarget.id).value).toBeGreaterThan(0.08)
    expect(runtime.getSpatialRuntime().resolveNode(CINEMA2_SPATIAL_REFERENCE_OBJECT_CENTER_NODE_ID)?.local.rotation[1]).toBeGreaterThan(0.22)

    expect(gl.__calls.drawCount).toBeGreaterThanOrEqual(5)
    expect(gl.clear).toHaveBeenCalledWith(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    const depthMasks = vi.mocked(gl.depthMask).mock.calls.map(call => call[0])
    expect(depthMasks.indexOf(true)).toBeGreaterThanOrEqual(0)
    expect(depthMasks.slice(depthMasks.indexOf(true) + 1)).toContain(false)

    runtime.resize({ width: 960, height: 540, dpr: 1.5 })
    audio.advance()
    raf.runNext(1100)
    expect(runtime.getSnapshot().phase).toBe('running')
    expect(runtime.getSnapshot().viewport).toMatchObject({ width: 960, height: 540, dpr: 1.5 })

    runtime.dispose()
    expect(gl.__calls.createdBuffers).toBe(gl.__calls.deletedBuffers)
    expect(gl.__calls.createdVertexArrays).toBe(gl.__calls.deletedVertexArrays)
    expect(gl.__calls.createdPrograms).toBe(gl.__calls.deletedPrograms)
    expect(gl.__calls.createdTextures).toBe(gl.__calls.deletedTextures)
    expect(gl.__calls.createdFramebuffers).toBe(gl.__calls.deletedFramebuffers)
    expect(gl.__calls.createdRenderbuffers).toBe(gl.__calls.deletedRenderbuffers)
  })

  it('honors shared quality limits and retires repeated activation/deactivation plus sibling preset switching without leaking runtime owners', () => {
    const before = getCinema2RuntimeDiagnostics()
    const presetSequence = [
      CINEMA2_SPATIAL_REFERENCE_PRESET_ID,
      CINEMA2_REFERENCE_VISUAL_PRESET_ID,
      CINEMA2_SPATIAL_REFERENCE_PRESET_ID,
    ] as const
    for (const presetId of presetSequence) {
      const gl = createCinemaMockWebGL()
      const canvas = new FakeCanvas(gl)
      const raf = createRafHarness()
      const created = Cinema2Runtime.create(canvas as unknown as HTMLCanvasElement, {
        presetId,
        requestAnimationFrame: raf.requestAnimationFrame,
        cancelAnimationFrame: raf.cancelAnimationFrame,
        renderQuality: 'low',
      })
      expect(created.error).toBeNull()
      if (!created.runtime) continue
      if (presetId === CINEMA2_SPATIAL_REFERENCE_PRESET_ID) {
        expect(created.runtime.getLightingEnvironmentRuntimeSnapshot()).toMatchObject({
          authoredLightCount: 3,
          activeLightCount: 2,
          omittedLightCount: 1,
          quality: 'low',
        })
      }
      created.runtime.dispose()
    }
    const after = getCinema2RuntimeDiagnostics()
    expect(after.activeRuntimeCount).toBe(before.activeRuntimeCount)
    expect(after.activeAnimationFrameCount).toBe(before.activeAnimationFrameCount)
    expect(after.activeEventListenerCount).toBe(before.activeEventListenerCount)
    expect(after.activeWebGLContextCount).toBe(before.activeWebGLContextCount)
    expect(after.activeTargetResolverCount).toBe(before.activeTargetResolverCount)
  })

  it('rejects a malformed authored Scene Graph camera reference at compile time', () => {
    const malformed = structuredClone(CINEMA2_SPATIAL_REFERENCE_PRESET_MANIFEST) as Cinema2NativePresetManifest
    const firstCamera = malformed.cameras?.[0]
    if (!firstCamera) throw new Error('Spatial Reference camera fixture is missing')
    ;(firstCamera as { targetNode?: { $ref: string } }).targetNode = { $ref: 'missing-spatial-node' }

    const compilation = compileCinema2NativePreset(malformed)
    expect(compilation.ok).toBe(false)
    expect(compilation.diagnostics.some(diagnostic => diagnostic.path.includes('cameras'))).toBe(true)
  })
})
