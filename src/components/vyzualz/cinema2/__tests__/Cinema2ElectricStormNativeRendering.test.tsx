/** @vitest-environment jsdom */

import React, { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCinemaMockWebGL, CinemaResizeObserverMock } from '../../cinema/__tests__/CinemaWebGLTestUtils'
import { Cinema2InspectorPanel } from '../../react/Cinema2InspectorPanel'
import { Cinema2PresetsPanel } from '../../react/Cinema2PresetsPanel'
import { Cinema2Stage } from '../../react/Cinema2Stage'
import {
  CINEMA2_ELECTRIC_STORM_BACKGROUND_ID,
  CINEMA2_ELECTRIC_STORM_BRANCHING_ID,
  CINEMA2_ELECTRIC_STORM_HAZE_ID,
  CINEMA2_ELECTRIC_STORM_GLOW_ID,
  CINEMA2_ELECTRIC_STORM_LIGHTNING_COLOR_ID,
  CINEMA2_ELECTRIC_STORM_MASTER_INTENSITY_ID,
  CINEMA2_ELECTRIC_STORM_PRESET_ID,
  CINEMA2_ELECTRIC_STORM_STRIKE_RATE_ID,
  CINEMA2_ELECTRIC_STORM_THICKNESS_ID,
  CINEMA2_RUNTIME_FOUNDATION_PRESET_ID,
  Cinema2ElectricStormStrikeGenerator,
  Cinema2ElectricStormThunderController,
  Cinema2RandomService,
  Cinema2Runtime,
  cinema2NativePresetRegistry,
  type Cinema2ModuleRandomnessFacet,
  type Cinema2PresetId,
} from '..'

function createRandomness(seed = 'electric-storm-stage14a', moduleId = 'electric-storm-procedural-lightning'): Cinema2ModuleRandomnessFacet {
  const service = new Cinema2RandomService({
    presetId: String(CINEMA2_ELECTRIC_STORM_PRESET_ID),
    revision: 1,
    stateKey: '{}',
    mode: 'deterministic',
    seed,
  })
  return Object.freeze({
    sample: (purpose: string, index = 0, substream?: string) => service.sample({ moduleId, purpose, substream }, index),
    probability: (purpose: string, probability: number, index = 0, substream?: string) => service.probability({ moduleId, purpose, substream }, probability, index),
    stream: (purpose: string, substream?: string) => service.stream({ moduleId, purpose, substream }),
    eventStream: (eventId: string, purpose: string, substream?: string) => service.eventStream(moduleId, eventId, purpose, substream),
  })
}

function requestedStrikeSequence(seed: string, count = 10) {
  const generator = new Cinema2ElectricStormStrikeGenerator(createRandomness(seed))
  const strikes = []
  for (let index = 0; index < count; index += 1) {
    generator.request({ tier: index % 3 === 0 ? 'strong' : 'medium', power: 0.9, eventId: `event-${index}` })
    const frame = generator.update(index, 0)
    strikes.push(...frame.started)
  }
  return { generator, strikes }
}

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

function createElectricStormRuntime(seed = 'runtime-seed') {
  const gl = createCinemaMockWebGL()
  gl.getUniformLocation = vi.fn((_program: WebGLProgram, name: string) => ({ name } as unknown as WebGLUniformLocation))
  const raf = createRafHarness()
  const canvas = new FakeCanvas(gl)
  const result = Cinema2Runtime.create(canvas as unknown as HTMLCanvasElement, {
    presetId: CINEMA2_ELECTRIC_STORM_PRESET_ID,
    presetRegistry: cinema2NativePresetRegistry,
    requestAnimationFrame: raf.requestAnimationFrame,
    cancelAnimationFrame: raf.cancelAnimationFrame,
    randomness: { mode: 'deterministic', seed },
  })
  if (!result.runtime) throw new Error(result.error)
  return { runtime: result.runtime, gl, raf, canvas }
}

function lastUniformFloat(gl: ReturnType<typeof createCinemaMockWebGL>, name: string): number | undefined {
  const calls = (gl.uniform1f as ReturnType<typeof vi.fn>).mock.calls.filter((call: unknown[]) => (call[0] as { name?: string } | null)?.name === name)
  return calls.at(-1)?.[1] as number | undefined
}

