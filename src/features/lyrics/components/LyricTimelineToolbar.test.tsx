// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LyricCue } from '../../../types/lyrics'
import type { LyricSnapMode } from '../editor/lyricCueEditorModel'
import { LyricCuesWindow } from './LyricCuesWindow'
import { LyricTimelineEditActions, LyricTimelineToolbar } from './LyricTimelineToolbar'

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

function Harness({ playing = false, loaded = true }: { playing?: boolean; loaded?: boolean }) {
  const editor = fakeEditor('none', mode => { spies.snapChanges.push(mode) })
  return (
    <>
      <LyricTimelineEditActions editor={editor} />
      <LyricTimelineToolbar
        editor={editor}
        selectedTrackLoaded={loaded}
        selectedTrackPlaying={playing}
        currentTimeMs={6_000}
        durationMs={193_000}
        volume={0.8}
        onTogglePlayback={spies.onTogglePlayback}
        onVolumeChange={spies.onVolumeChange}
      />
    </>
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
  it('keeps transport, time, zoom and volume (in that order) in the toolbar, with no snap or overlay controls', async () => {
    await act(async () => root.render(<Harness />))

    const toolbar = container.querySelector('[aria-label="Timeline controls"]')!
    expect(toolbar.querySelector('[aria-label="Play lyric preview"]')).not.toBeNull()
    expect(toolbar.querySelector('[aria-label="Playback position"]')?.textContent).toContain('3:13')
    const zoom = toolbar.querySelector('[aria-label="Shared waveform zoom"]')!
    const volume = toolbar.querySelector('[aria-label="Preview volume"]')!
    expect(zoom.compareDocumentPosition(volume) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(container.textContent).not.toMatch(/Snap|Overlays/)
    expect(container.querySelector('[aria-label="Snap resolution"]')).toBeNull()
  })

  it('offers icon-only Add cue, Undo and Redo in their own row, wired to the owner handlers', async () => {
    await act(async () => root.render(<Harness playing />))

    const actions = container.querySelector('[aria-label="Cue editing"]')!
    expect(actions.closest('[aria-label="Timeline controls"]')).toBeNull()
    for (const item of actions.querySelectorAll('button')) expect(item.textContent?.trim()).toBe('')
    await act(async () => button('Pause lyric preview').click())
    await act(async () => button('Add cue').click())
    await act(async () => button('Undo lyric edit').click())
    expect(spies.onTogglePlayback).toHaveBeenCalledOnce()
    expect(spies.addAtPlayhead).toHaveBeenCalledOnce()
    expect(spies.undoCueEdit).toHaveBeenCalledOnce()
    expect(button('Redo lyric edit').disabled).toBe(true)
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
