import { create } from 'zustand'
import { supabaseConfigured } from '../lib/supabase'
import {
  activateLyricDocument as activateLyricDocumentRpc,
  getLyricDocumentById,
  getLyricCuesForDocument,
  getActiveLyricDocumentForAudioTrack,
  getActiveLyricDocumentForVisualSession,
  saveLyricDocumentAtomic,
} from '../lib/lyricsDb'
import {
  normalizeCue,
  normalizeCueBounds,
  shiftCue,
} from '../features/lyrics/editor/lyricCueEditorModel'
import type {
  LyricDocument,
  LyricCue,
  LyricStyle,
  LyricAnimation,
  LyricEffects,
  LyricDocumentSourceType,
  LyricDocumentSourceFormat,
  CreateLyricCueInput,
  CreateLyricDocumentInput,
  ActivateLyricDocumentResult,
  LyricPersistenceFailure,
  SaveLyricDocumentResult,
} from '../types/lyrics'
import { createLyricCueInputFromCue } from '../types/lyrics'

// ── State shape ───────────────────────────────────────────────────────────────

export interface LyricsState {
  lyricsEnabled:       boolean
  activeDocumentId:    string | null
  activeDocument:      LyricDocument | null
  /** audio_tracks ID whose automatic lyric lookup currently owns the active lyric state. */
  activeAudioTrackId:   string | null
  cues:                LyricCue[]
  isLoading:           boolean
  isSaving:            boolean
  error:               string | null
  lastPersistenceFailure: LyricPersistenceFailure | null

  draftTitle:            string
  draftArtist:           string
  draftDefaultStyle:     Partial<LyricStyle>
  draftDefaultAnimation: Partial<LyricAnimation>
  draftDefaultEffects:   Partial<LyricEffects>
  globalOffsetMs:        number

  draftSourceType:     LyricDocumentSourceType | null
  draftSourceFormat:   LyricDocumentSourceFormat | null
  draftRawSourceText:  string | null
  draftMetadata:       Record<string, unknown> | null

  /** ID of the cue currently selected in the Timeline (shared with Lyric Manager). */
  selectedCueId:       string | null
  /** True when cue timing has been edited locally but not yet persisted. */
  lyricTimingDirty:    boolean
  /** True while the track-first Lyric Manager owns draft selection and blocks automatic track sync. */
  editorSessionActive: boolean
  /** Unsaved document fields or cue edits in the Lyric Manager. */
  editorDirty:         boolean
  /** Whether the next document save should atomically make this version active. */
  draftActivateOnSave: boolean
  /** Preserve the currently selected draft for one intentional visualizer preview exit. */
  skipNextEditorResync: boolean
  /** Bounded, lyric-only edit history. Drag previews are committed once on pointer release. */
  cueHistoryPast: LyricCue[][]
  cueHistoryFuture: LyricCue[][]

  // Sync setters
  setLyricsEnabled(enabled: boolean): void
  setActiveDocument(document: LyricDocument | null, cues?: LyricCue[], activeAudioTrackId?: string | null): void
  setCues(cues: LyricCue[]): void
  updateCue(cueId: string, patch: Partial<Omit<LyricCue, 'id'>>): void
  setGlobalOffsetMs(offsetMs: number): void
  updateDraftDefaultStyle(patch: Partial<LyricStyle>): void
  updateDraftDefaultAnimation(patch: Partial<LyricAnimation>): void
  updateDraftDefaultEffects(patch: Partial<LyricEffects>): void
  setDraftTitle(title: string): void
  setDraftArtist(artist: string): void
  setDraftSourceMeta(meta: {
    sourceType?:    LyricDocumentSourceType | null
    sourceFormat?:  LyricDocumentSourceFormat | null
    rawSourceText?: string | null
    metadata?:      Record<string, unknown> | null
  }): void
  setError(error: string | null): void
  beginEditorSession(): void
  endEditorSession(): void
  markEditorDirty(dirty?: boolean): void
  preserveDraftForNextEditorExit(): void
  clearLyrics(): void

