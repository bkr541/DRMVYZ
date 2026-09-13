import { describe, expect, it, vi } from 'vitest'
import { createCinemaMockWebGL } from '../../cinema/__tests__/CinemaWebGLTestUtils'
import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  Cinema2FinalValueResolver,
  Cinema2ParameterState,
  Cinema2RenderGraphExecutor,
  Cinema2ResourceManager,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  compileCinema2NativePreset,
  type Cinema2LayerBlendMode,
  type Cinema2LayerId,
  type Cinema2ModuleId,
  type Cinema2ModuleRenderPassProvider,
  type Cinema2ModuleTypeId,
  type Cinema2NativePresetManifest,
  type Cinema2PresetId,
  type Cinema2RenderPassId,
  type Cinema2RenderSlotId,
  type Cinema2RenderTargetId,
  type Cinema2SceneNodeId,
} from '..'

const frame = Object.freeze({
  frameId: 1,
  timestampMs: 16,
  deltaTimeSec: 0,
  elapsedTimeSec: 0,
  viewport: Object.freeze({ width: 320, height: 180, dpr: 1 }),
  contextGeneration: 1,
  audio: null,
  director: null,
})

function moduleId(name: string): Cinema2ModuleId {
  return cinema2StableId<Cinema2ModuleId>(name)
}

function passId(name: string): Cinema2RenderPassId {
  return cinema2StableId<Cinema2RenderPassId>(name)
}

function slotId(name: string): Cinema2RenderSlotId {
  return cinema2StableId<Cinema2RenderSlotId>(name)
}

function targetId(name: string): Cinema2RenderTargetId {
  return cinema2StableId<Cinema2RenderTargetId>(name)
}

function nodeId(name: string): Cinema2SceneNodeId {
  return cinema2StableId<Cinema2SceneNodeId>(name)
}

function layerId(name: string): Cinema2LayerId {
  return cinema2StableId<Cinema2LayerId>(name)
}

function createExecutor(value: Cinema2NativePresetManifest) {
  const compiled = compileCinema2NativePreset(value, { availableCapabilities: ['render.webgl2'] })
  if (!compiled.ok) throw new Error(compiled.diagnostics.map(diagnostic => `${diagnostic.code}: ${diagnostic.message}`).join('; '))
  const gl = createCinemaMockWebGL()
  const resources = new Cinema2ResourceManager(gl)
  resources.resize({ width: frame.viewport.width, height: frame.viewport.height, dpr: 1 })
  const parameters = new Cinema2ParameterState(compiled.plan.parameters)
  const resolver = new Cinema2FinalValueResolver(compiled.plan.targets)
  const executor = new Cinema2RenderGraphExecutor(gl, compiled.plan.render, compiled.plan.scene, parameters, resources, {
    quality: 'high',
    availableCapabilities: ['render.webgl2'],
    targetResolver: resolver,
  })
  return { compiled: compiled.plan, executor, gl, resources, resolver }
}

function provider(id: Cinema2ModuleId, execute = vi.fn(), intent: 'fullscreen' | 'world' = 'fullscreen'): Cinema2ModuleRenderPassProvider {
  return { id: `${id}:provider`, moduleId: id, intent, execute }
}

function baseManifest(id: string): Cinema2NativePresetManifest {
  return {
    schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
    schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
    id: cinema2NamespacedId<Cinema2PresetId>(id),
    revision: 1,
    metadata: { name: 'Layer/Compositor/Depth Foundation Test' },
  }
}

