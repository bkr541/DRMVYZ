/** @vitest-environment jsdom */

import React, { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCinemaMockWebGL, CinemaResizeObserverMock } from '../../cinema/__tests__/CinemaWebGLTestUtils'
import { Cinema2InspectorPanel } from '../../react/Cinema2InspectorPanel'
import { Cinema2PresetsPanel } from '../../react/Cinema2PresetsPanel'
import { Cinema2Stage } from '../../react/Cinema2Stage'
import {
  CINEMA2_REACTOR_BLOOM_INTENSITY_ID,
  CINEMA2_REACTOR_CORE_SIZE_ID,
  CINEMA2_REACTOR_PRESET_ID,
  CINEMA2_REACTOR_PRESET_MANIFEST,
  CINEMA2_REACTOR_REFRACTION_ID,
  CINEMA2_REACTOR_RESET_TRAILS_ID,
  CINEMA2_REACTOR_TRAILS_ENABLED_ID,
  CINEMA2_REACTOR_TRAILS_PERSISTENCE_ID,
  CINEMA2_RUNTIME_FOUNDATION_PRESET_ID,
  Cinema2EffectRuntime,
  Cinema2FinalValueResolver,
  Cinema2RenderGraphExecutor,
  Cinema2Runtime,
  compileCinema2NativePreset,
  cinema2NativePresetRegistry,
  cinema2Ref,
  cinema2StableId,
  type Cinema2ParameterId,
  type Cinema2PresetId,
} from '..'

type RafHarness = ReturnType<typeof createRafHarness>

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
      if (!entry) throw new Error('No Cinema 2.0 frame is scheduled.')
      callbacks.delete(entry[0])
      entry[1](timestamp)
    },
  }
}

class FakeCanvas extends EventTarget {
  width = 300
  height = 150
  readonly getContext: ReturnType<typeof vi.fn>

  constructor(gl: WebGL2RenderingContext) {
    super()
    this.getContext = vi.fn((kind: string) => kind === 'webgl2' ? gl : null)
  }
}

function createReactorRuntime(raf: RafHarness = createRafHarness()) {
  const gl = createCinemaMockWebGL()
  gl.getUniformLocation = vi.fn((_program: WebGLProgram, name: string) => ({ name } as unknown as WebGLUniformLocation))
  const canvas = new FakeCanvas(gl)
  const result = Cinema2Runtime.create(canvas as unknown as HTMLCanvasElement, {
    presetId: CINEMA2_REACTOR_PRESET_ID,
    presetRegistry: cinema2NativePresetRegistry,
    requestAnimationFrame: raf.requestAnimationFrame,
    cancelAnimationFrame: raf.cancelAnimationFrame,
  })
  if (!result.runtime) throw new Error(result.error)
  return { runtime: result.runtime, gl, raf, canvas }
}

function uniformFloatCalls(gl: ReturnType<typeof createCinemaMockWebGL>, name: string): number[] {
  return (gl.uniform1f as ReturnType<typeof vi.fn>).mock.calls
    .filter((call: unknown[]) => (call[0] as { name?: string } | null)?.name === name)
    .map((call: unknown[]) => call[1] as number)
}

function lastValue<T>(values: T[]): T | undefined {
  return values[values.length - 1]
}

