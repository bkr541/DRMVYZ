// Pub/sub store for MusicIntelligenceFrame.
// Designed for high-frequency animation-frame consumers: getFrame() is a
// zero-allocation read; subscribe() is for non-React sinks (rAF loops, workers).
// Never triggers React re-renders directly — React components poll via refs.

import type { MusicIntelligenceFrame } from './types'
import { DEFAULT_MI_FRAME } from './constants'

type FrameListener = (frame: MusicIntelligenceFrame) => void

let currentFrame: MusicIntelligenceFrame = { ...DEFAULT_MI_FRAME }
const listeners = new Set<FrameListener>()

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

  /** Replace the current frame and notify all subscribers. */
  setFrame(frame: MusicIntelligenceFrame): void {
    currentFrame = frame
    notifyListeners()
  },

  /** Shallow-merge a partial update and notify subscribers. */
  updatePartial(partial: Partial<MusicIntelligenceFrame>): void {
    currentFrame = { ...currentFrame, ...partial }
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
    notifyListeners()
  },
} as const
