/** @vitest-environment jsdom */

import React, { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReactStore } from '../../../../stores/reactStore'
import { ReactEngineBrowser } from '../../react/ReactEngineBrowser'
import { CinemaWorkspace, resolveCinemaWorkspaceModel } from '../../react/CinemaWorkspace'
import { CinemaResizeObserverMock, createCinemaMockWebGL } from './CinemaWebGLTestUtils'
import { buildCinemaWorkspaceFrameBridge } from '../../react/CinemaWorkspaceFrameBridge'
import {
  acquireReactLiveEngineOwnership,
  getReactLiveEngineOwnershipDiagnosticsForTests,
  resetReactLiveEngineOwnershipForTests,
} from '../../react/renderers/ReactLiveEngineOwnership'
import { createCinemaFoundationPersistedState } from '../CinemaFoundation'
import { createCinemaDiagnosticSnapshot } from '../CinemaDiagnostics'
import {
  getDrmvyzWebGLContextDiagnosticsForTests,
  resetDrmvyzWebGLContextDiagnosticsForTests,
} from '../../react/shaders/runtime/WebGLContextLifecycle'
import { useCinemaStore } from '../CinemaStore'

let root: Root | null = null
let host: HTMLDivElement | null = null

function LegacyOwnershipProbe({ retire }: { retire: () => void }) {
  const engineId = useReactStore(state => state.activeReactEngineId)
  useEffect(() => {
    if (engineId === 'cinema') return
    const ownership = acquireReactLiveEngineOwnership(engineId, retire)
    ownership.markStable()
    return () => ownership.retire('unmount')
  }, [engineId, retire])
  return null
}

const productionFrameBridge = buildCinemaWorkspaceFrameBridge({
  width: 1,
  height: 1,
  dpr: 1,
  audioTimeSec: 0,
  durationSec: null,
  trackId: null,
  playing: false,
  paused: false,
  bpm: null,
})

function ProductionSelectionHarness({
  retire,
  onCanvasReady,
}: {
  retire: () => void
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void
}) {
  const engineId = useReactStore(state => state.activeReactEngineId)
  return (
    <>
      <ReactEngineBrowser />
      <LegacyOwnershipProbe retire={retire} />
      {engineId === 'cinema' ? (
        <CinemaWorkspace
          surface="stage"
          frameBridge={productionFrameBridge}
          onCanvasReady={onCanvasReady}
        />
      ) : <div data-legacy-engine={engineId} />}
    </>
  )
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  CinemaResizeObserverMock.reset()
  vi.stubGlobal('ResizeObserver', CinemaResizeObserverMock)
  resetReactLiveEngineOwnershipForTests()
  resetDrmvyzWebGLContextDiagnosticsForTests()
  useReactStore.getState().resetReactView()
  useCinemaStore.getState().hydrateCinemaState(createCinemaFoundationPersistedState())
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root?.unmount())
  root = null
  host?.remove()
  host = null
  resetReactLiveEngineOwnershipForTests()
  resetDrmvyzWebGLContextDiagnosticsForTests()
  vi.unstubAllGlobals()
})

