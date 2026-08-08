/** @vitest-environment jsdom */

import React, { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReactStore } from '../../../../stores/reactStore'
import { ReactEngineBrowser } from '../../react/ReactEngineBrowser'
import { CinemaRenderedDiagnostics, CinemaWorkspace, resolveCinemaWorkspaceModel } from '../../react/CinemaWorkspace'
import { CinemaInspectorPanel } from '../../react/CinemaInspectorPanel'
import { CinemaLayersPanel, CinemaLibraryPanel, CinemaPresetsPanel } from '../../react/CinemaWorkspacePanels'
import { CinemaResizeObserverMock, createCinemaMockWebGL } from './CinemaWebGLTestUtils'
import { buildCinemaWorkspaceFrameBridge } from '../../react/CinemaWorkspaceFrameBridge'
import {
  acquireReactLiveEngineOwnership,
  getReactLiveEngineOwnershipDiagnosticsForTests,
  resetReactLiveEngineOwnershipForTests,
} from '../../react/renderers/ReactLiveEngineOwnership'
import {
  CINEMA_STAGE16_REFERENCE_COMPOSITION_ID,
  createCinemaFoundationPersistedState,
} from '../CinemaFoundation'
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

function ComposerSelectionHarness() {
  const engineId = useReactStore(state => state.activeReactEngineId)
  return (
    <>
      <ReactEngineBrowser />
      {engineId === 'cinema' ? (
        <>
          <CinemaWorkspace surface="panel" frameBridge={productionFrameBridge} />
          <CinemaPresetsPanel />
          <CinemaLayersPanel />
          <CinemaLibraryPanel />
          <CinemaInspectorPanel />
        </>
      ) : <div data-composer-legacy-engine={engineId} />}
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
  it('starts in Cinema, hides retired identities, owns one runtime, and retires it on a user-facing engine switch', async () => {
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

    const state = useReactStore.getState()
    const canvas = host?.querySelector<HTMLCanvasElement>('[data-cinema-output-canvas="true"]') ?? null
    expect(state.activeReactEngineId).toBe('cinema')
    expect(state.activeReactPresetId).toBeNull()
    expect(host?.querySelector('[data-cinema-workspace="runtime"]')).not.toBeNull()
    expect(canvas).not.toBeNull()
    expect(getReactLiveEngineOwnershipDiagnosticsForTests()).toMatchObject({
      activeEngine: 'cinema',
      activeOwnerCount: 1,
      phase: 'stable',
    })
    expect(getContext).toHaveBeenCalledTimes(1)
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1)
    expect(callbacks.size).toBe(1)
    expect(onCanvasReady).toHaveBeenCalledWith(canvas)

    const runtimeFrame = [...callbacks.entries()][0]
    callbacks.delete(runtimeFrame[0])
    await act(async () => runtimeFrame[1](16.67))
    expect(gl.__calls.drawCount).toBe(2)
    expect(host?.querySelector('[data-cinema-output-rendered="true"]')).not.toBeNull()
    expect(host?.querySelector('.rv-cinema-workspace__stage-card')).toBeNull()

    const trigger = host?.querySelector<HTMLButtonElement>('.rv-engine-dropdown-trigger')
    expect(trigger).not.toBeNull()
    await act(async () => trigger?.click())
    const options = [...(host?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])]
    expect(options.some(option => option.textContent?.includes('Shader Pads'))).toBe(false)
    expect(options.some(option => option.textContent?.includes('Cinematic Worlds'))).toBe(false)
    const soundDrawingOption = options.find(option => option.textContent?.includes('Sound Drawing'))
    expect(soundDrawingOption).not.toBeUndefined()
    await act(async () => soundDrawingOption?.click())

    expect(useReactStore.getState().activeReactEngineId).toBe('oscilloscope')
    expect(host?.querySelector('[data-legacy-engine="oscilloscope"]')).not.toBeNull()
    expect(cancelAnimationFrame).toHaveBeenCalledTimes(1)
    expect(callbacks.size).toBe(0)
    expect(onCanvasReady).toHaveBeenLastCalledWith(null)
    expect(getReactLiveEngineOwnershipDiagnosticsForTests()).toMatchObject({
      activeEngine: 'oscilloscope',
      activeOwnerCount: 1,
      phase: 'stable',
    })
    expect(retire).not.toHaveBeenCalled()
  })

  it('surfaces the Stage 19 Composer through the canonical Cinema store and production workspace', async () => {
    const selected = useCinemaStore.getState().setActiveCinemaComposition(CINEMA_STAGE16_REFERENCE_COMPOSITION_ID)
    expect(selected.ok).toBe(true)

    await act(async () => root?.render(
      <CinemaWorkspace surface="panel" frameBridge={productionFrameBridge} />,
    ))

    expect(useCinemaStore.getState().activeCompositionId).toBe(CINEMA_STAGE16_REFERENCE_COMPOSITION_ID)
    expect(host?.textContent).toContain('Cinema Layer Compositor Reference')
    expect(host?.textContent).toContain('Choose the active preset in Presets')
    expect(host?.textContent).not.toContain('Cinema Runtime')
  })

  it('exposes the moved runtime summary through the compact Rendered Diagnostics group', async () => {
    await act(async () => root?.render(
      <CinemaRenderedDiagnostics frameBridge={productionFrameBridge} runtimeSnapshot={null} />,
    ))

    expect(host?.textContent).toContain('Rendered Diagnostics')
    expect(host?.textContent).toContain('Active composition')
    expect(host?.textContent).toContain('Cinema runtime owns the stage')
  })

  it('enters the Cinema workspace with one preset selector and live Design overrides', async () => {
    await act(async () => root?.render(<ComposerSelectionHarness />))
    const trigger = host?.querySelector<HTMLButtonElement>('.rv-engine-dropdown-trigger')
    await act(async () => trigger?.click())
    const cinemaOption = [...(host?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])]
      .find(option => option.textContent?.includes('Cinema'))
    await act(async () => cinemaOption?.click())

    expect(useReactStore.getState().activeReactEngineId).toBe('cinema')
    expect(host?.textContent).toContain('Presets')
    expect(host?.textContent).toContain('Layers')
    expect(host?.textContent).toContain('Library')
    expect(host?.textContent).toContain('Preset Look')
    expect(host?.textContent).toContain('Find Effects')
    expect(host?.textContent).not.toContain('New Composition')
    expect(host?.textContent).not.toContain('Cinema Composer')

    const presetButton = host?.querySelector<HTMLButtonElement>('.rv-preset-card')
    await act(async () => presetButton?.click())
    const layerButton = host?.querySelector<HTMLButtonElement>('.rv-cinema-layer-tree button')
    await act(async () => layerButton?.click())
    const color = host?.querySelector<HTMLInputElement>('.rv-ctrl-color-input')
    expect(color).not.toBeNull()
    await act(async () => {
      if (!color) return
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(color, '#123456')
      color.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(useCinemaStore.getState().instances.some(instance => instance.metadata?.reactLiveOverride === true)).toBe(true)
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
