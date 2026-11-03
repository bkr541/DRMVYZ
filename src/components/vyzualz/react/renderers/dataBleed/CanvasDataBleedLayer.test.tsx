/** @vitest-environment jsdom */
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createSharedPerformanceFallbackContext } from '../../../../../features/performanceCore'
import { CanvasDataBleedLayer } from './CanvasDataBleedLayer'
import { DataBleedRenderer } from './DataBleedRenderer'
import { DEFAULT_CANVAS_DATA_BLEED_SETTINGS as defaults, clearDataBleedHistory } from './DataBleedSettings'
import type { CanvasMediaItem } from '../../ReactTypes'
const onReady = vi.fn(), status = vi.fn(), copy = vi.fn(), clear = vi.fn()
const renderer = { resize: vi.fn(), render: vi.fn(() => true), resetHistory: vi.fn(), dispose: vi.fn() }
const sourceRef = { current: document.createElement('img') }
const contextRef = { current: createSharedPerformanceFallbackContext(0) }
const asset = { id: 'source', objectUrl: 'signed://source?key=unchanged', type: 'image', mediaRevision: 1 } as CanvasMediaItem
let host: HTMLDivElement, root: Root, callback: FrameRequestCallback
const layer = (patch: Partial<React.ComponentProps<typeof CanvasDataBleedLayer>> = {}) => <CanvasDataBleedLayer active activeItem={asset} sourceRef={sourceRef} settings={defaults} fitMode="contain" sourceTransform={{ scale: 1, positionX: 0, positionY: 0, rotation: 0 }} outputAlpha={1} performanceContextRef={contextRef} trackIdentity="track" isPlaying={false} isPaused={false} audioActive={false} onCanvasReady={onReady} onStatusChange={status} {...patch} />
beforeEach(() => {
  vi.clearAllMocks(); renderer.render.mockReturnValue(true)
  vi.spyOn(DataBleedRenderer, 'create').mockReturnValue({ renderer: renderer as unknown as DataBleedRenderer, error: null })
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { callback = cb; return 7 })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 640, height: 360 } as DOMRect)
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ clearRect: clear, drawImage: copy } as unknown as CanvasRenderingContext2D)
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks() })
describe('Data Bleed layer lifecycle', () => {
  it('reconstructs a native source-video seek even when frozen and the audio transport has not moved', () => {
    const video = document.createElement('video'), remove = vi.spyOn(video, 'removeEventListener')
    const readyState = vi.spyOn(video, 'readyState', 'get').mockReturnValue(2)
    const props = { sourceRef: { current: video }, settings: { ...defaults, freezeHistory: true }, isPlaying: true, getAudioTime: () => 5 }
    act(() => root.render(layer(props))); act(() => callback(100)); act(() => callback(200))
    expect(renderer.render).toHaveBeenCalledTimes(1)
    readyState.mockReturnValue(1)
    video.dispatchEvent(new Event('seeking')); act(() => callback(300))
    expect(renderer.render).toHaveBeenCalledTimes(1)
    readyState.mockReturnValue(2)
    act(() => callback(400)); expect(renderer.render).toHaveBeenCalledTimes(2)
    act(() => callback(500)); expect(renderer.render).toHaveBeenCalledTimes(2)
    act(() => root.render(layer({ active: false })))
    expect(remove.mock.calls.some(([type]) => type === 'seeking')).toBe(true)
  })
  it('is inert when inactive and owns one current visible/capture canvas when active', () => {
    act(() => root.render(layer({ active: false }))); expect(DataBleedRenderer.create).not.toHaveBeenCalled()
    act(() => root.render(layer())); act(() => callback(100))
    expect(onReady.mock.lastCall?.[0]).toBe(host.querySelector('canvas'))
    expect(copy).toHaveBeenCalledWith(vi.mocked(DataBleedRenderer.create).mock.calls[0][0], 0, 0)
    expect(host.querySelector('canvas')?.getAttribute('data-ready')).toBe('true')
  })
  it('freezes processed output and refreshes a manual clear while remaining frozen', () => {
    act(() => root.render(layer())); act(() => callback(100))
    act(() => root.render(layer({ settings: { ...defaults, freezeHistory: true } }))); act(() => callback(200)); act(() => callback(300))
    expect(renderer.render).toHaveBeenCalledTimes(1)
    clearDataBleedHistory(); act(() => callback(400)); expect(renderer.render).toHaveBeenCalledTimes(2)
    act(() => callback(500)); expect(renderer.render).toHaveBeenCalledTimes(2)
    act(() => root.render(layer())); act(() => callback(600)); expect(renderer.render).toHaveBeenCalledTimes(3)
  })
  it('falls back on failure, retries restoration once, and releases listeners/RAF on departure', () => {
    const remove = vi.spyOn(document, 'removeEventListener')
    act(() => root.render(layer())); act(() => callback(100))
    const gpu = vi.mocked(DataBleedRenderer.create).mock.calls[0][0], removeGPU = vi.spyOn(gpu, 'removeEventListener')
    act(() => gpu.dispatchEvent(new Event('webglcontextlost', { cancelable: true })))
    expect(onReady).toHaveBeenLastCalledWith(null); expect(renderer.dispose).toHaveBeenCalledTimes(1)
    expect(status.mock.lastCall?.[0]).toContain('Showing the original source')
    act(() => gpu.dispatchEvent(new Event('webglcontextrestored')))
    expect(DataBleedRenderer.create).toHaveBeenCalledTimes(2)
    const next = vi.mocked(DataBleedRenderer.create).mock.calls[1][0]
    act(() => callback(200)); act(() => next.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))); act(() => next.dispatchEvent(new Event('webglcontextrestored')))
    expect(DataBleedRenderer.create).toHaveBeenCalledTimes(2)
    act(() => root.render(layer({ active: false })))
    expect(renderer.dispose).toHaveBeenCalledTimes(2)
    expect(remove.mock.calls.some(([type]) => type === 'visibilitychange')).toBe(true)
    expect(removeGPU.mock.calls.map(([type]) => type)).toEqual(expect.arrayContaining(['webglcontextlost', 'webglcontextrestored']))
    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(7)
  })
  it('recreates revision resources and never publishes a failed source copy', () => {
    act(() => root.render(layer())); act(() => callback(100))
    act(() => root.render(layer({ activeItem: { ...asset, mediaRevision: 2 } })))
    expect(renderer.dispose).toHaveBeenCalledTimes(1)
    copy.mockImplementationOnce(() => { throw new Error('capture failed') })
    act(() => callback(200)); expect(onReady).toHaveBeenLastCalledWith(null)
    expect(host.querySelector('canvas')?.getAttribute('data-ready')).toBe('false')
  })
})
