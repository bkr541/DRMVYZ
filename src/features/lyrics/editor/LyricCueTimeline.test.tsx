// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LyricCue } from '../../../types/lyrics'
import { LyricCueTimeline } from './LyricCueTimeline'

const CUES: LyricCue[] = [
  { id: 'cue-1', startMs: 1_000, endMs: 2_000, text: 'First cue' },
  { id: 'cue-2', startMs: 2_500, endMs: 3_500, text: 'Second cue' },
]

let container: HTMLElement
let root: ReturnType<typeof createRoot>

function pointer(type: string, clientX: number, buttons = 1, modifiers: MouseEventInit = {}): Event {
  const event = new MouseEvent(type, { bubbles: true, clientX, buttons, ...modifiers })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  return event
}

async function renderTimeline(overrides: Partial<React.ComponentProps<typeof LyricCueTimeline>> = {}) {
  const props: React.ComponentProps<typeof LyricCueTimeline> = {
    cues: CUES,
    selectedCueId: null,
    currentTimeMs: 1_500,
    durationMs: 5_000,
    zoom: 1,
    snapContext: { mode: 'none' },
    onSelectCue: vi.fn(),
    onSeek: vi.fn(),
    onCommitCue: vi.fn(),
    onDeleteCue: vi.fn(),
    ...overrides,
  }
  await act(async () => { root.render(<LyricCueTimeline {...props} />) })
  const timeline = container.querySelector<HTMLElement>('[data-testid="lyric-cue-timeline"]')!
  timeline.getBoundingClientRect = () => ({
    x: 0, y: 0, top: 0, left: 0, right: 500, bottom: 200,
    width: 500, height: 200, toJSON: () => ({}),
  })
  return { props, timeline }
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => { root.unmount() })
  container.remove()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('LyricCueTimeline', () => {
  it('commits one move with translated word timing at pointer release instead of on every pointer move', async () => {
    const onCommitCue = vi.fn()
    const cueWithWords: LyricCue = {
      ...CUES[0],
      words: [{ id: 'word-1', text: 'First', startMs: 1_100, endMs: 1_500 }],
    }
    const { timeline } = await renderTimeline({ cues: [cueWithWords, CUES[1]], onCommitCue })
    const block = container.querySelector<HTMLElement>('[data-testid="lyric-cue-cue-1"]')!

    await act(async () => {
      block.dispatchEvent(pointer('pointerdown', 100))
      timeline.dispatchEvent(pointer('pointermove', 125))
      timeline.dispatchEvent(pointer('pointermove', 150))
    })
    expect(onCommitCue).not.toHaveBeenCalled()

    await act(async () => { timeline.dispatchEvent(pointer('pointerup', 150, 0)) })
    expect(onCommitCue).toHaveBeenCalledTimes(1)
    expect(onCommitCue).toHaveBeenCalledWith('cue-1', {
      startMs: 1_500,
      endMs: 2_500,
      words: [{ id: 'word-1', text: 'First', startMs: 1_600, endMs: 2_000 }],
    })
  })

  it('resizes start and end handles with integer millisecond precision', async () => {
    const onCommitCue = vi.fn()
    const { timeline } = await renderTimeline({ onCommitCue })
    const block = container.querySelector<HTMLElement>('[data-testid="lyric-cue-cue-1"]')!
    const startHandle = block.querySelector<HTMLElement>('.lyric-cue-handle--start')!
    const endHandle = block.querySelector<HTMLElement>('.lyric-cue-handle--end')!

    await act(async () => {
      startHandle.dispatchEvent(pointer('pointerdown', 100))
      timeline.dispatchEvent(pointer('pointermove', 125))
      timeline.dispatchEvent(pointer('pointerup', 125, 0))
    })
    expect(onCommitCue).toHaveBeenLastCalledWith('cue-1', { startMs: 1_250, endMs: 2_000 })

    await act(async () => {
      endHandle.dispatchEvent(pointer('pointerdown', 200))
      timeline.dispatchEvent(pointer('pointermove', 240))
      timeline.dispatchEvent(pointer('pointerup', 240, 0))
    })
    expect(onCommitCue).toHaveBeenLastCalledWith('cue-1', { startMs: 1_000, endMs: 2_400 })
  })

  it('supports keyboard movement with translated words and keyboard-operable resize handles', async () => {
    const onCommitCue = vi.fn()
    const cueWithWords: LyricCue = {
      ...CUES[0],
      words: [{ id: 'word-1', text: 'First', startMs: 1_100, endMs: 1_500 }],
    }
    await renderTimeline({ cues: [cueWithWords, CUES[1]], onCommitCue })
    const block = container.querySelector<HTMLElement>('[data-testid="lyric-cue-cue-1"]')!
    const startHandle = block.querySelector<HTMLElement>('.lyric-cue-handle--start')!

    await act(async () => {
      block.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    })
    expect(onCommitCue).toHaveBeenLastCalledWith('cue-1', {
      startMs: 1_010,
      endMs: 2_010,
      words: [{ id: 'word-1', text: 'First', startMs: 1_110, endMs: 1_510 }],
    })

    await act(async () => {
      startHandle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true, bubbles: true }))
    })
    expect(onCommitCue).toHaveBeenLastCalledWith('cue-1', { startMs: 900, endMs: 2_000 })
  })

  it('seeks both backward and forward from the timeline background', async () => {
    const onSeek = vi.fn()
    const { timeline } = await renderTimeline({ onSeek })
    await act(async () => { timeline.dispatchEvent(pointer('pointerdown', 50)) })
    await act(async () => { timeline.dispatchEvent(pointer('pointerdown', 325)) })
    expect(onSeek.mock.calls.map(call => call[0])).toEqual([500, 3_250])
  })

  it('exposes selected and active states with non-color semantics', async () => {
    await renderTimeline({ selectedCueId: 'cue-1', currentTimeMs: 1_999 })
    const block = container.querySelector<HTMLElement>('[data-testid="lyric-cue-cue-1"]')!
    expect(block.getAttribute('aria-pressed')).toBe('true')
    expect(block.getAttribute('aria-current')).toBe('time')
    expect(block.textContent).toContain('▶')
  })

  it('double-clicks an empty waveform region to add a cue at shared timeline time', async () => {
    const onAddCueAt = vi.fn()
    const { timeline } = await renderTimeline({ onAddCueAt })
    await act(async () => {
      timeline.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 250 }))
    })
    expect(onAddCueAt).toHaveBeenCalledWith(2_500)
  })

  it('applies snap during drag and allows the shared bypass modifier', async () => {
    const onCommitCue = vi.fn()
    const { timeline } = await renderTimeline({
      onCommitCue,
      snapContext: { mode: 'beat', beatGridMs: [0, 1_000, 2_000, 3_000] },
    })
    const block = container.querySelector<HTMLElement>('[data-testid="lyric-cue-cue-1"]')!

    await act(async () => {
      block.dispatchEvent(pointer('pointerdown', 100))
      timeline.dispatchEvent(pointer('pointermove', 160))
      timeline.dispatchEvent(pointer('pointerup', 160, 0))
    })
    expect(onCommitCue).toHaveBeenLastCalledWith('cue-1', { startMs: 2_000, endMs: 3_000 })

    onCommitCue.mockClear()
    await act(async () => {
      block.dispatchEvent(pointer('pointerdown', 100))
      timeline.dispatchEvent(pointer('pointermove', 160, 1, { ctrlKey: true }))
      timeline.dispatchEvent(pointer('pointerup', 160, 0, { ctrlKey: true }))
    })
    expect(onCommitCue).toHaveBeenLastCalledWith('cue-1', { startMs: 1_600, endMs: 2_600 })
  })

  it('uses deterministic compact lanes for multiple overlapping vocals', async () => {
    const overlapping: LyricCue[] = [
      { id: 'lead', startMs: 500, endMs: 2_500, text: 'Lead' },
      { id: 'double', startMs: 750, endMs: 1_500, text: 'Double', analysisMetadata: { vocalRole: 'double' } },
      { id: 'adlib', startMs: 1_000, endMs: 2_000, text: 'Ad-lib', analysisMetadata: { vocalRole: 'adlib' } },
    ]
    await renderTimeline({ cues: overlapping })
    const tops = overlapping.map(cue => container.querySelector<HTMLElement>(`[data-testid="lyric-cue-${cue.id}"]`)!.style.top)
    expect(tops).toEqual(['108px', '136px', '164px'])
  })

  describe('stacked lyric lanes (Lyric Manager)', () => {
    const stacked = {
      stackedLanes: true,
      maxVisibleLanes: 3,
      showRuler: false,
      showWaveform: false,
      showOverlays: false,
      showWordLane: false,
    }
    const laneLabels = () => [...container.querySelectorAll('.lyric-cue-timeline__lane-label')].map(node => node.textContent)
    const top = (id: string) => container.querySelector<HTMLElement>(`[data-testid="lyric-cue-${id}"]`)!.style.top

    it('always shows two labelled lyric lanes, even when no cues overlap', async () => {
      const { timeline } = await renderTimeline({ ...stacked, cues: CUES })
      expect(laneLabels()).toEqual(['Lyrics 1', 'Lyrics 2'])
      expect(timeline.style.height).toBe('72px')
      // Alternating, non-overlapping cues stay together in the first lane.
      expect(top('cue-1')).toBe('4px')
      expect(top('cue-2')).toBe('4px')
    })

    it('places an overlapping cue in the second lane without changing any cue timing', async () => {
      const overlapping: LyricCue[] = [
        { id: 'lead', startMs: 500, endMs: 2_500, text: 'Lead' },
        { id: 'echo', startMs: 1_000, endMs: 3_000, text: 'Echo' },
        { id: 'next', startMs: 2_600, endMs: 4_000, text: 'Next' },
      ]
      const before = JSON.stringify(overlapping)
      const { props } = await renderTimeline({ ...stacked, cues: overlapping })

      expect(top('lead')).toBe('4px')
      expect(top('echo')).toBe('40px')
      // `next` starts after `lead` ends, so it returns to lane 1.
      expect(top('next')).toBe('4px')
      expect(JSON.stringify(overlapping)).toBe(before)
      expect(props.onCommitCue).not.toHaveBeenCalled()
    })

    it('grows a third lane only when cues overlap three deep', async () => {
      const threeDeep: LyricCue[] = [
        { id: 'a', startMs: 500, endMs: 3_000, text: 'A' },
        { id: 'b', startMs: 1_000, endMs: 3_000, text: 'B' },
        { id: 'c', startMs: 1_500, endMs: 3_000, text: 'C' },
      ]
      const { timeline } = await renderTimeline({ ...stacked, cues: threeDeep })
      expect(laneLabels()).toEqual(['Lyrics 1', 'Lyrics 2', 'Lyrics 3'])
      expect(timeline.style.height).toBe('108px')
      expect(top('c')).toBe('76px')
    })

    it('drags a cue in the second lane by changing only its timing', async () => {
      const overlapping: LyricCue[] = [
        { id: 'lead', startMs: 500, endMs: 2_500, text: 'Lead' },
        { id: 'echo', startMs: 1_000, endMs: 3_000, text: 'Echo' },
      ]
      const { props } = await renderTimeline({ ...stacked, cues: overlapping })
      const echo = container.querySelector<HTMLElement>('[data-testid="lyric-cue-echo"]')!
      await act(async () => { echo.dispatchEvent(pointer('pointerdown', 150)) })
      await act(async () => { echo.dispatchEvent(pointer('pointermove', 200)) })
      await act(async () => { echo.dispatchEvent(pointer('pointerup', 200, 0)) })

      expect(props.onCommitCue).toHaveBeenCalledTimes(1)
      const [id, patch] = vi.mocked(props.onCommitCue).mock.calls[0]
      expect(id).toBe('echo')
      expect(Object.keys(patch).sort()).toEqual(['endMs', 'startMs'])
    })
  })

  it('shows warning, confidence, inactive, and playback states without color alone', async () => {
    const stateCues: LyricCue[] = [
      { id: 'warning', startMs: 1_000, endMs: 2_000, text: 'Warning', confidence: 0.4 },
      { id: 'overlap', startMs: 1_500, endMs: 2_500, text: 'Overlap' },
    ]
    await renderTimeline({
      cues: stateCues,
      selectedCueId: 'warning',
      currentTimeMs: 1_750,
      inactiveCueIds: new Set(['overlap']),
    })
    const warning = container.querySelector<HTMLElement>('[data-testid="lyric-cue-warning"]')!
    const overlap = container.querySelector<HTMLElement>('[data-testid="lyric-cue-overlap"]')!
    expect(warning.className).toContain('lyric-cue-block--low-confidence')
    expect(warning.className).toContain('lyric-cue-block--warning')
    expect(warning.getAttribute('aria-current')).toBe('time')
    expect(warning.getAttribute('aria-label')).toContain('low confidence')
    expect(overlap.className).toContain('lyric-cue-block--inactive')
  })

  it('edits selected word boundaries visually and prevents invalid crossing', async () => {
    const onCommitWords = vi.fn()
    const cueWithWords: LyricCue = {
      id: 'words', startMs: 1_000, endMs: 3_000, text: 'stay right here',
      words: [
        { id: 'stay', text: 'stay', startMs: 1_000, endMs: 2_000 },
        { id: 'right', text: 'right', startMs: 2_000, endMs: 2_500 },
        { id: 'here', text: 'here', startMs: 2_500, endMs: 3_000 },
      ],
    }
    const { timeline } = await renderTimeline({ cues: [cueWithWords], selectedCueId: 'words', onCommitWords })
    const word = container.querySelector<HTMLElement>('[data-testid="lyric-word-right"]')!
    const startHandle = word.querySelector<HTMLElement>('.lyric-word-handle--start')!

    await act(async () => {
      startHandle.dispatchEvent(pointer('pointerdown', 200))
      timeline.dispatchEvent(pointer('pointermove', 225))
      timeline.dispatchEvent(pointer('pointerup', 225, 0))
    })
    expect(onCommitWords).toHaveBeenCalledWith('words', expect.arrayContaining([
      expect.objectContaining({ id: 'right', text: 'right', startMs: 2_250, endMs: 2_500 }),
    ]))

    onCommitWords.mockClear()
    await act(async () => {
      startHandle.dispatchEvent(pointer('pointerdown', 200))
      timeline.dispatchEvent(pointer('pointermove', 0))
      timeline.dispatchEvent(pointer('pointerup', 0, 0))
    })
    expect(onCommitWords).not.toHaveBeenCalled()
  })

  it('opens existing right-click actions at the authored pointer time', async () => {
    const onCueContextAction = vi.fn()
    await renderTimeline({ onCueContextAction })
    const block = container.querySelector<HTMLElement>('[data-testid="lyric-cue-cue-1"]')!
    await act(async () => {
      block.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 150, clientY: 40 }))
    })
    const review = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
      .find(button => button.textContent === 'Mark reviewed')!
    await act(async () => { review.click() })
    expect(onCueContextAction).toHaveBeenCalledWith('cue-1', 'mark-reviewed', 1_500)
  })
})
