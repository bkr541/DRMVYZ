// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LyricCue } from '../../../types/lyrics'
import type { LyricSnapMode } from '../editor/lyricCueEditorModel'
import { LyricCuesWindow } from './LyricCuesWindow'
import { LyricTimelineToolbar } from './LyricTimelineToolbar'

type Toolbar = React.ComponentProps<typeof LyricTimelineToolbar>
type Editor = Toolbar['editor']

const spies = {
  addAtPlayhead: vi.fn(),
  undoCueEdit: vi.fn(),
  redoCueEdit: vi.fn(),
  setWaveformZoom: vi.fn(),
  setOverlayVisibility: vi.fn(),
  onTogglePlayback: vi.fn(),
  onVolumeChange: vi.fn(),
  snapChanges: [] as LyricSnapMode[],
}

function fakeEditor(snapMode: LyricSnapMode, setSnapMode: (mode: LyricSnapMode) => void): Editor {
  return {
    cueHistoryPast: [{}],
    cueHistoryFuture: [],
    undoCueEdit: spies.undoCueEdit,
    redoCueEdit: spies.redoCueEdit,
    addAtPlayhead: spies.addAtPlayhead,
    snapMode,
    setSnapMode,
    beatGridMs: [0, 500, 1_000],
    wordBoundaryMs: [],
    waveformZoom: 2,
    setWaveformZoom: spies.setWaveformZoom,
    overlayVisibility: { beatGrid: true },
    setOverlayVisibility: spies.setOverlayVisibility,
    overlaySource: { authoritative: true },
  } as unknown as Editor
}

/** The real owner (LyricManagerView) keeps snap mode in state; mirror that so toggling round-trips. */
function Harness({ playing = false, loaded = true }: { playing?: boolean; loaded?: boolean }) {
  const [snapMode, setSnapMode] = useState<LyricSnapMode>('none')
  return (
    <LyricTimelineToolbar
      editor={fakeEditor(snapMode, mode => { spies.snapChanges.push(mode); setSnapMode(mode) })}
      selectedTrackLoaded={loaded}
      selectedTrackPlaying={playing}
      currentTimeMs={6_000}
      durationMs={193_000}
      volume={0.8}
      onTogglePlayback={spies.onTogglePlayback}
      onVolumeChange={spies.onVolumeChange}
    />
  )
}

let container: HTMLElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  spies.snapChanges.length = 0
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.clearAllMocks()
})

const button = (label: string | RegExp) =>
  [...container.querySelectorAll<HTMLButtonElement>('button')].find(item =>
    typeof label === 'string' ? item.textContent?.trim() === label || item.getAttribute('aria-label') === label : label.test(item.textContent ?? ''))!

