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

const MIN_CUE_DURATION_MS = 100
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

  // Sync setters
  setLyricsEnabled(enabled: boolean): void
  setActiveDocument(document: LyricDocument | null, cues?: LyricCue[]): void
  setCues(cues: LyricCue[]): void
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

  // Async actions
  loadLyricDocument(documentId: string): Promise<void>
  loadLyricsForAudioTrack(audioTrackId: string): Promise<void>
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
  }
}

function buildDocumentInput(state: LyricsState): CreateLyricDocumentInput {
  const current = state.activeDocument
  const importedSource = state.draftSourceType !== null

  return {
    title: state.draftTitle,
    artist: state.draftArtist,
    audioTrackId: current?.audioTrackId ?? state.activeAudioTrackId,
    visualSessionId: current?.visualSessionId ?? null,
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

  // ── Sync setters ────────────────────────────────────────────────────────────

  setLyricsEnabled: (enabled) => set({ lyricsEnabled: enabled }),

  setActiveDocument: (document, cues = []) => {
    // Manual document selection or editing wins over any in-flight automatic lookup.
    beginLyricLoad()
    set(activeDocumentState(document, cues))
  },

  setCues:           (cues)      => set({ cues }),
  setGlobalOffsetMs: (offsetMs)  => set({ globalOffsetMs: offsetMs }),
  setDraftTitle:     (title)     => set({ draftTitle: title }),
  setDraftArtist:    (artist)    => set({ draftArtist: artist }),

  setDraftSourceMeta: (meta) => set({
    draftSourceType:     meta.sourceType    !== undefined ? meta.sourceType    : null,
    draftSourceFormat:   meta.sourceFormat  !== undefined ? meta.sourceFormat  : null,
    draftRawSourceText:  meta.rawSourceText !== undefined ? meta.rawSourceText : null,
    draftMetadata:       meta.metadata      !== undefined ? meta.metadata      : null,
  }),

  setError:          (error)     => set({ error }),

  updateDraftDefaultStyle: (patch) =>
    set(s => ({ draftDefaultStyle: { ...s.draftDefaultStyle, ...patch } })),

  updateDraftDefaultAnimation: (patch) =>
    set(s => ({ draftDefaultAnimation: { ...s.draftDefaultAnimation, ...patch } })),

  updateDraftDefaultEffects: (patch) =>
    set(s => ({ draftDefaultEffects: { ...s.draftDefaultEffects, ...patch } })),

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
    })
  },

  // ── Timeline timing editing ────────────────────────────────────────────────

  selectCue: (cueId) => set({ selectedCueId: cueId }),

  updateCueTiming: (cueId, patch) => {
    set(s => {
      const idx = s.cues.findIndex(c => c.id === cueId)
      if (idx === -1) return {}
      const cue = s.cues[idx]
      const newStart = patch.startMs !== undefined ? Math.max(0, patch.startMs) : cue.startMs
      const newEnd   = patch.endMs   !== undefined ? patch.endMs : cue.endMs
      const safeEnd  = Math.max(newStart + MIN_CUE_DURATION_MS, newEnd)
      const next = [...s.cues]
      next[idx] = { ...cue, startMs: newStart, endMs: safeEnd }
      return { cues: next, lyricTimingDirty: true }
    })
  },

  moveCue: (cueId, deltaMs) => {
    set(s => {
      const idx = s.cues.findIndex(c => c.id === cueId)
      if (idx === -1) return {}
      const cue = s.cues[idx]
      const dur = cue.endMs - cue.startMs
      const newStart = Math.max(0, cue.startMs + deltaMs)
      const next = [...s.cues]
      next[idx] = { ...cue, startMs: newStart, endMs: newStart + dur }
      return { cues: next, lyricTimingDirty: true }
    })
  },

  setCueBounds: (cueId, startMs, endMs) => {
    const safeStart = Math.max(0, startMs)
    const safeEnd   = Math.max(safeStart + MIN_CUE_DURATION_MS, endMs)
    set(s => {
      const idx = s.cues.findIndex(c => c.id === cueId)
      if (idx === -1) return {}
      const next = [...s.cues]
      next[idx] = { ...s.cues[idx], startMs: safeStart, endMs: safeEnd }
      return { cues: next, lyricTimingDirty: true }
    })
  },

  deleteCue: (cueId) => {
    set(s => {
      const next = s.cues.filter(c => c.id !== cueId)
      const clearSelected = s.selectedCueId === cueId ? { selectedCueId: null } : {}
      return { cues: next, lyricTimingDirty: true, ...clearSelected }
    })
  },

  clearCues: () => set({ cues: [], selectedCueId: null, lyricTimingDirty: true }),

  addCue: (cue) => {
    const id = crypto.randomUUID()
    const newCue: LyricCue = { ...cue, id, source: cue.source ?? 'manual' }
    set(s => {
      const next = [...s.cues, newCue].sort((a, b) => a.startMs - b.startMs)
      return { cues: next, selectedCueId: id, lyricTimingDirty: true }
    })
    return newCue
  },

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

  loadLyricsForAudioTrack: async (audioTrackId) => {
    const current = get()
    // React StrictMode and provider re-renders may repeat the same linkage. Preserve
    // current edits and avoid another request until a genuinely different track is selected.
    if (current.activeAudioTrackId === audioTrackId) return

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
        activate: true,
      })

      if (!result.ok) {
        if (isCurrentLyricLoad(generation)) {
          set({ error: result.message, lastPersistenceFailure: result })
        }
        return result
      }

      if (isCurrentLyricLoad(generation)) {
        set(activeDocumentState(result.document, result.cues))
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
        set(activeDocumentState(result.document, result.cues))
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
        set(activeDocumentState(result.document, cues))
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
        set(activeDocumentState(result.document, result.cues))
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
