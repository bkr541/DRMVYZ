// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PerformancePadStudies } from './PerformancePadStudies'
import { DEFAULT_PERFORMANCE_PADS } from '../ReactTypes'
let host: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(async () => { host = document.createElement('div'); document.body.append(host); root = createRoot(host); await act(async () => root.render(<PerformancePadStudies />)) })
afterEach(async () => { await act(async () => root.unmount()); host.remove() })
const pad = (size: string, id: string) => host.querySelector<HTMLButtonElement>(`[data-pad-study-item="${size}-${id}"]`)!

describe('Layout Lab performance pads', () => {
  it('shows only the production pad, at its full and its compact size', () => {
    expect([...host.querySelectorAll('[data-pad-study]')].map(section => (section as HTMLElement).dataset.padStudy)).toEqual(['full', 'compact'])
    const full = host.querySelector('[data-pad-study="full"]')!, compact = host.querySelector('[data-pad-study="compact"]')!
    // The production wrappers and component: the expanded section for Full, the plain embedded section for Compact.
    expect(full.querySelector('.rv-pads-section.rv-pads-section--expanded .rv-pads-grid')).not.toBeNull()
    expect(compact.querySelector('.rv-pads-section:not(.rv-pads-section--expanded) .rv-pads-grid')).not.toBeNull()
    expect(full.querySelectorAll('button.performance-pad.rv-pad[data-density="expanded"]')).toHaveLength(5)
    expect(compact.querySelectorAll('button.performance-pad.rv-pad[data-density="compact"]')).toHaveLength(5)
    // The production pads' own labels and shortcuts, not invented ones.
    const first = DEFAULT_PERFORMANCE_PADS.slice(0, 5)
    for (const section of [full, compact]) {
      expect([...section.querySelectorAll('.performance-pad-label')].map(label => label.textContent)).toEqual(first.map(p => p.label))
      expect([...section.querySelectorAll('.performance-pad-number')].map(key => key.textContent)).toEqual(first.map(p => p.keyBinding.toUpperCase()))
    }
    // None of the retired custom designs remain.
    expect(host.querySelectorAll('.ll-study-pad')).toHaveLength(0)
  })

  it('selects a pad locally in each size, leaves empty slots disabled, and holds the strike until release', async () => {
    const [reactor, dropCage] = DEFAULT_PERFORMANCE_PADS
    expect(pad('full', reactor!.id).dataset.selected).toBe('true')
    await act(async () => pad('full', dropCage!.id).click())
    expect(pad('full', dropCage!.id).dataset.selected).toBe('true')
    expect(pad('full', reactor!.id).dataset.selected).toBeUndefined()
    expect(pad('compact', reactor!.id).dataset.selected).toBe('true')
    const empty = host.querySelector<HTMLButtonElement>('[data-pad-study="full"] [data-empty="true"]')!
    expect(empty.disabled).toBe(true)
    const button = pad('compact', dropCage!.id)
    await act(async () => button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 })))
    expect(button.dataset.hit).toBe('true')
    await act(async () => button.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0 })))
    expect(button.dataset.hit).toBeUndefined()
  })
})
