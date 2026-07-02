// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_REACT_PRESETS } from '../ReactTypes'

const thumbnailMocks = vi.hoisted(() => ({
  readCached: vi.fn(),
  render: vi.fn(),
}))

vi.mock('../renderers/ReactPresetThumbnailRenderer', () => ({
  readCachedReactPresetThumbnail: thumbnailMocks.readCached,
  renderReactPresetThumbnail: thumbnailMocks.render,
}))

import { ReactPresetThumbnail } from '../ReactPresetThumbnail'

interface ObserverRecord {
  callback: IntersectionObserverCallback
  observe: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
}

const observers: ObserverRecord[] = []
let container: HTMLDivElement
let root: Root
let mounted = false

function installIntersectionObserver(): void {
  class FakeIntersectionObserver {
    readonly root = null
    readonly rootMargin = '240px 0px'
    readonly thresholds = [0]
    readonly observe = vi.fn()
    readonly unobserve = vi.fn()
    readonly disconnect = vi.fn()
    readonly takeRecords = vi.fn(() => [])

    constructor(callback: IntersectionObserverCallback) {
      observers.push({ callback, observe: this.observe, disconnect: this.disconnect })
    }
  }
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
}

async function renderThumbnail(generationKey = 'cinematicPortal:current'): Promise<void> {
  await act(async () => {
    root.render(
      <ReactPresetThumbnail
        preset={DEFAULT_REACT_PRESETS.find(item => item.id === 'preset-cyan-reverie')!}
        generationKey={generationKey}
      />,
    )
    mounted = true
  })
}

function revealObserver(index = observers.length - 1): void {
  const observer = observers[index]
  const target = container.querySelector('.rv-preset-thumb')!
  observer.callback([
    {
      isIntersecting: true,
      intersectionRatio: 1,
      target,
      boundingClientRect: target.getBoundingClientRect(),
      intersectionRect: target.getBoundingClientRect(),
      rootBounds: null,
      time: 0,
    },
  ], {} as IntersectionObserver)
}

describe('ReactPresetThumbnail viewport lifecycle', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    observers.length = 0
    thumbnailMocks.readCached.mockReset().mockReturnValue(null)
    thumbnailMocks.render.mockReset().mockResolvedValue('data:image/png;base64,visible')
    installIntersectionObserver()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    mounted = false
  })

  afterEach(async () => {
    if (mounted) await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  it('keeps an offscreen placeholder without scheduling expensive rendering', async () => {
    await renderThumbnail()

    expect(observers).toHaveLength(1)
    expect(observers[0].observe).toHaveBeenCalledOnce()
    expect(thumbnailMocks.render).not.toHaveBeenCalled()
    expect(container.querySelector('.rv-preset-thumb')?.getAttribute('data-thumbnail-state')).toBe('idle')
    expect(container.querySelector('.rv-preset-thumb-fallback')).not.toBeNull()
  })

  it('schedules rendering when the card enters the preload viewport', async () => {
    await renderThumbnail()

    await act(async () => {
      revealObserver()
      await Promise.resolve()
    })

    expect(thumbnailMocks.render).toHaveBeenCalledOnce()
    expect(thumbnailMocks.render.mock.calls[0][1]).toMatchObject({ width: 112, height: 64 })
    expect(thumbnailMocks.render.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
    expect(container.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,visible')
    expect(container.querySelector('.rv-preset-thumb')?.getAttribute('data-thumbnail-state')).toBe('ready')
  })

  it('aborts an active request when the card unmounts', async () => {
    thumbnailMocks.render.mockImplementation(() => new Promise(() => {}))
    await renderThumbnail()
    await act(async () => revealObserver())
    const signal = thumbnailMocks.render.mock.calls[0][1].signal as AbortSignal

    expect(signal.aborted).toBe(false)
    await act(async () => root.unmount())
    mounted = false
    expect(signal.aborted).toBe(true)
  })

  it('invalidates the prior generation during rapid engine changes', async () => {
    thumbnailMocks.render.mockImplementation(() => new Promise(() => {}))
    await renderThumbnail('cinematicPortal:current')
    await act(async () => revealObserver())
    const firstSignal = thumbnailMocks.render.mock.calls[0][1].signal as AbortSignal

    await renderThumbnail('laserDmx:current')
    expect(firstSignal.aborted).toBe(true)
    expect(observers[observers.length - 1]?.observe).toHaveBeenCalledOnce()
    expect(thumbnailMocks.render).toHaveBeenCalledOnce()

    await act(async () => revealObserver())
    expect(thumbnailMocks.render).toHaveBeenCalledTimes(2)
    expect((thumbnailMocks.render.mock.calls[1][1].signal as AbortSignal).aborted).toBe(false)
  })


  it('falls back to viewport checks when IntersectionObserver is unavailable', async () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    rect.mockReturnValue({
      x: 0, y: 5000, width: 112, height: 64, top: 5000, right: 112,
      bottom: 5064, left: 0, toJSON: () => ({}),
    } as DOMRect)

    await renderThumbnail()
    expect(thumbnailMocks.render).not.toHaveBeenCalled()

    rect.mockReturnValue({
      x: 0, y: 20, width: 112, height: 64, top: 20, right: 112,
      bottom: 84, left: 0, toJSON: () => ({}),
    } as DOMRect)
    await act(async () => {
      window.dispatchEvent(new Event('scroll'))
      await Promise.resolve()
    })

    expect(thumbnailMocks.render).toHaveBeenCalledOnce()
    rect.mockRestore()
  })

  it('uses an existing cache entry without observing or rendering', async () => {
    thumbnailMocks.readCached.mockReturnValue('data:image/png;base64,cached')
    await renderThumbnail()

    expect(observers).toHaveLength(0)
    expect(thumbnailMocks.render).not.toHaveBeenCalled()
    expect(container.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,cached')
  })
})
