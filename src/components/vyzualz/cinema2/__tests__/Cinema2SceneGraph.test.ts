import { describe, expect, it } from 'vitest'
import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  compileCinema2NativePreset,
  type Cinema2CameraId,
  type Cinema2LayerId,
  type Cinema2LightId,
  type Cinema2ModuleId,
  type Cinema2ModuleTypeId,
  type Cinema2NativePresetManifest,
  type Cinema2PresetId,
  type Cinema2SceneNodeId,
} from '..'

const presetId = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.scene-graph-test')
const rootId = cinema2StableId<Cinema2SceneNodeId>('root')
const childAId = cinema2StableId<Cinema2SceneNodeId>('child-a')
const childBId = cinema2StableId<Cinema2SceneNodeId>('child-b')
const moduleId = cinema2StableId<Cinema2ModuleId>('generator')
const layerAId = cinema2StableId<Cinema2LayerId>('layer-a')
const layerBId = cinema2StableId<Cinema2LayerId>('layer-b')
const cameraId = cinema2StableId<Cinema2CameraId>('camera')
const lightId = cinema2StableId<Cinema2LightId>('light')

function baseManifest(): Cinema2NativePresetManifest {
  return {
    schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
    schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
    id: presetId,
    revision: 1,
    metadata: { name: 'Scene Graph Test' },
  }
}

function compiled(manifest: Cinema2NativePresetManifest) {
  const result = compileCinema2NativePreset(manifest)
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.diagnostics.map(diagnostic => diagnostic.message).join('; '))
  return result.plan.scene
}

