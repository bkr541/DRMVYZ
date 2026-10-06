// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LayoutLabMockup } from '../../LayoutLabMockup'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

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

async function selectEngine(label: string) {
  const trigger = container.querySelector<HTMLButtonElement>('.rv-engine-dropdown-trigger')
  if (!trigger) throw new Error('Missing engine dropdown trigger')
  await act(async () => trigger.click())
  const option = [...container.querySelectorAll<HTMLButtonElement>('[role="option"]')]
    .find(candidate => candidate.textContent?.includes(label))
  if (!option) throw new Error(`Missing engine option: ${label}`)
  await act(async () => option.click())
}

function tabLabels(ariaLabel: string): string[] {
  const list = container.querySelector(`[role="tablist"][aria-label="${ariaLabel}"]`)
  if (!list) throw new Error(`Missing tablist: ${ariaLabel}`)
  return [...list.querySelectorAll('[role="tab"]')].map(tab => tab.textContent?.trim() ?? '')
}

describe('Template Layout Lab workspace', () => {
  it('shows the six audio dock left-group concepts in the middle section', async () => {
    await selectEngine('Template')

    const stage = container.querySelector('.rv-canvas-wrap > .llcm-stage-gallery')
    expect(stage?.querySelector('[aria-label="Audio dock left group concepts"]')).not.toBeNull()
    expect(stage?.querySelectorAll('[data-testid^="dock-left-concept-"]')).toHaveLength(6)
  })

  it('lays the dock mockups out in two columns: left group on the left, right group on the right', async () => {
    await selectEngine('Template')

    const columns = container.querySelectorAll('.llcm-stage-columns > .llcm-stage-column')
    expect(columns).toHaveLength(2)
    expect(columns[0]?.querySelector('[aria-label="Audio dock left group concepts"]')).not.toBeNull()
    expect(columns[0]?.querySelector('[aria-label="Audio dock right group concepts"]')).toBeNull()
    expect(columns[1]?.querySelector('[aria-label="Audio dock right group concepts"]')).not.toBeNull()
    expect(columns[1]?.querySelectorAll('[data-testid^="dock-right-concept-"]')).toHaveLength(6)
  })

  it('adds a Layout Lab-only Template engine with blank rails and no lower workspace', async () => {
    await selectEngine('Template')

    expect(container.querySelector('.rv-engine-dropdown-trigger')?.getAttribute('aria-label')).toBe('Selected engine: Template')

    const leftRail = container.querySelector('[aria-label="Layout Lab left rail"]')
    expect(leftRail?.querySelector('.rv-engine-dropdown-trigger')).not.toBeNull()
    expect(leftRail?.querySelector('[role="tablist"]')).toBeNull()
    expect(leftRail?.querySelector('.rv-context-workspace-body, .rv-left-tab-body')).toBeNull()

    const rightRail = container.querySelector('[aria-label="Layout Lab right rail"]')
    expect(tabLabels('Layout Lab inspector tabs')).toEqual(['PRESETS', 'DESIGN', 'REACT', 'OUTPUT'])
    expect(rightRail?.querySelector('.vz-panel-body')).toBeNull()
    expect(rightRail?.querySelectorAll(':scope > .vz-inspector-inner > *')).toHaveLength(1)

    expect(container.querySelector('[aria-label="Timeline surfaces (mockup)"]')).toBeNull()
    expect(container.querySelector('.rv-lower-workspace')).toBeNull()
    expect(container.querySelector('.rv-canvas-wrap')?.childElementCount).toBe(1)

    const presetsTab = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
      .find(button => button.textContent?.trim() === 'PRESETS')
    if (!presetsTab) throw new Error('Missing PRESETS tab')
    await act(async () => presetsTab.click())
    expect(presetsTab.getAttribute('aria-selected')).toBe('true')
  })

  it('shows four two-column preset card treatments, eight presets each, in the PRESETS tab', async () => {
    await selectEngine('Template')
    const presetsTab = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
      .find(button => button.textContent?.trim() === 'PRESETS')
    if (!presetsTab) throw new Error('Missing PRESETS tab')
    await act(async () => presetsTab.click())

    const gallery = container.querySelector('.llp4-gallery')
    expect(gallery?.querySelectorAll('.lldd-gallery-row')).toHaveLength(4)
    for (const selector of ['.rv-preset-spotlight-card--poster', '.llp4-info', '.llp4-block', '.llp4-wall']) expect(gallery?.querySelectorAll(selector)).toHaveLength(8)
    // Each Poster Tile and Colour Block carries its own generated still.
    expect(gallery?.querySelectorAll('.rv-preset-spotlight-card--poster canvas.llp4-art')).toHaveLength(8)
    expect(gallery?.querySelectorAll('.llp4-block canvas.llp4-art')).toHaveLength(8)
    // Two columns, and the full name (including the two long ones) is in every treatment, never cut off.
    expect(gallery?.querySelector('.llp4-grid')?.className).toBe('llp4-grid')
    expect(gallery?.querySelectorAll('.llp4-wall-col')).toHaveLength(2)
    for (const selector of ['.rv-preset-spotlight-card--poster', '.llp4-info', '.llp4-block', '.llp4-wall']) {
      const text = [...(gallery?.querySelectorAll(selector) ?? [])].map(node => node.textContent)
      expect(text.some(value => value?.includes('Kaleidoscope Bloom Tunnel'))).toBe(true)
      expect(text.some(value => value?.includes('Audio Reactive Ripple Grid'))).toBe(true)
    }
    // Choosing a card selects that preset in all four treatments; the one-column card above is untouched.
    expect(container.querySelector('.llpc-gallery')).not.toBeNull()
    await act(async () => gallery?.querySelectorAll<HTMLButtonElement>('.llp4-block')[4]?.click())
    expect(gallery?.querySelectorAll('.is-active, .rv-preset-spotlight-card--active')).toHaveLength(4)
  })

  it('shows three Media Library thumbnail treatments, six thumbnails each, in the REACT tab', async () => {
    await selectEngine('Template')
    const reactTab = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
      .find(button => button.textContent?.trim() === 'REACT')
    if (!reactTab) throw new Error('Missing REACT tab')
    await act(async () => reactTab.click())

    const gallery = container.querySelector('.llmt-gallery')
    expect(gallery?.querySelectorAll('.lldd-gallery-row')).toHaveLength(3)
    expect(gallery?.querySelectorAll('.llmt-poster')).toHaveLength(6)
    expect(gallery?.querySelectorAll('.llmt-sheet-tile')).toHaveLength(6)
    expect(gallery?.querySelectorAll('.llmt-mosaic-tile')).toHaveLength(6)
    // The same six items in every treatment, and clicking one selects it in all three.
    const names = (selector: string) => [...(gallery?.querySelectorAll(selector) ?? [])].map(node => node.getAttribute('aria-label')).sort()
    expect(names('.llmt-sheet-tile')).toEqual(names('.llmt-poster'))
    expect(names('.llmt-mosaic-tile')).toEqual(names('.llmt-poster'))
    const target = gallery?.querySelectorAll<HTMLButtonElement>('.llmt-sheet-tile')[2]
    await act(async () => target?.click())
    expect(gallery?.querySelectorAll('.is-active')).toHaveLength(3)

    // Below the thumbnails: three two-column preset list treatments, six presets each, the full name in every card.
    const presets = container.querySelector('.llp2-gallery')
    expect(presets?.querySelectorAll('.lldd-gallery-row')).toHaveLength(3)
    for (const selector of ['.llp2-stacked', '.llp2-corner', '.llp2-split']) expect(presets?.querySelectorAll(selector)).toHaveLength(6)
    expect(presets?.querySelector('.llp2-grid')?.className).toBe('llp2-grid')
    for (const selector of ['.llp2-stacked-name', '.llp2-corner-name', '.llp2-split-name']) {
      expect([...(presets?.querySelectorAll(selector) ?? [])].map(node => node.textContent)).toContain('Audio Reactive Ripple Grid')
    }
    await act(async () => presets?.querySelectorAll<HTMLButtonElement>('.llp2-corner')[4]?.click())
    expect(presets?.querySelectorAll('.is-active')).toHaveLength(3)

    // Design and Output stay blank.
    const designTab = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(button => button.textContent?.trim() === 'DESIGN')
    await act(async () => designTab?.click())
    expect(container.querySelector('.llmt-gallery')).toBeNull()
  })

  it('returns to existing engines without changing their Layout Lab composition', async () => {
    await selectEngine('Template')
    await selectEngine('CANVAS')

    expect(tabLabels('Canvas left workspace tabs')).toEqual(['SOURCE', 'LAYERS'])
    expect(tabLabels('Canvas inspector tabs')).toEqual(['PRESETS', 'DESIGN', 'REACT', 'OUTPUT'])
    expect(tabLabels('Timeline surfaces (mockup)')).toEqual(['Track Map', 'Performance Pads'])
  })
})