  // ── Timeline timing editing ──────────────────────────────────────────────
  /** Select a cue by ID (shared selection between Timeline and Lyric Manager). */
  selectCue(cueId: string | null): void
  /**
   * Update start and/or end time of a single cue.
   * Enforces MIN_CUE_DURATION_MS. Marks lyricTimingDirty.
   * Canvas preview updates immediately (cues array is the live source of truth).
   */
  updateCueTiming(cueId: string, patch: { startMs?: number; endMs?: number }): void
  /**
   * Shift the entire cue by deltaMs, preserving duration.
   * Does not allow start to go below 0 after global offset.
   */
  moveCue(cueId: string, deltaMs: number): void
  /**
   * Set both bounds of a cue. Enforces minimum duration.
   */
  setCueBounds(cueId: string, startMs: number, endMs: number): void
  deleteCue(cueId: string): void
  /** Remove all cues from the timeline. Marks lyricTimingDirty so the empty state can be persisted. */
  clearCues(): void
  /** Append a single cue, sort by startMs, select it, and mark dirty. Returns the created cue. */
  addCue(cue: Omit<LyricCue, 'id'>): LyricCue
  undoCueEdit(): void
  redoCueEdit(): void
  resetCueHistory(): void

  // Async actions
  loadLyricDocument(documentId: string): Promise<void>
  loadLyricsForAudioTrack(audioTrackId: string, force?: boolean): Promise<void>
  loadLyricsForVisualSession(visualSessionId: string): Promise<void>
  saveActiveLyricDocument(cues?: LyricCue[]): Promise<SaveLyricDocumentResult | null>
  replaceActiveCues(inputs: CreateLyricCueInput[]): Promise<SaveLyricDocumentResult | null>
  activateLyricDocument(documentId: string): Promise<ActivateLyricDocumentResult | null>
  /** Persist current cue timing to the active lyric document. No-op when no document. */
  saveTimingChanges(): Promise<SaveLyricDocumentResult | null>
}

// A single generation protects all document-loading paths from stale async commits.
let lyricLoadGeneration = 0

function beginLyricLoad(): number {
  lyricLoadGeneration += 1
  return lyricLoadGeneration
}

function isCurrentLyricLoad(generation: number): boolean {
  return generation === lyricLoadGeneration
}

function activeDocumentState(
  document: LyricDocument | null,
  cues: LyricCue[] = [],
  activeAudioTrackId: string | null = document?.audioTrackId ?? null,
  selectedCueId: string | null = null,
): Partial<LyricsState> {
  return {
    activeDocument:        document,
    activeDocumentId:      document?.id ?? null,
    activeAudioTrackId,
    cues,
    draftTitle:            document?.title            ?? '',
    draftArtist:           document?.artist           ?? '',
    draftDefaultStyle:     document?.defaultStyle     ?? {},
    draftDefaultAnimation: document?.defaultAnimation ?? {},
    draftDefaultEffects:   document?.defaultEffects   ?? {},
    globalOffsetMs:        document?.globalOffsetMs   ?? 0,
    draftSourceType:       null,
    draftSourceFormat:     null,
    draftRawSourceText:    null,
    draftMetadata:         null,
    error:                 null,
    lastPersistenceFailure: null,
    lyricTimingDirty:      false,
    editorDirty:           false,
    draftActivateOnSave:   document?.isActive ?? true,
    selectedCueId:         selectedCueId && cues.some(cue => cue.id === selectedCueId) ? selectedCueId : null,
    cueHistoryPast:        [],
    cueHistoryFuture:      [],
  }
}

const MAX_CUE_HISTORY = 50

function cueCollectionsEqual(left: LyricCue[], right: LyricCue[]): boolean {
  if (left === right) return true
  if (left.length !== right.length) return false
  return JSON.stringify(left) === JSON.stringify(right)
}

function commitCueCollection(
  state: LyricsState,
  cues: LyricCue[],
  selectedCueId: string | null = state.selectedCueId,
): Partial<LyricsState> {
  const next = cues
  if (cueCollectionsEqual(state.cues, next)) return {}
  return {
    cues: next,
    selectedCueId: selectedCueId && next.some(cue => cue.id === selectedCueId) ? selectedCueId : null,
    cueHistoryPast: [...state.cueHistoryPast, state.cues].slice(-MAX_CUE_HISTORY),
    cueHistoryFuture: [],
    lyricTimingDirty: true,
    editorDirty: state.editorSessionActive ? true : state.editorDirty,
  }
}

