import { describe, expect, it, vi } from 'vitest'
import type * as opentype from 'opentype.js'

import { createCinemaMockWebGL } from '../../cinema/__tests__/CinemaWebGLTestUtils'
import { CINEMA2_FULLSCREEN_SHADER_MODULE_TYPE_ID } from '../modules/Cinema2FullscreenShaderModule'
import {
  CINEMA2_OBJECT3D_MODULE_TYPE_ID,
  cinema2Object3DModuleDefinition,
} from '../modules/Cinema2Object3DModule'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { Cinema2PresetRegistry } from '../presets/Cinema2PresetRegistry'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { Cinema2Runtime } from '../runtime/Cinema2Runtime'
import {
  compileCinema2Object3DSvgGeometry,
  compileCinema2Object3DTextGeometry,
} from '../spatial/Cinema2Object3DGeometry'
import { createCinema2FoundationWorldToClip } from '../spatial/Cinema2Object3DRenderer'
import { Cinema2SpatialRuntime } from '../spatial/Cinema2SpatialRuntime'
import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  type Cinema2LayerId,
  type Cinema2ModuleId,
  type Cinema2NativePresetManifest,
  type Cinema2PresetId,
  type Cinema2RenderPassId,
  type Cinema2RenderSlotId,
  type Cinema2RenderTargetId,
  type Cinema2SceneNodeId,
} from '../contracts/Cinema2NativePresetManifest'

class FakeCanvas extends EventTarget {
  width = 300
  height = 150
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
    callbacks,
    requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
      const id = nextId++
      callbacks.set(id, callback)
      return id
    }),
    cancelAnimationFrame: vi.fn((id: number) => callbacks.delete(id)),
    runNext(timestamp = 16.67) {
      const entry = [...callbacks.entries()][0]
      if (!entry) throw new Error('No animation frame is scheduled')
      callbacks.delete(entry[0])
      entry[1](timestamp)
    },
  }
}

function fixtureFont(): opentype.Font {
  const glyph = {
    index: 1,
    advanceWidth: 620,
    getPath(x: number, y: number, fontSize: number) {
      const scale = fontSize / 1000
      return {
        commands: [
          { type: 'M' as const, x, y },
          { type: 'L' as const, x: x + 310 * scale, y: y + 1000 * scale },
          { type: 'L' as const, x: x + 620 * scale, y },
          { type: 'Z' as const },
        ],
      }
    },
  }
  return {
    unitsPerEm: 1000,
    ascender: 1000,
    charToGlyph: () => glyph as unknown as opentype.Glyph,
    getKerningValue: () => 0,
  } as unknown as opentype.Font
}

function createSpatialManifest(): Cinema2NativePresetManifest {
  const parentId = cinema2StableId<Cinema2SceneNodeId>('spatial-parent')
  const childId = cinema2StableId<Cinema2SceneNodeId>('spatial-child')
  return {
    schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
    schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
    id: cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.test-spatial-runtime'),
    revision: 1,
    metadata: { name: 'Spatial Runtime Test' },
    scene: {
      nodes: [
        {
          id: parentId,
          kind: 'group',
          coordinateSpace: 'world',
          transform: { position: [1, 0, 0], rotation: [0, 0, Math.PI / 2], scale: [1, 1, 1] },
        },
        {
          id: childId,
          kind: 'primitive',
          parent: cinema2Ref(parentId),
          transform: { position: [1, 0, 0] },
        },
      ],
      roots: [cinema2Ref(parentId)],
    },
  }
}