describe('Cinema 2.0 Reactor native rendering slice', () => {
  it('compiles a native generator -> shared feedback -> composite -> bloom topology without choreography', () => {
    const manifest = cinema2NativePresetRegistry.get(CINEMA2_REACTOR_PRESET_ID)
    expect(manifest).not.toBeNull()
    expect(manifest?.metadata.name).toBe('Reactor 2.0')
    expect(manifest?.modules).toHaveLength(2)
    expect(manifest?.effects).toHaveLength(2)
    expect(manifest?.choreography).toBeUndefined()

    const compiled = cinema2NativePresetRegistry.compile(CINEMA2_REACTOR_PRESET_ID, {
      availableCapabilities: ['render.webgl2', 'render.history', 'audio.features', 'audio.bands'],
    })
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return
    expect(compiled.plan.render).toMatchObject({
      synthesized: false,
      intent: 'authored-render-graph',
      passOrder: ['reactor-generator-pass', 'reactor-feedback-pass', 'reactor-composite-pass', 'reactor-bloom-pass'],
      outputPassId: 'reactor-bloom-pass',
    })
    expect(compiled.plan.render.targets).toHaveLength(3)
    expect(compiled.plan.render.targets.every(target => target.ownership === 'transient')).toBe(true)

    const coreTarget = compiled.plan.targets.targets.find(target => target.kind === 'module' && target.ownerId === 'reactor-generator' && target.property === 'coreSize')
    const refractionTarget = compiled.plan.targets.targets.find(target => target.kind === 'module' && target.ownerId === 'reactor-composite' && target.property === 'refraction')
    expect(coreTarget?.parameterId).toBe(CINEMA2_REACTOR_CORE_SIZE_ID)
    expect(refractionTarget?.parameterId).toBe(CINEMA2_REACTOR_REFRACTION_ID)
  })

  it('rejects invalid generic module parameter bindings at compile time', () => {
    const unknownPropertyId = cinema2StableId<Cinema2ParameterId>('reactor-unknown-binding')
    const malformed = {
      ...CINEMA2_REACTOR_PRESET_MANIFEST,
      parameters: Object.freeze([
        ...(CINEMA2_REACTOR_PRESET_MANIFEST.parameters ?? []),
        Object.freeze({
          id: unknownPropertyId,
          label: 'Unknown Binding',
          type: 'float' as const,
          defaultValue: 0.5,
        }),
      ]),
      modules: Object.freeze((CINEMA2_REACTOR_PRESET_MANIFEST.modules ?? []).map((module, index) => index === 0
        ? Object.freeze({
            ...module,
            parameterBindings: Object.freeze({
              ...(module.parameterBindings ?? {}),
              missingProperty: cinema2Ref(unknownPropertyId),
            }),
          })
        : module)),
    }
    const result = compileCinema2NativePreset(malformed, {
      availableCapabilities: ['render.webgl2', 'render.history'],
    })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some(diagnostic => diagnostic.code === 'CINEMA2_PRESET_MODULE_BINDING_PROPERTY_INVALID')).toBe(true)
  })

  it('renders through shared History, resolves schema-bound module values, preserves effect order, and releases resources', () => {
    const { runtime, gl, raf } = createReactorRuntime()
    runtime.resize({ width: 960, height: 540, dpr: 1 })
    runtime.start()
    raf.runNext()

    expect(gl.__calls.drawCount).toBe(4)
    expect(runtime.getRenderGraphExecutorSnapshot()).toMatchObject({
      frameCount: 1,
      executedPassCount: 4,
      failedPassCount: 0,
    })
    expect(runtime.getHistoryServiceSnapshot()).toMatchObject({ activeBufferCount: 1, validBufferCount: 1 })
    expect(runtime.getEffectRuntimeSnapshot().effects.map(effect => effect.effectId)).toEqual(['reactor-feedback', 'reactor-bloom'])
    expect(runtime.getModuleRuntimeSnapshot()).toMatchObject({ activeModuleCount: 2, failedModuleCount: 0 })
    expect(lastValue(uniformFloatCalls(gl, 'u_coreSize'))).toBeCloseTo(0.42)
    expect(lastValue(uniformFloatCalls(gl, 'u_refraction'))).toBeCloseTo(0.42)

    expect(runtime.getParameterState().setPersistentValue(CINEMA2_REACTOR_CORE_SIZE_ID, 0.61).ok).toBe(true)
    expect(runtime.getParameterState().setPersistentValue(CINEMA2_REACTOR_REFRACTION_ID, 0.78).ok).toBe(true)
    expect(runtime.getParameterState().setPersistentValue(CINEMA2_REACTOR_BLOOM_INTENSITY_ID, 2.1).ok).toBe(true)
    raf.runNext(33.34)
    expect(lastValue(uniformFloatCalls(gl, 'u_coreSize'))).toBeCloseTo(0.61)
    expect(lastValue(uniformFloatCalls(gl, 'u_refraction'))).toBeCloseTo(0.78)
    expect(lastValue(uniformFloatCalls(gl, 'u_intensity'))).toBeCloseTo(2.1)

    const resetTarget = runtime.getCompiledPresetPlan().targets.targets.find(target => (
      target.channel === 'action' && target.parameterId === CINEMA2_REACTOR_RESET_TRAILS_ID
    ))
    expect(resetTarget).toBeDefined()
    if (!resetTarget) throw new Error('Reactor Trails reset action target was not compiled.')
    const reset = runtime.getTargetResolver().dispatch(resetTarget.id, [{
      contributorId: 'reactor-native-test',
      operation: 'action',
      eventId: 'reactor-native-test:reset',
    }])
    expect(reset.ok).toBe(true)
    expect(runtime.getHistoryServiceSnapshot()).toMatchObject({ validBufferCount: 0, lastResetReason: 'manual' })
    raf.runNext(50.01)
    expect(runtime.getHistoryServiceSnapshot()).toMatchObject({ validBufferCount: 1 })

    const createdPrograms = gl.__calls.createdPrograms
    for (let index = 0; index < 6; index += 1) {
      runtime.resize({ width: 800 + index * 24, height: 450 + index * 14, dpr: index % 2 === 0 ? 1 : 1.5 })
      raf.runNext(66.68 + index * 16.67)
    }
    expect(gl.__calls.createdPrograms).toBe(createdPrograms)
    expect(runtime.getHistoryServiceSnapshot().activeBufferCount).toBe(1)

    expect(runtime.getParameterState().setPersistentValue(CINEMA2_REACTOR_TRAILS_ENABLED_ID, false).ok).toBe(true)
    raf.runNext(200)
    expect(runtime.getHistoryServiceSnapshot().activeBufferCount).toBe(0)
    expect(runtime.getEffectRuntimeSnapshot().effects.find(effect => effect.effectId === 'reactor-feedback')?.status).toBe('inactive')

    runtime.dispose()
    expect(gl.__calls.deletedPrograms).toBe(gl.__calls.createdPrograms)
    expect(gl.__calls.deletedTextures).toBe(gl.__calls.createdTextures)
    expect(gl.__calls.deletedFramebuffers).toBe(gl.__calls.createdFramebuffers)
    expect(runtime.getResourceManagerSnapshot().activeLeaseCount).toBe(0)
  })

  it('invalidates Reactor feedback history on context loss and recreates it after restoration', () => {
    const { runtime, canvas, raf } = createReactorRuntime()
    runtime.start()
    raf.runNext()
    expect(runtime.getHistoryServiceSnapshot()).toMatchObject({ activeBufferCount: 1, validBufferCount: 1 })

    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
    expect(runtime.getHistoryServiceSnapshot()).toMatchObject({ validBufferCount: 0, lastResetReason: 'context-lost' })
    canvas.dispatchEvent(new Event('webglcontextrestored'))
    expect(runtime.getHistoryServiceSnapshot()).toMatchObject({ validBufferCount: 0, lastResetReason: 'context-restored' })
    raf.runNext(33.34)
    expect(runtime.getHistoryServiceSnapshot()).toMatchObject({ activeBufferCount: 1, validBufferCount: 1 })
    runtime.dispose()
  })

  it('keeps generic Cinema 2.0 runtime owners free of Reactor identity branches', () => {
    const genericOwners = [Cinema2Runtime, Cinema2RenderGraphExecutor, Cinema2EffectRuntime, Cinema2FinalValueResolver]
    for (const owner of genericOwners) expect(owner.toString().toLowerCase()).not.toContain('reactor')
  })
})

