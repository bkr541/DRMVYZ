// Sound Drawing XY: musical events from the shared performance context. The engine reads the same kick, snare,
// phrase-boundary and drop signals every other engine reads; it never runs a second analyser. Pure: the caller
// passes the current and previous contexts and gets back what happened this frame.

import type { SharedPerformanceContext } from '../../../../features/performanceCore'
import type { XyScopeEvent } from './XyScopeConversation'
import type { XyScopePhraseLength } from './XyScopeSettings'

export interface XyScopeEventParams {
  audioReactivity: number
  phraseDissolve: boolean
  phraseLength: XyScopePhraseLength
  dropDissolve: boolean
}

export interface XyScopeFrameEvents {
  events: XyScopeEvent[]
  /** A seek, loop wrap or track change happened: the conversation must start from rest. */
  discontinuity: boolean
}

const NO_EVENTS: XyScopeFrameEvents = Object.freeze({ events: Object.freeze([]) as unknown as XyScopeEvent[], discontinuity: false })

/**
 * With analysed sections, phrases are counted from the current macro-section's start so a dissolve lands on a
 * section entry. Without them the performance blocks never advance, so the plain bar grid is used instead.
 */
function phraseBoundary(context: SharedPerformanceContext, length: XyScopePhraseLength): boolean {
  const b = context.boundaries
  const sectionAligned = context.resolvedMacroSection != null
  switch (length) {
    case 'bar4': return sectionAligned ? b.performanceFourBarBoundary : b.fourBarBoundary
    case 'bar8': return sectionAligned ? b.performanceEightBarBoundary : b.eightBarBoundary
    case 'bar16': return sectionAligned ? b.performanceSixteenBarBoundary : b.sixteenBarBoundary
  }
}

/**
 * Events for one fresh audio frame. A phrase boundary and a drop on the same frame produce a single phrase
 * dissolve. Strengths are scaled by Audio Reactivity, so zero produces no events at all.
 */
export function deriveXyScopeEvents(
  context: SharedPerformanceContext | null,
  previous: SharedPerformanceContext | null,
  params: XyScopeEventParams,
): XyScopeFrameEvents {
  if (!context) return NO_EVENTS
  const discontinuity = context.seekDetected || context.loopWrapDetected || context.trackReplacementDetected
  if (discontinuity || !(params.audioReactivity > 0)) return discontinuity ? { events: [], discontinuity } : NO_EVENTS
  const events: XyScopeEvent[] = []
  const scale = Math.min(1, params.audioReactivity)
  if (context.kick) events.push({ type: 'kick', strength: Math.min(1, (context.kickStrength || 1)) * scale })
  if (context.snare) events.push({ type: 'snare', strength: Math.min(1, (context.snareStrength || 1)) * scale })
  const phrase = params.phraseDissolve && phraseBoundary(context, params.phraseLength)
  const drop = params.dropDissolve && previous != null && context.dropOccurrence > previous.dropOccurrence
  if (phrase || drop) events.push({ type: 'phrase', strength: scale })
  return { events, discontinuity: false }
}
