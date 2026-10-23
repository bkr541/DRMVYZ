// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

/**
 * Cue-editing behavior of the production Lyric Manager workspace, exercised through the same pieces
 * LyricManagerView composes: the useLyricCueEditor hook, the Track Timeline window + toolbar, the stacked
 * cue lanes, the cue list and the Cue inspector. (Migrated from the retired standalone LyricCueEditor.)
 */

import React, { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LyricCue } from '../../../types/lyrics'

vi.mock('../../../components/vyzualz/hooks/useWaveformPeaks', () => ({
  useWaveformPeaks: () => ({ peaks: [0.1, 0.4, 0.8, 0.2], loading: false, error: null }),
}))
vi.mock('../../../components/vyzualz/shared/VyzualzHeaderActions', () => ({ VyzualzHeaderActions: () => null }))
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
import { useLyricCueEditor, type UseLyricCueEditorParams } from '../editor/useLyricCueEditor'
import { LyricCueInspector } from '../editor/LyricCueInspector'
import { LyricManagerHeader } from './LyricManagerHeader'
import { LyricCuesWindow, LyricCueStackedTimeline } from './LyricCuesWindow'
import { LyricTimelineEditActions, LyricTimelineToolbar } from './LyricTimelineToolbar'
import { LyricTrackTimelineWindow } from './LyricTrackTimelineWindow'
import { LyricPreviewPanel } from './LyricPreviewPanel'
import { HeaderNotificationsButton } from '../../../components/vyzualz/shared/HeaderNotificationsButton'
import { NotificationPageProvider, useNotificationStore } from '../../../stores/notificationStore'

const CUES: LyricCue[] = [
  { id: 'cue-1', startMs: 0, endMs: 1_000, text: 'First', confidence: 0.95, reviewStatus: 'reviewed' },
  { id: 'cue-2', startMs: 1_000, endMs: 2_000, text: 'Second', confidence: 0.4, reviewStatus: 'unreviewed' },
]

interface WorkspaceProps extends Partial<UseLyricCueEditorParams> {
  onAnalyzeTrack?: () => void
}

/** The center + inspector wiring from LyricManagerView, minus data loading and layout chrome. */
function Workspace({ onAnalyzeTrack, ...overrides }: WorkspaceProps) {
  const [laneIconsExpanded, setLaneIconsExpanded] = useState(true)
  const durationMs = overrides.durationMs ?? 5_000
  const currentTimeMs = overrides.currentTimeMs === undefined ? 500 : overrides.currentTimeMs
  const editor = useLyricCueEditor({
    trackId: 'track-1',
    trackUrl: null,
    decodedBuffer: null,
    durationMs,
    currentTimeMs,
    beatGridMs: [0, 500, 1_000],
    ...overrides,
  })
  const { selectedCue, actions } = editor
  return (
    <>
      <LyricManagerHeader isSaving={false} saveStatus="saved" lyricsDisplayEnabled hasDocument dirty={false}
        onToggleLyricsDisplay={() => undefined} onSave={() => undefined} onSaveAndMakeActive={() => undefined}
        laneIconsExpanded={laneIconsExpanded} onToggleLaneIcons={() => setLaneIconsExpanded(value => !value)}
        editActions={<LyricTimelineEditActions
          editor={editor}
          analyze={(overrides.beatGridStatus ?? 'missing') === 'trusted' || !onAnalyzeTrack ? null : { label: 'Analyze Track', onClick: onAnalyzeTrack }}
        />}
      />
      <LyricTrackTimelineWindow laneIconsExpanded={laneIconsExpanded}
        durationMs={durationMs}
        currentTimeMs={currentTimeMs}
        zoom={editor.waveformZoom}
        onZoomChange={editor.setWaveformZoom}
        sections={[]}
        beatGrid={[]}
        trackId="track-1"
        trackUrl={null}
        waveformPeaks={editor.peaks}
        waveformLoading={editor.loading}
        toolbar={(
          <LyricTimelineToolbar
            selectedTrackLoaded
            selectedTrackPlaying={false}
            currentTimeMs={currentTimeMs}
            durationMs={durationMs}
            volume={0.8}
            onTogglePlayback={() => undefined}
            onVolumeChange={() => undefined}
            onSeek={() => undefined}
          />
        )}
        cueTimeline={<LyricCueStackedTimeline editor={editor} durationMs={durationMs} currentTimeMs={currentTimeMs} onSeek={() => undefined} />}
      />
      <LyricCuesWindow editor={editor} />
      {selectedCue && actions && (
        <LyricCueInspector
          cue={selectedCue}
          cues={editor.cues}
          durationMs={durationMs}
          onUpdateCue={editor.commitCuePatch}
        />
      )}
    </>
  )
}

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