let host: HTMLDivElement | null = null
let root: Root | null = null

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root?.unmount())
  root = null
  host?.remove()
  host = null
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Cinema 2.0 Reactor production selection path', () => {
  it('selects Reactor 2.0 through the real preset browser, activates Stage, and exposes native schema controls', async () => {
    CinemaResizeObserverMock.reset()
    vi.stubGlobal('ResizeObserver', CinemaResizeObserverMock)
    const raf = createRafHarness()
    vi.stubGlobal('requestAnimationFrame', raf.requestAnimationFrame)
    vi.stubGlobal('cancelAnimationFrame', raf.cancelAnimationFrame)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((kind: string) => (
      kind === 'webgl2' ? createCinemaMockWebGL() as unknown as RenderingContext : null
    ))
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 960,
      height: 540,
      top: 0,
      left: 0,
      right: 960,
      bottom: 540,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    const activeRuntimeRef: { current: Cinema2Runtime | null } = { current: null }

    function ProductionPresetHarness() {
      const [presetId, setPresetId] = useState<Cinema2PresetId>(CINEMA2_RUNTIME_FOUNDATION_PRESET_ID)
      const [runtime, setRuntime] = useState<Cinema2Runtime | null>(null)
      return (
        <>
          <Cinema2PresetsPanel activePresetId={presetId} onSelectPreset={setPresetId} />
          <Cinema2Stage
            presetId={presetId}
            onRuntimeReady={next => {
              activeRuntimeRef.current = next
              setRuntime(next)
            }}
          />
          <Cinema2InspectorPanel runtime={runtime} surface="design" />
          <Cinema2InspectorPanel runtime={runtime} surface="effects" />
        </>
      )
    }

    await act(async () => root?.render(<ProductionPresetHarness />))
    const reactorButton = host?.querySelector<HTMLButtonElement>(`[data-cinema2-preset-id="${CINEMA2_REACTOR_PRESET_ID}"]`)
    expect(reactorButton?.textContent).toContain('Reactor 2.0')

    await act(async () => reactorButton?.click())
    expect(activeRuntimeRef.current?.getCompiledPresetPlan().presetId).toBe(CINEMA2_REACTOR_PRESET_ID)
    expect(host?.querySelector(`[data-cinema2-control-id="${CINEMA2_REACTOR_CORE_SIZE_ID}"]`)).not.toBeNull()
    expect(host?.querySelector(`[data-cinema2-control-id="${CINEMA2_REACTOR_REFRACTION_ID}"]`)).not.toBeNull()
    expect(host?.querySelector(`[data-cinema2-control-id="${CINEMA2_REACTOR_TRAILS_PERSISTENCE_ID}"]`)).not.toBeNull()
    expect(host?.querySelector(`[data-cinema2-control-id="${CINEMA2_REACTOR_RESET_TRAILS_ID}"]`)).not.toBeNull()

    await act(async () => raf.runNext())
    expect(activeRuntimeRef.current?.getRenderGraphExecutorSnapshot()).toMatchObject({ frameCount: 1, executedPassCount: 4, failedPassCount: 0 })
    expect(activeRuntimeRef.current?.getHistoryServiceSnapshot()).toMatchObject({ activeBufferCount: 1, validBufferCount: 1 })
  })
})
