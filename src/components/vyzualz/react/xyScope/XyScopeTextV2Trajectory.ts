import type { SharedPerformanceContext } from '../../../../features/performanceCore'
import type { TextV2PerformanceFrame } from './XyScopeTextV2Performance'

export type TextV2TrajectoryPhase = 'word' | 'depart' | 'formation' | 'reform'
export interface TextV2TrajectoryFrame {
  phase: TextV2TrajectoryPhase
  /** 0 = lettering; 1 = oscillator only. Applies to EVERY beam sample. */
  morph: number
  cycle: number
  /** A word is replaced only while the beam is completely in its oscillator formation. */
  commitWordEvent: string | null
}
const smooth = (x: number) => x * x * (3 - 2 * x)

/** Musical cues start departures and returns. Clocks only ease an already-cued transition. */
export class XyScopeTextV2Trajectory {
  private phase: TextV2TrajectoryPhase = 'word'
  private progress = 0
  private heldBeats = 0
  private cycle = 0
  private pendingWord: string | null = null
  private lastCue: string | null = null
  private previousAmount = 0
  private started = false
  private lastDecision = 'idle'
  private revealWord = false

  reset(): void {
    this.phase = 'word'; this.progress = 0; this.heldBeats = 0; this.cycle = 0
    this.pendingWord = null; this.lastCue = null; this.previousAmount = 0; this.started = false; this.lastDecision = 'idle'; this.revealWord = false
  }

  update(frame: TextV2PerformanceFrame, context: SharedPerformanceContext | null, fresh: boolean, playing: boolean, dt: number): TextV2TrajectoryFrame {
    let commitWordEvent: string | null = null
    const discontinuity = fresh && context && (context.seekDetected || context.loopWrapDetected || context.trackReplacementDetected)
    if (discontinuity) { this.reset(); this.started = true; this.previousAmount = frame.amount }
    const secondsPerBeat = context && context.bpm > 0 ? 60 / context.bpm : .5
    const beats = Math.max(0, dt) / secondsPerBeat
    const music = playing && frame.amount > .025
    const onset = music && this.previousAmount <= .1 && frame.amount > .1
    this.previousAmount = frame.amount
    const newDecision = frame.plan.id !== this.lastDecision
    if (newDecision) this.lastDecision = frame.plan.id
    const cue = fresh && context && !discontinuity ? frame.wordEventId : null
    const newCue = cue !== null && cue !== this.lastCue
    if (cue) this.lastCue = cue
    if (newCue && playing) this.pendingWord = cue

    if (!playing || frame.amount < .015) {
      // Pause/silence returns the currently selected word, never commits a queued replacement.
      this.pendingWord = null; this.revealWord = false
      this.progress = Math.max(0, this.progress - dt / Math.max(.12, frame.controls.reformMs / 1000))
      this.phase = this.progress > 0 ? 'reform' : 'word'
      this.heldBeats = 0
    } else if (!discontinuity) {
      this.heldBeats += beats
      if (this.phase === 'word') {
        if ((onset && !this.started) || ((this.pendingWord || (newDecision && frame.plan.intent === 'depart')) && this.heldBeats >= frame.plan.holdBeats)) {
          this.phase = 'depart'; this.heldBeats = 0; this.cycle += 1; this.started = true
        }
      } else if (this.phase === 'depart') {
        this.progress = Math.min(1, this.progress + beats / (.5 + frame.controls.strokeProtection * .4 + (1 - frame.controls.departure) * .3))
        if (this.progress === 1) { this.phase = 'formation'; this.heldBeats = 0 }
      } else if (this.phase === 'formation') {
        if ((this.revealWord || (newDecision && frame.plan.intent === 'reform')) && this.heldBeats >= frame.plan.holdBeats) { this.phase = 'reform'; this.heldBeats = 0; this.revealWord = false }
      } else {
        this.progress = Math.max(0, this.progress - beats / (.6 + frame.controls.transientReadability * .4))
        if (this.progress === 0) { this.phase = 'word'; this.heldBeats = 0 }
      }
      if (this.progress === 1 && this.pendingWord) {
        commitWordEvent = this.pendingWord
        this.pendingWord = null; this.revealWord = true
      }
    }
    return { phase: this.phase, morph: smooth(this.progress), cycle: this.cycle, commitWordEvent }
  }
}
