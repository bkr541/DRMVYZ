/** @vitest-environment jsdom */

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_REACT_PRESETS, type ReactEngineId, type ReactPreset } from '../ReactTypes'
import { REACT_ENGINE_IDS } from '../reactEngineCatalog'
import {
  getReactLiveEngineOwnershipDiagnosticsForTests,
  resetReactLiveEngineOwnershipForTests,
} from '../renderers/ReactLiveEngineOwnership'

const mocks = vi.hoisted(() => ({
  renderReactEngine: vi.fn(),
  disposeReactEngineRenderer: vi.fn(),
  clearSoundDrawingRuntimeCaches: vi.fn(),
  setSoundDrawingClipsForFrame: vi.fn(),
  compositeBrandAsset: vi.fn(),
}))

vi.mock('../renderers/ReactEngineRenderer', () => ({
  DEFAULT_REACT_RENDER_PARAMS: {
    intensity: 1,
    motion: 1,
    glow: 0.5,
    bassReactivity: 0.7,
    trailDecay: 0.08,
    fogDensity: 0.5,
    particleDensity: 0.5,
    oscillator: {},
  },
  renderReactEngine: mocks.renderReactEngine,
  disposeReactEngineRenderer: mocks.disposeReactEngineRenderer,
}))
vi.mock('../renderers/CinematicPortalRenderer', () => ({
  resolveCinematicPortalBackend: vi.fn(() => 'webgl2'),
}))
vi.mock('../renderers/SoundDrawingRenderer', () => ({
  clearSoundDrawingRuntimeCaches: mocks.clearSoundDrawingRuntimeCaches,
  setSoundDrawingClipsForFrame: mocks.setSoundDrawingClipsForFrame,
}))
vi.mock('../../../../features/personalization/brandAssetCompositor', () => ({
  compositeBrandAsset: mocks.compositeBrandAsset,
}))

import { ReactPlaceholderCanvas } from '../ReactPlaceholderCanvas'

interface FakeResizeObserver {
  observe: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
}

const resizeObservers: FakeResizeObserver[] = []
let root: Root | null = null
let host: HTMLDivElement | null = null
let nextRafId = 1
let rafCallbacks = new Map<number, FrameRequestCallback>()

type LiveCanvasEngineId = Exclude<ReactEngineId, 'shaderPads' | 'canvas'>

const LIVE_CANVAS_ENGINE_IDS = REACT_ENGINE_IDS.filter((engine): engine is LiveCanvasEngineId => (
  engine !== 'shaderPads' && engine !== 'canvas'
))

function findPreset(engine: LiveCanvasEngineId): ReactPreset {
  const found = DEFAULT_REACT_PRESETS.find(preset => preset.engine === engine)
  if (!found) throw new Error(`Missing test preset for ${engine}`)
  return found
}

function renderCanvas(
  engine: LiveCanvasEngineId,
  onCanvasReady = vi.fn(),
): React.ReactElement {
  return (
    <ReactPlaceholderCanvas
      key={`test-${engine}`}
      analyser={null}
      engine={engine}
      activePreset={findPreset(engine)}
      intensity={1}
      motion={1}
      glow={0.5}
      bassReactivity={0.7}
      isPlaying={false}
      onCanvasReady={onCanvasReady}
    />
  )
}

