import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useLyricsStore } from '../../../stores/lyricsStore'
import { useVisualStore } from '../../../stores/visualStore'
import type { LyricCue, LyricWord } from '../../../types/lyrics'
import type { TrackIntelligenceAnalysis } from '../../musicIntelligence/types'
import type { ReactTrackSection } from '../../../components/vyzualz/react/ReactTypes'
import { useWaveformPeaks } from '../../../components/vyzualz/hooks/useWaveformPeaks'
import {
  addCueAtPlayhead,
  canUseSnapMode,
  cueWordBoundaries,
  duplicateCue,
  getCueIssues,
  LOW_LYRIC_CONFIDENCE,
  mergeCues,
  moveCueToStart,
  normalizeCue,
  resizeCueEnd,
  resizeCueStart,
  retainLyricGroupsForWords,
  sortLyricCues,
  splitCue,
  type LyricBeatGridStatus,
  type LyricSnapMode,
} from './lyricCueEditorModel'
import type { LyricCueActionHandlers, LyricSectionOption } from './LyricCueInspector'
import type { LyricCueContextAction } from './LyricCueTimeline'
import {
  buildTimelineOverlaySource,
  DEFAULT_TIMELINE_OVERLAY_VISIBILITY,
  type TimelineOverlayVisibility,
} from '../../timeline/timelineOverlays'
import { toCanonicalLyricTimeMs, toEffectiveLyricTimeMs } from '../runtime/lyricPlaybackResolver'

export type LyricCueFilter = 'all' | 'unreviewed' | 'low-confidence' | 'warnings' | 'empty-text'

export interface UseLyricCueEditorParams {
  trackId: string | null
  trackUrl: string | null
  decodedBuffer?: AudioBuffer | null
  durationMs: number
  currentTimeMs: number | null
  getCurrentTimeMs?: () => number | null
  globalOffsetMs?: number
  beatGridMs?: number[]
  beatGridStatus?: LyricBeatGridStatus
  beatGridStatusMessage?: string | null
  sections?: LyricSectionOption[]
  analysis?: TrackIntelligenceAnalysis | null
  timelineSections?: ReactTrackSection[]
  snapMode?: LyricSnapMode
  onSnapModeChange?: (mode: LyricSnapMode) => void
  navigationTarget?: { cueId: string; wordId?: string | null; revision: number } | null
}

