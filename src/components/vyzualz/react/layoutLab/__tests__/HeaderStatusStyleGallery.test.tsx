// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LayoutLabMockup } from '../../LayoutLabMockup'
import { HeaderStatusStyleGallery } from '../HeaderStatusStyleGallery'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

const concepts = () => [...container.querySelectorAll<HTMLElement>('[data-testid^="header-status-concept-"]')]
const press = async (group: string, label: string) => {
  const button = [...container.querySelectorAll<HTMLButtonElement>(`.llhs-ctl[aria-label="${group}"] button`)].find(item => item.textContent === label)
  if (!button) throw new Error(`Missing control ${group}: ${label}`)
  await act(async () => button.click())
}

describe('HeaderStatusStyleGallery', () => {
  it('shows three differently styled Saved / CPU / Loading / Track Timeline / profile concepts', async () => {
    await act(async () => root.render(<HeaderStatusStyleGallery />))
    expect(concepts().map(item => item.dataset.testid)).toEqual([
      'header-status-concept-separate-chips',
      'header-status-concept-status-strip',
      'header-status-concept-open-telemetry',
    ])
    for (const concept of concepts()) {
      expect(concept.textContent).toContain('Saved 10:44 AM')
      expect(concept.querySelector('[aria-label^="CPU"]')?.textContent).toContain('4%')
      expect(concept.querySelector('[aria-label="Loading"]')).not.toBeNull()
      expect(concept.querySelector('[aria-label="Track Timeline Visualizer"] svg')).not.toBeNull()
      expect(concept.querySelector('[aria-label="Profile"]')).not.toBeNull()
    }
    // Three different Loading treatments: a ring, three dots and a sweep line.
    expect(concepts()[0]!.querySelector('.llhs-ring.is-spinning')).not.toBeNull()
    expect(concepts()[1]!.querySelector('.llhs-dots.is-busy')).not.toBeNull()
    expect(concepts()[2]!.querySelector('.llhs-sweep.is-busy')).not.toBeNull()
  })

  it('drives every concept from one control bar: save state, loading and CPU level', async () => {
    await act(async () => root.render(<HeaderStatusStyleGallery />))
    await press('Save', 'Unsaved')
    await press('CPU', 'High')
    await press('Loading', 'Idle')
    await press('Timeline', 'Analyzing')
    for (const concept of concepts()) {
      expect(concept.textContent).toContain('Unsaved')
      expect(concept.querySelector('[aria-label^="CPU"]')?.textContent).toContain('86%')
      expect(concept.querySelector('[aria-label="Nothing loading"]')).not.toBeNull()
      expect(concept.querySelector('[aria-label^="Track Timeline Visualizer"]')?.getAttribute('data-state')).toBe('analyzing')
      expect(concept.querySelector('.llhs-frame')?.getAttribute('data-save')).toBe('unsaved')
      expect(concept.querySelector('.llhs-frame')?.getAttribute('data-cpu')).toBe('high')
    }
    expect(container.querySelector('.llhs-ring.is-spinning')).toBeNull()
    expect(container.querySelector('.llhs-dots.is-busy')).toBeNull()
    expect(container.querySelector('.llhs-sweep.is-busy')).toBeNull()

    await press('Save', 'Saving')
    expect(concepts()[0]!.textContent).toContain('Saving…')
  })

  it('draws the page\'s own centred control group in every mock header and swaps it per page', async () => {
    await act(async () => root.render(<HeaderStatusStyleGallery />))
    const labels = () => concepts().map(concept => concept.querySelector('.llhs-mid [role="toolbar"]')?.getAttribute('aria-label'))
    expect(labels()).toEqual(Array(3).fill('Lyric Manager controls'))
    expect(concepts()[0]!.querySelectorAll('.llhs-mid .vz-header-icon-key')).toHaveLength(3)
    await press('Page', 'React')
    expect(labels()).toEqual(Array(3).fill('React controls'))
    expect(concepts()[0]!.querySelector('.llhs-mid .rv-global-output-blackout')).not.toBeNull()
    await press('Page', 'Media')
    expect(labels()).toEqual(Array(3).fill('Media Manager controls'))
    await press('Page', 'Show')
    expect(labels()).toEqual(Array(3).fill('Show Manager controls'))
    expect(container.textContent).not.toContain('PAGE HEADING')
  })

  it('replaces the header control group concepts in the Layout Lab Cinema middle column', async () => {
    await act(async () => root.render(<LayoutLabMockup />))
    const trigger = container.querySelector<HTMLButtonElement>('.rv-engine-dropdown-trigger')!
    await act(async () => trigger.click())
    const option = [...container.querySelectorAll<HTMLElement>('[role="option"]')].find(item => /^◇\s*Cinema(?!\s*2)/.test(item.textContent ?? ''))!
    await act(async () => option.click())
    const center = container.querySelector('.rv-center-col')!
    expect(center.querySelectorAll('[data-testid^="header-status-concept-"]')).toHaveLength(3)
    expect(center.querySelector('[data-testid^="header-control-concept-"]')).toBeNull()
    expect(container.querySelector('[aria-label="Layout Lab right rail"] [data-testid^="header-status-concept-"]')).toBeNull()
  })
})
