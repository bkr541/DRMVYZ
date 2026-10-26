import { useCallback, useMemo, useRef, useState } from 'react'
import {
  LyricCueStackedTimeline, LyricCuesWindow, type LyricCueStackedTimelineEditor, type LyricCuesWindowEditor,
} from '../../../../features/lyrics/components/LyricCuesWindow'
import { LyricTrackTimelineWindow } from '../../../../features/lyrics/components/LyricTrackTimelineWindow'
import {
  addCueAtPlayhead, duplicateCue, getCueIssues, mergeCues, sortLyricCues, splitCue,
} from '../../../../features/lyrics/editor/lyricCueEditorModel'
import { cueMatchesFilter, type LyricCueFilter } from '../../../../features/lyrics/editor/useLyricCueEditor'
import type { LyricCue } from '../../../../types/lyrics'
import { TM_SECTIONS } from './layoutLabTrackMapFixture'
import {
  LT_BEAT_GRID, LT_CUES, LT_DURATION_MS, LT_PLAYHEAD_MS, LT_SELECTED_CUE_ID, LT_SNAP_CONTEXT, LT_WAVEFORM_PEAKS,
} from './layoutLabLyricTimelineFixture'

// ── Layout Lab · Lyric Manager windows · Track Timeline and Cue list ────────
//
// The Lyric Manager's own center-column windows, mounted unchanged: production's `LyricTrackTimelineWindow` with
// `LyricCueStackedTimeline` (the "Track Timeline" group: Time, Beats, Sections and Audio rows over the Lyrics 1–3 lanes
// and one playhead) and `LyricCuesWindow` (the "Cue list" group: search, filter, the # / Time / Lyric / Status table and
// the expanded cue editor with its word timings), so every class, row height and colour is production's own. As in the
// app the two are siblings over one cue editor: one set of cues, one selection and one playhead, and the list's filter
// fades the cues it hides in the lanes. Only the data differs: the track, beat grid, sections and waveform are the ones
// the Track Map uses, and the cues are the placeholders in layoutLabLyricTimelineFixture.ts, held in local state (with
// undo and redo) instead of the cue editor store. Each group collapses and expands from its header, as the Track Map
// does from its toolbar, and the column scrolls. The wrapper only supplies the lyrics workspace's floating-window
// attributes, which scope the windows' surface rules (border, radius, background), and takes no box of its own.
//
// Interactive as in the app: click or drag the reference rows to move the playhead, scroll over the lanes to zoom,
// click a cue or a table row to select it, drag a cue or its edges to move or resize it, double-click a lane to add a
// cue, right-click a cue for its menu, and edit timings and words in the list. Nothing is saved.

let nextCueNumber = 100