describe('Cinema 2.0 layer/compositing/depth foundation', () => {
  it('derives depth sampleability from graph consumers and rejects same-target depth feedback', () => {
    const producerModule = moduleId('depth-compile-producer')
    const consumerModule = moduleId('depth-compile-consumer')
    const typeId = cinema2StableId<Cinema2ModuleTypeId>('depth-compile-type')
    const producerPass = passId('depth-compile-producer-pass')
    const consumerPass = passId('depth-compile-consumer-pass')
    const depthTarget = targetId('depth-compile-target')
    const depthOut = slotId('depth-compile-out')
    const base: Cinema2NativePresetManifest = {
      ...baseManifest('drmvyz.cinema2.depth-compile-foundation-test'),
      modules: [{ id: producerModule, typeId, version: 1 }, { id: consumerModule, typeId, version: 1 }],
      render: {
        targets: [{ id: depthTarget, descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba8', depthFormat: 'depth24' } }],
        passes: [{ id: producerPass, kind: 'module', module: cinema2Ref(producerModule), outputs: [{ id: depthOut, attachment: 'depth', target: cinema2Ref(depthTarget) }] }],
        outputPass: cinema2Ref(producerPass),
      },
    }
    const internalOnly = compileCinema2NativePreset(base, { availableCapabilities: ['render.webgl2'] })
    expect(internalOnly.ok).toBe(true)
    if (!internalOnly.ok) throw new Error('Expected internal-only depth graph to compile.')
    expect(internalOnly.plan.render.targets[0]?.sampleableDepth).toBe(false)

    const consumed: Cinema2NativePresetManifest = {
      ...base,
      id: cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.depth-compile-consumed-test'),
      render: {
        ...base.render!,
        passes: [
          ...base.render!.passes,
          { id: consumerPass, kind: 'module', module: cinema2Ref(consumerModule), inputs: [{ id: slotId('depth-compile-in'), attachment: 'depth', source: { pass: cinema2Ref(producerPass), output: depthOut } }] },
        ],
        outputPass: cinema2Ref(consumerPass),
      },
    }
    const sampled = compileCinema2NativePreset(consumed, { availableCapabilities: ['render.webgl2'] })
    expect(sampled.ok).toBe(true)
    if (!sampled.ok) throw new Error('Expected consumed depth graph to compile.')
    expect(sampled.plan.render.targets[0]?.sampleableDepth).toBe(true)

    const feedback: Cinema2NativePresetManifest = {
      ...consumed,
      id: cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.depth-feedback-rejected-test'),
      render: {
        ...consumed.render!,
        passes: [
          base.render!.passes[0],
          {
            id: consumerPass,
            kind: 'module',
            module: cinema2Ref(consumerModule),
            inputs: [{ id: slotId('depth-feedback-in'), attachment: 'depth', source: { pass: cinema2Ref(producerPass), output: depthOut } }],
            outputs: [{ id: slotId('depth-feedback-color'), attachment: 'color', target: cinema2Ref(depthTarget) }],
          },
        ],
      },
    }
    const rejected = compileCinema2NativePreset(feedback, { availableCapabilities: ['render.webgl2'] })
    expect(rejected.ok).toBe(false)
    expect(rejected.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'CINEMA2_RENDER_DEPTH_FEEDBACK_HAZARD' })]))
  })
  it('executes only visible/non-zero layers and honors runtime visibility/opacity through the canonical target resolver', () => {
    const firstModule = moduleId('layer-first-module')
    const secondModule = moduleId('layer-second-module')
    const firstNode = nodeId('layer-first-node')
    const secondNode = nodeId('layer-second-node')
    const firstLayer = layerId('layer-first')
    const secondLayer = layerId('layer-second')
    const scenePass = passId('layer-scene-pass')
    const outputPass = passId('layer-output-pass')
    const sceneTarget = targetId('layer-scene-target')
    const colorOut = slotId('layer-color-out')
    const colorIn = slotId('layer-color-in')
    const typeId = cinema2StableId<Cinema2ModuleTypeId>('layer-provider-type')
    const value: Cinema2NativePresetManifest = {
      ...baseManifest('drmvyz.cinema2.layer-execution-foundation-test'),
      modules: [
        { id: firstModule, typeId, version: 1 },
        { id: secondModule, typeId, version: 1 },
      ],
      scene: { nodes: [
        { id: firstNode, kind: 'module', module: cinema2Ref(firstModule) },
        { id: secondNode, kind: 'module', module: cinema2Ref(secondModule) },
      ] },
      layers: [
        { id: firstLayer, label: 'First', source: cinema2Ref(firstNode), order: 20, opacity: 0.5, blendMode: 'add' },
        { id: secondLayer, label: 'Second', source: cinema2Ref(secondNode), order: 10, visible: false, opacity: 1, blendMode: 'screen' },
      ],
      render: {
        targets: [{ id: sceneTarget, descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba8' } }],
        passes: [
          { id: scenePass, kind: 'scene', layers: [cinema2Ref(firstLayer), cinema2Ref(secondLayer)], outputs: [{ id: colorOut, target: cinema2Ref(sceneTarget) }] },
          { id: outputPass, kind: 'output', inputs: [{ id: colorIn, source: { pass: cinema2Ref(scenePass), output: colorOut } }] },
        ],
        outputPass: cinema2Ref(outputPass),
      },
    }
    const created = createExecutor(value)
    const firstExecute = vi.fn()
    const secondExecute = vi.fn()

    created.executor.executeFrame(frame, [provider(firstModule, firstExecute), provider(secondModule, secondExecute)])
    expect(firstExecute).toHaveBeenCalledTimes(1)
    expect(secondExecute).not.toHaveBeenCalled()
    expect(created.gl.uniform1f).toHaveBeenCalledWith(expect.anything(), 0.5)

    const firstVisible = created.compiled.targets.targets.find(target => target.kind === 'layer' && target.ownerId === firstLayer && target.property === 'visible')
    const secondVisible = created.compiled.targets.targets.find(target => target.kind === 'layer' && target.ownerId === secondLayer && target.property === 'visible')
    const secondOpacity = created.compiled.targets.targets.find(target => target.kind === 'layer' && target.ownerId === secondLayer && target.property === 'opacity')
    if (!firstVisible || !secondVisible || !secondOpacity) throw new Error('Expected canonical layer targets.')
    expect(created.resolver.replaceTransientContributions('choreography', [
      { targetId: firstVisible.id, contribution: { contributorId: 'choreography:test:first', operation: 'replace', value: false } },
      { targetId: secondVisible.id, contribution: { contributorId: 'choreography:test:second-visible', operation: 'replace', value: true } },
      { targetId: secondOpacity.id, contribution: { contributorId: 'choreography:test:second-opacity', operation: 'replace', value: 0.25 } },
    ]).applied).toBe(true)

    firstExecute.mockClear()
    secondExecute.mockClear()
    created.executor.executeFrame({ ...frame, frameId: 2 }, [provider(firstModule, firstExecute), provider(secondModule, secondExecute)])
    expect(firstExecute).not.toHaveBeenCalled()
    expect(secondExecute).toHaveBeenCalledTimes(1)
    expect(created.gl.uniform1f).toHaveBeenCalledWith(expect.anything(), 0.25)
    expect(created.executor.getSnapshot().failedPassCount).toBe(0)

    expect(created.resolver.replaceTransientContributions('choreography', [
      { targetId: firstVisible.id, contribution: { contributorId: 'choreography:test:first', operation: 'replace', value: false } },
      { targetId: secondVisible.id, contribution: { contributorId: 'choreography:test:second-visible', operation: 'replace', value: true } },
      { targetId: secondOpacity.id, contribution: { contributorId: 'choreography:test:second-opacity', operation: 'replace', value: 0 } },
    ]).applied).toBe(true)
    firstExecute.mockClear()
    secondExecute.mockClear()
    created.executor.executeFrame({ ...frame, frameId: 3 }, [provider(firstModule, firstExecute), provider(secondModule, secondExecute)])
    expect(firstExecute).not.toHaveBeenCalled()
    expect(secondExecute).not.toHaveBeenCalled()
    expect(created.executor.getSnapshot().failedPassCount).toBe(0)

    created.executor.dispose()
    created.resources.dispose()
  })

  it('keeps a single normal opaque layer on the direct render fast path', () => {
    const module = moduleId('single-layer-module')
    const typeId = cinema2StableId<Cinema2ModuleTypeId>('single-layer-type')
    const node = nodeId('single-layer-node')
    const layer = layerId('single-layer')
    const scenePass = passId('single-layer-scene-pass')
    const compositePass = passId('single-layer-composite-pass')
    const outputPass = passId('single-layer-output-pass')
    const target = targetId('single-layer-target')
    const compositeTarget = targetId('single-layer-composite-target')
    const output = slotId('single-layer-color')
    const compositeOutput = slotId('single-layer-composite-color')
    const value: Cinema2NativePresetManifest = {
      ...baseManifest('drmvyz.cinema2.single-layer-foundation-test'),
      modules: [{ id: module, typeId, version: 1 }],
      scene: { nodes: [{ id: node, kind: 'module', module: cinema2Ref(module) }] },
      layers: [{ id: layer, label: 'Single', source: cinema2Ref(node), opacity: 1, blendMode: 'normal' }],
      render: {
        targets: [
          { id: target, descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba8' } },
          { id: compositeTarget, descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba8' } },
        ],
        passes: [
          { id: scenePass, kind: 'scene', layers: [cinema2Ref(layer)], outputs: [{ id: output, target: cinema2Ref(target) }] },
          {
            id: compositePass,
            kind: 'composite',
            inputs: [{ id: slotId('single-layer-composite-input'), source: { pass: cinema2Ref(scenePass), output } }],
            outputs: [{ id: compositeOutput, target: cinema2Ref(compositeTarget) }],
          },
          { id: outputPass, kind: 'output', inputs: [{ id: slotId('single-layer-input'), source: { pass: cinema2Ref(compositePass), output: compositeOutput } }] },
        ],
        outputPass: cinema2Ref(outputPass),
      },
    }
    const created = createExecutor(value)
    const execute = vi.fn()
    created.executor.executeFrame(frame, [provider(module, execute)])

    expect(execute).toHaveBeenCalledTimes(1)
    expect(created.gl.drawArrays).toHaveBeenCalledTimes(1)
    expect(created.executor.getSnapshot()).toMatchObject({ executedPassCount: 3, failedPassCount: 0 })

    created.executor.dispose()
    created.resources.dispose()
  })

  it('composites every valid input in deterministic layer order with all public blend modes and opacity', () => {
    const modes: readonly Cinema2LayerBlendMode[] = ['normal', 'add', 'screen', 'multiply']
    const orders = [30, 10, 20, 40]
    const opacities = [1, 0.25, 0.5, 0.75]
    const modules = modes.map((mode, index) => moduleId(`composite-${mode}-${index}`))
    const nodes = modes.map((mode, index) => nodeId(`composite-${mode}-node-${index}`))
    const layers = modes.map((mode, index) => layerId(`composite-${mode}-layer-${index}`))
    const sourcePasses = modes.map((mode, index) => passId(`composite-${mode}-source-${index}`))
    const sourceTargets = modes.map((mode, index) => targetId(`composite-${mode}-target-${index}`))
    const outputs = modes.map((mode, index) => slotId(`composite-${mode}-out-${index}`))
    const inputs = modes.map((mode, index) => slotId(`composite-${mode}-in-${index}`))
    const compositePass = passId('composite-all-inputs')
    const compositeTarget = targetId('composite-target')
    const compositeOut = slotId('composite-out')
    const finalPass = passId('composite-final-output')
    const finalIn = slotId('composite-final-in')
    const typeId = cinema2StableId<Cinema2ModuleTypeId>('composite-provider-type')
    const value: Cinema2NativePresetManifest = {
      ...baseManifest('drmvyz.cinema2.true-composite-foundation-test'),
      modules: modules.map(id => ({ id, typeId, version: 1 })),
      scene: { nodes: nodes.map((id, index) => ({ id, kind: 'module' as const, module: cinema2Ref(modules[index]) })) },
      layers: layers.map((id, index) => ({
        id,
        label: modes[index],
        source: cinema2Ref(nodes[index]),
        order: orders[index],
        opacity: opacities[index],
        blendMode: modes[index],
      })),
      render: {
        targets: [
          ...sourceTargets.map(id => ({ id, descriptor: { size: { kind: 'viewport' as const }, colorFormat: 'rgba8' as const } })),
          { id: compositeTarget, descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba8' } },
        ],
        passes: [
          ...sourcePasses.map((id, index) => ({ id, kind: 'module' as const, module: cinema2Ref(modules[index]), outputs: [{ id: outputs[index], target: cinema2Ref(sourceTargets[index]) }] })),
          {
            id: compositePass,
            kind: 'composite',
            layers: layers.map(id => cinema2Ref(id)),
            inputs: inputs.map((id, index) => ({ id, source: { pass: cinema2Ref(sourcePasses[index]), output: outputs[index] } })),
            outputs: [{ id: compositeOut, target: cinema2Ref(compositeTarget) }],
          },
          { id: finalPass, kind: 'output', inputs: [{ id: finalIn, source: { pass: cinema2Ref(compositePass), output: compositeOut } }] },
        ],
        outputPass: cinema2Ref(finalPass),
      },
    }
    const created = createExecutor(value)
    const providers = modules.map(id => provider(id))
    created.executor.executeFrame(frame, providers)

    expect(created.gl.drawArrays).toHaveBeenCalledTimes(4)
    expect(vi.mocked(created.gl.blendFunc).mock.calls).toEqual([
      [created.gl.ONE, created.gl.ONE],
      [created.gl.ONE, created.gl.ONE_MINUS_SRC_COLOR],
      [created.gl.ONE, created.gl.ONE_MINUS_SRC_ALPHA],
      [created.gl.DST_COLOR, created.gl.ONE_MINUS_SRC_ALPHA],
    ])
    expect(vi.mocked(created.gl.uniform1f).mock.calls.map((call: readonly unknown[]) => call[1])).toEqual([0.25, 0.5, 1, 0.75])
    expect(created.executor.getSnapshot()).toMatchObject({ executedPassCount: 6, failedPassCount: 0 })
    expect(created.gl.__calls.createdPrograms).toBe(1)
    created.executor.handleContextLost()
    created.resources.handleContextLost()
    expect(created.gl.__calls.deletedPrograms).toBe(1)
    created.resources.handleContextRestored()
    created.executor.handleContextRestored()
    expect(created.gl.__calls.createdPrograms).toBe(1)
    created.executor.executeFrame({ ...frame, frameId: 2, contextGeneration: 2 }, providers)
    expect(created.gl.__calls.createdPrograms).toBe(2)
    expect(created.executor.getSnapshot().failedPassCount).toBe(0)

    created.executor.dispose()
    created.resources.dispose()
  })

  it('keeps compositing when one optional source fails and safely clears when no valid source remains', () => {
    const goodModule = moduleId('composite-good-module')
    const badModule = moduleId('composite-bad-module')
    const typeId = cinema2StableId<Cinema2ModuleTypeId>('composite-failure-type')
    const goodPass = passId('composite-good-pass')
    const badPass = passId('composite-bad-pass')
    const compositePass = passId('composite-recovery-pass')
    const finalPass = passId('composite-recovery-output')
    const goodTarget = targetId('composite-good-target')
    const badTarget = targetId('composite-bad-target')
    const compositeTarget = targetId('composite-recovery-target')
    const goodOut = slotId('composite-good-out')
    const badOut = slotId('composite-bad-out')
    const compOut = slotId('composite-recovery-out')
    const value: Cinema2NativePresetManifest = {
      ...baseManifest('drmvyz.cinema2.composite-failure-foundation-test'),
      modules: [{ id: goodModule, typeId, version: 1 }, { id: badModule, typeId, version: 1 }],
      render: {
        targets: [goodTarget, badTarget, compositeTarget].map(id => ({ id, descriptor: { size: { kind: 'viewport' as const }, colorFormat: 'rgba8' as const } })),
        passes: [
          { id: goodPass, kind: 'module', module: cinema2Ref(goodModule), outputs: [{ id: goodOut, target: cinema2Ref(goodTarget) }] },
          { id: badPass, kind: 'module', module: cinema2Ref(badModule), outputs: [{ id: badOut, target: cinema2Ref(badTarget) }] },
          {
            id: compositePass,
            kind: 'composite',
            inputs: [
              { id: slotId('good-input'), source: { pass: cinema2Ref(goodPass), output: goodOut }, optional: true },
              { id: slotId('bad-input'), source: { pass: cinema2Ref(badPass), output: badOut }, optional: true },
            ],
            outputs: [{ id: compOut, target: cinema2Ref(compositeTarget) }],
          },
          { id: finalPass, kind: 'output', inputs: [{ id: slotId('final-input'), source: { pass: cinema2Ref(compositePass), output: compOut } }] },
        ],
        outputPass: cinema2Ref(finalPass),
      },
    }
    const created = createExecutor(value)
    created.executor.executeFrame(frame, [
      provider(goodModule),
      provider(badModule, () => { throw new Error('expected upstream failure') }),
    ])
    expect(created.gl.drawArrays).toHaveBeenCalledTimes(1)
    expect(created.executor.getSnapshot()).toMatchObject({ failedPassCount: 1, executedPassCount: 3 })

    const allFailed = createExecutor(value)
    allFailed.executor.executeFrame(frame, [
      provider(goodModule, () => { throw new Error('expected first failure') }),
      provider(badModule, () => { throw new Error('expected second failure') }),
    ])
    expect(allFailed.gl.drawArrays).not.toHaveBeenCalled()
    expect(allFailed.executor.getSnapshot()).toMatchObject({ failedPassCount: 2, executedPassCount: 2 })

    created.executor.dispose()
    created.resources.dispose()
    allFailed.executor.dispose()
    allFailed.resources.dispose()
  })

  it('resolves a downstream depth input as a sampleable depth texture while preserving internal-only depth as a renderbuffer', () => {
    const sourceModule = moduleId('depth-source-module')
    const consumerModule = moduleId('depth-consumer-module')
    const typeId = cinema2StableId<Cinema2ModuleTypeId>('depth-provider-type')
    const sourcePass = passId('depth-source-pass')
    const consumerPass = passId('depth-consumer-pass')
    const finalPass = passId('depth-final-pass')
    const sourceTarget = targetId('depth-source-target')
    const consumerTarget = targetId('depth-consumer-target')
    const depthOut = slotId('depth-out')
    const depthIn = slotId('depth-in')
    const consumerOut = slotId('depth-consumer-out')
    const value: Cinema2NativePresetManifest = {
      ...baseManifest('drmvyz.cinema2.depth-transport-foundation-test'),
      modules: [{ id: sourceModule, typeId, version: 1 }, { id: consumerModule, typeId, version: 1 }],
      render: {
        targets: [
          { id: sourceTarget, descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba8', depthFormat: 'depth24' } },
          { id: consumerTarget, descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba8' } },
        ],
        passes: [
          { id: sourcePass, kind: 'module', module: cinema2Ref(sourceModule), outputs: [{ id: depthOut, attachment: 'depth', target: cinema2Ref(sourceTarget) }] },
          { id: consumerPass, kind: 'module', module: cinema2Ref(consumerModule), inputs: [{ id: depthIn, attachment: 'depth', source: { pass: cinema2Ref(sourcePass), output: depthOut } }], outputs: [{ id: consumerOut, target: cinema2Ref(consumerTarget) }] },
          { id: finalPass, kind: 'output', inputs: [{ id: slotId('depth-final-input'), source: { pass: cinema2Ref(consumerPass), output: consumerOut } }] },
        ],
        outputPass: cinema2Ref(finalPass),
      },
    }
    const created = createExecutor(value)
    const sourceExecute = vi.fn()
    const consumerExecute = vi.fn()
    created.executor.executeFrame(frame, [provider(sourceModule, sourceExecute, 'world'), provider(consumerModule, consumerExecute)])

    expect(created.compiled.render.targets.find(target => target.id === sourceTarget)?.sampleableDepth).toBe(true)
    expect(consumerExecute).toHaveBeenCalledTimes(1)
    expect(consumerExecute.mock.calls[0][0].inputs).toEqual([
      expect.objectContaining({ id: depthIn, attachment: 'depth', texture: expect.anything(), width: 320, height: 180 }),
    ])
    expect(created.gl.framebufferTexture2D).toHaveBeenCalledWith(
      created.gl.FRAMEBUFFER,
      created.gl.DEPTH_ATTACHMENT,
      created.gl.TEXTURE_2D,
      expect.anything(),
      0,
    )
    expect(created.executor.getSnapshot().failedPassCount).toBe(0)

    const missingDepth = createExecutor(value)
    const skippedConsumer = vi.fn()
    missingDepth.executor.executeFrame(frame, [
      provider(sourceModule, () => { throw new Error('expected depth producer failure') }, 'world'),
      provider(consumerModule, skippedConsumer),
    ])
    expect(skippedConsumer).not.toHaveBeenCalled()
    expect(missingDepth.executor.getSnapshot().diagnostics.map(diagnostic => diagnostic.code)).toContain('CINEMA2_RENDER_PASS_INPUT_UNAVAILABLE')

    created.executor.dispose()
    created.resources.dispose()
    missingDepth.executor.dispose()
    missingDepth.resources.dispose()
  })

  it('implements read-write/read-only layer depth policy without leaking depth writes across layers', () => {
    const backModule = moduleId('depth-layer-back-module')
    const frontModule = moduleId('depth-layer-front-module')
    const typeId = cinema2StableId<Cinema2ModuleTypeId>('depth-layer-provider-type')
    const backNode = nodeId('depth-layer-back-node')
    const frontNode = nodeId('depth-layer-front-node')
    const backLayer = layerId('depth-layer-back')
    const frontLayer = layerId('depth-layer-front')
    const scenePass = passId('depth-layer-scene-pass')
    const finalPass = passId('depth-layer-final-pass')
    const sceneTarget = targetId('depth-layer-scene-target')
    const colorOut = slotId('depth-layer-color-out')
    const value: Cinema2NativePresetManifest = {
      ...baseManifest('drmvyz.cinema2.layer-depth-policy-foundation-test'),
      modules: [{ id: backModule, typeId, version: 1 }, { id: frontModule, typeId, version: 1 }],
      scene: { nodes: [
        { id: backNode, kind: 'module', coordinateSpace: 'world', module: cinema2Ref(backModule) },
        { id: frontNode, kind: 'module', coordinateSpace: 'world', module: cinema2Ref(frontModule) },
      ] },
      layers: [
        { id: backLayer, label: 'Back', source: cinema2Ref(backNode), role: 'world', order: 0, depthPolicy: 'read-write' },
        { id: frontLayer, label: 'Front', source: cinema2Ref(frontNode), role: 'world', order: 1, depthPolicy: 'read-only', opacity: 0.8 },
      ],
      render: {
        targets: [{ id: sceneTarget, descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba8', depthFormat: 'depth24' } }],
        passes: [
          { id: scenePass, kind: 'scene', layers: [cinema2Ref(backLayer), cinema2Ref(frontLayer)], outputs: [{ id: colorOut, target: cinema2Ref(sceneTarget) }] },
          { id: finalPass, kind: 'output', inputs: [{ id: slotId('depth-layer-final-input'), source: { pass: cinema2Ref(scenePass), output: colorOut } }] },
        ],
        outputPass: cinema2Ref(finalPass),
      },
    }
    const created = createExecutor(value)
    const backExecute = vi.fn()
    const frontExecute = vi.fn()
    created.executor.executeFrame(frame, [provider(backModule, backExecute, 'world'), provider(frontModule, frontExecute, 'world')])

    expect(backExecute).toHaveBeenCalledTimes(1)
    expect(frontExecute).toHaveBeenCalledTimes(1)
    expect(backExecute.mock.calls[0][0].depthAvailable).toBe(true)
    expect(frontExecute.mock.calls[0][0].depthAvailable).toBe(true)
    const depthBlits = vi.mocked(created.gl.blitFramebuffer).mock.calls.filter((call: readonly unknown[]) => call[8] === created.gl.DEPTH_BUFFER_BIT)
    expect(depthBlits).toHaveLength(3)
    expect(created.executor.getSnapshot().failedPassCount).toBe(0)

    created.executor.dispose()
    created.resources.dispose()
  })
})