export function createCueId(prefix = 'cue'): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function formatMs(ms: number): string {
  const safe = Math.max(0, Math.round(ms))
  const minutes = Math.floor(safe / 60_000)
  const seconds = Math.floor((safe % 60_000) / 1_000)
  const millis = safe % 1_000
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`
}

function cueMatchesFilter(cue: LyricCue, filter: LyricCueFilter, issues: ReturnType<typeof getCueIssues>): boolean {
  if (filter === 'unreviewed') return !cue.reviewStatus || cue.reviewStatus === 'unreviewed'
  if (filter === 'low-confidence') return cue.confidence !== undefined && cue.confidence < LOW_LYRIC_CONFIDENCE
  if (filter === 'warnings') return issues.length > 0 || (cue.warnings?.length ?? 0) > 0
  if (filter === 'empty-text') return !cue.text.trim()
  return true
}

/**
 * All non-JSX state/logic for lyric cue editing, lifted out of the former
 * LyricCueEditor component so Track Timeline, Lyric Cues, and Document
 * Workspace's Cue Inspector/Cue Settings can all consume the same live
 * selection/history/actions as *siblings* instead of one nesting the others.
 */
export function useLyricCueEditor({
  trackId,
  trackUrl,
  decodedBuffer,
  durationMs,
  currentTimeMs,
  getCurrentTimeMs,
  globalOffsetMs = 0,
  beatGridMs = [],
  beatGridStatus = 'missing',
  beatGridStatusMessage = null,
  sections = [],
  analysis = null,
  timelineSections = [],
  snapMode: controlledSnapMode,
  onSnapModeChange,
  navigationTarget = null,
}: UseLyricCueEditorParams) {
  const {
    cues,
    selectedCueId,
    cueHistoryPast,
    cueHistoryFuture,
    selectCue,
    setCues,
    updateCue,
    updateCueWord,
    setCueBounds,
    deleteCue,
    undoCueEdit,
    redoCueEdit,
  } = useLyricsStore(useShallow(state => ({
    cues: state.cues,
    selectedCueId: state.selectedCueId,
    cueHistoryPast: state.cueHistoryPast,
    cueHistoryFuture: state.cueHistoryFuture,
    selectCue: state.selectCue,
    setCues: state.setCues,
    updateCue: state.updateCue,
    updateCueWord: state.updateCueWord,
    setCueBounds: state.setCueBounds,
    deleteCue: state.deleteCue,
    undoCueEdit: state.undoCueEdit,
    redoCueEdit: state.redoCueEdit,
  })))
  const waveformZoom = useVisualStore(state => state.waveformZoom)
  const setWaveformZoom = useVisualStore(state => state.setWaveformZoom)
  const [localSnapMode, setLocalSnapMode] = useState<LyricSnapMode>('none')
  const snapMode = controlledSnapMode ?? localSnapMode
  const setSnapMode = useCallback((mode: LyricSnapMode) => {
    if (controlledSnapMode === undefined) setLocalSnapMode(mode)
    onSnapModeChange?.(mode)
  }, [controlledSnapMode, onSnapModeChange])
  const [filter, setFilter] = useState<LyricCueFilter>('all')
  const [overlayVisibility, setOverlayVisibility] = useState<TimelineOverlayVisibility>(DEFAULT_TIMELINE_OVERLAY_VISIBILITY)
  const rootRef = useRef<HTMLDivElement>(null)
  const selectedCue = cues.find(cue => cue.id === selectedCueId) ?? null
  const canonicalPlayheadMs = currentTimeMs === null
    ? null
    : Math.max(0, toCanonicalLyricTimeMs(currentTimeMs, globalOffsetMs))
  const orderedCues = useMemo(() => sortLyricCues(cues), [cues])
  const selectedIndex = selectedCue ? orderedCues.findIndex(cue => cue.id === selectedCue.id) : -1
  const wordBoundaryMs = useMemo(() => cueWordBoundaries(selectedCue), [selectedCue])
  const { peaks, loading } = useWaveformPeaks(trackId, decodedBuffer, trackUrl)
  const overlaySource = useMemo(
    () => buildTimelineOverlaySource(analysis, timelineSections),
    [analysis, timelineSections],
  )
  const snapContext = useMemo(() => ({
    mode: snapMode,
    beatGridMs,
    wordBoundaryMs: wordBoundaryMs.map(boundary => toEffectiveLyricTimeMs(boundary, globalOffsetMs)),
    millisecondGridMs: 10,
    frameRate: 30,
  }), [beatGridMs, globalOffsetMs, snapMode, wordBoundaryMs])

  useEffect(() => {
    if (!selectedCueId && orderedCues.length > 0) selectCue(orderedCues[0].id)
    if (selectedCueId && !cues.some(cue => cue.id === selectedCueId)) selectCue(orderedCues[0]?.id ?? null)
  }, [cues, orderedCues, selectCue, selectedCueId])

  useEffect(() => {
    if (!canUseSnapMode(snapMode, { beatGridMs, wordBoundaryMs })) setSnapMode('none')
  }, [beatGridMs, setSnapMode, snapMode, wordBoundaryMs])

  useEffect(() => {
    if (!navigationTarget || !cues.some(cue => cue.id === navigationTarget.cueId)) return
    setFilter('all')
    selectCue(navigationTarget.cueId)
    const frame = requestAnimationFrame(() => {
      const row = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[data-cue-row-id]') ?? [])
        .find(element => element.dataset.cueRowId === navigationTarget.cueId)
      const behavior: ScrollBehavior = typeof window !== 'undefined'
        && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth'
      row?.scrollIntoView?.({ block: 'center', behavior })
      if (!navigationTarget.wordId) row?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [cues, navigationTarget, selectCue])

  const focusCue = useCallback((cueId: string | null) => {
    if (!cueId) return
    requestAnimationFrame(() => {
      const row = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[data-cue-row-id]') ?? [])
        .find(element => element.dataset.cueRowId === cueId)
      row?.focus()
    })
  }, [])

  const replaceCues = useCallback((next: LyricCue[], selectedId: string | null) => {
    setCues(next.map(cue => normalizeCue(cue, durationMs)))
    selectCue(selectedId)
    focusCue(selectedId)
  }, [durationMs, focusCue, selectCue, setCues])

  const commitCuePatch = useCallback((cueId: string, patch: Partial<Omit<LyricCue, 'id'>>) => {
    const current = cues.find(cue => cue.id === cueId)
    if (!current) return
    const normalized = normalizeCue({ ...current, ...patch, id: current.id }, durationMs)
    const { id: _id, ...nextPatch } = normalized
    updateCue(cueId, nextPatch)
  }, [cues, durationMs, updateCue])

  const addAtPlayhead = useCallback(() => {
    const cue = addCueAtPlayhead(createCueId(), canonicalPlayheadMs ?? 0, durationMs)
    replaceCues([...cues, cue], cue.id)
  }, [canonicalPlayheadMs, cues, durationMs, replaceCues])

  const addAtTimelineTime = useCallback((displayedTimeMs: number) => {
    const canonicalTimeMs = Math.max(0, toCanonicalLyricTimeMs(displayedTimeMs, globalOffsetMs))
    const cue = addCueAtPlayhead(createCueId(), canonicalTimeMs, durationMs)
    replaceCues([...cues, cue], cue.id)
  }, [cues, durationMs, globalOffsetMs, replaceCues])

  const duplicateSelected = useCallback(() => {
    if (!selectedCue) return
    const copy = duplicateCue(selectedCue, createCueId(), durationMs)
    replaceCues([...cues, copy], copy.id)
  }, [cues, durationMs, replaceCues, selectedCue])

  const splitSelected = useCallback(() => {
    if (!selectedCue || canonicalPlayheadMs === null) return
    const split = splitCue(selectedCue, canonicalPlayheadMs, createCueId(), createCueId())
    if (!split) return
    replaceCues(cues.flatMap(cue => cue.id === selectedCue.id ? split : [cue]), split[1].id)
  }, [canonicalPlayheadMs, cues, replaceCues, selectedCue])

  const mergeSelected = useCallback((direction: -1 | 1) => {
    if (!selectedCue || selectedIndex < 0) return
    const adjacent = orderedCues[selectedIndex + direction]
    if (!adjacent) return
    const first = direction < 0 ? adjacent : selectedCue
    const second = direction < 0 ? selectedCue : adjacent
    const merged = mergeCues(first, second, selectedCue.id)
    replaceCues(cues.filter(cue => cue.id !== first.id && cue.id !== second.id).concat(merged), merged.id)
  }, [cues, orderedCues, replaceCues, selectedCue, selectedIndex])

  const deleteSelected = useCallback(() => {
    if (!selectedCue) return
    const fallback = orderedCues[selectedIndex + 1]?.id ?? orderedCues[selectedIndex - 1]?.id ?? null
    deleteCue(selectedCue.id)
    selectCue(fallback)
    focusCue(fallback)
  }, [deleteCue, focusCue, orderedCues, selectCue, selectedCue, selectedIndex])

  const handleCueContextAction = useCallback((cueId: string, action: LyricCueContextAction, displayedTimeMs: number) => {
    const cue = orderedCues.find(item => item.id === cueId)
    if (!cue) return
    const index = orderedCues.findIndex(item => item.id === cueId)
    if (action === 'delete') {
      const fallback = orderedCues[index + 1]?.id ?? orderedCues[index - 1]?.id ?? null
      deleteCue(cueId)
      selectCue(fallback)
      return
    }
    if (action === 'mark-reviewed') {
      updateCue(cueId, { reviewStatus: 'reviewed' })
      return
    }
    if (action === 'duplicate') {
      const copy = duplicateCue(cue, createCueId(), durationMs)
      replaceCues([...cues, copy], copy.id)
      return
    }
    if (action === 'split') {
      const canonicalTimeMs = Math.max(0, toCanonicalLyricTimeMs(displayedTimeMs, globalOffsetMs))
      const split = splitCue(cue, canonicalTimeMs, createCueId(), createCueId())
      if (split) replaceCues(cues.flatMap(item => item.id === cueId ? split : [item]), split[1].id)
      return
    }
    const adjacent = action === 'merge-previous' ? orderedCues[index - 1] : orderedCues[index + 1]
    if (!adjacent) return
    const first = action === 'merge-previous' ? adjacent : cue
    const second = action === 'merge-previous' ? cue : adjacent
    const merged = mergeCues(first, second, cue.id)
    replaceCues(cues.filter(item => item.id !== first.id && item.id !== second.id).concat(merged), merged.id)
  }, [cues, deleteCue, durationMs, globalOffsetMs, orderedCues, replaceCues, selectCue, updateCue])

  const commitWords = useCallback((cueId: string, words: LyricWord[]) => {
    const cue = cues.find(item => item.id === cueId)
    if (!cue) return
    const groups = retainLyricGroupsForWords(cue.groups, words)
    updateCue(cueId, { words, groups: groups?.length ? groups : undefined })
  }, [cues, updateCue])

  const actions: LyricCueActionHandlers | null = selectedCue ? {
    setStartToPlayhead: () => {
      if (canonicalPlayheadMs === null) return
      const bounds = resizeCueStart(selectedCue, canonicalPlayheadMs, durationMs)
      setCueBounds(selectedCue.id, bounds.startMs, bounds.endMs)
    },
    setEndToPlayhead: () => {
      if (canonicalPlayheadMs === null) return
      const bounds = resizeCueEnd(selectedCue, canonicalPlayheadMs, durationMs)
      setCueBounds(selectedCue.id, bounds.startMs, bounds.endMs)
    },
    moveToPlayhead: () => {
      if (canonicalPlayheadMs === null) return
      commitCuePatch(selectedCue.id, moveCueToStart(selectedCue, canonicalPlayheadMs, durationMs))
    },
    addAtPlayhead,
    duplicate: duplicateSelected,
    split: splitSelected,
    mergePrevious: () => mergeSelected(-1),
    mergeNext: () => mergeSelected(1),
    delete: deleteSelected,
  } : null

  const cueIssues = useMemo(() => new Map(cues.map(cue => [cue.id, getCueIssues(cue, cues, durationMs)])), [cues, durationMs])
  const filteredCues = orderedCues.filter(cue => cueMatchesFilter(cue, filter, cueIssues.get(cue.id) ?? []))
  const inactiveCueIds = useMemo(() => new Set(
    orderedCues
      .filter(cue => !cueMatchesFilter(cue, filter, cueIssues.get(cue.id) ?? []))
      .map(cue => cue.id),
  ), [cueIssues, filter, orderedCues])
  const beatGridHint = beatGridStatus === 'trusted'
    ? null
    : beatGridStatusMessage ?? (beatGridMs.length >= 2
      ? 'Beat snapping is using a temporary BPM grid. Run analysis to replace it with detected beats.'
      : 'Beat snapping unavailable. Load or analyze this track to build a beat grid.')

  return {
    rootRef,
    cues,
    orderedCues,
    selectedCueId,
    selectedCue,
    selectedIndex,
    canonicalPlayheadMs,
    getCurrentTimeMs,
    cueHistoryPast,
    cueHistoryFuture,
    undoCueEdit,
    redoCueEdit,
    selectCue,
    updateCueWord,
    snapMode,
    setSnapMode,
    snapContext,
    overlaySource,
    overlayVisibility,
    setOverlayVisibility,
    filter,
    setFilter,
    filteredCues,
    inactiveCueIds,
    cueIssues,
    peaks,
    loading,
    waveformZoom,
    setWaveformZoom,
    actions,
    commitCuePatch,
    commitWords,
    addAtPlayhead,
    addAtTimelineTime,
    handleCueContextAction,
    focusCue,
    sections,
    beatGridHint,
    beatGridMs,
    wordBoundaryMs,
  }
}
