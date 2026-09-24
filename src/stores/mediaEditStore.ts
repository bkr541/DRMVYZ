// The single source of truth for the Media Manager editing session.
//
// The Edit inspector writes to it, the center preview reads it, Save / Save As
// read it, and dirty-state detection and both navigation guards read it. Nothing
// else keeps its own copy of the edit values.

import { create } from 'zustand'
import {
  createDefaultMediaEdit,
  mediaEditsEqual,
  normalizeCrop,
  normalizeMediaEdit,
  rotateMediaEdit,
  toggleMediaEditFlip,
  toggleMediaEditMirror,
  type MediaEditCrop,
  type MediaEditSliderKey,
  type MediaEditState,
} from '../features/media/edit/mediaEditModel'
import { deriveEditedMetadata, nextContentFingerprint } from '../features/media/edit/mediaEditMetadata'
import { fileNameForTitle, validateMediaName, withExtension } from '../features/media/edit/mediaEditOutput'
import { mediaEditUnsupportedReason, renderEditedMedia } from '../features/media/edit/mediaEditRender'
import { useMediaStore, type UploadedMedia } from './mediaStore'

export type MediaEditBusy = 'idle' | 'saving' | 'saving-as'

export type MediaEditSaveOutcome =
  | { ok: true; mediaId: string }
  | { ok: false; kind: 'busy' | 'no-session' | 'no-changes' | 'invalid' | 'conflict' | 'cancelled' | 'failed'; error: string }

export interface MediaEditProgress {
  stage: 'rendering' | 'uploading'
  /** 0..1 while rendering a video; otherwise null (indeterminate). */
  fraction: number | null
}

interface MediaEditSessionState {
  /** Canonical UploadedMedia id the session edits, or null when nothing is being edited. */
  mediaId: string | null
  /** What the saved content currently is. Always neutral: Save bakes edits into the asset. */
  baseline: MediaEditState
  edit: MediaEditState
  cropMode: boolean
  busy: MediaEditBusy
  progress: MediaEditProgress | null
  error: string | null

  beginSession(mediaId: string | null): void
  endSession(): void
  setSlider(key: MediaEditSliderKey, value: number): void
  rotate(quarterTurns: number): void
  toggleFlip(): void
  toggleMirror(): void
  setCrop(crop: MediaEditCrop): void
  resetCrop(): void
  setCropMode(active: boolean): void
  /** Returns every value to the saved baseline. */
  discard(): void
  clearError(): void
  save(): Promise<MediaEditSaveOutcome>
  saveAs(name: string): Promise<MediaEditSaveOutcome>
}

let inFlightAbort: AbortController | null = null

