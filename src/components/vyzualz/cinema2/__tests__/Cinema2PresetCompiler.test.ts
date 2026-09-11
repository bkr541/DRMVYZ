import { describe, expect, it } from 'vitest'
import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  Cinema2PresetRegistry,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  compileCinema2NativePreset,
  type Cinema2CameraId,
  type Cinema2ChoreographyActionId,
  type Cinema2ChoreographyRuleId,
  type Cinema2EffectId,
  type Cinema2LayerId,
  type Cinema2MediaSlotId,
  type Cinema2ModuleId,
  type Cinema2ModuleTypeId,
  type Cinema2NativePresetManifest,
  type Cinema2ParameterId,
  type Cinema2PresetId,
  type Cinema2RenderPassId,
  type Cinema2SceneNodeId,
  type Cinema2VariationId,
} from '..'

function minimalManifest(id = 'drmvyz.cinema2.test-minimal'): Cinema2NativePresetManifest {
  return {
    schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
    schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
    id: cinema2NamespacedId<Cinema2PresetId>(id),
    revision: 1,
    metadata: { name: 'Compiler Test' },
  }
}

describe('Cinema 2.0 native preset compiler', () => {
  it('compiles a neutral minimal manifest and synthesizes deterministic safe-clear intent', () => {
    const result = compileCinema2NativePreset(minimalManifest())

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected compile success')
    expect(result.plan.render).toEqual({
      intent: 'safe-clear',
      synthesized: true,
      passOrder: [],
      outputPassId: null,
    })
    expect(result.plan.scene).toEqual({ rootNodeIds: [], nodeIds: [], layerOrder: [] })
    expect(result.plan.capabilities.availabilityResolved).toBe(false)
    expect(Object.isFrozen(result.plan)).toBe(true)
    expect(Object.isFrozen(result.plan.manifest)).toBe(true)
  })

  it('rejects malformed optional subsystem envelopes instead of treating them as omitted', () => {
    const result = compileCinema2NativePreset({
      ...minimalManifest(),
      render: {},
      scene: { roots: [] },
    })

    expect(result.ok).toBe(false)
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CINEMA2_PRESET_SCHEMA_INVALID', path: '$.render.passes' }),
      expect.objectContaining({ code: 'CINEMA2_PRESET_SCHEMA_INVALID', path: '$.scene.nodes' }),
    ]))
  })

  it('rejects unsupported schema versions before nested planning', () => {
    const result = compileCinema2NativePreset({
      ...minimalManifest(),
      schemaVersion: 999,
    })

    expect(result.ok).toBe(false)
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'CINEMA2_MANIFEST_SCHEMA_VERSION_UNSUPPORTED',
        path: '$.schemaVersion',
        severity: 'error',
      }),
    ]))
  })

  it('rejects duplicate IDs inside a native domain', () => {
    const parameterId = cinema2StableId<Cinema2ParameterId>('amount')
    const result = compileCinema2NativePreset({
      ...minimalManifest(),
      parameters: [
        { id: parameterId, label: 'Amount A', type: 'float', defaultValue: 0 },
        { id: parameterId, label: 'Amount B', type: 'float', defaultValue: 0 },
      ],
    })

    expect(result.ok).toBe(false)
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CINEMA2_PRESET_DUPLICATE_ID', path: '$.parameters[1].id' }),
    ]))
  })

  it('rejects missing references across modules, scene, layers, render, choreography, defaults and output', () => {
    const moduleId = cinema2StableId<Cinema2ModuleId>('hero-module')
    const nodeId = cinema2StableId<Cinema2SceneNodeId>('hero-node')
    const layerId = cinema2StableId<Cinema2LayerId>('hero-layer')
    const passId = cinema2StableId<Cinema2RenderPassId>('main-pass')
    const actionId = cinema2StableId<Cinema2ChoreographyActionId>('action')
    const ruleId = cinema2StableId<Cinema2ChoreographyRuleId>('rule')
    const missingMedia = cinema2StableId<Cinema2MediaSlotId>('missing-media')
    const missingNode = cinema2StableId<Cinema2SceneNodeId>('missing-node')
    const missingLayer = cinema2StableId<Cinema2LayerId>('missing-layer')
    const missingEffect = cinema2StableId<Cinema2EffectId>('missing-effect')
    const missingCamera = cinema2StableId<Cinema2CameraId>('missing-camera')
    const missingVariation = cinema2StableId<Cinema2VariationId>('missing-variation')
    const missingParameter = cinema2StableId<Cinema2ParameterId>('missing-parameter')

    const result = compileCinema2NativePreset({
      ...minimalManifest(),
      modules: [{
        id: moduleId,
        typeId: cinema2StableId<Cinema2ModuleTypeId>('generator'),
        version: 1,
        media: { source: cinema2Ref(missingMedia) },
      }],
      scene: {
        nodes: [{ id: nodeId, kind: 'module', module: cinema2Ref(moduleId) }],
        roots: [cinema2Ref(missingNode)],
      },
      layers: [{ id: layerId, label: 'Layer', source: cinema2Ref(missingNode) }],
      render: {
        passes: [{
          id: passId,
          kind: 'effect',
          layers: [cinema2Ref(missingLayer)],
          effect: cinema2Ref(missingEffect),
        }],
      },
      choreography: {
        rules: [{
          id: ruleId,
          priority: 0,
          source: { signal: 'beat', capability: 'music.beat' },
          actions: [{
            id: actionId,
            target: { kind: 'parameter', ref: cinema2Ref(missingParameter) },
            operation: 'set',
            value: 1,
          }],
        }],
      },
      defaults: {
        camera: cinema2Ref(missingCamera),
        variation: cinema2Ref(missingVariation),
      },
      output: { renderPass: cinema2Ref(cinema2StableId<Cinema2RenderPassId>('missing-pass')) },
    })

    expect(result.ok).toBe(false)
    const missingDiagnostics = result.diagnostics.filter(diagnostic => diagnostic.code === 'CINEMA2_PRESET_REFERENCE_MISSING')
    expect(missingDiagnostics.length).toBeGreaterThanOrEqual(8)
    expect(missingDiagnostics.map(diagnostic => diagnostic.path)).toEqual(expect.arrayContaining([
      '$.modules[0].media.source',
      '$.scene.roots[0]',
      '$.layers[0].source',
      '$.render.passes[0].layers[0]',
      '$.render.passes[0].effect',
      '$.choreography.rules[0].actions[0].target.ref',
      '$.defaults.camera',
      '$.defaults.variation',
      '$.output.renderPass',
    ]))
  })

  it('rejects unsupported node and choreography capability combinations', () => {
    const nodeId = cinema2StableId<Cinema2SceneNodeId>('bad-node')
    const moduleId = cinema2StableId<Cinema2ModuleId>('module')
    const ruleId = cinema2StableId<Cinema2ChoreographyRuleId>('rule')
    const actionId = cinema2StableId<Cinema2ChoreographyActionId>('action')
    const parameterId = cinema2StableId<Cinema2ParameterId>('amount')
    const result = compileCinema2NativePreset({
      ...minimalManifest(),
      parameters: [{ id: parameterId, label: 'Amount', type: 'float', defaultValue: 0 }],
      modules: [{ id: moduleId, typeId: cinema2StableId<Cinema2ModuleTypeId>('generator'), version: 1 }],
      scene: { nodes: [{ id: nodeId, kind: 'group', module: cinema2Ref(moduleId) }] },
      choreography: {
        rules: [{
          id: ruleId,
          priority: 1,
          source: { signal: 'drop', capability: 'music.beat' },
          actions: [{ id: actionId, target: { kind: 'parameter', ref: cinema2Ref(parameterId) }, operation: 'set', value: 1 }],
        }],
      },
    })

    expect(result.ok).toBe(false)
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CINEMA2_PRESET_COMBINATION_INVALID', path: '$.scene.nodes[0]' }),
      expect.objectContaining({ code: 'CINEMA2_PRESET_CAPABILITY_COMBINATION_INVALID', path: '$.choreography.rules[0].source.capability' }),
    ]))
  })

  it('keeps optional subsystem omission valid and synthesizes scene-output intent only when scene content exists', () => {
    const nodeId = cinema2StableId<Cinema2SceneNodeId>('primitive')
    const result = compileCinema2NativePreset({
      ...minimalManifest(),
      scene: { nodes: [{ id: nodeId, kind: 'primitive' }] },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected compile success')
    expect(result.plan.render).toMatchObject({ intent: 'scene-output', synthesized: true })
    expect(result.plan.scene.rootNodeIds).toEqual([nodeId])
  })

  it('resolves required and optional capability availability without inventing fallback values', () => {
    const manifest: Cinema2NativePresetManifest = {
      ...minimalManifest(),
      capabilities: [
        { id: 'render.webgl2', requirement: 'required' },
        { id: 'music.drop', requirement: 'optional' },
      ],
    }
    const success = compileCinema2NativePreset(manifest, { availableCapabilities: ['render.webgl2'] })
    expect(success.ok).toBe(true)
    if (!success.ok) throw new Error('Expected compile success')
    expect(success.plan.capabilities).toMatchObject({
      required: ['render.webgl2'],
      optional: ['music.drop'],
      unavailableOptional: ['music.drop'],
      availabilityResolved: true,
    })
    expect(success.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CINEMA2_PRESET_OPTIONAL_CAPABILITY_UNAVAILABLE', severity: 'warning' }),
    ]))
    expect(JSON.stringify(success.plan)).not.toContain('fallbackValue')

    const failure = compileCinema2NativePreset(manifest, { availableCapabilities: [] })
    expect(failure.ok).toBe(false)
    expect(failure.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CINEMA2_PRESET_REQUIRED_CAPABILITY_UNAVAILABLE', severity: 'error' }),
    ]))
  })

  it('topologically compiles authored render dependencies and returns byte-stable output for repeated compiles', () => {
    const nodeId = cinema2StableId<Cinema2SceneNodeId>('scene')
    const layerId = cinema2StableId<Cinema2LayerId>('layer')
    const scenePassId = cinema2StableId<Cinema2RenderPassId>('scene-pass')
    const outputPassId = cinema2StableId<Cinema2RenderPassId>('output-pass')
    const manifest: Cinema2NativePresetManifest = {
      ...minimalManifest(),
      scene: { nodes: [{ id: nodeId, kind: 'primitive' }] },
      layers: [{ id: layerId, label: 'Layer', source: cinema2Ref(nodeId), order: 20 }],
      render: {
        passes: [
          { id: outputPassId, kind: 'output', dependsOn: [cinema2Ref(scenePassId)] },
          { id: scenePassId, kind: 'scene', layers: [cinema2Ref(layerId)] },
        ],
      },
    }

    const first = compileCinema2NativePreset(manifest)
    const second = compileCinema2NativePreset(manifest)
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    if (!first.ok || !second.ok) throw new Error('Expected compile success')
    expect(first.plan.render).toEqual({
      intent: 'authored-render-graph',
      synthesized: false,
      passOrder: [scenePassId, outputPassId],
      outputPassId,
    })
    expect(JSON.stringify(first.plan)).toBe(JSON.stringify(second.plan))
  })

  it('keeps registry identity independent and rejects duplicate preset registrations', () => {
    const registry = new Cinema2PresetRegistry()
    const manifest = minimalManifest('drmvyz.cinema2.registry-test')
    expect(registry.register(manifest).ok).toBe(true)
    const duplicate = registry.register(manifest)
    expect(duplicate.ok).toBe(false)
    expect(duplicate.diagnostics[0]?.code).toBe('CINEMA2_PRESET_REGISTRY_DUPLICATE_ID')
    expect(registry.list()).toHaveLength(1)
  })
})
