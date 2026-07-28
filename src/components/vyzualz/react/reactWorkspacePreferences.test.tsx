// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useReactWorkspacePreferences } from './reactWorkspacePreferences'

function Harness() {
  const preferences = useReactWorkspacePreferences()
  return (
    <div
      data-left={String(preferences.leftCollapsed)}
      data-right={String(preferences.rightCollapsed)}
      data-lower={String(preferences.lowerWorkspaceCollapsed)}
      data-surface={preferences.lowerSurface}
      data-tab={preferences.leftTab}
    >
      <button onClick={() => preferences.setLeftCollapsed(value => !value)}>left</button>
      <button onClick={() => preferences.setRightCollapsed(value => !value)}>right</button>
      <button onClick={() => preferences.setLowerWorkspaceCollapsed(value => !value)}>lower</button>
      <button onClick={() => preferences.setLowerSurface('soundDrawing')}>sound drawing</button>
      <button onClick={() => preferences.setLowerSurface('performancePads')}>pads</button>
      <button onClick={() => preferences.setLeftTab('media')}>media tab</button>
    </div>
  )
}

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null

function mount(): void {
  container ??= document.createElement('div')
  if (!container.isConnected) document.body.appendChild(container)
  root = createRoot(container)
  act(() => root?.render(<Harness />))
}

beforeEach(() => {
  localStorage.clear()
  mount()
})

afterEach(() => {
  if (root) act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
})

describe('React workspace preferences', () => {
  it('survives React View unmount and remount', () => {
    const buttons = [...(container?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
    act(() => buttons.forEach(button => button.click()))

    const first = container?.firstElementChild as HTMLElement
    expect(first.dataset.left).toBe('true')
    expect(first.dataset.right).toBe('true')
    expect(first.dataset.lower).toBe('false')
    expect(first.dataset.surface).toBe('performancePads')
    expect(first.dataset.tab).toBe('media')

    act(() => root?.unmount())
    root = null
    mount()

    const remounted = container?.firstElementChild as HTMLElement
    expect(remounted.dataset.left).toBe('true')
    expect(remounted.dataset.right).toBe('true')
    expect(remounted.dataset.lower).toBe('false')
    expect(remounted.dataset.surface).toBe('performancePads')
    expect(remounted.dataset.tab).toBe('media')
  })

  it('persists the dedicated Sound Drawing lower surface', () => {
    const soundDrawingButton = [...(container?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
      .find(button => button.textContent === 'sound drawing')

    act(() => soundDrawingButton?.click())
    expect((container?.firstElementChild as HTMLElement).dataset.surface).toBe('soundDrawing')

    act(() => root?.unmount())
    root = null
    mount()

    expect((container?.firstElementChild as HTMLElement).dataset.surface).toBe('soundDrawing')
  })
})
