/** @vitest-environment jsdom */

import React, { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import { createCinemaMockWebGL, CinemaResizeObserverMock, type CinemaMockWebGL } from '../../cinema/__tests__/CinemaWebGLTestUtils'
import { Cinema2InspectorPanel } from '../../react/Cinema2InspectorPanel'
import { Cinema2PresetsPanel } from '../../react/Cinema2PresetsPanel'
import { Cinema2Stage } from '../../react/Cinema2Stage'
import {
  CINEMA2_HUMN_BLOOM_EFFECT_ID,
  CINEMA2_HUMN_GLOW_ID,
  CINEMA2_HUMN_TRAILS_ID,
  CINEMA2_HUMN_BLOOM_PASS_ID,
  CINEMA2_HUMN_LAYER_ID,
  CINEMA2_HUMN_SCENE_PASS_ID,
  CINEMA2_HUMN_TRAILS_EFFECT_ID,
  CINEMA2_HUMN_TRAILS_PASS_ID,
  CINEMA2_HUMN_MASTER_INTENSITY_ID,
  CINEMA2_HUMN_AUTO_COLOR_ID,
  CINEMA2_HUMN_BPM_SYNC_ID,
  CINEMA2_HUMN_MOTION_AMOUNT_ID,
  CINEMA2_HUMN_MOTION_RATE_ID,
  CINEMA2_HUMN_FIGURE_SCALE_ID,
  CINEMA2_HUMN_BACKGROUND_ID,
  CINEMA2_HUMN_WIREFRAME_ID,
  CINEMA2_HUMN_PATTERN_INK_ID,
  CINEMA2_HUMN_SKIN_PRIMARY_ID,
  CINEMA2_HUMN_SKIN_SECONDARY_ID,
  CINEMA2_HUMN_SKIN_ACCENT_ID,
  CINEMA2_HUMN_FLICKER_AMOUNT_ID,
  CINEMA2_HUMN_FRAGMENT_JITTER_ID,
  CINEMA2_HUMN_AUTO_PERFORMANCE_ID,
  CINEMA2_HUMN_LINE_PRESENCE_ID,
  CINEMA2_HUMN_LINE_WEIGHT_ID,
  CINEMA2_HUMN_FRAGMENTATION_ID,
  CINEMA2_HUMN_MESH_DETAIL_ID,
  CINEMA2_HUMN_FACET_FILL_ID,
  CINEMA2_HUMN_FILL_STYLE_ID,
  CINEMA2_HUMN_NATIVE_MODULE_TYPE_ID,
  CINEMA2_HUMN_NATIVE_MODULE_VERSION,
  CINEMA2_HUMN_PRESET_ID,
  CINEMA2_HUMN_PRESET_MANIFEST,
  CINEMA2_RUNTIME_FOUNDATION_PRESET_ID,
  Cinema2AudioIntelligenceBridge,
  Cinema2Runtime,
  createCinema2DesignParentGroupModel,
  cinema2NativeModuleRegistry,
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
  gl.getUniformLocation = vi.fn((_program: WebGLProgram, name: string) => ({ name } as unknown as WebGLUniformLocation))
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

describe('Cinema 2.0 HUM:N native 3D figure preset', () => {
  it('registers exactly once as a native first-party keeper and compiles to the scene -> trails -> bloom -> output Render Graph', () => {
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
    expect(manifest?.modules?.[0]).toMatchObject({
      typeId: CINEMA2_HUMN_NATIVE_MODULE_TYPE_ID,
      version: CINEMA2_HUMN_NATIVE_MODULE_VERSION,
    })
    expect(cinema2NativeModuleRegistry.get(CINEMA2_HUMN_NATIVE_MODULE_TYPE_ID, CINEMA2_HUMN_NATIVE_MODULE_VERSION)).not.toBeNull()
    expect(manifest?.scene?.nodes.filter(node => node.kind === 'module')).toHaveLength(1)
    expect(manifest?.layers).toHaveLength(1)
    expect(manifest?.layers?.[0]).toMatchObject({ role: 'world', depthPolicy: 'read-write' })
    expect(manifest?.effects?.map(effect => effect.id)).toEqual([CINEMA2_HUMN_TRAILS_EFFECT_ID, CINEMA2_HUMN_BLOOM_EFFECT_ID])
    expect(manifest?.choreography?.rules.length ?? 0).toBeGreaterThan(0)
    expect(manifest?.cameras ?? []).toHaveLength(1)
    // The engine camera moves with the beat and Motion Amount scales it; BPM Sync is the same switch that locks the figure.
    expect(manifest?.cameras?.[0]?.controls).toMatchObject({ motionAmount: { $ref: CINEMA2_HUMN_MOTION_AMOUNT_ID }, tempoSync: { $ref: CINEMA2_HUMN_BPM_SYNC_ID } })
    expect(manifest?.cameras?.[0]?.motion?.tempo).toBeTruthy()
    expect(manifest?.environment?.controls).toMatchObject({ backgroundColor: { $ref: CINEMA2_HUMN_BACKGROUND_ID } })

    const compiled = cinema2NativePresetRegistry.compile(CINEMA2_HUMN_PRESET_ID, {
      availableCapabilities: ['render.webgl2', 'render.depth', 'scene.3d', 'camera.world'],
    })
    expect(compiled.ok, compiled.ok ? '' : compiled.diagnostics.map(diagnostic => `${diagnostic.path}: ${diagnostic.message}`).join('\n')).toBe(true)
    if (!compiled.ok) return
    expect(compiled.plan.render).toMatchObject({
      synthesized: false,
      passOrder: [CINEMA2_HUMN_SCENE_PASS_ID, CINEMA2_HUMN_TRAILS_PASS_ID, CINEMA2_HUMN_BLOOM_PASS_ID],
      outputPassId: CINEMA2_HUMN_BLOOM_PASS_ID,
      passes: [
        expect.objectContaining({ id: CINEMA2_HUMN_SCENE_PASS_ID, kind: 'scene', layers: [expect.objectContaining({ id: CINEMA2_HUMN_LAYER_ID, index: 0 })] }),
        expect.objectContaining({ id: CINEMA2_HUMN_TRAILS_PASS_ID, kind: 'fullscreen' }),
        expect.objectContaining({ id: CINEMA2_HUMN_BLOOM_PASS_ID, kind: 'fullscreen' }),
      ],
    })
  })

  it('runs the whole chain through the production runtime on real frames, with the figure drawn every frame and no failed pass', () => {
    const { runtime, gl, raf } = createHumNRuntime()
    runtime.resize({ width: 1280, height: 720, dpr: 1 })
    runtime.start()
    raf.runNext(16.67)
    raf.runNext(33.34)
    raf.runNext(50.01)
    expect(gl.__calls.drawCount).toBeGreaterThanOrEqual(3)
    expect(runtime.getModuleRuntimeSnapshot()).toMatchObject({ activeModuleCount: 1, failedModuleCount: 0 })
    expect(runtime.getRenderGraphExecutorSnapshot()).toMatchObject({ frameCount: 3, failedPassCount: 0 })
    runtime.dispose()
  })

  it('keeps Figure Scale, Line Weight and the resolved figure uniforms flowing to the renderer across viewport shapes', () => {
    const { runtime, gl, raf } = createHumNRuntime()
    const sizes = [[1600, 900], [1024, 1024], [900, 1200], [2560, 1080]] as const
    runtime.start()
    let time = 0
    for (const [width, height] of sizes) {
      runtime.resize({ width, height, dpr: 1 })
      raf.runNext((time += 16.67))
    }
    expect(runtime.getRenderGraphExecutorSnapshot()).toMatchObject({ failedPassCount: 0 })
    const projections = (gl.uniformMatrix4fv as ReturnType<typeof vi.fn>).mock.calls.filter((call: unknown[]) => (call[0] as { name?: string } | null)?.name === 'u_projection')
    // Each shape gets its own aspect in the projection.
    const aspects = new Set(projections.map((call: unknown[]) => Math.round((call[2] as Float32Array)[5]! / (call[2] as Float32Array)[0]! * 100)))
    expect(aspects.size).toBeGreaterThanOrEqual(sizes.length)
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
      gl.getUniformLocation = vi.fn((_program: WebGLProgram, name: string) => ({ name } as unknown as WebGLUniformLocation))
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
    expect(activeRuntimeRef.current?.getRenderGraphExecutorSnapshot()).toMatchObject({ frameCount: 1, executedPassCount: 3, failedPassCount: 0 })
    expect(contexts[contexts.length - 1]?.__calls.drawCount).toBeGreaterThan(0)

    const productionState = activeRuntimeRef.current?.getParameterState()
    expect(productionState).toBeTruthy()
    // Manual colors only take effect with Auto Color off.
    expect(productionState?.setPersistentValue(CINEMA2_HUMN_AUTO_COLOR_ID, false)).toMatchObject({ ok: true })
    const productionPalette = [
      [CINEMA2_HUMN_BACKGROUND_ID, [0.01, 0.02, 0.03, 1]],
      [CINEMA2_HUMN_WIREFRAME_ID, [0.95, 0.10, 0.12, 1]],
      [CINEMA2_HUMN_PATTERN_INK_ID, [0.92, 0.94, 0.16, 1]],
      [CINEMA2_HUMN_SKIN_PRIMARY_ID, [0.08, 0.88, 0.94, 1]],
      [CINEMA2_HUMN_SKIN_SECONDARY_ID, [0.96, 0.08, 0.72, 1]],
      [CINEMA2_HUMN_SKIN_ACCENT_ID, [0.44, 0.98, 0.06, 1]],
    ] as const
    for (const [parameterId, color] of productionPalette) {
      expect(productionState?.setPersistentValue(parameterId, color)).toMatchObject({ ok: true })
    }
    expect(productionState?.setPersistentValue(CINEMA2_HUMN_FACET_FILL_ID, 1)).toMatchObject({ ok: true })
    expect(productionState?.setPersistentValue(CINEMA2_HUMN_FILL_STYLE_ID, 'Mixed')).toMatchObject({ ok: true })
    await act(async () => raf.runNext(25.01))

    const productionGl = contexts[contexts.length - 1]
    const latestProductionColor = (name: string) => {
      const calls = (productionGl?.uniform4f as ReturnType<typeof vi.fn>).mock.calls.filter((call: unknown[]) =>
        (call[0] as { name?: string } | null)?.name === name
      )
      return calls[calls.length - 1]?.slice(1)
    }
    expect(latestProductionColor('u_background')).toEqual([...productionPalette[0][1]])
    expect(latestProductionColor('u_wireframe')).toEqual([...productionPalette[1][1]])
    expect(latestProductionColor('u_ink')).toEqual([...productionPalette[2][1]])
    const latestVec3 = (name: string) => {
      const calls = (productionGl?.uniform3f as ReturnType<typeof vi.fn>).mock.calls.filter((call: unknown[]) => (call[0] as { name?: string } | null)?.name === name)
      return calls[calls.length - 1]?.slice(1)
    }
    expect(latestVec3('u_color0')).toEqual([...productionPalette[3][1].slice(0, 3)])
    expect(latestVec3('u_color1')).toEqual([...productionPalette[4][1].slice(0, 3)])
    expect(latestVec3('u_color2')).toEqual([...productionPalette[5][1].slice(0, 3)])

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

describe('Cinema 2.0 HUM:N Glow and Trails through the production Stage', () => {
  it('exposes Glow and Trails once each in the real Inspector, runs the finishing chain, and re-enters with no stale history', async () => {
    const raf = createRafHarness()
    vi.stubGlobal('requestAnimationFrame', raf.requestAnimationFrame)
    vi.stubGlobal('cancelAnimationFrame', raf.cancelAnimationFrame)
    const contexts: CinemaMockWebGL[] = []
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((kind: string) => {
      if (kind !== 'webgl2') return null
      const gl = createCinemaMockWebGL()
      gl.getUniformLocation = vi.fn((_program: WebGLProgram, name: string) => ({ name } as unknown as WebGLUniformLocation))
      contexts.push(gl)
      return gl as unknown as RenderingContext
    })
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 960, height: 540, top: 0, left: 0, right: 960, bottom: 540, x: 0, y: 0, toJSON: () => ({}),
    })

    const activeRuntimeRef: { current: Cinema2RuntimeType | null } = { current: null }
    function Harness() {
      const [presetId, setPresetId] = useState<Cinema2PresetId>(CINEMA2_RUNTIME_FOUNDATION_PRESET_ID)
      const [runtime, setRuntime] = useState<Cinema2RuntimeType | null>(null)
      return <>
        <button data-testid="foundation" onClick={() => setPresetId(CINEMA2_RUNTIME_FOUNDATION_PRESET_ID)}>Foundation</button>
        <Cinema2PresetsPanel activePresetId={presetId} onSelectPreset={setPresetId} />
        <Cinema2Stage presetId={presetId} onRuntimeReady={next => { activeRuntimeRef.current = next; setRuntime(next) }} />
        <Cinema2InspectorPanel runtime={runtime} surface="design" />
      </>
    }

    await act(async () => root?.render(<Harness />))
    await act(async () => host?.querySelector<HTMLButtonElement>(`[data-cinema2-preset-id="${CINEMA2_HUMN_PRESET_ID}"]`)?.click())
    const first = activeRuntimeRef.current!
    expect(first.getCompiledPresetPlan().presetId).toBe(CINEMA2_HUMN_PRESET_ID)
    for (const id of [CINEMA2_HUMN_GLOW_ID, CINEMA2_HUMN_TRAILS_ID]) {
      expect(host?.querySelectorAll(`[data-cinema2-control-id="${id}"]`), String(id)).toHaveLength(1)
    }
    const labels = [...(host?.querySelectorAll('[data-cinema2-control-id^="hum-n-"]') ?? [])].map(node => node.getAttribute('data-cinema2-control-id'))
    expect(labels.some(id => String(id).includes('event-intent'))).toBe(false)

    await act(async () => raf.runNext(16.67))
    // Glow ships at a restrained default, so the bloom runs; Trails ships at 0, so no history buffer exists.
    expect(first.getEffectRuntimeSnapshot()).toMatchObject({ activeEffectCount: 1, failedEffectCount: 0 })
    expect(first.getHistoryServiceSnapshot().activeBufferCount).toBe(0)

    // Auto Color is on: the manual colors are collapsed out of the real Inspector, and come back when it is turned off.
    const control = (controlId: string) => host?.querySelectorAll(`[data-cinema2-control-id="${controlId}"]`).length
    expect(control(String(CINEMA2_HUMN_AUTO_COLOR_ID))).toBe(1)
    expect(control('hum-n-background')).toBe(1)
    for (const manual of ['hum-n-wireframe', 'hum-n-skin-primary', 'hum-n-skin-secondary', 'hum-n-skin-accent', 'hum-n-pattern-ink']) expect(control(manual), manual).toBe(0)
    for (const retired of ['hum-n-master-reactivity', 'hum-n-grid-presence', 'hum-n-gesture-intensity', 'hum-n-color-shift-amount']) expect(control(retired), retired).toBe(0)
    const autoColorSwitch = () => host?.querySelector<HTMLButtonElement>('button#cinema2-parameter-hum-n-auto-color')
    expect(autoColorSwitch()?.getAttribute('aria-checked')).toBe('true')
    await act(async () => autoColorSwitch()?.click())
    expect(first.getParameterState().getValue(CINEMA2_HUMN_AUTO_COLOR_ID)).toBe(false)
    for (const manual of ['hum-n-wireframe', 'hum-n-skin-primary', 'hum-n-skin-secondary', 'hum-n-skin-accent', 'hum-n-pattern-ink']) expect(control(manual), manual).toBe(1)
    await act(async () => autoColorSwitch()?.click())
    expect(first.getParameterState().getValue(CINEMA2_HUMN_AUTO_COLOR_ID)).toBe(true)
    for (const manual of ['hum-n-wireframe', 'hum-n-skin-primary', 'hum-n-skin-secondary', 'hum-n-skin-accent', 'hum-n-pattern-ink']) expect(control(manual), manual).toBe(0)

    const state = first.getParameterState()
    expect(state.setPersistentValue(CINEMA2_HUMN_GLOW_ID, 0.5)).toMatchObject({ ok: true })
    expect(state.setPersistentValue(CINEMA2_HUMN_TRAILS_ID, 0.5)).toMatchObject({ ok: true })
    await act(async () => raf.runNext(33.34))
    await act(async () => raf.runNext(50.01))
    expect(first.getEffectRuntimeSnapshot()).toMatchObject({ activeEffectCount: 2, failedEffectCount: 0 })
    expect(first.getHistoryServiceSnapshot()).toMatchObject({ activeBufferCount: 1, validBufferCount: 1 })
    expect(first.getRenderGraphExecutorSnapshot()).toMatchObject({ failedPassCount: 0 })

    await act(async () => host?.querySelector<HTMLButtonElement>('[data-testid="foundation"]')?.click())
    expect(activeRuntimeRef.current?.getCompiledPresetPlan().presetId).toBe(CINEMA2_RUNTIME_FOUNDATION_PRESET_ID)
    // Switch-away disposed the HUM:N runtime: no history or lease survives.
    expect(first.getHistoryServiceSnapshot()).toMatchObject({ activeBufferCount: 0, disposed: true })
    expect(first.getResourceManagerSnapshot()).toMatchObject({ activeLeaseCount: 0 })

    await act(async () => host?.querySelector<HTMLButtonElement>(`[data-cinema2-preset-id="${CINEMA2_HUMN_PRESET_ID}"]`)?.click())
    const second = activeRuntimeRef.current!
    expect(second).not.toBe(first)
    expect(second.getCompiledPresetPlan().presetId).toBe(CINEMA2_HUMN_PRESET_ID)
    await act(async () => raf.runNext(66.68))
    expect(second.getHistoryServiceSnapshot()).toMatchObject({ activeBufferCount: 0, validBufferCount: 0 })
    expect(second.getRenderGraphExecutorSnapshot()).toMatchObject({ failedPassCount: 0, executedPassCount: 3 })
  })
})
