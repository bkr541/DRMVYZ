// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AppIconAppearanceContext } from '../../../../shared/icons/AppIcon'
import { OptionBWorkspace } from './OptionBWorkspace'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
if (!globalThis.ResizeObserver) globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} } as unknown as typeof ResizeObserver
let host: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(async () => {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => root.render(<AppIconAppearanceContext.Provider value="outline"><OptionBWorkspace active switcher={<span>Lab selector</span>} /></AppIconAppearanceContext.Provider>))
})
afterEach(async () => { await act(async () => root.unmount()); host.remove() })
const click = async (node: Element | null) => { expect(node).not.toBeNull(); await act(async () => (node as HTMLElement).click()) }
const byText = (selector: string, text: string) => [...host.querySelectorAll(selector)].find(node => node.textContent === text)!
const input = async (node: HTMLInputElement, value: string) => {
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(node, value); node.dispatchEvent(new Event('input', { bubbles: true })); node.dispatchEvent(new Event('change', { bubbles: true })) })
}

describe('Option B Signal Desk behaviors', () => {
  it('keeps media filters, search, selection, list mode and read-only layers accessible', async () => {
    expect(host.querySelectorAll('.ob-media-item')).toHaveLength(24)
    await click(byText('.ob-library-filters button', 'Videos'))
    expect(host.querySelectorAll('.ob-media-item')).toHaveLength(4)
    await click(host.querySelector('.ob-media-item'))
    expect(host.querySelector('.ob-media-item')?.getAttribute('aria-pressed')).toBe('true')
    await input(host.querySelector('[aria-label="Search media"]')!, 'Haze')
    expect(host.querySelectorAll('.ob-media-item')).toHaveLength(1)
    await click(host.querySelector('[aria-label="List view"]'))
    expect(host.querySelector('.ob-media--list')).not.toBeNull()
    await click(byText('.ob-panel--left [role="tab"]', 'Layers'))
    expect(host.querySelector('.ob-layer')?.textContent).toContain('Electric Storm')
    expect(host.querySelector('.ob-layer')?.textContent).toContain('100% · normal')
    await click(byText('.ob-panel--left [role="tab"]', 'Notice'))
    expect(host.querySelectorAll('.ob-panel--left .dv-notice')).toHaveLength(16)
    await click(host.querySelector('.ob-panel--left .dv-notice [aria-label="Dismiss notice"]'))
    expect(host.querySelectorAll('.ob-panel--left .dv-notice')).toHaveLength(15)
  })

  it('preserves pattern dependencies, values across inspector tabs and themed dropdown portals', async () => {
    const group = () => [...host.querySelectorAll('.ob-switch-row')].find(node => node.textContent?.startsWith('Pattern Change'))!.querySelector('button')!
    expect(group().getAttribute('aria-checked')).toBe('true')
    await click(group())
    expect(host.querySelector('[aria-label="Trigger"]')).toBeNull()
    await click(group())
    await click(host.querySelector('[aria-label="Pattern"]'))
    const portal = document.body.querySelector('.ob-menu')!
    expect(portal.getAttribute('data-ui-theme')).toBe('midnight')
    expect(portal.getAttribute('data-ui-typography')).toBe('midnight')
    await click([...portal.querySelectorAll('[role="option"]')].find(node => node.textContent?.includes('Canopy Cascade'))!)
    const auto = [...host.querySelectorAll('.ob-switch-row')].find(node => node.textContent?.startsWith('Auto Performance'))!
    expect(auto.querySelector('button')?.getAttribute('aria-checked')).toBe('false')
    await click(byText('.ob-panel--right [role="tab"]', 'React'))
    expect(host.querySelector('.ob-panel--right .ob-adapted')?.textContent).toContain('Pool Automation')
    await click(byText('.ob-panel--right [role="tab"]', 'Design'))
    expect(host.querySelector('[aria-label="Pattern"]')?.textContent).toContain('Canopy Cascade')
    await click(byText('.ob-group-head > span', 'Marquee Copy')?.parentElement ?? null)
    const field = [...host.querySelectorAll<HTMLInputElement>('.ob-field input')].find(node => node.value === 'DVYDRM B2B GOONZ')!
    await input(field, 'SIGNAL DESK')
    expect(field.value).toBe('SIGNAL DESK')
  })

  it('supports keyboard tabs, composition guides and independent local transport', async () => {
    const left = host.querySelector('.ob-panel--left [role="tablist"]')!
    await act(async () => left.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
    expect(left.querySelector('[aria-selected="true"]')?.textContent).toBe('Layers')
    expect(document.activeElement?.textContent).toBe('Layers')
    await click(host.querySelector('[aria-label="Toggle composition grid"]'))
    expect(host.querySelector('.ob-stage-screen')?.getAttribute('data-grid')).toBe('true')
    await click(host.querySelector('[aria-label="Next track"]'))
    expect(host.querySelector('.ob-track-copy')?.textContent).toContain('Trace of You')
    await click(host.querySelector('[aria-label="Play"]'))
    expect(host.querySelector('[aria-label="Pause"]')).not.toBeNull()
    await input(host.querySelector('[aria-label="BPM override"]')!, '135.25')
    expect(host.querySelector('.ob-tempo strong')?.textContent).toBe('135.25')
    expect(host.querySelector('audio, video')).toBeNull()
  })
})
