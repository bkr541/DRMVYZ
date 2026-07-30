// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LyricCue } from '../../../types/lyrics'

vi.mock('../../../components/vyzualz/hooks/useWaveformPeaks', () => ({
  useWaveformPeaks: () => ({ peaks: [0.1, 0.4, 0.8, 0.2], loading: false, error: null }),
}))
vi.mock('../../../lib/supabase', () => ({ supabaseConfigured: false, supabase: null }))
vi.mock('../../../lib/lyricsDb', () => ({
  activateLyricDocument: vi.fn(),
  getLyricDocumentById: vi.fn(),
  getLyricCuesForDocument: vi.fn(),
  getActiveLyricDocumentForAudioTrack: vi.fn(),
  getActiveLyricDocumentForVisualSession: vi.fn(),
  saveLyricDocumentAtomic: vi.fn(),
}))

import { useLyricsStore } from '../../../stores/lyricsStore'
import { useVisualStore } from '../../../stores/visualStore'
import { LyricCueEditor } from './LyricCueEditor'

const CUES: LyricCue[] = [
  { id: 'cue-1', startMs: 0, endMs: 1_000, text: 'First', confidence: 0.95, reviewStatus: 'reviewed' },
  { id: 'cue-2', startMs: 1_000, endMs: 2_000, text: 'Second', confidence: 0.4, reviewStatus: 'unreviewed' },
]

let container: HTMLElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1 })
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null)
  useVisualStore.setState({ waveformZoom: 1 })
  useLyricsStore.getState().clearLyrics()
  useLyricsStore.setState({
    cues: CUES,
    selectedCueId: 'cue-1',
    cueHistoryPast: [],
    cueHistoryFuture: [],
  })
})

afterEach(async () => {
  await act(async () => { root.unmount() })
  container.remove()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function renderEditor(overrides: Partial<React.ComponentProps<typeof LyricCueEditor>> = {}) {
  await act(async () => {
    root.render(
      <LyricCueEditor
        trackId="track-1"
        trackUrl={null}
        decodedBuffer={null}
        durationMs={5_000}
        currentTimeMs={500}
        onSeek={vi.fn()}
        beatGridMs={[0, 500, 1_000]}
        {...overrides}
      />,
    )
  })
}

describe('LyricCueEditor selection synchronization', () => {
  it('keeps timeline selection and cue-list selection synchronized both ways', async () => {
    await renderEditor()
    const firstRow = container.querySelector<HTMLElement>('[data-cue-row-id="cue-1"]')!
    const secondRow = container.querySelector<HTMLElement>('[data-cue-row-id="cue-2"]')!
    const firstBlock = container.querySelector<HTMLElement>('[data-testid="lyric-cue-cue-1"]')!
    const secondBlock = container.querySelector<HTMLElement>('[data-testid="lyric-cue-cue-2"]')!

    expect(firstRow.getAttribute('aria-selected')).toBe('true')
    expect(firstBlock.getAttribute('aria-pressed')).toBe('true')

    await act(async () => { secondBlock.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(useLyricsStore.getState().selectedCueId).toBe('cue-2')
    expect(secondRow.getAttribute('aria-selected')).toBe('true')

    await act(async () => { firstRow.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(useLyricsStore.getState().selectedCueId).toBe('cue-1')
    expect(firstBlock.getAttribute('aria-pressed')).toBe('true')
  })

  it('uses the shared Audio Dock waveform zoom state', async () => {
    useVisualStore.getState().setWaveformZoom(4)
    await renderEditor()
    const zoom = container.querySelector<HTMLInputElement>('input[aria-label="Shared waveform zoom"]')!
    expect(zoom.value).toBe('4')

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      valueSetter?.call(zoom, '8')
      zoom.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(useVisualStore.getState().waveformZoom).toBe(8)
  })

  it('offers an actionable analysis recovery and navigates to a validation target', async () => {
    const analyze = vi.fn()
    useLyricsStore.setState({
      cues: [
        CUES[0],
        { ...CUES[1], words: [{ id: 'word-2', text: 'Second', startMs: 1_000, endMs: 2_000 }] },
      ],
      selectedCueId: 'cue-1',
    })
    await renderEditor({
      beatGridMs: [],
      beatGridStatus: 'temporary',
      beatGridStatusMessage: 'Temporary grid in use.',
      onAnalyzeTrack: analyze,
      analysisActionLabel: 'Analyze Track',
      navigationTarget: { cueId: 'cue-2', wordId: 'word-2', revision: 1 },
    })

    const analyzeButton = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find(button => button.textContent === 'Analyze Track')
    expect(analyzeButton).toBeTruthy()
    await act(async () => analyzeButton?.click())
    expect(analyze).toHaveBeenCalledOnce()
    expect(useLyricsStore.getState().selectedCueId).toBe('cue-2')
    expect(container.querySelector('[data-word-id="word-2"]')?.className).toContain('lyric-word-editor__row--focused')
  })

  it('filters low-confidence and warning rows without changing canonical cues', async () => {
    await renderEditor()
    const filter = container.querySelector<HTMLButtonElement>('.lyric-cue-list__controls [role="combobox"]')!
    await act(async () => filter.click())
    const lowConfidence = [...document.body.querySelectorAll<HTMLElement>('[role="option"]')]
      .find(option => option.textContent?.trim() === 'Low confidence')!
    await act(async () => lowConfidence.click())
    expect(container.querySelector('[data-cue-row-id="cue-1"]')).toBeNull()
    expect(container.querySelector('[data-cue-row-id="cue-2"]')).not.toBeNull()
    expect(useLyricsStore.getState().cues).toHaveLength(2)
  })
})
