/** @vitest-environment jsdom */

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  acquireReactLiveEngineOwnership,
  resetReactLiveEngineOwnershipForTests,
} from '../renderers/ReactLiveEngineOwnership'

interface RuntimeCallbacks {
  onContextLost?: () => void
  onContextRestored?: () => void
}

interface FakeRendererInstance {
  resize: ReturnType<typeof vi.fn>
  render: ReturnType<typeof vi.fn>
  dispose: ReturnType<typeof vi.fn>
  disposeAfterContextLoss: ReturnType<typeof vi.fn>
  effectivePixelRatio: number
}

const mocks = vi.hoisted(() => ({
  runtimeCallbacks: [] as RuntimeCallbacks[],
  runtimeCreate: vi.fn(),
  rendererInstances: [] as FakeRendererInstance[],
  compositeBrandAsset: vi.fn(),
}))

vi.mock('../shaders/runtime/ShaderWebGLRuntime', () => ({
  ShaderWebGLRuntime: {
    create: mocks.runtimeCreate,
  },
}))
vi.mock('../shaders/ShaderEngineRenderer', () => ({
  ShaderEngineRenderer: class {
    resize = vi.fn()
    render = vi.fn()
    dispose = vi.fn()
    disposeAfterContextLoss = vi.fn()
    effectivePixelRatio = 1

    constructor(_runtime: unknown) {
      mocks.rendererInstances.push(this as FakeRendererInstance)
    }
  },
}))
vi.mock('../../../../features/personalization/brandAssetCompositor', () => ({
  compositeBrandAsset: mocks.compositeBrandAsset,
}))

import { ReactShaderCanvas } from '../ReactShaderCanvas'

interface FakeResizeObserver {
  observe: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
}

let root: Root | null = null
let host: HTMLDivElement | null = null
let resizeObservers: FakeResizeObserver[] = []
let rafCallbacks = new Map<number, FrameRequestCallback>()
let nextRafId = 1

beforeEach(() => {
  resetReactLiveEngineOwnershipForTests()
  mocks.runtimeCallbacks.length = 0
  mocks.rendererInstances.length = 0
  mocks.compositeBrandAsset.mockClear()
  resizeObservers = []
  rafCallbacks = new Map()
  nextRafId = 1

  mocks.runtimeCreate.mockReset().mockImplementation((_canvas: HTMLCanvasElement, options: RuntimeCallbacks) => {
    mocks.runtimeCallbacks.push(options)
    return {
      runtime: {
        gl: {},
        contextLost: false,
        dims: { W: 640, H: 360, pixelRatio: 1, aspect: 16 / 9 },
      },
      error: null,
    }
  })

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

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function getContext(this: HTMLCanvasElement, kind: string) {
    if (kind !== '2d') return null
    return {
      canvas: this,
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
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

describe('ReactShaderCanvas context-loss lifecycle', () => {
  it('stops immediately, rebuilds once for the active generation, and ignores stale restoration', async () => {
    await act(async () => root?.render(
      <ReactShaderCanvas analyser={null} isPlaying={false} />,
    ))

    expect(mocks.runtimeCreate).toHaveBeenCalledTimes(1)
    expect(mocks.rendererInstances).toHaveLength(1)
    expect(mocks.rendererInstances[0].render).toHaveBeenCalledTimes(1)
    expect(resizeObservers).toHaveLength(1)

    const firstRuntime = mocks.runtimeCallbacks[0]
    await act(async () => firstRuntime.onContextLost?.())
    expect(rafCallbacks.size).toBe(0)

    await act(async () => firstRuntime.onContextRestored?.())
    expect(mocks.rendererInstances[0].disposeAfterContextLoss).toHaveBeenCalledTimes(1)
    expect(mocks.runtimeCreate).toHaveBeenCalledTimes(2)
    expect(mocks.rendererInstances).toHaveLength(2)
    expect(mocks.rendererInstances[1].resize).toHaveBeenCalledWith(640, 360, expect.any(Number))

    await act(async () => firstRuntime.onContextRestored?.())
    expect(mocks.runtimeCreate).toHaveBeenCalledTimes(2)

    const secondRuntime = mocks.runtimeCallbacks[1]
    let replacement: ReturnType<typeof acquireReactLiveEngineOwnership>
    await act(async () => {
      secondRuntime.onContextLost?.()
      replacement = acquireReactLiveEngineOwnership('cinematicPortal', vi.fn())
      secondRuntime.onContextRestored?.()
    })

    expect(mocks.runtimeCreate).toHaveBeenCalledTimes(2)
    expect(mocks.rendererInstances[1].dispose).toHaveBeenCalledTimes(1)
    expect(resizeObservers[0].disconnect).toHaveBeenCalledTimes(1)
    await act(async () => replacement.retire('unmount'))
  })


  it('does not retry a failed restore more than once for the same loss event', async () => {
    await act(async () => root?.render(
      <ReactShaderCanvas analyser={null} isPlaying={false} />,
    ))

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const firstRuntime = mocks.runtimeCallbacks[0]
    mocks.runtimeCreate.mockImplementationOnce(() => ({
      runtime: null,
      error: 'restore unavailable',
    }))

    await act(async () => firstRuntime.onContextLost?.())
    await act(async () => firstRuntime.onContextRestored?.())
    await act(async () => firstRuntime.onContextRestored?.())

    expect(mocks.runtimeCreate).toHaveBeenCalledTimes(2)
    expect(mocks.rendererInstances).toHaveLength(1)
    expect(mocks.rendererInstances[0].disposeAfterContextLoss).toHaveBeenCalledTimes(1)
    expect(rafCallbacks.size).toBe(0)
    warn.mockRestore()
  })

  it('balances visibility listeners and observer cleanup on ordinary unmount', async () => {
    const add = vi.spyOn(document, 'addEventListener')
    const remove = vi.spyOn(document, 'removeEventListener')

    await act(async () => root?.render(
      <ReactShaderCanvas analyser={null} isPlaying={false} />,
    ))
    await act(async () => root?.unmount())
    root = null

    expect(add).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
    expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
    expect(resizeObservers[0].disconnect).toHaveBeenCalledTimes(1)
    expect(mocks.rendererInstances[0].dispose).toHaveBeenCalledTimes(1)
  })
})
