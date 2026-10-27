// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { OptionFWorkspace } from './OptionFWorkspace'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
if (!globalThis.ResizeObserver) globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} } as unknown as typeof ResizeObserver
let host: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(async () => {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => root.render(<OptionFWorkspace active switcher={<span>Original lab selector</span>} />))
})
afterEach(async () => { await act(async () => root.unmount()); host.remove() })
const click = async (node: Element | null) => { expect(node).not.toBeNull(); await act(async () => (node as HTMLElement).click()) }
const text = (selector: string, value: string) => [...host.querySelectorAll(selector)].find(node => node.textContent === value)!
const input = async (node: HTMLInputElement, value: string) => {
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(node, value); node.dispatchEvent(new Event('input', { bubbles: true })); node.dispatchEvent(new Event('change', { bubbles: true })) })
}

describe('Option F Studio Trace', () => {
  it('is scoped to its own root, theme and typography opt-ins and keeps the supplied selector', () => {
    const root = host.querySelector('.of-root')!
    expect(root.getAttribute('data-lab-design')).toBe('design-06')
    expect(root.getAttribute('data-ui-theme')).toBe('studio')
    expect(root.getAttribute('data-ui-typography')).toBe('studio')
    expect(host.querySelector('.of-nav')?.textContent).toContain('Original lab selector')
    expect(host.querySelector('.fw-app-shell, .rv-layout, .vz-transport-dock')).toBeNull()
  })
  it('preserves media filters, selection, search, list mode, layer metadata and notice dismissal', async () => {
    expect(host.querySelectorAll('.of-media-item')).toHaveLength(24)
    await click(text('.of-filter button', 'Videos'))
    expect(host.querySelectorAll('.of-media-item')).toHaveLength(4)
    await click(host.querySelector('.of-media-item'))
    expect(host.querySelector('.of-media-item')?.getAttribute('aria-pressed')).toBe('true')
    await input(host.querySelector('[aria-label="Search media"]')!, 'Haze')
    expect(host.querySelectorAll('.of-media-item')).toHaveLength(1)
    await click(host.querySelector('[aria-label="List view"]'))
    expect(host.querySelector('.of-media--list')).not.toBeNull()
    await click(text('.of-column--left [role="tab"] span', 'Layers').parentElement)
    expect(host.querySelector('.of-layer')?.textContent).toContain('100% · normal')
    await click(text('.of-column--left [role="tab"] span', 'Notice').parentElement)
    expect(host.querySelectorAll('.of-notice')).toHaveLength(16)
    await click(host.querySelector('.of-notice [aria-label="Dismiss notice"]'))
    expect(host.querySelectorAll('.of-notice')).toHaveLength(15)
  })
  it('preserves pattern/automation dependencies and scoped dropdown and palette portals', async () => {
    const switchFor = (label: string) => [...host.querySelectorAll('[role="switch"]')].find(node => node.closest('.of-switch-row')?.textContent?.startsWith(label))!
    await click(switchFor('Pattern Change'))
    expect(host.querySelector('[aria-label="Trigger"]')).toBeNull()
    await click(switchFor('Pattern Change'))
    await click(host.querySelector('[aria-label="Pattern"]'))
    const menu = document.body.querySelector('.of-menu')!
    expect(menu.getAttribute('data-ui-theme')).toBe('studio')
    expect(menu.getAttribute('data-ui-typography')).toBe('studio')
    await click([...menu.querySelectorAll('[role="option"]')].find(node => node.textContent?.includes('Canopy Cascade'))!)
    expect(switchFor('Auto Performance').getAttribute('aria-checked')).toBe('false')
    await click(text('.of-seg--tabs [role="tab"]', 'React'))
    expect(host.querySelector('.of-inspector-content')?.textContent).toContain('Pool Automation')
    await click(text('.of-seg--tabs [role="tab"]', 'Design'))
    expect(host.querySelector('[aria-label="Pattern"]')?.textContent).toContain('Canopy Cascade')
    await click(text('.of-group-title', 'Marquee Copy').parentElement)
    const field = [...host.querySelectorAll<HTMLInputElement>('.of-field input')].find(node => node.value === 'DVYDRM B2B GOONZ')!
    await input(field, 'TILEWORK')
    expect(field.value).toBe('TILEWORK')
    await click(text('.of-group-title', 'Palette').parentElement)
    await click(host.querySelector('.rv-ctrl-palette-hdr'))
    expect(document.body.querySelector('.rv-ctrl-palette-popover')?.getAttribute('data-ui-theme')).toBe('studio')
  })
  it('keeps every inspector tab reachable and linked cue editing alive across editing workspaces', async () => {
    for (const tab of ['Presets', 'React', 'Audio', 'Tracks', 'Design']) {
      await click(text('.of-seg--tabs [role="tab"]', tab))
      expect(text('.of-seg--tabs [role="tab"]', tab).getAttribute('aria-selected')).toBe('true')
      expect(host.querySelector('.of-inspector-content')?.textContent?.length).toBeGreaterThan(20)
    }
    const list = host.querySelector('.lmv-lyric-cues-window')!
    await click(list.querySelector('tr[data-cue-row-id="lt-cue-09"]'))
    expect(host.querySelector('.lyric-cue-block--selected')?.getAttribute('data-cue-id')).toBe('lt-cue-09')
    await click(text('.of-editing [role="tab"]', 'Settings'))
    expect(host.querySelector('.of-sequence')?.hasAttribute('hidden')).toBe(true)
    expect(host.querySelector('.vsm-modal')).not.toBeNull()
    await click(text('.of-editing [role="tab"]', 'Sequence'))
    expect(host.querySelector('.lyric-cue-block--selected')?.getAttribute('data-cue-id')).toBe('lt-cue-09')
  })
  it('supports keyboard navigation and ranges, guide toggles, bounded tempo, queue selection and dock collapse', async () => {
    const tabs = host.querySelector('.of-column--left .of-seg')!
    await act(async () => tabs.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
    expect(document.activeElement?.textContent).toBe('Layers')
    await click(host.querySelector('[aria-label="Composition grid"]'))
    expect(host.querySelector('.of-stage-screen')?.getAttribute('data-grid')).toBe('true')
    await click(host.querySelector('[aria-label="Safe area guides"]'))
    expect(host.querySelector('.of-stage-screen')?.getAttribute('data-safe')).toBe('true')
    await input(host.querySelector('[aria-label="Master Intensity"]')!, '.5')
    expect(host.querySelector('.of-range output')?.textContent).toBe('50%')
    await input(host.querySelector('[aria-label="BPM override"]')!, '140')
    await click(host.querySelector('[aria-label="Reset BPM"]'))
    expect(host.querySelector<HTMLInputElement>('[aria-label="BPM override"]')?.value).toBe('129')
    await click(host.querySelector('[aria-label="Next track"]'))
    expect(host.querySelector('.of-record')?.textContent).toContain('Trace of You')
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Next track"]')?.disabled).toBe(true)
    await click(host.querySelector('[aria-label="Play"]'))
    expect(host.querySelector('[aria-label="Pause"]')).not.toBeNull()
    await click(host.querySelector('[aria-label="Playlist"]'))
    await click(document.body.querySelector('.of-queue-row button'))
    expect(host.querySelector('.of-record')?.textContent).toContain('Mocha ID')
    await click(host.querySelector('[aria-label="Collapse audio dock"]'))
    expect(host.querySelector('.of-dock')?.getAttribute('data-collapsed')).toBe('true')
    await click(host.querySelector('[aria-label="Expand audio dock"]'))
    expect(host.querySelector('.of-dock')?.getAttribute('data-collapsed')).toBe('false')
  })
  it('themes track action menus with the tile presentation context', async () => {
    await click(text('.of-seg--tabs [role="tab"]', 'Tracks'))
    await click(host.querySelector('[aria-label="More actions for Neon Cathedral"]'))
    const menu = document.body.querySelector('.vz-app-context-menu')
    expect(menu?.getAttribute('data-ui-theme')).toBe('studio')
    expect(menu?.getAttribute('data-ui-typography')).toBe('studio')
  })
})
void React
