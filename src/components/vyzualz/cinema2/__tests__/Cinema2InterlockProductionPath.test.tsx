/** @vitest-environment jsdom */

import React, { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createCinemaMockWebGL, CinemaResizeObserverMock, type CinemaMockWebGL } from '../../cinema/__tests__/CinemaWebGLTestUtils'
import { Cinema2InspectorPanel } from '../../react/Cinema2InspectorPanel'
import { Cinema2PresetsPanel } from '../../react/Cinema2PresetsPanel'
import { Cinema2Stage } from '../../react/Cinema2Stage'
import {
  CINEMA2_INTERLOCK_BACKGROUND_ATMOSPHERE_ID,
  CINEMA2_INTERLOCK_BACKGROUND_FLOW_ID,
  CINEMA2_INTERLOCK_BACKGROUND_PALETTE_MODE_ID,
  CINEMA2_INTERLOCK_CENTER_GLOW_ID,
  CINEMA2_INTERLOCK_EDGE_DARKNESS_ID,
  CINEMA2_INTERLOCK_EFFECTS_INTENSITY_ID,
  CINEMA2_INTERLOCK_LED_COLOR_ID,
  CINEMA2_INTERLOCK_LED_INTENSITY_ID,
  CINEMA2_INTERLOCK_LIT_DENSITY_ID,
  CINEMA2_INTERLOCK_MIRROR_SEGMENT_DIRECTION_ID,
  CINEMA2_INTERLOCK_MORPH_DURATION_ID,
  CINEMA2_INTERLOCK_PATTERN_PARAMETER_ID,
  CINEMA2_INTERLOCK_PRESET_ID,
  CINEMA2_INTERLOCK_ROTATION_AMOUNT_ID,
  CINEMA2_INTERLOCK_SEGMENT_AFTERGLOW_ID,
  CINEMA2_INTERLOCK_SEGMENT_FADE_ID,
  CINEMA2_INTERLOCK_SEGMENT_PATTERN_ID,
  CINEMA2_INTERLOCK_SEGMENT_SPEED_ID,
  CINEMA2_INTERLOCK_SYMMETRY_ID,
  CINEMA2_INTERLOCK_UNLIT_VISIBILITY_ID,
  CINEMA2_RUNTIME_FOUNDATION_PRESET_ID,
  type Cinema2PresetId,
} from '..'
import type { Cinema2Runtime } from '../runtime/Cinema2Runtime'

let root: Root | null = null
let host: HTMLDivElement | null = null

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

function lastInstanceCount(gl: CinemaMockWebGL): number {
  const calls = (gl.drawArraysInstanced as unknown as { mock: { calls: unknown[][] } }).mock.calls
  return Number(calls.at(-1)?.[3] ?? 0)
}

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