function buildDocumentInput(state: LyricsState): CreateLyricDocumentInput {
  const current = state.activeDocument
  const importedSource = state.draftSourceType !== null

  return {
    title: state.draftTitle,
    artist: state.draftArtist,
    // Existing legacy documents keep their explicit null association. New drafts inherit
    // the editor-selected persisted track through activeAudioTrackId.
    audioTrackId: current ? (current.audioTrackId ?? null) : state.activeAudioTrackId,
    visualSessionId: current ? (current.visualSessionId ?? null) : null,
    sourceType: state.draftSourceType ?? current?.sourceType ?? 'manual',
    sourceFormat: state.draftSourceFormat ?? current?.sourceFormat ?? 'json',
    rawSourceText: importedSource
      ? state.draftRawSourceText
      : current?.rawSourceText ?? null,
    defaultStyle: state.draftDefaultStyle,
    defaultAnimation: state.draftDefaultAnimation,
    defaultEffects: state.draftDefaultEffects,
    globalOffsetMs: state.globalOffsetMs,
    metadata: importedSource
      ? state.draftMetadata ?? {}
      : current?.metadata ?? {},
  }
}

function cueInputs(cues: LyricCue[], documentId: string): CreateLyricCueInput[] {
  return cues.map((cue, index) => createLyricCueInputFromCue(cue, documentId, index))
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useLyricsStore = create<LyricsState>((set, get) => ({
  lyricsEnabled:       false,
  activeDocumentId:    null,
  activeDocument:      null,
  activeAudioTrackId:   null,
  cues:                [],
  isLoading:           false,
  isSaving:            false,
  error:               null,
  lastPersistenceFailure: null,

  draftTitle:            '',
  draftArtist:           '',
  draftDefaultStyle:     {},
  draftDefaultAnimation: {},
  draftDefaultEffects:   {},
  globalOffsetMs:        0,

  draftSourceType:     null,
  draftSourceFormat:   null,
  draftRawSourceText:  null,
  draftMetadata:       null,

  selectedCueId:       null,
  lyricTimingDirty:    false,
  editorSessionActive: false,
  editorDirty:         false,
  draftActivateOnSave: true,
  skipNextEditorResync: false,
  cueHistoryPast:      [],
  cueHistoryFuture:    [],

  // ── Sync setters ────────────────────────────────────────────────────────────

  setLyricsEnabled: (enabled) => set({ lyricsEnabled: enabled }),

  setActiveDocument: (document, cues = [], activeAudioTrackId) => {
    // Manual document selection or editing wins over any in-flight automatic lookup.
    beginLyricLoad()
    set(activeDocumentState(
      document,
      cues,
      activeAudioTrackId !== undefined ? activeAudioTrackId : (document?.audioTrackId ?? null),
    ))
  },

  setCues: (cues) => set(state => commitCueCollection(state, cues)),
  updateCue: (cueId, patch) => set(state => {
    const cue = state.cues.find(item => item.id === cueId)
    if (!cue) return {}
    const nextCue = normalizeCue({ ...cue, ...patch, id: cue.id })
    return commitCueCollection(
      state,
      state.cues.map(item => item.id === cueId ? nextCue : item),
      cueId,
    )
  }),
  setGlobalOffsetMs: (offsetMs)  => set(state => ({ globalOffsetMs: offsetMs, editorDirty: state.editorSessionActive ? true : state.editorDirty })),
  setDraftTitle:     (title)     => set(state => ({ draftTitle: title, editorDirty: state.editorSessionActive ? true : state.editorDirty })),
  setDraftArtist:    (artist)    => set(state => ({ draftArtist: artist, editorDirty: state.editorSessionActive ? true : state.editorDirty })),

  setDraftSourceMeta: (meta) => set(state => ({
    draftSourceType:     meta.sourceType    !== undefined ? meta.sourceType    : null,
    draftSourceFormat:   meta.sourceFormat  !== undefined ? meta.sourceFormat  : null,
    draftRawSourceText:  meta.rawSourceText !== undefined ? meta.rawSourceText : null,
    draftMetadata:       meta.metadata      !== undefined ? meta.metadata      : null,
    editorDirty:         state.editorSessionActive ? true : state.editorDirty,
  })),

  setError:          (error)     => set({ error }),
  beginEditorSession: () => set({ editorSessionActive: true, skipNextEditorResync: false }),
  endEditorSession:   () => set({ editorSessionActive: false, editorDirty: false }),
  markEditorDirty:    (dirty = true) => set({ editorDirty: dirty }),
  preserveDraftForNextEditorExit: () => set({ skipNextEditorResync: true }),

  updateDraftDefaultStyle: (patch) =>
    set(s => ({ draftDefaultStyle: { ...s.draftDefaultStyle, ...patch }, editorDirty: s.editorSessionActive ? true : s.editorDirty })),

  updateDraftDefaultAnimation: (patch) =>
    set(s => ({ draftDefaultAnimation: { ...s.draftDefaultAnimation, ...patch }, editorDirty: s.editorSessionActive ? true : s.editorDirty })),

  updateDraftDefaultEffects: (patch) =>
    set(s => ({ draftDefaultEffects: { ...s.draftDefaultEffects, ...patch }, editorDirty: s.editorSessionActive ? true : s.editorDirty })),

  clearLyrics: () => {
    beginLyricLoad()
    set({
      lyricsEnabled:         false,
      activeDocumentId:      null,
      activeDocument:        null,
      activeAudioTrackId:    null,
      cues:                  [],
      isLoading:             false,
      draftTitle:            '',
      draftArtist:           '',
      draftDefaultStyle:     {},
      draftDefaultAnimation: {},
      draftDefaultEffects:   {},
      globalOffsetMs:        0,
      draftSourceType:       null,
      draftSourceFormat:     null,
      draftRawSourceText:    null,
      draftMetadata:         null,
      error:                 null,
      lastPersistenceFailure: null,
      selectedCueId:         null,
      lyricTimingDirty:      false,
      editorDirty:           false,
      draftActivateOnSave:   true,
      skipNextEditorResync:   false,
      cueHistoryPast:         [],
      cueHistoryFuture:       [],
    })
  },

  // ── Timeline timing editing ────────────────────────────────────────────────

  selectCue: (cueId) => set({ selectedCueId: cueId }),

  updateCueTiming: (cueId, patch) => {
    set(s => {
      const idx = s.cues.findIndex(c => c.id === cueId)
      if (idx === -1) return {}
      const cue = s.cues[idx]
      const bounds = normalizeCueBounds(
        patch.startMs ?? cue.startMs,
        patch.endMs ?? cue.endMs,
      )
      const next = [...s.cues]
      next[idx] = { ...cue, ...bounds }
      return commitCueCollection(s, next, cueId)
    })
  },

  moveCue: (cueId, deltaMs) => {
    set(s => {
      const idx = s.cues.findIndex(c => c.id === cueId)
      if (idx === -1) return {}
      const cue = s.cues[idx]
      const next = [...s.cues]
      next[idx] = { ...cue, ...shiftCue(cue, deltaMs) }
      return commitCueCollection(s, next, cueId)
    })
  },

  setCueBounds: (cueId, startMs, endMs) => {
    const bounds = normalizeCueBounds(startMs, endMs)
    set(s => {
      const idx = s.cues.findIndex(c => c.id === cueId)
      if (idx === -1) return {}
      const next = [...s.cues]
      next[idx] = { ...s.cues[idx], ...bounds }
      return commitCueCollection(s, next, cueId)
    })
  },

  deleteCue: (cueId) => {
    set(s => {
      const next = s.cues.filter(c => c.id !== cueId)
      return commitCueCollection(s, next, s.selectedCueId === cueId ? null : s.selectedCueId)
    })
  },

  clearCues: () => set(s => commitCueCollection(s, [], null)),

  addCue: (cue) => {
    const id = crypto.randomUUID()
    const newCue: LyricCue = normalizeCue({ ...cue, id, source: cue.source ?? 'manual' })
    set(s => {
      return commitCueCollection(s, [...s.cues, newCue], id)
    })
    return newCue
  },

  undoCueEdit: () => set(state => {
    const previous = state.cueHistoryPast[state.cueHistoryPast.length - 1]
    if (!previous) return {}
    return {
      cues: previous,
      selectedCueId: state.selectedCueId && previous.some(cue => cue.id === state.selectedCueId)
        ? state.selectedCueId
        : null,
      cueHistoryPast: state.cueHistoryPast.slice(0, -1),
      cueHistoryFuture: [state.cues, ...state.cueHistoryFuture].slice(0, MAX_CUE_HISTORY),
      lyricTimingDirty: true,
      editorDirty: state.editorSessionActive ? true : state.editorDirty,
    }
  }),

  redoCueEdit: () => set(state => {
    const next = state.cueHistoryFuture[0]
    if (!next) return {}
    return {
      cues: next,
      selectedCueId: state.selectedCueId && next.some(cue => cue.id === state.selectedCueId)
        ? state.selectedCueId
        : null,
      cueHistoryPast: [...state.cueHistoryPast, state.cues].slice(-MAX_CUE_HISTORY),
      cueHistoryFuture: state.cueHistoryFuture.slice(1),
      lyricTimingDirty: true,
      editorDirty: state.editorSessionActive ? true : state.editorDirty,
    }
  }),

  resetCueHistory: () => set({ cueHistoryPast: [], cueHistoryFuture: [] }),

  // ── Async actions ────────────────────────────────────────────────────────────

  loadLyricDocument: async (documentId) => {
    if (!supabaseConfigured) return
    const generation = beginLyricLoad()
    set({ isLoading: true, error: null })
    try {
      const [doc, cues] = await Promise.all([
        getLyricDocumentById(documentId),
        getLyricCuesForDocument(documentId),
      ])
      if (!isCurrentLyricLoad(generation)) return
      set(activeDocumentState(doc, cues))
    } catch (err) {
      if (!isCurrentLyricLoad(generation)) return
      set({ error: err instanceof Error ? err.message : 'Failed to load lyric document' })
    } finally {
      if (isCurrentLyricLoad(generation)) set({ isLoading: false })
    }
  },

  loadLyricsForAudioTrack: async (audioTrackId, force = false) => {
    const current = get()
    // React StrictMode and provider re-renders may repeat the same linkage. Preserve
    // current edits and avoid another request until a genuinely different track is selected.
    if (!force && current.activeAudioTrackId === audioTrackId) return

    const generation = beginLyricLoad()
    set({
      ...activeDocumentState(null, [], audioTrackId),
      isLoading: supabaseConfigured,
      error: null,
    })
    if (!supabaseConfigured) return

    try {
      const doc = await getActiveLyricDocumentForAudioTrack(audioTrackId)
      if (!isCurrentLyricLoad(generation)) return
      if (!doc) {
        set(activeDocumentState(null, [], audioTrackId))
        return
      }

      const cues = await getLyricCuesForDocument(doc.id)
      if (!isCurrentLyricLoad(generation)) return
      set(activeDocumentState(doc, cues, audioTrackId))
    } catch (err) {
      if (!isCurrentLyricLoad(generation)) return
      set({ error: err instanceof Error ? err.message : 'Failed to load lyrics for audio track' })
    } finally {
      if (isCurrentLyricLoad(generation)) set({ isLoading: false })
    }
  },

  loadLyricsForVisualSession: async (visualSessionId) => {
    if (!supabaseConfigured) return
    const generation = beginLyricLoad()
    set({
      ...activeDocumentState(null),
      isLoading: true,
      error: null,
    })
    try {
      const doc = await getActiveLyricDocumentForVisualSession(visualSessionId)
      if (!isCurrentLyricLoad(generation)) return
      if (!doc) {
        set(activeDocumentState(null))
        return
      }
      const cues = await getLyricCuesForDocument(doc.id)
      if (!isCurrentLyricLoad(generation)) return
      set(activeDocumentState(doc, cues))
    } catch (err) {
      if (!isCurrentLyricLoad(generation)) return
      set({ error: err instanceof Error ? err.message : 'Failed to load lyrics for visual session' })
    } finally {
      if (isCurrentLyricLoad(generation)) set({ isLoading: false })
    }
  },

  saveActiveLyricDocument: async (cues) => {
    if (!supabaseConfigured) {
      set({ error: 'Supabase is not configured.' })
      return null
    }
    const s = get()
    const cueSnapshot = cues ?? s.cues
    const generation = beginLyricLoad()
    set({ isSaving: true, error: null, lastPersistenceFailure: null })
    try {
      const result = await saveLyricDocumentAtomic({
        documentId: s.activeDocumentId,
        expectedRevision: s.activeDocument?.revision ?? null,
        document: buildDocumentInput(s),
        cues: cueInputs(cueSnapshot, s.activeDocumentId ?? ''),
        activate: s.draftActivateOnSave,
      })

      if (!result.ok) {
        if (isCurrentLyricLoad(generation)) {
          set({ error: result.message, lastPersistenceFailure: result })
        }
        return result
      }

      if (isCurrentLyricLoad(generation)) {
        set(activeDocumentState(result.document, result.cues, result.document.audioTrackId ?? null, s.selectedCueId))
      }
      return result
    } catch (err) {
      if (isCurrentLyricLoad(generation)) {
        set({ error: err instanceof Error ? err.message : 'Failed to save lyric document' })
      }
      return null
    } finally {
      set({ isSaving: false })
    }
  },

  replaceActiveCues: async (inputs) => {
    const { activeDocumentId } = get()
    if (!activeDocumentId) {
      set({ error: 'Save the lyric document first before replacing cues.' })
      return null
    }
    if (!supabaseConfigured) {
      set({ error: 'Supabase is not configured.' })
      return null
    }
    const state = get()
    const generation = beginLyricLoad()
    set({ isSaving: true, error: null, lastPersistenceFailure: null })
    try {
      const result = await saveLyricDocumentAtomic({
        documentId: activeDocumentId,
        expectedRevision: state.activeDocument?.revision ?? null,
        document: buildDocumentInput(state),
        cues: inputs,
        activate: state.activeDocument?.isActive ?? true,
      })
      if (!result.ok) {
        if (isCurrentLyricLoad(generation)) {
          set({ error: result.message, lastPersistenceFailure: result })
        }
        return result
      }
      if (isCurrentLyricLoad(generation)) {
        set(activeDocumentState(result.document, result.cues, result.document.audioTrackId ?? null, state.selectedCueId))
      }
      return result
    } catch (err) {
      if (isCurrentLyricLoad(generation)) {
        set({ error: err instanceof Error ? err.message : 'Failed to replace lyric cues' })
      }
      return null
    } finally {
      set({ isSaving: false })
    }
  },

  activateLyricDocument: async (documentId) => {
    if (!supabaseConfigured) {
      set({ error: 'Supabase is not configured.' })
      return null
    }
    const state = get()
    const generation = beginLyricLoad()
    const expectedRevision = state.activeDocumentId === documentId
      ? state.activeDocument?.revision ?? null
      : null
    set({ isSaving: true, error: null, lastPersistenceFailure: null })
    try {
      const result = await activateLyricDocumentRpc(documentId, expectedRevision)
      if (!result.ok) {
        if (isCurrentLyricLoad(generation)) {
          set({ error: result.message, lastPersistenceFailure: result })
        }
        return result
      }
      const cues = state.activeDocumentId === documentId
        ? state.cues
        : await getLyricCuesForDocument(documentId)
      if (isCurrentLyricLoad(generation)) {
        set(activeDocumentState(result.document, cues, result.document.audioTrackId ?? null, state.selectedCueId))
      }
      return result
    } catch (err) {
      if (isCurrentLyricLoad(generation)) {
        set({ error: err instanceof Error ? err.message : 'Failed to activate lyric document' })
      }
      return null
    } finally {
      set({ isSaving: false })
    }
  },

  saveTimingChanges: async () => {
    const s = get()
    if (!s.activeDocumentId) {
      // No document — timing changes are local-only for this session.
      return null
    }
    if (!supabaseConfigured) return null
    if (!s.lyricTimingDirty) return null
    const generation = beginLyricLoad()
    set({ isSaving: true, error: null, lastPersistenceFailure: null })
    try {
      const result = await saveLyricDocumentAtomic({
        documentId: s.activeDocumentId,
        expectedRevision: s.activeDocument?.revision ?? null,
        document: buildDocumentInput(s),
        cues: cueInputs(s.cues, s.activeDocumentId),
        activate: s.activeDocument?.isActive ?? true,
      })
      if (!result.ok) {
        if (isCurrentLyricLoad(generation)) {
          set({ error: result.message, lastPersistenceFailure: result })
        }
        return result
      }
      if (isCurrentLyricLoad(generation)) {
        set(activeDocumentState(result.document, result.cues, result.document.audioTrackId ?? null, s.selectedCueId))
      }
      return result
    } catch (err) {
      if (isCurrentLyricLoad(generation)) {
        set({ error: err instanceof Error ? err.message : 'Failed to save lyric timing' })
      }
      return null
    } finally {
      set({ isSaving: false })
    }
  },
}))

export const selectLyricsLoading = (state: LyricsState): boolean => state.isLoading

export const selectActiveLyricsAudioTrackId = (state: LyricsState): string | null =>
  state.activeAudioTrackId

export const selectHasActiveLyricDocument = (state: LyricsState): boolean =>
  state.activeDocument !== null

export const selectActiveTrackHasLyricDocument = (state: LyricsState): boolean =>
  state.activeAudioTrackId !== null &&
  state.activeDocument !== null &&
  state.activeDocument.audioTrackId === state.activeAudioTrackId
