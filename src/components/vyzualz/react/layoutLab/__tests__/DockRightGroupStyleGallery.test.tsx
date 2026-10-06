// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DockRightGroupStyleGallery } from '../DockRightGroupStyleGallery'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(async () => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root.render(<DockRightGroupStyleGallery />))
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

const concepts = () => [...container.querySelectorAll<HTMLElement>('[data-testid^="dock-right-concept-"]')]
const press = async (group: string, label: string) => {
  const button = [...container.querySelectorAll<HTMLButtonElement>(`.llhs-ctl[aria-label="${group}"] button`)].find(item => item.textContent === label)
  if (!button) throw new Error(`Missing control ${group}: ${label}`)
  await act(async () => button.click())
}

describe('DockRightGroupStyleGallery', () => {
  it('shows six concepts, each with the BPM readout and bar and the four action keys', () => {
    expect(concepts().map(item => item.dataset.testid)).toEqual([
      'dock-right-concept-key-matrix',
      'dock-right-concept-scrub-rail',
      'dock-right-concept-labelled-keys',
      'dock-right-concept-segmented-toolbar',
      'dock-right-concept-sync-hero',
      'dock-right-concept-centered-readout',
    ])
    for (const concept of concepts()) {
      expect(concept.querySelectorAll('.lldl-card')).toHaveLength(1)
      expect(concept.querySelector('.lldr-value')?.textContent).toBe('126.00')
      expect(concept.querySelector('input[type="range"][aria-label="BPM"]')).not.toBeNull()
      expect(concept.querySelector('button[aria-label="Tap tempo"]')).not.toBeNull()
      expect(concept.querySelector('button[aria-label^="BPM Sync"]')).not.toBeNull()
      expect(concept.querySelector('button[aria-label="Set cue point here"]')).not.toBeNull()
      expect(concept.querySelector('button[aria-label^="Audio source"]')).not.toBeNull()
    }
  })

  it('shows the two reserved empty keys only in the production-layout concept', () => {
    const ghosts = concepts().map(concept => concept.querySelectorAll('.lldr-ghost').length)
    expect(ghosts).toEqual([2, 0, 0, 0, 0, 0])
  })

  it('drives every concept from one BPM Sync state', async () => {
    await press('BPM Sync', 'Off')
    for (const concept of concepts()) {
      expect(concept.querySelector('button[aria-label="BPM Sync: OFF"]')).not.toBeNull()
    }
    // Clicking a concept's own Sync key flips them all back.
    await act(async () => concepts()[4]!.querySelector<HTMLButtonElement>('button[aria-label="BPM Sync: OFF"]')!.click())
    for (const concept of concepts()) {
      expect(concept.querySelector('button[aria-label="BPM Sync: ON"]')).not.toBeNull()
    }
  })

  it('shares one tempo: override shows the reset arrow, and reset returns to the analyzed BPM', async () => {
    expect(container.querySelector('.lldr-reset')).toBeNull()
    await press('Tempo', 'Override')
    for (const concept of concepts()) {
      expect(concept.querySelector('.lldr-value')?.textContent).toBe('128.50')
      expect(concept.querySelector('button[aria-label="Reset to analyzed BPM"]')).not.toBeNull()
    }
    await act(async () => concepts()[1]!.querySelector<HTMLButtonElement>('button[aria-label="Reset to analyzed BPM"]')!.click())
    for (const concept of concepts()) {
      expect(concept.querySelector('.lldr-value')?.textContent).toBe('126.00')
    }
  })

  it('shows the empty state with no BPM, a disabled scrub bar and disabled Tap and Cue keys', async () => {
    await press('Track', 'Empty')
    for (const concept of concepts()) {
      expect(concept.querySelector('.lldr-value')?.textContent).toBe('--')
      expect(concept.querySelector<HTMLInputElement>('input[aria-label="BPM"]')?.disabled).toBe(true)
      expect(concept.querySelector<HTMLButtonElement>('button[aria-label="Tap tempo"]')?.disabled).toBe(true)
      expect(concept.querySelector<HTMLButtonElement>('button[aria-label="Set cue point here"]')?.disabled).toBe(true)
      expect(concept.querySelector<HTMLButtonElement>('button[aria-label^="BPM Sync"]')?.disabled).toBe(false)
    }
  })
})