function lastUniformVec3(gl: ReturnType<typeof createCinemaMockWebGL>, name: string): readonly number[] | undefined {
  const calls = (gl.uniform3f as ReturnType<typeof vi.fn>).mock.calls.filter((call: unknown[]) => (call[0] as { name?: string } | null)?.name === name)
  const call = calls.at(-1)
  return call ? [call[1], call[2], call[3]] as const : undefined
}

describe('Cinema 2.0 Electric Storm 14A procedural lightning', () => {
  it('generates bounded strike candidates with the preserved topology vocabulary', () => {
    const generator = new Cinema2ElectricStormStrikeGenerator(createRandomness())
    generator.request({ tier: 'hero', power: 1, count: 2, detail: 0.9, eventId: 'hero-a' })
    const frame = generator.update(0, 0)
    expect(frame.started).toHaveLength(2)
    for (const strike of frame.started) {
      expect(strike.start.x).toBeGreaterThanOrEqual(-1)
      expect(strike.start.x).toBeLessThanOrEqual(1)
      expect(strike.end.y).toBeGreaterThanOrEqual(-1)
      expect(strike.end.y).toBeLessThanOrEqual(1)
      expect(['vertical', 'horizontal', 'diagonal']).toContain(strike.orientation)
      expect(['edgeToEdge', 'edgeToInterior', 'interiorToEdge', 'interiorToInterior']).toContain(strike.placement)
      expect(['short', 'medium', 'long']).toContain(strike.lengthClass)
      expect(strike.branchDetail).toBeGreaterThanOrEqual(0)
      expect(strike.branchDetail).toBeLessThanOrEqual(1)
    }
  })

  it('replays the same strike candidates for the same engine seed and diverges for another seed', () => {
    const first = requestedStrikeSequence('same-seed', 8).strikes
    const second = requestedStrikeSequence('same-seed', 8).strikes
    const different = requestedStrikeSequence('different-seed', 8).strikes
    expect(second).toEqual(first)
    expect(different).not.toEqual(first)
  })

  it('preserves local anti-repeat history and stays bounded under high-density stress', () => {
    const { generator, strikes } = requestedStrikeSequence('anti-repeat', 24)
    expect(strikes).toHaveLength(24)
    for (let index = 1; index < strikes.length; index += 1) expect(strikes[index].signature).not.toBe(strikes[index - 1].signature)
    expect(generator.getDiagnostics().historyCount).toBeLessThanOrEqual(8)

    for (let index = 0; index < 5000; index += 1) {
      const frame = generator.update(24 + index / 60, 1)
      expect(frame.active.length).toBeLessThanOrEqual(3)
    }
    expect(generator.getDiagnostics()).toMatchObject({ historyCount: 8, pendingRequestCount: 0 })
  })

  it('resets thunder local state without introducing shared musical event authority', () => {
    const strike = requestedStrikeSequence('thunder', 1).strikes[0]
    if (!strike) throw new Error('Expected a strike fixture.')
    const thunder = new Cinema2ElectricStormThunderController()
    thunder.trigger({ ...strike, tier: 'strong' })
    expect(thunder.update(0.02).illumination).toBeGreaterThan(0)
    thunder.reset()
    expect(thunder.update(0.02)).toEqual({ illumination: 0, active: false })
  })

  it('renders through the native runtime, consumes shared Environment state, and releases tracked resources', () => {
    const { runtime, gl, raf, canvas } = createElectricStormRuntime()
    runtime.resize({ width: 960, height: 540, dpr: 1 })
    runtime.start()
    raf.runNext(16.67)

    expect(runtime.getCompiledPresetPlan().presetId).toBe(CINEMA2_ELECTRIC_STORM_PRESET_ID)
    expect(runtime.getModuleRuntimeSnapshot()).toMatchObject({ activeModuleCount: 1, failedModuleCount: 0, activeResourceLeaseCount: 2 })
    expect(runtime.getRenderGraphExecutorSnapshot()).toMatchObject({ frameCount: 1, executedPassCount: 1, failedPassCount: 0 })
    expect(lastUniformVec3(gl, 'u_background')).toEqual([0.004, 0.007, 0.014])
    expect(lastUniformFloat(gl, 'u_fogDensity')).toBeCloseTo(0.08)

    expect(runtime.getParameterState().setPersistentValue(CINEMA2_ELECTRIC_STORM_BACKGROUND_ID, [0.12, 0.04, 0.02, 1]).ok).toBe(true)
    expect(runtime.getParameterState().setPersistentValue(CINEMA2_ELECTRIC_STORM_HAZE_ID, 0.2).ok).toBe(true)
    raf.runNext(33.34)
    expect(lastUniformVec3(gl, 'u_background')).toEqual([0.12, 0.04, 0.02])
    expect(lastUniformFloat(gl, 'u_fogDensity')).toBeCloseTo(0.2)

    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
    expect(runtime.getModuleRuntimeSnapshot().activeResourceLeaseCount).toBe(0)
    canvas.dispatchEvent(new Event('webglcontextrestored'))
    expect(runtime.getModuleRuntimeSnapshot()).toMatchObject({ activeModuleCount: 1, activeResourceLeaseCount: 0 })
    runtime.dispose()
    expect(gl.__calls.deletedPrograms).toBe(gl.__calls.createdPrograms)
    expect(runtime.getModuleRuntimeSnapshot()).toMatchObject({ activeModuleCount: 0, activeResourceLeaseCount: 0 })
  })

  it('keeps generic runtime owners free of Electric Storm identity branches', () => {
    expect(Cinema2Runtime.toString().toLowerCase()).not.toContain('electricstorm')
    expect(Cinema2Runtime.toString().toLowerCase()).not.toContain('electric-storm')
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

describe('Cinema 2.0 Electric Storm production selection path', () => {
  it('selects Electric Storm 2.0 through the real preset browser, activates Stage, and exposes only Stage 14A Design controls', async () => {
    CinemaResizeObserverMock.reset()
    vi.stubGlobal('ResizeObserver', CinemaResizeObserverMock)
    const raf = createRafHarness()
    vi.stubGlobal('requestAnimationFrame', raf.requestAnimationFrame)
    vi.stubGlobal('cancelAnimationFrame', raf.cancelAnimationFrame)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((kind: string) => kind === 'webgl2' ? createCinemaMockWebGL() as unknown as RenderingContext : null)
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 960, height: 540, top: 0, left: 0, right: 960, bottom: 540, x: 0, y: 0, toJSON: () => ({}),
    })
    const activeRuntimeRef: { current: Cinema2Runtime | null } = { current: null }

    function Harness() {
      const [presetId, setPresetId] = useState<Cinema2PresetId>(CINEMA2_RUNTIME_FOUNDATION_PRESET_ID)
      const [runtime, setRuntime] = useState<Cinema2Runtime | null>(null)
      return <>
        <Cinema2PresetsPanel activePresetId={presetId} onSelectPreset={setPresetId} />
        <Cinema2Stage presetId={presetId} onRuntimeReady={next => { activeRuntimeRef.current = next; setRuntime(next) }} />
        <Cinema2InspectorPanel runtime={runtime} surface="design" />
        <Cinema2InspectorPanel runtime={runtime} surface="react" />
      </>
    }

    await act(async () => root?.render(<Harness />))
    const button = host?.querySelector<HTMLButtonElement>(`[data-cinema2-preset-id="${CINEMA2_ELECTRIC_STORM_PRESET_ID}"]`)
    expect(button?.textContent).toContain('Electric Storm 2.0')
    await act(async () => button?.click())

    expect(activeRuntimeRef.current?.getCompiledPresetPlan().presetId).toBe(CINEMA2_ELECTRIC_STORM_PRESET_ID)
    for (const id of [
      CINEMA2_ELECTRIC_STORM_LIGHTNING_COLOR_ID,
      CINEMA2_ELECTRIC_STORM_MASTER_INTENSITY_ID,
      CINEMA2_ELECTRIC_STORM_STRIKE_RATE_ID,
      CINEMA2_ELECTRIC_STORM_BRANCHING_ID,
      CINEMA2_ELECTRIC_STORM_THICKNESS_ID,
      CINEMA2_ELECTRIC_STORM_BACKGROUND_ID,
      CINEMA2_ELECTRIC_STORM_HAZE_ID,
  CINEMA2_ELECTRIC_STORM_GLOW_ID,
    ]) expect(host?.querySelector(`[data-cinema2-control-id="${id}"]`)).not.toBeNull()
    expect(host?.querySelector('[data-cinema2-inspector="react"]')?.textContent ?? '').not.toContain('Electric Storm')

    await act(async () => raf.runNext())
    expect(activeRuntimeRef.current?.getRenderGraphExecutorSnapshot()).toMatchObject({ frameCount: 1, executedPassCount: 1, failedPassCount: 0 })
  })
})
