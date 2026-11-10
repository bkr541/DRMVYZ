// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CastPreviewWindow } from './CastPreviewWindow'

afterEach(() => vi.restoreAllMocks())

describe('floating cast preview', () => {
  it('matches the engine card dimensions, monitors the relay with contained scaling, and cleans up', async () => {
    const host = document.createElement('div')
    host.className = 'rv-shell'
    host.innerHTML = '<button class="rv-engine-dropdown-trigger"></button><button class="preview-anchor"></button><div class="mount"></div>'
    document.body.append(host)
    const anchor = host.querySelector<HTMLButtonElement>('.preview-anchor')!
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return { width: this.classList.contains('rv-engine-dropdown-trigger') ? 300 : 30, height: 88,
        top: 500, right: 900, bottom: 588, left: 600, x: 600, y: 500, toJSON: () => ({}) }
    })
    const callbacks = new Map<number, FrameRequestCallback>()
    let nextId = 0
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      callbacks.set(++nextId, callback)
      return nextId
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { callbacks.delete(id) })
    const drawImage = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage, fillRect: vi.fn() } as unknown as CanvasRenderingContext2D)
    const source = document.createElement('canvas')
    source.width = 1920; source.height = 1080
    const sourceRef = { current: source as HTMLCanvasElement | null }
    const close = vi.fn()
    const root = createRoot(host.querySelector('.mount')!)
    const tick = (now: number) => {
      const [id, callback] = [...callbacks.entries()][0]
      callbacks.delete(id)
      callback(now)
    }
    try {
      await act(async () => root.render(<CastPreviewWindow id="preview" anchor={anchor} sourceRef={sourceRef} onClose={close} />))
      const dialog = document.getElementById('preview')!
      expect(dialog.style.width).toBe('300px')
      expect(dialog.style.height).toBe('176px')
      expect(dialog.parentElement).toBe(document.body)
      tick(0)
      expect(drawImage).toHaveBeenCalledTimes(1)
      const [copied, x, y, width, height] = drawImage.mock.calls[0]
      expect(copied).toBe(source)
      expect(width / height).toBeCloseTo(16 / 9)
      expect(x).toBeGreaterThanOrEqual(0)
      expect(y).toBeGreaterThanOrEqual(0)
      tick(1000 / 120)
      expect(drawImage).toHaveBeenCalledTimes(1)
      const replacement = document.createElement('canvas')
      replacement.width = 720; replacement.height = 1280
      sourceRef.current = replacement
      tick(1000 / 30)
      expect(drawImage.mock.calls.at(-1)?.[0]).toBe(replacement)
      expect(drawImage.mock.calls.at(-1)![3] / drawImage.mock.calls.at(-1)![4]).toBeCloseTo(9 / 16)
      drawImage.mockImplementationOnce(() => { throw new DOMException('Relay retiring', 'InvalidStateError') })
      expect(() => tick(100)).not.toThrow()
      expect(callbacks.size).toBe(1)
      await act(async () => dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
      expect(close).toHaveBeenCalledTimes(1)
      await act(async () => root.unmount())
      expect(callbacks.size).toBe(0)
      expect(document.getElementById('preview')).toBeNull()
    } finally {
      host.remove()
    }
  })
})
