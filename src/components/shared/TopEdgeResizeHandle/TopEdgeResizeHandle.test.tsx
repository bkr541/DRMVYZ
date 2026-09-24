/** @vitest-environment jsdom */
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TopEdgeResizeHandle } from './TopEdgeResizeHandle'

let host: HTMLDivElement
let root: Root
const onChange = vi.fn()

beforeEach(() => {
  onChange.mockClear()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => {
    root.render(
      <TopEdgeResizeHandle label="Resize test" value={200} min={100} max={400} keyboardStep={10} getStartValue={() => 200} onChange={onChange} />,
    )
  })
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

const handle = () => host.querySelector<HTMLElement>('[role="separator"]')!
const pointer = (type: string, clientY: number, target: EventTarget = window) =>
  act(() => { target.dispatchEvent(Object.assign(new MouseEvent(type, { bubbles: true, button: 0, clientY }), {})) })

describe('TopEdgeResizeHandle', () => {
  it('exposes separator semantics', () => {
    expect(handle().getAttribute('aria-orientation')).toBe('horizontal')
    expect(handle().getAttribute('aria-valuenow')).toBe('200')
    expect(handle().getAttribute('aria-valuemin')).toBe('100')
    expect(handle().getAttribute('aria-valuemax')).toBe('400')
  })

  it('grows when dragged up, shrinks when dragged down, and clamps to the bounds', () => {
    pointer('pointerdown', 500, handle())
    expect(handle().dataset.dragging).toBe('true')
    pointer('pointermove', 450)
    expect(onChange).toHaveBeenLastCalledWith(250)
    pointer('pointermove', 550)
    expect(onChange).toHaveBeenLastCalledWith(150)
    pointer('pointermove', 0)
    expect(onChange).toHaveBeenLastCalledWith(400)
    pointer('pointermove', 5000)
    expect(onChange).toHaveBeenLastCalledWith(100)
    pointer('pointerup', 0)
    expect(handle().dataset.dragging).toBeUndefined()
    onChange.mockClear()
    pointer('pointermove', 400)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('resizes with ArrowUp / ArrowDown', () => {
    act(() => { handle().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })) })
    expect(onChange).toHaveBeenLastCalledWith(210)
    act(() => { handle().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })) })
    expect(onChange).toHaveBeenLastCalledWith(190)
  })
})
