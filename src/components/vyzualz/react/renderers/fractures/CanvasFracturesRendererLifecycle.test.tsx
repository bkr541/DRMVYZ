/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CANVAS_PRESET_SETTINGS } from '../../ReactTypes'
import { CanvasFracturesRendererLayer } from '../CanvasFracturesRendererLayer'
import {
  CanvasFracturesRenderer,
  type CanvasFracturesRendererCreateOptions,
  type CanvasFracturesRendererHealth,
} from './CanvasFracturesRenderer'

function makeFakeRenderer(backend: 'webgl2' | 'canvas2d') {
  let health: CanvasFracturesRendererHealth = 'ready'
  const dispose = vi.fn()
  const renderer = {
    backend,
    get health() { return health },
    planIdentity: null,
    setPlan: vi.fn(),
    resize: vi.fn(),
    render: vi.fn(() => true),
    invalidateFeedback: vi.fn(),
    dispose,
  } as unknown as CanvasFracturesRenderer
  return { renderer, dispose, setHealth: (next: CanvasFracturesRendererHealth) => { health = next } }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Canvas Fractures renderer lifecycle', () => {
  it('retries an unusable WebGL canvas with a fresh Canvas2D surface', () => {
    const canvas2d = makeFakeRenderer('canvas2d')
    const create = vi.spyOn(CanvasFracturesRenderer, 'create')
      .mockImplementation((_canvas: HTMLCanvasElement, options: CanvasFracturesRendererCreateOptions = {}) => options.forceCanvas2D
        ? { renderer: canvas2d.renderer, error: null }
        : { renderer: null, error: 'WebGL2 initialized but renderer resources were unavailable' })

    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1)
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList)

    const image = document.createElement('img')
    Object.defineProperties(image, {
      complete: { value: true },
      naturalWidth: { value: 1280 },
      naturalHeight: { value: 720 },
    })
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)

    act(() => {
      root.render(
        <CanvasFracturesRendererLayer
          active
          sourceRef={{ current: image }}
          sourceIdentity="initial-fallback-image"
          mediaType="image"
          mediaRevision={1}
          isPlaying={false}
          isPaused
          fitMode="contain"
          sourceTransform={{ scale: 1, positionX: 0, positionY: 0, rotation: 0 }}
          settings={DEFAULT_CANVAS_PRESET_SETTINGS}
        />,
      )
    })

    expect(create).toHaveBeenCalledTimes(2)
    expect(create.mock.calls[0]?.[0]).not.toBe(create.mock.calls[1]?.[0])
    expect(create.mock.calls[1]?.[1]).toEqual({ forceCanvas2D: true })
    expect(host.querySelector('canvas')?.getAttribute('data-renderer-backend')).toBe('canvas2d')

    act(() => root.unmount())
    expect(canvas2d.dispose).toHaveBeenCalledTimes(1)
    host.remove()
  })

  it('recreates the canvas and falls back once when WebGL restoration fails', () => {
    const webgl = makeFakeRenderer('webgl2')
    const canvas2d = makeFakeRenderer('canvas2d')
    const create = vi.spyOn(CanvasFracturesRenderer, 'create')
      .mockImplementation((_canvas: HTMLCanvasElement, options: CanvasFracturesRendererCreateOptions = {}) => ({
        renderer: options.forceCanvas2D ? canvas2d.renderer : webgl.renderer,
        error: null,
      }))

    const callbacks = new Map<number, FrameRequestCallback>()
    let nextFrame = 1
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      const id = nextFrame++
      callbacks.set(id, callback)
      return id
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id: number) => {
      callbacks.delete(id)
    })
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList)

    const image = document.createElement('img')
    Object.defineProperties(image, {
      complete: { value: true },
      naturalWidth: { value: 1280 },
      naturalHeight: { value: 720 },
    })
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    const status = vi.fn()

    act(() => {
      root.render(
        <CanvasFracturesRendererLayer
          active
          sourceRef={{ current: image }}
          sourceIdentity="lifecycle-image"
          mediaType="image"
          mediaRevision={1}
          isPlaying={false}
          isPaused
          fitMode="contain"
          sourceTransform={{ scale: 1, positionX: 0, positionY: 0, rotation: 0 }}
          settings={DEFAULT_CANVAS_PRESET_SETTINGS}
          onStatusChange={status}
        />,
      )
    })

    expect(create).toHaveBeenCalledTimes(1)
    expect(host.querySelector('canvas')?.getAttribute('data-renderer-backend')).toBe('webgl2')
    const callback = [...callbacks.values()][0]
    expect(callback).toBeDefined()

    webgl.setHealth('failed')
    act(() => callback?.(100))

    expect(create).toHaveBeenCalledTimes(2)
    expect(create.mock.calls[1]?.[1]).toEqual({ forceCanvas2D: true })
    expect(webgl.dispose).toHaveBeenCalledTimes(1)
    expect(host.querySelector('canvas')?.getAttribute('data-renderer-backend')).toBe('canvas2d')
    expect(status.mock.calls.flat().some((value: unknown) => typeof value === 'string' && value.includes('Canvas2D'))).toBe(true)

    act(() => root.unmount())
    expect(canvas2d.dispose).toHaveBeenCalledTimes(1)
    host.remove()
  })
})
