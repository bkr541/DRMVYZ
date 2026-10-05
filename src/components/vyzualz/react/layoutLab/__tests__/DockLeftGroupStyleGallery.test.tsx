// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DockLeftGroupStyleGallery } from '../DockLeftGroupStyleGallery'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(async () => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root.render(<DockLeftGroupStyleGallery />))
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

const concepts = () => [...container.querySelectorAll<HTMLElement>('[data-testid^="dock-left-concept-"]')]
const press = async (group: string, label: string) => {
  const button = [...container.querySelectorAll<HTMLButtonElement>(`.llhs-ctl[aria-label="${group}"] button`)].find(item => item.textContent === label)
  if (!button) throw new Error(`Missing control ${group}: ${label}`)
  await act(async () => button.click())
}

describe('DockLeftGroupStyleGallery', () => {
  it('shows six concepts, each with play, Add/Replace Track, track info and volume', () => {
    expect(concepts().map(item => item.dataset.testid)).toEqual([
      'dock-left-concept-cover-slot',
      'dock-left-concept-transport-rail',
      'dock-left-concept-progress-tile',
      'dock-left-concept-split-keys',
      'dock-left-concept-compact-line',
      'dock-left-concept-centered-strip',
    ])
    for (const concept of concepts()) {
      expect(concept.querySelectorAll('.lldl-card')).toHaveLength(1)
      expect(concept.querySelector('button[aria-label="Pause"]')).not.toBeNull()
      expect(concept.querySelector('button[aria-label="Replace Track"]')).not.toBeNull()
      expect(concept.querySelector('.lldl-title')?.textContent).toBe('Midnight Run')
      expect(concept.querySelector('.lldl-artist')?.textContent).toBe('DVYDRM')
      expect(concept.querySelector('input[type="range"][aria-label="Track volume"]')).not.toBeNull()
    }
  })

  it('drives every concept from one playback state', async () => {
    await press('Playback', 'Paused')
    for (const concept of concepts()) {
      expect(concept.querySelector('button[aria-label="Play"]')).not.toBeNull()
    }
    // Clicking a concept's own play button flips them all.
    await act(async () => concepts()[2]!.querySelector<HTMLButtonElement>('button[aria-label="Play"]')!.click())
    for (const concept of concepts()) {
      expect(concept.querySelector('button[aria-label="Pause"]')).not.toBeNull()
    }
  })

  it('shows the empty state with a disabled play key and an Add Track action', async () => {
    await press('Track', 'Empty')
    for (const concept of concepts()) {
      expect(concept.querySelector('.lldl-title')?.textContent).toBe('No track loaded')
      expect(concept.querySelector('.lldl-artist')?.textContent).toBe('Load a track to begin')
      expect(concept.querySelector<HTMLButtonElement>('.lldl-play')?.disabled).toBe(true)
      expect(concept.querySelector('button[aria-label="Add Track"]')).not.toBeNull()
    }
  })

  it('keeps one shared volume across the concepts', async () => {
    const slider = concepts()[0]!.querySelector<HTMLInputElement>('input[type="range"]')!
    expect(Number(slider.value)).toBeCloseTo(0.82)
    expect(concepts()[0]!.textContent).toContain('-1.7 dB')
  })
})