function createHybridManifest(): Cinema2NativePresetManifest {
  const presetId = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.test-object3d-production')
  const backgroundId = cinema2StableId<Cinema2ModuleId>('hybrid-background')
  const objectId = cinema2StableId<Cinema2ModuleId>('hybrid-object3d')
  const screenRootId = cinema2StableId<Cinema2SceneNodeId>('hybrid-screen-root')
  const screenNodeId = cinema2StableId<Cinema2SceneNodeId>('hybrid-screen-node')
  const worldRootId = cinema2StableId<Cinema2SceneNodeId>('hybrid-world-root')
  const nearNodeId = cinema2StableId<Cinema2SceneNodeId>('hybrid-object-near')
  const farNodeId = cinema2StableId<Cinema2SceneNodeId>('hybrid-object-far')
  const screenLayerId = cinema2StableId<Cinema2LayerId>('hybrid-screen-layer')
  const worldLayerId = cinema2StableId<Cinema2LayerId>('hybrid-world-layer')
  const targetId = cinema2StableId<Cinema2RenderTargetId>('hybrid-color-depth-target')
  const scenePassId = cinema2StableId<Cinema2RenderPassId>('hybrid-scene-pass')
  const outputPassId = cinema2StableId<Cinema2RenderPassId>('hybrid-output-pass')
  const colorOutputId = cinema2StableId<Cinema2RenderSlotId>('hybrid-color')
  const depthOutputId = cinema2StableId<Cinema2RenderSlotId>('hybrid-depth')
  const outputInputId = cinema2StableId<Cinema2RenderSlotId>('hybrid-output-input')

  return {
    schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
    schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
    id: presetId,
    revision: 1,
    metadata: { name: 'Object3D Production Path Test' },
    capabilities: [
      { id: 'render.webgl2', requirement: 'required' },
      { id: 'render.depth', requirement: 'required' },
      { id: 'scene.3d', requirement: 'required' },
    ],
    modules: [
      { id: backgroundId, typeId: CINEMA2_FULLSCREEN_SHADER_MODULE_TYPE_ID, version: 1 },
      {
        id: objectId,
        typeId: CINEMA2_OBJECT3D_MODULE_TYPE_ID,
        version: 1,
        parameters: { color: [0.8, 0.9, 1, 1], emissiveIntensity: 0.25 },
        config: {
          source: {
            kind: 'svg',
            sourceId: 'stage12a-test-svg',
            revision: 1,
            rawSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80"/></svg>',
          },
          material: { color: [1, 1, 1, 1], emissiveIntensity: 0 },
        },
      },
    ],
    scene: {
      nodes: [
        { id: screenRootId, kind: 'group', coordinateSpace: 'normalized-screen' },
        { id: screenNodeId, kind: 'module', parent: cinema2Ref(screenRootId), module: cinema2Ref(backgroundId) },
        { id: worldRootId, kind: 'group', coordinateSpace: 'world' },
        { id: farNodeId, kind: 'module', parent: cinema2Ref(worldRootId), module: cinema2Ref(objectId), transform: { position: [0, 0, -2] } },
        { id: nearNodeId, kind: 'module', parent: cinema2Ref(worldRootId), module: cinema2Ref(objectId), transform: { position: [0.15, 0.15, 1] } },
      ],
      roots: [cinema2Ref(screenRootId), cinema2Ref(worldRootId)],
    },
    layers: [
      { id: screenLayerId, label: 'Screen', source: cinema2Ref(screenRootId), order: 0, depthPolicy: 'disabled' },
      { id: worldLayerId, label: 'World', source: cinema2Ref(worldRootId), order: 1, depthPolicy: 'read-write' },
    ],
    render: {
      targets: [{
        id: targetId,
        descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba8', depthFormat: 'depth24' },
        ownership: 'transient',
      }],
      passes: [
        {
          id: scenePassId,
          kind: 'scene',
          layers: [cinema2Ref(screenLayerId), cinema2Ref(worldLayerId)],
          outputs: [
            { id: colorOutputId, target: cinema2Ref(targetId), attachment: 'color' },
            { id: depthOutputId, target: cinema2Ref(targetId), attachment: 'depth' },
          ],
        },
        {
          id: outputPassId,
          kind: 'output',
          dependsOn: [cinema2Ref(scenePassId)],
          inputs: [{
            id: outputInputId,
            source: { pass: cinema2Ref(scenePassId), output: colorOutputId },
            attachment: 'color',
          }],
        },
      ],
      outputPass: cinema2Ref(outputPassId),
    },
  }
}

