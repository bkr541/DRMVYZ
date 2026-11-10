// Sound Drawing XY: the conversation between letters. Pure state machine, no DOM and no audio access:
// callers push musical events and advance time, and read each letter's state back.
//
//   kick    -> ripples left to right: a ring-down on every letter, a small pop, a brightness flash.
//   snare   -> the answer, right to left: a travelling ripple and a light fray.
//   phrase  -> the whole word dissolves into the live scope (left to right), holds a moment, and re-forms.
//
// Every effect decays on its own time constant, so the word is always readable again between hits.

export type XyScopeEventType = 'kick' | 'snare' | 'phrase'

export interface XyScopeEvent {
  type: XyScopeEventType
  /** 0..1, already scaled by Audio Reactivity. Zero is ignored. */
  strength: number
}

export interface XyScopeConversationParams {
  /** Dissolve Depth, 0..1.5. */
  dissolveDepth: number
  /** Answer Delay between neighbouring letters, in milliseconds. */
  answerDelayMs: number
}

export interface XyScopeGlyphState {
  /** Fray from kicks and snares. */
  dissolveHit: number
  /** Full dissolve at a phrase or drop. */
  dissolvePhrase: number
  /** Time until which a phrase dissolve is held. */
  holdUntil: number
  /** Ring-down energy. */
  vibration: number
  ringPhase: number
  /** Snare ripple energy and phase. */
  ripple: number
  ripplePhase: number
  /** Kick pop. */
  kick: number
  /** Brightness flash. */
  flash: number
  /** Where along the letter the next dissolve starts unspooling (0..1). */
  fray: number
}

interface PendingApplication {
  at: number
  glyph: number
  type: XyScopeEventType
  strength: number
}

const GOLDEN_STEP = 0.381966
const MAX_PENDING = 512
const PHRASE_HOLD_SEC = 0.3
/** Phrase dissolves travel a little slower than kicks so the wave is visible. */
const PHRASE_STAGGER = 1.6

export function createXyScopeGlyphState(): XyScopeGlyphState {
  return {
    dissolveHit: 0, dissolvePhrase: 0, holdUntil: 0, vibration: 0, ringPhase: 0,
    ripple: 0, ripplePhase: 0, kick: 0, flash: 0, fray: 0,
  }
}

export class XyScopeConversation {
  readonly states: XyScopeGlyphState[] = []
  private pending: PendingApplication[] = []

  /** Drops all letter state, for a new word, a seek, or a track change. */
  reset(glyphCount: number): void {
    this.pending = []
    this.states.length = 0
    for (let i = 0; i < glyphCount; i += 1) this.states.push(createXyScopeGlyphState())
  }

  /** Schedules the event across the letters. Kicks and phrases run left to right, snares right to left. */
  push(event: XyScopeEvent, nowSec: number, params: XyScopeConversationParams): void {
    const count = this.states.length
    if (count === 0 || !(event.strength > 0)) return
    const delay = Math.max(0, params.answerDelayMs) / 1000
    for (let glyph = 0; glyph < count; glyph += 1) {
      const order = event.type === 'snare' ? count - 1 - glyph : glyph
      const stagger = event.type === 'phrase' ? delay * PHRASE_STAGGER : delay
      this.pending.push({ at: nowSec + order * stagger, glyph, type: event.type, strength: Math.min(1, event.strength) })
    }
    if (this.pending.length > MAX_PENDING) this.pending.splice(0, this.pending.length - MAX_PENDING)
  }

  /** Applies everything now due, then decays every effect by `dtSec`. */
  update(dtSec: number, nowSec: number, params: XyScopeConversationParams): void {
    this.applyDue(nowSec, params)
    const decay = (tau: number) => Math.exp(-dtSec / tau)
    const dKick = decay(0.14)
    const dKickPop = decay(0.18)
    const dVib = decay(0.3)
    const dRipple = decay(0.24)
    const dFlash = decay(0.13)
    const dPhraseOut = decay(0.17)
    const riseToHold = 1 - decay(0.07)
    for (const state of this.states) {
      state.dissolveHit *= dKick
      state.kick *= dKickPop
      state.vibration *= dVib
      state.ripple *= dRipple
      state.flash *= dFlash
      state.ripplePhase += dtSec * 24
      state.ringPhase += dtSec * Math.PI * 2 * 9
      if (nowSec < state.holdUntil) state.dissolvePhrase += (1 - state.dissolvePhrase) * riseToHold
      else state.dissolvePhrase *= dPhraseOut
      if (state.dissolvePhrase < 0.003) state.dissolvePhrase = 0
      if (state.dissolveHit < 0.003) state.dissolveHit = 0
    }
  }

  /** Total dissolve 0..1 for a letter. */
  dissolve(glyph: number): number {
    const state = this.states[glyph]
    return state ? Math.min(1, state.dissolveHit + state.dissolvePhrase) : 0
  }

  private applyDue(nowSec: number, params: XyScopeConversationParams): void {
    if (this.pending.length === 0) return
    const depth = Math.max(0, params.dissolveDepth)
    const keep: PendingApplication[] = []
    for (const item of this.pending) {
      if (item.at > nowSec) { keep.push(item); continue }
      const state = this.states[item.glyph]
      if (!state) continue
      const s = item.strength
      if (item.type === 'kick') {
        state.dissolveHit = Math.max(state.dissolveHit, 0.05 * s * depth)
        state.vibration = Math.max(state.vibration, 0.55 + 0.45 * s)
        state.kick = Math.max(state.kick, s)
        state.flash = Math.max(state.flash, 0.8 * s)
        state.ringPhase = 0
        state.fray = (state.fray + GOLDEN_STEP) % 1
      } else if (item.type === 'snare') {
        state.dissolveHit = Math.max(state.dissolveHit, 0.08 * s * depth)
        state.ripple = Math.max(state.ripple, s)
        state.ripplePhase = 0
        state.vibration = Math.max(state.vibration, 0.5 * s)
        state.flash = Math.max(state.flash, s)
        state.fray = (state.fray + GOLDEN_STEP) % 1
      } else {
        if (depth > 0) {
          state.holdUntil = nowSec + PHRASE_HOLD_SEC
          state.fray = (state.fray + GOLDEN_STEP) % 1
        }
        state.vibration = 1
        state.flash = 1
      }
    }
    this.pending = keep
  }
}
