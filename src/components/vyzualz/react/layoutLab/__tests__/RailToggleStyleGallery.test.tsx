// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { RailToggleStyleGallery } from '../RailToggleStyleGallery'

let container: HTMLElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe('RailToggleStyleGallery', () => {
  it('shows five concepts, each with a left and right rail whose control collapses and re-expands that rail', async () => {
    await act(async () => root.render(<RailToggleStyleGallery />))
    const variants = ['tucked', 'edge-tab', 'header', 'seam', 'footer']
    for (const variant of variants) {
      const mock = container.querySelector(`[data-testid="rail-toggle-${variant}"]`)!
      const left = mock.querySelector<HTMLElement>('.llrt-rail--left')!
      const toggle = left.querySelector<HTMLButtonElement>('.llrt-toggle')!
      expect(mock.querySelectorAll('.llrt-toggle')).toHaveLength(2)
      expect(left.getAttribute('data-collapsed')).toBe('false')
      await act(async () => toggle.click())
      expect(left.getAttribute('data-collapsed')).toBe('true')
      expect(toggle.getAttribute('aria-label')).toBe('Expand left rail')
      expect(mock.querySelector('.llrt-rail--right')!.getAttribute('data-collapsed')).toBe('false')
      await act(async () => toggle.click())
      expect(left.getAttribute('data-collapsed')).toBe('false')
    }
  })
})
