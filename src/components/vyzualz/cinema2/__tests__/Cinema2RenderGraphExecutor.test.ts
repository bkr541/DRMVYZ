import { describe, expect, it, vi } from 'vitest'
import { createCinemaMockWebGL } from '../../cinema/__tests__/CinemaWebGLTestUtils'
import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  Cinema2ParameterState,
  Cinema2RenderGraphExecutor,
  Cinema2ResourceManager,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  compileCinema2NativePreset,
  type Cinema2ModuleId,
  type Cinema2ModuleRenderPassProvider,
  type Cinema2ModuleTypeId,
  type Cinema2NativePresetManifest,
  type Cinema2ParameterId,
  type Cinema2PresetId,
  type Cinema2RenderPassId,
  type Cinema2RenderSlotId,
  type Cinema2RenderTargetId,
} from '..'

const moduleId = cinema2StableId<Cinema2ModuleId>('generator')
const moduleTypeId = cinema2StableId<Cinema2ModuleTypeId>('generator-type')
const sourcePass = cinema2StableId<Cinema2RenderPassId>('source-pass')
const outputPass = cinema2StableId<Cinema2RenderPassId>('output-pass')
const colorOutput = cinema2StableId<Cinema2RenderSlotId>('color-output')
const colorInput = cinema2StableId<Cinema2RenderSlotId>('color-input')
const targetId = cinema2StableId<Cinema2RenderTargetId>('intermediate')
const enabledId = cinema2StableId<Cinema2ParameterId>('enabled')

