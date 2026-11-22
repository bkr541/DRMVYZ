// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LayoutLabModal } from './LayoutLabModal'

let root: ReturnType<typeof createRoot> | undefined
const screenMatrix = Object.getOwnPropertyDescriptor(SVGElement.prototype, 'getScreenCTM')

beforeEach(() => {
  Object.defineProperty(SVGElement.prototype, 'getScreenCTM', { configurable: true, value: () => null })
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
})

afterEach(async () => {
  await act(async () => root?.unmount())
  root = undefined
  document.body.replaceChildren()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  if (screenMatrix) Object.defineProperty(SVGElement.prototype, 'getScreenCTM', screenMatrix)
  else Reflect.deleteProperty(SVGElement.prototype, 'getScreenCTM')
})

describe('isolated Layout Lab', () => {
  it('opens isolated studies and keeps popup close controls', async () => {
    const popupDocument = document.implementation.createHTMLDocument()
    const events = new EventTarget()
    const close = vi.fn()
    const popup = { document: popupDocument, addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events), close }
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)
    const style = document.createElement('style')
    style.textContent = ':root { --font-ui: "Space Grotesk"; --font-mono: "Manrope"; } main { display: none; }'
    const fonts = document.createElement('link')
    fonts.rel = 'stylesheet'
    fonts.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk'
    document.head.append(style, fonts)
    const host = document.createElement('div')
    document.body.append(host)
    const onClose = vi.fn()
    root = createRoot(host)
    try {
      await act(async () => root!.render(<LayoutLabModal onClose={onClose} />))
      const canvas = popupDocument.querySelector('main[aria-label="Layout Lab canvas"]')!
      expect(canvas).not.toBeNull()
      expect(canvas.querySelectorAll('[role="tab"]')).toHaveLength(9)
      expect(canvas.querySelectorAll('[data-audio-dock-study]')).toHaveLength(5)
      expect(canvas.querySelectorAll('[data-pad-study]')).toHaveLength(2)
      expect(canvas.querySelectorAll('[data-engine-study]')).toHaveLength(9)
      expect(canvas.querySelectorAll('[data-nav-icon-study]')).toHaveLength(0)
      expect(canvas.querySelector('[data-left-nav-study], .az-sidebar')).toBeNull()
      expect(canvas.querySelectorAll('[data-auth-device] iframe')).toHaveLength(4)
      expect(canvas.querySelector('#layout-lab-tab-06-panel')?.childElementCount).toBe(0)
      expect(canvas.querySelector('#layout-lab-tab-07-panel [data-brand-kit]')).not.toBeNull()
      expect(canvas.querySelector('[data-layout-lab-tab-id="layout-lab-tab-02"]')).toBeNull()
      expect(popupDocument.head.querySelector('style')).toBeNull()
      expect(popupDocument.head.querySelector<HTMLLinkElement>('link[rel="stylesheet"]')?.href).toBe(fonts.href)
      expect(popupDocument.documentElement.style.getPropertyValue('--font-ui').trim()).toBe('"Space Grotesk"')
      expect(popupDocument.documentElement.style.getPropertyValue('--font-mono').trim()).toBe('"Manrope"')
      expect(popupDocument.querySelector('style')?.textContent).not.toContain('main { display: none; }')
      expect(popupDocument.querySelector('canvas, video, audio')).toBeNull()
      events.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      expect(close).toHaveBeenCalledOnce()
      events.dispatchEvent(new Event('beforeunload'))
      expect(onClose).toHaveBeenCalledOnce()
    } finally {
      style.remove()
      fonts.remove()
    }
  })

  it('returns control to the application if the popup is blocked', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    const host = document.createElement('div')
    document.body.append(host)
    const onClose = vi.fn()
    root = createRoot(host)
    await act(async () => root!.render(<LayoutLabModal onClose={onClose} />))
    expect(onClose).toHaveBeenCalledOnce()
    expect(host.childElementCount).toBe(0)
  })
})
