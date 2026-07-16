// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReactStore } from '../../../../../stores/reactStore'
import { PixGridEditorOverlay, shouldShowPixGridEditorOverlay } from '../PixGridEditorOverlay'

const context = {
  save: vi.fn(), restore: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(),
  rect: vi.fn(), clip: vi.fn(), drawImage: vi.fn(), strokeRect: vi.fn(), moveTo: vi.fn(),
  lineTo: vi.fn(), stroke: vi.fn(), setTransform: vi.fn(), setLineDash: vi.fn(),
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([10, 20, 30, 255]) })),
  fillStyle: '', strokeStyle: '', lineWidth: 1,
} as unknown as CanvasRenderingContext2D

let root: Root
let host: HTMLDivElement
let rafId = 0

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  useReactStore.getState().resetReactView()
  useReactStore.getState().selectReactEngine('pixGrid')
  useReactStore.getState().setPixGridAuthoringOverlayVisible(true)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 640, height: 360, top: 0, left: 0, right: 640, bottom: 360, x: 0, y: 0,
    toJSON: () => ({}),
  })
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => ++rafId))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  vi.stubGlobal('ResizeObserver', class {
    observe = vi.fn()
    disconnect = vi.fn()
  })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  try { act(() => root.unmount()) } catch { /* already unmounted */ }
  host.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
})

describe('PixGrid editor overlay shell', () => {
  it('only qualifies for display while PixGrid Edit mode is active', () => {
    expect(shouldShowPixGridEditorOverlay('pixGrid', true)).toBe(true)
    expect(shouldShowPixGridEditorOverlay('pixGrid', false)).toBe(false)
    expect(shouldShowPixGridEditorOverlay('canvas', true)).toBe(false)
  })

  it('uses one canvas and never creates an interactive DOM node per logical cell', () => {
    act(() => root.render(<PixGridEditorOverlay />))
    expect(host.querySelectorAll('canvas')).toHaveLength(1)
    expect(host.querySelector('[data-interactive-cell-count="0"]')).not.toBeNull()
    expect(host.querySelectorAll('[data-pix-grid-cell]')).toHaveLength(0)
  })

  it('registers and removes its keyboard listener on unmount', () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    act(() => root.render(<PixGridEditorOverlay />))
    const keydown = add.mock.calls.find((call: Parameters<typeof window.addEventListener>) => call[0] === 'keydown')?.[1]
    expect(keydown).toBeTypeOf('function')
    act(() => root.unmount())
    expect(remove).toHaveBeenCalledWith('keydown', keydown)
  })
})
