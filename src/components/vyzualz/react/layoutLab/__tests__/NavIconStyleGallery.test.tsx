// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NavIconStyleGallery } from '../NavIconStyleGallery'

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

describe('NavIconStyleGallery', () => {
  it('shows five concept rows, each with the four navigation destinations and React active', async () => {
    await act(async () => root.render(<NavIconStyleGallery />))
    const rows = container.querySelectorAll('[data-testid^="nav-icon-concept-"]')
    expect(rows).toHaveLength(5)
    for (const row of rows) {
      expect([...row.querySelectorAll('[data-nav-icon]')].map(item => item.getAttribute('data-nav-icon'))).toEqual(['react', 'show', 'lyrics', 'media'])
      expect(row.querySelectorAll('.llni-item.is-active')).toHaveLength(1)
      expect(row.querySelectorAll('svg')).toHaveLength(4)
    }
    expect(container.textContent).toContain('Lyric Manager')
    expect(container.textContent).toContain('Media Manager')
    expect(container.textContent).toContain('Show Manager')
  })
})