describe('Cinema production engine registration', () => {
  it('selects Cinema through the real engine dropdown, claims one runtime owner, and synchronously retires it on engine switch', async () => {
    const retire = vi.fn()
    const onCanvasReady = vi.fn()
    const gl = createCinemaMockWebGL()
    const callbacks = new Map<number, FrameRequestCallback>()
    let nextRaf = 1
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      const id = nextRaf++
      callbacks.set(id, callback)
      return id
    })
    const cancelAnimationFrame = vi.fn((id: number) => { callbacks.delete(id) })
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame)
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame)
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((kind: string) => (
      kind === 'webgl2' ? gl : null
    ) as RenderingContext | null)
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

    await act(async () => root?.render(<ProductionSelectionHarness retire={retire} onCanvasReady={onCanvasReady} />))
    expect(getReactLiveEngineOwnershipDiagnosticsForTests()).toMatchObject({
      activeEngine: 'cinematicPortal',
      activeOwnerCount: 1,
    })

    const trigger = host?.querySelector<HTMLButtonElement>('.rv-engine-dropdown-trigger')
    expect(trigger).not.toBeNull()
    await act(async () => trigger?.click())

    const cinemaOption = [...(host?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])]
      .find(option => option.textContent?.includes('Cinema'))
    expect(cinemaOption).not.toBeUndefined()
    await act(async () => cinemaOption?.click())

    const state = useReactStore.getState()
    const canvas = host?.querySelector<HTMLCanvasElement>('[data-cinema-output-canvas="true"]') ?? null
    expect(state.activeReactEngineId).toBe('cinema')
    expect(state.activeReactPresetId).toBeNull()
    expect(host?.querySelector('[data-cinema-workspace="runtime"]')).not.toBeNull()
    expect(host?.querySelector('[data-cinema-frame-available="true"]')).not.toBeNull()
    expect(host?.textContent).toContain('Media, text, lyrics, and masks')
    expect(canvas).not.toBeNull()
    expect(retire).toHaveBeenCalledTimes(1)
    expect(getReactLiveEngineOwnershipDiagnosticsForTests()).toMatchObject({
      activeEngine: 'cinema',
      activeOwnerCount: 1,
      phase: 'stable',
    })
    expect(getContext).toHaveBeenCalledTimes(1)
    expect(getContext).toHaveBeenCalledWith('webgl2', expect.objectContaining({ premultipliedAlpha: true }))
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1)
    expect(callbacks.size).toBe(1)
    expect(onCanvasReady).toHaveBeenCalledWith(canvas)

    const runtimeFrame = [...callbacks.entries()][0]
    callbacks.delete(runtimeFrame[0])
    await act(async () => runtimeFrame[1](16.67))
    expect(gl.__calls.drawCount).toBe(2)
    expect(host?.querySelector('[data-cinema-output-rendered="true"]')).not.toBeNull()
    expect(host?.textContent).toContain('Output rendered')
    expect(host?.textContent).toContain('Performance rules')

    await act(async () => trigger?.click())
    const cinematicOption = [...(host?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])]
      .find(option => option.textContent?.includes('Cinematic Worlds'))
    expect(cinematicOption).not.toBeUndefined()
    await act(async () => cinematicOption?.click())

    expect(useReactStore.getState().activeReactEngineId).toBe('cinematicPortal')
    expect(host?.querySelector('[data-legacy-engine="cinematicPortal"]')).not.toBeNull()
    expect(cancelAnimationFrame).toHaveBeenCalledTimes(1)
    expect(callbacks.size).toBe(0)
    expect(onCanvasReady).toHaveBeenLastCalledWith(null)
    expect(getReactLiveEngineOwnershipDiagnosticsForTests()).toMatchObject({
      activeEngine: 'cinematicPortal',
      activeOwnerCount: 1,
      phase: 'stable',
    })
  })

  it('keeps only one active Cinema context and loop through a Strict Mode effect replay', async () => {
    const gl = createCinemaMockWebGL()
    const callbacks = new Map<number, FrameRequestCallback>()
    let nextRaf = 1
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      const id = nextRaf++
      callbacks.set(id, callback)
      return id
    })
    const cancelAnimationFrame = vi.fn((id: number) => { callbacks.delete(id) })
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame)
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame)
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((kind: string) => (
      kind === 'webgl2' ? gl : null
    ) as RenderingContext | null)
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 640,
      height: 360,
      top: 0,
      left: 0,
      right: 640,
      bottom: 360,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    await act(async () => root?.render(
      <React.StrictMode>
        <CinemaWorkspace surface="stage" frameBridge={productionFrameBridge} />
      </React.StrictMode>,
    ))

    expect(getContext).toHaveBeenCalledTimes(2)
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2)
    expect(cancelAnimationFrame).toHaveBeenCalledTimes(1)
    expect(callbacks.size).toBe(1)
    expect(getReactLiveEngineOwnershipDiagnosticsForTests()).toMatchObject({
      activeEngine: 'cinema',
      activeOwnerCount: 1,
      phase: 'stable',
    })
    expect(getDrmvyzWebGLContextDiagnosticsForTests()).toMatchObject({
      activeCount: 1,
      duplicateOwnershipCount: 0,
      activeLiveByEngine: { cinema: 1 },
    })
  })

  it('returns structured diagnostics and safe output for a stale active composition reference', () => {
    const model = resolveCinemaWorkspaceModel({
      activeCompositionId: 'cinema.composition.missing' as never,
      activeInstanceId: null,
      compositions: [],
      instances: [],
      lastDiagnostics: createCinemaDiagnosticSnapshot([]),
    })

    expect(model.activeComposition).toBeNull()
    expect(model.runtimeAvailable).toBe(true)
    expect(model.statusLabel).toBe('Needs attention')
    expect(model.diagnostics.diagnostics.some(diagnostic => (
      diagnostic.code === 'CINEMA_VALIDATION_FAILED'
      && diagnostic.attribution?.compositionId === 'cinema.composition.missing'
    ))).toBe(true)
    expect(model.diagnostics.diagnostics.some(diagnostic => (
      diagnostic.code === 'CINEMA_SAFE_OUTPUT_ACTIVE'
    ))).toBe(false)
  })
})
