// Pub/sub store for MusicIntelligenceFrame.
// Designed for high-frequency animation-frame consumers: getFrame() is a
// zero-allocation read; subscribe() is for non-React sinks (rAF loops, workers).
// Never triggers React re-renders directly — React components poll via refs.

import type { MusicIntelligenceFrame } from './types'
import { DEFAULT_MI_FRAME } from './constants'

type FrameListener = (frame: MusicIntelligenceFrame) => void

export type AudioFeatureBusPublicationKind = 'frame' | 'partial' | 'reset'

export interface AudioFeatureBusPublicationMeta {
  sequence: number
  publishedAtMs: number
  publisherId: string | null
  kind: AudioFeatureBusPublicationKind
}

let currentFrame: MusicIntelligenceFrame = { ...DEFAULT_MI_FRAME }
let publicationMeta: AudioFeatureBusPublicationMeta = {
  sequence: 0,
  publishedAtMs: 0,
  publisherId: null,
  kind: 'reset',
}
let framePublicationMeta: AudioFeatureBusPublicationMeta = publicationMeta
let authoritativeFramePublisherId: string | null = null
const listeners = new Set<FrameListener>()

function publicationTime(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
}

function recordPublication(
  publisherId: string | null,
  kind: AudioFeatureBusPublicationKind,
): AudioFeatureBusPublicationMeta {
  publicationMeta = {
    sequence: publicationMeta.sequence + 1,
    publishedAtMs: publicationTime(),
    publisherId,
    kind,
  }
  return publicationMeta
}

function notifyListeners(): void {
  if (listeners.size === 0) return
  listeners.forEach(l => {
    try { l(currentFrame) } catch { /**/ }
  })
}

export const AudioFeatureBus = {
  /** Read the most-recently published frame. Zero-allocation; safe to call every rAF tick. */
  getFrame(): MusicIntelligenceFrame {
    return currentFrame
  },

  /** Volatile metadata used to avoid duplicate analyser publishers in one animation frame. */
  getPublicationMeta(): AudioFeatureBusPublicationMeta {
    return publicationMeta
  },

  /** Metadata for the most recent complete analyser-derived frame publication. */
  getFramePublicationMeta(): AudioFeatureBusPublicationMeta {
    return framePublicationMeta
  },

  /**
   * Runtime-only ownership guard for sources that have one canonical analyser publisher.
   * null preserves the legacy/file behavior where renderer bridges may publish frames.
   */
  getAuthoritativeFramePublisherId(): string | null {
    return authoritativeFramePublisherId
  },

  setAuthoritativeFramePublisherId(publisherId: string | null): void {
    authoritativeFramePublisherId = publisherId
  },

  canPublishFrame(publisherId: string | null): boolean {
    return authoritativeFramePublisherId === null || authoritativeFramePublisherId === publisherId
  },

  /** Replace the current frame and notify all subscribers. */
  setFrame(frame: MusicIntelligenceFrame, publisherId: string | null = null): void {
    if (!AudioFeatureBus.canPublishFrame(publisherId)) return
    currentFrame = frame
    framePublicationMeta = recordPublication(publisherId, 'frame')
    notifyListeners()
  },

  /** Shallow-merge a partial update and notify subscribers. */
  updatePartial(partial: Partial<MusicIntelligenceFrame>, publisherId: string | null = null): void {
    currentFrame = { ...currentFrame, ...partial }
    recordPublication(publisherId, 'partial')
    notifyListeners()
  },

  /**
   * Subscribe to frame updates.
   * Returns an unsubscribe function.
   * Not needed for rAF consumers that call getFrame() directly.
   */
  subscribe(listener: FrameListener): () => void {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },

  /** Reset to the safe-default frame and notify. Call when a track changes. */
  reset(): void {
    currentFrame = { ...DEFAULT_MI_FRAME }
    framePublicationMeta = recordPublication(null, 'reset')
    notifyListeners()
  },
} as const
