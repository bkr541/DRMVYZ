/** @vitest-environment jsdom */

import React, { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReactStore } from '../../../../stores/reactStore'
import { ReactEngineBrowser } from '../../react/ReactEngineBrowser'
import { CinemaWorkspace, resolveCinemaWorkspaceModel } from '../../react/CinemaWorkspace'
import { ReactInspectorPanel } from '../../react/ReactInspectorPanel'
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
import { getCinemaComposerLayers } from '../CinemaComposer'
import { getCinemaCompositionLibraryStatus } from '../CinemaLibrary'
import { createCinemaDiagnosticSnapshot } from '../CinemaDiagnostics'
import {
  getDrmvyzWebGLContextDiagnosticsForTests,
  resetDrmvyzWebGLContextDiagnosticsForTests,
} from '../../react/shaders/runtime/WebGLContextLifecycle'
import { useCinemaStore } from '../CinemaStore'
import { getCinemaGraphEditorCompositionMetadata } from '../CinemaGraphEditorMetadata'

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
          <ReactInspectorPanel />
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
    expect(host?.textContent).toContain('Stage 19 Composer authoring wired to canonical Cinema state')
  })

  it('enters the real Cinema workspace from the engine selector and mutates canonical Composer state', async () => {
    await act(async () => root?.render(<ComposerSelectionHarness />))
    const trigger = host?.querySelector<HTMLButtonElement>('.rv-engine-dropdown-trigger')
    await act(async () => trigger?.click())
    const cinemaOption = [...(host?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])]
      .find(option => option.textContent?.includes('Cinema'))
    await act(async () => cinemaOption?.click())

    expect(useReactStore.getState().activeReactEngineId).toBe('cinema')
    expect(host?.textContent).toContain('Visuals & Library')
    expect(host?.textContent).toContain('Cinema Inspector')

    const newComposition = [...(host?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
      .find(button => button.textContent === 'New Composition')
    await act(async () => newComposition?.click())

    const activeId = useCinemaStore.getState().activeCompositionId
    const active = useCinemaStore.getState().compositions.find(composition => composition.id === activeId)
    expect(active?.metadata.provenance?.composerStructured).toBe(true)
    expect(active ? getCinemaComposerLayers(active) : []).toHaveLength(2)
    expect(active ? getCinemaCompositionLibraryStatus(active).modified : false).toBe(true)

    const canonicalBeforeModeSwitch = JSON.stringify(active)
    const graphModeButton = [...(host?.querySelectorAll<HTMLButtonElement>('.rv-cinema-composer__mode button') ?? [])]
      .find(button => button.textContent === 'Graph')
    await act(async () => graphModeButton?.click())
    expect(host?.querySelector('.rv-cinema-graph-editor__surface')).not.toBeNull()
    expect(getCinemaGraphEditorCompositionMetadata(useCinemaStore.getState().editorMetadata, activeId!).mode).toBe('graph')
    expect(JSON.stringify(useCinemaStore.getState().compositions.find(composition => composition.id === activeId))).toBe(canonicalBeforeModeSwitch)

    const structuredModeButton = [...(host?.querySelectorAll<HTMLButtonElement>('.rv-cinema-composer__mode button') ?? [])]
      .find(button => button.textContent === 'Structured')
    await act(async () => structuredModeButton?.click())
    expect(host?.querySelector('.rv-cinema-graph-editor__surface')).toBeNull()
    expect(getCinemaGraphEditorCompositionMetadata(useCinemaStore.getState().editorMetadata, activeId!).mode).toBe('structured')
    expect(JSON.stringify(useCinemaStore.getState().compositions.find(composition => composition.id === activeId))).toBe(canonicalBeforeModeSwitch)

    const saveComposition = [...(host?.querySelectorAll<HTMLButtonElement>('.rv-cinema-library-manager__actions button') ?? [])]
      .find(button => button.textContent === 'Save')
    expect(saveComposition?.disabled).toBe(false)
    await act(async () => saveComposition?.click())
    const saved = useCinemaStore.getState().compositions.find(composition => composition.id === activeId)
    expect(saved ? getCinemaCompositionLibraryStatus(saved).modified : true).toBe(false)
    expect(host?.textContent).toContain('Composition saved.')
    expect(host?.textContent).toContain('Modulation (0)')
    expect(host?.textContent).toContain('Performance (0)')
    expect(host?.textContent).toContain('Camera (0)')
    expect(host?.textContent).toContain('Timeline')

    const firstLayerButton = host?.querySelector<HTMLButtonElement>('.rv-cinema-composer__layer-select')
    firstLayerButton?.focus()
    expect(document.activeElement).toBe(firstLayerButton)
    expect(host?.querySelector<HTMLButtonElement>('button[aria-label="Move layer up"]')?.disabled).toBe(true)
    const disabledLibraryAction = [...(host?.querySelectorAll<HTMLButtonElement>('.rv-cinema-composer__library-item button[disabled]') ?? [])]
      .find(button => button.getAttribute('title'))
    expect(disabledLibraryAction?.getAttribute('title')).toBeTruthy()

    const opacity = host?.querySelector<HTMLInputElement>('.rv-cinema-composer input[type="range"]')
    expect(opacity).not.toBeNull()
    const undoBeforeGesture = useCinemaStore.getState().undoStack.length
    await act(async () => {
      if (!opacity) return
      opacity.focus()
      opacity.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
      for (const value of ['0.6', '0.35']) {
        opacity.value = value
        opacity.dispatchEvent(new Event('input', { bubbles: true }))
        opacity.dispatchEvent(new Event('change', { bubbles: true }))
      }
      opacity.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }))
    })
    expect(document.activeElement).toBe(opacity)
    expect(useCinemaStore.getState().undoStack).toHaveLength(undoBeforeGesture + 1)
    const updated = useCinemaStore.getState().compositions.find(composition => composition.id === activeId)
    expect(updated?.nodes.some(node => node.family === 'procedural' && node.opacity === 0.35)).toBe(true)
    expect(updated ? getCinemaCompositionLibraryStatus(updated).modified : false).toBe(true)

    const duplicateComposition = [...(host?.querySelectorAll<HTMLButtonElement>('.rv-cinema-library-manager__actions button') ?? [])]
      .find(button => button.textContent === 'Duplicate')
    await act(async () => duplicateComposition?.click())
    const duplicateId = useCinemaStore.getState().activeCompositionId
    expect(duplicateId).not.toBe(activeId)
    const duplicate = useCinemaStore.getState().compositions.find(composition => composition.id === duplicateId)
    expect(duplicate).toBeTruthy()
    expect(new Set(updated?.nodes.map(node => String(node.id))).has(String(duplicate?.nodes[0]?.id))).toBe(false)
    expect(duplicate ? getCinemaCompositionLibraryStatus(duplicate).modified : true).toBe(false)
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
