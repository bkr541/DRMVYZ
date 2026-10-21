// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

/**
 * Keyboard and screen-reader access to the lyric cue timeline: the cue actions menu (Menu key / Shift+F10, arrow keys, Escape,
 * disabled actions), Ctrl/Cmd+Y redo, and the notices and announcements that report what a cue edit did.
 */

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LyricCue } from '../../../types/lyrics'

vi.mock('../../../components/vyzualz/hooks/useWaveformPeaks', () => ({
  useWaveformPeaks: () => ({ peaks: [0.1, 0.4], loading: false, error: null }),
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
import { useNotificationStore } from '../../../stores/notificationStore'
import { useVisualStore } from '../../../stores/visualStore'
import { LyricCueTimeline } from '../editor/LyricCueTimeline'
import { useLyricCueEditor } from '../editor/useLyricCueEditor'
import { useLyricAnnouncementStore } from '../editor/lyricNotices'
import { handleLyricUndoRedoKey, LyricCueStackedTimeline } from './LyricCuesWindow'
import { LyricLiveAnnouncer } from './LyricLiveAnnouncer'

const CUES: LyricCue[] = [
  { id: 'cue-1', startMs: 1_000, endMs: 2_000, text: 'First cue' },
  { id: 'cue-2', startMs: 2_500, endMs: 3_500, text: 'Second cue' },
  { id: 'cue-3', startMs: 4_000, endMs: 4_800, text: 'Third cue' },
]

let container: HTMLElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1 })
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null)
  useVisualStore.setState({ waveformZoom: 1 })
  useNotificationStore.setState({ events: { ...useNotificationStore.getState().events, 'lyric-manager': [] } })
  useLyricAnnouncementStore.setState({ message: '', sequence: 0 })
  useLyricsStore.getState().clearLyrics()
  useLyricsStore.setState({ cues: CUES, selectedCueId: 'cue-1', cueHistoryPast: [], cueHistoryFuture: [] })
})

afterEach(async () => {
  await act(async () => { root.unmount() })
  container.remove()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const block = (id: string) => container.querySelector<HTMLElement>(`[data-testid="lyric-cue-${id}"]`)!
const menu = () => container.querySelector<HTMLElement>('[role="menu"]')
const items = () => [...container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
const key = (element: Element, init: KeyboardEventInit) =>
  act(async () => { element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })) })

async function renderTimeline(overrides: Partial<React.ComponentProps<typeof LyricCueTimeline>> = {}) {
  const onCueContextAction = vi.fn()
  await act(async () => {
    root.render(
      <LyricCueTimeline
        cues={CUES}
        selectedCueId="cue-2"
        currentTimeMs={1_500}
        durationMs={5_000}
        zoom={1}
        snapContext={{ mode: 'none' }}
        onSelectCue={vi.fn()}
        onSeek={vi.fn()}
        onCommitCue={vi.fn()}
        onDeleteCue={vi.fn()}
        onCueContextAction={onCueContextAction}
        {...overrides}
      />,
    )
  })
  return { onCueContextAction }
}

