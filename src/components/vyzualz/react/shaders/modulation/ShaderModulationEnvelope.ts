// ── ShaderModulationEnvelope ──────────────────────────────────────────────────
//
// ADHR (Attack / Decay / Hold / Release) envelope for trigger and envelope
// modulation modes.
//
// Phase timeline:
//   idle → attack → hold → release → idle
//
// Attack and release rates are time-constant based (dt / duration), not
// coefficient-based, so the ramp is linear rather than exponential.
// This avoids infinite settling time and makes the hold boundary crisp.
//
// Frame-rate independence:
//   A step dt * (1/duration) at every frame accumulates to 1.0 in exactly
//   `duration` seconds regardless of frame rate.  Because each step is bounded
//   to [0, 1] there is no overshoot.

export type EnvelopePhase = 'idle' | 'attack' | 'hold' | 'release'

export class ShaderModulationEnvelope {
  private _phase: EnvelopePhase = 'idle'
  private _value = 0
  private _holdTimer = 0

  constructor(
    private _attackMs:  number,
    private _holdMs:    number,
    private _releaseMs: number,
    private _retrigger: boolean = true,
  ) {}

  // ── Configuration setters ─────────────────────────────────────────────────

  setTiming(attackMs: number, holdMs: number, releaseMs: number): void {
    this._attackMs  = attackMs
    this._holdMs    = holdMs
    this._releaseMs = releaseMs
  }

  setRetrigger(v: boolean): void { this._retrigger = v }

  // ── Trigger ───────────────────────────────────────────────────────────────

  /**
   * Fire the envelope.  If the envelope is already active and `retrigger`
   * is true, the attack phase restarts from the current value (avoids a pop).
   * If `retrigger` is false, a trigger during active phases is ignored.
   */
  trigger(): void {
    if (this._phase === 'idle' || this._retrigger) {
      this._phase = 'attack'
      // Value is preserved — attack will ramp from wherever it currently is.
    }
  }

  /**
   * Gate the envelope: call with `active = true` while the gate signal is
   * above threshold; call with `false` when it drops below.
   * Used for 'envelope' mode (continuous gate source).
   */
  gate(active: boolean): void {
    if (active) {
      if (this._phase === 'idle' || this._phase === 'release') {
        this._phase = 'attack'
      }
    } else {
      if (this._phase === 'attack' || this._phase === 'hold') {
        this._phase = 'release'
      }
    }
  }

  // ── Per-frame update ──────────────────────────────────────────────────────

  /** Advance the envelope by `dt` seconds. Returns current value 0..1. */
  update(dt: number): number {
    switch (this._phase) {
      case 'attack': {
        const attackSec = Math.max(0.0001, this._attackMs / 1000)
        this._value = Math.min(1, this._value + dt / attackSec)
        if (this._value >= 1) {
          this._value = 1
          if (this._holdMs > 0) {
            this._holdTimer = this._holdMs / 1000
            this._phase = 'hold'
          } else {
            this._phase = 'release'
          }
        }
        break
      }
      case 'hold': {
        this._holdTimer -= dt
        if (this._holdTimer <= 0) {
          this._holdTimer = 0
          this._phase = 'release'
        }
        break
      }
      case 'release': {
        const releaseSec = Math.max(0.0001, this._releaseMs / 1000)
        this._value = Math.max(0, this._value - dt / releaseSec)
        if (this._value <= 0) {
          this._value = 0
          this._phase = 'idle'
        }
        break
      }
      case 'idle':
        break
    }

    return this._value
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  reset(): void {
    this._phase = 'idle'
    this._value = 0
    this._holdTimer = 0
  }

  // ── Accessors ─────────────────────────────────────────────────────────────

  get value():  number        { return this._value }
  get phase():  EnvelopePhase { return this._phase }
  get active(): boolean       { return this._phase !== 'idle' }
}
