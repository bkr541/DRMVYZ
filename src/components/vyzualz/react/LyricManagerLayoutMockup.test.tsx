// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LyricManagerLayoutMockup } from './LyricManagerLayoutMockup'
import {
  LYRIC_MANAGER_LAYOUT_CUE_FIXTURES,
  LYRIC_MANAGER_LAYOUT_DOCUMENT_FIXTURES,
  LYRIC_MANAGER_LAYOUT_TRACK_FIXTURES,
  createLyricManagerLayoutTimelineFixture,
} from './LyricManagerLayoutMockup.fixtures'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

function buttonWithText(scope: ParentNode, text: string): HTMLButtonElement {
  const buttons = [...scope.querySelectorAll('button')]
  const button = buttons.find(candidate => candidate.textContent?.trim() === text)
    ?? buttons.find(candidate => candidate.textContent?.includes(text))
  if (!button) throw new Error(`Button not found: ${text}`)
  return button as HTMLButtonElement
}

async function click(element: Element) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

async function setRangeValue(element: HTMLInputElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe('LyricManagerLayoutMockup', () => {
  it('ships reusable fixture data for tracks, versions, and later-stage cue work', () => {
    expect(LYRIC_MANAGER_LAYOUT_TRACK_FIXTURES).toHaveLength(4)
    expect(LYRIC_MANAGER_LAYOUT_DOCUMENT_FIXTURES['track-pop']).toHaveLength(3)
    expect(LYRIC_MANAGER_LAYOUT_DOCUMENT_FIXTURES['track-neon-static']).toHaveLength(0)
    expect(LYRIC_MANAGER_LAYOUT_CUE_FIXTURES['pop-live'].length).toBeGreaterThan(0)
  })

  it('builds deterministic Track Timeline fixture analysis for the shared canvas renderer', () => {
    const timeline = createLyricManagerLayoutTimelineFixture(LYRIC_MANAGER_LAYOUT_TRACK_FIXTURES[0]!)

    expect(timeline.durationSec).toBe(198)
    expect(timeline.meta.bpm).toBe(142)
    expect(timeline.sections.map(section => section.label)).toEqual([
      'Intro', 'Verse', 'Build', 'Drop', 'Breakdown', 'Verse', 'Build', 'Drop', 'Outro',
    ])
    expect(timeline.beats.length).toBeGreaterThan(400)
    expect(timeline.beats.some(beat => beat.isDownbeat)).toBe(true)
    expect(timeline.waveform.length).toBeGreaterThan(400)
  })

  it('renders the Stage 1 Track Workspace in the Media Manager shell while center and right remain empty', async () => {
    await act(async () => root.render(<LyricManagerLayoutMockup />))

    expect(container.querySelector('.mmv-root')).not.toBeNull()
    expect(container.querySelector('.mmv-workspace .vz-content.mmv-content')).not.toBeNull()
    expect(container.querySelector('.mmv-stage-area')?.textContent?.trim()).toBe('')

    expect(container.querySelector('.lmv-header')).not.toBeNull()
    expect(container.querySelector('.mmv-header')).toBeNull()
    expect(container.querySelector('.lmv-header-title')?.textContent).toBe('LYRIC MANAGER')

    const right = container.querySelector('.lmv-header-right')!
    expect(right.querySelector('.lmv-toggle-row')?.textContent).toContain('Show Lyrics')
    const chips = [...right.querySelectorAll('.dv-icon-chip')].map(c => c.textContent?.trim())
    expect(chips).toEqual(['Save', 'Save + Make Active'])
    expect(right.querySelector('.vsm-settings-btn')).not.toBeNull()

    const rails = container.querySelectorAll('.vz-content .vz-inspector')
    expect(rails).toHaveLength(2)
    expect(rails[0].textContent).toContain('Track Workspace')
    expect(rails[1].querySelector('.vz-inspector-inner')?.textContent?.trim()).toBe('')

    const tabs = [...rails[0].querySelectorAll('[role="tab"]')]
    expect(tabs.map(tab => tab.textContent?.trim())).toEqual(['Tracks', 'Import', 'AI Extract'])
    expect(rails[0].textContent).toContain('Track Library')
    expect(rails[0].querySelectorAll('.vz-track-row')).toHaveLength(4)
    expect(rails[0].textContent).not.toContain('Lyric Management')
  })

  it('selects tracks without load controls and preserves Lyric Management while upper tabs change', async () => {
    await act(async () => root.render(<LyricManagerLayoutMockup />))

    const firstTrack = container.querySelector('.vz-track-row') as HTMLElement
    expect(firstTrack.getAttribute('role')).toBe('button')
    expect(firstTrack.getAttribute('aria-pressed')).toBe('false')
    expect(firstTrack.querySelector('.vz-track-action-btn')).toBeNull()

    await click(firstTrack)

    expect(firstTrack.getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector('.lmv-mockup-left-shell')?.getAttribute('data-has-selected-track')).toBe('true')
    expect(container.textContent).toContain('Lyric Management')
    expect(container.textContent).toContain('Lyric Versions')
    expect(container.querySelectorAll('.lmv-doc-card')).toHaveLength(3)

    await click(buttonWithText(container, 'Import'))
    expect(buttonWithText(container, 'Import').getAttribute('aria-selected')).toBe('true')
    expect(container.textContent).toContain('Lyric Management')
    expect(container.querySelectorAll('.lmv-doc-card')).toHaveLength(3)

    await click(buttonWithText(container, 'AI Extract'))
    expect(buttonWithText(container, 'AI Extract').getAttribute('aria-selected')).toBe('true')
    expect(container.textContent).toContain('Lyric Management')
  })

  it('renders selected track identity and drives the injected real lyric renderer from local fixture time', async () => {
    await act(async () => root.render(<LyricManagerLayoutMockup />))
    await click(container.querySelector('.vz-track-row')!)

    const identity = container.querySelector('.lmv-mockup-track-identity')!
    expect(identity.textContent).toContain('POP')
    expect(identity.textContent).toContain('DVYDRM')
    expect(identity.textContent).toContain('142 BPM')
    expect(identity.textContent).toContain('E Minor')
    expect(identity.textContent).toContain('Hybrid Trap')
    expect(identity.textContent).toContain('3:18')

    const surface = container.querySelector('.lmv-lyric-renderer-surface')!
    expect(surface.getAttribute('data-document-id')).toBe('pop-live')
    expect(surface.getAttribute('data-active-cue-id')).toBe('')

    const scrubber = container.querySelector('[aria-label="Scrub fixture lyric preview"]') as HTMLInputElement
    await setRangeValue(scrubber, '18.5')
    expect(surface.getAttribute('data-active-cue-id')).toBe('pop-live-1')
    expect(surface.textContent).toContain('I can feel it building')

    await setRangeValue(scrubber, '21.2')
    expect(surface.getAttribute('data-active-cue-id')).toBe('pop-live-2')
    expect(surface.textContent).toContain('Right before we pop')

    await click(buttonWithText(container, 'AI Transcription'))
    expect(surface.getAttribute('data-document-id')).toBe('pop-transcription')
    expect(surface.getAttribute('data-active-cue-id')).toBe('pop-ai-2')

    await click(container.querySelector('[aria-label="Show Lyrics"]')!)
    expect(surface.getAttribute('data-active-cue-id')).toBe('')
    expect(surface.textContent?.trim()).toBe('')
  })

  it('renders four synchronized Track Timeline rows and seeks the same local preview clock', async () => {
    await act(async () => root.render(<LyricManagerLayoutMockup />))
    await click(container.querySelector('.vz-track-row')!)

    const timeline = container.querySelector('[aria-label="Track Timeline"]')!
    expect(timeline.getAttribute('data-viewport-start')).toBe('0')
    expect(timeline.getAttribute('data-viewport-end')).toBe('198')

    const rows = [...timeline.querySelectorAll('[data-timeline-row]')]
    expect(rows.map(row => row.getAttribute('data-timeline-row'))).toEqual([
      'Track Section', 'Waveform', 'Beat Grid', 'Timing',
    ])
    expect(rows.map(row => row.querySelector('canvas')?.getAttribute('data-canvas-kind'))).toEqual([
      'sections', 'waveform', 'beatGrid', 'timeRuler',
    ])
    expect([...timeline.querySelectorAll('.lmv-mockup-timeline-plot')].every(plot => (
      plot.getAttribute('data-viewport-start') === '0' && plot.getAttribute('data-viewport-end') === '198'
    ))).toBe(true)

    const firstPlot = timeline.querySelector('.lmv-mockup-timeline-plot') as HTMLDivElement
    firstPlot.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      right: 1000,
      bottom: 44,
      width: 1000,
      height: 44,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect)

    await act(async () => {
      firstPlot.dispatchEvent(new MouseEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: 500,
      }))
    })

    const scrubber = container.querySelector('[aria-label="Scrub fixture lyric preview"]') as HTMLInputElement
    expect(Number(scrubber.value)).toBeCloseTo(99, 4)
    expect(timeline.getAttribute('aria-valuenow')).toBe('99000')
    expect([...timeline.querySelectorAll<HTMLElement>('.lmv-mockup-timeline-playhead')]
      .every(playhead => playhead.style.left === '50%')).toBe(true)
  })

  it('opens one version action area and keeps active state separate until Make Active is chosen', async () => {
    await act(async () => root.render(<LyricManagerLayoutMockup />))
    await click(container.querySelector('.vz-track-row')!)

    const initialOpen = container.querySelector('.lmv-doc-card--open')!
    expect(initialOpen.textContent).toContain('Festival Live')
    expect(initialOpen.textContent).toContain('Open')
    expect(initialOpen.textContent).toContain('Active')
    expect(container.querySelectorAll('.lmv-doc-actions')).toHaveLength(1)

    await click(buttonWithText(container, 'AI Transcription'))

    const openAi = container.querySelector('.lmv-doc-card--open')!
    expect(openAi.textContent).toContain('AI Transcription')
    expect(openAi.textContent).toContain('Open')
    expect(openAi.textContent).not.toContain('Active')
    expect(container.querySelectorAll('.lmv-doc-actions')).toHaveLength(1)
    expect(buttonWithText(openAi, 'Make Active')).not.toBeNull()

    await click(buttonWithText(openAi, 'Make Active'))
    expect(container.querySelector('.lmv-doc-card--open')?.textContent).toContain('Active')

    const openAfterActivation = container.querySelector('.lmv-doc-card--open')!
    await click(buttonWithText(openAfterActivation, 'Duplicate'))
    expect(container.querySelectorAll('.lmv-doc-card')).toHaveLength(4)
    expect(container.querySelector('.lmv-doc-card--open')?.textContent).toContain('AI Transcription Copy')

    await click(buttonWithText(container.querySelector('.lmv-doc-card--open')!, 'Delete'))
    expect(container.querySelectorAll('.lmv-doc-card')).toHaveLength(3)
  })
})