describe('Cinema 2.0 Interlock production selection path', () => {
  it('appears once in the real preset browser, activates the native runtime, exposes Stage 4 schema controls, and executes the liquid-light/effects path with 28 LED instances', async () => {
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

    function Harness() {
      const [presetId, setPresetId] = useState<Cinema2PresetId>(CINEMA2_RUNTIME_FOUNDATION_PRESET_ID)
      const [runtime, setRuntime] = useState<Cinema2Runtime | null>(null)
      return <>
        <Cinema2PresetsPanel activePresetId={presetId} onSelectPreset={setPresetId} />
        <Cinema2Stage presetId={presetId} onRuntimeReady={next => { activeRuntimeRef.current = next; setRuntime(next) }} />
        <Cinema2InspectorPanel runtime={runtime} surface="design" />
      </>
    }

    await act(async () => root?.render(<Harness />))
    const buttons = host?.querySelectorAll<HTMLButtonElement>(`[data-cinema2-preset-id="${CINEMA2_INTERLOCK_PRESET_ID}"]`) ?? []
    expect(buttons).toHaveLength(1)
    expect(buttons[0]?.textContent).toContain('Interlock')
    await act(async () => buttons[0]?.click())

    expect(activeRuntimeRef.current?.getCompiledPresetPlan().presetId).toBe(CINEMA2_INTERLOCK_PRESET_ID)
    expect(activeRuntimeRef.current?.getModuleRuntimeSnapshot()).toMatchObject({
      activeModuleCount: 2,
      failedModuleCount: 0,
      modules: [
        expect.objectContaining({ renderProviderCount: 1, status: 'active' }),
        expect.objectContaining({ renderProviderCount: 1, status: 'active' }),
      ],
    })
    for (const id of [
      CINEMA2_INTERLOCK_PATTERN_PARAMETER_ID,
      CINEMA2_INTERLOCK_SYMMETRY_ID,
      CINEMA2_INTERLOCK_LED_COLOR_ID,
      CINEMA2_INTERLOCK_LED_INTENSITY_ID,
      CINEMA2_INTERLOCK_BACKGROUND_PALETTE_MODE_ID,
      CINEMA2_INTERLOCK_BACKGROUND_ATMOSPHERE_ID,
      CINEMA2_INTERLOCK_BACKGROUND_FLOW_ID,
      CINEMA2_INTERLOCK_CENTER_GLOW_ID,
      CINEMA2_INTERLOCK_EDGE_DARKNESS_ID,
      CINEMA2_INTERLOCK_EFFECTS_INTENSITY_ID,
      CINEMA2_INTERLOCK_ROTATION_AMOUNT_ID,
      CINEMA2_INTERLOCK_MORPH_DURATION_ID,
      CINEMA2_INTERLOCK_SEGMENT_PATTERN_ID,
      CINEMA2_INTERLOCK_LIT_DENSITY_ID,
      CINEMA2_INTERLOCK_SEGMENT_SPEED_ID,
      CINEMA2_INTERLOCK_SEGMENT_FADE_ID,
      CINEMA2_INTERLOCK_SEGMENT_AFTERGLOW_ID,
      CINEMA2_INTERLOCK_UNLIT_VISIBILITY_ID,
      CINEMA2_INTERLOCK_MIRROR_SEGMENT_DIRECTION_ID,
    ]) expect(host?.querySelector(`[data-cinema2-control-id="${id}"]`)).not.toBeNull()

    await act(async () => raf.runNext())
    const gl = contexts.at(-1)
    expect(gl).toBeDefined()
    if (!gl) return
    expect(lastInstanceCount(gl)).toBe(28)
    expect(gl.__calls.drawInstancedCount).toBeGreaterThan(0)
    expect(activeRuntimeRef.current?.getRenderGraphExecutorSnapshot()).toMatchObject({
      frameCount: 1,
      executedPassCount: 3,
      failedPassCount: 0,
    })
  })

  it('samples live Sync/BPM prop changes through the stable production Stage transport without recreating the runtime', async () => {
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
    const ready = vi.fn()
    const runtimeRef: { current: Cinema2Runtime | null } = { current: null }
    let audioTime = 0

    function Harness() {
      const [sync, setSync] = useState(false)
      return <>
        <button data-testid="toggle-sync" onClick={() => setSync(value => !value)}>Toggle Sync</button>
        <Cinema2Stage
          presetId={CINEMA2_INTERLOCK_PRESET_ID}
          isPlaying
          analysisActive
          isPaused={false}
          activeAudioTrackId="track-stage-sync"
          bpmSync={sync}
          bpm={128}
          getAudioTime={() => audioTime}
          onRuntimeReady={runtime => {
            runtimeRef.current = runtime
            ready(runtime)
          }}
        />
      </>
    }

    await act(async () => root?.render(<Harness />))
    const originalRuntimeIdentity = runtimeRef.current
    expect(runtimeRef.current).not.toBeNull()
    await act(async () => raf.runNext(16.67))
    expect(runtimeRef.current?.getTransportFrameState()).toMatchObject({ bpmSync: false, bpm: 128 })

    audioTime = 0.46875
    await act(async () => host?.querySelector<HTMLButtonElement>('[data-testid="toggle-sync"]')?.click())
    await act(async () => raf.runNext(33.34))

    expect(runtimeRef.current).toBe(originalRuntimeIdentity)
    expect(runtimeRef.current?.getTransportFrameState()).toMatchObject({ bpmSync: true, bpm: 128, trackId: 'track-stage-sync' })
    expect(contexts).toHaveLength(1)
    expect(ready).toHaveBeenCalledTimes(1)
  })

})
