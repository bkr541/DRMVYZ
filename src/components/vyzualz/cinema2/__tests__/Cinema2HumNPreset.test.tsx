/** @vitest-environment jsdom */

import React, { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import { createCinemaMockWebGL, CinemaResizeObserverMock, type CinemaMockWebGL } from '../../cinema/__tests__/CinemaWebGLTestUtils'
import { Cinema2PresetsPanel } from '../../react/Cinema2PresetsPanel'
import { Cinema2Stage } from '../../react/Cinema2Stage'
import {
  CINEMA2_HUMN_LAYER_ID,
  CINEMA2_HUMN_PRESET_ID,
  CINEMA2_HUMN_PRESET_MANIFEST,
  CINEMA2_HUMN_STATIC_FRAGMENT_SOURCE,
  CINEMA2_RUNTIME_FOUNDATION_PRESET_ID,
  Cinema2AudioIntelligenceBridge,
  Cinema2Runtime,
  cinema2NativePresetRegistry,
  type Cinema2PresetId,
} from '..'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import type { Cinema2Runtime as Cinema2RuntimeType } from '../runtime/Cinema2Runtime'

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

function createPresentAudioBridge() {
  let frameId = 0
  return new Cinema2AudioIntelligenceBridge({
    getFrame: () => ({
      ...DEFAULT_MI_FRAME,
      frameId: ++frameId,
      sourceId: 'hum-n-static-foundation-test',
      timeSec: frameId / 60,
      energy: { ...DEFAULT_MI_FRAME.energy, instant: frameId % 2 === 0 ? 0.88 : 0.12 },
      capabilities: { ...DEFAULT_MI_FRAME.capabilities!, liveBands: true },
      confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 0.95 },
    }),
    getPublicationMeta: () => ({
      sequence: frameId,
      publishedAtMs: frameId * 16.67,
      publisherId: 'hum-n-static-foundation-test',
      kind: 'frame' as const,
    }),
  })
}

function createHumNRuntime() {
  const raf = createRafHarness()
  const gl = createCinemaMockWebGL()
  gl.getUniformLocation = vi.fn((_program: WebGLProgram, name: string) =>
    name === 'u_resolution' ? ({ name } as unknown as WebGLUniformLocation) : null)
  const created = Cinema2Runtime.create(new FakeCanvas(gl) as unknown as HTMLCanvasElement, {
    presetId: CINEMA2_HUMN_PRESET_ID,
    presetRegistry: cinema2NativePresetRegistry,
    audioIntelligenceBridge: createPresentAudioBridge(),
    requestAnimationFrame: raf.requestAnimationFrame,
    cancelAnimationFrame: raf.cancelAnimationFrame,
  })
  expect(created.error).toBeNull()
  if (!created.runtime) throw new Error('Expected HUM:N native runtime')
  return { runtime: created.runtime, gl, raf }
}

let root: Root | null = null
let host: HTMLDivElement | null = null

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  CinemaResizeObserverMock.reset()
  vi.stubGlobal('ResizeObserver', CinemaResizeObserverMock)
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

