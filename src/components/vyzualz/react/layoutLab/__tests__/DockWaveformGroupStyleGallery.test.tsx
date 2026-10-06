// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DockWaveformGroupStyleGallery } from '../DockWaveformGroupStyleGallery'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(async () => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root.render(<DockWaveformGroupStyleGallery />))
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})

const concepts = () => [...container.querySelectorAll<HTMLElement>('[data-testid^="dock-waveform-concept-"]')]
const press = async (group: string, label: string) => {
  const button = [...container.querySelectorAll<HTMLButtonElement>(`.llhs-ctl[aria-label="${group}"] button`)].find(item => item.textContent === label)
  if (!button) throw new Error(`Missing control ${group}: ${label}`)
  await act(async () => button.click())
}
const playheads = () => concepts().map(concept => concept.querySelector<HTMLElement>('.llwf-playhead')?.style.left ?? null)

describe('DockWaveformGroupStyleGallery', () => {
  it('shows five waveform concepts, each in a dock card with the dock zoom buttons', () => {
    expect(concepts().map(concept => concept.getAttribute('data-testid'))).toEqual([
      'dock-waveform-concept-rgb-bands',
      'dock-waveform-concept-section-strip',
      'dock-waveform-concept-overview-window',
      'dock-waveform-concept-pulse-ribbon',
      'dock-waveform-concept-led-matrix',
    ])
    for (const concept of concepts()) {
      expect(concept.querySelector('.vz-dock-card.llwf-card')).not.toBeNull()
      expect(concept.querySelectorAll('.vz-dock-zoom-btn')).toHaveLength(2)
      expect(concept.querySelector('.llwf-playhead')).not.toBeNull()
    }
  })

  it('shows what the production waveform carries: cues, bar grid, and the track’s sections', () => {
    const [rgb, sections, overview, , led] = concepts()
    for (const concept of [rgb, sections, overview, led]) expect(concept.querySelectorAll('.llwf-cue').length).toBeGreaterThan(0)
    expect(rgb.querySelectorAll('.llwf-grid-strip i').length).toBeGreaterThan(0)
    expect([...sections.querySelectorAll('.llwf-ribbon-seg b')].map(node => node.textContent)).toContain('Drop')
    expect(sections.querySelectorAll('.llwf-ribbon-seg.is-current')).toHaveLength(1)
    expect(overview.querySelector('.llwf-c3-window')).not.toBeNull()
    expect(led.querySelectorAll('.llwf-c5-bars b').length).toBeGreaterThan(0)
  })

  it('moves the playhead in every concept when one waveform is clicked', async () => {
    const before = playheads()
    const surface = concepts()[0].querySelector<HTMLElement>('.llwf-surface')!
    vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 200, top: 0, height: 100, right: 200, bottom: 100, x: 0, y: 0, toJSON: () => ({}) })
    await act(async () => {
      surface.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 150 }))
    })
    const after = playheads()
    expect(after).not.toEqual(before)
    expect(parseFloat(after[0] ?? '0')).toBeCloseTo(75, 0)
  })

  it('zooms every concept with the control bar and with each card’s own buttons', async () => {
    const width = () => concepts()[0].querySelectorAll('.llwf-c1 svg rect').length
    expect(width()).toBe(220)
    await press('Zoom', '4×')
    const playheadAt = parseFloat(playheads()[0] ?? '0')
    // The window follows the playhead, which sits near the middle once zoomed.
    expect(playheadAt).toBeGreaterThan(40)
    expect(playheadAt).toBeLessThan(60)
    const zoomIn = concepts()[3].querySelector<HTMLButtonElement>('.vz-dock-zoom-btn[aria-label="Zoom in"]')!
    await act(async () => zoomIn.click())
    expect(concepts()[0].querySelector('.llhs-ctl')).toBeNull()
    const pressed = [...container.querySelectorAll<HTMLButtonElement>('.llhs-ctl[aria-label="Zoom"] button.is-on')].map(button => button.textContent)
    expect(pressed).toEqual(['8×'])
  })

  it('shows an empty waveform with a message and no playhead when no track is loaded', async () => {
    await press('Track', 'Empty')
    for (const concept of concepts()) {
      expect(concept.querySelector('.llwf-empty')?.textContent).toContain('Load a track')
      expect(concept.querySelector('.llwf-playhead')).toBeNull()
      expect(concept.querySelector<HTMLButtonElement>('.vz-dock-zoom-btn')?.disabled).toBe(true)
    }
  })
})
