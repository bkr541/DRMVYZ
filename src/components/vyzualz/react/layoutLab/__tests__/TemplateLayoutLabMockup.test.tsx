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
    expect(container.querySelector('.rv-canvas-wrap')?.childElementCount).toBe(0)

    const presetsTab = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
      .find(button => button.textContent?.trim() === 'PRESETS')
    if (!presetsTab) throw new Error('Missing PRESETS tab')
    await act(async () => presetsTab.click())
    expect(presetsTab.getAttribute('aria-selected')).toBe('true')
  })

  it('returns to existing engines without changing their Layout Lab composition', async () => {
    await selectEngine('Template')
    await selectEngine('CANVAS')

    expect(tabLabels('Canvas left workspace tabs')).toEqual(['SOURCE', 'LAYERS'])
    expect(tabLabels('Canvas inspector tabs')).toEqual(['PRESETS', 'DESIGN', 'REACT', 'OUTPUT'])
    expect(tabLabels('Timeline surfaces (mockup)')).toEqual(['Track Map', 'Performance Pads'])
  })
})