describe('cue actions menu from the keyboard', () => {
  it.each([
    ['the Menu key', { key: 'ContextMenu' }],
    ['Shift+F10', { key: 'F10', shiftKey: true }],
  ])('opens on a focused cue with %s and puts focus on the first action', async (_label, init) => {
    await renderTimeline()
    expect(menu()).toBeNull()
    const cue = block('cue-2')
    cue.focus()
    await key(cue, init)

    expect(menu()).not.toBeNull()
    expect(menu()!.getAttribute('aria-label')).toBe('Lyric cue actions')
    expect(items().map(item => item.textContent)).toEqual([
      'Split here', 'Merge previous', 'Merge next', 'Duplicate', 'Mark reviewed', 'Delete',
    ])
    expect(document.activeElement).toBe(items()[0])
  })

  it('moves between actions with the arrow keys, Home and End, wrapping at both ends', async () => {
    await renderTimeline()
    await key(block('cue-2'), { key: 'ContextMenu' })
    const labels = () => (document.activeElement as HTMLElement).textContent
    expect(labels()).toBe('Split here')
    await key(menu()!, { key: 'ArrowDown' })
    expect(labels()).toBe('Merge previous')
    await key(menu()!, { key: 'End' })
    expect(labels()).toBe('Delete')
    await key(menu()!, { key: 'ArrowDown' })
    expect(labels()).toBe('Split here')
    await key(menu()!, { key: 'ArrowUp' })
    expect(labels()).toBe('Delete')
    await key(menu()!, { key: 'Home' })
    expect(labels()).toBe('Split here')
  })

  it('closes on Escape and returns focus to the cue it was opened from', async () => {
    await renderTimeline()
    const cue = block('cue-2')
    cue.focus()
    await key(cue, { key: 'ContextMenu' })
    await key(menu()!, { key: 'Escape' })
    expect(menu()).toBeNull()
    expect(document.activeElement).toBe(cue)
  })

  it('closes on Tab instead of trapping focus, and returns it to the cue', async () => {
    await renderTimeline()
    const cue = block('cue-2')
    cue.focus()
    await key(cue, { key: 'ContextMenu' })
    await key(menu()!, { key: 'Tab' })
    expect(menu()).toBeNull()
    expect(document.activeElement).toBe(cue)
  })

  it('runs the chosen action with the cue and closes the menu', async () => {
    const { onCueContextAction } = await renderTimeline()
    await key(block('cue-2'), { key: 'ContextMenu' })
    await act(async () => { items().find(item => item.textContent === 'Duplicate')!.click() })
    expect(onCueContextAction).toHaveBeenCalledWith('cue-2', 'duplicate', expect.any(Number))
    expect(menu()).toBeNull()
  })

  it('splits at the playhead when it is inside the cue', async () => {
    const { onCueContextAction } = await renderTimeline({ currentTimeMs: 3_000 })
    await key(block('cue-2'), { key: 'ContextMenu' })
    await act(async () => { items()[0]!.click() })
    expect(onCueContextAction).toHaveBeenCalledWith('cue-2', 'split', 3_000)
  })

  it('splits at the middle of the cue when the playhead is outside it', async () => {
    const { onCueContextAction } = await renderTimeline({ currentTimeMs: 1_500 })
    await key(block('cue-2'), { key: 'ContextMenu' })
    await act(async () => { items()[0]!.click() })
    expect(onCueContextAction).toHaveBeenCalledWith('cue-2', 'split', 3_000)
  })

  it('disables Merge previous on the first cue and Merge next on the last, and the arrow keys skip them', async () => {
    await renderTimeline({ selectedCueId: 'cue-1' })
    await key(block('cue-1'), { key: 'ContextMenu' })
    const previous = items().find(item => item.textContent === 'Merge previous')!
    expect(previous.disabled).toBe(true)
    expect(previous.getAttribute('aria-disabled')).toBe('true')
    expect(items().find(item => item.textContent === 'Merge next')!.disabled).toBe(false)
    await key(menu()!, { key: 'ArrowDown' })
    expect((document.activeElement as HTMLElement).textContent).toBe('Merge next')
    await key(menu()!, { key: 'Escape' })

    await key(block('cue-3'), { key: 'ContextMenu' })
    expect(items().find(item => item.textContent === 'Merge next')!.disabled).toBe(true)
    expect(items().find(item => item.textContent === 'Merge previous')!.disabled).toBe(false)
  })

  it('does nothing when the timeline has no cue actions to offer', async () => {
    await renderTimeline({ onCueContextAction: undefined })
    await key(block('cue-2'), { key: 'ContextMenu' })
    expect(menu()).toBeNull()
  })
})

describe('undo and redo shortcuts', () => {
  const editor = () => ({ undoCueEdit: vi.fn(), redoCueEdit: vi.fn() })
  const press = (init: KeyboardEventInit, target?: EventTarget) => {
    const event = new KeyboardEvent('keydown', { cancelable: true, ...init })
    if (target) Object.defineProperty(event, 'target', { value: target })
    return event as unknown as React.KeyboardEvent
  }

  it('undoes on Ctrl/Cmd+Z and redoes on Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y', () => {
    const target = editor()
    handleLyricUndoRedoKey(press({ key: 'z', ctrlKey: true }), target)
    handleLyricUndoRedoKey(press({ key: 'z', metaKey: true, shiftKey: true }), target)
    handleLyricUndoRedoKey(press({ key: 'y', ctrlKey: true }), target)
    handleLyricUndoRedoKey(press({ key: 'Y', metaKey: true }), target)
    expect(target.undoCueEdit).toHaveBeenCalledTimes(1)
    expect(target.redoCueEdit).toHaveBeenCalledTimes(3)
  })

  it('leaves Ctrl+Shift+Y, Alt combinations, plain keys and typing in a field alone', () => {
    const target = editor()
    const input = document.createElement('input')
    handleLyricUndoRedoKey(press({ key: 'y', ctrlKey: true, shiftKey: true }), target)
    handleLyricUndoRedoKey(press({ key: 'y', ctrlKey: true, altKey: true }), target)
    handleLyricUndoRedoKey(press({ key: 'y' }), target)
    handleLyricUndoRedoKey(press({ key: 'y', ctrlKey: true }, input), target)
    handleLyricUndoRedoKey(press({ key: 'z', ctrlKey: true }, input), target)
    expect(target.undoCueEdit).not.toHaveBeenCalled()
    expect(target.redoCueEdit).not.toHaveBeenCalled()
  })
})

