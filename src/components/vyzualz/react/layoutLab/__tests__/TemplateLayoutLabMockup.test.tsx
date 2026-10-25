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
  it('shows the three audio studies in the middle while preserving left mockups and the empty right window', async () => {
    await selectEngine('Template')
    const leftRail = container.querySelector('[aria-label="Layout Lab left rail"]')!
    const leftMockups = leftRail.querySelector('.rv-left-tab-body')!
    const originalLeftContent = leftMockups.innerHTML
    expect(leftMockups.children.length).toBeGreaterThan(0)
    expect(leftRail.querySelector('.rv-engine-dropdown-trigger')?.getAttribute('aria-label')).toBe('Selected engine: Template')
    expect(tabLabels('Layout Lab inspector tabs')).toEqual(['PRESETS', 'DESIGN', 'REACT', 'OUTPUT'])
    const tabs = container.querySelector('[aria-label="Layout Lab inspector tabs"]')!
    for (const tab of tabs.querySelectorAll<HTMLButtonElement>('[role="tab"]')) {
      await act(async () => tab.click())
      expect(tab.getAttribute('aria-selected')).toBe('true')
      expect(container.querySelectorAll('.rv-canvas-wrap [aria-label="Audio library mockups"] .ll-audio-study')).toHaveLength(3)
      expect(container.querySelector('[aria-label="Layout Lab right rail"] .vz-panel-body')?.childElementCount).toBe(0)
      expect(leftRail.querySelector('.rv-left-tab-body')).toBe(leftMockups)
      expect(leftMockups.innerHTML).toBe(originalLeftContent)
    }
    expect(container.querySelector('.ll-preset-study')).toBeNull()
    expect(container.querySelector('.rv-lower-workspace')).toBeNull()
    // The audio dock is outside the middle visualizer and both windows.
    expect(container.querySelector('.vz-transport-dock')).not.toBeNull()
  })

  it('lets each audio mockup select and search tracks independently', async () => {
    await selectEngine('Template')
    const studies = container.querySelectorAll('.ll-audio-study')
    const track = studies[0].querySelector<HTMLButtonElement>('[aria-label="Select Trace of You"]')!
    await act(async () => track.click())
    expect(track.getAttribute('aria-pressed')).toBe('true')
    expect(studies[1].querySelector('[aria-label="Select Mocha ID — Nelly Grilz"]')?.getAttribute('aria-pressed')).toBe('true')
    const search = studies[1].querySelector<HTMLInputElement>('[aria-label="Search Uploaded Tracks"]')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'static')
      search.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(studies[1].querySelectorAll('.ll-audio-card')).toHaveLength(1)
    expect(studies[0].querySelectorAll('.ll-audio-card')).toHaveLength(8)
    const lyricTrack = studies[2].querySelector<HTMLButtonElement>('[aria-label="Select Trace of You"]')!
    await act(async () => lyricTrack.click())
    expect(studies[2].querySelector('.ll-audio-version')?.textContent).toContain('Trace of You')
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
