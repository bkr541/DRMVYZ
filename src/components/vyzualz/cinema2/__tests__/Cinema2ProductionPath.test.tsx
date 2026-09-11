/** @vitest-environment jsdom */

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioFeatureBus } from '../../../../features/musicIntelligence/AudioFeatureBus'
import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import { useReactStore } from '../../../../stores/reactStore'
import { Cinema2Stage } from '../../react/Cinema2Stage'
import { ReactEngineBrowser } from '../../react/ReactEngineBrowser'
import { CinemaWorkspace } from '../../react/CinemaWorkspace'
import { buildCinemaWorkspaceFrameBridge } from '../../react/CinemaWorkspaceFrameBridge'
import {
  getReactLiveEngineOwnershipDiagnosticsForTests,
  resetReactLiveEngineOwnershipForTests,
} from '../../react/renderers/ReactLiveEngineOwnership'
import {
  getDrmvyzWebGLContextDiagnosticsForTests,
  resetDrmvyzWebGLContextDiagnosticsForTests,
} from '../../react/shaders/runtime/WebGLContextLifecycle'
import {
  CINEMA_FOUNDATION_COMPOSITION,
  createCinemaFoundationPersistedState,
} from '../../cinema/CinemaFoundation'
import { useCinemaStore } from '../../cinema/CinemaStore'
import { CinemaResizeObserverMock, createCinemaMockWebGL } from '../../cinema/__tests__/CinemaWebGLTestUtils'
import { getCinema2AudioIntelligenceBridgeDiagnostics } from '../audio/Cinema2AudioIntelligenceBridge'
import { getCinema2RuntimeDiagnostics, type Cinema2Runtime } from '../runtime/Cinema2Runtime'

let root: Root | null = null
let host: HTMLDivElement | null = null

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
  musicIntelligence: DEFAULT_MI_FRAME,
})

