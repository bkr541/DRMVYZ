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
  it('shows three differently styled Saved / CPU / Loading concepts', async () => {
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
    for (const concept of concepts()) {
      expect(concept.textContent).toContain('Unsaved')
      expect(concept.querySelector('[aria-label^="CPU"]')?.textContent).toContain('86%')
      expect(concept.querySelector('[aria-label="Nothing loading"]')).not.toBeNull()
      expect(concept.querySelector('.llhs-frame')?.getAttribute('data-save')).toBe('unsaved')
      expect(concept.querySelector('.llhs-frame')?.getAttribute('data-cpu')).toBe('high')
    }
    expect(container.querySelector('.llhs-ring.is-spinning')).toBeNull()
    expect(container.querySelector('.llhs-dots.is-busy')).toBeNull()
    expect(container.querySelector('.llhs-sweep.is-busy')).toBeNull()

    await press('Save', 'Saving')
    expect(concepts()[0]!.textContent).toContain('Saving…')
  })

  it('is the content of the Design tab in the Layout Lab Cinema engine', async () => {
    await act(async () => root.render(<LayoutLabMockup />))
    const trigger = container.querySelector<HTMLButtonElement>('.rv-engine-dropdown-trigger')!
    await act(async () => trigger.click())
    const option = [...container.querySelectorAll<HTMLElement>('[role="option"]')].find(item => /^◇\s*Cinema(?!\s*2)/.test(item.textContent ?? ''))!
    await act(async () => option.click())
    const rightRail = container.querySelector('[aria-label="Layout Lab right rail"]')!
    expect(rightRail.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim()).toBe('DESIGN')
    expect(rightRail.querySelectorAll('[data-testid^="header-status-concept-"]')).toHaveLength(3)
  })
})