function newSession(mediaId: string | null): Pick<MediaEditSessionState, 'mediaId' | 'baseline' | 'edit' | 'cropMode' | 'busy' | 'progress' | 'error'> {
  return {
    mediaId,
    baseline: createDefaultMediaEdit(),
    edit: createDefaultMediaEdit(),
    cropMode: false,
    busy: 'idle',
    progress: null,
    error: null,
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

export const useMediaEditStore = create<MediaEditSessionState>((set, get) => {
  const editable = () => get().mediaId !== null && get().busy === 'idle'
  const patchEdit = (next: (edit: MediaEditState) => MediaEditState) => {
    if (!editable()) return
    set(state => ({ edit: normalizeMediaEdit(next(state.edit)), error: null }))
  }

  /** Shared front half of Save and Save As: resolve the media and render the edit to a file. */
  const renderCurrent = async (
    media: UploadedMedia,
    edit: MediaEditState,
    signal: AbortSignal,
  ) => {
    // A signed URL close to expiry would fail mid-render; refresh it first.
    await useMediaStore.getState().ensureMediaSigned([media.id], 'visible')
    const fresh = useMediaStore.getState().items.find(item => item.id === media.id) ?? media
    set({ progress: { stage: 'rendering', fraction: fresh.type === 'video' ? 0 : null } })
    return {
      fresh,
      rendered: await renderEditedMedia(
        {
          type: fresh.type,
          url: fresh.url,
          mimeType: fresh.mimeType ?? fresh.metadata.detectedMimeType ?? null,
          hasAlpha: fresh.metadata.hasAlpha === true,
          fps: fresh.metadata.fps,
        },
        edit,
        {
          signal,
          onProgress: fraction => { if (!signal.aborted) set({ progress: { stage: 'rendering', fraction } }) },
        },
      ),
    }
  }

  const begin = (mode: Exclude<MediaEditBusy, 'idle'>): { media: UploadedMedia; edit: MediaEditState; signal: AbortSignal } | MediaEditSaveOutcome => {
    const state = get()
    if (state.busy !== 'idle') return { ok: false, kind: 'busy', error: 'A save is already in progress.' }
    if (!state.mediaId) return { ok: false, kind: 'no-session', error: 'Select an image or video to edit first.' }
    const media = useMediaStore.getState().items.find(item => item.id === state.mediaId)
    if (!media) return { ok: false, kind: 'no-session', error: 'That media is no longer available.' }
    const unsupported = mediaEditUnsupportedReason(media)
    if (unsupported) return { ok: false, kind: 'invalid', error: unsupported }
    if (state.cropMode) return { ok: false, kind: 'invalid', error: 'Apply or cancel the crop before saving.' }
    if (mediaEditsEqual(state.edit, state.baseline)) return { ok: false, kind: 'no-changes', error: 'There are no edits to save.' }
    const controller = new AbortController()
    inFlightAbort = controller
    set({ busy: mode, error: null, progress: { stage: 'rendering', fraction: null } })
    return { media, edit: state.edit, signal: controller.signal }
  }

  const finish = (patch: Partial<MediaEditSessionState>) => {
    inFlightAbort = null
    set({ busy: 'idle', progress: null, ...patch })
  }

  const fail = (error: unknown, fallback: string): MediaEditSaveOutcome => {
    if (isAbort(error)) {
      finish({ error: null })
      return { ok: false, kind: 'cancelled', error: 'Save cancelled.' }
    }
    const message = errorMessage(error, fallback)
    finish({ error: message })
    return { ok: false, kind: 'failed', error: message }
  }

  return {
    ...newSession(null),

    beginSession(mediaId) {
      if (get().mediaId === mediaId) return
      inFlightAbort?.abort()
      set(newSession(mediaId))
    },

    endSession() {
      inFlightAbort?.abort()
      set(newSession(null))
    },

    setSlider(key, value) { patchEdit(edit => ({ ...edit, [key]: value })) },
    rotate(quarterTurns) { patchEdit(edit => rotateMediaEdit(edit, quarterTurns)) },
    toggleFlip() { patchEdit(toggleMediaEditFlip) },
    toggleMirror() { patchEdit(toggleMediaEditMirror) },
    setCrop(crop) { patchEdit(edit => ({ ...edit, crop: normalizeCrop(crop) })) },
    resetCrop() { patchEdit(edit => ({ ...edit, crop: createDefaultMediaEdit().crop })) },

    setCropMode(active) {
      if (!editable()) return
      set({ cropMode: active })
    },

    discard() {
      if (get().busy !== 'idle') return
      set(state => ({ edit: { ...state.baseline, crop: { ...state.baseline.crop } }, cropMode: false, error: null }))
    },

    clearError() { set({ error: null }) },

    async save() {
      const started = begin('saving')
      if ('ok' in started) return started
      const { media, edit, signal } = started
      try {
        const { fresh, rendered } = await renderCurrent(media, edit, signal)
        set({ progress: { stage: 'uploading', fraction: null } })
        const file = new File([rendered.blob], withExtension(fresh.name, rendered.extension), { type: rendered.mimeType })
        const fingerprint = await nextContentFingerprint(fresh.metadata, rendered.blob, `${fresh.id}:${Date.now()}`)
        const result = await useMediaStore.getState().replaceMediaContent(fresh.id, file, {
          metadata: deriveEditedMetadata(fresh.metadata, rendered, fingerprint),
          signal,
        })
        if (!result.ok) {
          finish({ error: result.error })
          return { ok: false, kind: result.kind === 'conflict' ? 'conflict' : result.kind === 'cancelled' ? 'cancelled' : 'failed', error: result.error }
        }
        // Only now, with the new content fully persisted, is the session clean again.
        finish(get().mediaId === fresh.id ? { ...newSession(fresh.id), busy: 'idle' } : {})
        return { ok: true, mediaId: fresh.id }
      } catch (error) {
        return fail(error, 'The edited media could not be saved.')
      }
    },

    async saveAs(rawName) {
      const validation = validateMediaName(rawName)
      if (!validation.ok) return { ok: false, kind: 'invalid', error: validation.error }
      const started = begin('saving-as')
      if ('ok' in started) return started
      const { media, edit, signal } = started
      try {
        const { fresh, rendered } = await renderCurrent(media, edit, signal)
        set({ progress: { stage: 'uploading', fraction: null } })
        const file = new File([rendered.blob], fileNameForTitle(validation.name, rendered.extension), { type: rendered.mimeType })
        const upload = await useMediaStore.getState().uploadCanonicalVisualFile(file, {
          allowVideo: true,
          role: fresh.mediaRole,
          title: validation.name,
          description: fresh.description,
          tags: [...fresh.tags],
          collectionIds: [...fresh.collectionIds],
          // No fingerprint: the copy is new content, never a Deck-pinned source.
          metadata: deriveEditedMetadata(fresh.metadata, rendered),
          signal,
        })
        if (!upload.ok) {
          finish({ error: upload.error })
          return { ok: false, kind: upload.phase === 'cancelled' ? 'cancelled' : 'failed', error: upload.error }
        }
        // The original keeps its content untouched; the session moves to the new item, clean.
        finish(newSession(upload.item.id))
        return { ok: true, mediaId: upload.item.id }
      } catch (error) {
        return fail(error, 'The edited copy could not be saved.')
      }
    },
  }
})

export function selectMediaEditDirty(state: Pick<MediaEditSessionState, 'edit' | 'baseline'>): boolean {
  return !mediaEditsEqual(state.edit, state.baseline)
}

/** True while leaving would lose work: unsaved edits, or a save that has not finished. */
export function selectMediaEditNeedsGuard(state: Pick<MediaEditSessionState, 'edit' | 'baseline' | 'busy'>): boolean {
  return state.busy !== 'idle' || selectMediaEditDirty(state)
}
