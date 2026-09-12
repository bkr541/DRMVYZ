/** @vitest-environment jsdom */

import React, { useState } from 'react'
import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import { createCinemaMockWebGL, CinemaResizeObserverMock } from '../../cinema/__tests__/CinemaWebGLTestUtils'
import { Cinema2InspectorPanel } from '../../react/Cinema2InspectorPanel'
import { Cinema2PresetsPanel } from '../../react/Cinema2PresetsPanel'
import { Cinema2Stage } from '../../react/Cinema2Stage'
import {
  CINEMA2_REFERENCE_VISUAL_BLOOM_ENABLED_ID,
  CINEMA2_REFERENCE_VISUAL_BLOOM_MIX_ID,
  CINEMA2_REFERENCE_VISUAL_OUTPUT_ENABLED_ID,
  CINEMA2_REFERENCE_VISUAL_PRESET_ID,
  CINEMA2_RUNTIME_FOUNDATION_PRESET_ID,
  Cinema2AudioIntelligenceBridge,
  Cinema2Runtime,
  cinema2NativePresetRegistry,
  getCinema2RuntimeDiagnostics,
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

function createAudioBridge(energy: () => number, available: () => boolean) {
  let frameId = 0
  return new Cinema2AudioIntelligenceBridge({
    getFrame: () => ({
      ...DEFAULT_MI_FRAME,
      frameId: ++frameId,
      sourceId: 'reference-visual-test',
      energy: { ...DEFAULT_MI_FRAME.energy, instant: energy() },
      capabilities: { ...DEFAULT_MI_FRAME.capabilities!, liveBands: available() },
      confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 0.9 },
    }),
    getPublicationMeta: () => ({
      sequence: frameId,
      publishedAtMs: frameId * 16.67,
      publisherId: 'reference-visual-test',
      kind: 'frame' as const,
    }),
  })
}

function createReferenceRuntime(audioBridge: Cinema2AudioIntelligenceBridge, raf: RafHarness = createRafHarness()) {
  const gl = createCinemaMockWebGL()
  gl.getUniformLocation = vi.fn((_program: WebGLProgram, name: string) => ({ name } as unknown as WebGLUniformLocation))
  const result = Cinema2Runtime.create(new FakeCanvas(gl) as unknown as HTMLCanvasElement, {
    presetId: CINEMA2_REFERENCE_VISUAL_PRESET_ID,
    presetRegistry: cinema2NativePresetRegistry,
    audioIntelligenceBridge: audioBridge,
    requestAnimationFrame: raf.requestAnimationFrame,
    cancelAnimationFrame: raf.cancelAnimationFrame,
  })
  if (!result.runtime) throw new Error(result.error)
  return { runtime: result.runtime, gl, raf }
}

function uniformFloatCalls(gl: ReturnType<typeof createCinemaMockWebGL>, name: string): number[] {
  return (gl.uniform1f as ReturnType<typeof vi.fn>).mock.calls
    .filter((call: unknown[]) => (call[0] as { name?: string } | null)?.name === name)
    .map((call: unknown[]) => call[1] as number)
}

// Array.prototype.at() needs an ES2022 lib target this project's tsconfig
// doesn't set; this project's other tests hit the same constraint and use
// plain index access instead.
function lastValue<T>(values: T[]): T | undefined {
  return values[values.length - 1]
}

