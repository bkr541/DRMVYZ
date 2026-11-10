// Sound Drawing XY: musical events from the shared performance context. The engine reads the same kick, snare,
// beat, bar, phrase and drop signals every other engine reads; it never runs a second analyser. Pure: the caller
// passes the current and previous contexts and gets back what happened this frame.
//
// Two separate things come out of a frame:
//   - hits (kick, snare) that ripple the letters, and
//   - the Trigger event identity that advances Pattern Change, resolved for the canonical Cinema 2.0 trigger set.

import type { SharedPerformanceContext } from '../../../../features/performanceCore'
import type { XyScopeEvent } from './XyScopeConversation'
import type { XyScopeTrigger } from './XyScopeSettings'

export interface XyScopeEventParams {
  audioReactivity: number
}

export interface XyScopeFrameEvents {
  events: XyScopeEvent[]
  /** A seek, loop wrap or track change happened: the conversation must start from rest. */
  discontinuity: boolean
}

const NO_EVENTS: XyScopeFrameEvents = Object.freeze({ events: Object.freeze([]) as unknown as XyScopeEvent[], discontinuity: false })

export function hasXyScopeDiscontinuity(context: SharedPerformanceContext | null): boolean {
  return context != null && (context.seekDetected || context.loopWrapDetected || context.trackReplacementDetected)
}

/**
 * Hits for one fresh audio frame. Strengths are scaled by Audio Reactivity, so zero produces no hits at all.
 */
export function deriveXyScopeEvents(context: SharedPerformanceContext | null, params: XyScopeEventParams): XyScopeFrameEvents {
  if (!context) return NO_EVENTS
  if (hasXyScopeDiscontinuity(context)) return { events: [], discontinuity: true }
  if (!(params.audioReactivity > 0)) return NO_EVENTS
  const events: XyScopeEvent[] = []
  const scale = Math.min(1, params.audioReactivity)
  if (context.kick) events.push({ type: 'kick', strength: Math.min(1, (context.kickStrength || 1)) * scale })
  if (context.snare) events.push({ type: 'snare', strength: Math.min(1, (context.snareStrength || 1)) * scale })
  return { events, discontinuity: false }
}

/**
 * The identity of the musical event the chosen Trigger names on this frame, or null when it did not happen.
 * Identities are unique per event, so the Cinema 2.0 pattern controller advances exactly once per event however
 * many frames carry it. `sequence` numbers the fresh audio frames and identifies kick and snare hits, which the
 * shared context reports as one-frame flags.
 *
 * Beat and bar triggers count the plain beat and bar grid (as Cinema 2.0 does), phrase uses the analysed phrase
 * when there is one and the 16-bar clock otherwise, and drop uses a new drop occurrence.
 */
export function resolveXyScopeTriggerEventId(
  context: SharedPerformanceContext | null,
  previous: SharedPerformanceContext | null,
  trigger: XyScopeTrigger,
  sequence: number,
): string | null {
  if (!context || hasXyScopeDiscontinuity(context)) return null
  const b = context.boundaries
  switch (trigger) {
    case 'beat': return b.beatBoundary ? `beat:${context.beatIndex}` : null
    case 'kick': return context.kick ? `kick:${sequence}` : null
    case 'snare': return context.snare ? `snare:${sequence}` : null
    case 'downbeat': return b.beatBoundary && context.downbeat ? `downbeat:${context.beatIndex}` : null
    case 'beat2': return b.beatBoundary && context.beatIndex % 2 === 0 ? `beat2:${context.beatIndex}` : null
    case 'beat4': return b.beatBoundary && context.beatIndex % 4 === 0 ? `beat4:${context.beatIndex}` : null
    case 'bar': return b.barBoundary ? `bar:${context.barIndex}` : null
    case 'bar4': return b.fourBarBoundary ? `bar4:${context.barIndex}` : null
    case 'bar8': return b.eightBarBoundary ? `bar8:${context.barIndex}` : null
    case 'phrase': {
      const analysed = previous != null && context.phraseIndex !== previous.phraseIndex
      return analysed || b.sixteenBarBoundary ? `phrase:${context.phraseIndex}:${context.barIndex}` : null
    }
    case 'drop': return previous != null && context.dropOccurrence > previous.dropOccurrence ? `drop:${context.dropOccurrence}` : null
  }
}