describe('Cinema 2.0 Scene Graph and layer foundation', () => {
  it('supports screen, normalized-screen and world roots in one renderer-independent contract', () => {
    const screen = cinema2StableId<Cinema2SceneNodeId>('screen')
    const normalized = cinema2StableId<Cinema2SceneNodeId>('normalized')
    const world = cinema2StableId<Cinema2SceneNodeId>('world')
    const scene = compiled({
      ...baseManifest(),
      scene: {
        nodes: [
          { id: screen, kind: 'primitive', coordinateSpace: 'screen' },
          { id: normalized, kind: 'primitive', coordinateSpace: 'normalized-screen' },
          { id: world, kind: 'primitive', coordinateSpace: 'world' },
        ],
      },
    })

    expect(scene.nodes.map(node => [node.id, node.coordinateSpace])).toEqual([
      [normalized, 'normalized-screen'],
      [screen, 'screen'],
      [world, 'world'],
    ])
    expect(JSON.stringify(scene)).not.toContain('framebuffer')
    expect(JSON.stringify(scene)).not.toContain('renderTarget')
    expect(JSON.stringify(scene)).not.toContain('passOrder')
  })

  it('resolves parent transforms, inherited visibility and deterministic parent-before-child traversal', () => {
    const scene = compiled({
      ...baseManifest(),
      modules: [{ id: moduleId, typeId: cinema2StableId<Cinema2ModuleTypeId>('generator-type'), version: 1 }],
      scene: {
        nodes: [
          {
            id: childBId,
            kind: 'primitive',
            parent: cinema2Ref(rootId),
            transform: { position: [1, 0, 0] },
          },
          {
            id: rootId,
            kind: 'group',
            coordinateSpace: 'world',
            visible: false,
            transform: { position: [10, 0, 0], scale: [2, 2, 2] },
          },
          {
            id: childAId,
            kind: 'module',
            parent: cinema2Ref(rootId),
            module: cinema2Ref(moduleId),
            transform: { position: [3, 0, 0] },
          },
        ],
      },
    })

    expect(scene.rootNodeIds).toEqual([rootId])
    expect(scene.traversalOrder).toEqual([rootId, childAId, childBId])
    const childA = scene.nodes.find(node => node.id === childAId)
    expect(childA).toMatchObject({
      parentId: rootId,
      coordinateSpace: 'world',
      visible: true,
      effectiveVisible: false,
      moduleId,
    })
    expect(childA?.resolvedTransform.matrix[12]).toBe(16)
    expect(childA?.resolvedTransform.matrix[13]).toBe(0)
    expect(childA?.resolvedTransform.matrix[14]).toBe(0)
  })

  it('keeps layer order separate from hierarchy and compiles optional semantic/composition metadata', () => {
    const scene = compiled({
      ...baseManifest(),
      scene: { nodes: [
        { id: rootId, kind: 'group' },
        { id: childAId, kind: 'primitive', parent: cinema2Ref(rootId) },
      ] },
      layers: [
        {
          id: layerBId,
          label: 'Atmosphere',
          source: cinema2Ref(rootId),
          role: 'atmosphere',
          visible: false,
          opacity: 0.4,
          blendMode: 'screen',
          depthPolicy: 'read-only',
          order: 20,
        },
        {
          id: layerAId,
          label: 'Hero',
          source: cinema2Ref(rootId),
          opacity: 0.9,
          order: 10,
        },
      ],
    })

    expect(scene.traversalOrder).toEqual([rootId, childAId])
    expect(scene.layerOrder).toEqual([layerAId, layerBId])
    expect(scene.layers).toEqual([
      expect.objectContaining({
        id: layerAId,
        role: null,
        visible: true,
        opacity: 0.9,
        blendMode: 'normal',
        depthPolicy: 'disabled',
        compositionIndex: 0,
      }),
      expect.objectContaining({
        id: layerBId,
        role: 'atmosphere',
        visible: false,
        opacity: 0.4,
        blendMode: 'screen',
        depthPolicy: 'read-only',
        compositionIndex: 1,
      }),
    ])
    expect(scene.nodes.find(node => node.id === rootId)?.layerIds).toEqual([layerAId, layerBId])
    expect(scene.nodes.find(node => node.id === childAId)?.layerIds).toEqual([layerAId, layerBId])
  })

  it('represents camera/light scene-node targets without moving camera or lighting runtime ownership into the graph', () => {
    const scene = compiled({
      ...baseManifest(),
      scene: { nodes: [{ id: rootId, kind: 'group', coordinateSpace: 'world' }] },
      cameras: [{ id: cameraId, label: 'Main', projection: 'perspective', targetNode: cinema2Ref(rootId) }],
      lighting: { lights: [{ id: lightId, type: 'spot', targetNode: cinema2Ref(rootId) }] },
    })

    expect(scene.nodes[0]).toMatchObject({
      targetedByCameraIds: [cameraId],
      targetedByLightIds: [lightId],
    })
    expect(scene.nodes[0]).not.toHaveProperty('cameraState')
    expect(scene.nodes[0]).not.toHaveProperty('lightState')
  })

  it('rejects missing parents, cycles, missing layer/module references and invalid cross-space hierarchy before render execution', () => {
    const missing = cinema2StableId<Cinema2SceneNodeId>('missing')
    const missingModule = cinema2StableId<Cinema2ModuleId>('missing-module')
    const result = compileCinema2NativePreset({
      ...baseManifest(),
      scene: {
        nodes: [
          {
            id: rootId,
            kind: 'group',
            parent: cinema2Ref(childAId),
            coordinateSpace: 'world',
          },
          {
            id: childAId,
            kind: 'module',
            parent: cinema2Ref(rootId),
            coordinateSpace: 'screen',
            module: cinema2Ref(missingModule),
          },
          {
            id: childBId,
            kind: 'primitive',
            parent: cinema2Ref(missing),
          },
        ],
      },
      layers: [{ id: layerAId, label: 'Broken', source: cinema2Ref(missing) }],
    })

    expect(result.ok).toBe(false)
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CINEMA2_SCENE_PARENT_CYCLE', path: '$.scene.nodes' }),
      expect.objectContaining({ code: 'CINEMA2_SCENE_COORDINATE_SPACE_MISMATCH', path: '$.scene.nodes[1].coordinateSpace' }),
      expect.objectContaining({ code: 'CINEMA2_PRESET_REFERENCE_MISSING', path: '$.scene.nodes[1].module' }),
      expect.objectContaining({ code: 'CINEMA2_PRESET_REFERENCE_MISSING', path: '$.scene.nodes[2].parent' }),
      expect.objectContaining({ code: 'CINEMA2_PRESET_REFERENCE_MISSING', path: '$.layers[0].source' }),
    ]))
  })


  it('rejects a cross-space child even when the parent inherits its space from an ancestor', () => {
    const middleId = cinema2StableId<Cinema2SceneNodeId>('middle')
    const result = compileCinema2NativePreset({
      ...baseManifest(),
      scene: {
        nodes: [
          { id: rootId, kind: 'group', coordinateSpace: 'world' },
          { id: middleId, kind: 'group', parent: cinema2Ref(rootId) },
          { id: childAId, kind: 'primitive', parent: cinema2Ref(middleId), coordinateSpace: 'screen' },
        ],
      },
    })

    expect(result.ok).toBe(false)
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CINEMA2_SCENE_COORDINATE_SPACE_MISMATCH', path: '$.scene.nodes[2].coordinateSpace' }),
    ]))
  })

  it('rejects malformed coordinate, transform and layer metadata instead of fabricating valid-looking defaults', () => {
    const result = compileCinema2NativePreset({
      ...baseManifest(),
      scene: {
        nodes: [{
          id: rootId,
          kind: 'primitive',
          coordinateSpace: 'clip-space' as never,
          transform: { position: [Number.NaN, 0, 0] },
        }],
      },
      layers: [{
        id: layerAId,
        label: 'Broken',
        source: cinema2Ref(rootId),
        opacity: 2,
        blendMode: 'xor' as never,
        depthPolicy: 'shared' as never,
      }],
    })

    expect(result.ok).toBe(false)
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CINEMA2_SCENE_COORDINATE_SPACE_INVALID' }),
      expect.objectContaining({ code: 'CINEMA2_SCENE_TRANSFORM_INVALID', path: '$.scene.nodes[0].transform.position' }),
      expect.objectContaining({ code: 'CINEMA2_SCENE_LAYER_OPACITY_INVALID' }),
      expect.objectContaining({ code: 'CINEMA2_SCENE_LAYER_BLEND_INVALID' }),
      expect.objectContaining({ code: 'CINEMA2_SCENE_LAYER_DEPTH_POLICY_INVALID' }),
    ]))
  })
})
