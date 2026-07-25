// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReactStore } from '../../../../../stores/reactStore'
import { PixGridEditorOverlay, shouldShowPixGridEditorOverlay } from '../PixGridEditorOverlay'

const drawImage = vi.fn()

const context = {
  save: vi.fn(), restore: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(),
  rect: vi.fn(), clip: vi.fn(), drawImage, strokeRect: vi.fn(), moveTo: vi.fn(),
  lineTo: vi.fn(), stroke: vi.fn(), setTransform: vi.fn(), setLineDash: vi.fn(),
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([10, 20, 30, 255]) })),
  fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1,
} as unknown as CanvasRenderingContext2D

let root: Root
let host: HTMLDivElement
let nextRafId = 1
let rafCallbacks = new Map<number, FrameRequestCallback>()
let liveCanvas: HTMLCanvasElement

function runNextFrame(now = 16): void {
  const next = [...rafCallbacks][0]
  expect(next).toBeDefined()
  const [id, callback] = next
  rafCallbacks.delete(id)
  act(() => callback(now))
}

function dispatchPointer(
  target: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  options: { clientX: number; clientY: number; pointerId?: number },
): void {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: options.clientX,
    clientY: options.clientY,
    buttons: type === 'pointerup' ? 0 : 1,
  })
  Object.defineProperty(event, 'pointerId', { value: options.pointerId ?? 1 })
  act(() => target.dispatchEvent(event))
}

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  useReactStore.getState().resetReactView()
  useReactStore.getState().selectReactEngine('pixGrid')
  useReactStore.getState().setPixGridAuthoringOverlayVisible(true)
  nextRafId = 1
  rafCallbacks = new Map()
  vi.clearAllMocks()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 640, height: 360, top: 0, left: 0, right: 640, bottom: 360, x: 0, y: 0,
    toJSON: () => ({}),
  })
  Object.defineProperty(HTMLCanvasElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: vi.fn(),
  })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = nextRafId++
    rafCallbacks.set(id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    rafCallbacks.delete(id)
  })
  vi.stubGlobal('ResizeObserver', class {
    private readonly callback: ResizeObserverCallback
    constructor(callback: ResizeObserverCallback) { this.callback = callback }
    observe = vi.fn((target: Element) => {
      this.callback([{
        target,
        contentRect: { width: 640, height: 360, top: 0, left: 0, right: 640, bottom: 360, x: 0, y: 0, toJSON: () => ({}) },
      } as ResizeObserverEntry], this as unknown as ResizeObserver)
    })
    disconnect = vi.fn()
    unobserve = vi.fn()
  })
  liveCanvas = document.createElement('canvas')
  liveCanvas.width = 1280
  liveCanvas.height = 720
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
    act(() => root.render(<PixGridEditorOverlay liveCanvas={liveCanvas} />))
    expect(host.querySelectorAll('canvas')).toHaveLength(1)
    expect(host.querySelector('[data-interactive-cell-count="0"]')).not.toBeNull()
    expect(host.querySelectorAll('[data-pix-grid-cell]')).toHaveLength(0)
    expect(host.querySelector('[data-live-canvas="ready"]')).not.toBeNull()
  })

  it('draws the explicit live PixGrid canvas instead of searching the overlay DOM', () => {
    act(() => root.render(<PixGridEditorOverlay liveCanvas={liveCanvas} />))
    runNextFrame()
    expect(drawImage).toHaveBeenCalledWith(liveCanvas, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number))
  })

  it('switches preview ownership when the renderer replaces its live canvas', () => {
    const replacement = document.createElement('canvas')
    replacement.width = 960
    replacement.height = 540
    act(() => root.render(<PixGridEditorOverlay liveCanvas={liveCanvas} />))
    runNextFrame()
    drawImage.mockClear()

    act(() => root.render(<PixGridEditorOverlay liveCanvas={replacement} />))
    runNextFrame(32)

    expect(drawImage).toHaveBeenCalledWith(replacement, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number))
    expect(drawImage).not.toHaveBeenCalledWith(liveCanvas, expect.anything(), expect.anything(), expect.anything(), expect.anything())
  })

  it('disables the eyedropper with a clear state when live output is unavailable', () => {
    act(() => root.render(<PixGridEditorOverlay liveCanvas={null} />))
    const pick = [...host.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Pick')!
    expect(pick.disabled).toBe(true)
    expect(host.textContent).toContain('Live output unavailable')
    expect(host.querySelector('[data-live-canvas="unavailable"]')).not.toBeNull()
  })

  it('samples the intended live canvas through logical-cell coordinates', () => {
    useReactStore.getState().setPixGridState({ editorTool: 'eyedropper' })
    act(() => root.render(<PixGridEditorOverlay liveCanvas={liveCanvas} />))
    drawImage.mockClear()
    const editor = host.querySelector<HTMLCanvasElement>('.rv-pix-grid-editor-canvas')!

    dispatchPointer(editor, 'pointerdown', { clientX: 320, clientY: 180 })

    expect(drawImage).toHaveBeenCalledWith(
      liveCanvas,
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      0,
      0,
      1,
      1,
    )
    expect(useReactStore.getState().pixGridState.editor.paintColor).toBe('#0a141e')
  })

  it('commits pointer drawing to the active scene and preserves undo, redo, close, and reopen', () => {
    useReactStore.getState().setPixGridState({
      editorTool: 'pencil',
      editor: { ...useReactStore.getState().pixGridState.editor, paintColor: '#ff00aa' },
    })
    act(() => root.render(<PixGridEditorOverlay liveCanvas={liveCanvas} />))
    const editor = host.querySelector<HTMLCanvasElement>('.rv-pix-grid-editor-canvas')!

    dispatchPointer(editor, 'pointerdown', { clientX: 320, clientY: 180 })
    dispatchPointer(editor, 'pointerup', { clientX: 320, clientY: 180 })

    const edited = useReactStore.getState().pixGridState
    const editedScene = edited.scenes.find(scene => scene.id === edited.selectedSceneId)!
    expect(editedScene.pixelOverrides).toHaveLength(1)
    expect(edited.pixelOverrides).toEqual(editedScene.pixelOverrides)

    act(() => useReactStore.getState().undoPixGridEdit())
    expect(useReactStore.getState().pixGridState.pixelOverrides).toHaveLength(0)
    act(() => useReactStore.getState().redoPixGridEdit())
    expect(useReactStore.getState().pixGridState.pixelOverrides).toHaveLength(1)

    act(() => root.render(null))
    act(() => root.render(<PixGridEditorOverlay liveCanvas={liveCanvas} />))
    expect(useReactStore.getState().pixGridState.pixelOverrides).toHaveLength(1)
  })

  it('registers and removes its keyboard listener on unmount', () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    act(() => root.render(<PixGridEditorOverlay liveCanvas={liveCanvas} />))
    const keydown = add.mock.calls.find((call: Parameters<typeof window.addEventListener>) => call[0] === 'keydown')?.[1]
    expect(keydown).toBeTypeOf('function')
    act(() => root.unmount())
    expect(remove).toHaveBeenCalledWith('keydown', keydown)
  })
})
