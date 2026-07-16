// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_REACT_PRESETS } from '../../ReactTypes'
import { resetReactLiveEngineOwnershipForTests } from '../../renderers/ReactLiveEngineOwnership'
import { createDefaultPixGridState } from '../PixGridDefaults'
import { PixGridSurface } from '../PixGridSurface'

const context = {
  save: vi.fn(), restore: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(),
  rect: vi.fn(), roundRect: vi.fn(), fill: vi.fn(), strokeRect: vi.fn(),
  fillStyle: '', strokeStyle: '', shadowColor: '', shadowBlur: 0, lineWidth: 1,
  globalAlpha: 1, globalCompositeOperation: 'source-over', imageSmoothingEnabled: true,
} as unknown as CanvasRenderingContext2D

let root: Root
let host: HTMLDivElement
let nextRafId = 1
let rafCallbacks = new Map<number, FrameRequestCallback>()
const cancelledFrames: number[] = []
const disconnectedObservers: ReturnType<typeof vi.fn>[] = []

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  resetReactLiveEngineOwnershipForTests()
  nextRafId = 1
  rafCallbacks = new Map()
  cancelledFrames.length = 0
  disconnectedObservers.length = 0
  vi.clearAllMocks()

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 640, height: 360, top: 0, left: 0, right: 640, bottom: 360, x: 0, y: 0,
    toJSON: () => ({}),
  })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = nextRafId++
    rafCallbacks.set(id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    cancelledFrames.push(id)
    rafCallbacks.delete(id)
  })
  vi.stubGlobal('ResizeObserver', class {
    disconnect = vi.fn()
    observe = vi.fn()
    constructor() { disconnectedObservers.push(this.disconnect) }
  })

  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  try { act(() => root.unmount()) } catch { /* Test may already have unmounted explicitly. */ }
  host.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  resetReactLiveEngineOwnershipForTests()
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
})

function renderSurface(isPlaying: boolean, isPaused = false, onCanvasReady = vi.fn(), onLiveFps = vi.fn()) {
  const preset = DEFAULT_REACT_PRESETS.find(candidate => candidate.id === 'pix-grid-bass-beacon')!
  act(() => root.render(
    <PixGridSurface
      analyser={null}
      activePreset={preset}
      pixGridState={createDefaultPixGridState()}
      intensity={1}
      motion={0.7}
      glow={0.5}
      bassReactivity={0.9}
      isPlaying={isPlaying}
      isPaused={isPaused}
      getAudioTime={() => 0}
      onCanvasReady={onCanvasReady}
      onLiveFps={onLiveFps}
    />,
  ))
  return { onCanvasReady, onLiveFps }
}

describe('PixGridSurface lifecycle', () => {
  it('uses one canvas and never creates a DOM element per logical cell', () => {
    renderSurface(false)
    expect(host.querySelectorAll('canvas')).toHaveLength(1)
    expect(host.querySelectorAll('[data-pix-grid-cell]')).toHaveLength(0)
    expect(host.querySelector('[data-pix-grid-matrix="160x90"]')).not.toBeNull()
  })

  it('renders one stopped frame, then leaves no continuing animation work', () => {
    renderSurface(false)
    expect(rafCallbacks.size).toBe(1)
    const [[id, callback]] = [...rafCallbacks]
    rafCallbacks.delete(id)
    act(() => callback(16))
    expect(context.fillRect).toHaveBeenCalled()
    expect(rafCallbacks.size).toBe(0)
  })

  it('holds the completed frame while paused', () => {
    renderSurface(true, true)
    const [[id, callback]] = [...rafCallbacks]
    rafCallbacks.delete(id)
    act(() => callback(16))
    expect(context.clearRect).not.toHaveBeenCalled()
    expect(rafCallbacks.size).toBe(0)
  })

  it('cancels animation, disconnects observers, unregisters output, and clears FPS on unmount', () => {
    const onCanvasReady = vi.fn()
    const onLiveFps = vi.fn()
    renderSurface(true, false, onCanvasReady, onLiveFps)
    const [[id, callback]] = [...rafCallbacks]
    rafCallbacks.delete(id)
    act(() => callback(16))
    expect(rafCallbacks.size).toBe(1)

    act(() => root.unmount())
    expect(cancelledFrames.length).toBeGreaterThan(0)
    expect(disconnectedObservers.every(disconnect => disconnect.mock.calls.length === 1)).toBe(true)
    expect(onCanvasReady).toHaveBeenLastCalledWith(null)
    expect(onLiveFps).toHaveBeenLastCalledWith(0)
  })
})