describe('Cinema 2.0 Reference Visual native vertical slice', () => {
  it('is registered as a native preset with one shared Bloom effect and schema-driven Design/Effects parameters', () => {
    const manifest = cinema2NativePresetRegistry.get(CINEMA2_REFERENCE_VISUAL_PRESET_ID)
    expect(manifest).not.toBeNull()
    expect(manifest?.metadata.name).toBe('Reference Visual')
    expect(manifest?.parameters).toHaveLength(6)
    expect(manifest?.effects).toHaveLength(1)
    expect(manifest?.modules).toHaveLength(1)
    expect(manifest?.scene?.nodes.filter(node => node.kind === 'module')).toHaveLength(1)
    expect(manifest?.layers).toHaveLength(1)

    const compiled = cinema2NativePresetRegistry.compile(CINEMA2_REFERENCE_VISUAL_PRESET_ID, {
      availableCapabilities: ['render.webgl2', 'audio.features'],
    })
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return
    expect(compiled.plan.render).toMatchObject({
      synthesized: false,
      intent: 'authored-render-graph',
      passOrder: ['reference-scene-output', 'reference-bloom-output'],
      outputPassId: 'reference-bloom-output',
    })
  })

  it('binds the persistent Design parameter to visible frame production and consumes authoritative overall energy', () => {
    let energy = 0.25
    const { runtime, gl, raf } = createReferenceRuntime(createAudioBridge(() => energy, () => true))
    runtime.resize({ width: 800, height: 450, dpr: 1 })
    runtime.start()
    raf.runNext()

    expect(gl.__calls.drawCount).toBe(2)
    expect(runtime.getEffectRuntimeSnapshot()).toMatchObject({ activeEffectCount: 1, failedEffectCount: 0 })
    expect(lastValue(uniformFloatCalls(gl, 'u_audioOverallEnergy'))).toBe(0.25)
    expect(lastValue(uniformFloatCalls(gl, 'u_audioOverallEnergyAvailable'))).toBe(1)

    energy = 0.9
    raf.runNext(33.34)
    expect(gl.__calls.drawCount).toBe(4)
    expect(lastValue(uniformFloatCalls(gl, 'u_audioOverallEnergy'))).toBe(0.9)

    expect(runtime.getParameterState().setPersistentValue(CINEMA2_REFERENCE_VISUAL_OUTPUT_ENABLED_ID, false).ok).toBe(true)
    const clearBeforeDisabledFrame = gl.__calls.clearCount
    raf.runNext(50.01)
    expect(gl.__calls.drawCount).toBe(4)
    expect(gl.__calls.clearCount).toBeGreaterThan(clearBeforeDisabledFrame)
    expect(runtime.getRenderGraphExecutorSnapshot().skippedPassCount).toBeGreaterThan(0)

    expect(runtime.getParameterState().setPersistentValue(CINEMA2_REFERENCE_VISUAL_OUTPUT_ENABLED_ID, true).ok).toBe(true)
    raf.runNext(66.68)
    expect(gl.__calls.drawCount).toBe(6)

    expect(runtime.getParameterState().setPersistentValue(CINEMA2_REFERENCE_VISUAL_BLOOM_MIX_ID, 0).ok).toBe(true)
    const blitsBeforeBypass = (gl.blitFramebuffer as ReturnType<typeof vi.fn>).mock.calls.length
    raf.runNext(83.35)
    expect(gl.__calls.drawCount).toBe(7)
    expect((gl.blitFramebuffer as ReturnType<typeof vi.fn>).mock.calls.length).toBe(blitsBeforeBypass + 1)
    expect(runtime.getEffectRuntimeSnapshot().activeEffectCount).toBe(0)

    expect(runtime.getParameterState().setPersistentValue(CINEMA2_REFERENCE_VISUAL_BLOOM_MIX_ID, 0.6).ok).toBe(true)
    raf.runNext(100.02)
    expect(gl.__calls.drawCount).toBe(9)
    expect(lastValue(uniformFloatCalls(gl, 'u_mix'))).toBe(0.6)
    runtime.dispose()
  })

  it('preserves explicit audio unavailability while rendering a deterministic no-audio fallback', () => {
    const { runtime, gl, raf } = createReferenceRuntime(createAudioBridge(() => 0.99, () => false))
    runtime.start()
    raf.runNext()

    expect(runtime.getAudioIntelligenceFrame()?.features.overallEnergy).toMatchObject({ available: false, value: null })
    expect(lastValue(uniformFloatCalls(gl, 'u_audioOverallEnergy'))).toBe(0)
    expect(lastValue(uniformFloatCalls(gl, 'u_audioOverallEnergyAvailable'))).toBe(0)
    expect(gl.__calls.drawCount).toBe(2)
    runtime.dispose()
  })

  it('does not grow shader resources across resize and releases them on deactivation', () => {
    const before = getCinema2RuntimeDiagnostics()
    const { runtime, gl, raf } = createReferenceRuntime(createAudioBridge(() => 0.5, () => true))
    runtime.start()
    raf.runNext()
    const createdPrograms = gl.__calls.createdPrograms
    const createdBuffers = gl.__calls.createdBuffers
    const createdVertexArrays = gl.__calls.createdVertexArrays

    for (let index = 0; index < 8; index += 1) {
      runtime.resize({ width: 640 + index * 32, height: 360 + index * 18, dpr: index % 2 === 0 ? 1 : 1.5 })
      raf.runNext(33.34 + index * 16.67)
    }

    expect(gl.__calls.createdPrograms).toBe(createdPrograms)
    expect(gl.__calls.createdBuffers).toBe(createdBuffers)
    expect(gl.__calls.createdVertexArrays).toBe(createdVertexArrays)
    runtime.dispose()
    expect(gl.__calls.deletedPrograms).toBe(gl.__calls.createdPrograms)
    expect(gl.__calls.deletedBuffers).toBe(gl.__calls.createdBuffers)
    expect(gl.__calls.deletedVertexArrays).toBe(gl.__calls.createdVertexArrays)
    expect(getCinema2RuntimeDiagnostics()).toMatchObject({
      activeRuntimeCount: before.activeRuntimeCount,
      activeAnimationFrameCount: before.activeAnimationFrameCount,
      activeEventListenerCount: before.activeEventListenerCount,
      activeWebGLContextCount: before.activeWebGLContextCount,
    })
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

describe('Cinema 2.0 Reference Visual production preset selection', () => {
  it('selects Reference Visual through the real Presets panel, recreates the Stage runtime, and exposes its schema control', async () => {
    CinemaResizeObserverMock.reset()
    vi.stubGlobal('ResizeObserver', CinemaResizeObserverMock)
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
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
        </>
      )
    }

    await act(async () => root?.render(<ProductionPresetHarness />))
    expect(activeRuntimeRef.current?.getCompiledPresetPlan().presetId).toBe(CINEMA2_RUNTIME_FOUNDATION_PRESET_ID)
    expect(host?.textContent).not.toContain('Effects')
    const referenceButton = host?.querySelector<HTMLButtonElement>(`[data-cinema2-preset-id="${CINEMA2_REFERENCE_VISUAL_PRESET_ID}"]`)
    expect(referenceButton?.textContent).toContain('Reference Visual')

    await act(async () => referenceButton?.click())
    expect(activeRuntimeRef.current?.getCompiledPresetPlan().presetId).toBe(CINEMA2_REFERENCE_VISUAL_PRESET_ID)
    expect(host?.querySelector(`[data-cinema2-control-id="${CINEMA2_REFERENCE_VISUAL_OUTPUT_ENABLED_ID}"]`)).not.toBeNull()
    expect(host?.querySelector(`[data-cinema2-control-id="${CINEMA2_REFERENCE_VISUAL_BLOOM_ENABLED_ID}"]`)).not.toBeNull()
    expect(host?.querySelector(`[data-cinema2-control-id="${CINEMA2_REFERENCE_VISUAL_BLOOM_MIX_ID}"]`)).not.toBeNull()
    expect(host?.textContent).toContain('Effects')
    expect(host?.querySelector('[data-cinema2-output-canvas="true"]')).not.toBeNull()
  })
})