describe('Cinema 2.0 HUM:N Prompt 01 static visual foundation', () => {
  it('registers exactly once as a native first-party keeper and compiles to the synthesized scene-output path', () => {
    const declarations = CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.filter(candidate => candidate.manifest.id === CINEMA2_HUMN_PRESET_ID)
    expect(declarations).toHaveLength(1)
    expect(declarations[0]).toMatchObject({ role: 'keeper' })
    expect(validateCinema2PresetAuthoringConventions({ role: 'keeper', manifest: CINEMA2_HUMN_PRESET_MANIFEST })).toMatchObject({ ok: true })

    const manifest = cinema2NativePresetRegistry.get(CINEMA2_HUMN_PRESET_ID)
    expect(manifest).not.toBeNull()
    expect(manifest?.metadata.name).toBe('HUM:N')
    expect(manifest?.metadata.tags).not.toContain('internal')
    expect(cinema2NativePresetRegistry.list().filter(candidate => candidate.id === CINEMA2_HUMN_PRESET_ID)).toHaveLength(1)
    expect(manifest?.modules).toHaveLength(1)
    expect(manifest?.scene?.nodes.filter(node => node.kind === 'module')).toHaveLength(1)
    expect(manifest?.layers).toHaveLength(1)
    expect(manifest?.effects ?? []).toHaveLength(0)
    expect(manifest?.choreography ?? []).toHaveLength(0)
    expect(manifest?.cameras ?? []).toHaveLength(0)

    const compiled = cinema2NativePresetRegistry.compile(CINEMA2_HUMN_PRESET_ID, {
      availableCapabilities: ['render.webgl2'],
    })
    expect(compiled.ok, compiled.ok ? '' : compiled.diagnostics.map(diagnostic => `${diagnostic.path}: ${diagnostic.message}`).join('\n')).toBe(true)
    if (!compiled.ok) return
    expect(compiled.plan.render).toMatchObject({
      synthesized: true,
      intent: 'scene-output',
      passOrder: ['auto-scene-output'],
      outputPassId: 'auto-scene-output',
      passes: [expect.objectContaining({
        id: 'auto-scene-output',
        kind: 'scene',
        layers: [expect.objectContaining({ id: CINEMA2_HUMN_LAYER_ID, index: 0 })],
      })],
    })
  })

  it('renders the same deliberately static shader across frames even while authoritative audio is present', () => {
    expect(CINEMA2_HUMN_STATIC_FRAGMENT_SOURCE).toContain('SEGMENT_COUNT = 100')
    expect(CINEMA2_HUMN_STATIC_FRAGMENT_SOURCE).toContain('p.x *= aspect')
    expect(CINEMA2_HUMN_STATIC_FRAGMENT_SOURCE).not.toContain('u_time')
    expect(CINEMA2_HUMN_STATIC_FRAGMENT_SOURCE).not.toContain('u_audio')
    expect(CINEMA2_HUMN_STATIC_FRAGMENT_SOURCE).not.toContain('cyan')
    expect(CINEMA2_HUMN_STATIC_FRAGMENT_SOURCE).not.toContain('magenta')

    const { runtime, gl, raf } = createHumNRuntime()
    runtime.resize({ width: 1280, height: 720, dpr: 1 })
    runtime.start()
    raf.runNext(16.67)
    raf.runNext(33.34)
    raf.runNext(50.01)

    expect(gl.__calls.drawCount).toBe(3)
    expect(runtime.getModuleRuntimeSnapshot()).toMatchObject({ activeModuleCount: 1, failedModuleCount: 0 })
    expect(runtime.getRenderGraphExecutorSnapshot()).toMatchObject({ frameCount: 3, executedPassCount: 3, failedPassCount: 0 })
    expect((gl.uniform1f as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0)
    expect((gl.uniform2f as ReturnType<typeof vi.fn>).mock.calls).toEqual(expect.arrayContaining([
      [expect.objectContaining({ name: 'u_resolution' }), 1280, 720],
    ]))

    runtime.dispose()
    expect(gl.__calls.deletedPrograms).toBe(gl.__calls.createdPrograms)
    expect(gl.__calls.deletedBuffers).toBe(gl.__calls.createdBuffers)
    expect(gl.__calls.deletedVertexArrays).toBe(gl.__calls.createdVertexArrays)
  })

  it('preserves the screen-space composition path across landscape, square, portrait, and ultrawide resize', () => {
    const { runtime, gl, raf } = createHumNRuntime()
    runtime.start()
    const sizes = [[1600, 900], [1024, 1024], [900, 1200], [1920, 800]] as const
    sizes.forEach(([width, height], index) => {
      runtime.resize({ width, height, dpr: 1 })
      raf.runNext(16.67 * (index + 1))
    })

    expect(runtime.getRenderGraphExecutorSnapshot()).toMatchObject({ frameCount: sizes.length, failedPassCount: 0 })
    const resolutionCalls = (gl.uniform2f as ReturnType<typeof vi.fn>).mock.calls.map(call => [call[1], call[2]])
    for (const size of sizes) expect(resolutionCalls).toContainEqual([...size])
    runtime.dispose()
  })

  it('appears once in the real Cinema 2.0 preset browser and reconstructs through the production Stage path after switching away and back', async () => {
    const raf = createRafHarness()
    vi.stubGlobal('requestAnimationFrame', raf.requestAnimationFrame)
    vi.stubGlobal('cancelAnimationFrame', raf.cancelAnimationFrame)
    const contexts: CinemaMockWebGL[] = []
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((kind: string) => {
      if (kind !== 'webgl2') return null
      const gl = createCinemaMockWebGL()
      contexts.push(gl)
      return gl as unknown as RenderingContext
    })
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 1280,
      height: 720,
      top: 0,
      left: 0,
      right: 1280,
      bottom: 720,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    const activeRuntimeRef: { current: Cinema2RuntimeType | null } = { current: null }
    function Harness() {
      const [presetId, setPresetId] = useState<Cinema2PresetId>(CINEMA2_RUNTIME_FOUNDATION_PRESET_ID)
      return <>
        <button data-testid="foundation" onClick={() => setPresetId(CINEMA2_RUNTIME_FOUNDATION_PRESET_ID)}>Foundation</button>
        <Cinema2PresetsPanel activePresetId={presetId} onSelectPreset={setPresetId} />
        <Cinema2Stage presetId={presetId} onRuntimeReady={runtime => { activeRuntimeRef.current = runtime }} />
      </>
    }

    await act(async () => root?.render(<Harness />))
    const humButtons = host?.querySelectorAll<HTMLButtonElement>(`[data-cinema2-preset-id="${CINEMA2_HUMN_PRESET_ID}"]`) ?? []
    expect(humButtons).toHaveLength(1)
    expect(humButtons[0]?.textContent).toContain('HUM:N')

    await act(async () => humButtons[0]?.click())
    expect(activeRuntimeRef.current?.getCompiledPresetPlan().presetId).toBe(CINEMA2_HUMN_PRESET_ID)
    await act(async () => raf.runNext())
    expect(activeRuntimeRef.current?.getRenderGraphExecutorSnapshot()).toMatchObject({ frameCount: 1, executedPassCount: 1, failedPassCount: 0 })
    expect(contexts[contexts.length - 1]?.__calls.drawCount).toBeGreaterThan(0)

    await act(async () => host?.querySelector<HTMLButtonElement>('[data-testid="foundation"]')?.click())
    expect(activeRuntimeRef.current?.getCompiledPresetPlan().presetId).toBe(CINEMA2_RUNTIME_FOUNDATION_PRESET_ID)
    const humButtonAfterSwitch = host?.querySelector<HTMLButtonElement>(`[data-cinema2-preset-id="${CINEMA2_HUMN_PRESET_ID}"]`)
    await act(async () => humButtonAfterSwitch?.click())
    expect(activeRuntimeRef.current?.getCompiledPresetPlan().presetId).toBe(CINEMA2_HUMN_PRESET_ID)
    await act(async () => raf.runNext(33.34))
    expect(activeRuntimeRef.current?.getRenderGraphExecutorSnapshot()).toMatchObject({ frameCount: 1, failedPassCount: 0 })
    expect(contexts.length).toBeGreaterThanOrEqual(3)
  })
})