describe('Cinema 2.0 Stage 12A spatial/Object3D foundation', () => {
  it('resolves target-driven Transform3D hierarchy and visibility without mutating the compiled Scene Graph', () => {
    const manifest = createSpatialManifest()
    const compilation = compileCinema2NativePreset(manifest)
    expect(compilation.ok).toBe(true)
    if (!compilation.ok) return
    const resolver = new Cinema2FinalValueResolver(compilation.plan.targets)
    const spatial = new Cinema2SpatialRuntime(compilation.plan.scene, compilation.plan.targets.targets, resolver)
    const parentId = manifest.scene!.nodes[0].id
    const childId = manifest.scene!.nodes[1].id

    expect(spatial.resolveNode(childId)?.worldPosition.map(value => Number(value.toFixed(6)))).toEqual([1, 1, 0])
    const positionTarget = compilation.plan.targets.targets.find(target => target.kind === 'scene-node' && target.ownerId === parentId && target.property === 'transform.position')
    const visibilityTarget = compilation.plan.targets.targets.find(target => target.kind === 'scene-node' && target.ownerId === childId && target.property === 'visible')
    expect(positionTarget).toBeDefined()
    expect(visibilityTarget).toBeDefined()
    if (!positionTarget || !visibilityTarget) return

    expect(resolver.replaceTransientContributions('choreography', [
      { targetId: positionTarget.id, contribution: { contributorId: 'choreography:test-position', operation: 'replace', value: [2, 0, 0] } },
      { targetId: visibilityTarget.id, contribution: { contributorId: 'choreography:test-visible', operation: 'replace', value: false } },
    ])).toMatchObject({ applied: true })

    expect(spatial.resolveNode(childId)?.worldPosition.map(value => Number(value.toFixed(6)))).toEqual([2, 1, 0])
    expect(spatial.resolveNode(childId)?.visible).toBe(false)
    expect(compilation.plan.scene.nodes.find(node => node.id === childId)?.effectiveVisible).toBe(true)
    spatial.dispose()
    expect(spatial.resolveNode(childId)).toBeNull()
  })

  it('hosts reusable SVG and OpenType text geometry under the same Object3D module contract', () => {
    const svg = compileCinema2Object3DSvgGeometry({
      sourceId: 'stage12a-svg',
      revision: 1,
      rawSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M2 2 H18 V18 H2 Z"/></svg>',
    })
    const text = compileCinema2Object3DTextGeometry({
      font: fixtureFont(),
      fontIdentity: 'stage12a-fixture-font',
      text: 'A',
    })
    expect(svg.ok).toBe(true)
    expect(text.ok).toBe(true)
    if (svg.ok) expect(svg.value.mesh.indices.length).toBeGreaterThan(0)
    if (text.ok) expect(text.value.mesh.indices.length).toBeGreaterThan(0)

    expect(cinema2Object3DModuleDefinition.validate?.({
      id: cinema2StableId<Cinema2ModuleId>('text-object'),
      typeId: CINEMA2_OBJECT3D_MODULE_TYPE_ID,
      version: 1,
      config: {
        source: {
          kind: 'text',
          sourceId: 'text-source',
          revision: 1,
          fontIdentity: 'font-v1',
          fontDataBase64: 'AA==',
          text: 'DVYDRM',
        },
      },
    })).toEqual([])
  })

  it('changes the camera-free foundation projection with aspect ratio while preserving vertical scale', () => {
    const square = createCinema2FoundationWorldToClip(400, 400)
    const wide = createCinema2FoundationWorldToClip(800, 400)
    expect(wide[0]).toBeCloseTo(square[0] / 2)
    expect(wide[5]).toBeCloseTo(square[5])
    expect(wide[10]).toBeCloseTo(square[10])
  })

  it('executes hybrid screen/world rendering through the real Cinema2Runtime path with depth and deterministic disposal', () => {
    const manifest = createHybridManifest()
    const registry = new Cinema2PresetRegistry()
    expect(registry.register(manifest)).toMatchObject({ ok: true })
    const gl = createCinemaMockWebGL()
    const canvas = new FakeCanvas(gl)
    const raf = createRafHarness()
    const created = Cinema2Runtime.create(canvas as unknown as HTMLCanvasElement, {
      presetId: manifest.id,
      presetRegistry: registry,
      requestAnimationFrame: raf.requestAnimationFrame,
      cancelAnimationFrame: raf.cancelAnimationFrame,
    })
    if (!created.runtime) throw new Error(created.error)

    expect(created.runtime.getModuleRuntimeSnapshot()).toMatchObject({ activeModuleCount: 2, failedModuleCount: 0 })
    expect(created.runtime.getRenderGraph().passes[0]).toMatchObject({ kind: 'scene' })
    expect(created.runtime.getSpatialRuntime().resolveModuleNodes(cinema2StableId<Cinema2ModuleId>('hybrid-object3d'))).toHaveLength(2)
    expect(created.runtime.resize({ width: 800, height: 400, dpr: 1 })).toBe(true)
    created.runtime.start()
    raf.runNext(16.67)

    expect(created.runtime.getRenderGraphExecutorSnapshot()).toMatchObject({ executedPassCount: 2, failedPassCount: 0 })
    expect(gl.__calls.createdRenderbuffers).toBeGreaterThanOrEqual(1)
    expect(gl.enable).toHaveBeenCalledWith(gl.DEPTH_TEST)
    expect(gl.depthFunc).toHaveBeenCalledWith(gl.LEQUAL)
    expect(gl.clear).toHaveBeenCalledWith(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    expect(gl.drawElements).toHaveBeenCalledTimes(2)
    expect(gl.__calls.drawCount).toBeGreaterThanOrEqual(3)

    const createdBuffers = gl.__calls.createdBuffers
    const createdVaos = gl.__calls.createdVertexArrays
    const createdPrograms = gl.__calls.createdPrograms
    const createdRenderbuffers = gl.__calls.createdRenderbuffers
    created.runtime.dispose()

    expect(gl.__calls.deletedBuffers).toBe(createdBuffers)
    expect(gl.__calls.deletedVertexArrays).toBe(createdVaos)
    expect(gl.__calls.deletedPrograms).toBe(createdPrograms)
    expect(gl.__calls.deletedRenderbuffers).toBe(createdRenderbuffers)
    expect(created.runtime.getResourceManagerSnapshot()).toMatchObject({ disposed: true, activeLeaseCount: 0, estimatedGpuMemoryBytes: 0 })
  })
})