describe('LyricTimelineToolbar', () => {
  it('keeps transport, time, add/undo/redo, snap, zoom and volume in one toolbar', async () => {
    await act(async () => root.render(<Harness />))

    const toolbar = container.querySelector('[role="toolbar"]')!
    expect(toolbar.getAttribute('aria-label')).toBe('Timeline controls')
    expect(toolbar.querySelector('[aria-label="Play lyric preview"]')).not.toBeNull()
    expect(toolbar.querySelector('[aria-label="Playback position"]')?.textContent).toContain('3:13')
    expect(button('+ Add cue')).toBeTruthy()
    expect(toolbar.querySelector('[aria-label="Undo lyric edit"]')).not.toBeNull()
    expect(toolbar.querySelector('[aria-label="Redo lyric edit"]')).not.toBeNull()
    expect(toolbar.querySelector('[aria-label="Shared waveform zoom"]')).not.toBeNull()
    expect(toolbar.querySelector('[aria-label="Preview volume"]')).not.toBeNull()
  })

  it('wires play/pause, add cue, undo and redo to the owner handlers', async () => {
    await act(async () => root.render(<Harness playing />))

    await act(async () => button('Pause lyric preview').click())
    await act(async () => button('+ Add cue').click())
    await act(async () => button('Undo lyric edit').click())
    expect(spies.onTogglePlayback).toHaveBeenCalledOnce()
    expect(spies.addAtPlayhead).toHaveBeenCalledOnce()
    expect(spies.undoCueEdit).toHaveBeenCalledOnce()
    expect(button('Redo lyric edit').disabled).toBe(true)
  })

  it('has a single Snap control: the toggle and the resolution picker drive the same state', async () => {
    await act(async () => root.render(<Harness />))

    const snapChips = [...container.querySelectorAll('button')].filter(item => /Snap:/.test(item.textContent ?? ''))
    expect(snapChips).toHaveLength(1)
    expect(snapChips[0].getAttribute('aria-pressed')).toBe('false')

    // Off -> On restores a usable resolution (beat, because a beat grid exists).
    await act(async () => snapChips[0].click())
    expect(spies.snapChanges).toEqual(['beat'])
    expect(snapChips[0].getAttribute('aria-pressed')).toBe('true')
    expect(snapChips[0].textContent).toContain('On')

    // Choosing a different resolution changes the same mode.
    const resolution = container.querySelector<HTMLElement>('[aria-label="Snap resolution"]')!
    await act(async () => resolution.click())
    const half = [...document.body.querySelectorAll<HTMLElement>('[role="option"]')].find(option => option.textContent === 'Half beat')!
    await act(async () => half.click())
    expect(spies.snapChanges[spies.snapChanges.length - 1]).toBe('half-beat')

    // On -> Off -> On returns to the resolution last used, not the default.
    await act(async () => snapChips[0].click())
    expect(spies.snapChanges[spies.snapChanges.length - 1]).toBe('none')
    await act(async () => snapChips[0].click())
    expect(spies.snapChanges[spies.snapChanges.length - 1]).toBe('half-beat')
  })

  it('disables playback until the selected track is loaded', async () => {
    await act(async () => root.render(<Harness loaded={false} />))
    expect(button('Play lyric preview').disabled).toBe(true)
  })
})

describe('LyricCuesWindow cue list', () => {
  const cues: LyricCue[] = [
    { id: 'a', startMs: 1_000, endMs: 4_000, text: 'Lay your doubts down', reviewStatus: 'unreviewed', confidence: 0.5 },
    { id: 'b', startMs: 4_500, endMs: 8_000, text: 'Take the weight off', reviewStatus: 'reviewed', warnings: ['needs_review'] },
  ]

  async function renderList(selectCue = vi.fn()) {
    const editor = {
      rootRef: { current: null },
      cues,
      orderedCues: cues,
      selectedCueId: 'a',
      canonicalPlayheadMs: null,
      selectCue,
      filter: 'all',
      setFilter: vi.fn(),
      filteredCues: cues,
      cueIssues: new Map(),
      undoCueEdit: vi.fn(),
      redoCueEdit: vi.fn(),
    } as unknown as React.ComponentProps<typeof LyricCuesWindow>['editor']
    await act(async () => root.render(<LyricCuesWindow editor={editor} />))
    // The list is collapsed by default.
    const toggle = [...container.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.includes('Cue list'))!
    await act(async () => toggle.click())
    return selectCue
  }

  it('shows only the priority columns — #, Time, Lyric, Status — and keeps detail in the row tooltip', async () => {
    await renderList()
    const headers = [...container.querySelectorAll('.lyric-cue-list__table th')].map(item => item.textContent)
    expect(headers).toEqual(['#', 'Time', 'Lyric', 'Status'])
    const row = container.querySelector<HTMLElement>('[data-cue-row-id="a"]')!
    expect(row.getAttribute('title')).toContain('3000 ms')
    expect(row.getAttribute('title')).toContain('confidence 50%')
    expect(row.querySelector('.lyric-cue-list__time')?.textContent).toContain('–')
    expect(container.querySelector<HTMLElement>('[data-cue-row-id="b"]')!.textContent).toContain('⚠ 1')
  })

  it('selects a cue when its row is clicked', async () => {
    const selectCue = await renderList()
    await act(async () => container.querySelector<HTMLElement>('[data-cue-row-id="b"]')!.click())
    expect(selectCue).toHaveBeenCalledWith('b')
  })
})
