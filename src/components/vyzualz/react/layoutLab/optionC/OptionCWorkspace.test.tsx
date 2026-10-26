// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ContextActionMenu, ContextMenuPresentationContext } from '../../../context-menu/ContextActionMenu'
import { OptionCWorkspace } from './OptionCWorkspace'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
if (!globalThis.ResizeObserver) globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} } as unknown as typeof ResizeObserver
let host: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(async () => {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => root.render(<OptionCWorkspace active switcher={<span>Original lab selector</span>} />))
})
afterEach(async () => { await act(async () => root.unmount()); host.remove() })
const click = async (node: Element | null) => { expect(node).not.toBeNull(); await act(async () => (node as HTMLElement).click()) }
const text = (selector: string, value: string) => [...host.querySelectorAll(selector)].find(node => node.textContent === value)!
const input = async (node: HTMLInputElement, value: string) => {
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(node, value); node.dispatchEvent(new Event('input', { bubbles: true })); node.dispatchEvent(new Event('change', { bubbles: true })) })
}

describe('Option C Afterglow', () => {
  it('preserves media filters, selection, search, list mode, layer metadata and notice dismissal', async () => {
    expect(host.querySelectorAll('.oc-media-item')).toHaveLength(24)
    await click(text('.oc-filter button', 'Videos'))
    expect(host.querySelectorAll('.oc-media-item')).toHaveLength(4)
    await click(host.querySelector('.oc-media-item'))
    expect(host.querySelector('.oc-media-item')?.getAttribute('aria-pressed')).toBe('true')
    await input(host.querySelector('[aria-label="Search media"]')!, 'Haze')
    expect(host.querySelectorAll('.oc-media-item')).toHaveLength(1)
    await click(host.querySelector('[aria-label="List view"]'))
    expect(host.querySelector('.oc-media--list')).not.toBeNull()
    await click(text('.oc-library [role="tab"]', 'Layers'))
    expect(host.querySelector('.oc-layer')?.textContent).toContain('100% · normal')
    await click(text('.oc-library [role="tab"]', 'Notice'))
    expect(host.querySelectorAll('.oc-notice')).toHaveLength(16)
    await click(host.querySelector('.oc-notice [aria-label="Dismiss notice"]'))
    expect(host.querySelectorAll('.oc-notice')).toHaveLength(15)
  })
  it('preserves pattern/automation dependencies and scoped dropdown and palette portals', async () => {
    const switchFor = (label: string) => [...host.querySelectorAll('.oc-switch-row')].find(node => node.textContent?.startsWith(label))!.querySelector('button')!
    await click(switchFor('Pattern Change'))
    expect(host.querySelector('[aria-label="Trigger"]')).toBeNull()
    await click(switchFor('Pattern Change'))
    await click(host.querySelector('[aria-label="Pattern"]'))
    const menu = document.body.querySelector('.oc-menu')!
    expect(menu.getAttribute('data-ui-theme')).toBe('graphite')
    expect(menu.getAttribute('data-ui-typography')).toBe('graphite')
    await click([...menu.querySelectorAll('[role="option"]')].find(node => node.textContent?.includes('Canopy Cascade'))!)
    expect(switchFor('Auto Performance').getAttribute('aria-checked')).toBe('false')
    await click(text('.oc-inspector > .oc-tabs [role="tab"]', 'React'))
    expect(host.querySelector('.oc-inspector-content')?.textContent).toContain('Pool Automation')
    await click(text('.oc-inspector > .oc-tabs [role="tab"]', 'Design'))
    expect(host.querySelector('[aria-label="Pattern"]')?.textContent).toContain('Canopy Cascade')
    await click(text('.oc-group-head > span', 'Marquee Copy').parentElement)
    const field = [...host.querySelectorAll<HTMLInputElement>('.oc-field input')].find(node => node.value === 'DVYDRM B2B GOONZ')!
    await input(field, 'AFTERGLOW')
    expect(field.value).toBe('AFTERGLOW')
    await click(text('.oc-group-head > span', 'Palette').parentElement)
    await click(host.querySelector('.rv-ctrl-palette-hdr'))
    expect(document.body.querySelector('.rv-ctrl-palette-popover')?.getAttribute('data-ui-theme')).toBe('graphite')
  })
  it('keeps linked cue editing alive across the new editing navigation', async () => {
    const list = host.querySelector('.lmv-lyric-cues-window')!
    await click(list.querySelector('tr[data-cue-row-id="lt-cue-09"]'))
    expect(host.querySelector('.lyric-cue-block--selected')?.getAttribute('data-cue-id')).toBe('lt-cue-09')
    await click(text('.oc-editing-head [role="tab"]', 'Settings'))
    expect(host.querySelector('.oc-sequence')?.hasAttribute('hidden')).toBe(true)
    expect(host.querySelector('.vsm-modal')).not.toBeNull()
    await click(text('.oc-editing-head [role="tab"]', 'Sequence'))
    expect(host.querySelector('.lyric-cue-block--selected')?.getAttribute('data-cue-id')).toBe('lt-cue-09')
  })
  it('supports keyboard navigation and ranges, guide toggles, bounded tempo, queue selection and dock collapse', async () => {
    const tabs = host.querySelector('.oc-library .oc-tabs')!
    await act(async () => tabs.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
    expect(document.activeElement?.textContent).toBe('Layers')
    await click(host.querySelector('[aria-label="Composition grid"]'))
    expect(host.querySelector('.oc-stage-screen')?.getAttribute('data-grid')).toBe('true')
    await click(host.querySelector('[aria-label="Safe area guides"]'))
    expect(host.querySelector('.oc-stage-screen')?.getAttribute('data-safe')).toBe('true')
    await input(host.querySelector('[aria-label="Master Intensity"]')!, '.5')
    expect(host.querySelector('.oc-master-dials b')?.textContent).toBe('50%')
    await input(host.querySelector('[aria-label="BPM override"]')!, '140')
    await click(host.querySelector('[aria-label="Reset BPM"]'))
    expect(host.querySelector<HTMLInputElement>('[aria-label="BPM override"]')?.value).toBe('129')
    await click(host.querySelector('[aria-label="Next track"]'))
    expect(host.querySelector('.oc-record')?.textContent).toContain('Trace of You')
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Next track"]')?.disabled).toBe(true)
    await click(host.querySelector('[aria-label="Play"]'))
    expect(host.querySelector('[aria-label="Pause"]')).not.toBeNull()
    await click(host.querySelector('[aria-label="Playlist"]'))
    await click(document.body.querySelector('.oc-queue-row button'))
    expect(host.querySelector('.oc-record')?.textContent).toContain('Mocha ID')
    await click(host.querySelector('[aria-label="Collapse audio dock"]'))
    expect(host.querySelector('.oc-dock')?.getAttribute('data-collapsed')).toBe('true')
    await click(host.querySelector('[aria-label="Expand audio dock"]'))
    expect(host.querySelector('.oc-dock')?.getAttribute('data-collapsed')).toBe('false')
  })
  it('themes action-menu portals only when opted in and uses the supplied owner document', async () => {
    await click(text('.oc-inspector > .oc-tabs [role="tab"]', 'Tracks'))
    await click(host.querySelector('[aria-label="More actions for Neon Cathedral"]'))
    expect(document.body.querySelector('.vz-app-context-menu')?.getAttribute('data-ui-theme')).toBe('graphite')
    const items = [{ id: 'open', label: 'Open', onSelect: () => {} }]
    await act(async () => root.render(<ContextActionMenu x={10} y={10} ariaLabel="Default menu" items={items} onClose={() => {}} />))
    expect(document.body.querySelector('[aria-label="Default menu"]')?.hasAttribute('data-ui-theme')).toBe(false)
    const frame = document.createElement('iframe'); document.body.append(frame)
    try {
      const ownerRef = { current: frame.contentDocument!.body }
      await act(async () => root.render(<ContextMenuPresentationContext.Provider value={{ theme: 'graphite', typography: 'graphite', ownerRef }}><ContextActionMenu x={10} y={10} ariaLabel="Popup menu" items={items} onClose={() => {}} /></ContextMenuPresentationContext.Provider>))
      expect(document.body.querySelector('[aria-label="Popup menu"]')).toBeNull()
      expect(frame.contentDocument!.querySelector('[aria-label="Popup menu"]')?.getAttribute('data-ui-typography')).toBe('graphite')
      await act(async () => root.render(<span />))
    } finally { frame.remove() }
  })

})
