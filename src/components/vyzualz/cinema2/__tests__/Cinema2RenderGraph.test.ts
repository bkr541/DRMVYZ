import { describe, expect, it } from 'vitest'
import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  compileCinema2RenderGraph,
  type Cinema2LayerId,
  type Cinema2ModuleId,
  type Cinema2ModuleTypeId,
  type Cinema2NativePresetManifest,
  type Cinema2PresetId,
  type Cinema2RenderPassId,
  type Cinema2RenderSlotId,
  type Cinema2RenderTargetId,
  type Cinema2SceneNodeId,
} from '..'

function manifest(id = 'drmvyz.cinema2.render-graph-test'): Cinema2NativePresetManifest {
  return {
    schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
    schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
    id: cinema2NamespacedId<Cinema2PresetId>(id),
    revision: 1,
    metadata: { name: 'Render Graph Test' },
  }
}

describe('Cinema 2.0 render graph compiler', () => {
  it('compiles deterministic dependencies, target bindings, entity handles and declarative gates', () => {
    const moduleId = cinema2StableId<Cinema2ModuleId>('source-module')
    const nodeId = cinema2StableId<Cinema2SceneNodeId>('source-node')
    const layerId = cinema2StableId<Cinema2LayerId>('source-layer')
    const sourcePassId = cinema2StableId<Cinema2RenderPassId>('source-pass')
    const outputPassId = cinema2StableId<Cinema2RenderPassId>('output-pass')
    const targetId = cinema2StableId<Cinema2RenderTargetId>('source-target')
    const colorOutputId = cinema2StableId<Cinema2RenderSlotId>('color-out')
    const colorInputId = cinema2StableId<Cinema2RenderSlotId>('color-in')
    const value: Cinema2NativePresetManifest = {
      ...manifest(),
      capabilities: [{ id: 'render.webgl2', requirement: 'required' }],
      modules: [{ id: moduleId, typeId: cinema2StableId<Cinema2ModuleTypeId>('fullscreen-shader'), version: 1 }],
      scene: { nodes: [{ id: nodeId, kind: 'module', module: cinema2Ref(moduleId) }] },
      layers: [{ id: layerId, label: 'Source', source: cinema2Ref(nodeId) }],
      render: {
        targets: [{
          id: targetId,
          descriptor: { size: { kind: 'viewport', widthScale: 0.5, heightScale: 0.5 }, colorFormat: 'rgba8' },
        }],
        passes: [{
          id: outputPassId,
          kind: 'output',
          inputs: [{ id: colorInputId, source: { pass: cinema2Ref(sourcePassId), output: colorOutputId } }],
        }, {
          id: sourcePassId,
          kind: 'scene',
          layers: [cinema2Ref(layerId)],
          outputs: [{ id: colorOutputId, target: cinema2Ref(targetId), attachment: 'color' }],
          enabledWhen: [{ kind: 'capability-available', capability: 'render.webgl2' }],
          quality: { min: 'medium', max: 'high' },
        }],
      },
    }

    const first = compileCinema2RenderGraph(value)
    const second = compileCinema2RenderGraph(value)
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    if (!first.ok || !second.ok) throw new Error('Expected render graph compile success')

    expect(first.plan.passOrder).toEqual([sourcePassId, outputPassId])
    expect(first.plan.outputPassId).toBe(outputPassId)
    expect(first.plan.targets[0]).toMatchObject({ id: targetId, index: 0, ownership: 'transient' })
    expect(first.plan.passes[0]).toMatchObject({
      id: sourcePassId,
      kind: 'scene',
      layers: [{ id: layerId, index: 0 }],
      quality: { min: 'medium', max: 'high' },
    })
    expect(first.plan.passes[1].inputs[0]).toMatchObject({
      id: colorInputId,
      sourcePass: { id: sourcePassId, index: 0 },
      sourceOutputId: colorOutputId,
      attachment: 'color',
    })
    expect(Object.isFrozen(first.plan)).toBe(true)
    expect(Object.isFrozen(first.plan.passes[0])).toBe(true)
    expect(JSON.stringify(first.plan)).toBe(JSON.stringify(second.plan))
  })

  it('resolves module references into compiled handles', () => {
    const moduleId = cinema2StableId<Cinema2ModuleId>('module-a')
    const passId = cinema2StableId<Cinema2RenderPassId>('module-pass')
    const value: Cinema2NativePresetManifest = {
      ...manifest('drmvyz.cinema2.render-module-handle'),
      modules: [{ id: moduleId, typeId: cinema2StableId<Cinema2ModuleTypeId>('fullscreen-shader'), version: 1 }],
      render: { passes: [{ id: passId, kind: 'module', module: cinema2Ref(moduleId) }] },
    }

    const result = compileCinema2RenderGraph(value)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected render graph compile success')
    expect(result.plan.passes[0].module).toEqual({ id: moduleId, index: 0 })
  })

  it('detects cycles before execution', () => {
    const firstId = cinema2StableId<Cinema2RenderPassId>('first-pass')
    const secondId = cinema2StableId<Cinema2RenderPassId>('second-pass')
    const value: Cinema2NativePresetManifest = {
      ...manifest('drmvyz.cinema2.render-cycle'),
      render: {
        outputPass: cinema2Ref(secondId),
        passes: [
          { id: firstId, kind: 'output', dependsOn: [cinema2Ref(secondId)] },
          { id: secondId, kind: 'output', dependsOn: [cinema2Ref(firstId)] },
        ],
      },
    }

    const result = compileCinema2RenderGraph(value)
    expect(result.ok).toBe(false)
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CINEMA2_RENDER_GRAPH_CYCLE', path: '$.render.passes' }),
    ]))
  })

  it('rejects an input that names an output the source pass never declared', () => {
    const sourcePassId = cinema2StableId<Cinema2RenderPassId>('source-pass')
    const compositePassId = cinema2StableId<Cinema2RenderPassId>('composite-pass')
    const actualOutputId = cinema2StableId<Cinema2RenderSlotId>('actual-output')
    const missingOutputId = cinema2StableId<Cinema2RenderSlotId>('missing-output')
    const inputId = cinema2StableId<Cinema2RenderSlotId>('input')
    const nodeId = cinema2StableId<Cinema2SceneNodeId>('node')
    const value: Cinema2NativePresetManifest = {
      ...manifest('drmvyz.cinema2.render-missing-output'),
      scene: { nodes: [{ id: nodeId, kind: 'primitive' }] },
      render: {
        outputPass: cinema2Ref(compositePassId),
        passes: [
          { id: sourcePassId, kind: 'scene', scene: cinema2Ref(nodeId), outputs: [{ id: actualOutputId }] },
          { id: compositePassId, kind: 'composite', inputs: [{ id: inputId, source: { pass: cinema2Ref(sourcePassId), output: missingOutputId } }] },
        ],
      },
    }

    const result = compileCinema2RenderGraph(value)
    expect(result.ok).toBe(false)
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CINEMA2_RENDER_INPUT_OUTPUT_MISSING', path: '$.render.passes[1].inputs[0].source.output' }),
    ]))
  })

  it('rejects a malformed explicit output-pass reference instead of silently inferring one', () => {
    const passId = cinema2StableId<Cinema2RenderPassId>('output-pass')
    const value = {
      ...manifest('drmvyz.cinema2.render-invalid-output-ref'),
      render: {
        passes: [{ id: passId, kind: 'output' }],
        outputPass: { $ref: '' },
      },
    } as unknown as Cinema2NativePresetManifest

    const result = compileCinema2RenderGraph(value)
    expect(result.ok).toBe(false)
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'CINEMA2_RENDER_OUTPUT_PASS_INVALID',
      path: '$.render.outputPass',
    }))
  })

  it('rejects duplicate pass and output IDs', () => {
    const passId = cinema2StableId<Cinema2RenderPassId>('duplicate-pass')
    const outputId = cinema2StableId<Cinema2RenderSlotId>('duplicate-output')
    const nodeId = cinema2StableId<Cinema2SceneNodeId>('node')
    const value: Cinema2NativePresetManifest = {
      ...manifest('drmvyz.cinema2.render-duplicates'),
      scene: { nodes: [{ id: nodeId, kind: 'primitive' }] },
      render: {
        passes: [
          { id: passId, kind: 'scene', scene: cinema2Ref(nodeId), outputs: [{ id: outputId }, { id: outputId }] },
          { id: passId, kind: 'output' },
        ],
      },
    }

    const result = compileCinema2RenderGraph(value)
    expect(result.ok).toBe(false)
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CINEMA2_RENDER_PASS_ID_DUPLICATE' }),
      expect.objectContaining({ code: 'CINEMA2_RENDER_OUTPUT_ID_DUPLICATE' }),
    ]))
  })

  it('validates target descriptors, depth attachments, conditions and quality gates', () => {
    const invalidTargetId = cinema2StableId<Cinema2RenderTargetId>('invalid-target')
    const targetId = cinema2StableId<Cinema2RenderTargetId>('target')
    const passId = cinema2StableId<Cinema2RenderPassId>('scene-pass')
    const outputId = cinema2StableId<Cinema2RenderSlotId>('depth-output')
    const nodeId = cinema2StableId<Cinema2SceneNodeId>('node')
    const value = {
      ...manifest('drmvyz.cinema2.render-validation'),
      scene: { nodes: [{ id: nodeId, kind: 'primitive' }] },
      render: {
        targets: [
          { id: invalidTargetId, descriptor: { size: { kind: 'fixed', width: 0, height: 128 }, colorFormat: 'rgba8' } },
          { id: targetId, descriptor: { size: { kind: 'fixed', width: 128, height: 128 }, colorFormat: 'rgba8', depthFormat: 'none' } },
        ],
        passes: [{
          id: passId,
          kind: 'scene',
          scene: cinema2Ref(nodeId),
          outputs: [{ id: outputId, target: cinema2Ref(targetId), attachment: 'depth' }],
          enabledWhen: [{ kind: 'capability-available', capability: 'render.not-real' }],
          quality: { min: 'high', max: 'low' },
        }],
      },
    } as unknown as Cinema2NativePresetManifest

    const result = compileCinema2RenderGraph(value)
    expect(result.ok).toBe(false)
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CINEMA2_RENDER_TARGET_SIZE_INVALID' }),
      expect.objectContaining({ code: 'CINEMA2_RENDER_ATTACHMENT_UNAVAILABLE' }),
      expect.objectContaining({ code: 'CINEMA2_RENDER_CONDITION_CAPABILITY_INVALID' }),
      expect.objectContaining({ code: 'CINEMA2_RENDER_QUALITY_RANGE_INVALID' }),
    ]))
  })

  it('synthesizes exactly one deterministic pass when topology is omitted', () => {
    const nodeId = cinema2StableId<Cinema2SceneNodeId>('node')
    const layerId = cinema2StableId<Cinema2LayerId>('layer')
    const value: Cinema2NativePresetManifest = {
      ...manifest('drmvyz.cinema2.render-synthesis'),
      scene: { nodes: [{ id: nodeId, kind: 'primitive' }] },
      layers: [{ id: layerId, label: 'Layer', source: cinema2Ref(nodeId) }],
    }

    const result = compileCinema2RenderGraph(value)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected render graph compile success')
    expect(result.plan).toMatchObject({
      intent: 'scene-output',
      synthesized: true,
      passOrder: ['auto-scene-output'],
      outputPassId: 'auto-scene-output',
    })
    expect(result.plan.passes).toHaveLength(1)
    expect(result.plan.passes[0]).toMatchObject({ kind: 'scene', layers: [{ id: layerId, index: 0 }] })
  })
})
