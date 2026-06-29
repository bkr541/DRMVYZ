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

function pointer(type: string, clientX: number, buttons = 1): Event {
  const event = new MouseEvent(type, { bubbles: true, clientX, buttons })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  return event
}

async function renderTimeline(overrides: Partial<React.ComponentProps<typeof LyricCueTimeline>> = {}) {
  const props: React.ComponentProps<typeof LyricCueTimeline> = {
    cues: CUES,
    selectedCueId: null,
    currentTimeMs: 1_500,
    durationMs: 5_000,
    pxPerSecond: 100,
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
    x: 0, y: 0, top: 0, left: 0, right: 500, bottom: 132,
    width: 500, height: 132, toJSON: () => ({}),
  })
  return { props, timeline }
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => { root.unmount() })
  container.remove()
})

describe('LyricCueTimeline', () => {
  it('commits one move at pointer release instead of on every pointer move', async () => {
    const onCommitCue = vi.fn()
    const { timeline } = await renderTimeline({ onCommitCue })
    const block = container.querySelector<HTMLElement>('[data-testid="lyric-cue-cue-1"]')!

    await act(async () => {
      block.dispatchEvent(pointer('pointerdown', 100))
      timeline.dispatchEvent(pointer('pointermove', 125))
      timeline.dispatchEvent(pointer('pointermove', 150))
    })
    expect(onCommitCue).not.toHaveBeenCalled()

    await act(async () => { timeline.dispatchEvent(pointer('pointerup', 150, 0)) })
    expect(onCommitCue).toHaveBeenCalledTimes(1)
    expect(onCommitCue).toHaveBeenCalledWith('cue-1', { startMs: 1_500, endMs: 2_500 })
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

  it('supports keyboard movement and keyboard-operable handles', async () => {
    const onCommitCue = vi.fn()
    await renderTimeline({ onCommitCue })
    const block = container.querySelector<HTMLElement>('[data-testid="lyric-cue-cue-1"]')!
    const startHandle = block.querySelector<HTMLElement>('.lyric-cue-handle--start')!

    await act(async () => {
      block.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    })
    expect(onCommitCue).toHaveBeenLastCalledWith('cue-1', { startMs: 1_010, endMs: 2_010 })

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
})