async function renderWorkspace(props: WorkspaceProps = {}) {
  await act(async () => { root.render(<Workspace {...props} />) })
}

const setValue = (input: HTMLInputElement, value: string) =>
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value)

describe('Lyric Manager cue editing workspace', () => {
  it('collapses and reopens a selected record without losing selection or word edits', async () => {
    await renderWorkspace()
    const row = container.querySelector<HTMLElement>('[data-cue-row-id="cue-1"]')!
    expect(row.getAttribute('aria-expanded')).toBe('true')
    await act(async () => row.click())
    expect(row.getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelector('[aria-label="Edit cue 1"]')).toBeNull()
    expect(useLyricsStore.getState().selectedCueId).toBe('cue-1')
    await act(async () => row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(row.getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector('[aria-label="Edit cue 1"]')).not.toBeNull()
  })

  it('highlights literal search terms and scrolls to a match without mutating or filtering cues', async () => {
    await renderWorkspace()
    const match = container.querySelector<HTMLElement>('[data-cue-row-id="cue-2"]')!
    match.scrollIntoView = vi.fn()
    const input = container.querySelector<HTMLInputElement>('[aria-label="Search cues"]')!
    await act(async () => { setValue(input, 'sEcOnD'); input.dispatchEvent(new Event('input', { bubbles: true })) })
    expect(match.querySelector('mark')?.textContent).toBe('Second')
    expect(match.scrollIntoView).toHaveBeenCalledOnce()
    expect(container.querySelectorAll('[data-cue-row-id]')).toHaveLength(2)
    expect(useLyricsStore.getState().cues).toEqual(CUES)
    await act(async () => { setValue(input, '['); input.dispatchEvent(new Event('input', { bubbles: true })) })
    expect(container.querySelector('[role="status"]')?.textContent).toBe('No cues match this search.')
    await act(async () => { setValue(input, ''); input.dispatchEvent(new Event('input', { bubbles: true })) })
    expect(container.querySelector('mark')).toBeNull()
  })

  it('keeps commands in the header and toggles canonical Track Map lane labels together', async () => {
    await renderWorkspace()
    const timeline = container.querySelector('[aria-label="Track Timeline"]')!
    expect(timeline.querySelector('[aria-label="Cue editing"]')).toBeNull()
    expect(container.querySelector('header [aria-label="Cue editing"]')).not.toBeNull()
    expect(timeline.querySelector('.rv-timeline-lane-icon[title="Beats"] .app-icon')).not.toBeNull()
    expect(timeline.querySelector('.rv-timeline-lane-icon[title="Lyrics 1"]')).not.toBeNull()
    expect(timeline.querySelector('.rv-timeline-lanes--icons-expanded')).not.toBeNull()
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Collapse Track Timeline row icons"]')!.click())
    expect(timeline.querySelector('.rv-timeline-lanes--icons-expanded')).toBeNull()
    expect(container.querySelector('[aria-label="Expand Track Timeline row icons"]')).not.toBeNull()
    expect(container.querySelector('.lyric-cue-list__status-dot--reviewed')).not.toBeNull()
    expect(container.querySelector('.lyric-cue-list__status .app-icon')).toBeNull()
  })

  it('opens a validation warning from Notifications into the visible, expanded cue list', async () => {
    useLyricsStore.setState({ cues: [CUES[0], { ...CUES[1], startMs: 900 }], selectedCueId: 'cue-1' })
    function NavigationWorkspace() {
      const [target, setTarget] = React.useState<UseLyricCueEditorParams['navigationTarget']>(null)
      const cues = useLyricsStore(state => state.cues)
      return (
        <NotificationPageProvider value="lyric-manager">
          <HeaderNotificationsButton page="lyric-manager" />
          <LyricPreviewPanel cues={cues} document={null} onNavigateToIssue={issue => {
            if (issue.cueId) setTarget({ cueId: issue.cueId, wordId: issue.wordId, revision: Date.now() })
          }} />
          <Workspace navigationTarget={target} />
        </NotificationPageProvider>
      )
    }
    await act(async () => root.render(<NavigationWorkspace />))
    await act(async () => container.querySelector<HTMLButtonElement>('.lmv-lyric-cues-window .drc-header')!.click())
    expect(container.querySelector('.lyric-cue-list')).toBeNull()
    await act(async () => container.querySelector<HTMLButtonElement>('.vz-header-notifications')!.click())
    const open = [...document.body.querySelectorAll<HTMLButtonElement>('.vz-notifications-drawer .dv-notice-open')]
      .find(button => button.getAttribute('aria-label')?.includes('Cue 2 overlaps cue 1'))!
    expect(open).toBeTruthy()
    expect(open.textContent).toBe('')
    expect(open.querySelector('svg')).not.toBeNull()
    await act(async () => open.click())
    expect(document.body.querySelector('.vz-notifications-overlay')).toBeNull()
    expect(useLyricsStore.getState().selectedCueId).toBe('cue-2')
    const row = container.querySelector('[data-cue-row-id="cue-2"]')!
    expect(row.getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(row)
    expect(container.querySelector('[aria-label="Edit cue 2"]')).not.toBeNull()
    // Opening a destination does not discard the warning.
    expect(useNotificationStore.getState().pages['lyric-manager'].length).toBeGreaterThan(0)
    await act(async () => container.querySelector<HTMLButtonElement>('.vz-header-notifications')!.click())
    expect(document.body.querySelector('.vz-notifications-overlay')).not.toBeNull()
  })

  it('edits word text and timing and deletes words from the center cue list with undo/redo', async () => {
    useLyricsStore.setState({ cues: [{ ...CUES[0], text: 'First word',
      words: [{ id: 'word-a', text: 'First', startMs: 0, endMs: 400 }, { id: 'word-b', text: 'word', startMs: 500, endMs: 900 }],
      groups: [{ id: 'group-a', wordIds: ['word-a', 'word-b'] }],
    }], selectedCueId: 'cue-1' })
    await renderWorkspace()
    const list = container.querySelector('[aria-label="Lyric cue list"]')!
    expect(container.querySelector('.lyric-cue-inspector .lyric-word-editor')).toBeNull()
    expect([...container.querySelectorAll('.lyric-cue-inspector .drc-header')].some(header => header.textContent?.includes('Word Timing'))).toBe(false)
    const edit = async (label: string, value: string) => {
      const input = list.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!
      expect(input).toBeTruthy()
      await act(async () => { setValue(input, value); input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })) })
    }
    await edit('Word 1 text', 'Edited')
    await edit('Word 1 start milliseconds', '100')
    await edit('Word 1 end milliseconds', '450')
    expect(useLyricsStore.getState().cues[0].words?.[0]).toMatchObject({ text: 'Edited', startMs: 100, endMs: 450 })
    await act(async () => list.querySelector<HTMLButtonElement>('[aria-label="Remove word 1"]')!.click())
    expect(useLyricsStore.getState().cues[0].words?.map(word => word.id)).toEqual(['word-b'])
    expect(useLyricsStore.getState().cues[0].groups?.[0].wordIds).toEqual(['word-b'])
    await act(async () => useLyricsStore.getState().undoCueEdit())
    expect(useLyricsStore.getState().cues[0].words).toHaveLength(2)
    expect(useLyricsStore.getState().cues[0].groups?.[0].wordIds).toEqual(['word-a', 'word-b'])
    await act(async () => useLyricsStore.getState().redoCueEdit())
    expect(useLyricsStore.getState().cues[0].words?.map(word => word.id)).toEqual(['word-b'])
    await act(async () => list.querySelector<HTMLButtonElement>('[aria-label="Remove word 1"]')!.click())
    expect(useLyricsStore.getState().cues[0].words).toBeUndefined()
    expect(useLyricsStore.getState().cues[0].groups).toBeUndefined()
    expect(list.textContent).toContain('This cue has line timing only')
  })

  it('edits cue bounds in the list and deletes from the header, keeping selection and history', async () => {
    await renderWorkspace()
    const list = container.querySelector('[aria-label="Lyric cue list"]')!
    const end = list.querySelector<HTMLInputElement>('[aria-label="Cue 1 end milliseconds"]')!
    await act(async () => { setValue(end, '1200'); end.dispatchEvent(new FocusEvent('focusout', { bubbles: true })) })
    expect(useLyricsStore.getState().cues[0].endMs).toBe(1200)
    expect(list.querySelector('[aria-label="Delete cue 1"]')).toBeNull()
    await act(async () => container.querySelector<HTMLButtonElement>('header [aria-label="Delete cue"]')!.click())
    expect(useLyricsStore.getState().cues.map(cue => cue.id)).toEqual(['cue-2'])
    expect(useLyricsStore.getState().selectedCueId).toBe('cue-2')
    await act(async () => useLyricsStore.getState().undoCueEdit())
    expect(useLyricsStore.getState().cues).toHaveLength(2)
  })

  it('keeps timeline selection and cue-list selection synchronized both ways', async () => {
    await renderWorkspace()
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

  it('zooms only inside the track timeline, through the shared waveform zoom state', async () => {
    useVisualStore.getState().setWaveformZoom(4)
    await renderWorkspace()
    // There is no zoom control in the audio controls row.
    expect(container.querySelector('input[aria-label="Shared waveform zoom"]')).toBeNull()
    expect(container.querySelector('[aria-label="Timeline controls"]')?.textContent).not.toMatch(/Zoom/i)

    // The mouse wheel over the track timeline's lanes zooms it, and the shared state follows.
    const lanes = container.querySelector<HTMLElement>('.lmv-track-timeline-lanes')!
    await act(async () => { lanes.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -200 })) })
    expect(useVisualStore.getState().waveformZoom).toBeGreaterThan(4)
    await act(async () => { lanes.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 800 })) })
    expect(useVisualStore.getState().waveformZoom).toBeLessThan(4)
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
    await renderWorkspace({
      beatGridMs: [],
      beatGridStatus: 'temporary',
      beatGridStatusMessage: 'Temporary grid in use.',
      onAnalyzeTrack: analyze,
      navigationTarget: { cueId: 'cue-2', wordId: 'word-2', revision: 1 },
    })

    // The header cue-action row owns the recovery action, as an icon-only button after Delete, and the old hint text is gone.
    const analyzeButton = container.querySelector<HTMLButtonElement>('[aria-label="Analyze Track"]')
    expect(analyzeButton).toBeTruthy()
    expect(analyzeButton!.textContent?.trim()).toBe('')
    const row = container.querySelector('[aria-label="Cue editing"]')!
    expect(row.lastElementChild).toBe(analyzeButton)
    expect(row.querySelector('[aria-label="Delete cue"]')!.compareDocumentPosition(analyzeButton!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(container.textContent).not.toContain('Temporary grid in use.')
    await act(async () => analyzeButton?.click())
    expect(analyze).toHaveBeenCalledOnce()
    expect(useLyricsStore.getState().selectedCueId).toBe('cue-2')
    const wordRow = container.querySelector('[aria-label="Lyric cue list"] [data-word-id="word-2"]')
    expect(wordRow?.className).toContain('lyric-word-editor__row--focused')
    expect(wordRow?.querySelector('input')).toBe(document.activeElement)
  })

  it('filters low-confidence and warning rows without changing canonical cues', async () => {
    await renderWorkspace()
    const filter = container.querySelector<HTMLButtonElement>('.lyric-cue-list__controls [role="combobox"]')!
    await act(async () => filter.click())
    const lowConfidence = [...document.body.querySelectorAll<HTMLElement>('[role="option"]')]
      .find(option => option.textContent?.trim() === 'Low confidence')!
    await act(async () => lowConfidence.click())
    expect(container.querySelector('[data-cue-row-id="cue-1"]')).toBeNull()
    expect(container.querySelector('[data-cue-row-id="cue-2"]')).not.toBeNull()
    expect(useLyricsStore.getState().cues).toHaveLength(2)
  })

  it('moves cue bounds and word timing together in one editor-history mutation', async () => {
    useLyricsStore.setState({
      cues: [{
        id: 'cue-1',
        startMs: 1_000,
        endMs: 2_000,
        text: 'Move me',
        words: [{ id: 'word-1', text: 'Move', startMs: 1_100, endMs: 1_500, confidence: 0.9 }],
        groups: [{ id: 'group-1', wordIds: ['word-1'] }],
      }],
      selectedCueId: 'cue-1',
      cueHistoryPast: [],
      cueHistoryFuture: [],
    })
    await renderWorkspace({ currentTimeMs: 3_000 })

    const moveButton = container.querySelector<HTMLButtonElement>('[aria-label="Move to playhead"]')!
    await act(async () => moveButton.click())

    expect(useLyricsStore.getState().cues[0]).toMatchObject({
      startMs: 3_000,
      endMs: 4_000,
      words: [expect.objectContaining({ id: 'word-1', startMs: 3_100, endMs: 3_500, confidence: 0.9 })],
      groups: [{ id: 'group-1', wordIds: ['word-1'] }],
    })
    expect(useLyricsStore.getState().cueHistoryPast).toHaveLength(1)
  })

  it('preserves rapid start and end word commits made before a React rerender', async () => {
    useLyricsStore.setState({
      cues: [{
        id: 'cue-1',
        startMs: 1_000,
        endMs: 2_000,
        text: 'Rapid edit',
        words: [
          {
            id: 'word-1',
            text: 'Rapid',
            startMs: 1_100,
            endMs: 1_500,
            confidence: 0.73,
            source: 'transcription',
            reviewStatus: 'corrected',
            warnings: ['needs_review'],
            analysisMetadata: { token: 'preserve' },
          },
          { id: 'word-2', text: 'edit', startMs: 1_550, endMs: 1_900, confidence: 0.64 },
        ],
        groups: [{ id: 'group-1', wordIds: ['word-1', 'word-2'] }],
      }],
      selectedCueId: 'cue-1',
      cueHistoryPast: [],
      cueHistoryFuture: [],
    })
    await renderWorkspace()

    const startInput = container.querySelector<HTMLInputElement>('[aria-label="Word 1 start milliseconds"]')!
    const endInput = container.querySelector<HTMLInputElement>('[aria-label="Word 1 end milliseconds"]')!
    await act(async () => {
      setValue(startInput, '1200')
      startInput.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
      setValue(endInput, '1600')
      endInput.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    })

    expect(useLyricsStore.getState().cues[0]).toMatchObject({
      words: [
        {
          id: 'word-1',
          text: 'Rapid',
          startMs: 1_200,
          endMs: 1_600,
          confidence: 0.73,
          source: 'transcription',
          reviewStatus: 'corrected',
          warnings: ['needs_review'],
          analysisMetadata: { token: 'preserve' },
        },
        { id: 'word-2', text: 'edit', startMs: 1_550, endMs: 1_900, confidence: 0.64 },
      ],
      groups: [{ id: 'group-1', wordIds: ['word-1', 'word-2'] }],
    })
    expect(useLyricsStore.getState().cueHistoryPast).toHaveLength(2)
  })

  it('repairs invalid timing in place — keeps the word, its group, and gives it valid timing, and still allows retiming', async () => {
    useLyricsStore.setState({
      cues: [{
        id: 'cue-1',
        startMs: 1_000,
        endMs: 2_000,
        text: 'Keep me',
        words: [{
          id: 'word-1',
          text: 'Keep',
          startMs: 1_800,
          endMs: 1_700,
          confidence: 0.73,
          source: 'transcription',
          reviewStatus: 'corrected',
          style: { color: '#fff' },
          warnings: ['needs_review'],
          analysisMetadata: { token: 'preserve' },
        }],
        groups: [{ id: 'group-1', wordIds: ['word-1'] }],
      }],
      selectedCueId: 'cue-1',
      cueHistoryPast: [],
      cueHistoryFuture: [],
    })
    await renderWorkspace()

    const removeTiming = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find(button => button.textContent?.trim() === 'Remove invalid timing')!
    await act(async () => removeTiming.click())

    const cleared = useLyricsStore.getState().cues[0]
    expect(cleared.words).toHaveLength(1)
    expect(cleared.words?.[0]).toMatchObject({
      id: 'word-1',
      text: 'Keep',
      confidence: 0.73,
      source: 'transcription',
      reviewStatus: 'corrected',
      style: { color: '#fff' },
      warnings: ['needs_review'],
      analysisMetadata: { token: 'preserve' },
    })
    // The word is left with valid forward timing inside the cue, not untimed.
    const repairedWord = cleared.words![0]
    expect(Number.isFinite(repairedWord.startMs)).toBe(true)
    expect(Number.isFinite(repairedWord.endMs)).toBe(true)
    expect(repairedWord.endMs as number).toBeGreaterThan(repairedWord.startMs as number)
    expect(repairedWord.startMs as number).toBeGreaterThanOrEqual(cleared.startMs)
    expect(repairedWord.endMs as number).toBeLessThanOrEqual(cleared.endMs)
    expect(cleared.groups).toEqual([{ id: 'group-1', wordIds: ['word-1'] }])

    const startInput = container.querySelector<HTMLInputElement>('[aria-label="Word 1 start milliseconds"]')!
    const endInput = container.querySelector<HTMLInputElement>('[aria-label="Word 1 end milliseconds"]')!
    await act(async () => {
      setValue(startInput, '1100')
      startInput.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
      setValue(endInput, '1500')
      endInput.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    })

    expect(useLyricsStore.getState().cues[0].words?.[0]).toMatchObject({ startMs: 1_100, endMs: 1_500 })
  })
})