beforeEach(() => {
  resetReactLiveEngineOwnershipForTests()
  resizeObservers.length = 0
  rafCallbacks = new Map()
  nextRafId = 1
  mocks.renderReactEngine.mockClear()
  mocks.disposeReactEngineRenderer.mockClear()
  mocks.clearSoundDrawingRuntimeCaches.mockClear()
  mocks.setSoundDrawingClipsForFrame.mockClear()
  mocks.compositeBrandAsset.mockClear()

  class ResizeObserverMock {
    observe = vi.fn()
    disconnect = vi.fn()
    constructor(_callback: ResizeObserverCallback) {
      resizeObservers.push(this)
    }
  }
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    const id = nextRafId++
    rafCallbacks.set(id, callback)
    return id
  }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => {
    rafCallbacks.delete(id)
  }))

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function getContext(this: HTMLCanvasElement) {
    return {
      canvas: this,
      fillStyle: '',
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 640,
    bottom: 360,
    width: 640,
    height: 360,
    toJSON: () => ({}),
  })

  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(async () => {
  if (root) await act(async () => root?.unmount())
  root = null
  host?.remove()
  host = null
  resetReactLiveEngineOwnershipForTests()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('ReactPlaceholderCanvas live ownership boundary', () => {
  it('stops the old loop, disconnects its observer, and disposes its family before switching', async () => {
    const onCanvasReady = vi.fn()
    await act(async () => root?.render(renderCanvas('cinematicPortal', onCanvasReady)))

    expect(mocks.renderReactEngine).toHaveBeenCalledTimes(1)
    expect(resizeObservers).toHaveLength(1)
    const oldRaf = [...rafCallbacks.values()][0]
    expect(oldRaf).toBeTypeOf('function')

    await act(async () => root?.render(renderCanvas('laserDmx', onCanvasReady)))

    expect(mocks.disposeReactEngineRenderer).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      'cinematicPortal',
      expect.objectContaining({ affectProductionOutput: true }),
    )
    expect(resizeObservers[0].disconnect).toHaveBeenCalledTimes(1)
    expect(mocks.renderReactEngine).toHaveBeenCalledTimes(2)

    oldRaf?.(performance.now())
    expect(mocks.renderReactEngine).toHaveBeenCalledTimes(2)

    await act(async () => root?.unmount())
    root = null
    expect(mocks.disposeReactEngineRenderer).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      'laserDmx',
      expect.objectContaining({ affectProductionOutput: true }),
    )
    expect(resizeObservers[1].disconnect).toHaveBeenCalledTimes(1)
    expect(onCanvasReady).toHaveBeenCalledWith(null)
  })



  it('retires ownership and observers when the first engine frame throws', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.renderReactEngine.mockImplementationOnce(() => { throw new Error('render failed') })

    await act(async () => root?.render(renderCanvas('cinematicPortal')))

    expect(getReactLiveEngineOwnershipDiagnosticsForTests()).toMatchObject({
      activeOwnerCount: 0,
      activeEngine: null,
    })
    expect(mocks.disposeReactEngineRenderer).toHaveBeenCalledTimes(1)
    expect(resizeObservers[0].disconnect).toHaveBeenCalledTimes(1)
    expect(rafCallbacks.size).toBe(0)
    error.mockRestore()
  })

  it('returns ownership and scheduled frames to baseline across repeated mount cycles', async () => {
    for (let index = 0; index < 6; index += 1) {
      await act(async () => root?.render(renderCanvas('oscilloscope')))
      expect(getReactLiveEngineOwnershipDiagnosticsForTests()).toMatchObject({
        activeOwnerCount: 1,
        activeEngine: 'oscilloscope',
      })

      await act(async () => root?.render(null))
      expect(getReactLiveEngineOwnershipDiagnosticsForTests()).toMatchObject({
        activeOwnerCount: 0,
        activeEngine: null,
      })
      expect(rafCallbacks.size).toBe(0)
    }

    expect(mocks.disposeReactEngineRenderer).toHaveBeenCalledTimes(6)
    expect(resizeObservers.every(observer => observer.disconnect.mock.calls.length === 1)).toBe(true)
  })

  it('cycles all non-shader engine families without overlapping loops or ownership', async () => {
    const onCanvasReady = vi.fn()

    for (let pass = 0; pass < 2; pass += 1) {
      for (const engineId of LIVE_CANVAS_ENGINE_IDS) {
        await act(async () => root?.render(renderCanvas(engineId, onCanvasReady)))
        expect(getReactLiveEngineOwnershipDiagnosticsForTests()).toMatchObject({
          activeOwnerCount: 1,
          activeEngine: engineId,
        })
        expect(rafCallbacks.size).toBe(1)
      }
    }

    await act(async () => root?.unmount())
    root = null

    expect(getReactLiveEngineOwnershipDiagnosticsForTests()).toMatchObject({
      activeOwnerCount: 0,
      activeEngine: null,
    })
    expect(rafCallbacks.size).toBe(0)
    expect(mocks.disposeReactEngineRenderer).toHaveBeenCalledTimes(LIVE_CANVAS_ENGINE_IDS.length * 2)
    expect(new Set(mocks.disposeReactEngineRenderer.mock.calls.map(call => call[1])))
      .toEqual(new Set(LIVE_CANVAS_ENGINE_IDS))
    expect(resizeObservers.every(observer => observer.disconnect.mock.calls.length === 1)).toBe(true)
  })

  it('does not rebuild ownership for preset-only updates within one engine family', async () => {
    const first = findPreset('cinematicPortal')
    const second = DEFAULT_REACT_PRESETS.find(
      preset => preset.engine === 'cinematicPortal' && preset.id !== first.id,
    ) ?? { ...first, id: `${first.id}-alternate` }

    const common = {
      analyser: null,
      engine: 'cinematicPortal' as const,
      intensity: 1,
      motion: 1,
      glow: 0.5,
      bassReactivity: 0.7,
      isPlaying: false,
    }

    await act(async () => root?.render(
      <ReactPlaceholderCanvas key="cinematic" {...common} activePreset={first} />,
    ))
    await act(async () => root?.render(
      <ReactPlaceholderCanvas key="cinematic" {...common} activePreset={second} />,
    ))

    expect(resizeObservers).toHaveLength(1)
    expect(mocks.disposeReactEngineRenderer).not.toHaveBeenCalled()
  })
})
