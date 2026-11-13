// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LayoutLabModal } from './LayoutLabModal'

let root: ReturnType<typeof createRoot> | undefined

afterEach(async () => {
  await act(async () => root?.unmount())
  root = undefined
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('isolated Layout Lab', () => {
  it('opens an empty canvas without production styles and keeps popup close controls', async () => {
    const popupDocument = document.implementation.createHTMLDocument()
    const events = new EventTarget()
    const close = vi.fn()
    const popup = { document: popupDocument, addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events), close }
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)
    const style = document.createElement('style')
    style.textContent = 'main { display: none; }'
    document.head.append(style)
    const host = document.createElement('div')
    document.body.append(host)
    const onClose = vi.fn()
    root = createRoot(host)
    try {
      await act(async () => root!.render(<LayoutLabModal onClose={onClose} />))
      const canvas = popupDocument.querySelector('main[aria-label="Layout Lab canvas"]')!
      expect(canvas).not.toBeNull()
      expect(canvas.childElementCount).toBe(0)
      expect(canvas.textContent).toBe('')
      expect(popupDocument.querySelector('style, link[rel="stylesheet"], button, input, canvas, video, audio')).toBeNull()
      events.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      expect(close).toHaveBeenCalledOnce()
      events.dispatchEvent(new Event('beforeunload'))
      expect(onClose).toHaveBeenCalledOnce()
    } finally {
      style.remove()
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