export function LayoutLabLyricManagerWindows() {
  const [cues, setCues] = useState<LyricCue[]>(LT_CUES)
  const [selectedCueId, setSelectedCueId] = useState<string | null>(LT_SELECTED_CUE_ID)
  const [currentMs, setCurrentMs] = useState(LT_PLAYHEAD_MS)
  const [zoom, setZoom] = useState(1)
  const [filter, setFilter] = useState<LyricCueFilter>('all')
  const rootRef = useRef<HTMLDivElement>(null)
  const cuesRef = useRef(cues)
  cuesRef.current = cues
  const history = useRef<{ past: LyricCue[][]; future: LyricCue[][] }>({ past: [], future: [] })

  const createCueId = () => `lt-cue-${(nextCueNumber += 1)}`

  /** Every edit is one undo step, as in the editor. */
  const replaceCues = useCallback((next: LyricCue[], selectId?: string | null) => {
    history.current = { past: [...history.current.past, cuesRef.current], future: [] }
    setCues(next)
    if (selectId !== undefined) setSelectedCueId(selectId)
  }, [])
  const undoCueEdit = useCallback(() => {
    const previous = history.current.past.at(-1)
    if (!previous) return
    history.current = { past: history.current.past.slice(0, -1), future: [cuesRef.current, ...history.current.future] }
    setCues(previous)
  }, [])
  const redoCueEdit = useCallback(() => {
    const [next, ...rest] = history.current.future
    if (!next) return
    history.current = { past: [...history.current.past, cuesRef.current], future: rest }
    setCues(next)
  }, [])

  const orderedCues = useMemo(() => sortLyricCues(cues), [cues])
  const cueIssues = useMemo(() => new Map(cues.map(cue => [cue.id, getCueIssues(cue, cues, LT_DURATION_MS)])), [cues])
  const filteredCues = useMemo(
    () => orderedCues.filter(cue => cueMatchesFilter(cue, filter, cueIssues.get(cue.id) ?? [])),
    [orderedCues, filter, cueIssues],
  )
  // Cues the list's filter hides are drawn faded in the lanes.
  const inactiveCueIds = useMemo(
    () => new Set(orderedCues.filter(cue => !cueMatchesFilter(cue, filter, cueIssues.get(cue.id) ?? [])).map(cue => cue.id)),
    [orderedCues, filter, cueIssues],
  )

  const commitCuePatch = useCallback(
    (cueId: string, patch: Partial<Omit<LyricCue, 'id'>>) => replaceCues(cuesRef.current.map(cue => cue.id === cueId ? { ...cue, ...patch } : cue)),
    [replaceCues],
  )

  const lanesEditor = useMemo<LyricCueStackedTimelineEditor>(() => ({
    orderedCues,
    selectedCueId,
    getCurrentTimeMs: undefined,
    waveformZoom: zoom,
    snapContext: LT_SNAP_CONTEXT,
    inactiveCueIds,
    selectCue: setSelectedCueId,
    addAtTimelineTime: timeMs => {
      const cue = addCueAtPlayhead(createCueId(), timeMs, LT_DURATION_MS)
      replaceCues([...cuesRef.current, cue], cue.id)
    },
    commitCuePatch,
    commitWords: (cueId, words) => commitCuePatch(cueId, { words }),
    handleCueContextAction: (cueId, action, timeMs) => {
      const all = cuesRef.current
      const ordered = sortLyricCues(all)
      const index = ordered.findIndex(cue => cue.id === cueId)
      const cue = ordered[index]
      if (!cue) return
      if (action === 'delete') {
        replaceCues(all.filter(item => item.id !== cueId), ordered[index + 1]?.id ?? ordered[index - 1]?.id ?? null)
      } else if (action === 'mark-reviewed') {
        replaceCues(all.map(item => item.id === cueId ? { ...item, reviewStatus: 'reviewed' } : item))
      } else if (action === 'duplicate') {
        const copy = duplicateCue(cue, createCueId(), LT_DURATION_MS)
        replaceCues([...all, copy], copy.id)
      } else if (action === 'split') {
        const halves = splitCue(cue, timeMs, createCueId(), createCueId())
        if (halves) replaceCues(all.flatMap(item => item.id === cueId ? halves : [item]), halves[1].id)
      } else {
        const adjacent = action === 'merge-previous' ? ordered[index - 1] : ordered[index + 1]
        if (!adjacent) return
        const merged = action === 'merge-previous' ? mergeCues(adjacent, cue) : mergeCues(cue, adjacent)
        replaceCues(all.filter(item => item.id !== cue.id && item.id !== adjacent.id).concat(merged), merged.id)
      }
    },
  }), [orderedCues, selectedCueId, zoom, inactiveCueIds, commitCuePatch, replaceCues])

  const listEditor = useMemo<LyricCuesWindowEditor>(() => ({
    rootRef,
    cues,
    orderedCues,
    selectedCueId,
    canonicalPlayheadMs: currentMs,
    selectCue: setSelectedCueId,
    filter,
    setFilter,
    filteredCues,
    cueIssues,
    navigationTarget: null,
    commitCuePatch,
    updateCueWord: (cueId, wordId, patch) => replaceCues(cuesRef.current.map(cue => cue.id === cueId
      ? { ...cue, words: cue.words?.map(word => word.id === wordId ? { ...word, ...patch } : word) }
      : cue)),
    undoCueEdit,
    redoCueEdit,
  }), [cues, orderedCues, selectedCueId, currentMs, filter, filteredCues, cueIssues, commitCuePatch, replaceCues, undoCueEdit, redoCueEdit])

  return (
    <div className="ll-lyric-timeline-host" data-workspace-layout="floating" data-app-workspace="lyrics">
      <LyricTrackTimelineWindow
        laneIconsExpanded
        durationMs={LT_DURATION_MS}
        currentTimeMs={currentMs}
        zoom={zoom}
        sections={TM_SECTIONS}
        beatGrid={LT_BEAT_GRID}
        trackId={null}
        trackUrl={null}
        waveformPeaks={LT_WAVEFORM_PEAKS}
        waveformLoading={false}
        onSeek={setCurrentMs}
        onZoomChange={setZoom}
        cueTimeline={
          <LyricCueStackedTimeline editor={lanesEditor} durationMs={LT_DURATION_MS} currentTimeMs={currentMs} onSeek={setCurrentMs} />
        }
      />
      <LyricCuesWindow editor={listEditor} />
    </div>
  )
}
