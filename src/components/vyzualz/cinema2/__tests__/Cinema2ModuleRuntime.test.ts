import { describe, expect, it, vi } from 'vitest'
import { createCinemaMockWebGL } from '../../cinema/__tests__/CinemaWebGLTestUtils'
import {
  CINEMA2_FULLSCREEN_SHADER_MODULE_TYPE_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  Cinema2ModuleRegistry,
  Cinema2PresetRegistry,
  Cinema2Runtime,
  cinema2FullscreenShaderModuleDefinition,
  cinema2NamespacedId,
  cinema2StableId,
  type Cinema2ModuleId,
  type Cinema2ModuleTypeDefinition,
  type Cinema2ModuleTypeId,
  type Cinema2NativePresetManifest,
  type Cinema2PresetId,
} from '..'

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

class FakeCanvas extends EventTarget {
  width = 300
  height = 150
  readonly getContext: ReturnType<typeof vi.fn>

  constructor(gl: WebGL2RenderingContext | null) {
    super()
    this.getContext = vi.fn(() => gl)
  }
}

function presetWithModules(id: string, modules: NonNullable<Cinema2NativePresetManifest['modules']>): Cinema2NativePresetManifest {
  return {
    schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
    schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
    id: cinema2NamespacedId<Cinema2PresetId>(id),
    revision: 1,
    metadata: { name: id },
    modules,
  }
}

function createDefinition(
  typeId: Cinema2ModuleTypeId,
  version = 1,
  create: Cinema2ModuleTypeDefinition['create'] = () => ({ lifecycle: { update: () => {}, dispose: () => {} } }),
): Cinema2ModuleTypeDefinition {
  return { typeId, version, create }
}

