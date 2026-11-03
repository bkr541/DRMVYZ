/** @vitest-environment jsdom */
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
import React, { act, createRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CanvasMutagenLayer } from './CanvasMutagenLayer'
import { MutagenRenderer, type MutagenFrame } from './MutagenRenderer'
import { DEFAULT_CANVAS_MUTAGEN_SETTINGS } from './MutagenSettings'
import type { CanvasMediaItem } from '../../ReactTypes'
import type { SharedPerformanceContext } from '../../../../../features/performanceCore'

let root: Root, host: HTMLDivElement
let callback: FrameRequestCallback | undefined
const renderer = { render: vi.fn((_frame: MutagenFrame) => true), resize: vi.fn(), dispose: vi.fn(), resetHistory: vi.fn() }
const copy = vi.fn()
const ready = vi.fn(), status = vi.fn()
const item: CanvasMediaItem = { id: 'logo', name: 'Logo', type: 'image', objectUrl: 'blob:logo', createdAt: '', mediaRevision: 1 }
const sourceRef = createRef<HTMLImageElement>()
const performanceContextRef = createRef<SharedPerformanceContext>()

function layer(active = true, activeItem = item) {
  return <CanvasMutagenLayer active={active} activeItem={activeItem} sourceRef={sourceRef} settings={DEFAULT_CANVAS_MUTAGEN_SETTINGS} fitMode="contain" sourceTransform={{ scale: 1, positionX: 0, positionY: 0, rotation: 0 }} performanceContextRef={performanceContextRef} trackIdentity={null} isPlaying={false} isPaused={false} onCanvasReady={ready} onStatusChange={status} />
}

beforeEach(() => {
  vi.clearAllMocks()
  callback = undefined
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  vi.spyOn(MutagenRenderer, 'create').mockReturnValue({ renderer: renderer as unknown as MutagenRenderer, error: null })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ clearRect: vi.fn(), drawImage: copy } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 640, height: 360 } as DOMRect)
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { callback = cb; return 7 })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
})
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks() })

describe('MUTAGEN GPU layer ownership', () => {
  it('removes context/visibility listeners, cancels RAF, and invalidates its published snapshot on departure', () => {
    const removeDocument = vi.spyOn(document, 'removeEventListener')
    act(() => root.render(layer()))
    const canvas = host.querySelector('canvas')!
    const removeCanvas = vi.spyOn(canvas, 'removeEventListener')
    act(() => callback?.(100))
    const snapshot = ready.mock.lastCall?.[0] as HTMLCanvasElement
    act(() => root.render(layer(false)))
    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(7)
    expect(renderer.dispose).toHaveBeenCalledTimes(1)
    expect(removeDocument.mock.calls.some(([type]) => type === 'visibilitychange')).toBe(true)
    expect(removeCanvas.mock.calls.map(([type]) => type)).toEqual(expect.arrayContaining(['webglcontextlost', 'webglcontextrestored']))
    expect(snapshot.width).toBe(0)
    expect(snapshot.height).toBe(0)
    expect(ready).toHaveBeenLastCalledWith(null)
  })
  it('is inert for every other preset', () => {
    act(() => root.render(layer(false)))
    expect(MutagenRenderer.create).not.toHaveBeenCalled()
    expect(host.querySelector('canvas')).toBeNull()
    expect(ready).not.toHaveBeenCalled()
  })

  it('publishes only a successfully copied current frame and cancels/releases on context loss', () => {
    act(() => root.render(layer()))
    expect(ready).toHaveBeenLastCalledWith(null)
    act(() => callback?.(100))
    expect(copy).toHaveBeenCalledWith(host.querySelector('canvas'), 0, 0)
    const snapshot = ready.mock.lastCall?.[0] as HTMLCanvasElement
    expect(snapshot).toBeInstanceOf(HTMLCanvasElement)
    expect(snapshot).not.toBe(host.querySelector('canvas'))
    act(() => host.querySelector('canvas')!.dispatchEvent(new Event('webglcontextlost', { cancelable: true })))
    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(7)
    expect(renderer.dispose).toHaveBeenCalledTimes(1)
    expect(ready).toHaveBeenLastCalledWith(null)
    expect(status.mock.lastCall?.[0]).toContain('Showing the original source')
    expect(host.querySelector('canvas')?.getAttribute('data-ready')).toBe('false')
  })

  it('releases old revision resources and hides the GPU canvas until a new frame is available', () => {
    act(() => root.render(layer()))
    act(() => callback?.(100))
    act(() => root.render(layer(true, { ...item, mediaRevision: 2 })))
    expect(renderer.dispose).toHaveBeenCalledTimes(1)
    expect(MutagenRenderer.create).toHaveBeenCalledTimes(2)
    expect(ready).toHaveBeenLastCalledWith(null)
    expect(host.querySelector('canvas')?.getAttribute('data-ready')).toBe('false')
    act(() => root.render(layer(false)))
    expect(renderer.dispose).toHaveBeenCalledTimes(2)
  })

  it('freezes both the rendered frame and the published snapshot while paused, then cold-resets on resume', () => {
    act(() => root.render(layer()))
    act(() => callback?.(100))
    expect(renderer.render).toHaveBeenCalledTimes(1)
    act(() => root.render(React.cloneElement(layer(), { isPaused: true })))
    act(() => callback?.(200))
    act(() => callback?.(300))
    expect(renderer.render).toHaveBeenCalledTimes(1)
    expect(copy).toHaveBeenCalledTimes(1)
    act(() => root.render(layer()))
    act(() => callback?.(400))
    expect(renderer.render).toHaveBeenCalledTimes(2)
    expect(renderer.render.mock.lastCall?.[0].performance?.reset).toBe(true)
  })

  it('retries one restored context per source and removes old listeners/resources', () => {
    act(() => root.render(layer()))
    act(() => callback?.(100))
    const canvas = host.querySelector('canvas')!
    act(() => canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })))
    act(() => canvas.dispatchEvent(new Event('webglcontextrestored')))
    expect(MutagenRenderer.create).toHaveBeenCalledTimes(2)
    act(() => callback?.(200))
    expect(host.querySelector('canvas')?.getAttribute('data-ready')).toBe('true')
    act(() => canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })))
    act(() => canvas.dispatchEvent(new Event('webglcontextrestored')))
    expect(MutagenRenderer.create).toHaveBeenCalledTimes(2)
    expect(ready).toHaveBeenLastCalledWith(null)
  })

  it('uses an explicit unchanged-video fallback without allocating GPU resources', () => {
    act(() => root.render(layer(true, { ...item, type: 'video' })))
    expect(MutagenRenderer.create).not.toHaveBeenCalled()
    expect(status.mock.lastCall?.[0]).toContain('Video plays unchanged')
    expect(ready).toHaveBeenLastCalledWith(null)
  })

  it('keeps original source fallback on init failure or failed snapshot handoff', () => {
    vi.mocked(MutagenRenderer.create).mockReturnValueOnce({ renderer: null, error: 'WebGL2 unavailable' })
    act(() => root.render(layer()))
    expect(status.mock.lastCall?.[0]).toContain('Showing the original source')
    act(() => root.render(layer(false)))
    act(() => root.render(layer()))
    copy.mockImplementationOnce(() => { throw new Error('Copy failed') })
    act(() => callback?.(100))
    expect(ready).toHaveBeenLastCalledWith(null)
    expect(renderer.dispose).toHaveBeenCalled()
  })
})
