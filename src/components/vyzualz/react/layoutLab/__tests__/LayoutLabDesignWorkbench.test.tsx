// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LayoutLabMockup } from '../../LayoutLabMockup'

let root: ReturnType<typeof createRoot>
let container: HTMLDivElement

beforeEach(async () => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root.render(<LayoutLabMockup />))
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe('blank Layout Lab canvas', () => {
  it('has no dropdowns, comboboxes, listboxes or tabs anywhere', () => {
    expect(container.querySelector('[role="combobox"], [role="listbox"], [role="option"], [role="tablist"], select, .dv-underline-dropdown, .drm-dropdown')).toBeNull()
  })

  it('is a left window, a visualizer and a right window, all empty, above the audio dock', () => {
    const left = container.querySelector<HTMLElement>('.vz-inspector--left')!
    const right = container.querySelector<HTMLElement>('.vz-inspector--right')!
    const visualizer = container.querySelector<HTMLElement>('.rv-canvas-wrap')!
    expect(left.getAttribute('aria-label')).toBe('Layout Lab left window')
    expect(right.getAttribute('aria-label')).toBe('Layout Lab right window')
    expect(visualizer.getAttribute('aria-label')).toBe('Layout Lab visualizer')
    for (const region of [left, right]) {
      expect(region.querySelector('.vz-inspector-inner')!.children).toHaveLength(1)
      expect(region.querySelector('.vz-panel-body')!.childElementCount).toBe(0)
      expect(region.textContent).toBe('')
    }
    expect(visualizer.childElementCount).toBe(0)
    expect(visualizer.textContent).toBe('')

    const layout = container.querySelector('.rv-layout')!
    expect([...layout.children].map(node => node.className.split(' ')[0])).toEqual(['vz-inspector', 'rv-center-col', 'vz-inspector'])
    const dock = container.querySelector('.vz-transport-dock')!
    expect(dock).not.toBeNull()
    expect(layout.contains(dock)).toBe(false)
    expect(dock.previousElementSibling).toBe(layout)
  })

  it('mounts no production rendering or media runtimes', () => {
    expect(container.querySelector('canvas, audio, video')).toBeNull()
  })
})