describe('Cinema 2.0 focused module runtime', () => {
  it('allows multiple versions but rejects an exact type/version registry conflict', () => {
    const registry = new Cinema2ModuleRegistry()
    const typeId = cinema2StableId<Cinema2ModuleTypeId>('registry-test')

    expect(registry.register(createDefinition(typeId, 1))).toMatchObject({ ok: true })
    expect(registry.register(createDefinition(typeId, 2))).toMatchObject({ ok: true })
    expect(registry.register(createDefinition(typeId, 1))).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'CINEMA2_MODULE_REGISTRY_VERSION_CONFLICT' }],
    })
  })

  it('rejects an unregistered authored module version before acquiring WebGL2', () => {
    const presetRegistry = new Cinema2PresetRegistry()
    const moduleRegistry = new Cinema2ModuleRegistry()
    const typeId = cinema2StableId<Cinema2ModuleTypeId>('missing-module')
    const moduleId = cinema2StableId<Cinema2ModuleId>('missing-instance')
    const manifest = presetWithModules('drmvyz.cinema2.module-preflight', [{ id: moduleId, typeId, version: 3 }])
    expect(presetRegistry.register(manifest).ok).toBe(true)
    const canvas = new FakeCanvas(createCinemaMockWebGL())

    const result = Cinema2Runtime.create(canvas as unknown as HTMLCanvasElement, {
      presetId: manifest.id,
      presetRegistry,
      moduleRegistry,
    })

    expect(result.runtime).toBeNull()
    expect(result.error).toContain('missing-module')
    expect(result.error).toContain('version 3')
    expect(canvas.getContext).not.toHaveBeenCalled()
  })

  it('rejects malformed built-in module config before acquiring WebGL2', () => {
    const presetRegistry = new Cinema2PresetRegistry()
    const moduleRegistry = new Cinema2ModuleRegistry()
    expect(moduleRegistry.register(cinema2FullscreenShaderModuleDefinition).ok).toBe(true)
    const moduleId = cinema2StableId<Cinema2ModuleId>('invalid-fullscreen-instance')
    const manifest = presetWithModules('drmvyz.cinema2.invalid-fullscreen-module', [{
      id: moduleId,
      typeId: CINEMA2_FULLSCREEN_SHADER_MODULE_TYPE_ID,
      version: 1,
      config: { fragmentSource: '' },
    }])
    expect(presetRegistry.register(manifest).ok).toBe(true)
    const canvas = new FakeCanvas(createCinemaMockWebGL())

    const result = Cinema2Runtime.create(canvas as unknown as HTMLCanvasElement, {
      presetId: manifest.id,
      presetRegistry,
      moduleRegistry,
    })

    expect(result.runtime).toBeNull()
    expect(result.error).toContain('$.modules[0].config.fragmentSource')
    expect(canvas.getContext).not.toHaveBeenCalled()
  })

  it('runs deterministic create/update/dispose facets, resolves module parameters, and isolates a failing module', () => {
    const presetRegistry = new Cinema2PresetRegistry()
    const moduleRegistry = new Cinema2ModuleRegistry()
    const healthyTypeId = cinema2StableId<Cinema2ModuleTypeId>('healthy-module')
    const failingTypeId = cinema2StableId<Cinema2ModuleTypeId>('failing-module')
    const healthyId = cinema2StableId<Cinema2ModuleId>('healthy-instance')
    const failingId = cinema2StableId<Cinema2ModuleId>('failing-instance')
    let healthyUpdates = 0
    let healthyDispose = 0
    let resourceDispose = 0
    let resolvedGain: unknown = null

    expect(moduleRegistry.register(createDefinition(healthyTypeId, 1, context => {
      resolvedGain = context.parameters.get('gain')
      const gainResolution = context.parameters.resolve('gain')
      if (!gainResolution?.target) throw new Error('Expected a compiled gain target')
      expect(context.targets.resolve(gainResolution.target.id, [{
        contributorId: 'healthy.local-simulation',
        operation: 'add',
        value: 0.25,
      }]).value).toBe(0.75)
      expect(context.parameters.get('gain')).toBe(0.5)
      context.resources.acquire('owned-resource', 'test-resource', () => ({ alive: true }), () => { resourceDispose += 1 })
      return {
        lifecycle: {
          update: frame => {
            healthyUpdates += 1
            expect(frame.parameters.get('gain')).toBe(0.5)
            expect(frame.frame.frameId).toBeGreaterThan(0)
          },
          dispose: () => { healthyDispose += 1 },
        },
        render: { providers: Object.freeze([]) },
      }
    })).ok).toBe(true)

    expect(moduleRegistry.register(createDefinition(failingTypeId, 1, context => {
      context.resources.acquire('failing-resource', 'test-resource', () => ({ alive: true }), () => { resourceDispose += 1 })
      return {
        lifecycle: {
          update: () => { throw new Error('local simulation exploded') },
          dispose: () => {},
        },
      }
    })).ok).toBe(true)

    const manifest = presetWithModules('drmvyz.cinema2.module-lifecycle', [
      { id: healthyId, typeId: healthyTypeId, version: 1, parameters: { gain: 0.5 } },
      { id: failingId, typeId: failingTypeId, version: 1 },
    ])
    expect(presetRegistry.register(manifest).ok).toBe(true)
    const gl = createCinemaMockWebGL()
    const canvas = new FakeCanvas(gl)
    const raf = createRafHarness()
    const created = Cinema2Runtime.create(canvas as unknown as HTMLCanvasElement, {
      presetId: manifest.id,
      presetRegistry,
      moduleRegistry,
      requestAnimationFrame: raf.requestAnimationFrame,
      cancelAnimationFrame: raf.cancelAnimationFrame,
    })
    if (!created.runtime) throw new Error(created.error)

    expect(resolvedGain).toBe(0.5)
    expect(created.runtime.getModuleRuntimeSnapshot()).toMatchObject({
      activeModuleCount: 2,
      failedModuleCount: 0,
      activeResourceLeaseCount: 2,
    })

    created.runtime.start()
    raf.runNext(20)

    expect(healthyUpdates).toBe(1)
    expect(created.runtime.getSnapshot().phase).toBe('running')
    expect(raf.callbacks.size).toBe(1)
    expect(created.runtime.getModuleRuntimeSnapshot()).toMatchObject({
      activeModuleCount: 1,
      failedModuleCount: 1,
      activeResourceLeaseCount: 1,
      modules: expect.arrayContaining([
        expect.objectContaining({ moduleId: failingId, status: 'failed', diagnostics: [expect.objectContaining({ code: 'CINEMA2_MODULE_UPDATE_FAILED' })] }),
      ]),
    })
    expect(resourceDispose).toBe(1)

    created.runtime.dispose()
    expect(healthyDispose).toBe(1)
    expect(resourceDispose).toBe(2)
    expect(created.runtime.getModuleRuntimeSnapshot()).toMatchObject({ activeModuleCount: 0, activeResourceLeaseCount: 0 })
  })


  it('contains a render-provider failure without stopping the global runtime', () => {
    const presetRegistry = new Cinema2PresetRegistry()
    const moduleRegistry = new Cinema2ModuleRegistry()
    const typeId = cinema2StableId<Cinema2ModuleTypeId>('render-failure-module')
    const moduleId = cinema2StableId<Cinema2ModuleId>('render-failure-instance')
    let disposedResources = 0

    expect(moduleRegistry.register(createDefinition(typeId, 1, context => ({
      lifecycle: { update: () => {}, dispose: () => {} },
      render: {
        providers: [{
          id: `${context.module.id}:render-failure`,
          moduleId: context.module.id,
          intent: 'fullscreen',
          execute: () => {
            context.resources.acquire('render-resource', 'test-resource', () => ({ alive: true }), () => { disposedResources += 1 })
            throw new Error('render exploded')
          },
        }],
      },
    }))).ok).toBe(true)

    const manifest = presetWithModules('drmvyz.cinema2.module-render-failure', [{ id: moduleId, typeId, version: 1 }])
    expect(presetRegistry.register(manifest).ok).toBe(true)
    const created = Cinema2Runtime.create(new FakeCanvas(createCinemaMockWebGL()) as unknown as HTMLCanvasElement, {
      presetId: manifest.id,
      presetRegistry,
      moduleRegistry,
    })
    if (!created.runtime) throw new Error(created.error)

    const provider = created.runtime.getModuleRenderPassProviders()[0]
    if (!provider) throw new Error('Expected render provider')
    expect(() => provider.execute({
      frame: {
        frameId: 1,
        timestampMs: 16.67,
        deltaTimeSec: 0,
        elapsedTimeSec: 0,
        viewport: { width: 640, height: 360, dpr: 1 },
        contextGeneration: 1,
        audio: null,
        director: null,
      },
      target: null,
      width: 640,
      height: 360,
    })).toThrow('render exploded')

    expect(disposedResources).toBe(1)
    expect(created.runtime.getSnapshot().phase).toBe('initializing')
    expect(created.runtime.getModuleRuntimeSnapshot()).toMatchObject({
      activeModuleCount: 0,
      failedModuleCount: 1,
      activeResourceLeaseCount: 0,
      modules: [expect.objectContaining({
        moduleId,
        status: 'failed',
        diagnostics: [expect.objectContaining({ code: 'CINEMA2_MODULE_RENDER_FAILED' })],
      })],
    })

    created.runtime.dispose()
  })

  it('keeps fullscreen shader GPU objects behind tracked leases and recreates them after context loss', () => {
    const presetRegistry = new Cinema2PresetRegistry()
    const moduleRegistry = new Cinema2ModuleRegistry()
    expect(moduleRegistry.register(cinema2FullscreenShaderModuleDefinition).ok).toBe(true)
    const moduleId = cinema2StableId<Cinema2ModuleId>('fullscreen-instance')
    const manifest = presetWithModules('drmvyz.cinema2.fullscreen-module', [{
      id: moduleId,
      typeId: CINEMA2_FULLSCREEN_SHADER_MODULE_TYPE_ID,
      version: 1,
    }])
    expect(presetRegistry.register(manifest).ok).toBe(true)
    const gl = createCinemaMockWebGL()
    const canvas = new FakeCanvas(gl)
    const raf = createRafHarness()
    const created = Cinema2Runtime.create(canvas as unknown as HTMLCanvasElement, {
      presetId: manifest.id,
      presetRegistry,
      moduleRegistry,
      requestAnimationFrame: raf.requestAnimationFrame,
      cancelAnimationFrame: raf.cancelAnimationFrame,
    })
    if (!created.runtime) throw new Error(created.error)

    const execute = () => {
      const provider = created.runtime!.getModuleRenderPassProviders()[0]
      if (!provider) throw new Error('Expected fullscreen provider')
      provider.execute({
        frame: {
          frameId: 1,
          timestampMs: 16.67,
          deltaTimeSec: 0,
          elapsedTimeSec: 0,
          viewport: { width: 640, height: 360, dpr: 1 },
          contextGeneration: created.runtime!.getSnapshot().contextGeneration,
          audio: null,
          director: null,
        },
        target: null,
        width: 640,
        height: 360,
      })
    }

    expect(created.runtime.getModuleRuntimeSnapshot().activeResourceLeaseCount).toBe(0)
    execute()
    execute()
    expect(gl.__calls.createdPrograms).toBe(1)
    expect(gl.__calls.createdShaders).toBe(2)
    expect(gl.__calls.drawCount).toBe(2)
    expect(created.runtime.getModuleRuntimeSnapshot().activeResourceLeaseCount).toBe(2)

    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
    expect(gl.__calls.deletedPrograms).toBe(1)
    expect(created.runtime.getModuleRuntimeSnapshot()).toMatchObject({ activeModuleCount: 0, activeResourceLeaseCount: 0 })

    canvas.dispatchEvent(new Event('webglcontextrestored'))
    expect(created.runtime.getModuleRuntimeSnapshot()).toMatchObject({ activeModuleCount: 1, activeResourceLeaseCount: 0 })
    execute()
    expect(gl.__calls.createdPrograms).toBe(2)
    expect(gl.__calls.createdShaders).toBe(4)

    created.runtime.dispose()
    expect(gl.__calls.deletedPrograms).toBe(2)
    expect(created.runtime.getModuleRuntimeSnapshot()).toMatchObject({ activeModuleCount: 0, activeResourceLeaseCount: 0 })
  })
})