describe('cue edit notices and announcements', () => {
  let current: ReturnType<typeof useLyricCueEditor> | null = null

  function Harness() {
    const editor = useLyricCueEditor({ trackId: 'track-1', trackUrl: null, decodedBuffer: null, durationMs: 5_000, currentTimeMs: 3_000 })
    current = editor
    return (
      <>
        <LyricCueStackedTimeline editor={editor} durationMs={5_000} currentTimeMs={3_000} onSeek={() => undefined} />
        <LyricLiveAnnouncer />
      </>
    )
  }

  const cards = () => useNotificationStore.getState().events['lyric-manager']
  const announced = () => container.querySelector('[data-testid="lyric-live-announcer"]')!.textContent!.replace(/​/g, '')

  it('reports a split as one notice card and reads it out', async () => {
    await act(async () => { root.render(<Harness />) })
    await act(async () => { current!.handleCueContextAction('cue-2', 'split', 3_000) })

    expect(cards()).toHaveLength(1)
    expect(cards()[0]).toMatchObject({ tone: 'success', title: 'Cue edited', message: 'Cue 2 split into cues 2 and 3' })
    expect(announced()).toBe('Cue edited. Cue 2 split into cues 2 and 3')
    expect(useLyricsStore.getState().cues).toHaveLength(4)
  })

  it('keeps only the latest cue-edit card rather than filling the drawer', async () => {
    await act(async () => { root.render(<Harness />) })
    await act(async () => { current!.handleCueContextAction('cue-1', 'mark-reviewed', 0) })
    await act(async () => { current!.handleCueContextAction('cue-3', 'duplicate', 0) })
    await act(async () => { current!.handleCueContextAction('cue-2', 'delete', 0) })

    expect(cards().map(card => card.message)).toEqual(['Cue 2 deleted'])
  })

  it('says so, as a warning, when an edit cannot happen', async () => {
    await act(async () => { root.render(<Harness />) })
    await act(async () => { current!.handleCueContextAction('cue-1', 'merge-previous', 0) })
    expect(cards()[0]).toMatchObject({ tone: 'warning', title: 'Cue edit not applied', message: 'Cue 1 has no previous cue to merge with' })

    await act(async () => { current!.handleCueContextAction('cue-2', 'split', 100) })
    expect(cards()[0]!.tone).toBe('warning')
    expect(cards()[0]!.message).toContain('Cue 2 was not split')
    expect(useLyricsStore.getState().cues).toHaveLength(3)
  })

  it('reports undo and redo, including when there is nothing to undo or redo', async () => {
    await act(async () => { root.render(<Harness />) })
    await act(async () => { current!.undoCueEdit() })
    expect(cards()[0]).toMatchObject({ tone: 'warning', message: 'Nothing to undo' })

    await act(async () => { current!.handleCueContextAction('cue-2', 'delete', 0) })
    await act(async () => { current!.undoCueEdit() })
    expect(cards()[0]).toMatchObject({ tone: 'success', message: 'Undid the last cue edit' })
    expect(useLyricsStore.getState().cues).toHaveLength(3)

    await act(async () => { current!.redoCueEdit() })
    expect(cards()[0]!.message).toBe('Redid the cue edit')
    await act(async () => { current!.redoCueEdit() })
    expect(cards()[0]).toMatchObject({ tone: 'warning', message: 'Nothing to redo' })
  })

  it('announces the same sentence again when it repeats', async () => {
    await act(async () => { root.render(<Harness />) })
    await act(async () => { current!.undoCueEdit() })
    const first = container.querySelector('[data-testid="lyric-live-announcer"]')!.textContent
    await act(async () => { current!.undoCueEdit() })
    const second = container.querySelector('[data-testid="lyric-live-announcer"]')!.textContent
    expect(announced()).toBe('Cue edit not applied. Nothing to undo')
    expect(second).not.toBe(first)
  })

  it('has a polite status live region', async () => {
    await act(async () => { root.render(<Harness />) })
    const region = container.querySelector('[data-testid="lyric-live-announcer"]')!
    expect(region.getAttribute('role')).toBe('status')
    expect(region.getAttribute('aria-live')).toBe('polite')
    expect(region.classList.contains('sr-only')).toBe(true)
  })
})
