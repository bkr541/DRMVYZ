// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { OptionDWorkspace } from './OptionDWorkspace'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
if (!globalThis.ResizeObserver) globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} } as unknown as typeof ResizeObserver
let host: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(async () => {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => root.render(<OptionDWorkspace active switcher={<span>Original lab selector</span>} />))
})
afterEach(async () => { await act(async () => root.unmount()); host.remove() })
const click = async (node: Element | null) => { expect(node).not.toBeNull(); await act(async () => (node as HTMLElement).click()) }
const text = (selector: string, value: string) => [...host.querySelectorAll(selector)].find(node => node.textContent === value)!
const input = async (node: HTMLInputElement, value: string) => {
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(node, value); node.dispatchEvent(new Event('input', { bubbles: true })); node.dispatchEvent(new Event('change', { bubbles: true })) })
}

describe('Option D Tilework', () => {
  it('is scoped to its own root, theme and typography opt-ins and keeps the supplied selector', () => {
    const root = host.querySelector('.od-root')!
    expect(root.getAttribute('data-lab-design')).toBe('design-04')
    expect(root.getAttribute('data-ui-theme')).toBe('tile')
    expect(root.getAttribute('data-ui-typography')).toBe('tile')
    expect(host.querySelector('.od-nav')?.textContent).toContain('Original lab selector')
    expect(host.querySelector('.fw-app-shell, .rv-layout, .vz-transport-dock')).toBeNull()
  })
  it('preserves media filters, selection, search, list mode, layer metadata and notice dismissal', async () => {
    expect(host.querySelectorAll('.od-media-item')).toHaveLength(24)
    await click(text('.od-filter button', 'Videos'))
    expect(host.querySelectorAll('.od-media-item')).toHaveLength(4)
    await click(host.querySelector('.od-media-item'))
    expect(host.querySelector('.od-media-item')?.getAttribute('aria-pressed')).toBe('true')
    await input(host.querySelector('[aria-label="Search media"]')!, 'Haze')
    expect(host.querySelectorAll('.od-media-item')).toHaveLength(1)
    await click(host.querySelector('[aria-label="List view"]'))
    expect(host.querySelector('.od-media--list')).not.toBeNull()
    await click(text('.od-column--left [role="tab"] span', 'Layers').parentElement)
    expect(host.querySelector('.od-layer')?.textContent).toContain('100% · normal')
    await click(text('.od-column--left [role="tab"] span', 'Notice').parentElement)
    expect(host.querySelectorAll('.od-notice')).toHaveLength(16)
    await click(host.querySelector('.od-notice [aria-label="Dismiss notice"]'))
    expect(host.querySelectorAll('.od-notice')).toHaveLength(15)
  })
  it('preserves pattern/automation dependencies and scoped dropdown and palette portals', async () => {
    const switchFor = (label: string) => [...host.querySelectorAll('[role="switch"]')].find(node => node.textContent?.startsWith(label) || node.closest('.od-switch-row')?.textContent?.startsWith(label))!
    await click(switchFor('Pattern Change'))
    expect(host.querySelector('[aria-label="Trigger"]')).toBeNull()
    await click(switchFor('Pattern Change'))
    await click(host.querySelector('[aria-label="Pattern"]'))
    const menu = document.body.querySelector('.od-menu')!
    expect(menu.getAttribute('data-ui-theme')).toBe('tile')
    expect(menu.getAttribute('data-ui-typography')).toBe('tile')
    await click([...menu.querySelectorAll('[role="option"]')].find(node => node.textContent?.includes('Canopy Cascade'))!)
    expect(switchFor('Auto Performance').getAttribute('aria-checked')).toBe('false')
    await click(text('.od-seg--tabs [role="tab"]', 'React'))
    expect(host.querySelector('.od-inspector-content')?.textContent).toContain('Pool Automation')
    await click(text('.od-seg--tabs [role="tab"]', 'Design'))
    expect(host.querySelector('[aria-label="Pattern"]')?.textContent).toContain('Canopy Cascade')
    await click(text('.od-group-title', 'Marquee Copy').parentElement)
    const field = [...host.querySelectorAll<HTMLInputElement>('.od-field input')].find(node => node.value === 'DVYDRM B2B GOONZ')!
    await input(field, 'TILEWORK')
    expect(field.value).toBe('TILEWORK')
    await click(text('.od-group-title', 'Palette').parentElement)
    await click(host.querySelector('.rv-ctrl-palette-hdr'))
    expect(document.body.querySelector('.rv-ctrl-palette-popover')?.getAttribute('data-ui-theme')).toBe('tile')
  })
  it('keeps every inspector tab reachable and linked cue editing alive across editing workspaces', async () => {
    for (const tab of ['Presets', 'React', 'Audio', 'Tracks', 'Design']) {
      await click(text('.od-seg--tabs [role="tab"]', tab))
      expect(text('.od-seg--tabs [role="tab"]', tab).getAttribute('aria-selected')).toBe('true')
      expect(host.querySelector('.od-inspector-content')?.textContent?.length).toBeGreaterThan(20)
    }
    const list = host.querySelector('.lmv-lyric-cues-window')!
    await click(list.querySelector('tr[data-cue-row-id="lt-cue-09"]'))
    expect(host.querySelector('.lyric-cue-block--selected')?.getAttribute('data-cue-id')).toBe('lt-cue-09')
    await click(text('.od-editing [role="tab"]', 'Settings'))
    expect(host.querySelector('.od-sequence')?.hasAttribute('hidden')).toBe(true)
    expect(host.querySelector('.vsm-modal')).not.toBeNull()
    await click(text('.od-editing [role="tab"]', 'Sequence'))
    expect(host.querySelector('.lyric-cue-block--selected')?.getAttribute('data-cue-id')).toBe('lt-cue-09')
  })
  it('supports keyboard navigation and ranges, guide toggles, bounded tempo, queue selection and dock collapse', async () => {
    const tabs = host.querySelector('.od-column--left .od-seg')!
    await act(async () => tabs.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
    expect(document.activeElement?.textContent).toBe('Layers')
    await click(host.querySelector('[aria-label="Composition grid"]'))
    expect(host.querySelector('.od-stage-screen')?.getAttribute('data-grid')).toBe('true')
    await click(host.querySelector('[aria-label="Safe area guides"]'))
    expect(host.querySelector('.od-stage-screen')?.getAttribute('data-safe')).toBe('true')
    await input(host.querySelector('[aria-label="Master Intensity"]')!, '.5')
    expect(host.querySelector('.od-readout b')?.textContent).toBe('50')
    await input(host.querySelector('[aria-label="BPM override"]')!, '140')
    await click(host.querySelector('[aria-label="Reset BPM"]'))
    expect(host.querySelector<HTMLInputElement>('[aria-label="BPM override"]')?.value).toBe('129')
    await click(host.querySelector('[aria-label="Next track"]'))
    expect(host.querySelector('.od-record')?.textContent).toContain('Trace of You')
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Next track"]')?.disabled).toBe(true)
    await click(host.querySelector('[aria-label="Play"]'))
    expect(host.querySelector('[aria-label="Pause"]')).not.toBeNull()
    await click(host.querySelector('[aria-label="Playlist"]'))
    await click(document.body.querySelector('.od-queue-row button'))
    expect(host.querySelector('.od-record')?.textContent).toContain('Mocha ID')
    await click(host.querySelector('[aria-label="Collapse audio dock"]'))
    expect(host.querySelector('.od-dock')?.getAttribute('data-collapsed')).toBe('true')
    await click(host.querySelector('[aria-label="Expand audio dock"]'))
    expect(host.querySelector('.od-dock')?.getAttribute('data-collapsed')).toBe('false')
  })
  it('themes track action menus with the tile presentation context', async () => {
    await click(text('.od-seg--tabs [role="tab"]', 'Tracks'))
    await click(host.querySelector('[aria-label="More actions for Neon Cathedral"]'))
    const menu = document.body.querySelector('.vz-app-context-menu')
    expect(menu?.getAttribute('data-ui-theme')).toBe('tile')
    expect(menu?.getAttribute('data-ui-typography')).toBe('tile')
  })
})
void React
