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

describe('blank Layout Lab designs', () => {
  it('opens Design One with an empty canvas and only the design selector', () => {
    expect(container.querySelectorAll('[role="combobox"]')).toHaveLength(1)
    expect(container.querySelector('[role="combobox"]')?.textContent).toContain('Design One')
    expect(container.querySelector('[data-lab-canvas="design-01"]')?.hasAttribute('hidden')).toBe(false)
    const stage = container.querySelector('.ll-design-stage')!
    expect(stage.children).toHaveLength(5)
    for (const canvas of stage.children) {
      expect(canvas.childElementCount).toBe(0)
      expect(canvas.textContent).toBe('')
    }
    expect(container.querySelector('.rv-layout, .vz-transport-dock, canvas, audio, video')).toBeNull()
  })

  it('offers exactly five enabled designs and switches between distinct blank canvases', async () => {
    const labels = ['Design One', 'Design Two', 'Design Three', 'Design Four', 'Design Five']
    const canvases = [...container.querySelectorAll<HTMLElement>('[data-lab-canvas]')]
    const trigger = container.querySelector<HTMLButtonElement>('[role="combobox"]')!

    for (const label of [...labels, labels[0]]) {
      await act(async () => trigger.click())
      const options = [...document.querySelectorAll<HTMLElement>('[role="option"]')]
      expect(options.map(option => option.textContent?.trim())).toEqual(labels)
      expect(options.every(option => option.getAttribute('aria-disabled') !== 'true' && !option.hasAttribute('disabled'))).toBe(true)
      await act(async () => options[labels.indexOf(label)].click())

      const visible = container.querySelectorAll<HTMLElement>('[data-lab-canvas]:not([hidden])')
      expect(visible).toHaveLength(1)
      expect(visible[0]).toBe(canvases[labels.indexOf(label)])
      expect(visible[0].getAttribute('aria-label')).toBe(`${label} canvas`)
      expect(visible[0].innerHTML).toBe('')
    }
  })
})