function manifest(twoPass = true): Cinema2NativePresetManifest {
  return {
    schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
    schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
    id: cinema2NamespacedId<Cinema2PresetId>(`drmvyz.cinema2.executor-${twoPass ? 'two' : 'one'}`),
    revision: 1,
    metadata: { name: 'Executor Test' },
    parameters: [{ id: enabledId, label: 'Enabled', type: 'boolean', defaultValue: true }],
    modules: [{ id: moduleId, typeId: moduleTypeId, version: 1 }],
    render: twoPass ? {
      targets: [{ id: targetId, descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba8' } }],
      passes: [
        { id: sourcePass, kind: 'module', module: cinema2Ref(moduleId), outputs: [{ id: colorOutput, target: cinema2Ref(targetId) }] },
        { id: outputPass, kind: 'output', inputs: [{ id: colorInput, source: { pass: cinema2Ref(sourcePass), output: colorOutput } }] },
      ],
      outputPass: cinema2Ref(outputPass),
    } : {
      passes: [{ id: sourcePass, kind: 'module', module: cinema2Ref(moduleId) }],
      outputPass: cinema2Ref(sourcePass),
    },
  }
}

function createExecutor(value: Cinema2NativePresetManifest) {
  const compiled = compileCinema2NativePreset(value, { availableCapabilities: ['render.webgl2'] })
  if (!compiled.ok) throw new Error(compiled.diagnostics.map(diagnostic => diagnostic.message).join('; '))
  const gl = createCinemaMockWebGL()
  // WebGL2 blit constants/operation used by the engine-owned output provider.
  Object.assign(gl, {
    READ_FRAMEBUFFER: 0x8ca8,
    DRAW_FRAMEBUFFER: 0x8ca9,
    blitFramebuffer: vi.fn(),
  })
  const resources = new Cinema2ResourceManager(gl)
  resources.resize({ width: 320, height: 180, dpr: 1 })
  const parameters = new Cinema2ParameterState(compiled.plan.parameters)
  const executor = new Cinema2RenderGraphExecutor(gl, compiled.plan.render, compiled.plan.scene, parameters, resources, {
    quality: 'high',
    availableCapabilities: ['render.webgl2'],
  })
  return { compiled: compiled.plan, executor, gl, resources, parameters }
}

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

function provider(execute = vi.fn()): Cinema2ModuleRenderPassProvider {
  return { id: 'generator:fullscreen', moduleId, intent: 'fullscreen', execute }
}

describe('Cinema2RenderGraphExecutor', () => {
  it('executes a compiled two-pass pipeline through a tracked transient target and returns resources to baseline', () => {
    const created = createExecutor(manifest(true))
    const execute = vi.fn()
    created.executor.executeFrame(frame, [provider(execute)])

    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute.mock.calls[0][0]).toMatchObject({ width: 320, height: 180, inputs: [] })
    expect(created.gl.blitFramebuffer).toHaveBeenCalledTimes(1)
    expect(created.resources.getSnapshot().activeLeaseCount).toBe(0)
    expect(created.executor.getSnapshot()).toMatchObject({ executedPassCount: 2, failedPassCount: 0 })
    created.executor.dispose()
    created.resources.dispose()
  })

  it('keeps the trivial one-pass path allocation-free', () => {
    const created = createExecutor(manifest(false))
    const execute = vi.fn()
    created.executor.executeFrame(frame, [provider(execute)])
    expect(execute).toHaveBeenCalledTimes(1)
    expect(created.resources.getSnapshot()).toMatchObject({ activeLeaseCount: 0, createdAllocationCount: 0 })
    created.executor.dispose()
    created.resources.dispose()
  })

  it('isolates a failed pass, reports it, and preserves pool ownership', () => {
    const created = createExecutor(manifest(true))
    created.executor.executeFrame(frame, [provider(() => { throw new Error('synthetic pass failure') })])
    expect(created.executor.getSnapshot()).toMatchObject({ failedPassCount: 1, skippedPassCount: 1 })
    expect(created.executor.getSnapshot().diagnostics.map(diagnostic => diagnostic.code)).toContain('CINEMA2_RENDER_PASS_FAILED')
    expect(created.resources.getSnapshot().activeLeaseCount).toBe(0)
    created.executor.dispose()
    created.resources.dispose()
  })

  it('supports compiled conditional skipping without invoking the provider', () => {
    const value = manifest(false)
    value.render = {
      passes: [{
        id: sourcePass,
        kind: 'module',
        module: cinema2Ref(moduleId),
        enabledWhen: [{ kind: 'parameter-equals', parameterId: enabledId, value: false }],
      }],
      outputPass: cinema2Ref(sourcePass),
    }
    const created = createExecutor(value)
    const execute = vi.fn()
    created.executor.executeFrame(frame, [provider(execute)])
    expect(execute).not.toHaveBeenCalled()
    expect(created.executor.getSnapshot()).toMatchObject({ skippedPassCount: 1, failedPassCount: 0 })
    created.executor.dispose()
    created.resources.dispose()
  })

  it('honors compiled quality gates without allocating or invoking skipped work', () => {
    const value = manifest(false)
    value.render = {
      passes: [{ id: sourcePass, kind: 'module', module: cinema2Ref(moduleId), quality: { min: 'high' } }],
      outputPass: cinema2Ref(sourcePass),
    }
    const compiled = compileCinema2NativePreset(value, { availableCapabilities: ['render.webgl2'] })
    if (!compiled.ok) throw new Error(compiled.diagnostics.map(diagnostic => diagnostic.message).join('; '))
    const gl = createCinemaMockWebGL()
    const resources = new Cinema2ResourceManager(gl)
    const parameters = new Cinema2ParameterState(compiled.plan.parameters)
    const executor = new Cinema2RenderGraphExecutor(gl, compiled.plan.render, compiled.plan.scene, parameters, resources, { quality: 'medium' })
    const execute = vi.fn()
    executor.executeFrame(frame, [provider(execute)])
    expect(execute).not.toHaveBeenCalled()
    expect(executor.getSnapshot()).toMatchObject({ skippedPassCount: 1, failedPassCount: 0 })
    expect(resources.getSnapshot().createdAllocationCount).toBe(0)
    executor.dispose()
    resources.dispose()
  })

  it('rebinds persistent targets across resize and context recovery and releases them on dispose', () => {
    const value = manifest(true)
    value.render!.targets = [{ id: targetId, ownership: 'persistent', descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba8' } }]
    const created = createExecutor(value)
    expect(created.resources.getSnapshot().activePersistentLeaseCount).toBe(0)
    created.executor.executeFrame(frame, [provider()])
    expect(created.resources.getSnapshot().activePersistentLeaseCount).toBe(1)
    created.resources.resize({ width: 640, height: 360, dpr: 1 })
    created.executor.executeFrame({ ...frame, viewport: { width: 640, height: 360, dpr: 1 } }, [provider()])
    created.executor.handleContextLost()
    created.resources.handleContextLost()
    created.resources.handleContextRestored()
    created.executor.handleContextRestored()
    created.executor.executeFrame({ ...frame, contextGeneration: 2, viewport: { width: 640, height: 360, dpr: 1 } }, [provider()])
    expect(created.executor.getSnapshot().failedPassCount).toBe(0)
    created.executor.dispose()
    expect(created.resources.getSnapshot().activeLeaseCount).toBe(0)
    created.resources.dispose()
  })
})
