// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act, createRef } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { InfoPopover } from './InfoPopover'

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null

function renderPopover(node: React.ReactNode) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root?.render(node))
}

function click(element: Element) {
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

afterEach(() => {
  if (root) act(() => root?.unmount())
  document.body.innerHTML = ''
  container = null
  root = null
  vi.clearAllMocks()
})

describe('InfoPopover', () => {
  it('portals structured contextual-help content without rendering a trigger', () => {
    const anchorRef = createRef<HTMLButtonElement>()
    renderPopover(
      <>
        <button ref={anchorRef} type="button">Parameter label</button>
        <InfoPopover
          open
          anchorRef={anchorRef}
          title="Complexity"
          description="Controls the intricacy and density of the visual."
          sections={[
            { label: 'Current value', content: '70%' },
            { label: 'Range', content: '0% to 100%' },
          ]}
        />
      </>,
    )

    const dialog = document.body.querySelector('[role="dialog"]')
    expect(dialog).not.toBeNull()
    expect(container?.contains(dialog)).toBe(false)
    expect(dialog?.textContent).toContain('Complexity')
    expect(dialog?.textContent).toContain('Current value')
    expect(dialog?.textContent).toContain('70%')
    expect(document.body.querySelector('[aria-label="More information"]')).toBeNull()
  })

  it('requests closure from the close button', () => {
    const anchorRef = createRef<HTMLButtonElement>()
    const onOpenChange = vi.fn()
    renderPopover(
      <>
        <button ref={anchorRef} type="button">Parameter label</button>
        <InfoPopover
          open
          anchorRef={anchorRef}
          title="Auto Performance"
          onOpenChange={onOpenChange}
        />
      </>,
    )

    click(document.body.querySelector('[aria-label="Close information"]') as Element)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('dismisses on Escape and restores focus to the anchor', () => {
    const anchorRef = createRef<HTMLButtonElement>()
    const onOpenChange = vi.fn()
    const originalRequestAnimationFrame = window.requestAnimationFrame
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      writable: true,
      value: (callback: FrameRequestCallback) => {
        callback(0)
        return 1
      },
    })

    renderPopover(
      <>
        <button ref={anchorRef} type="button">Parameter label</button>
        <InfoPopover
          open
          anchorRef={anchorRef}
          title="Performance Show"
          onOpenChange={onOpenChange}
        />
      </>,
    )

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(document.activeElement).toBe(anchorRef.current)
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      writable: true,
      value: originalRequestAnimationFrame,
    })
  })

  it('dismisses an outside pointer press while ignoring the anchor', () => {
    const anchorRef = createRef<HTMLButtonElement>()
    const onOpenChange = vi.fn()
    renderPopover(
      <>
        <button ref={anchorRef} type="button">Parameter label</button>
        <InfoPopover
          open
          anchorRef={anchorRef}
          title="Source Integration"
          onOpenChange={onOpenChange}
        />
      </>,
    )

    act(() => {
      anchorRef.current?.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
    expect(onOpenChange).not.toHaveBeenCalled()

    act(() => {
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
