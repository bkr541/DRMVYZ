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
  it('keeps the Template inspector tabs with the card studies in Design while React stays empty', async () => {
    await selectEngine('Template')

    expect(container.querySelector('.rv-engine-dropdown-trigger')?.getAttribute('aria-label')).toBe('Selected engine: Template')

    const leftRail = container.querySelector('[aria-label="Layout Lab left rail"]')
    expect(leftRail?.querySelector('.rv-engine-dropdown-trigger')).not.toBeNull()

    const rightRail = container.querySelector('[aria-label="Layout Lab right rail"]')
    expect(tabLabels('Layout Lab inspector tabs')).toEqual(['PRESETS', 'DESIGN', 'REACT', 'OUTPUT'])
    // Design is the tab that opens first and holds the five Preset Manager card studies.
    expect(rightRail?.querySelector('[aria-label="Preset Manager card mockups"]')).not.toBeNull()

    expect(container.querySelector('[aria-label="Timeline surfaces (mockup)"]')).toBeNull()
    expect(container.querySelector('.rv-lower-workspace')).toBeNull()
    // The Template canvas holds the React header-row studies and nothing else.
    expect(container.querySelector('.rv-canvas-wrap')?.childElementCount).toBe(1)
    expect(container.querySelector('.rv-canvas-wrap > [aria-label="React header row mockups"]')).not.toBeNull()

    const reactTab = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
      .find(button => button.textContent?.trim() === 'REACT')
    if (!reactTab) throw new Error('Missing REACT tab')
    await act(async () => reactTab.click())
    expect(reactTab.getAttribute('aria-selected')).toBe('true')
    expect(rightRail?.querySelector('.vz-panel-body')?.childElementCount).toBe(0)
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

  it('returns to Canvas with its dropdown preserved and workspace mockups cleared', async () => {
    await selectEngine('Template')
    await selectEngine('CANVAS')

    expect(container.querySelector('.rv-engine-dropdown-trigger')?.getAttribute('aria-label')).toBe('Selected engine: CANVAS')
    expect(container.querySelector('.rv-canvas-wrap')?.childElementCount).toBe(0)
    expect(container.querySelector('.rv-lower-workspace')).toBeNull()
    expect(tabLabels('Canvas inspector tabs')).toEqual(['PRESETS', 'DESIGN', 'REACT', 'OUTPUT'])
    expect(container.querySelector('[aria-label="Layout Lab right rail"] .vz-panel-body')?.childElementCount).toBe(0)
  })
})