function ProductionSiblingHarness({ onCinema2RuntimeReady }: { onCinema2RuntimeReady?: (runtime: Cinema2Runtime | null) => void } = {}) {
  const engineId = useReactStore(state => state.activeReactEngineId)
  return (
    <>
      <ReactEngineBrowser />
      {engineId === 'cinema' ? (
        <CinemaWorkspace surface="stage" frameBridge={productionFrameBridge} />
      ) : engineId === 'cinema2' ? (
        <Cinema2Stage onRuntimeReady={onCinema2RuntimeReady} />
      ) : (
        <div data-production-engine={engineId} />
      )}
    </>
  )
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  CinemaResizeObserverMock.reset()
  vi.stubGlobal('ResizeObserver', CinemaResizeObserverMock)
  resetReactLiveEngineOwnershipForTests()
  resetDrmvyzWebGLContextDiagnosticsForTests()
  AudioFeatureBus.reset()
  useReactStore.getState().resetReactView()
  useCinemaStore.getState().hydrateCinemaState(createCinemaFoundationPersistedState())
  expect(useCinemaStore.getState().setActiveCinemaComposition(CINEMA_FOUNDATION_COMPOSITION.id).ok).toBe(true)
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
  AudioFeatureBus.reset()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Cinema 2.0 production sibling path', () => {
  it('enters through the real engine selector and survives 24 Cinema 1 <-> Cinema 2.0 switches without resource growth', async () => {
    const initialDiagnostics = getCinema2RuntimeDiagnostics()
    const callbacks = new Map<number, FrameRequestCallback>()
    let nextRaf = 1
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      const id = nextRaf++
      callbacks.set(id, callback)
      return id
    }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => {
      callbacks.delete(id)
    }))
    const contexts = [] as ReturnType<typeof createCinemaMockWebGL>[]
    let activeCinema2Runtime: Cinema2Runtime | null = null
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

    await act(async () => root?.render(<ProductionSiblingHarness onCinema2RuntimeReady={runtime => { activeCinema2Runtime = runtime }} />))
    expect(useReactStore.getState().activeReactEngineId).toBe('cinema')
    expect(host?.querySelector('[data-cinema-output-canvas="true"]')).not.toBeNull()
    expect(callbacks.size).toBe(1)
    expect(getReactLiveEngineOwnershipDiagnosticsForTests()).toMatchObject({
      activeEngine: 'cinema',
      activeOwnerCount: 1,
      phase: 'stable',
    })

    const trigger = host?.querySelector<HTMLButtonElement>('.rv-engine-dropdown-trigger')
    await act(async () => trigger?.click())
    const cinema2Option = [...(host?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])]
      .find(option => option.textContent?.includes('Cinema 2.0'))
    expect(cinema2Option).toBeDefined()
    await act(async () => cinema2Option?.click())

    expect(useReactStore.getState().activeReactEngineId).toBe('cinema2')
    expect(host?.querySelector('[data-cinema2-stage="runtime"]')).not.toBeNull()
    expect(host?.querySelector('[data-cinema2-output-canvas="true"]')).not.toBeNull()
    expect(contexts[contexts.length - 1]?.clearColor).toHaveBeenCalledWith(0, 0, 0, 1)
    expect(callbacks.size).toBe(1)
    expect(getCinema2RuntimeDiagnostics()).toMatchObject({
      activeRuntimeCount: 1,
      activeTargetResolverCount: 1,
      activeAnimationFrameCount: 1,
      activeEventListenerCount: 2,
      activeWebGLContextCount: 1,
      nativePresetManifestValidationCount: initialDiagnostics.nativePresetManifestValidationCount + 1,
      nativePresetCompilationCount: initialDiagnostics.nativePresetCompilationCount + 1,
      targetResolverCreationCount: initialDiagnostics.targetResolverCreationCount + 1,
    })
    const productionScene = activeCinema2Runtime?.getSceneGraph()
    expect(productionScene?.rootNodeIds).toEqual(['foundation-root'])
    expect(productionScene?.traversalOrder).toEqual(['foundation-root', 'foundation-fullscreen-node'])
    expect(productionScene?.layerOrder).toEqual(['foundation-layer'])
    expect(productionScene?.nodes[0]).toMatchObject({
      coordinateSpace: 'normalized-screen',
      effectiveVisible: true,
      layerIds: ['foundation-layer'],
    })
    expect(productionScene?.layers[0]).toMatchObject({
      sourceNodeId: 'foundation-root',
      visible: true,
      opacity: 1,
      blendMode: 'normal',
      depthPolicy: 'disabled',
    })
    expect(productionScene?.nodes[1]).toMatchObject({
      id: 'foundation-fullscreen-node',
      kind: 'module',
      moduleId: 'foundation-fullscreen',
      layerIds: ['foundation-layer'],
    })
    expect(activeCinema2Runtime?.getModuleRuntimeSnapshot()).toMatchObject({
      activeModuleCount: 1,
      failedModuleCount: 0,
      activeResourceLeaseCount: 0,
      modules: [expect.objectContaining({
        moduleId: 'foundation-fullscreen',
        status: 'active',
        renderProviderCount: 1,
      })],
    })
    expect(activeCinema2Runtime?.getModuleRenderPassProviders()).toHaveLength(1)

    for (let pass = 0; pass < 12; pass += 1) {
      await act(async () => useReactStore.getState().selectReactEngine('cinema'))
      expect(host?.querySelector('[data-cinema-output-canvas="true"]')).not.toBeNull()
      expect(callbacks.size).toBe(1)
      expect(getCinema2RuntimeDiagnostics()).toMatchObject({
        activeRuntimeCount: 0,
        activeTargetResolverCount: 0,
        activeAnimationFrameCount: 0,
        activeEventListenerCount: 0,
        activeWebGLContextCount: 0,
      })
      expect(getDrmvyzWebGLContextDiagnosticsForTests()).toMatchObject({
        activeCount: 1,
        activeLiveByEngine: { cinema: 1 },
      })

      await act(async () => useReactStore.getState().selectReactEngine('cinema2'))
      expect(host?.querySelector('[data-cinema2-stage="runtime"]')).not.toBeNull()
      expect(callbacks.size).toBe(1)
      expect(getCinema2RuntimeDiagnostics()).toMatchObject({
        activeRuntimeCount: 1,
        activeTargetResolverCount: 1,
        activeAnimationFrameCount: 1,
        activeEventListenerCount: 2,
        activeWebGLContextCount: 1,
      })
      expect(getDrmvyzWebGLContextDiagnosticsForTests()).toMatchObject({
        activeCount: 1,
        activeLiveByEngine: { cinema2: 1 },
      })
      expect(getReactLiveEngineOwnershipDiagnosticsForTests()).toMatchObject({
        activeEngine: 'cinema2',
        activeOwnerCount: 1,
        phase: 'stable',
      })
    }

    await act(async () => useReactStore.getState().selectReactEngine('cinema'))
    expect(host?.querySelector('[data-cinema-output-canvas="true"]')).not.toBeNull()
    expect(callbacks.size).toBe(1)
    expect(getCinema2RuntimeDiagnostics()).toMatchObject({
      activeRuntimeCount: 0,
      activeTargetResolverCount: 0,
      activeAnimationFrameCount: 0,
      activeEventListenerCount: 0,
      activeWebGLContextCount: 0,
    })
    const retiredObservers = CinemaResizeObserverMock.instances.slice(0, -1)
    expect(retiredObservers.length).toBeGreaterThanOrEqual(24)
    expect(retiredObservers.every(observer => observer.disconnect.mock.calls.length === 1)).toBe(true)

    await act(async () => root?.unmount())
    root = null
    expect(CinemaResizeObserverMock.instances.every(observer => observer.disconnect.mock.calls.length === 1)).toBe(true)
    expect(callbacks.size).toBe(0)
    expect(getReactLiveEngineOwnershipDiagnosticsForTests()).toMatchObject({ activeOwnerCount: 0 })
    expect(getDrmvyzWebGLContextDiagnosticsForTests()).toMatchObject({ activeCount: 0 })
  }, 20_000)

  it('captures canonical Music Intelligence through the real Cinema 2.0 Stage runtime path', async () => {
    const audioDiagnosticsBefore = getCinema2AudioIntelligenceBridgeDiagnostics()
    const callbacks = new Map<number, FrameRequestCallback>()
    let nextRaf = 1
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      const id = nextRaf++
      callbacks.set(id, callback)
      return id
    }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => callbacks.delete(id)))
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
    AudioFeatureBus.setFrame({
      ...DEFAULT_MI_FRAME,
      frameId: 314,
      sourceId: 'production-audio-source',
      bands: { ...DEFAULT_MI_FRAME.bands, normalizedBass: 0 },
      capabilities: { ...DEFAULT_MI_FRAME.capabilities!, liveBands: true },
      confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 0.07 },
    }, 'production-audio-publisher')
    useReactStore.getState().selectReactEngine('cinema2')

    await act(async () => root?.render(<ProductionSiblingHarness />))
    expect(host?.querySelector('[data-cinema2-stage="runtime"]')).not.toBeNull()
    expect(callbacks.size).toBe(1)

    const scheduled = [...callbacks.entries()][0]
    expect(scheduled).toBeDefined()
    callbacks.delete(scheduled![0])
    await act(async () => scheduled![1](16.67))

    expect(getCinema2AudioIntelligenceBridgeDiagnostics()).toMatchObject({
      captureCount: audioDiagnosticsBefore.captureCount + 1,
      lastCapturedSourceFrameId: 314,
    })
    expect(callbacks.size).toBe(1)
  })

  it('shows a concise safe Stage status when WebGL2 initialization is unavailable', async () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
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
    useReactStore.getState().selectReactEngine('cinema2')

    await act(async () => root?.render(<ProductionSiblingHarness />))
    const stage = host?.querySelector('[data-cinema2-stage="runtime"]')
    expect(stage?.getAttribute('data-runtime-available')).toBe('false')
    expect(host?.textContent).toContain('Cinema 2.0 requires WebGL2')
    expect(getReactLiveEngineOwnershipDiagnosticsForTests()).toMatchObject({
      activeEngine: 'cinema2',
      activeOwnerCount: 1,
      phase: 'stable',
    })
    expect(getCinema2RuntimeDiagnostics()).toMatchObject({
      activeRuntimeCount: 0,
      activeAnimationFrameCount: 0,
      activeEventListenerCount: 0,
      activeWebGLContextCount: 0,
    })
  })
})
