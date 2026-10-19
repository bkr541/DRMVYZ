/** @vitest-environment jsdom */
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CanvasMediaItem } from '../../ReactTypes'

const rendererMocks = vi.hoisted(() => ({
  resize: vi.fn(), setSource: vi.fn(), render: vi.fn(), dispose: vi.fn(),
}))
vi.mock('./ShiftgridRenderer', () => ({
  createShiftgridRenderer: () => ({ backend: 'canvas2d', ...rendererMocks }),
}))

import { CanvasShiftgridLayer } from './CanvasShiftgridLayer'
import { DEFAULT_CANVAS_SHIFTGRID_SETTINGS } from './ShiftgridSettings'

class ReadyImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  naturalWidth = 640
  naturalHeight = 360
  crossOrigin = ''
  decoding = ''
  set src(value: string) { if (value) queueMicrotask(() => this.onload?.()) }
}

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
  vi.stubGlobal('Image', ReadyImage)
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 17))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  Object.values(rendererMocks).forEach(mock => mock.mockClear())
})

afterEach(() => {
  act(() => root.unmount()); host.remove(); vi.unstubAllGlobals()
})

describe('CanvasShiftgridLayer P1 lifecycle', () => {
  it('shows an explicit single-image prompt without substitute artwork', () => {
    act(() => root.render(<CanvasShiftgridLayer settings={DEFAULT_CANVAS_SHIFTGRID_SETTINGS} activeMediaId={null} activePool={null} mediaItems={[]} />))
    expect(host.textContent).toContain('Select an image or SVG')
    expect(host.querySelector('[data-renderer-kind="shiftgrid"]')).not.toBeNull()
  })

  it('loads the original source, publishes one canvas, and cleans renderer resources on unmount', async () => {
    const mediaItems: CanvasMediaItem[] = [{ id: 'source-a', name: 'Source A', type: 'image', objectUrl: 'blob:source-a.png', mimeType: 'image/png', createdAt: new Date(0).toISOString() }]
    const onCanvasReady = vi.fn()
    await act(async () => {
      root.render(<CanvasShiftgridLayer settings={DEFAULT_CANVAS_SHIFTGRID_SETTINGS} activeMediaId="source-a" activePool={null} mediaItems={mediaItems} onCanvasReady={onCanvasReady} />)
      await Promise.resolve(); await Promise.resolve()
    })
    expect(host.querySelectorAll('canvas')).toHaveLength(1)
    expect(rendererMocks.setSource).toHaveBeenCalledTimes(1)
    expect(onCanvasReady).toHaveBeenCalledWith(host.querySelector('canvas'))
    act(() => root.unmount())
    expect(rendererMocks.dispose).toHaveBeenCalledTimes(1)
    expect(cancelAnimationFrame).toHaveBeenCalledWith(17)
    root = createRoot(host)
  })
})
