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

async function openEngineDropdown(): Promise<HTMLButtonElement[]> {
  const trigger = container.querySelector<HTMLButtonElement>('.rv-engine-dropdown-trigger')
  if (!trigger) throw new Error('Missing engine dropdown trigger')
  await act(async () => trigger.click())
  return [...container.querySelectorAll<HTMLButtonElement>('[role="option"]')]
}

async function selectEngine(label: string) {
  const options = await openEngineDropdown()
  const option = options.find(candidate => candidate.textContent?.includes(label))
  if (!option) throw new Error(`Missing engine option: ${label}`)
  await act(async () => option.click())
}

describe('cleared Layout Lab engine workspaces', () => {
  it('keeps Canvas, PixGrid, Sound Drawing, and LaserDMX in the dropdown', async () => {
    const optionText = (await openEngineDropdown()).map(option => option.textContent)

    expect(optionText.some(text => text?.includes('CANVAS'))).toBe(true)
    expect(optionText.some(text => text?.includes('PixGrid'))).toBe(true)
    expect(optionText.some(text => text?.includes('Sound Drawing'))).toBe(true)
    expect(optionText.some(text => text?.includes('LaserDMX'))).toBe(true)
  })

  it.each([
    ['CANVAS', 'Canvas inspector tabs'],
    ['PixGrid', 'PixGrid inspector tabs'],
    ['Sound Drawing', 'Sound Drawing inspector tabs'],
    ['LaserDMX', 'LaserDMX inspector tabs'],
  ])('keeps shell navigation but clears mockup content when %s is selected', async (engine, inspectorLabel) => {
    await selectEngine(engine)

    const leftRail = container.querySelector('[aria-label="Layout Lab left rail"]')
    const leftWorkspace = leftRail?.querySelector('.rv-context-workspace')
    const rightRail = container.querySelector('[aria-label="Layout Lab right rail"]')
    const center = container.querySelector('.rv-canvas-wrap')

    expect(leftRail?.querySelector('.rv-engine-dropdown-trigger')).not.toBeNull()
    expect(leftWorkspace?.children).toHaveLength(1)
    expect(center?.childElementCount).toBe(0)
    expect(container.querySelector('.rv-lower-workspace')).toBeNull()
    const inspectorTabs = rightRail?.querySelector(`[role="tablist"][aria-label="${inspectorLabel}"]`)
    expect([...(inspectorTabs?.querySelectorAll('[role="tab"]') ?? [])].map(tab => tab.textContent)).toEqual([
      'PRESETS',
      'DESIGN',
      'REACT',
      'OUTPUT',
    ])
    expect(rightRail?.querySelector('.vz-panel-body')?.childElementCount).toBe(0)
  })

  it('keeps Lyric Manager in the dropdown while clearing only its middle visualizer', async () => {
    await selectEngine('Lyric Manager')

    const leftRail = container.querySelector('[aria-label="Layout Lab left rail"]')
    const rightRail = container.querySelector('[aria-label="Layout Lab right rail"]')
    const center = container.querySelector('.rv-canvas-wrap')

    expect(leftRail?.querySelector('.rv-engine-dropdown-trigger')).not.toBeNull()
    expect(center?.childElementCount).toBe(0)
    expect(rightRail?.querySelector('[role="tablist"]')).not.toBeNull()
  })
})
