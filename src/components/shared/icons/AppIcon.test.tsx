// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AppIcon } from './AppIcon'
import { AppIconGlyph } from '../../vyzualz/react/layoutLab/AppIconGlyph'
import { APP_ICON_INVENTORY } from '../../vyzualz/react/layoutLab/appIconInventory'

let container: HTMLDivElement
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

describe('approved production icons', () => {
  it('uses the same artwork in production and the review gallery for every inventoried icon', async () => {
    const kinds = [...new Set(APP_ICON_INVENTORY.map(icon => icon.kind))]
    await act(async () => root.render(<>{kinds.map(kind => (
      <div key={kind}><AppIcon kind={kind} /><AppIconGlyph kind={kind} /></div>
    ))}</>))
    for (const pair of container.children) {
      const [production, gallery] = pair.querySelectorAll('svg')
      expect(production.getAttribute('viewBox')).toBe('0 0 32 32')
      expect(production.getAttribute('aria-hidden')).toBe('true')
      expect(production.getAttribute('width')).toBe('18')
      expect(gallery.getAttribute('width')).toBe('36')
      expect([...production.querySelectorAll('path')].map(path => path.getAttribute('d')))
        .toEqual([...gallery.querySelectorAll('path')].map(path => path.getAttribute('d')))
      expect(production.querySelector('.app-icon__signal')?.getAttribute('d')).toBeTruthy()
    }
  })

  it('preserves caller sizing, color, hooks and animation classes while protecting the approved linework', async () => {
    await act(async () => root.render(<AppIcon kind="loading" size={16} color="red" className="header-ring" signalClassName="header-spin" style={{ opacity: 0.5, strokeWidth: 9, fill: 'red' }} data-testid="activity" />))
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('width')).toBe('16')
    expect(svg.getAttribute('color')).toBe('red')
    expect(svg.classList.contains('header-ring')).toBe(true)
    expect(svg.getAttribute('data-testid')).toBe('activity')
    expect(svg.style.opacity).toBe('0.5')
    expect(svg.style.strokeWidth).toBe('1.5')
    expect(svg.style.fill).toBe('none')
    expect(svg.querySelector('.app-icon__signal.header-spin')).not.toBeNull()
  })
})
