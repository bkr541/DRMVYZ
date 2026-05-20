import { create } from 'zustand'
import { supabaseConfigured } from '../lib/supabase'
import {
  getLyricDocumentById,
  getLyricCuesForDocument,
  getActiveLyricDocumentForAudioTrack,
  getActiveLyricDocumentForVisualSession,
  createLyricDocument,
  updateLyricDocument,
  replaceLyricCuesForDocument,
} from '../lib/lyricsDb'
import type {
  LyricDocument,
  LyricCue,
  LyricStyle,
  LyricAnimation,
  LyricEffects,
  CreateLyricCueInput,
} from '../types/lyrics'

// ── State shape ───────────────────────────────────────────────────────────────

interface LyricsState {
  lyricsEnabled:       boolean
  activeDocumentId:    string | null
  activeDocument:      LyricDocument | null
  cues:                LyricCue[]
  isLoading:           boolean
  isSaving:            boolean
  error:               string | null

  draftTitle:            string
  draftArtist:           string
  draftDefaultStyle:     Partial<LyricStyle>
  draftDefaultAnimation: Partial<LyricAnimation>
  draftDefaultEffects:   Partial<LyricEffects>
  globalOffsetMs:        number

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
  setError(error: string | null): void
  clearLyrics(): void

  // Async actions
  loadLyricDocument(documentId: string): Promise<void>
  loadLyricsForAudioTrack(audioTrackId: string): Promise<void>
  loadLyricsForVisualSession(visualSessionId: string): Promise<void>
  saveActiveLyricDocument(): Promise<void>
  replaceActiveCues(inputs: CreateLyricCueInput[]): Promise<void>
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useLyricsStore = create<LyricsState>((set, get) => ({
  lyricsEnabled:       false,
  activeDocumentId:    null,
  activeDocument:      null,
  cues:                [],
  isLoading:           false,
  isSaving:            false,
  error:               null,

  draftTitle:            '',
  draftArtist:           '',
  draftDefaultStyle:     {},
  draftDefaultAnimation: {},
  draftDefaultEffects:   {},
  globalOffsetMs:        0,

  // ── Sync setters ────────────────────────────────────────────────────────────

  setLyricsEnabled: (enabled) => set({ lyricsEnabled: enabled }),

  setActiveDocument: (document, cues = []) => {
    set({
      activeDocument:        document,
      activeDocumentId:      document?.id ?? null,
      cues,
      draftTitle:            document?.title            ?? '',
      draftArtist:           document?.artist           ?? '',
      draftDefaultStyle:     document?.defaultStyle     ?? {},
      draftDefaultAnimation: document?.defaultAnimation ?? {},
      draftDefaultEffects:   document?.defaultEffects   ?? {},
      globalOffsetMs:        document?.globalOffsetMs   ?? 0,
      error:                 null,
    })
  },

  setCues:           (cues)      => set({ cues }),
  setGlobalOffsetMs: (offsetMs)  => set({ globalOffsetMs: offsetMs }),
  setDraftTitle:     (title)     => set({ draftTitle: title }),
  setDraftArtist:    (artist)    => set({ draftArtist: artist }),
  setError:          (error)     => set({ error }),

  updateDraftDefaultStyle: (patch) =>
    set(s => ({ draftDefaultStyle: { ...s.draftDefaultStyle, ...patch } })),

  updateDraftDefaultAnimation: (patch) =>
    set(s => ({ draftDefaultAnimation: { ...s.draftDefaultAnimation, ...patch } })),

  updateDraftDefaultEffects: (patch) =>
    set(s => ({ draftDefaultEffects: { ...s.draftDefaultEffects, ...patch } })),

  clearLyrics: () =>
    set({
      lyricsEnabled:         false,
      activeDocumentId:      null,
      activeDocument:        null,
      cues:                  [],
      draftTitle:            '',
      draftArtist:           '',
      draftDefaultStyle:     {},
      draftDefaultAnimation: {},
      draftDefaultEffects:   {},
      globalOffsetMs:        0,
      error:                 null,
    }),

  // ── Async actions ────────────────────────────────────────────────────────────

  loadLyricDocument: async (documentId) => {
    if (!supabaseConfigured) return
    set({ isLoading: true, error: null })
    try {
      const [doc, cues] = await Promise.all([
        getLyricDocumentById(documentId),
        getLyricCuesForDocument(documentId),
      ])
      get().setActiveDocument(doc, cues)
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load lyric document' })
    } finally {
      set({ isLoading: false })
    }
  },

  loadLyricsForAudioTrack: async (audioTrackId) => {
    if (!supabaseConfigured) return
    set({ isLoading: true, error: null })
    try {
      const doc = await getActiveLyricDocumentForAudioTrack(audioTrackId)
      if (!doc) { get().setActiveDocument(null); return }
      const cues = await getLyricCuesForDocument(doc.id)
      get().setActiveDocument(doc, cues)
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load lyrics for audio track' })
    } finally {
      set({ isLoading: false })
    }
  },

  loadLyricsForVisualSession: async (visualSessionId) => {
    if (!supabaseConfigured) return
    set({ isLoading: true, error: null })
    try {
      const doc = await getActiveLyricDocumentForVisualSession(visualSessionId)
      if (!doc) { get().setActiveDocument(null); return }
      const cues = await getLyricCuesForDocument(doc.id)
      get().setActiveDocument(doc, cues)
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load lyrics for visual session' })
    } finally {
      set({ isLoading: false })
    }
  },

  saveActiveLyricDocument: async () => {
    if (!supabaseConfigured) {
      set({ error: 'Supabase is not configured.' })
      return
    }
    const s = get()
    set({ isSaving: true, error: null })
    try {
      const patch = {
        title:            s.draftTitle,
        artist:           s.draftArtist,
        defaultStyle:     s.draftDefaultStyle,
        defaultAnimation: s.draftDefaultAnimation,
        defaultEffects:   s.draftDefaultEffects,
        globalOffsetMs:   s.globalOffsetMs,
      }

      let doc: LyricDocument
      if (s.activeDocumentId) {
        doc = await updateLyricDocument(s.activeDocumentId, patch)
      } else {
        doc = await createLyricDocument({ ...patch, sourceType: 'manual', sourceFormat: 'json' })
      }
      get().setActiveDocument(doc, s.cues)
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to save lyric document' })
    } finally {
      set({ isSaving: false })
    }
  },

  replaceActiveCues: async (inputs) => {
    const { activeDocumentId } = get()
    if (!activeDocumentId) {
      set({ error: 'Save the lyric document first before replacing cues.' })
      return
    }
    if (!supabaseConfigured) {
      set({ error: 'Supabase is not configured.' })
      return
    }
    set({ isSaving: true, error: null })
    try {
      const cues = await replaceLyricCuesForDocument(activeDocumentId, inputs)
      set({ cues })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to replace lyric cues' })
    } finally {
      set({ isSaving: false })
    }
  },
}))
