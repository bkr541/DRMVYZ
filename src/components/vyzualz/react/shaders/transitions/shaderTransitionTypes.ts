import type { ReactSectionType } from '../../ReactTypes'
import type { MusicIntelligenceFrame } from '../../../../../features/musicIntelligence/types'

// ── Re-export for consumers within the shader engine ─────────────────────────
export type { ReactSectionType, MusicIntelligenceFrame }

// ── Transition type ───────────────────────────────────────────────────────────

export type TransitionType =
  | 'crossfade'
  | 'luma-dissolve'
  | 'noise-dissolve'
  | 'radial-wipe'
  | 'pixel-scatter'
  | 'rgb-split-dissolve'
  | 'liquid-melt'
  | 'zoom-tunnel'
  | 'feedback-collapse'
  | 'flash-cut'

export const ALL_TRANSITION_TYPES: TransitionType[] = [
  'crossfade', 'luma-dissolve', 'noise-dissolve', 'radial-wipe', 'pixel-scatter',
  'rgb-split-dissolve', 'liquid-melt', 'zoom-tunnel', 'feedback-collapse', 'flash-cut',
]

// ── Easing ────────────────────────────────────────────────────────────────────

export type TransitionEasing =
  | 'linear'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | 'cubic'

export function applyEasing(t: number, easing: TransitionEasing): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t
  switch (easing) {
    case 'linear':      return c
    case 'ease-in':     return c * c
    case 'ease-out':    return c * (2 - c)
    case 'ease-in-out': return c < 0.5 ? 2 * c * c : -1 + (4 - 2 * c) * c
    case 'cubic':       return c * c * (3 - 2 * c)
    default:            return c
  }
}

// ── Direction ─────────────────────────────────────────────────────────────────

export type TransitionDirection = 'forward' | 'backward' | 'random'

// ── Start triggers ────────────────────────────────────────────────────────────

/**
 * When the transition begins relative to music timing.
 * 'immediate'     — fire on the very next tick
 * 'next-beat'     — fire on the next beatHit
 * 'next-downbeat' — fire on the next downbeatHit (beat 1 of a bar)
 * 'next-bar'      — fire on the next bar boundary (barIndex increments)
 * 'next-phrase'   — fire on the next phrase16Hit
 * 'next-section'  — fire on the next section boundary (section.type change)
 */
export type StartTrigger =
  | 'immediate'
  | 'next-beat'
  | 'next-downbeat'
  | 'next-bar'
  | 'next-phrase'
  | 'next-section'

export const ALL_START_TRIGGERS: StartTrigger[] = [
  'immediate', 'next-beat', 'next-downbeat', 'next-bar', 'next-phrase', 'next-section',
]

// ── Feedback interaction ──────────────────────────────────────────────────────

export type FeedbackClearTiming =
  | 'preserve'        // do not clear feedback
  | 'at-start'        // clear when transition begins
  | 'at-midpoint'     // clear when progress crosses 0.5
  | 'at-completion'   // clear when transition completes

// ── Transition definition ─────────────────────────────────────────────────────

export interface TransitionDefinition {
  type:           TransitionType
  durationMs:     number
  easing:         TransitionEasing
  direction:      TransitionDirection
  intensity:      number            // 0..1 — effect strength passed to GLSL
  seed:           number            // integer seed for noise/scatter shaders
  startTrigger:   StartTrigger
  beatCount?:     number            // minimum beats to wait before firing
  clearFeedback?: FeedbackClearTiming
}

export const DEFAULT_TRANSITION: Readonly<TransitionDefinition> = {
  type:          'crossfade',
  durationMs:    600,
  easing:        'ease-in-out',
  direction:     'forward',
  intensity:     1.0,
  seed:          0,
  startTrigger:  'immediate',
  clearFeedback: 'preserve',
}

// ── Section choreography ──────────────────────────────────────────────────────

export type ShaderSectionType = ReactSectionType

export interface ShaderSectionRule {
  /** Which section type triggers this rule, or '*' to match any. */
  sectionType:   ShaderSectionType | '*'
  /** The shader scene to transition to. */
  toSceneId:     string
  /** How to perform the transition. */
  transition:    TransitionDefinition
  /** Whether to reset feedback during the transition. */
  clearFeedback?: FeedbackClearTiming
  /** Optional parameter overrides to apply to the incoming scene. */
  paramOverrides?: Record<string, unknown>
}

// ── Transition state machine ──────────────────────────────────────────────────

export type TransitionPhase =
  | 'idle'      // no transition in progress
  | 'waiting'   // queued, waiting for start trigger to fire
  | 'active'    // transition is rendering
  | 'done'      // completed this frame (caller should flip to idle)

export interface ActiveTransitionState {
  phase:              TransitionPhase
  fromSceneId:        string | null
  toSceneId:          string
  definition:         TransitionDefinition
  progressRaw:        number     // 0..1 unclamped linear fraction
  progressEased:      number     // 0..1 eased
  elapsedMs:          number
  lastBarIndex:       number     // bar index when waiting began (for trigger matching)
  lastSectionType:    string | null
  feedbackMidpointFired: boolean
}

export const IDLE_TRANSITION: ActiveTransitionState = {
  phase:               'idle',
  fromSceneId:         null,
  toSceneId:           '',
  definition:          DEFAULT_TRANSITION,
  progressRaw:         0,
  progressEased:       0,
  elapsedMs:           0,
  lastBarIndex:        -1,
  lastSectionType:     null,
  feedbackMidpointFired: false,
}

// ── Tick result ───────────────────────────────────────────────────────────────

export interface TransitionTickResult {
  /** Did the transition trigger fire this frame (waiting → active)? */
  triggerFired:     boolean
  /** Did the transition complete this frame (active → idle)? */
  justCompleted:    boolean
  /** Clear feedback buffer this frame? */
  feedbackClearNow: FeedbackClearTiming | null
  /** The outgoing scene (from) during an active transition. */
  fromSceneId:      string | null
  /** The incoming scene (to) during a waiting or active transition. */
  toSceneId:        string | null
  /** Current phase. */
  phase:            TransitionPhase
  /** Eased progress 0..1. Valid during 'active'. */
  progress:         number
  /** True while a dual-scene render is needed. */
  shouldRenderDual: boolean
}
